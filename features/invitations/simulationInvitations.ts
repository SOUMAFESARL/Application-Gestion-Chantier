/**
 * Simulation locale des invitations de collaborateurs.
 *
 * `POST /invitations/`, `GET /invitations/`, `POST /invitations/verifier/` et
 * `POST /invitations/accepter/` n'existent pas encore côté serveur : ce module
 * rejoue leur contrat pour que l'ajout d'un collaborateur et l'écran
 * `/invitation` se parcourent sans backend. Même rôle que
 * `simulationCollaborateurs.ts` pour le tableau, `lib/api/simulation.ts` pour
 * l'inscription.
 *
 * **Stockage en `localStorage`, pas `sessionStorage`.** Le parcours traverse
 * deux onglets — celui de l'admin qui crée l'invitation, celui du
 * collaborateur qui ouvre le lien reçu — et doit donc survivre au changement
 * d'onglet, contrairement à l'état d'inscription qui reste dans le même.
 */

import { texte } from "@/i18n/horsReact";
import { ErreurApi } from "@/lib/api";

import type {
  AccepterInvitationPayload,
  ContenuInvitation,
  CreerInvitationPayload,
  InvitationDetail,
  ReponseAccepterInvitation,
} from "./api";

const CLE_ETAT = "ccd.simulation.invitations";
const LATENCE = 500;
const DUREE_VALIDITE_MS = 72 * 60 * 60 * 1000;
const ENTREPRISE_DEMO = "Ivoire BTP";

interface InvitationSimulee {
  id: string;
  jeton: string;
  email: string;
  nom: string;
  role_propose: string;
  cree_le: string;
  expire_le: string;
  utilise_le: string | null;
  statut: InvitationDetail["statut"];
}

/**
 * Le jeton n'existe que dans la simulation : en réalité il ne voyage que par
 * email, jamais dans la réponse de création — d'où ce type élargi, propre à
 * cette couche.
 */
export interface InvitationDetailSimulee extends InvitationDetail {
  jeton: string;
}

function attendre<T>(valeur: T, delai = LATENCE): Promise<T> {
  return new Promise((resoudre) => setTimeout(() => resoudre(valeur), delai));
}

function idAleatoire(prefixe: string): string {
  return `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function lireEtat(): InvitationSimulee[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE_ETAT);
    return brut ? (JSON.parse(brut) as InvitationSimulee[]) : [];
  } catch {
    return [];
  }
}

function ecrireEtat(etat: InvitationSimulee[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_ETAT, JSON.stringify(etat));
  } catch {
    // Navigation privée saturée : la simulation perd sa mémoire, sans plus.
  }
}

function estValide(invitation: InvitationSimulee | undefined): invitation is InvitationSimulee {
  return (
    invitation !== undefined &&
    invitation.statut === "ENVOYEE" &&
    Date.now() <= Date.parse(invitation.expire_le)
  );
}

function versDetail(invitation: InvitationSimulee): InvitationDetail {
  return {
    id: invitation.id,
    email: invitation.email,
    nom: invitation.nom,
    role_propose: invitation.role_propose,
    emetteur: null,
    expire_le: invitation.expire_le,
    utilise_le: invitation.utilise_le,
    statut: invitation.statut,
    est_expiree: invitation.statut === "ENVOYEE" && Date.now() > Date.parse(invitation.expire_le),
    cree_le: invitation.cree_le,
    modifie_le: invitation.utilise_le ?? invitation.cree_le,
  };
}

function refuserJetonInvalide(): never {
  throw new ErreurApi("jeton_expire", texte("invitation.expireAccroche"), 410);
}

export const simulationInvitations = {
  async creer(payload: CreerInvitationPayload): Promise<InvitationDetailSimulee> {
    const maintenant = new Date();
    const invitation: InvitationSimulee = {
      id: idAleatoire("inv"),
      jeton: idAleatoire("jet"),
      email: payload.email,
      nom: payload.nom ?? "",
      role_propose: payload.role_propose,
      cree_le: maintenant.toISOString(),
      expire_le: new Date(maintenant.getTime() + DUREE_VALIDITE_MS).toISOString(),
      utilise_le: null,
      statut: "ENVOYEE",
    };

    const etat = lireEtat();
    etat.unshift(invitation);
    ecrireEtat(etat);

    return attendre({ ...versDetail(invitation), jeton: invitation.jeton });
  },

  async lister(): Promise<InvitationDetail[]> {
    return attendre(lireEtat().map(versDetail));
  },

  async verifier(jeton: string): Promise<ContenuInvitation> {
    const invitation = lireEtat().find((i) => i.jeton === jeton);
    if (!estValide(invitation)) refuserJetonInvalide();

    const expireDans = Math.max(
      0,
      Math.round((Date.parse(invitation.expire_le) - Date.now()) / 1000),
    );

    return attendre({
      email: invitation.email,
      nom: invitation.nom,
      role_propose: invitation.role_propose,
      role_libelle: texte(
        `gestionCollaborateurs.roleOptions.${invitation.role_propose}` as Parameters<
          typeof texte
        >[0],
      ),
      entreprise: ENTREPRISE_DEMO,
      expire_dans: expireDans,
    });
  },

  async accepter(payload: AccepterInvitationPayload): Promise<ReponseAccepterInvitation> {
    const etat = lireEtat();
    const invitation = etat.find((i) => i.jeton === payload.jeton);
    if (!estValide(invitation)) refuserJetonInvalide();

    invitation.statut = "ACCEPTEE";
    invitation.utilise_le = new Date().toISOString();
    ecrireEtat(etat);

    const [prenom, ...reste] = invitation.nom.split(" ");

    return attendre({
      message: texte("invitation.succesTitre"),
      access: idAleatoire("acces-sim"),
      refresh: idAleatoire("refresh-sim"),
      expire_dans: 900,
      utilisateur: {
        id: invitation.id,
        email: invitation.email,
        nom: reste.join(" ") || prenom || "",
        prenom: reste.length ? prenom : "",
        role_global: invitation.role_propose,
        is_dg: false,
        is_owner: false,
      },
    });
  },
};

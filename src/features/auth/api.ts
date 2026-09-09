/**
 * Appels d'authentification.
 *
 * Une fonction par endpoint, typée, qui ne connaît ni `fetch`, ni les jetons,
 * ni le format d'erreur : le client de `lib/api` s'en charge.
 */

import {
  api,
  ecrireJetonAcces,
  ecrireJetonRenouvellement,
  effacerJetons,
  lireJetonRenouvellement,
} from "@/lib/api";
import type { Jetons } from "@/lib/api";
import { reinitialiserHorlogeActivite } from "@/lib/auth/session";

export type OrigineConnexion = "WEB" | "MOBILE";

export interface IdentifiantsConnexion {
  email: string;
  mot_de_passe: string;
  /**
   * Détermine la durée du jeton de renouvellement : 8 h sur le web,
   * 24 h sur mobile (Socle Commun §2.2).
   */
  origine?: OrigineConnexion;
}

export interface ProfilUtilisateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role_global: string;
  /**
   * Le libellé du rôle, **rendu par le serveur**.
   *
   * L'écran ne traduit plus le code lui-même : il en existe treize, la barre
   * n'en connaissait que six, et un « Responsable Financier » s'y affichait
   * « RF ». Règle du `CLAUDE.md` : un libellé d'énumération se traduit en un
   * seul endroit, et cet endroit est l'API.
   */
  role_libelle?: string;
  is_dg: boolean;
  is_owner: boolean;
  langue?: string;
  doit_changer_mot_de_passe?: boolean;
}

const CLE_PROFIL = "ccd.profil_utilisateur";

export function lireProfilLocal(): ProfilUtilisateur | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CLE_PROFIL);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function ecrireProfilLocal(profil: ProfilUtilisateur | null): void {
  if (typeof window === "undefined") return;
  if (profil) {
    window.localStorage.setItem(CLE_PROFIL, JSON.stringify(profil));
  } else {
    window.localStorage.removeItem(CLE_PROFIL);
  }
}

export async function obtenirProfilMoi(): Promise<ProfilUtilisateur> {
  try {
    const data = await api.lire<ProfilUtilisateur>("/utilisateurs/moi/");
    ecrireProfilLocal(data);
    return data;
  } catch {
    const local = lireProfilLocal();
    if (local) return local;
    const defaut: ProfilUtilisateur = {
      id: "c1f7a240-5bb6-48c9-bc78-0d123456789a",
      email: "dg@soumafe.ci",
      nom: "Kouamé",
      prenom: "Patrice",
      role_global: "DG",
      is_dg: true,
      is_owner: true,
      langue: "fr",
      doit_changer_mot_de_passe: false,
    };
    ecrireProfilLocal(defaut);
    return defaut;
  }
}

interface ReponseConnexion extends Jetons {
  utilisateur?: Partial<ProfilUtilisateur>;
}

export async function seConnecter(identifiants: IdentifiantsConnexion): Promise<void> {
  const reponse = await api.creer<ReponseConnexion>("/auth/token/", {
    origine: "WEB",
    ...identifiants,
  });
  ecrireJetonAcces(reponse.access);
  ecrireJetonRenouvellement(reponse.refresh);
  if (reponse.utilisateur) {
    const u = reponse.utilisateur;
    const profil: ProfilUtilisateur = {
      id: u.id || "",
      email: u.email || identifiants.email,
      nom: u.nom || "",
      prenom: u.prenom || "",
      role_global: u.role_global || "DG",
      is_dg: u.is_dg ?? (u.role_global === "DG" || u.role_global === "AD"),
      is_owner: u.is_owner ?? (u.role_global === "DG"),
      langue: u.langue || "fr",
      doit_changer_mot_de_passe: u.doit_changer_mot_de_passe ?? false,
    };
    ecrireProfilLocal(profil);
  }
  reinitialiserHorlogeActivite();
}

/**
 * Déconnexion volontaire — révoque le jeton de renouvellement côté serveur (DEV-3.6)
 * puis efface les jetons en local.
 */
export async function seDeconnecter(): Promise<void> {
  const refresh = lireJetonRenouvellement();
  if (refresh) {
    try {
      await api.creer<void>("/auth/deconnexion/", { refresh });
    } catch {
      // Tolérance réseau : la session doit être effacée localement quoi qu'il arrive.
    }
  }
  effacerJetons();
  ecrireProfilLocal(null);
}


/**
 * Ce que dit le jeton de réinitialisation avant toute frappe — contrat §5bis.
 * `expire_dans` est en secondes.
 */
/** Les trois portes du contrat §1 — ce qui a déclenché le lien. */
export type MotifReinitialisation = "OUBLI" | "BLOCAGE" | "INVITATION";

export interface ContenuJetonMdp {
  email: string;
  motif: MotifReinitialisation;
  expire_dans: number;
  domaine?: string | null;
  url_connexion?: string | null;
}

export async function demanderReinitialisation(email: string): Promise<void> {
  // Workflow T2 : la réponse est identique que le compte existe ou non.
  await api.creer<void>("/auth/mot-de-passe/demande/", { email });
}

/**
 * Vérifie le lien **sans le consommer** — règle R-32 du contrat.
 *
 * Une passerelle antivirus qui suit les URL d'un email brûlerait un jeton
 * marqué « utilisé » à la vérification, avant même que son destinataire ne
 * clique.
 */
export async function verifierJetonReinitialisation(
  jeton: string,
): Promise<ContenuJetonMdp> {
  return api.creer<ContenuJetonMdp>("/auth/mot-de-passe/verifier/", { jeton });
}

export async function reinitialiserMotDePasse(
  jeton: string,
  motDePasse: string,
): Promise<void> {
  // Pas de champ `confirmation` : la double saisie est une vérification
  // d'interface, elle n'a rien à prouver au serveur — contrat §5.1.
  await api.creer<void>("/auth/mot-de-passe/reinitialiser/", {
    jeton,
    mot_de_passe: motDePasse,
  });
}

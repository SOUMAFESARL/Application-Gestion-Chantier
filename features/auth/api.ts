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
  /*
   * Ce qui suit n'arrive que de `GET /auth/profil/` : la réponse de connexion
   * ne le porte pas. D'où le `?` — un profil tiré de la connexion reste valide.
   */
  nom_complet?: string;
  telephone?: string | null;
  /** URL absolue de la photo ; `null` quand il n'y en a pas (l'avatar prend les initiales). */
  avatar_url?: string | null;
  initiales?: string;
  role_personnalise?: string | null;
  statut?: string;
  double_authentification_active?: boolean;
  entreprise?: EntrepriseProfil;
  /** Les droits effectifs, par module : le libellé du niveau est rendu par le serveur. */
  habilitations?: Record<string, HabilitationModule>;
  derniere_connexion?: string | null;
  cree_le?: string;
  modifie_le?: string;
}

export interface EntrepriseProfil {
  id: string;
  raison_sociale: string;
  schema_name: string;
  logo_url: string | null;
}

export interface HabilitationModule {
  libelle: string;
  niveau: number;
}

/** Ce que `PATCH /auth/profil/` accepte de l'utilisateur lui-même. */
export interface DemandeModificationProfil {
  prenom: string;
  nom: string;
  telephone: string;
}

/**
 * Émis sur `window` quand le profil change (formulaire, photo) — `detail`
 * porte le nouveau profil. La coquille l'écoute : le nom et l'avatar de la
 * barre latérale suivent sans rechargement.
 */
export const EVENEMENT_PROFIL_MODIFIE = "ccd:profil-modifie";

function annoncerProfil(profil: ProfilUtilisateur): void {
  ecrireProfilLocal(profil);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENEMENT_PROFIL_MODIFIE, { detail: profil }));
  }
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

/**
 * Qui est connecté.
 *
 * **Cette fonction échoue quand le serveur refuse.** Elle fabriquait un
 * profil de directeur général en dur — nom, adresse, `is_dg: true`,
 * `is_owner: true` — dès que l'appel ratait, et l'écrivait dans
 * `localStorage` par-dessus le marché. Une coupure réseau accordait donc une
 * identité de DG, que les écrans relisaient ensuite comme si elle venait du
 * serveur : la barre latérale en tire la portée de la météo, `roles` en tire
 * ce qu'elle laisse modifier.
 *
 * Il reste un repli, et un seul : **le profil déjà obtenu du serveur**, gardé
 * en local pour qu'un rafraîchissement hors ligne n'efface pas le nom affiché.
 * Il n'invente rien — il se souvient. Sans lui, l'erreur remonte, et les cinq
 * appelants la traitent déjà (ils ont tous un `catch`).
 */
export async function obtenirProfilMoi(): Promise<ProfilUtilisateur> {
  try {
    const data = await api.lire<ProfilUtilisateur>("/auth/profil/");
    ecrireProfilLocal(data);
    return data;
  } catch (cause) {
    const local = lireProfilLocal();
    if (local) return local;
    throw cause;
  }
}

/**
 * Relit le profil **sans repli local** : après une écriture, un profil d'avant
 * l'écriture ferait croire qu'elle n'a pas eu lieu.
 */
async function relireProfil(): Promise<ProfilUtilisateur> {
  const profil = await api.lire<ProfilUtilisateur>("/auth/profil/");
  annoncerProfil(profil);
  return profil;
}

/**
 * Met à jour son propre profil — `PATCH /auth/profil/`.
 *
 * L'adresse n'en fait pas partie : c'est l'identifiant de connexion, et le
 * rôle se donne depuis la gestion des collaborateurs, pas depuis son profil.
 * Un téléphone vidé part en `""` — c'est ce qui l'efface côté serveur.
 */
export async function modifierProfilMoi(
  demande: DemandeModificationProfil,
): Promise<ProfilUtilisateur> {
  const profil = await api.modifier<ProfilUtilisateur>("/auth/profil/", {
    prenom: demande.prenom,
    nom: demande.nom,
    telephone: demande.telephone,
  });
  annoncerProfil(profil);
  return profil;
}

/**
 * Téléverse une photo de profil — `POST /auth/profil/avatar/`, en `multipart`.
 *
 * Le profil est relu ensuite plutôt que déduit de la réponse : l'URL de la
 * photo est construite par le serveur, et c'est elle qu'on veut afficher.
 */
export async function televerserAvatar(fichier: File): Promise<ProfilUtilisateur> {
  const formulaire = new FormData();
  formulaire.append("avatar", fichier);
  await api.creer<unknown>("/auth/profil/avatar/", formulaire);
  return relireProfil();
}

/** Retire la photo de profil — `DELETE /auth/profil/avatar/`. L'avatar retombe sur les initiales. */
export async function supprimerAvatar(): Promise<ProfilUtilisateur> {
  await api.supprimer("/auth/profil/avatar/");
  return relireProfil();
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
    // **Aucun repli vers `DG`.** `role_global: u.role_global || "DG"` faisait
    // d'un champ absent un directeur général : le serveur qui omet le rôle —
    // parce qu'il ne l'envoie pas encore, ou parce qu'il l'a retiré — promouvait
    // silencieusement celui qui se connecte. Un champ manquant ne donne aucun
    // droit ; `obtenirProfilMoi()` ira chercher le vrai rôle, et d'ici là
    // l'interface montre le minimum plutôt que le maximum.
    const profil: ProfilUtilisateur = {
      id: u.id || "",
      email: u.email || identifiants.email,
      nom: u.nom || "",
      prenom: u.prenom || "",
      role_global: u.role_global || "",
      is_dg: u.is_dg ?? false,
      is_owner: u.is_owner ?? false,
      langue: u.langue || "fr",
      doit_changer_mot_de_passe: u.doit_changer_mot_de_passe ?? false,
    };
    ecrireProfilLocal(profil);
  }
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

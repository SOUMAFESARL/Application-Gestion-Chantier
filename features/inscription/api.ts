/**
 * Inscription d'une entreprise — contrat T-021.
 *
 * Cinq endpoints, tous sur le **domaine de la plateforme** : au moment de
 * l'inscription, le client n'a pas encore de sous-domaine.
 *
 * Deux points du contrat que ce module rend visibles dans les types :
 *   · `POST /inscription/` répond **`202`, toujours** — que l'adresse soit
 *     connue ou non (R-80). L'écran suivant est le même dans les cinq
 *     branches du §2.4 : c'est l'email qui porte la vérité ;
 *   · la réponse ne contient **jamais** le slug avant consommation du jeton
 *     (R-81). `url_connexion` n'apparaît qu'à la fin du provisionnement.
 */

import { apiPlateforme } from "@/lib/api";

const BASE = "/inscription";

// ---------------------------------------------------------------------------
// Types du contrat
// ---------------------------------------------------------------------------
export interface DemandeInscription {
  /** UUID **fourni par le client** — conventions A7. Généré au montage du formulaire. */
  id: string;
  raison_sociale: string;
  pays: string;
  email: string;
  cgu_acceptees: boolean;
}

export interface AccuseInscription {
  id: string;
  statut: "EN_ATTENTE";
  email: string;
  /** Validité du lien d'activation, en secondes — 48 h. */
  expire_dans: number;
}

export interface ContenuJeton {
  raison_sociale: string;
  email: string;
  pays: string;
  expire_dans: number;
}

export interface Activation {
  jeton: string;
  nom: string;
  prenom: string;
  mot_de_passe: string;
}

export interface AccuseActivation {
  suivi: string;
  statut: "PROVISIONNEMENT";
}

export type EtatProvisionnement =
  | { statut: "PROVISIONNEMENT" }
  | { statut: "PRET"; url_connexion: string }
  | { statut: "ECHEC" };

/**
 * Les pays proposés à l'inscription — les 54 États africains membres de
 * l'ONU, **par leur code ISO**, quel que soit le pays choisi.
 *
 * Le libellé vient de `nomDePays()` : `Intl` le rend au caractère près, et
 * dans la langue de l'utilisateur le jour où il y en aura une seconde. La
 * liste, elle, reste ici : c'est une décision produit, pas une donnée de
 * plateforme — et elle doit rester alignée sur `PAYS_AUTORISES` du serveur.
 *
 * Seuls les neuf pays de M8 ont un drapeau dessiné et un référentiel de
 * villes ; pour les autres, la ville passe en saisie libre (`listerVilles`).
 */
export const PAYS = [
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG",
  "CD", "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN",
  "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ",
  "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD",
  "TZ", "TG", "TN", "UG", "ZM", "ZW",
] as const;

// ---------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------
export function deposerInscription(demande: DemandeInscription): Promise<AccuseInscription> {
  return apiPlateforme.creer<AccuseInscription>(`${BASE}/`, demande);
}

export function renvoyerEmail(id: string): Promise<{ statut: string }> {
  return apiPlateforme.creer<{ statut: string }>(`${BASE}/renvoyer/`, { id });
}

/** Ne consomme pas le jeton — R-83 : une passerelle antivirus le brûlerait. */
export function verifierJeton(jeton: string): Promise<ContenuJeton> {
  return apiPlateforme.creer<ContenuJeton>(`${BASE}/verifier/`, { jeton });
}

export function activer(activation: Activation): Promise<AccuseActivation> {
  return apiPlateforme.creer<AccuseActivation>(`${BASE}/activer/`, activation);
}

export function lireEtatProvisionnement(suivi: string): Promise<EtatProvisionnement> {
  return apiPlateforme.lire<EtatProvisionnement>(`${BASE}/etat/${suivi}/`);
}

/**
 * Les types du domaine Équipes — registre de main-d'œuvre et équipes de chantier (décisions
 * v1.2 ; décisions P11 et P12 du plan du découpage).
 *
 * Miroir de `backend/apps/projets/views/equipe.py` : le registre est celui de l'entreprise, les
 * équipes sont celles d'un projet, et leurs membres sont pris dans le registre.
 */

/** L'entreprise de rattachement : la nôtre, ou un partenaire (sous-traitant, tâcheron…). */
export interface EntrepriseRattachement {
  /** `null` : notre entreprise. */
  id: string | null;
  nom: string;
  interne: boolean;
}

/** Une personne du registre de main-d'œuvre. */
export interface Personne {
  id: string;
  nom: string;
  prenom: string;
  nomComplet: string;
  telephone: string;
  metier: string;
  entreprise: EntrepriseRattachement;
  /** Elle a aussi un compte sur la plateforme. */
  aUnCompte: boolean;
  estActive: boolean;
}

export interface SaisiePersonne {
  nom: string;
  prenom: string;
  telephone: string;
  metier: string;
  /** `null` : notre entreprise. */
  entreprisePartenaireId: string | null;
}

/** Les filtres du registre que le serveur applique. */
export interface FiltresRegistre {
  recherche?: string;
  /** « INTERNE », ou l'identifiant d'un partenaire. */
  entreprise?: string;
  inactives?: boolean;
}

/* ------------------------------------------------------------------ *
 * Les équipes d'un projet.
 * ------------------------------------------------------------------ */

export const FONCTIONS_MEMBRE = [
  "CHEF_EQUIPE",
  "OUVRIER_QUALIFIE",
  "OUVRIER",
  "MANOEUVRE",
  "CONDUCTEUR_ENGIN",
  "APPRENTI",
] as const;
export type FonctionMembre = (typeof FONCTIONS_MEMBRE)[number];

/** Un membre d'une équipe : une personne du registre, sur une période datée. */
export interface MembreEquipe {
  id: string;
  personne: Personne;
  fonction: FonctionMembre;
  estChef: boolean;
  dateArrivee: string | null;
  /** `null` : toujours dans l'équipe. */
  dateDepart: string | null;
  enCours: boolean;
}

/** Une case de l'arbre où l'équipe est posée (ses descendants en héritent). */
export interface CaseEquipe {
  affectationId: string;
  caseId: string;
  libelle: string;
  niveau: string;
}

export interface EquipeProjet {
  id: string;
  projetId: string;
  nom: string;
  corpsEtat: string;
  entreprise: EntrepriseRattachement;
  nature: string;
  chef: MembreEquipe | null;
  effectif: number;
  membres: MembreEquipe[];
  cases: CaseEquipe[];
  estActive: boolean;
}

/**
 * Ce que le serveur signale sans refuser : une personne dans deux équipes le même jour, un
 * membre d'une autre entreprise que l'équipe… Le message se lit tel quel.
 */
export interface Avertissement {
  code: string;
  message: string;
}

export interface SaisieEquipe {
  nom: string;
  corpsEtat: string;
  entreprisePartenaireId: string | null;
}

export interface SaisieMembre {
  personneId: string;
  fonction: FonctionMembre;
  estChef: boolean;
  dateArrivee: string | null;
  dateDepart?: string | null;
}

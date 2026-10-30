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

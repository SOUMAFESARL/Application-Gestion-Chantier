/**
 * Les types du domaine Tiers — clients, maîtres d'œuvre, fournisseurs,
 * sous-traitants, tâcherons, bureaux de contrôle, administrations, prestataires.
 *
 * Aucun type HTTP ici : la forme `snake_case` du serveur reste confinée
 * dans `adaptateur.ts`.
 */

/** Les types de tiers (`TypeTiers` côté Django). */
export const TYPES_TIERS = ["ENTREPRISE", "PERSONNE"] as const;
export type TypeTiers = (typeof TYPES_TIERS)[number];

/** Les rôles de tiers (`RoleTiersChoix` côté Django). */
export const ROLES_TIERS = [
  "CLIENT_MOA",
  "MAITRE_OEUVRE",
  "FOURNISSEUR",
  "SOUS_TRAITANT",
  "TACHERON",
  "BUREAU_CONTROLE",
  "ADMINISTRATION",
  "PRESTATAIRE",
] as const;

export type RoleTiers = (typeof ROLES_TIERS)[number];

/** Un tiers, réduit à ce qu'il faut pour le choisir dans une liste. */
export interface TiersOption {
  id: string;
  raisonSociale: string;
}

/** Un chantier lié à un tiers, lu sur le détail du tiers. */
export interface ProjetLieTiers {
  id: string;
  reference: string;
  nom: string;
  statut: string;
  ville: string;
  relations: string[];
}

/** Fiche complète d'un tiers de l'entreprise. */
export interface Tiers extends TiersOption {
  typeTiers: TypeTiers;
  rccm: string;
  nif: string;
  telephone: string;
  email: string;
  adresse: string;
  ville: string;
  noteEvaluation: number | null;
  estActif: boolean;
  roles: RoleTiers[];
  nombreProjetsLies: number;
  estReference: boolean;
  projetsLies: ProjetLieTiers[];
}

/** Charge de création ou modification d'un tiers côté domaine. */
export interface DemandeTiers {
  typeTiers: TypeTiers;
  raisonSociale: string;
  roles: RoleTiers[];
  telephone: string;
  email: string;
  rccm: string;
  nif: string;
  adresse: string;
  ville: string;
  noteEvaluation: number | null;
  estActif?: boolean;
}

export type FiltreStatutTiers = "" | "ACTIF" | "INACTIF";

export interface CriteresTiers {
  recherche: string;
  role: RoleTiers | "";
  typeTiers: TypeTiers | "";
  statut: FiltreStatutTiers;
}

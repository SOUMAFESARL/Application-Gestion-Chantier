/**
 * Types pour la gestion dynamique des rôles et des habilitations par module (RBAC Hybride).
 */

/**
 * L'**ancien** format du serveur : un seul niveau cumulatif par module
 * (0 aucun, 1 lecture, 2 saisie, 3 validation — chacun inclut les précédents).
 * Il n'est plus que lu, par `api.ts`, le temps que le serveur passe aux listes
 * d'accès ; aucun écran ne le manipule.
 */
export type NiveauAcces = 0 | 1 | 2 | 3;

/**
 * Les accès d'un module, **indépendants** les uns des autres : un rôle peut
 * valider sans saisir. Une liste vide, c'est « Aucun ».
 */
export const ACCES_MODULE = ["lecture", "saisie", "validation"] as const;

export type AccesModule = (typeof ACCES_MODULE)[number];

/** Les accès d'un rôle, module par module. */
export type PermissionsModules = Record<string, AccesModule[]>;

/**
 * Les codes de module que la **table des routes** connaît (`features/habilitations/regles.ts`). Aucun
 * écran ne s'en sert plus pour lister des modules : la liste vient du serveur (`GET /modules/`).
 */
export const MODULES_CCD = [
  "projets",
  "chantier",
  "finance",
  "achats",
  "stocks",
  "rh",
  "equipements",
  "qhse",
  "contrats",
  "tiers",
  "ged",
  "pilotage",
] as const;

export type CodeModule = (typeof MODULES_CCD)[number];

export type PorteeRole = "ENTREPRISE" | "PROJET";

/** Une permission du catalogue, telle que le serveur la décrit. */
export interface PermissionCatalogue {
  id: string;
  code: string;
  libelle: string;
  description: string;
  ordre: number;
}

/** Un module du catalogue de l'entreprise, avec les permissions que le demandeur peut accorder. */
export interface ModuleCatalogue {
  id: string;
  code: string;
  libelle: string;
  description: string;
  ordre: number;
  icone: string;
  permissions: PermissionCatalogue[];
}

/** Les quatre raccourcis d'un module, dans l'ordre d'affichage. */
export const RACCOURCIS = ["aucun", "lecture", "saisie", "validation"] as const;
export type Raccourci = (typeof RACCOURCIS)[number];

/** Un module de la matrice d'un rôle : son niveau (calculé par le serveur) et ses permissions accordées. */
export interface ModuleRole {
  moduleId: string;
  code: string;
  libelle: string;
  description: string;
  icone: string;
  ordre: number;
  niveau: NiveauAcces;
  permissions: PermissionCatalogue[];
}

export interface RoleItem {
  id: string;
  code: string;
  libelle: string;
  description: string;
  est_systeme: boolean;
  est_actif: boolean;
  nb_utilisateurs: number;
  portee: PorteeRole;
  avertissements: string[];
  modules: ModuleRole[];
}

export interface RoleDetailItem extends RoleItem {
  comptage: {
    utilisateurs: number;
    affectations: number;
    total: number;
  };
}

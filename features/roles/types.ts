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
 * Les douze modules du produit, **par leur code seul**.
 *
 * Le nom et la description de chaque module sont du texte affiché : ils vivent
 * dans `messages/fr.json`, sous `roles.modules.<code>`, et les écrans les
 * lisent par le code. Ils étaient écrits dans ce tableau, en français, dans un
 * module que la règle `no-literal-string` ne regarde pas — elle ne voit que le
 * JSX. C'est le premier des angles morts que le guide frontend §1 nomme : le
 * tableau de libellés (Socle Commun §1.1).
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

export interface RoleItem {
  id: string;
  code: string;
  libelle: string;
  description: string;
  est_systeme: boolean;
  est_actif: boolean;
  nb_utilisateurs: number;
  permissions_modules: PermissionsModules;
}

export interface RoleDetailItem extends RoleItem {
  comptage: {
    utilisateurs: number;
    affectations: number;
    total: number;
  };
}

export interface ProjetRoleMatrice {
  role_id: string;
  code: string;
  libelle: string;
  est_systeme: boolean;
  modules: Record<string, { acces: AccesModule[]; est_surcharge: boolean }>;
}

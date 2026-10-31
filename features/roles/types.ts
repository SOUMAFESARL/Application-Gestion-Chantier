/**
 * Types du domaine Rôles.
 *
 * Un rôle, c'est une liste de **codes de permission** (`projets.creer`…), groupés
 * par module pour l'affichage. Ni niveau, ni accès lecture / saisie / validation.
 */

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

/** Un module de la matrice d'un rôle et les permissions accordées au rôle sur ce module. */
export interface ModuleRole {
  moduleId: string;
  code: string;
  libelle: string;
  description: string;
  icone: string;
  ordre: number;
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
  /**
   * Un seul titulaire par projet (chef de projet, chef de chantier…). Le changer de titulaire
   * passe alors par « Remplacer » (décision P13).
   */
  unique_par_projet: boolean;
  /**
   * Rôle unique : les projets où plusieurs personnes le tiennent déjà, tels que le détail du rôle
   * les rend. Ils restent tels quels ; la règle vaut pour les prochaines affectations.
   */
  projets_en_depassement?: { projet_id: string; projet_nom: string; nombre: number }[];
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

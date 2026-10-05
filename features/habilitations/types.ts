/**
 * Les types du domaine des habilitations — ce qu'un compte peut voir et faire.
 *
 * **Un rôle est une donnée, pas du code.** Le DG crée, renomme et règle ses
 * rôles dans `/parametres/roles` ; un écran ne connaît donc jamais un code ou
 * un libellé de rôle. Il ne connaît que des `Droits` : pour chaque module, les
 * accès accordés, et une seule exception nommée — la direction.
 */

import type { FonctionProjet } from "@/features/projets/types";
import type { AccesModule, CodeModule, PermissionsModules } from "@/features/roles/types";

export type { AccesModule, CodeModule };

/**
 * Les chantiers qu'un compte voit : tous (direction), ou ceux de la personne
 * — ceux où elle est désignée dans l'équipe projet.
 *
 * `fonctionsSimulees` (identifiant de chantier → fonctions) ajoute des
 * affectations que les données du chantier ne portent pas encore. Seul l'outil
 * de test « Voir en tant que… » le remplit, tant que l'encadrement n'est pas
 * livré côté serveur ; le profil réel ne le porte jamais.
 */
export type PorteeProjets =
  | { type: "TOUS" }
  | {
      type: "PERSONNE";
      collaborateurId: string;
      fonctionsSimulees?: Record<string, FonctionProjet[]>;
    };

export interface Droits {
  /**
   * Le Directeur Général. Seul à voir les Paramètres et l'Abonnement, et seul
   * à voir tous les chantiers (décision du 30/09/2026).
   */
  estDirection: boolean;
  /** Les accès de son rôle, module par module. Un module absent vaut « aucun ». */
  permissions: PermissionsModules;
  portee: PorteeProjets;
}

/** Ce qu'il faut pour ouvrir une route ou montrer une entrée de menu. */
export type ConditionAcces =
  | { type: "TOUS" }
  | { type: "DIRECTION" }
  | { type: "MODULE"; module: CodeModule; acces: AccesModule };

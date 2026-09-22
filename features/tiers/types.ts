/**
 * Les types du domaine Tiers — clients, fournisseurs, sous-traitants.
 *
 * Le domaine est ouvert ici par le strict nécessaire : la modale de création
 * d'un chantier a besoin de choisir un maître d'ouvrage, et lisait pour cela
 * `/tiers/` en direct. L'écran `/tiers` lui-même reste à construire ; quand
 * il le sera, il partira de ce fichier plutôt que d'un nouvel appel.
 */

/** Un tiers, réduit à ce qu'il faut pour le choisir dans une liste. */
export interface TiersOption {
  id: string;
  raisonSociale: string;
}

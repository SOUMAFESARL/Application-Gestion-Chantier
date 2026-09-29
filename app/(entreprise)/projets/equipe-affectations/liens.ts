/**
 * Les adresses des écrans d'équipes, écrites une fois : la carte, le tiroir
 * des membres et la fiche se renvoient l'un à l'autre.
 */

/** L'écran « Équipes et affectations », ouvert sur un chantier. */
export function lienEquipesChantier(projetId: string): string {
  return `/projets/equipe-affectations?projet=${encodeURIComponent(projetId)}`;
}

/** La fiche d'une équipe : ses membres et leurs rôles. */
export function lienFicheEquipe(projetId: string, equipeId: string): string {
  return `/projets/${encodeURIComponent(projetId)}/equipes/${encodeURIComponent(equipeId)}`;
}

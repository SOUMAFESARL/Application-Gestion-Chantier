/**
 * Les clés de cache React Query du stock de chantier.
 *
 * Une seule lecture d'ensemble (`lireStock`) : tout geste l'invalide, et
 * l'écran, le tableau de bord et la saisie du journal relisent la même.
 */

export const CLE_STOCK = ["stocks", "etat"] as const;

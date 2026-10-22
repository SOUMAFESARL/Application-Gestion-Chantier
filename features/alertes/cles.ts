/**
 * Les clés de cache React Query du domaine Alertes de retard.
 *
 * Réunies ici pour la même raison que celles des projets : l'écran qui liste
 * les alertes et la modale qui en clôture une doivent parler du même cache,
 * sans quoi la ligne clôturée resterait « ouverte » jusqu'au rechargement.
 */

/** La liste des alertes de retard visibles par le compte. */
export const CLE_LISTE_ALERTES = ["alertes-retard", "liste"] as const;

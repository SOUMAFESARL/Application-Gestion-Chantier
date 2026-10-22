/**
 * Les clés de cache React Query du domaine Calendrier.
 *
 * Toute écriture (semaine type, exception) invalide `CLE_CALENDRIER` : le préfixe couvre
 * tous les mois déjà lus, puisque la semaine type change l'état de chacun.
 */

/** Le préfixe de toutes les lectures du calendrier. */
export const CLE_CALENDRIER = ["calendrier"] as const;

/** Le calendrier sur une période (le mois affiché). */
export function cleCalendrier(debut: string, fin: string) {
  return ["calendrier", debut, fin] as const;
}

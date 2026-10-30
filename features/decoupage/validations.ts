/**
 * Les schémas zod des gestes sur l'arbre — ni React, ni réseau.
 *
 * Ils reprennent les seuils du serveur pour signaler une saisie trop courte avant l'envoi ; le
 * serveur reste juge et son refus s'affiche tel quel.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";

import { LONGUEUR_MIN_JUSTIFICATION, LONGUEUR_MIN_MOTIF } from "./regles";

/** Le motif d'un geste tracé (désactiver, modifier une tâche commencée…). */
export const schemaMotif = z
  .string()
  .trim()
  .min(LONGUEUR_MIN_MOTIF, texte("decoupage.validations.motifCourt", { minimum: LONGUEUR_MIN_MOTIF }));

/** La justification d'un report ou d'une prolongation (RG-11). */
export const schemaJustification = z
  .string()
  .trim()
  .min(
    LONGUEUR_MIN_JUSTIFICATION,
    texte("decoupage.validations.justificationCourte", { minimum: LONGUEUR_MIN_JUSTIFICATION }),
  );

/** L'intitulé d'une case : obligatoire, 200 caractères au plus. */
export const schemaLibelle = z
  .string()
  .trim()
  .min(1, texte("decoupage.validations.libelleRequis"))
  .max(200, texte("decoupage.validations.libelleLong"));

/** Des dates de début et de fin cohérentes (la fin ne précède pas le début). */
export const schemaDates = z
  .object({ debut: z.string().nullable(), fin: z.string().nullable() })
  .refine((dates) => !dates.debut || !dates.fin || dates.fin >= dates.debut, {
    message: texte("decoupage.validations.datesIncoherentes"),
  });

/** Le premier message d'un échec zod, pour l'afficher sous le formulaire. */
export function premierMessage(resultat: { success: boolean; error?: z.ZodError }): string | null {
  return resultat.success ? null : (resultat.error?.issues[0]?.message ?? null);
}

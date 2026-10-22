/**
 * Les schémas de validation du domaine Calendrier.
 *
 * Les bornes sont celles du serveur (`ExceptionCalendrierCreateSerializer`) : les refuser ici
 * évite un aller-retour, mais c'est Django qui tranche.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";

import { MOTIF_EXCEPTION_MAX } from "./regles";

export const schemaException = z.object({
  motif: z
    .string()
    .trim()
    .min(1, { message: texte("calendrier.modale.erreurMotifRequis") })
    .max(MOTIF_EXCEPTION_MAX, {
      message: texte("calendrier.modale.erreurMotifLong", { max: MOTIF_EXCEPTION_MAX }),
    }),
});

export type SaisieException = z.infer<typeof schemaException>;

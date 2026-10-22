/**
 * Les schémas de validation du domaine Alertes de retard.
 *
 * Le seuil est celui du serveur (`AlerteRetardResolutionSerializer`) : le
 * refuser ici évite un aller-retour, mais c'est Django qui tranche.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";

/** Longueur minimale du commentaire de clôture, espaces de bord exclus. */
export const COMMENTAIRE_CLOTURE_MIN = 10;

export const schemaClotureAlerte = z.object({
  commentaire: z
    .string()
    .trim()
    .min(1, { message: texte("alertes.cloture.erreurCommentaireRequis") })
    .min(COMMENTAIRE_CLOTURE_MIN, {
      message: texte("alertes.cloture.erreurCommentaireCourt", { min: COMMENTAIRE_CLOTURE_MIN }),
    }),
});

export type SaisieClotureAlerte = z.infer<typeof schemaClotureAlerte>;

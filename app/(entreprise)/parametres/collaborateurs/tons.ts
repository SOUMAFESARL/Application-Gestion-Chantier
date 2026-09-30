/**
 * Le ton d'un statut de compte — la liste et la fiche le peignent de la même
 * façon. C'est de l'affichage : il ne descend pas dans `regles`.
 */

import type { VarianteBadge } from "@/components/ui";
import type { StatutCollaborateur } from "@/features/invitations/types";

export const TON_STATUT: Record<StatutCollaborateur, VarianteBadge> = {
  ACTIF: "succes",
  INVITE: "avertissement",
  DESACTIVE: "erreur",
};

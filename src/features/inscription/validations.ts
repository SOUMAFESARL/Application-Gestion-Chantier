/**
 * Le schéma zod du formulaire d'inscription — plan de refonte, lot 7.
 *
 * Même séparation qu'`auth/validations.ts` : aucune dépendance à React ni au
 * réseau ici, pour que le formulaire et un futur écran serveur partagent la
 * même règle.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import { deriverSlug } from "@/lib/api/simulation";
import { chaineNonVide, email } from "@/lib/validations/champs";

export const schemaInscription = z.object({
  raisonSociale: chaineNonVide(texte("inscription.erreurNomRequis")).refine(
    (valeur) => deriverSlug(valeur).length > 0,
    { message: texte("inscription.erreurNomNonLatin") },
  ),
  pays: chaineNonVide(texte("inscription.erreurPaysRequis")),
  email: email(
    texte("inscription.erreurEmailRequis"),
    texte("inscription.erreurEmailInvalide"),
  ),
  cgu: z.boolean().refine((valeur) => valeur, {
    message: texte("inscription.erreurCguRequis"),
  }),
});

export type SaisieInscription = z.input<typeof schemaInscription>;
export type ValeursInscription = z.output<typeof schemaInscription>;

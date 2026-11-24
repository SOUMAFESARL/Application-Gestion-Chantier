/**
 * Schémas zod du domaine Tiers — couche 3.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import { chaineNonVide } from "@/lib/validations/champs";

import { telephoneTiersValide } from "./regles";
import { ROLES_TIERS, TYPES_TIERS, type DemandeTiers, type Tiers } from "./types";

export const LONGUEUR_MAX_RAISON_SOCIALE = 200;
export const LONGUEUR_MAX_RCCM = 50;
export const LONGUEUR_MAX_NIF = 50;
export const LONGUEUR_MAX_ADRESSE = 255;
export const LONGUEUR_MAX_VILLE = 100;

export function schemaTiers(paysDefaut: string) {
  return z.object({
    typeTiers: z.enum(TYPES_TIERS, {
      message: texte("tiers.validation.typeRequis"),
    }),
    raisonSociale: chaineNonVide(texte("tiers.validation.raisonSocialeRequise")).max(
      LONGUEUR_MAX_RAISON_SOCIALE,
      texte("tiers.validation.raisonSocialeLongue", { max: LONGUEUR_MAX_RAISON_SOCIALE }),
    ),
    roles: z
      .array(z.enum(ROLES_TIERS))
      .min(1, texte("tiers.validation.rolesRequis")),
    telephone: z
      .string()
      .trim()
      .min(1, texte("tiers.validation.telephoneRequis"))
      .refine((valeur) => telephoneTiersValide(valeur, paysDefaut), {
        message: texte("tiersAjoutRapide.erreurFormat"),
      }),
    email: z
      .string()
      .trim()
      .refine(
        (valeur) => valeur === "" || z.string().email().safeParse(valeur).success,
        { message: texte("tiers.validation.emailInvalide") },
      ),
    rccm: z
      .string()
      .trim()
      .max(LONGUEUR_MAX_RCCM, texte("tiers.validation.champTropLong", { max: LONGUEUR_MAX_RCCM })),
    nif: z
      .string()
      .trim()
      .max(LONGUEUR_MAX_NIF, texte("tiers.validation.champTropLong", { max: LONGUEUR_MAX_NIF })),
    adresse: z
      .string()
      .trim()
      .max(
        LONGUEUR_MAX_ADRESSE,
        texte("tiers.validation.champTropLong", { max: LONGUEUR_MAX_ADRESSE }),
      ),
    ville: z
      .string()
      .trim()
      .max(LONGUEUR_MAX_VILLE, texte("tiers.validation.champTropLong", { max: LONGUEUR_MAX_VILLE })),
    noteEvaluation: z
      .string()
      .trim()
      .refine((valeur) => {
        if (valeur === "") return true;
        const n = Number(valeur.replace(",", "."));
        return !Number.isNaN(n) && n >= 0 && n <= 5;
      }, texte("tiers.validation.noteInvalide")),
    estActif: z.boolean(),
  });
}

export type SaisieTiers = z.input<ReturnType<typeof schemaTiers>>;
export type ValeursTiers = z.output<ReturnType<typeof schemaTiers>>;

export function saisieTiersVide(): SaisieTiers {
  return {
    typeTiers: "ENTREPRISE",
    raisonSociale: "",
    roles: [],
    telephone: "",
    email: "",
    rccm: "",
    nif: "",
    adresse: "",
    ville: "",
    noteEvaluation: "",
    estActif: true,
  };
}

export function saisieDepuisTiers(tiers: Tiers): SaisieTiers {
  return {
    typeTiers: tiers.typeTiers,
    raisonSociale: tiers.raisonSociale,
    roles: [...tiers.roles],
    telephone: tiers.telephone,
    email: tiers.email,
    rccm: tiers.rccm,
    nif: tiers.nif,
    adresse: tiers.adresse,
    ville: tiers.ville,
    noteEvaluation:
      tiers.noteEvaluation !== null && !Number.isNaN(tiers.noteEvaluation)
        ? String(tiers.noteEvaluation)
        : "",
    estActif: tiers.estActif,
  };
}

export function versDemandeTiers(valeurs: ValeursTiers): DemandeTiers {
  const noteBrute = valeurs.noteEvaluation.trim().replace(",", ".");
  const noteEvaluation =
    noteBrute === "" ? null : Math.round(Number(noteBrute) * 100) / 100;

  return {
    typeTiers: valeurs.typeTiers,
    raisonSociale: valeurs.raisonSociale.trim(),
    roles: valeurs.roles,
    telephone: valeurs.telephone.trim(),
    email: valeurs.email.trim(),
    rccm: valeurs.rccm.trim(),
    nif: valeurs.nif.trim(),
    adresse: valeurs.adresse.trim(),
    ville: valeurs.ville.trim(),
    noteEvaluation,
    estActif: valeurs.estActif,
  };
}

/**
 * Les schémas zod des écritures du stock — ni React, ni réseau.
 *
 * Un formulaire garde ses quantités en **texte** (« 12,5 » au clavier d'un
 * téléphone) ; les schémas disent ce qui est recevable, et les fonctions
 * `vers…` traduisent la saisie en objet du domaine.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import { chaineNonVide } from "@/lib/validations/champs";

import type {
  CategorieArticle,
  NatureArticle,
  SaisieCommande,
  SaisieDemande,
  SaisieMateriau,
  SaisieMouvement,
} from "./types";

export const CATEGORIES_ARTICLE: readonly CategorieArticle[] = [
  "LIANTS",
  "GRANULATS",
  "ACIERS",
  "MACONNERIE",
  "BOIS_COFFRAGE",
  "PLOMBERIE",
  "ELECTRICITE",
  "FINITIONS",
  "EQUIPEMENT",
];
export const NATURES_ARTICLE: readonly NatureArticle[] = ["MATERIAU", "EQUIPEMENT"];
export const SENS_MOUVEMENT = ["SORTIE", "CORRECTION_ENTREE", "CORRECTION_SORTIE"] as const;

/** Un motif se lit : quelques mots au moins. */
export const LONGUEUR_MIN_MOTIF = 5;
export const LONGUEUR_MAX_OBSERVATION = 500;

/** « 12,5 », « 12.5 », « 1 200 » → nombre ; `null` si ce n'en est pas un. */
export function lireQuantite(saisie: string): number | null {
  const propre = saisie.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(propre)) return null;
  return Number(propre);
}

function quantite(messagePositif: string, accepteZero = false) {
  return z.string().refine(
    (saisie) => {
      const valeur = lireQuantite(saisie);
      return valeur !== null && (accepteZero ? valeur >= 0 : valeur > 0);
    },
    { message: messagePositif },
  );
}

function motif() {
  return z
    .string()
    .trim()
    .min(LONGUEUR_MIN_MOTIF, { message: texte("stocks.validations.motifRequis", { min: LONGUEUR_MIN_MOTIF }) });
}

const ligneArticle = z.object({
  materiauId: chaineNonVide(texte("stocks.validations.materiauRequis")),
  quantite: quantite(texte("stocks.validations.quantitePositive")),
});

/** Un article ne figure qu'une fois : deux lignes de ciment font une seule commande. */
function sansDoublon(lignes: { materiauId: string }[]): boolean {
  const ids = lignes.map((l) => l.materiauId).filter(Boolean);
  return new Set(ids).size === ids.length;
}

/* ------------------------------------------------------------------ *
 * La demande d'approvisionnement.
 * ------------------------------------------------------------------ */

export const schemaDemande = z.object({
  projetId: chaineNonVide(texte("stocks.validations.projetRequis")),
  lotId: chaineNonVide(texte("stocks.validations.lotRequis")),
  dateSouhaitee: chaineNonVide(texte("stocks.validations.dateRequise")),
  observation: z.string().max(LONGUEUR_MAX_OBSERVATION),
  lignes: z
    .array(ligneArticle)
    .min(1, { message: texte("stocks.validations.uneLigne") })
    .refine(sansDoublon, { message: texte("stocks.validations.doublon") }),
});

export type FormulaireDemande = z.infer<typeof schemaDemande>;

export function versSaisieDemande(formulaire: FormulaireDemande): SaisieDemande {
  return {
    projetId: formulaire.projetId,
    lotId: formulaire.lotId,
    dateSouhaitee: formulaire.dateSouhaitee,
    observation: formulaire.observation.trim(),
    lignes: formulaire.lignes.map((l) => ({ materiauId: l.materiauId, quantite: lireQuantite(l.quantite) ?? 0 })),
  };
}

/* ------------------------------------------------------------------ *
 * Le bon de commande.
 * ------------------------------------------------------------------ */

export const schemaCommande = z.object({
  projetId: chaineNonVide(texte("stocks.validations.projetRequis")),
  lotId: chaineNonVide(texte("stocks.validations.lotRequis")),
  fournisseur: chaineNonVide(texte("stocks.validations.fournisseurRequis")).max(150),
  dateLivraisonPrevue: chaineNonVide(texte("stocks.validations.dateRequise")),
  transmettre: z.boolean(),
  lignes: z
    .array(ligneArticle)
    .min(1, { message: texte("stocks.validations.uneLigne") })
    .refine(sansDoublon, { message: texte("stocks.validations.doublon") }),
});

export type FormulaireCommande = z.infer<typeof schemaCommande>;

export function versSaisieCommande(formulaire: FormulaireCommande, demandeId: string | null): SaisieCommande {
  return {
    demandeId,
    projetId: formulaire.projetId,
    lotId: formulaire.lotId,
    fournisseur: formulaire.fournisseur.trim(),
    dateLivraisonPrevue: formulaire.dateLivraisonPrevue,
    transmettre: formulaire.transmettre,
    lignes: formulaire.lignes.map((l) => ({ materiauId: l.materiauId, quantite: lireQuantite(l.quantite) ?? 0 })),
  };
}

/* ------------------------------------------------------------------ *
 * La réception.
 * ------------------------------------------------------------------ */

export const schemaReception = z.object({
  observation: z.string().max(LONGUEUR_MAX_OBSERVATION),
  lignes: z
    .array(
      z
        .object({
          materiauId: z.string(),
          attendue: z.number(),
          quantiteRecue: quantite(texte("stocks.validations.quantiteNonNegative"), true),
          conforme: z.boolean(),
          motif: z.string(),
        })
        .refine((l) => (lireQuantite(l.quantiteRecue) ?? 0) <= l.attendue, {
          message: texte("stocks.validations.auDelaDuReste"),
          path: ["quantiteRecue"],
        })
        .refine((l) => l.conforme || l.motif.trim().length >= LONGUEUR_MIN_MOTIF, {
          message: texte("stocks.validations.motifNonConforme"),
          path: ["motif"],
        }),
    )
    .refine((lignes) => lignes.some((l) => (lireQuantite(l.quantiteRecue) ?? 0) > 0), {
      message: texte("stocks.validations.rienRecu"),
    }),
});

export type FormulaireReception = z.infer<typeof schemaReception>;

/* ------------------------------------------------------------------ *
 * Les gestes à motif : annuler, clôturer, rejeter.
 * ------------------------------------------------------------------ */

export const schemaMotif = z.object({ motif: motif() });
export type FormulaireMotif = z.infer<typeof schemaMotif>;

/* ------------------------------------------------------------------ *
 * Les mouvements manuels et les transferts.
 * ------------------------------------------------------------------ */

export const schemaMouvement = z.object({
  projetId: chaineNonVide(texte("stocks.validations.projetRequis")),
  lotId: chaineNonVide(texte("stocks.validations.lotRequis")),
  materiauId: chaineNonVide(texte("stocks.validations.materiauRequis")),
  sens: z.enum(SENS_MOUVEMENT),
  quantite: quantite(texte("stocks.validations.quantitePositive")),
  motif: motif(),
  corrige: z.string(),
});

export type FormulaireMouvement = z.infer<typeof schemaMouvement>;

export function versSaisieMouvement(formulaire: FormulaireMouvement): SaisieMouvement {
  return {
    projetId: formulaire.projetId,
    lotId: formulaire.lotId,
    materiauId: formulaire.materiauId,
    sens: formulaire.sens,
    quantite: lireQuantite(formulaire.quantite) ?? 0,
    motif: formulaire.motif.trim(),
    corrige: formulaire.corrige || null,
  };
}

export const schemaTransfert = z
  .object({
    projetId: chaineNonVide(texte("stocks.validations.projetRequis")),
    materiauId: chaineNonVide(texte("stocks.validations.materiauRequis")),
    quantite: quantite(texte("stocks.validations.quantitePositive")),
    sourceLotId: chaineNonVide(texte("stocks.validations.lotRequis")),
    destinationProjetId: chaineNonVide(texte("stocks.validations.projetRequis")),
    destinationLotId: chaineNonVide(texte("stocks.validations.lotRequis")),
    motif: motif(),
  })
  .refine((f) => f.sourceLotId !== f.destinationLotId, {
    message: texte("stocks.validations.memeLot"),
    path: ["destinationLotId"],
  });

export type FormulaireTransfert = z.infer<typeof schemaTransfert>;

/* ------------------------------------------------------------------ *
 * Le référentiel et les seuils.
 * ------------------------------------------------------------------ */

export const schemaMateriau = z.object({
  code: chaineNonVide(texte("stocks.validations.codeRequis")).max(20),
  designation: chaineNonVide(texte("stocks.validations.designationRequise")).max(150),
  categorie: z.enum(CATEGORIES_ARTICLE as [CategorieArticle, ...CategorieArticle[]]),
  nature: z.enum(NATURES_ARTICLE as [NatureArticle, ...NatureArticle[]]),
  unite: chaineNonVide(texte("stocks.validations.uniteRequise")).max(20),
  seuilDefaut: quantite(texte("stocks.validations.quantiteNonNegative"), true),
});

export type FormulaireMateriau = z.infer<typeof schemaMateriau>;

export function versSaisieMateriau(formulaire: FormulaireMateriau): SaisieMateriau {
  return {
    code: formulaire.code.trim().toUpperCase(),
    designation: formulaire.designation.trim(),
    categorie: formulaire.categorie,
    nature: formulaire.nature,
    unite: formulaire.unite.trim(),
    seuilDefaut: lireQuantite(formulaire.seuilDefaut) ?? 0,
  };
}

export const schemaSeuil = z.object({
  seuil: quantite(texte("stocks.validations.quantiteNonNegative"), true),
});

/* ------------------------------------------------------------------ *
 * Les justificatifs.
 * ------------------------------------------------------------------ */

/** 10 Mo : une photo de BL prise au téléphone, ou un scan PDF. */
export const TAILLE_MAX_JUSTIFICATIF = 10 * 1024 * 1024;
export const TYPES_JUSTIFICATIF = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Pourquoi un fichier ne peut pas servir de justificatif, ou `null`. */
export function refusJustificatif(fichier: File): string | null {
  if (!TYPES_JUSTIFICATIF.includes(fichier.type)) return texte("stocks.validations.justificatifFormat");
  if (fichier.size > TAILLE_MAX_JUSTIFICATIF) return texte("stocks.validations.justificatifTaille");
  return null;
}

/** Une photo de livraison : une image. */
export function refusPhoto(fichier: File): string | null {
  return fichier.type.startsWith("image/") ? null : texte("stocks.validations.photoFormat");
}

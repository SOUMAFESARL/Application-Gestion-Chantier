/**
 * Schémas Zod de validation des formulaires GED (F6) — couche 3.
 *
 * Les messages d'erreur sont injectés par l'appelant depuis `useTranslations("ged.validation")`
 * afin de garder cette couche pure, sans React et sans chaîne littérale.
 */

import { z } from "zod";

import { chaineNonVide } from "@/lib/validations/champs";

import { CATEGORIES_GED } from "./regles";

export const LONGUEUR_MAX_NOM_DOCUMENT = 200;
export const LONGUEUR_MAX_DESCRIPTION_DOCUMENT = 1000;
export const LONGUEUR_MAX_COMMENTAIRE_VERSION = 500;
export const LONGUEUR_MAX_DESTINATAIRE_PARTAGE = 150;
export const LONGUEUR_MAX_NOTE_PARTAGE = 500;
export const LONGUEUR_MAX_MOTIF_SUPPRESSION = 500;

export interface MessagesValidationDepot {
  projetRequis: string;
  categorieRequise: string;
  nomRequis: string;
  nomTropLong: string;
  descriptionTropLongue: string;
  commentaireTropLong: string;
}

export function schemaDepotDocument(messages: MessagesValidationDepot) {
  return z.object({
    projetId: chaineNonVide(messages.projetRequis),
    categorie: z.enum(CATEGORIES_GED, { message: messages.categorieRequise }),
    nom: chaineNonVide(messages.nomRequis).max(LONGUEUR_MAX_NOM_DOCUMENT, messages.nomTropLong),
    description: z
      .string()
      .trim()
      .max(LONGUEUR_MAX_DESCRIPTION_DOCUMENT, messages.descriptionTropLongue),
    commentaire: z
      .string()
      .trim()
      .max(LONGUEUR_MAX_COMMENTAIRE_VERSION, messages.commentaireTropLong),
    estReference: z.boolean(),
  });
}

export type ValeursDepotDocument = z.infer<ReturnType<typeof schemaDepotDocument>>;

export interface MessagesValidationVersion {
  commentaireRequis: string;
  commentaireTropLong: string;
}

/** Note de révision obligatoire pour toute nouvelle version (`POST /ged/documents/{id}/versions/`). */
export function schemaNouvelleVersion(messages: MessagesValidationVersion) {
  return z.object({
    commentaire: chaineNonVide(messages.commentaireRequis).max(
      LONGUEUR_MAX_COMMENTAIRE_VERSION,
      messages.commentaireTropLong,
    ),
    estReference: z.boolean(),
  });
}

export type ValeursNouvelleVersion = z.infer<ReturnType<typeof schemaNouvelleVersion>>;

export interface MessagesValidationPartage {
  destinataireTropLong: string;
  noteTropLongue: string;
}

export function schemaPartageExterne(messages: MessagesValidationPartage) {
  return z.object({
    destinataire: z
      .string()
      .trim()
      .max(LONGUEUR_MAX_DESTINATAIRE_PARTAGE, messages.destinataireTropLong),
    note: z.string().trim().max(LONGUEUR_MAX_NOTE_PARTAGE, messages.noteTropLongue),
  });
}

export type ValeursPartageExterne = z.infer<ReturnType<typeof schemaPartageExterne>>;

export interface MessagesValidationSuppression {
  motifTropLong: string;
}

export function schemaSuppressionDocument(messages: MessagesValidationSuppression) {
  return z.object({
    motif: z.string().trim().max(LONGUEUR_MAX_MOTIF_SUPPRESSION, messages.motifTropLong),
  });
}

export type ValeursSuppressionDocument = z.infer<ReturnType<typeof schemaSuppressionDocument>>;

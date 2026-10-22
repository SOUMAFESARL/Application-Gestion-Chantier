/**
 * L'accès aux données du domaine Documents — `/entreprise/documents/`.
 *
 * **C'est le seul fichier du domaine qui sait que le serveur existe.** Même méthode que
 * `features/projets/adaptateur.ts` : charges `snake_case` privées, traductions `vers*`,
 * fonctions exportées au verbe à l'infinitif.
 *
 * Le contrat vient de `apps/projets/views/parametres_documents.py` et de
 * `apps/projets/serializers/parametres_documents.py` : `GET` est ouvert à tout compte
 * connecté (chaque PDF en a besoin), `PATCH` exige `administration.documents_gerer`.
 */

import { api } from "@/lib/api";

import type { CodeMention, DocumentsResolus, ReglageDocuments } from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur — la seule zone en `snake_case`.
 * ------------------------------------------------------------------ */

interface ChargeReglage {
  entete_afficher_logo: boolean;
  entete_mentions: string[];
  entete_texte_libre: string;
  pied_mentions: string[];
  pied_texte_libre: string;
}

interface ChargeDocuments {
  reglage: ChargeReglage;
  entete: { logo_url: string | null; lignes: string[] };
  pied: { lignes: string[] };
}

/* ------------------------------------------------------------------ *
 * Traductions — serveur vers domaine, et retour.
 * ------------------------------------------------------------------ */

function versReglage(charge: ChargeReglage): ReglageDocuments {
  return {
    afficherLogo: charge.entete_afficher_logo,
    mentionsEntete: charge.entete_mentions as CodeMention[],
    texteLibreEntete: charge.entete_texte_libre ?? "",
    mentionsPied: charge.pied_mentions as CodeMention[],
    texteLibrePied: charge.pied_texte_libre ?? "",
  };
}

function versCharge(reglage: ReglageDocuments): ChargeReglage {
  return {
    entete_afficher_logo: reglage.afficherLogo,
    entete_mentions: reglage.mentionsEntete,
    entete_texte_libre: reglage.texteLibreEntete,
    pied_mentions: reglage.mentionsPied,
    pied_texte_libre: reglage.texteLibrePied,
  };
}

function versDocuments(charge: ChargeDocuments): DocumentsResolus {
  return {
    reglage: versReglage(charge.reglage),
    entete: { logoUrl: charge.entete.logo_url ?? null, lignes: charge.entete.lignes ?? [] },
    pied: { lignes: charge.pied.lignes ?? [] },
  };
}

/* ------------------------------------------------------------------ *
 * Lectures et écritures.
 * ------------------------------------------------------------------ */

/** `GET /entreprise/documents/` — le réglage et ses lignes résolues. */
export async function lireDocuments(signal?: AbortSignal): Promise<DocumentsResolus> {
  return versDocuments(await api.lire<ChargeDocuments>("/entreprise/documents/", undefined, signal));
}

/**
 * La lecture que fait un générateur de PDF : **un réglage qui ne se charge pas ne doit pas
 * empêcher le document de sortir**, il sort alors sans mentions, comme avant le réglage.
 */
export async function lireDocumentsOuNull(): Promise<DocumentsResolus | null> {
  try {
    return await lireDocuments();
  } catch {
    return null;
  }
}

/** `PATCH /entreprise/documents/` — DG et AD ; un code de mention inconnu est refusé (400). */
export async function modifierDocuments(reglage: ReglageDocuments): Promise<DocumentsResolus> {
  return versDocuments(await api.modifier<ChargeDocuments>("/entreprise/documents/", versCharge(reglage)));
}

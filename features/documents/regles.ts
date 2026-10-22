/**
 * Les règles du réglage des documents — pures, sans React.
 *
 * **Une seule règle d'application, partagée** : `appliquerDocumentsAuPdf` complète l'en-tête
 * et le pied d'un `DocumentPdf`. Aucun générateur ne la réimplémente — chacun appelle cette
 * fonction sur le document qu'il vient de composer.
 */

import type { DonneesEntreprise } from "@/features/configuration/api";
import type { DocumentPdf } from "@/lib/export/documentPdf";

import { CODES_MENTIONS } from "./types";
import type { CodeMention, DocumentsResolus, ReglageDocuments } from "./types";

/** Le droit qui ouvre l'écriture du réglage : DG et AD. */
export const PERMISSION_GERER_DOCUMENTS = "administration.documents_gerer";

/** Longueurs maximales des textes libres (`ParametresDocuments`). */
export const TEXTE_LIBRE_ENTETE_MAX = 200;
export const TEXTE_LIBRE_PIED_MAX = 300;

/* ------------------------------------------------------------------ *
 * L'application aux PDF.
 * ------------------------------------------------------------------ */

/**
 * Complète l'en-tête et le pied d'un document avec le réglage de l'entreprise.
 *
 * - le logo disparaît si le réglage le masque ;
 * - les mentions de l'en-tête et du pied sont posées en lignes ;
 * - le pied, à gauche, ne répète plus les coordonnées : ce sont les mentions choisies qui les
 *   portent, et l'entreprise décide lesquelles. Il garde le nom de l'émetteur.
 *
 * **Sans réglage (`null`, il ne s'est pas chargé), le document sort tel quel**, comme avant.
 */
export function appliquerDocumentsAuPdf(
  contenu: DocumentPdf,
  documents: DocumentsResolus | null,
): DocumentPdf {
  if (!documents) return contenu;
  return {
    ...contenu,
    entete: {
      ...contenu.entete,
      logo: documents.entete.logoUrl ? contenu.entete.logo : null,
      lignes: documents.entete.lignes,
    },
    pied: {
      ...contenu.pied,
      gauche: contenu.entete.emetteur,
      lignes: documents.pied.lignes,
    },
  };
}

/* ------------------------------------------------------------------ *
 * L'écran de réglage : choix, ordre, aperçu.
 * ------------------------------------------------------------------ */

/** Les mentions pas encore choisies, dans l'ordre où l'écran les propose. */
export function mentionsDisponibles(choisies: readonly CodeMention[]): CodeMention[] {
  return CODES_MENTIONS.filter((code) => !choisies.includes(code));
}

export function ajouterMention(choisies: readonly CodeMention[], code: CodeMention): CodeMention[] {
  return choisies.includes(code) ? [...choisies] : [...choisies, code];
}

export function retirerMention(choisies: readonly CodeMention[], code: CodeMention): CodeMention[] {
  return choisies.filter((choisie) => choisie !== code);
}

/** Décale une mention d'un rang (`-1` vers le haut, `1` vers le bas) ; sans effet aux bornes. */
export function deplacerMention(
  choisies: readonly CodeMention[],
  code: CodeMention,
  sens: -1 | 1,
): CodeMention[] {
  const rang = choisies.indexOf(code);
  const cible = rang + sens;
  if (rang < 0 || cible < 0 || cible >= choisies.length) return [...choisies];
  const resultat = [...choisies];
  [resultat[rang], resultat[cible]] = [resultat[cible], resultat[rang]];
  return resultat;
}

/** Le brouillon diffère-t-il du réglage enregistré ? L'ordre des mentions compte. */
export function reglagesIdentiques(a: ReglageDocuments, b: ReglageDocuments): boolean {
  return (
    a.afficherLogo === b.afficherLogo &&
    a.texteLibreEntete === b.texteLibreEntete &&
    a.texteLibrePied === b.texteLibrePied &&
    a.mentionsEntete.join("|") === b.mentionsEntete.join("|") &&
    a.mentionsPied.join("|") === b.mentionsPied.join("|")
  );
}

/** Les mots qui précèdent la valeur d'une mention (« RCCM : … »), fournis traduits par l'écran. */
export interface LibellesMentions {
  rccm: string;
  nif: string;
  telephone: string;
  email: string;
  siteWeb: string;
}

function propre(valeur: string | null | undefined): string {
  return (valeur ?? "").split(/\s+/).filter(Boolean).join(" ");
}

function avecLibelle(libelle: string, valeur: string | null | undefined): string {
  const nettoyee = propre(valeur);
  return nettoyee ? `${libelle} : ${nettoyee}` : "";
}

/**
 * La ligne imprimable de chaque mention (chaîne vide : rien à imprimer), pour l'aperçu d'un
 * brouillon. Recopie `valeurs_mentions` (`apps/projets/services/parametres_documents.py`) : ce
 * que le serveur résout pour les PDF, l'écran le résout pour ce que la personne est en train de
 * choisir.
 */
export function valeursMentions(
  entreprise: DonneesEntreprise,
  libelles: LibellesMentions,
): Record<CodeMention, string> {
  const principal = entreprise.telephones?.find((telephone) => telephone.principal)?.numero;
  return {
    raison_sociale: propre(entreprise.raison_sociale),
    nom_commercial: propre(entreprise.nom_commercial),
    rccm: avecLibelle(libelles.rccm, entreprise.rccm),
    nif: avecLibelle(libelles.nif, entreprise.nif),
    adresse: propre(entreprise.adresse),
    ville: propre(entreprise.ville),
    telephone: avecLibelle(libelles.telephone, principal || entreprise.telephone_contact),
    email: avecLibelle(libelles.email, entreprise.email_contact),
    site_web: avecLibelle(libelles.siteWeb, ""),
  };
}

/** Les lignes d'un bloc : les mentions choisies sans valeur sont omises, puis le texte libre. */
export function resoudreLignes(
  codes: readonly CodeMention[],
  valeurs: Record<CodeMention, string>,
  texteLibre: string,
): string[] {
  return [...codes.map((code) => valeurs[code]), propre(texteLibre)].filter(Boolean);
}

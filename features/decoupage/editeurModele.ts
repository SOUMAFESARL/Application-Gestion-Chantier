/**
 * Règles pures, types présentationnels et validation du formulaire de modèle de découpage.
 *
 * Partagé entre l'espace Entreprise (`GestionModelesDecoupage`) et le back-office Super Admin
 * (`GestionModelesDecoupagePlateforme`) sans aucune dépendance à React, à `next-intl` ni au client
 * HTTP. Tous les identifiants sont en camelCase strict.
 */

import { z } from "zod";

import type { OrigineReference } from "./types";

/** Nombre maximal de niveaux hiérarchiques autorisés dans un gabarit ou tableau de découpage. */
export const MAX_NIVEAUX = 10;

/** Valeur sentinelle du sélecteur lorsqu'aucune liste de valeurs n'est associée à un niveau. */
export const SANS_LISTE = "aucune";

export interface ValeurListeOptionEditeur {
  id?: string;
  libelle: string;
  groupe?: string;
}

export interface ReferenceListeEditeur {
  origine?: OrigineReference;
  id: string;
  libelle: string;
}

export interface ListeOptionEditeur {
  origine?: OrigineReference;
  id: string;
  libelle: string;
  description?: string;
  estActif?: boolean;
  modifiable?: boolean;
  valeurs: readonly ValeurListeOptionEditeur[];
}

export interface NiveauEditeur {
  libelle: string;
  liste: ReferenceListeEditeur | null;
  alerter: boolean;
}

export interface TypeProjetOptionEditeur {
  code: string;
  libelle: string;
}

export interface DonneesFormulaireModele {
  nom: string;
  description: string;
  estActif: boolean;
  typesProjet: string[];
  parDefautPour: string[];
  niveaux: NiveauEditeur[];
  lignes: string[][];
}

export interface ResultatImportModeleEditeur {
  niveaux: NiveauEditeur[];
  lignes: string[][];
}

export interface MessagesValidationModele {
  nomRequis?: string;
  niveauxRequis?: string;
  niveauLibelleRequis?: string;
}

export interface LibellesEditeurModele {
  champNom: string;
  placeholderNom: string;
  champDescription: string;
  placeholderDescription: string;
  champEstActif?: string;
  typesProjetTitre: string;
  typesProjetAide: string;
  parDefautCourt: string;
  niveauxTitre: string;
  niveauxAide: string;
  ajouterNiveau: string;
  niveauRang: (rang: number) => string;
  deplacerGauche: string;
  deplacerDroite: string;
  retirerNiveau: string;
  placeholderNiveau: string;
  sansListe: string;
  alerterNiveau: string;
  lignesTitre: (n: number) => string;
  lignesAide: string;
  telechargerModeleExcel?: string;
  importerExcel: string;
  ajouterLigne: string;
  retirerLigne: string;
  ajouterRacine?: (niveau: string) => string;
  ajouterEnfant?: (niveau: string) => string;
  deplier?: string;
  replier?: string;
  toutDeplier?: string;
  toutReplier?: string;
  arbreVideTitre?: string;
  arbreVideAide?: string;
  saisirOuChoisir?: string;
  listeValeurs?: string;
  resumeFeuilles?: (n: number) => string;
  viderCellule: string;
  sansValeur: string;
  rechercherValeur: string;
  aucuneValeur: string;
  utiliserValeurLibre: (saisie: string) => string;
  annuler: string;
  enregistrer: string;
  messagesValidation?: MessagesValidationModele;
}

/** Construit les 3 niveaux initiaux d'un nouveau modèle (le 2e niveau porte l'alerte par défaut). */
export function niveauxInitiaux(libelles: [string, string, string]): NiveauEditeur[] {
  return [
    { libelle: libelles[0], liste: null, alerter: false },
    { libelle: libelles[1], liste: null, alerter: true },
    { libelle: libelles[2], liste: null, alerter: false },
  ];
}

/**
 * Ajuste chaque ligne du modèle au nombre exact de niveaux (`1..MAX_NIVEAUX`).
 * Garantit au moins une ligne vide pour l'édition à l'écran.
 */
export function normaliserLignesModele(
  lignesBrutes: readonly (readonly string[])[],
  nbNiveaux: number,
): string[][] {
  const largeur = Math.max(1, Math.min(nbNiveaux, MAX_NIVEAUX));
  if (lignesBrutes.length === 0) {
    return [Array.from({ length: largeur }, () => "")];
  }
  return lignesBrutes.map((ligne) => {
    const copie = ligne.slice(0, largeur);
    while (copie.length < largeur) copie.push("");
    return copie;
  });
}

/**
 * Nettoie les lignes avant envoi à l'API : rogne les espaces de chaque cellule et retire les
 * lignes entièrement vides.
 */
export function nettoyerLignesModele(
  lignesBrutes: readonly (readonly string[])[],
  nbNiveaux?: number,
): string[][] {
  return lignesBrutes
    .map((ligne) => {
      const tranche = nbNiveaux !== undefined ? ligne.slice(0, nbNiveaux) : [...ligne];
      if (nbNiveaux !== undefined) {
        while (tranche.length < nbNiveaux) tranche.push("");
      }
      return tranche.map((cellule) => cellule.trim());
    })
    .filter((ligne) => ligne.some((cellule) => cellule !== ""));
}

/**
 * Dédoublonne `typesProjet` et `parDefautPour` tout en garantissant l'invariant
 * `parDefautPour ⊆ typesProjet`.
 */
export function normaliserTypesEtDefauts(
  typesProjet: readonly string[],
  parDefautPour: readonly string[],
): { typesProjet: string[]; parDefautPour: string[] } {
  const typesUniques: string[] = [];
  const ensembleTypes = new Set<string>();
  for (const code of typesProjet) {
    const propre = code.trim();
    if (!propre || ensembleTypes.has(propre)) continue;
    ensembleTypes.add(propre);
    typesUniques.push(propre);
  }

  const defautsUniques: string[] = [];
  const ensembleDefauts = new Set<string>();
  for (const code of parDefautPour) {
    const propre = code.trim();
    if (!propre || !ensembleTypes.has(propre) || ensembleDefauts.has(propre)) continue;
    ensembleDefauts.add(propre);
    defautsUniques.push(propre);
  }

  return {
    typesProjet: typesUniques,
    parDefautPour: defautsUniques,
  };
}

/**
 * Coche ou décoche un type de projet associé ; décocher un type le retire automatiquement de
 * `parDefautPour`.
 */
export function basculerTypeProjetSelection(
  typesProjet: readonly string[],
  parDefautPour: readonly string[],
  code: string,
  coche: boolean,
): { typesProjet: string[]; parDefautPour: string[] } {
  const prochainsTypes = coche
    ? [...typesProjet, code]
    : typesProjet.filter((existant) => existant !== code);
  const prochainsDefauts = coche
    ? parDefautPour
    : parDefautPour.filter((existant) => existant !== code);
  return normaliserTypesEtDefauts(prochainsTypes, prochainsDefauts);
}

/**
 * Coche ou décoche un type de projet « par défaut » ; cocher un défaut assure que le type est
 * également présent dans `typesProjet`.
 */
export function basculerDefautTypeSelection(
  typesProjet: readonly string[],
  parDefautPour: readonly string[],
  code: string,
  coche: boolean,
): { typesProjet: string[]; parDefautPour: string[] } {
  const prochainsTypes = coche && !typesProjet.includes(code) ? [...typesProjet, code] : typesProjet;
  const prochainsDefauts = coche
    ? [...parDefautPour, code]
    : parDefautPour.filter((existant) => existant !== code);
  return normaliserTypesEtDefauts(prochainsTypes, prochainsDefauts);
}

/** Clé stable d'une référence de liste dans un `<Select>` (avec ou sans origine). */
export function cleListeEditeur(reference: { id: string; origine?: OrigineReference }): string {
  return reference.origine ? `${reference.origine}:${reference.id}` : reference.id;
}

/** Retrouve la liste de valeurs complète associée à un niveau dans l'éditeur. */
export function trouverListeEditeur(
  listes: readonly ListeOptionEditeur[],
  reference: { id: string; origine?: OrigineReference } | null | undefined,
): ListeOptionEditeur | undefined {
  if (!reference) return undefined;
  return listes.find((liste) => {
    if (reference.origine && liste.origine) {
      return liste.origine === reference.origine && liste.id === reference.id;
    }
    return liste.id === reference.id;
  });
}

/** Construit l'état initial du formulaire à partir d'un détail de modèle (ou `null` en création). */
export function creerDonneesInitialesModele(
  source:
    | {
        nom: string;
        description: string;
        estActif?: boolean;
        typesProjet: readonly string[];
        parDefautPour: readonly string[];
        niveaux: readonly NiveauEditeur[];
        lignes: readonly (readonly string[])[];
      }
    | null
    | undefined,
  libellesNiveauxDefaut: [string, string, string],
): DonneesFormulaireModele {
  const niveaux =
    source && source.niveaux.length > 0
      ? source.niveaux.slice(0, MAX_NIVEAUX).map((n) => ({
          libelle: n.libelle,
          liste: n.liste ? { ...n.liste } : null,
          alerter: n.alerter,
        }))
      : niveauxInitiaux(libellesNiveauxDefaut);
  const { typesProjet, parDefautPour } = normaliserTypesEtDefauts(
    source?.typesProjet ?? [],
    source?.parDefautPour ?? [],
  );
  return {
    nom: source?.nom ?? "",
    description: source?.description ?? "",
    estActif: source?.estActif ?? true,
    typesProjet,
    parDefautPour,
    niveaux,
    lignes: normaliserLignesModele(source?.lignes ?? [], niveaux.length),
  };
}

/** Schéma Zod du formulaire de modèle de découpage (Entreprise et Super Admin). */
export function schemaFormulaireModele(messages?: MessagesValidationModele) {
  const schemaReferenceListe = z.object({
    origine: z.enum(["PLATEFORME", "ENTREPRISE"]).optional(),
    id: z.string().trim().min(1),
    libelle: z.string().trim(),
  });

  const schemaLibelleNiveau = messages?.niveauLibelleRequis
    ? z.string().trim().min(1, { message: messages.niveauLibelleRequis }).max(60)
    : z.string().trim().max(60);

  const schemaNiveau = z.object({
    libelle: schemaLibelleNiveau,
    liste: schemaReferenceListe.nullable(),
    alerter: z.boolean(),
  });

  return z
    .object({
      nom: z
        .string()
        .trim()
        .min(1, { message: messages?.nomRequis ?? "nom_requis" })
        .max(150),
      description: z.string().trim(),
      estActif: z.boolean(),
      typesProjet: z.array(z.string()),
      parDefautPour: z.array(z.string()),
      niveaux: z
        .array(schemaNiveau)
        .min(1, { message: messages?.niveauxRequis ?? "niveaux_requis" })
        .max(MAX_NIVEAUX),
      lignes: z.array(z.array(z.string().max(200))),
    })
    .transform((valeurs): DonneesFormulaireModele => {
      const { typesProjet, parDefautPour } = normaliserTypesEtDefauts(
        valeurs.typesProjet,
        valeurs.parDefautPour,
      );
      let alerteAssignee = false;
      const niveaux = valeurs.niveaux.map((niv) => {
        const alerter = niv.alerter && !alerteAssignee;
        if (alerter) alerteAssignee = true;
        return {
          libelle: niv.libelle,
          liste: niv.liste,
          alerter,
        };
      });
      return {
        nom: valeurs.nom,
        description: valeurs.description,
        estActif: valeurs.estActif,
        typesProjet,
        parDefautPour,
        niveaux,
        lignes: nettoyerLignesModele(valeurs.lignes, niveaux.length),
      };
    });
}

export type ResultatValidationModele =
  | { valide: true; donnees: DonneesFormulaireModele; erreur: null }
  | { valide: false; donnees: null; erreur: string };

/** Valide et normalise les données saisies dans l'éditeur de modèle de découpage. */
export function validerFormulaireModele(
  saisie: DonneesFormulaireModele,
  messages?: MessagesValidationModele,
): ResultatValidationModele {
  const resultat = schemaFormulaireModele(messages).safeParse(saisie);
  if (!resultat.success) {
    return {
      valide: false,
      donnees: null,
      erreur:
        resultat.error.issues[0]?.message ?? messages?.nomRequis ?? "validation_modele_invalide",
    };
  }
  return {
    valide: true,
    donnees: resultat.data,
    erreur: null,
  };
}

/** Déclenche le téléchargement navigateur d'un `Blob` sous le nom de fichier indiqué. */
export function telechargerBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

/**
 * Les règles du domaine Découpage — pures, sans React.
 *
 * Le serveur vérifie et décide (C-1 à C-7, périmètres, statuts) ; ces règles ne servent qu'à
 * tenir la saisie en forme et à présenter ce qu'il a dit.
 */

import { PERMISSIONS, type CodePermission } from "@/features/habilitations/permissions";

import type {
  ArbreProjet,
  CaseArbre,
  ConstatTableau,
  LigneTableau,
  NiveauGabarit,
  TableauDemarrage,
  UniteMesure,
} from "./types";

let compteur = 0;

/** Une clé locale de ligne : stable tant que la ligne vit, jamais envoyée au serveur. */
export function nouvelleCleLigne(): string {
  compteur += 1;
  return `ligne-${Date.now().toString(36)}-${compteur}`;
}

export function ligneVide(largeur: number): LigneTableau {
  return {
    cle: nouvelleCleLigne(),
    cellules: Array.from({ length: largeur }, () => ""),
    unite: null,
    quantite: null,
    montant: null,
    dateDebut: null,
    dateFin: null,
  };
}

export function niveauVide(): NiveauGabarit {
  return { libelle: "", liste: null, alerter: false };
}

/** Les cellules d'une ligne recalées sur la largeur du gabarit (complétées ou tronquées). */
export function recaler(ligne: LigneTableau, largeur: number): LigneTableau {
  if (ligne.cellules.length === largeur) return ligne;
  const cellules = ligne.cellules.slice(0, largeur);
  while (cellules.length < largeur) cellules.push("");
  return { ...ligne, cellules };
}

/** Une ligne qui ne porte rien : le serveur l'ignore, l'écran ne la compte pas. */
export function ligneEstVide(ligne: LigneTableau): boolean {
  return ligne.cellules.every((cellule) => !cellule.trim());
}

/** Le tableau ne porte aucune tâche : rien à appliquer. */
export function tableauEstVide(tableau: Pick<TableauDemarrage, "lignes">): boolean {
  return tableau.lignes.every(ligneEstVide);
}

/** Retire le niveau de rang `index` et la colonne correspondante de chaque ligne. */
export function retirerNiveau(tableau: TableauDemarrage, index: number): TableauDemarrage {
  return {
    ...tableau,
    niveaux: tableau.niveaux.filter((_, rang) => rang !== index),
    lignes: tableau.lignes.map((ligne) => ({
      ...ligne,
      cellules: ligne.cellules.filter((_, rang) => rang !== index),
    })),
  };
}

/** Ajoute un niveau en fin de gabarit, et une cellule vide à chaque ligne. */
export function ajouterNiveau(tableau: TableauDemarrage): TableauDemarrage {
  const largeur = tableau.niveaux.length + 1;
  return {
    ...tableau,
    niveaux: [...tableau.niveaux, niveauVide()],
    lignes: tableau.lignes.map((ligne) => recaler(ligne, largeur)),
  };
}

/** Échange deux niveaux voisins, colonnes comprises. */
export function deplacerNiveau(
  tableau: TableauDemarrage,
  index: number,
  sens: -1 | 1,
): TableauDemarrage {
  const cible = index + sens;
  if (cible < 0 || cible >= tableau.niveaux.length) return tableau;
  const echanger = <T>(liste: T[]): T[] => {
    const copie = [...liste];
    [copie[index], copie[cible]] = [copie[cible], copie[index]];
    return copie;
  };
  return {
    ...tableau,
    niveaux: echanger(tableau.niveaux),
    lignes: tableau.lignes.map((ligne) => ({ ...ligne, cellules: echanger(ligne.cellules) })),
  };
}

/**
 * Les constats de la vérification rangés par ligne du tableau. Le serveur numérote les lignes
 * dans l'ordre d'envoi, à partir de 1 : la ligne `n` est `lignes[n - 1]`.
 */
export function constatsParLigne(constats: ConstatTableau[]): Map<number, ConstatTableau[]> {
  const parLigne = new Map<number, ConstatTableau[]>();
  for (const constat of constats) {
    if (constat.ligne === null) continue;
    parLigne.set(constat.ligne, [...(parLigne.get(constat.ligne) ?? []), constat]);
  }
  return parLigne;
}

/** Les constats qui ne visent aucune ligne : ceux des niveaux (C-3, C-4). */
export function constatsGeneraux(constats: ConstatTableau[]): ConstatTableau[] {
  return constats.filter((constat) => constat.ligne === null);
}

/**
 * Les en-têtes des colonnes de données d'un fichier, dans l'ordre que l'import du serveur
 * reconnaît (`import_export.COLONNES_DONNEES`) : un fichier exporté se réimporte tel quel.
 */
export const COLONNES_FICHIER = ["unite", "quantite", "montant", "dateDebut", "dateFin"] as const;
export type ColonneFichier = (typeof COLONNES_FICHIER)[number];

/**
 * Les lignes d'un fichier tiré du tableau : une colonne par niveau puis les données. Les
 * montants partent **tels que le serveur les lit** (`Montant (FCFA)`, voir `importerFichier`).
 */
export function lignesFichier(
  tableau: TableauDemarrage,
  colonnes: readonly ColonneFichier[],
  libelleUnite: (unite: UniteMesure) => string,
): (string | number)[][] {
  return tableau.lignes
    .filter((ligne) => !ligneEstVide(ligne))
    .map((ligne) => [
      ...ligne.cellules,
      ...colonnes.map((colonne) => {
        switch (colonne) {
          case "unite":
            return ligne.unite ? libelleUnite(ligne.unite) : "";
          case "quantite":
            return ligne.quantite ?? "";
          case "montant":
            return ligne.montant ?? "";
          case "dateDebut":
            return ligne.dateDebut ?? "";
          case "dateFin":
            return ligne.dateFin ?? "";
        }
      }),
    ]);
}

/* ------------------------------------------------------------------ *
 * L'arbre.
 * ------------------------------------------------------------------ */

/** Les cases de l'arbre à plat, dans l'ordre de lecture (parent puis enfants). */
export function aplatirCases(cases: CaseArbre[]): CaseArbre[] {
  return cases.flatMap((une) => [une, ...aplatirCases(une.enfants)]);
}

export function trouverCase(cases: CaseArbre[], id: string | null): CaseArbre | null {
  if (!id) return null;
  return aplatirCases(cases).find((une) => une.id === id) ?? null;
}

/** Les chiffres de structure d'un arbre : cases et tâches actives, niveaux. */
export function compterArbre(arbre: ArbreProjet): { cases: number; taches: number; niveaux: number } {
  const actives = aplatirCases(arbre.cases).filter((une) => une.acces === "COMPLET" && une.estActif);
  return {
    cases: actives.length,
    taches: actives.filter((une) => une.estFeuille).length,
    niveaux: arbre.niveaux.length,
  };
}

/**
 * Ce que l'avancement d'une case permet d'afficher (lot 12, « partiel » et « indisponible ») :
 * jamais un faux 0 % quand rien n'est mesurable.
 */
export type EtatAvancement = "indisponible" | "partiel" | "complet";

export function etatAvancement(
  une: Pick<CaseArbre, "avancement" | "avancementDisponible" | "avancementPartiel">,
): EtatAvancement {
  if (!une.avancementDisponible || une.avancement === null) return "indisponible";
  return une.avancementPartiel ? "partiel" : "complet";
}

/** Les gestes de la vue en arbre (lot 4) ; les autres arrivent avec le lot 6. */
export type GesteCase =
  | "ajouter"
  | "modifier"
  | "planifier"
  | "mesurer"
  | "cloturer"
  | "desactiver"
  | "reactiver";

/**
 * Les gestes qui ont un sens sur cette case, d'après sa position et son état — la permission se
 * juge à part. Le serveur reste juge : une règle qu'il applique et que l'écran ignore produit un
 * refus explicite, affiché tel quel.
 */
export function gestesPossibles(une: CaseArbre): GesteCase[] {
  if (une.acces !== "COMPLET") return [];
  if (!une.estActif) return ["reactiver"];
  const gestes: GesteCase[] = ["modifier"];
  // Une tâche commencée ne se découpe plus par ajout : elle se « détaille » (A-5, lot 6).
  if (!(une.estFeuille && une.commence)) gestes.unshift("ajouter");
  if (!une.dateDebutPrevue || !une.dateFinPrevue) gestes.push("planifier");
  if (une.estFeuille && !une.cloture) gestes.push("mesurer", "cloturer");
  gestes.push("desactiver");
  return gestes;
}

/** La permission qu'exige chaque geste (registre du serveur). */
export const PERMISSION_DU_GESTE: Record<GesteCase, CodePermission> = {
  ajouter: PERMISSIONS.DECOUPER,
  modifier: PERMISSIONS.DECOUPER,
  planifier: PERMISSIONS.PLANIFIER,
  mesurer: PERMISSIONS.MESURER,
  cloturer: PERMISSIONS.MESURER,
  desactiver: PERMISSIONS.DECOUPER,
  reactiver: PERMISSIONS.DECOUPER,
};

/** Le motif d'un geste tracé : 10 caractères au moins (`_exiger_motif` du serveur). */
export const LONGUEUR_MIN_MOTIF = 10;
/** La justification d'un report : 30 caractères au moins (RG-11). */
export const LONGUEUR_MIN_JUSTIFICATION = 30;

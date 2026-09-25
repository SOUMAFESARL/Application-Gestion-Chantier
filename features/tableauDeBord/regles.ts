/**
 * Les règles métier du tableau de bord du Directeur Général.
 *
 * Pur, sans React. Tout ce que l'écran affiche d'autre qu'une donnée brute se
 * calcule ici : le niveau de santé, ce qui justifie qu'un chantier remonte
 * dans « à surveiller », les quatre indicateurs de direction, la phrase de
 * synthèse. Le composant ne fait que poser le résultat.
 *
 * Les seuils de retard et de budget ne sont **pas** redéfinis : ils viennent
 * de `features/projets/regles`, pour que le tableau de bord, la liste des
 * chantiers et la fiche disent la même chose d'un même chantier. C'est la
 * leçon de l'ancien seuil de retard, écrit deux fois avec deux valeurs.
 */

import {
  estEnRetard,
  niveauBudget,
  ratioConsommationBudget,
} from "@/features/projets/regles";
import type { StatutProjet } from "@/features/projets/types";

import type {
  AlertePilotage,
  Echeance,
  ElementAValider,
  GraviteAlerte,
  LigneChantier,
  NiveauSante,
  TableauDeBord,
} from "./types";

/* ------------------------------------------------------------------ *
 * L'indice de santé.
 * ------------------------------------------------------------------ */

/**
 * Les seuils de l'indice de santé — le CDC ne les fixe pas ; retenus avec le
 * propriétaire du produit le 24/09/2026. Ils deviendront un paramètre de
 * l'entreprise (docs/PLAN_INTERFACES_DG.md §14).
 */
export const SEUIL_SANTE_BON = 80;
export const SEUIL_SANTE_VIGILANCE = 60;

/** Vert au-dessus de 80, orange de 60 à 79, rouge en dessous. */
export function niveauSante(indice: number): NiveauSante {
  if (indice >= SEUIL_SANTE_BON) return "BON";
  if (indice >= SEUIL_SANTE_VIGILANCE) return "VIGILANCE";
  return "CRITIQUE";
}

const RANG_NIVEAU: Record<NiveauSante, number> = { CRITIQUE: 0, VIGILANCE: 1, BON: 2 };

/* ------------------------------------------------------------------ *
 * Le périmètre.
 * ------------------------------------------------------------------ */

/** Ce qui ne se pilote plus : un chantier livré ou archivé sort du tableau de bord. */
const STATUTS_CLOS: StatutProjet[] = ["TERMINE", "ARCHIVE"];

/** Un chantier en travaux — ni en attente de démarrage, ni suspendu, ni clos. */
const STATUTS_ACTIFS: StatutProjet[] = ["EN_COURS", "EN_RETARD", "CRITIQUE"];

/** Les chantiers que le DG suit : tout ce qui n'est pas clos. */
export function chantiersSuivis(lignes: LigneChantier[]): LigneChantier[] {
  return lignes.filter((ligne) => !STATUTS_CLOS.includes(ligne.statut));
}

export function estActif(ligne: LigneChantier): boolean {
  return STATUTS_ACTIFS.includes(ligne.statut);
}

/**
 * Le portefeuille dans l'ordre où il faut le lire : du plus critique au plus
 * sain, puis par indice croissant. Un DG qui ouvre la liste doit tomber
 * d'abord sur ce qui réclame son intervention.
 */
export function trierParCriticite(lignes: LigneChantier[]): LigneChantier[] {
  return [...lignes].sort((a, b) => {
    const rang = RANG_NIVEAU[niveauSante(a.indiceSante)] - RANG_NIVEAU[niveauSante(b.indiceSante)];
    return rang !== 0 ? rang : a.indiceSante - b.indiceSante;
  });
}

/* ------------------------------------------------------------------ *
 * Ce qui justifie l'attention du DG.
 * ------------------------------------------------------------------ */

export type TypeMotif =
  | "SANTE_CRITIQUE"
  | "MARGE_NEGATIVE"
  | "BUDGET_DEPASSE"
  | "RETARD"
  | "BUDGET_ALERTE"
  | "SUSPENDU"
  | "BUDGET_NON_DEFINI";

/** Un motif, et le chiffre qui le justifie quand il y en a un. */
export interface MotifAttention {
  type: TypeMotif;
  valeur: number | null;
}

/**
 * Les motifs qui engagent l'argent de l'entreprise : ils se signalent en
 * rouge, les autres en orange.
 */
const MOTIFS_GRAVES: TypeMotif[] = ["SANTE_CRITIQUE", "MARGE_NEGATIVE", "BUDGET_DEPASSE"];

export function estMotifGrave(motif: MotifAttention): boolean {
  return MOTIFS_GRAVES.includes(motif.type);
}

/**
 * Pourquoi un chantier remonte, du plus grave au moins grave.
 *
 * Un motif dit **ce qui ne va pas**, pas seulement que ça ne va pas : « santé
 * 38 » oblige à ouvrir la fiche, « budget dépassé de 6 % · marge -4 % » dit
 * déjà quoi demander au directeur de projet.
 */
export function motifsAttention(ligne: LigneChantier): MotifAttention[] {
  const motifs: MotifAttention[] = [];

  if (niveauSante(ligne.indiceSante) === "CRITIQUE") {
    motifs.push({ type: "SANTE_CRITIQUE", valeur: ligne.indiceSante });
  }
  if (ligne.margePrevisionnelle !== null && ligne.margePrevisionnelle < 0) {
    motifs.push({ type: "MARGE_NEGATIVE", valeur: ligne.margePrevisionnelle });
  }

  const ratio = ratioConsommationBudget(ligne.budgetInitial, ligne.budgetConsomme);
  const niveau = niveauBudget(ratio);
  if (niveau === "depassement") motifs.push({ type: "BUDGET_DEPASSE", valeur: ratio });

  if (estEnRetard(ligne.ecart)) motifs.push({ type: "RETARD", valeur: ligne.ecart });
  if (niveau === "alerte") motifs.push({ type: "BUDGET_ALERTE", valeur: ratio });
  if (ligne.statut === "SUSPENDU") motifs.push({ type: "SUSPENDU", valeur: null });
  if (ligne.budgetInitial === null) motifs.push({ type: "BUDGET_NON_DEFINI", valeur: null });

  return motifs;
}

/** Les chantiers suivis qui ont au moins un motif, les plus critiques en tête. */
export function chantiersAAttention(
  lignes: LigneChantier[],
): { chantier: LigneChantier; motifs: MotifAttention[] }[] {
  return trierParCriticite(chantiersSuivis(lignes))
    .map((chantier) => ({ chantier, motifs: motifsAttention(chantier) }))
    .filter(({ motifs }) => motifs.length > 0);
}

/* ------------------------------------------------------------------ *
 * Les quatre indicateurs de direction — CDC module 12.
 * ------------------------------------------------------------------ */

export interface IndicateurPortefeuille {
  actifs: number;
  enAttente: number;
  suspendus: number;
  /** Le carnet de commandes : la somme des marchés suivis, en centimes. */
  carnetCommandes: number;
}

export function indicateurPortefeuille(lignes: LigneChantier[]): IndicateurPortefeuille {
  const suivis = chantiersSuivis(lignes);
  return {
    actifs: suivis.filter(estActif).length,
    enAttente: suivis.filter((ligne) => ligne.statut === "EN_ATTENTE").length,
    suspendus: suivis.filter((ligne) => ligne.statut === "SUSPENDU").length,
    carnetCommandes: suivis.reduce((total, ligne) => total + (ligne.montantMarche ?? 0), 0),
  };
}

export interface IndicateurSante {
  /** `null` quand aucun chantier n'est suivi : une moyenne de rien n'est pas 0. */
  moyenne: number | null;
  repartition: Record<NiveauSante, number>;
}

export function indicateurSante(lignes: LigneChantier[]): IndicateurSante {
  const suivis = chantiersSuivis(lignes);
  const repartition: Record<NiveauSante, number> = { BON: 0, VIGILANCE: 0, CRITIQUE: 0 };
  for (const ligne of suivis) repartition[niveauSante(ligne.indiceSante)] += 1;

  const moyenne =
    suivis.length === 0
      ? null
      : Math.round(suivis.reduce((total, ligne) => total + ligne.indiceSante, 0) / suivis.length);

  return { moyenne, repartition };
}

export interface IndicateurBudget {
  /** En centimes, sur les seuls chantiers dont le budget est défini. */
  budgetTotal: number;
  consommeTotal: number;
  /** `null` quand aucun budget n'est défini. */
  tauxConsommation: number | null;
  depassements: number;
  enAlerte: number;
}

export function indicateurBudget(lignes: LigneChantier[]): IndicateurBudget {
  const budgetes = chantiersSuivis(lignes).filter((ligne) => ligne.budgetInitial !== null);
  const budgetTotal = budgetes.reduce((total, ligne) => total + (ligne.budgetInitial ?? 0), 0);
  const consommeTotal = budgetes.reduce((total, ligne) => total + ligne.budgetConsomme, 0);
  const niveaux = budgetes.map((ligne) =>
    niveauBudget(ratioConsommationBudget(ligne.budgetInitial, ligne.budgetConsomme)),
  );

  return {
    budgetTotal,
    consommeTotal,
    tauxConsommation: ratioConsommationBudget(budgetTotal || null, consommeTotal),
    depassements: niveaux.filter((niveau) => niveau === "depassement").length,
    enAlerte: niveaux.filter((niveau) => niveau === "alerte").length,
  };
}

export interface IndicateurMarge {
  /** La marge prévisionnelle pondérée par les marchés, en %. `null` sans données. */
  taux: number | null;
  /** La même, en centimes. */
  montant: number;
  negatives: number;
}

/**
 * La rentabilité globale — CDC module 12, « marge brute de l'entreprise sur
 * tous les chantiers ».
 *
 * **Pondérée par le marché**, et non une moyenne des pourcentages : un
 * chantier à 20 % sur 50 M FCFA ne compense pas un chantier à -5 % sur
 * 1 Md FCFA, et une moyenne simple dirait le contraire.
 */
export function indicateurMarge(lignes: LigneChantier[]): IndicateurMarge {
  const renseignes = chantiersSuivis(lignes).filter(
    (ligne) => ligne.montantMarche !== null && ligne.margePrevisionnelle !== null,
  );
  const marches = renseignes.reduce((total, ligne) => total + (ligne.montantMarche ?? 0), 0);
  const montant = Math.round(
    renseignes.reduce(
      (total, ligne) => total + ((ligne.montantMarche ?? 0) * (ligne.margePrevisionnelle ?? 0)) / 100,
      0,
    ),
  );

  return {
    taux: marches === 0 ? null : Math.round((montant / marches) * 1000) / 10,
    montant,
    negatives: renseignes.filter((ligne) => (ligne.margePrevisionnelle ?? 0) < 0).length,
  };
}

/**
 * Le niveau de chaque indicateur, **réglé sur le pire cas** : une tuile budget
 * reste orange tant qu'un chantier est en alerte, même si le total consommé
 * paraît sain — une moyenne qui rassure est précisément ce qui cache le
 * chantier qui dérive. `null` quand l'indicateur n'a pas de donnée.
 */
export interface NiveauxIndicateurs {
  sante: NiveauSante | null;
  budget: NiveauSante | null;
  marge: NiveauSante | null;
}

export function niveauxIndicateurs(
  sante: IndicateurSante,
  budget: IndicateurBudget,
  marge: IndicateurMarge,
): NiveauxIndicateurs {
  const niveauBudgetGlobal = niveauBudget(budget.tauxConsommation);

  return {
    sante:
      sante.moyenne === null
        ? null
        : sante.repartition.CRITIQUE > 0
          ? "CRITIQUE"
          : niveauSante(sante.moyenne),
    budget:
      budget.tauxConsommation === null
        ? null
        : budget.depassements > 0 || niveauBudgetGlobal === "depassement"
          ? "CRITIQUE"
          : budget.enAlerte > 0 || niveauBudgetGlobal === "alerte"
            ? "VIGILANCE"
            : "BON",
    marge:
      marge.taux === null
        ? null
        : marge.taux < 0
          ? "CRITIQUE"
          : marge.negatives > 0
            ? "VIGILANCE"
            : "BON",
  };
}

/* ------------------------------------------------------------------ *
 * La synthèse de trente secondes — CDC §1.3.
 * ------------------------------------------------------------------ */

export interface SyntheseDirection {
  actifs: number;
  critiques: number;
  aValider: number;
  alertesCritiques: number;
}

export function syntheseDirection(tdb: TableauDeBord): SyntheseDirection {
  return {
    actifs: chantiersSuivis(tdb.chantiers).filter(estActif).length,
    critiques: indicateurSante(tdb.chantiers).repartition.CRITIQUE,
    aValider: tdb.validations.length,
    alertesCritiques: tdb.alertes.filter((alerte) => alerte.gravite === "CRITIQUE").length,
  };
}

/* ------------------------------------------------------------------ *
 * Le graphique budget prévu / dépensé.
 * ------------------------------------------------------------------ */

export interface PointBudget {
  id: string;
  nom: string;
  prevu: number;
  consomme: number;
}

/** Un point par chantier suivi dont le budget est défini, dans l'ordre de criticité. */
export function pointsBudget(lignes: LigneChantier[]): PointBudget[] {
  return trierParCriticite(chantiersSuivis(lignes))
    .filter((ligne) => ligne.budgetInitial !== null)
    .map((ligne) => ({
      id: ligne.id,
      nom: ligne.nom,
      prevu: ligne.budgetInitial ?? 0,
      consomme: ligne.budgetConsomme,
    }));
}

/* ------------------------------------------------------------------ *
 * Validations, alertes, échéances.
 * ------------------------------------------------------------------ */

/** Le montant total qui attend la signature du DG, en centimes. */
export function montantAValider(validations: ElementAValider[]): number {
  return validations.reduce((total, element) => total + element.montant, 0);
}

/** Le tableau de bord une fois un élément validé : il quitte la file. */
export function apresValidation(tdb: TableauDeBord, id: string): TableauDeBord {
  return { ...tdb, validations: tdb.validations.filter((element) => element.id !== id) };
}

const RANG_GRAVITE: Record<GraviteAlerte, number> = { CRITIQUE: 0, ATTENTION: 1 };

/** Les critiques d'abord, puis les plus récentes. */
export function trierAlertes(alertes: AlertePilotage[]): AlertePilotage[] {
  return [...alertes].sort(
    (a, b) =>
      RANG_GRAVITE[a.gravite] - RANG_GRAVITE[b.gravite] ||
      b.survenueLe.localeCompare(a.survenueLe),
  );
}

const MS_PAR_JOUR = 86_400_000;

/** Le nombre de jours calendaires d'aujourd'hui à une date ISO. Négatif si elle est passée. */
export function joursAvant(dateIso: string, maintenant: Date = new Date()): number {
  const cible = new Date(`${dateIso.slice(0, 10)}T00:00:00`);
  const jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  return Math.round((cible.getTime() - jour.getTime()) / MS_PAR_JOUR);
}

/** L'horizon des échéances affichées : un mois, soit une situation de travaux. */
export const HORIZON_ECHEANCES_JOURS = 30;

/** Les échéances des trente prochains jours, la plus proche en tête. */
export function echeancesAVenir(echeances: Echeance[], maintenant: Date = new Date()): Echeance[] {
  return echeances
    .filter((echeance) => {
      const jours = joursAvant(echeance.date, maintenant);
      return jours >= 0 && jours <= HORIZON_ECHEANCES_JOURS;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** En deçà, une échéance est proche et se signale. */
export const ECHEANCE_PROCHE_JOURS = 7;

/* ------------------------------------------------------------------ *
 * L'export du rapport de direction.
 * ------------------------------------------------------------------ */

/**
 * Les valeurs brutes d'une ligne du portefeuille exporté, dans l'ordre des
 * en-têtes que l'écran fournit traduits. Les montants sortent **en francs**,
 * sans séparateur : c'est un tableur qui les relira, pas un humain.
 */
export function valeursExportPortefeuille(ligne: LigneChantier): (string | number)[] {
  const francs = (centimes: number | null) => (centimes === null ? "" : Math.round(centimes / 100));
  return [
    ligne.reference,
    ligne.nom,
    ligne.clientNom,
    ligne.ville,
    ligne.chefProjetNom,
    ligne.statut,
    ligne.avancementReel,
    ligne.avancementTheorique,
    francs(ligne.budgetInitial),
    francs(ligne.budgetConsomme),
    francs(ligne.montantMarche),
    ligne.margePrevisionnelle ?? "",
    ligne.dateFinPrevue ?? "",
    ligne.indiceSante,
  ];
}

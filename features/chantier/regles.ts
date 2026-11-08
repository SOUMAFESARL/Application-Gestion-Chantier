/**
 * Les règles pures du journal de chantier — ni React, ni HTTP.
 *
 * Tout ce que les écrans du journal comptent, trient ou déduisent passe par ici :
 * fenêtre de saisie sur jours ouvrés, étapes de circuit par permission
 * (`REDACTION` → `VALIDATION` → `APPROBATION`), avancement des feuilles selon
 * leurs trois modes de mesure (`QUANTITE`, `POURCENTAGE`, `JALON`), pointage
 * nominatif par équipe et alertes immédiates.
 *
 * **Les dates sont des jours `AAAA-MM-JJ`, lus en UTC** : un jour de journal
 * est un jour de chantier, pas un instant horaire.
 */

import type { ConditionMeteo } from "@/features/projets/types";

import type {
  ActivitePreparee,
  ActiviteSaisie,
  AlerteImmediate,
  EntreeJournal,
  EtapeCircuit,
  EtapeSignable,
  IncidentSynthese,
  LigneActivite,
  LigneEffectif,
  LigneMateriau,
  LotJournal,
  MateriauDisponible,
  Meteo,
  NatureEvenement,
  NiveauBlocage,
  ObjectifSuivant,
  PointLot,
  PreparationSaisie,
  PresenceEquipeRapport,
  RapportDuJour,
  RapportEnAttente,
  RapportJournalier,
  RedactionSynthese,
  RoleSignataire,
  SaisieRapport,
  SectionSaisie,
  SituationRapport,
  StatutRapport,
  StatutSynthese,
  SynthesePeriodique,
  TypeIncident,
  TypePeriode,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les constantes du circuit.
 * ------------------------------------------------------------------ */

/** L'heure à laquelle un chantier sans rapport déclenche la relance automatique du rédacteur. */
export const HEURE_ALERTE_NON_SOUMIS = "17:30";
/** L'heure à laquelle les validateurs et approbateurs sont alertés à leur tour. */
export const HEURE_ESCALADE = "18:00";
/** Chaque étape de validation dispose de 24 h. */
export const DELAI_VALIDATION_HEURES = 24;
/** Alias conservé pour compatibilité interne. */
export const DELAI_VALIDATION_CT_HEURES = DELAI_VALIDATION_HEURES;
/** La note d'un rejet doit dire pourquoi : 20 caractères au moins. */
export const LONGUEUR_MIN_COMMENTAIRE_REJET = 20;
/** La cible de présence des équipes sur le chantier. */
export const CIBLE_PRESENCE = 92;

/* ------------------------------------------------------------------ *
 * Les jours et périodes.
 * ------------------------------------------------------------------ */

function versDateUtc(jour: string): Date {
  return new Date(`${jour.slice(0, 10)}T00:00:00Z`);
}

function versJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Le jour courant du poste, au format `AAAA-MM-JJ`. */
export function jourDe(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mois}-${jour}`;
}

export function ajouterJours(jour: string, nombre: number): string {
  const date = versDateUtc(jour);
  date.setUTCDate(date.getUTCDate() + nombre);
  return versJour(date);
}

/** 0 = dimanche … 6 = samedi. */
export function jourDeSemaine(jour: string): number {
  return versDateUtc(jour).getUTCDay();
}

/** Repli local lundi–vendredi lorsque le calendrier serveur n'est pas fourni. */
export function estJourOuvre(jour: string): boolean {
  const rang = jourDeSemaine(jour);
  return rang >= 1 && rang <= 5;
}

/** Les jours ouvrés de repli entre `debut` et `fin`, bornes comprises. */
export function joursOuvres(debut: string, fin: string): string[] {
  const jours: string[] = [];
  for (let jour = debut; jour <= fin; jour = ajouterJours(jour, 1)) {
    if (estJourOuvre(jour)) jours.push(jour);
  }
  return jours;
}

/** Le `nombre`-ième jour ouvré avant `jour` (0 : `jour` lui-même s'il est ouvré, sinon le précédent). */
export function jourOuvreAvant(jour: string, nombre: number): string {
  let courant = jour;
  while (!estJourOuvre(courant)) courant = ajouterJours(courant, -1);
  for (let reste = nombre; reste > 0; ) {
    courant = ajouterJours(courant, -1);
    if (estJourOuvre(courant)) reste -= 1;
  }
  return courant;
}

/** Le numéro de semaine ISO 8601 — la « S22 » des synthèses. */
export function numeroSemaine(jour: string): number {
  const date = versDateUtc(jour);
  const rang = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - rang);
  const debutAnnee = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - debutAnnee) / 86_400_000 + 1) / 7);
}

export interface Periode {
  type: TypePeriode;
  debut: string;
  fin: string;
}

/**
 * La semaine qui contient `jour` : du lundi au dimanche, comme l'exige le backend
 * (`DemandeSyntheseSerializer`). La période est calendaire ; ce que la synthèse en retient,
 * ce sont les jours ouvrés du calendrier de l'entreprise (lundi-vendredi par défaut, samedi
 * si elle l'ouvre) — c'est le backend qui les compte.
 */
export function semaineDe(jour: string): Periode {
  const rang = jourDeSemaine(jour) || 7;
  const lundi = ajouterJours(jour, 1 - rang);
  return { type: "HEBDOMADAIRE", debut: lundi, fin: ajouterJours(lundi, 6) };
}

/** Le mois civil qui contient `jour`. */
export function moisDe(jour: string): Periode {
  const date = versDateUtc(jour);
  const debut = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const fin = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { type: "MENSUELLE", debut: versJour(debut), fin: versJour(fin) };
}

/** Les `nombre` dernières semaines, la courante en tête. */
export function semainesRecentes(aujourdhui: string, nombre: number): Periode[] {
  return Array.from({ length: nombre }, (_, rang) => semaineDe(ajouterJours(aujourdhui, -7 * rang)));
}

/** Les `nombre` derniers mois, le courant en tête. */
export function moisRecents(aujourdhui: string, nombre: number): Periode[] {
  const periodes: Periode[] = [];
  let courant = moisDe(aujourdhui);
  for (let rang = 0; rang < nombre; rang += 1) {
    periodes.push(courant);
    courant = moisDe(ajouterJours(courant.debut, -1));
  }
  return periodes;
}

/** Une période est close quand son dernier jour est passé. */
export function periodeClose(periode: Pick<Periode, "fin">, aujourdhui: string): boolean {
  return periode.fin < aujourdhui;
}

/** Une période se demande début avant fin, et ne commence pas dans le futur. */
export function periodeValide(debut: string, fin: string, aujourdhui: string): boolean {
  return Boolean(debut) && Boolean(fin) && debut <= fin && debut <= aujourdhui;
}

/* ------------------------------------------------------------------ *
 * Les situations.
 * ------------------------------------------------------------------ */

/** Un rapport a été remis au circuit — même s'il a été rejeté depuis. */
export function estDepose(situation: SituationRapport): boolean {
  return situation !== "NON_SOUMIS";
}

/** Seuls les rapports validés ou approuvés alimentent les chiffres consolidés. */
export function estValide(situation: SituationRapport): boolean {
  return situation === "VALIDE" || situation === "APPROUVE";
}

/** Un rapport qui manque au soir : jamais commencé, ou resté en brouillon. */
export function estManquant(situation: SituationRapport): boolean {
  return situation === "NON_SOUMIS";
}

/** Un rapport consultable : il en existe un document. */
export function aUnDocument(entree: EntreeJournal): boolean {
  return entree.reference !== null && entree.situation !== "NON_SOUMIS";
}

/** L'ordre de lecture d'une journée : d'abord ce qui manque, puis ce qui attend, enfin ce qui est clos. */
const ORDRE_SITUATION: Record<SituationRapport, number> = {
  NON_SOUMIS: 0,
  REJETE: 1,
  SOUMIS: 2,
  VALIDE: 3,
  APPROUVE: 4,
};

export function comparerSituations(a: EntreeJournal, b: EntreeJournal): number {
  return (
    ORDRE_SITUATION[a.situation] - ORDRE_SITUATION[b.situation] ||
    a.chantier.projetNom.localeCompare(b.chantier.projetNom)
  );
}

/* ------------------------------------------------------------------ *
 * Le circuit de validation.
 * ------------------------------------------------------------------ */

/** L'étape qui bloque le circuit, s'il y en a une. */
export function etapeEnAttente(circuit: EtapeCircuit[]): EtapeCircuit | null {
  return circuit.find((etape) => etape.etat === "EN_ATTENTE") ?? null;
}

/** L'étape en attente a dépassé son échéance. */
export function estHorsDelai(circuit: EtapeCircuit[], maintenant: Date): boolean {
  const etape = etapeEnAttente(circuit);
  return Boolean(etape?.echeance && new Date(etape.echeance).getTime() < maintenant.getTime());
}

export interface ValidationEnAttente {
  entree: EntreeJournal;
  etape: EtapeCircuit;
  horsDelai: boolean;
}

/**
 * Les rapports déposés qui attendent une signature (`VALIDATION` ou `APPROBATION`),
 * rangés par urgence : les hors délai d'abord, puis par échéance.
 */
export function validationsEnAttente(
  entrees: EntreeJournal[],
  maintenant: Date,
): ValidationEnAttente[] {
  return entrees
    .filter((entree) => entree.situation === "SOUMIS" || entree.situation === "VALIDE")
    .flatMap((entree) => {
      const etape = etapeEnAttente(entree.circuit);
      return etape ? [{ entree, etape, horsDelai: estHorsDelai(entree.circuit, maintenant) }] : [];
    })
    .sort(
      (a, b) =>
        Number(b.horsDelai) - Number(a.horsDelai) ||
        (a.etape.echeance ?? "").localeCompare(b.etape.echeance ?? ""),
    );
}

/** Les rapports rejetés, en attente de correction par le rédacteur. */
export function rapportsRejetes(entrees: EntreeJournal[]): EntreeJournal[] {
  return entrees
    .filter((entree) => entree.situation === "REJETE")
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* ------------------------------------------------------------------ *
 * La journée et la période.
 * ------------------------------------------------------------------ */

export interface SituationJour {
  attendus: number;
  deposes: number;
  manquants: number;
  enAttenteValidation: number;
  enAttenteApprobation: number;
  approuves: number;
  rejetes: number;
  chantiers: number;
  /** Part des rapports attendus déjà déposés, en % ; `null` sans attente. */
  taux: number | null;
}

export function situationDuJour(entrees: EntreeJournal[], jour: string): SituationJour {
  const duJour = entrees.filter((entree) => entree.date === jour);
  const compter = (situation: SituationRapport) =>
    duJour.filter((entree) => entree.situation === situation).length;
  const deposes = duJour.filter((entree) => estDepose(entree.situation)).length;
  return {
    attendus: duJour.length,
    deposes,
    manquants: duJour.filter((entree) => estManquant(entree.situation)).length,
    enAttenteValidation: compter("SOUMIS"),
    enAttenteApprobation: compter("VALIDE"),
    approuves: compter("APPROUVE"),
    rejetes: compter("REJETE"),
    chantiers: new Set(duJour.map((entree) => entree.chantier.projetId)).size,
    taux: pourcentage(deposes, duJour.length),
  };
}

export interface TauxSoumission {
  deposes: number;
  attendus: number;
  taux: number | null;
}

/** Le taux de remise des rapports sur les `jours` ouvrés qui finissent à `aujourdhui`. */
export function tauxSoumission(
  entrees: EntreeJournal[],
  aujourdhui: string,
  jours: number,
): TauxSoumission {
  const debut = jourOuvreAvant(aujourdhui, jours - 1);
  const periode = entrees.filter((entree) => entree.date >= debut && entree.date <= aujourdhui);
  const deposes = periode.filter((entree) => estDepose(entree.situation)).length;
  return { deposes, attendus: periode.length, taux: pourcentage(deposes, periode.length) };
}

/** Le nombre de jours ouvrés écoulés depuis le dernier rapport d'un chantier. */
export function joursSansRapport(entree: EntreeJournal): number | null {
  if (!entree.dernierRapportLe) return null;
  return Math.max(0, joursOuvres(ajouterJours(entree.dernierRapportLe, 1), entree.date).length);
}

/* ------------------------------------------------------------------ *
 * L'historique.
 * ------------------------------------------------------------------ */

export type FenetreHistorique = "SEMAINE" | "MOIS" | "TOUT";

export interface CriteresJournal {
  recherche: string;
  projetId: string;
  situation: SituationRapport | "";
  fenetre: FenetreHistorique;
}

export const CRITERES_JOURNAL_INITIAUX: CriteresJournal = {
  recherche: "",
  projetId: "",
  situation: "",
  fenetre: "MOIS",
};

function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Le premier jour couvert par une fenêtre d'historique. */
export function debutFenetre(fenetre: FenetreHistorique, aujourdhui: string): string | null {
  if (fenetre === "SEMAINE") return ajouterJours(aujourdhui, -6);
  if (fenetre === "MOIS") return ajouterJours(aujourdhui, -29);
  return null;
}

/** Les lignes de l'historique, filtrées puis rangées de la plus récente à la plus ancienne. */
export function filtrerEntrees(
  entrees: EntreeJournal[],
  criteres: CriteresJournal,
  aujourdhui: string,
): EntreeJournal[] {
  const recherche = normaliser(criteres.recherche);
  const debut = debutFenetre(criteres.fenetre, aujourdhui);
  return entrees
    .filter((entree) => !criteres.projetId || entree.chantier.projetId === criteres.projetId)
    .filter((entree) => !criteres.situation || entree.situation === criteres.situation)
    .filter((entree) => !debut || entree.date >= debut)
    .filter(
      (entree) =>
        !recherche ||
        normaliser(
          [
            entree.reference ?? "",
            entree.chantier.projetNom,
            entree.chantier.projetReference,
            entree.chantier.redacteur,
            ...entree.lots.flatMap((lot) => [lot.code, lot.nom]),
          ].join(" "),
        ).includes(recherche),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || a.chantier.projetNom.localeCompare(b.chantier.projetNom),
    );
}

export function criteresActifs(criteres: CriteresJournal): boolean {
  return (
    criteres.recherche.trim() !== "" ||
    criteres.projetId !== "" ||
    criteres.situation !== "" ||
    criteres.fenetre !== CRITERES_JOURNAL_INITIAUX.fenetre
  );
}

/* ------------------------------------------------------------------ *
 * Les calculs d'un rapport.
 * ------------------------------------------------------------------ */

function pourcentage(partie: number, total: number): number | null {
  return total > 0 ? Math.round((partie / total) * 100) : null;
}

export function tauxPresence(presents: number | null, prevus: number | null): number | null {
  if (presents === null || prevus === null) return null;
  return pourcentage(presents, prevus);
}

/** Le retard d'un chantier ou d'un lot sur son planning, en points (positif : en retard). */
export function retardPoints(entree: {
  avancement: number | null;
  avancementTheorique: number | null;
}): number | null {
  if (entree.avancement === null || entree.avancementTheorique === null) return null;
  return Math.round(entree.avancementTheorique - entree.avancement);
}

/** Les codes des lots couverts par un rapport, dans l'ordre : `L-03 · L-04`. */
export function codesLots(lots: Pick<LotJournal, "code">[]): string {
  return lots.map((lot) => lot.code).join(" · ");
}

/** Le mode d'exécution d'un lot en toutes lettres : celui du référentiel, sinon le mode de base. */
export function libelleModeLot(
  lot: Pick<LotJournal, "modeExecution" | "modeExecutionLibelle">,
  libelleBase: (mode: LotJournal["modeExecution"]) => string,
): string {
  return lot.modeExecutionLibelle || libelleBase(lot.modeExecution);
}

export interface TotauxEffectifs {
  prevus: number;
  presents: number;
  absents: number;
  heures: number;
  taux: number | null;
}

export function totauxEffectifs(lignes: LigneEffectif[]): TotauxEffectifs {
  const prevus = lignes.reduce((total, ligne) => total + ligne.prevus, 0);
  const presents = lignes.reduce((total, ligne) => total + ligne.presents, 0);
  return {
    prevus,
    presents,
    absents: prevus - presents,
    heures: lignes.reduce((total, ligne) => total + ligne.heures, 0),
    taux: pourcentage(presents, prevus),
  };
}

/** Totaux de présence calculés sur les équipes nominatives d'un rapport. */
export function totauxEquipes(equipes: PresenceEquipeRapport[]): TotauxEffectifs {
  const prevus = equipes.reduce((total, equipe) => total + equipe.membres, 0);
  const presents = equipes.reduce((total, equipe) => total + equipe.presents.length, 0);
  const absents = equipes.reduce((total, equipe) => total + equipe.absents.length, 0);
  const heures = equipes.reduce(
    (total, equipe) => total + equipe.presents.length * (equipe.heures ?? 0),
    0,
  );
  return {
    prevus,
    presents,
    absents,
    heures: Math.round(heures * 10) / 10,
    taux: pourcentage(presents, prevus),
  };
}

/** La présence est acceptable à partir de 85 %, bonne à partir de la cible. */
export function presenceSuffisante(
  taux: number | null,
): "BONNE" | "ACCEPTABLE" | "INSUFFISANTE" | null {
  if (taux === null) return null;
  if (taux >= CIBLE_PRESENCE) return "BONNE";
  if (taux >= 85) return "ACCEPTABLE";
  return "INSUFFISANTE";
}

export function cumulActivite(ligne: LigneActivite): number {
  return Math.round((ligne.cumulVeille + ligne.quantiteJour) * 1000) / 1000;
}

export function avancementActivite(ligne: LigneActivite): number {
  if (ligne.modeMesure === "POURCENTAGE") {
    return Math.min(100, Math.max(0, Math.round(ligne.pourcentageJour ?? ligne.pourcentageVeille)));
  }
  if (ligne.modeMesure === "JALON") {
    return ligne.jalonAtteint ? 100 : 0;
  }
  return ligne.quantitePrevue > 0
    ? Math.min(100, Math.round((cumulActivite(ligne) / ligne.quantitePrevue) * 100))
    : 0;
}

export function activiteAvanceeCeJour(ligne: LigneActivite): boolean {
  if (ligne.modeMesure === "POURCENTAGE") {
    return ligne.pourcentageJour !== null && ligne.pourcentageJour > ligne.pourcentageVeille;
  }
  if (ligne.modeMesure === "JALON") {
    return ligne.jalonAtteint;
  }
  return ligne.quantiteJour > 0;
}

/** `null` : un matériau saisi librement, dont le stock n'est pas suivi. */
export function stockFin(ligne: Pick<LigneMateriau, "stockDebut" | "livre" | "utilise">): number | null {
  return ligne.stockDebut === null ? null : ligne.stockDebut + ligne.livre - ligne.utilise;
}

/** Un stock passe en alerte à son seuil, pas en dessous. Sans stock suivi, pas d'alerte. */
export function enAlerteStock(stock: number | null, seuil: number | null): boolean {
  return stock !== null && seuil !== null && stock <= seuil;
}

/** Les activités qui avancent ce jour, tous modes de mesure confondus. */
export function activitesActives(lignes: LigneActivite[]): number {
  return lignes.filter(activiteAvanceeCeJour).length;
}

/** Toutes les activités d'un rapport, lots confondus. */
export function activitesDuRapport(rapport: Pick<RapportJournalier, "travaux">): LigneActivite[] {
  return rapport.travaux.flatMap((travaux) => travaux.activites);
}

/* ------------------------------------------------------------------ *
 * La synthèse périodique.
 * ------------------------------------------------------------------ */

function arrondi(valeur: number, decimales = 0): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

/** Une appréciation signée doit dire quelque chose : 20 caractères au moins. */
export const LONGUEUR_MIN_APPRECIATION = 20;

/**
 * L'étape attendue sur une synthèse périodique : `VALIDATION` tant que la
 * rédaction n'est pas signée (ou après rejet), `APPROBATION` une fois soumise.
 */
export function etapeSynthese(statut: StatutSynthese): EtapeSignable | null {
  if (statut === "A_REDIGER" || statut === "BROUILLON" || statut === "REJETEE") return "VALIDATION";
  if (statut === "SOUMISE") return "APPROBATION";
  return null;
}

/** Un objectif de la période suivante dit quoi, combien, et jusqu'où (0 à 100 %). */
export function objectifComplet(objectif: ObjectifSuivant): boolean {
  return (
    objectif.activite.trim() !== "" &&
    objectif.objectif.trim() !== "" &&
    Number.isFinite(objectif.cible) &&
    objectif.cible >= 0 &&
    objectif.cible <= 100
  );
}

export function redactionEnregistrable(redaction: RedactionSynthese): boolean {
  return redaction.objectifs.every(objectifComplet);
}

export function redactionSignable(redaction: RedactionSynthese): boolean {
  return (
    redactionEnregistrable(redaction) &&
    redaction.appreciation.trim().length >= LONGUEUR_MIN_APPRECIATION
  );
}

/** L'écart d'un gain à son objectif, en points. */
export function ecartObjectif(gain: number, objectif: number): number {
  return arrondi(gain - objectif);
}

/** Les rapports manquants qui expliquent une synthèse incomplète. */
export function rapportsManquants(
  synthese: Pick<SynthesePeriodique, "recapitulatif">,
): EntreeJournal[] {
  return synthese.recapitulatif.filter((entree) => estManquant(entree.situation));
}

export function incidentsResolus(incidents: IncidentSynthese[]): number {
  return incidents.filter((incident) => incident.resolu).length;
}

/* ------------------------------------------------------------------ *
 * Les indicateurs d'un chantier, pour sa fiche projet (F1 §9.4).
 * ------------------------------------------------------------------ */

/** La fenêtre du taux de soumission : les 7 derniers jours ouvrés. */
export const FENETRE_SOUMISSION_JOURS = 7;

export interface IndicateursJournalProjet {
  soumission: TauxSoumission;
  /** Sur tout le journal lu (neuf semaines). */
  incidents: number;
  blocages: number;
}

/** Ce que le journal dit d'un chantier : rapports remis, incidents, blocages. */
export function indicateursJournalProjet(
  entrees: EntreeJournal[],
  projetId: string,
  aujourdhui: string,
): IndicateursJournalProjet {
  const duProjet = entrees.filter((entree) => entree.chantier.projetId === projetId);
  return {
    soumission: tauxSoumission(duProjet, aujourdhui, FENETRE_SOUMISSION_JOURS),
    incidents: duProjet.reduce((somme, entree) => somme + (entree.incidents ?? 0), 0),
    blocages: duProjet.reduce((somme, entree) => somme + (entree.blocages ?? 0), 0),
  };
}

/* ------------------------------------------------------------------ *
 * La saisie du rapport journalier.
 * ------------------------------------------------------------------ */

/** Un rapport se rédige sur les 3 derniers jours ouvrés de l'entreprise (`J`, `J-1`, `J-2`). */
export const JOURS_RETROACTIFS_SAISIE = 2;
export const PHOTOS_MAX = 10;
export const PIECES_JOINTES_MAX = 3;
export const TAILLE_MAX_PIECE_JOINTE = 5 * 1024 * 1024;
export const EXTENSIONS_DOCUMENT: readonly string[] = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];

export function estDocumentAccepte(nomFichier: string): boolean {
  const nom = nomFichier.toLowerCase();
  return EXTENSIONS_DOCUMENT.some((extension) => nom.endsWith(extension));
}

export type FormatDocument = "PDF" | "WORD" | "EXCEL" | "AUTRE";

export function formatDocument(nomFichier: string): FormatDocument {
  const nom = nomFichier.toLowerCase();
  if (nom.endsWith(".pdf")) return "PDF";
  if (nom.endsWith(".doc") || nom.endsWith(".docx")) return "WORD";
  if (nom.endsWith(".xls") || nom.endsWith(".xlsx")) return "EXCEL";
  return "AUTRE";
}

export function tailleKo(octets: number): number {
  return Math.ceil(octets / 1024);
}

export const LONGUEUR_MIN_NOTE = 10;
export const LONGUEUR_MIN_DESCRIPTION_INCIDENT = 20;
export const SEUIL_ALERTE_PRESENCE = 60;
export const INTERVALLE_SAUVEGARDE_MS = 30_000;
export const HEURES_MAX_JOUR = 24;

/** Le ciel du rapport d'après le relevé météo du chantier — pour préremplir, jamais pour imposer. */
export function cielDepuisReleve(condition: ConditionMeteo | string | null): Meteo | null {
  switch (condition) {
    case "DEGAGE":
    case "ECLAIRCIES":
      return "ENSOLEILLE";
    case "NUAGEUX":
    case "COUVERT":
    case "VARIABLE":
      return "NUAGEUX";
    case "BROUILLARD":
      return "BRUMEUX";
    case "BRUINE":
    case "PLUIE":
    case "AVERSES":
      return "PLUVIEUX";
    case "ORAGE":
      return "ORAGEUX";
    default:
      return null;
  }
}

/**
 * Les jours ouvrés saisissables (`J`, `J-1`, `J-2`), tels que calculés par le
 * calendrier d'entreprise côté serveur — et, pour un chantier, resserrés à son premier jour de
 * rapport. La réponse du serveur fait loi, **même vide** (chantier qui n'a pas encore commencé) :
 * le repli local sur les 3 derniers jours ouvrés ne sert qu'avant que le serveur ait répondu.
 */
export function joursSaisissables(aujourdhui: string, joursServeur?: string[]): string[] {
  if (joursServeur) return joursServeur;
  return Array.from({ length: JOURS_RETROACTIFS_SAISIE + 1 }, (_, rang) =>
    jourOuvreAvant(aujourdhui, rang),
  );
}

export function jourSaisissable(
  jour: string,
  aujourdhui: string,
  joursServeur?: string[],
): boolean {
  return joursSaisissables(aujourdhui, joursServeur).includes(jour);
}

/**
 * Les rapports qu'un chantier attend encore de son rédacteur, du plus récent
 * au plus ancien : les jours ouvrés sans rapport, les brouillons et les rejets.
 *
 * - Si `aujourdhui` est un jour non ouvré d'après le calendrier d'entreprise,
 *   aucun rapport n'est attendu ce jour-là (sauf si un brouillon ou rejet existe).
 * - Un rapport `REJETE` demeure toujours corrigeable et resoumettable (`redigeable: true`),
 *   même au-delà de la fenêtre `J-2`.
 */
export function rapportsEnAttente(
  debut: string | null,
  aujourdhui: string,
  rapports: RapportDuJour[],
  options?: { estJourOuvreAujourdhui?: boolean; joursSaisissables?: string[] },
): RapportEnAttente[] {
  const parJour = new Map(rapports.map((rapport) => [rapport.date, rapport]));
  const fenetre = joursSaisissables(aujourdhui, options?.joursSaisissables);
  const premier = debut && debut <= aujourdhui ? debut : (fenetre.at(-1) ?? aujourdhui);
  const attendusOuvres = joursOuvres(premier, aujourdhui).filter(
    (jour) => !(jour === aujourdhui && options?.estJourOuvreAujourdhui === false),
  );
  for (const jourServeur of fenetre) {
    if (jourServeur >= premier && jourServeur <= aujourdhui) attendusOuvres.push(jourServeur);
  }
  const jours = new Set([
    ...attendusOuvres,
    ...rapports.map((rapport) => rapport.date).filter((jour) => jour <= aujourdhui),
  ]);
  return [...jours]
    .sort((a, b) => b.localeCompare(a))
    .flatMap((date): RapportEnAttente[] => {
      const rapport = parJour.get(date);
      const etat = !rapport
        ? "A_REDIGER"
        : rapport.statut === "BROUILLON" || rapport.statut === "REJETE"
          ? rapport.statut
          : null;
      if (!etat) return [];
      return [
        {
          date,
          etat,
          rapportId: rapport?.id ?? null,
          enregistreLe: rapport?.enregistreLe ?? null,
          redigeable: etat === "REJETE" || jourSaisissable(date, aujourdhui, fenetre),
        },
      ];
    });
}

/** Les brouillons d'un rédacteur, tous chantiers confondus, du plus récent au plus ancien. */
export function brouillonsEnCours<P>(
  parProjet: {
    projet: P;
    aujourdhui: string;
    joursSaisissables?: string[];
    rapports: RapportDuJour[];
  }[],
): { projet: P; rapport: RapportDuJour; redigeable: boolean }[] {
  return parProjet
    .flatMap(({ projet, aujourdhui, joursSaisissables: fenetre, rapports }) =>
      rapports
        .filter((rapport) => rapport.statut === "BROUILLON")
        .map((rapport) => ({
          projet,
          rapport,
          redigeable: jourSaisissable(rapport.date, aujourdhui, fenetre),
        })),
    )
    .sort(
      (a, b) =>
        b.rapport.date.localeCompare(a.rapport.date) ||
        b.rapport.enregistreLe.localeCompare(a.rapport.enregistreLe),
    );
}

/** Un rapport soumis ne se touche plus : seul un rejet le rend à son auteur. */
export function rapportModifiable(statut: StatutRapport | null): boolean {
  return statut === null || statut === "BROUILLON" || statut === "REJETE";
}

/**
 * Les sections actives du rapport : en journée d'arrêt, seuls les travaux
 * (`AVANCEMENT`) et le pointage (`EQUIPES`) sont écartés ; les livraisons,
 * matériels en panne, preuves photos et blocages restent saisissables.
 */
export function sectionsActives(sections: SectionSaisie[], arret: boolean): SectionSaisie[] {
  return arret
    ? sections.filter((section) => section !== "AVANCEMENT" && section !== "EQUIPES")
    : sections;
}

/** À qui remonte un blocage selon sa sévérité, par étape fonctionnelle. */
export function escaladeBlocage(niveau: NiveauBlocage): RoleSignataire | null {
  switch (niveau) {
    case "SIGNIFICATIF":
      return "VALIDATION";
    case "BLOQUANT":
      return "APPROBATION";
    default:
      return null;
  }
}

export function cleAlerte(alerte: AlerteImmediate): string {
  return alerte.cle;
}

/**
 * Les alertes immédiates issues de la saisie : blocage bloquant, incident grave
 * ou équipement critique en panne.
 */
export function alertesImmediates(
  saisie: Pick<SaisieRapport, "blocages" | "incidents" | "equipements">,
): AlerteImmediate[] {
  const alertes: AlerteImmediate[] = [];
  for (const blocage of saisie.blocages) {
    const resume = blocage.titre.trim() || blocage.description.trim();
    if (blocage.niveau === "BLOQUANT" && resume) {
      alertes.push({
        type: "BLOCAGE_BLOQUANT",
        cle: `blocage:${blocage.cle}`,
        description: resume,
      });
    }
  }
  for (const incident of saisie.incidents) {
    if (incident.gravite === "GRAVE" && incident.description.trim()) {
      alertes.push({
        type: "INCIDENT_GRAVE",
        cle: `incident:${incident.cle}`,
        description: incident.description.trim(),
      });
    }
  }
  for (const equipement of saisie.equipements) {
    if (equipement.etat === "PANNE" && (equipement.designation.trim() || equipement.observation.trim())) {
      const description = equipement.observation.trim()
        ? `${equipement.designation.trim()} — ${equipement.observation.trim()}`
        : equipement.designation.trim();
      alertes.push({
        type: "EQUIPEMENT_PANNE",
        cle: `equipement:${equipement.cle}`,
        description,
      });
    }
  }
  return alertes;
}

/** Catégorie HSE / qualité déduite de la nature de l'événement. */
export function categorieEvenement(
  nature: NatureEvenement,
  choisie: TypeIncident | "",
): TypeIncident {
  switch (nature) {
    case "INCIDENT_SECURITE":
      return "SECURITE";
    case "INCIDENT_MATERIEL":
      return "MATERIEL";
    case "DIFFICULTE_TECHNIQUE":
    case "NON_CONFORMITE":
      return "QUALITE";
    case "VISITE_INSTRUCTION":
    case "EVENEMENT_PARTICULIER":
      return choisie || "ADMINISTRATIF";
  }
}

/* ------------------------------------------------------------------ *
 * Les feuilles de l'arbre en cours de saisie (3 modes de mesure).
 * ------------------------------------------------------------------ */

export interface MesureFeuilleSaisie {
  quantiteJour: number | null;
  pourcentageJour: number | null;
  jalonAtteint: boolean;
}

/** Le cumul en quantité d'une feuille au soir. */
export function cumulSaisi(activite: ActivitePreparee, quantiteJour: number | null): number {
  return Math.round((activite.cumulVeille + (quantiteJour ?? 0)) * 1000) / 1000;
}

export function feuilleAvanceeSaisie(
  activite: ActivitePreparee,
  mesure: MesureFeuilleSaisie | null | undefined,
): boolean {
  if (!mesure) return false;
  if (activite.modeMesure === "POURCENTAGE") {
    return mesure.pourcentageJour !== null && mesure.pourcentageJour > activite.pourcentageVeille;
  }
  if (activite.modeMesure === "JALON") {
    return mesure.jalonAtteint;
  }
  return (mesure.quantiteJour ?? 0) > 0;
}

export function avancementSaisi(
  activite: ActivitePreparee,
  mesure?: MesureFeuilleSaisie | null,
): number {
  if (activite.modeMesure === "POURCENTAGE") {
    const pct = mesure?.pourcentageJour ?? activite.pourcentageVeille;
    return Math.min(100, Math.max(0, Math.round(pct)));
  }
  if (activite.modeMesure === "JALON") {
    return mesure?.jalonAtteint ? 100 : 0;
  }
  if (activite.quantitePrevue <= 0) return 0;
  return Math.min(
    100,
    Math.round((cumulSaisi(activite, mesure?.quantiteJour ?? null) / activite.quantitePrevue) * 100),
  );
}

/** La quantité du jour fait dépasser le prévu : possible (avenant, métré), mais signalé. */
export function depassePrevu(activite: ActivitePreparee, quantiteJour: number | null): boolean {
  return (
    activite.modeMesure === "QUANTITE" &&
    activite.quantitePrevue > 0 &&
    cumulSaisi(activite, quantiteJour) > activite.quantitePrevue
  );
}

/** Les groupes (lots) portant au moins une feuille ouverte dans l'arbre du projet. */
export function lotsSuivisAvancement(
  preparation: Pick<PreparationSaisie, "lots" | "activites">,
): LotJournal[] {
  const avecActivite = new Set(preparation.activites.map((activite) => activite.lotId));
  return preparation.lots.filter((lot) => avecActivite.has(lot.id));
}

/** Les lots travaillés d'un rapport existant. */
export function lotsTravaillesDe(
  saisie: Pick<SaisieRapport, "activites"> & { lotsTravailles?: PointLot[] },
  activites: ActivitePreparee[],
): PointLot[] {
  if (saisie.lotsTravailles && saisie.lotsTravailles.length > 0) return saisie.lotsTravailles;
  const lotDe = new Map(activites.map((activite) => [activite.activiteId, activite.lotId]));
  const lots = new Set(
    saisie.activites.flatMap((ligne: ActiviteSaisie) => {
      const lotId = lotDe.get(ligne.activiteId);
      return lotId ? [lotId] : [];
    }),
  );
  return [...lots].map((lotId) => ({ lotId, observation: "" }));
}

/** Les mesures du jour indexées par identifiant de feuille. */
export function mesuresDuJour(
  saisie: Pick<SaisieRapport, "activites" | "arret">,
  sections: SectionSaisie[],
): Map<string, MesureFeuilleSaisie> {
  const actives = sectionsActives(sections, saisie.arret !== null);
  const mesures = new Map<string, MesureFeuilleSaisie>();
  if (actives.includes("AVANCEMENT")) {
    for (const ligne of saisie.activites) {
      mesures.set(ligne.activiteId, {
        quantiteJour: ligne.quantiteJour,
        pourcentageJour: ligne.pourcentageJour,
        jalonAtteint: ligne.jalonAtteint,
      });
    }
  }
  return mesures;
}

export function avancementLotSaisi(
  activites: ActivitePreparee[],
  mesures: Map<string, MesureFeuilleSaisie>,
): number | null {
  if (activites.length === 0) return null;
  const total = activites.reduce(
    (somme, activite) => somme + avancementSaisi(activite, mesures.get(activite.activiteId) ?? null),
    0,
  );
  return Math.round(total / activites.length);
}

export function avancementTheoriqueLot(activites: ActivitePreparee[]): number | null {
  if (activites.length === 0) return null;
  return Math.round(
    activites.reduce((somme, activite) => somme + activite.avancementTheorique, 0) / activites.length,
  );
}

/** Unités proposées pour les matériaux consommés, livrés ou demandés. */
export const UNITES_MATERIAU: readonly string[] = [
  "sac",
  "kg",
  "t",
  "m³",
  "m²",
  "ml",
  "m",
  "L",
  "u",
  "barre",
  "rouleau",
  "paquet",
  "pot",
  "palette",
  "voyage",
];

export function unitesProposees(materiaux: Pick<MateriauDisponible, "unite">[]): string[] {
  return [...new Set([...materiaux.map((materiau) => materiau.unite), ...UNITES_MATERIAU])];
}

/** Les chiffres de la modale de soumission : ce que le rédacteur certifie d'un coup d'œil. */
export interface ResumeSaisie {
  effectifPresent: number;
  effectifPrevu: number;
  heures: number;
  taux: number | null;
  activitesAvancees: number;
  activites: number;
  avancementLot: number | null;
  materiaux: number;
  livraisons: number;
  incidents: number;
  incidentsGraves: number;
  blocages: number;
  blocagesBloquants: number;
  photos: number;
}

export function resumeSaisie(
  saisie: SaisieRapport,
  preparation: Pick<PreparationSaisie, "activites" | "sections"> &
    Partial<Pick<PreparationSaisie, "equipes">>,
): ResumeSaisie {
  const sections = sectionsActives(preparation.sections, saisie.arret !== null);
  const equipesPreparees = (preparation.equipes ?? []).filter((equipe) => equipe.presence);
  const equipesSaisies = sections.includes("EQUIPES") ? saisie.equipes : [];

  const personnesPresentes = new Set(equipesSaisies.flatMap((ligne) => ligne.presents));
  const personnesPrevues = new Set(
    equipesPreparees
      .filter((equipe) => equipesSaisies.some((ligne) => ligne.equipeId === equipe.equipeId))
      .flatMap((equipe) => equipe.membres.map((membre) => membre.personneId)),
  );
  const effectifPresent = personnesPresentes.size;
  const effectifPrevu = personnesPrevues.size;
  const heures = Math.round(
    equipesSaisies.reduce(
      (total, ligne) => total + ligne.presents.length * (ligne.heures ?? 0),
      0,
    ) * 10,
  ) / 10;

  const mesures = mesuresDuJour(saisie, preparation.sections);
  const activitesAvancees = preparation.activites.filter((activite) =>
    feuilleAvanceeSaisie(activite, mesures.get(activite.activiteId)),
  ).length;

  return {
    effectifPresent,
    effectifPrevu,
    heures,
    taux: tauxPresence(effectifPresent, effectifPrevu),
    activitesAvancees,
    activites: preparation.activites.length,
    avancementLot: avancementLotSaisi(preparation.activites, mesures),
    materiaux: sections.includes("MATERIAUX")
      ? saisie.materiaux.filter((ligne) => (ligne.quantite ?? 0) > 0).length
      : 0,
    livraisons: sections.includes("LIVRAISONS") ? saisie.livraisons.length : 0,
    incidents: saisie.incidents.length,
    incidentsGraves: saisie.incidents.filter((incident) => incident.gravite === "GRAVE").length,
    blocages: saisie.blocages.length,
    blocagesBloquants: saisie.blocages.filter((blocage) => blocage.niveau === "BLOQUANT").length,
    photos: saisie.photos.length,
  };
}

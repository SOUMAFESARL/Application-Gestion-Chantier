/**
 * Les règles du journal de chantier — plan de refonte, lot 4, couche 2.
 *
 * Pures : ni React, ni HTTP. Tout ce que les écrans du journal comptent,
 * trient ou déduisent passe par ici — qu'un rapport soit « déposé », qu'une
 * validation soit hors délai, ce que vaut une semaine — pour qu'un même
 * chiffre ne soit jamais calculé deux fois, de deux façons.
 *
 * **Les dates sont des jours `AAAA-MM-JJ`, lus en UTC** : un jour de journal
 * est un jour de chantier, pas un instant ; lu en heure locale il reculerait
 * d'un jour à l'ouest de Greenwich.
 */

import type { ConditionMeteo } from "@/features/projets/types";

import type {
  ActivitePreparee,
  AlerteImmediate,
  EffectifSynthese,
  EntreeJournal,
  EtapeCircuit,
  IncidentSynthese,
  LigneActivite,
  LigneEffectif,
  LigneMateriau,
  LigneProduction,
  LotJournal,
  LotSynthese,
  MateriauDisponible,
  MateriauSynthese,
  Meteo,
  NatureEvenement,
  NiveauBlocageSaisi,
  PointLot,
  PreparationSaisie,
  RapportDuJour,
  RapportEnAttente,
  RapportJournalier,
  RoleSignataire,
  SaisieRapport,
  SectionSaisie,
  SituationRapport,
  StatutRapport,
  SynthesePeriodique,
  TypeIncident,
  TypePeriode,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les constantes du circuit.
 * ------------------------------------------------------------------ */

/** L'heure à laquelle un chantier sans rapport déclenche la relance automatique du CC. */
export const HEURE_ALERTE_NON_SOUMIS = "17:30";
/** L'heure à laquelle le CT et le CP sont alertés à leur tour. */
export const HEURE_ESCALADE = "18:00";
/** Le CT valide sous 24 h — au plus tard le lendemain 07:30. */
export const DELAI_VALIDATION_CT_HEURES = 24;
/** La note d'un rejet doit dire pourquoi : 20 caractères au moins. */
export const LONGUEUR_MIN_COMMENTAIRE_REJET = 20;
/** La cible de présence des équipes en régie. */
export const CIBLE_PRESENCE = 92;

/* ------------------------------------------------------------------ *
 * Les jours.
 * ------------------------------------------------------------------ */

function versDateUtc(jour: string): Date {
  return new Date(`${jour.slice(0, 10)}T00:00:00Z`);
}

function versJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Le jour courant du poste, au format du journal. */
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

/** Les chantiers rendent un rapport du lundi au vendredi. */
export function estJourOuvre(jour: string): boolean {
  const rang = jourDeSemaine(jour);
  return rang >= 1 && rang <= 5;
}

/** Les jours ouvrés de `debut` à `fin`, bornes comprises. */
export function joursOuvres(debut: string, fin: string): string[] {
  const jours: string[] = [];
  for (let jour = debut; jour <= fin; jour = ajouterJours(jour, 1)) {
    if (estJourOuvre(jour)) jours.push(jour);
  }
  return jours;
}

/** Le `nombre`-ième jour ouvré avant `jour` (0 : `jour` lui-même s'il est ouvré). */
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

/** La semaine de chantier qui contient `jour` : du lundi au vendredi. */
export function semaineDe(jour: string): Periode {
  const rang = jourDeSemaine(jour) || 7;
  const lundi = ajouterJours(jour, 1 - rang);
  return { type: "HEBDOMADAIRE", debut: lundi, fin: ajouterJours(lundi, 4) };
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

/** Un rapport validé par le CT au moins : ses chiffres comptent. */
export function estValide(situation: SituationRapport): boolean {
  return situation === "VALIDE_CT" || situation === "APPROUVE_CP";
}

/** Un rapport qui manque au soir : jamais commencé, ou resté en brouillon. */
export function estManquant(situation: SituationRapport): boolean {
  return situation === "NON_SOUMIS";
}

/** Un rapport consultable : il en existe un document. */
export function aUnDocument(entree: EntreeJournal): boolean {
  return entree.reference !== null && entree.situation !== "NON_SOUMIS";
}

/**
 * L'ordre de lecture d'une journée : d'abord ce qui manque, puis ce qui
 * attend, enfin ce qui est clos.
 */
const ORDRE_SITUATION: Record<SituationRapport, number> = {
  NON_SOUMIS: 0,
  REJETE: 1,
  SOUMIS: 2,
  VALIDE_CT: 3,
  APPROUVE_CP: 4,
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
 * Les rapports déposés qui attendent une signature — CT ou CP — rangés par
 * urgence : les hors délai d'abord, puis par échéance.
 */
export function validationsEnAttente(
  entrees: EntreeJournal[],
  maintenant: Date,
): ValidationEnAttente[] {
  return entrees
    .filter((entree) => entree.situation === "SOUMIS" || entree.situation === "VALIDE_CT")
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

/** Les rapports rejetés, en attente de correction par le chef de chantier. */
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
  enAttenteCt: number;
  enAttenteCp: number;
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
    enAttenteCt: compter("SOUMIS"),
    enAttenteCp: compter("VALIDE_CT"),
    approuves: compter("APPROUVE_CP"),
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
            entree.chantier.chefChantier,
            ...entree.lots.flatMap((lot) => [lot.code, lot.nom]),
          ].join(" "),
        ).includes(recherche),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.chantier.projetNom.localeCompare(b.chantier.projetNom));
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
export function retardPoints(entree: { avancement: number | null; avancementTheorique: number | null }): number | null {
  if (entree.avancement === null || entree.avancementTheorique === null) return null;
  return Math.round(entree.avancementTheorique - entree.avancement);
}

/** Les codes des lots couverts par un rapport, dans l'ordre : `L-03 · L-04`. */
export function codesLots(lots: Pick<LotJournal, "code">[]): string {
  return lots.map((lot) => lot.code).join(" · ");
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

/** La présence est acceptable à partir de 85 %, bonne à partir de la cible. */
export function presenceSuffisante(taux: number | null): "BONNE" | "ACCEPTABLE" | "INSUFFISANTE" | null {
  if (taux === null) return null;
  if (taux >= CIBLE_PRESENCE) return "BONNE";
  if (taux >= 85) return "ACCEPTABLE";
  return "INSUFFISANTE";
}

/** Le montant d'un bon de tâcheron : quantité du jour × prix du bordereau. */
export function montantProduction(ligne: LigneProduction): number {
  return Math.round(ligne.prixUnitaire * ligne.quantiteJour);
}

export function totalProduction(lignes: LigneProduction[]): number {
  return lignes.reduce((total, ligne) => total + montantProduction(ligne), 0);
}

export function cumulActivite(ligne: LigneActivite): number {
  return ligne.cumulVeille + ligne.quantiteJour;
}

export function avancementActivite(ligne: LigneActivite): number {
  return ligne.quantitePrevue > 0
    ? Math.min(100, Math.round((cumulActivite(ligne) / ligne.quantitePrevue) * 100))
    : 0;
}

/** `null` : un matériau saisi librement, dont le stock n'est pas suivi. */
export function stockFin(ligne: Pick<LigneMateriau, "stockDebut" | "livre" | "utilise">): number | null {
  return ligne.stockDebut === null ? null : ligne.stockDebut + ligne.livre - ligne.utilise;
}

/** Un stock passe en alerte à son seuil, pas en dessous. Sans stock suivi, pas d'alerte. */
export function enAlerteStock(stock: number | null, seuil: number | null): boolean {
  return stock !== null && seuil !== null && stock <= seuil;
}

/** Les activités qui avancent ce jour. */
export function activitesActives(lignes: LigneActivite[]): number {
  return lignes.filter((ligne) => ligne.quantiteJour > 0).length;
}

/** Toutes les activités d'un rapport, lots confondus. */
export function activitesDuRapport(rapport: Pick<RapportJournalier, "travaux">): LigneActivite[] {
  return rapport.travaux.flatMap((travaux) => travaux.activites);
}

/* ------------------------------------------------------------------ *
 * La synthèse périodique — l'agrégation.
 * ------------------------------------------------------------------ */

/** Ce que la synthèse calcule ; l'appréciation, les objectifs et le circuit viennent d'ailleurs. */
export type SyntheseAgregee = Omit<
  SynthesePeriodique,
  | "reference"
  | "genereLe"
  | "appreciation"
  | "objectifs"
  | "circuit"
  | "localisation"
  | "chefProjet"
  | "conducteurTravaux"
>;

function moyenne(valeurs: number[]): number {
  return valeurs.length ? valeurs.reduce((total, valeur) => total + valeur, 0) / valeurs.length : 0;
}

function arrondi(valeur: number, decimales = 0): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

/** Le dernier avancement connu du chantier à une date, rapports antérieurs compris. */
function avancementAu(entrees: EntreeJournal[], jour: string, cle: "avancement" | "avancementTheorique"): number | null {
  const connues = entrees
    .filter((entree) => entree.date <= jour && entree[cle] !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  return connues[0]?.[cle] ?? null;
}

/**
 * La synthèse d'un chantier sur une période, agrégée des rapports journaliers.
 *
 * C'est le calcul que Django fait à la demande ; il vit ici pour que la
 * simulation le rejoue à l'identique, et qu'un écran puisse l'expliquer.
 *
 * - `entrees` : toutes les lignes connues du chantier, **y compris avant la
 *   période** — l'avancement de départ est le dernier connu la veille ;
 * - `rapports` : les rapports détaillés de la période.
 */
export function agregerSynthese(
  periode: Periode,
  lots: LotJournal[],
  entrees: EntreeJournal[],
  rapports: RapportJournalier[],
): SyntheseAgregee {
  const dansPeriode = (jour: string) => jour >= periode.debut && jour <= periode.fin;
  const recapitulatif = entrees
    .filter((entree) => dansPeriode(entree.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const detailles = rapports
    .filter((rapport) => dansPeriode(rapport.date) && estDepose(rapport.situation))
    .sort((a, b) => a.date.localeCompare(b.date));

  const veille = ajouterJours(periode.debut, -1);
  const finConnue = recapitulatif.at(-1)?.date ?? periode.fin;
  const releve = (jour: string, cle: "avancement" | "avancementTheorique") => avancementAu(entrees, jour, cle) ?? 0;

  const debut = arrondi(releve(veille, "avancement"));
  const fin = arrondi(releve(finConnue, "avancement"));
  const theoriqueDebut = arrondi(releve(veille, "avancementTheorique"));
  const theorique = arrondi(releve(finConnue, "avancementTheorique"));

  const deposes = recapitulatif.filter((entree) => estDepose(entree.situation));
  const avecEffectifs = deposes.filter((entree) => entree.effectifPresent !== null && entree.effectifPrevu !== null);

  const avancement: LotSynthese[] = lots.map((lot) => {
    // Un rapport couvre tout le chantier : on y relève les travaux de ce lot,
    // les jours où il a été travaillé.
    const duLot = detailles.flatMap((rapport) => rapport.travaux.filter((travaux) => travaux.lot.id === lot.id));
    const premier = duLot[0];
    const dernier = duLot.at(-1);
    if (!premier || !dernier) return { lot, activites: [] };
    return {
      lot,
      activites: dernier.activites.map((ligne) => {
        const depart = premier.activites.find((candidate) => candidate.libelle === ligne.libelle) ?? ligne;
        const prevue = ligne.quantitePrevue || 1;
        // Le théorique relevé au premier rapport est celui du soir de ce jour :
        // l'objectif de la période y ajoute le pas d'une journée.
        const ecartTheorique = ligne.avancementTheorique - depart.avancementTheorique;
        const pas = duLot.length > 1 ? ecartTheorique / (duLot.length - 1) : 0;
        return {
          libelle: ligne.libelle,
          unite: ligne.unite,
          quantitePrevue: ligne.quantitePrevue,
          avancementDebut: arrondi((depart.cumulVeille / prevue) * 100),
          avancementFin: avancementActivite(ligne),
          objectifGain: arrondi(ecartTheorique + pas),
        };
      }),
    };
  });

  const categories = new Map<string, LigneEffectif[]>();
  for (const rapport of detailles) {
    for (const ligne of rapport.effectifs ?? []) {
      categories.set(ligne.categorie, [...(categories.get(ligne.categorie) ?? []), ligne]);
    }
  }
  const effectifs: EffectifSynthese[] = [...categories.entries()].map(([categorie, lignes]) => ({
    categorie,
    prevuParJour: Math.max(...lignes.map((ligne) => ligne.prevus)),
    presenceMoyenne: arrondi(moyenne(lignes.map((ligne) => ligne.presents)), 1),
    heures: arrondi(lignes.reduce((total, ligne) => total + ligne.heures, 0)),
    absences: lignes.reduce((total, ligne) => total + (ligne.prevus - ligne.presents), 0),
    observation: lignes.find((ligne) => ligne.observation)?.observation ?? null,
  }));

  const stocks = new Map<string, LigneMateriau[]>();
  for (const rapport of detailles) {
    for (const ligne of rapport.materiaux) {
      stocks.set(ligne.designation, [...(stocks.get(ligne.designation) ?? []), ligne]);
    }
  }
  const materiaux: MateriauSynthese[] = [...stocks.values()].map((lignes) => {
    const dernier = lignes[lignes.length - 1];
    return {
      designation: dernier.designation,
      unite: dernier.unite,
      stockDebut: lignes[0].stockDebut,
      consomme: lignes.reduce((total, ligne) => total + ligne.utilise, 0),
      livre: lignes.reduce((total, ligne) => total + ligne.livre, 0),
      stockFin: stockFin(dernier),
      seuilAlerte: dernier.seuilAlerte,
    };
  });

  const incidents: IncidentSynthese[] = detailles.flatMap((rapport) =>
    rapport.listeIncidents.map((incident) => ({ ...incident, date: rapport.date })),
  );
  const livraisons = detailles.flatMap((rapport) => rapport.livraisons);

  const premier = lots[0];
  return {
    type: periode.type,
    debut: periode.debut,
    fin: periode.fin,
    projetId: premier?.projetId ?? "",
    projetNom: premier?.projetNom ?? "",
    projetReference: premier?.projetReference ?? "",
    lots,
    chiffres: {
      joursOuvres: new Set(recapitulatif.map((entree) => entree.date)).size,
      rapportsAttendus: recapitulatif.length,
      rapportsRecus: deposes.length,
      rapportsValides: recapitulatif.filter((entree) => estValide(entree.situation)).length,
      effectifsPresents: avecEffectifs.reduce((total, entree) => total + (entree.effectifPresent ?? 0), 0),
      effectifsPrevus: avecEffectifs.reduce((total, entree) => total + (entree.effectifPrevu ?? 0), 0),
      heures: arrondi(effectifs.reduce((total, ligne) => total + ligne.heures, 0)),
      livraisons: livraisons.length,
      livraisonsPartielles: livraisons.filter((livraison) => livraison.conformite !== "CONFORME").length,
      incidents: incidents.length,
      incidentsMajeurs: incidents.filter((incident) => incident.gravite !== "MINEUR").length,
      blocages: detailles.reduce((total, rapport) => total + rapport.listeBlocages.length, 0),
    },
    progression: {
      debut,
      fin,
      gain: fin - debut,
      objectif: theorique - theoriqueDebut,
      theorique,
    },
    recapitulatif,
    avancement,
    effectifs,
    materiaux,
    incidents,
  };
}

/** L'écart d'un gain à son objectif, en points. */
export function ecartObjectif(gain: number, objectif: number): number {
  return arrondi(gain - objectif);
}

/** La période manquante qui explique une synthèse incomplète. */
export function rapportsManquants(synthese: Pick<SynthesePeriodique, "recapitulatif">): EntreeJournal[] {
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
 * La saisie du rapport journalier (SFD F2 §5-6, RG-F2-01 à 11).
 * ------------------------------------------------------------------ */

/** Un rapport se rédige pour le jour même, ou rattrape au plus les deux jours précédents. */
export const JOURS_RETROACTIFS_SAISIE = 2;
export const PHOTOS_MAX = 5;
/** Documents joints : peu, et légers — la connexion d'un chantier en région ne passe pas plus. */
export const PIECES_JOINTES_MAX = 3;
export const TAILLE_MAX_PIECE_JOINTE = 2 * 1024 * 1024;
/**
 * Les pièces jointes sont des documents (PV, plans, métrés) — pas de vidéo :
 * les images passent par les photos, horodatées et géolocalisées.
 */
export const EXTENSIONS_DOCUMENT: readonly string[] = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];

/** Le sélecteur de fichiers ne fait que suggérer : l'écran vérifie le nom du fichier retenu. */
export function estDocumentAccepte(nomFichier: string): boolean {
  const nom = nomFichier.toLowerCase();
  return EXTENSIONS_DOCUMENT.some((extension) => nom.endsWith(extension));
}

/** Le format d'un document joint, d'après son extension — ce que le rapport en affiche. */
export type FormatDocument = "PDF" | "WORD" | "EXCEL" | "AUTRE";

export function formatDocument(nomFichier: string): FormatDocument {
  const nom = nomFichier.toLowerCase();
  if (nom.endsWith(".pdf")) return "PDF";
  if (nom.endsWith(".doc") || nom.endsWith(".docx")) return "WORD";
  if (nom.endsWith(".xls") || nom.endsWith(".xlsx")) return "EXCEL";
  return "AUTRE";
}

/** Une taille en octets, arrondie au kilo-octet supérieur : un document de 200 o pèse 1 Ko, pas 0. */
export function tailleKo(octets: number): number {
  return Math.ceil(octets / 1024);
}
export const LONGUEUR_MIN_NOTE = 10;
export const LONGUEUR_MIN_DESCRIPTION_INCIDENT = 20;
/** Sous ce taux de présence, le rapport le signale avant même la soumission. */
export const SEUIL_ALERTE_PRESENCE = 60;
/** Le brouillon part au serveur toutes les 30 secondes s'il a changé. */
export const INTERVALLE_SAUVEGARDE_MS = 30_000;
/** Au-delà, une journée de chantier n'a plus de sens. */
export const HEURES_MAX_JOUR = 24;

/**
 * Le ciel du rapport d'après le relevé météo du chantier — pour préremplir,
 * jamais pour imposer : le chef de chantier voit le ciel, le service non.
 */
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

/** Les jours qu'on peut encore rapporter, le plus récent d'abord. */
export function joursSaisissables(aujourdhui: string): string[] {
  return Array.from({ length: JOURS_RETROACTIFS_SAISIE + 1 }, (_, rang) => ajouterJours(aujourdhui, -rang));
}

export function jourSaisissable(jour: string, aujourdhui: string): boolean {
  return joursSaisissables(aujourdhui).includes(jour);
}

/**
 * Les rapports qu'un chantier attend encore de son chef de chantier, du plus
 * récent au plus ancien : chaque jour ouvré depuis le début du chantier qui
 * n'a pas de rapport, plus les brouillons et les rejets — ceux-là même un
 * jour chômé, puisqu'ils ont été commencés. Un rapport soumis n'attend plus
 * rien du chef de chantier.
 *
 * Sans date de début connue, seuls les jours encore saisissables comptent :
 * on ne réclame pas des rapports d'avant le chantier.
 */
export function rapportsEnAttente(
  debut: string | null,
  aujourdhui: string,
  rapports: RapportDuJour[],
): RapportEnAttente[] {
  const parJour = new Map(rapports.map((rapport) => [rapport.date, rapport]));
  const premier = debut && debut <= aujourdhui ? debut : (joursSaisissables(aujourdhui).at(-1) ?? aujourdhui);
  const jours = new Set([
    ...joursOuvres(premier, aujourdhui),
    ...rapports.map((rapport) => rapport.date).filter((jour) => jour <= aujourdhui),
  ]);
  return [...jours]
    .sort((a, b) => b.localeCompare(a))
    .flatMap((date): RapportEnAttente[] => {
      const rapport = parJour.get(date);
      const etat = !rapport ? "A_REDIGER" : rapport.statut === "BROUILLON" || rapport.statut === "REJETE" ? rapport.statut : null;
      if (!etat) return [];
      return [
        {
          date,
          etat,
          rapportId: rapport?.id ?? null,
          enregistreLe: rapport?.enregistreLe ?? null,
          redigeable: jourSaisissable(date, aujourdhui),
        },
      ];
    });
}

/**
 * Les brouillons d'un chef de chantier, tous chantiers confondus, du plus
 * récent au plus ancien. Un brouillon au-delà de J-2 reste listé — il ne se
 * reprend plus (`redigeable`), mais le chef de chantier doit savoir qu'il
 * n'a jamais été soumis.
 */
export function brouillonsEnCours<P>(
  parProjet: { projet: P; aujourdhui: string; rapports: RapportDuJour[] }[],
): { projet: P; rapport: RapportDuJour; redigeable: boolean }[] {
  return parProjet
    .flatMap(({ projet, aujourdhui, rapports }) =>
      rapports
        .filter((rapport) => rapport.statut === "BROUILLON")
        .map((rapport) => ({ projet, rapport, redigeable: jourSaisissable(rapport.date, aujourdhui) })),
    )
    .sort(
      (a, b) =>
        b.rapport.date.localeCompare(a.rapport.date) || b.rapport.enregistreLe.localeCompare(a.rapport.enregistreLe),
    );
}

/**
 * Le chef de chantier ne touche plus un rapport soumis (RG-F2-03) : seul un
 * rejet du CT le lui rend. Un rapport qui n'existe pas encore se rédige.
 */
export function rapportModifiable(statut: StatutRapport | null): boolean {
  return statut === null || statut === "BROUILLON" || statut === "REJETE";
}

/**
 * Les sections à remplir, d'après celles que le serveur donne pour le chantier.
 * Une journée d'arrêt n'a ni avancement ni consommation (SFD §4.4) : elle ne
 * crée aucun mouvement de stock, aucune production à payer. Elle ne déclare
 * pas davantage d'effectif, d'engin ou de livraison : le rapport se réduit à
 * la journée — horaires, motif de l'arrêt, météo.
 */
export function sectionsActives(sections: SectionSaisie[], arret: boolean): SectionSaisie[] {
  return arret ? [] : sections;
}

/**
 * À qui remonte un blocage : le chef de chantier tranche un blocage mineur,
 * le CT négocie un blocage significatif, le CP reçoit un blocage bloquant.
 */
export function escaladeBlocage(niveau: NiveauBlocageSaisi): RoleSignataire | null {
  switch (niveau) {
    case "SIGNIFICATIF":
      return "CT";
    case "BLOQUANT":
      return "CP";
    default:
      return null;
  }
}

export function cleAlerte(alerte: AlerteImmediate): string {
  return alerte.type === "BLOCAGE_BLOQUANT" ? "BLOCAGE" : alerte.cle;
}

/**
 * Les alertes que la saisie appelle **dès maintenant** (RG-F2-11) : un
 * blocage bloquant, un incident grave. Elles partent avant la soumission —
 * un chantier arrêté n'attend pas 17 h pour être su.
 */
export function alertesImmediates(saisie: Pick<SaisieRapport, "blocage" | "incidents">): AlerteImmediate[] {
  const alertes: AlerteImmediate[] = [];
  if (saisie.blocage.niveau === "BLOQUANT") {
    alertes.push({ type: "BLOCAGE_BLOQUANT", description: saisie.blocage.description });
  }
  for (const incident of saisie.incidents) {
    if (incident.gravite === "GRAVE") {
      alertes.push({ type: "INCIDENT_GRAVE", cle: incident.cle, description: incident.description });
    }
  }
  return alertes;
}

/**
 * La catégorie HSE / qualité d'un événement : choisie pour un incident,
 * déduite de sa nature pour les autres — la synthèse compte en catégories.
 */
export function categorieEvenement(nature: NatureEvenement, choisie: TypeIncident): TypeIncident {
  switch (nature) {
    case "INCIDENT":
      return choisie;
    case "DIFFICULTE_TECHNIQUE":
    case "NON_CONFORMITE":
      return "QUALITE";
    case "ARRET_TRAVAUX":
      return "MATERIEL";
    default:
      return "ADMINISTRATIF";
  }
}

/** Le cumul d'une activité au soir, avec la quantité du jour. */
export function cumulSaisi(activite: ActivitePreparee, quantiteJour: number | null): number {
  return activite.cumulVeille + (quantiteJour ?? 0);
}

export function avancementSaisi(activite: ActivitePreparee, quantiteJour: number | null): number {
  if (activite.quantitePrevue <= 0) return 0;
  return Math.min(100, Math.round((cumulSaisi(activite, quantiteJour) / activite.quantitePrevue) * 100));
}

/** La quantité du jour fait dépasser le prévu : possible (avenant, métré), mais à vérifier. */
export function depassePrevu(activite: ActivitePreparee, quantiteJour: number | null): boolean {
  return activite.quantitePrevue > 0 && cumulSaisi(activite, quantiteJour) > activite.quantitePrevue;
}

/** Les activités du chantier qui se déclarent de cette façon, dans l'ordre du serveur. */
export function activitesSuivies(
  preparation: Pick<PreparationSaisie, "activites">,
  suivi: ActivitePreparee["suivi"],
): ActivitePreparee[] {
  return preparation.activites.filter((activite) => activite.suivi === suivi);
}

/**
 * Les lots qu'on peut déclarer travaillés à l'avancement : ceux qui ont au
 * moins une activité suivie de cette façon, dans l'ordre du serveur. Un lot en
 * sous-traitance informelle se déclare par la production de ses tâcherons.
 */
export function lotsSuivisAvancement(preparation: Pick<PreparationSaisie, "lots" | "activites">): LotJournal[] {
  const avecActivite = new Set(activitesSuivies(preparation, "AVANCEMENT").map((activite) => activite.lotId));
  return preparation.lots.filter((lot) => avecActivite.has(lot.id));
}

/**
 * Les lots travaillés d'un rapport. Un rapport enregistré avant le choix des
 * lots (05/10/2026) ne les porte pas : ils se déduisent alors des activités
 * qu'il a renseignées.
 */
export function lotsTravaillesDe(
  saisie: Pick<SaisieRapport, "activites"> & { lotsTravailles?: PointLot[] },
  activites: ActivitePreparee[],
): PointLot[] {
  if (saisie.lotsTravailles) return saisie.lotsTravailles;
  const lotDe = new Map(activites.map((activite) => [activite.activiteId, activite.lotId]));
  const lots = new Set(saisie.activites.flatMap((ligne) => lotDe.get(ligne.activiteId) ?? []));
  return [...lots].map((lotId) => ({ lotId, observation: "" }));
}

/**
 * Les quantités réalisées ce jour, activité par activité. En sous-traitance
 * informelle, l'avancement **se déduit de la production** des tâcherons
 * (SFD §5.4) : il ne se saisit pas une seconde fois.
 */
export function quantitesDuJour(
  saisie: Pick<SaisieRapport, "activites" | "production" | "arret">,
  sections: SectionSaisie[],
): Map<string, number> {
  const actives = sectionsActives(sections, saisie.arret !== null);
  const quantites = new Map<string, number>();
  // Un chantier mêle des lots des deux suivis : leurs activités sont
  // distinctes, les deux sources s'additionnent sans se recouvrir.
  if (actives.includes("AVANCEMENT")) {
    for (const ligne of saisie.activites) quantites.set(ligne.activiteId, ligne.quantiteJour ?? 0);
  }
  if (actives.includes("PRODUCTION")) {
    for (const ligne of saisie.production) {
      if (!ligne.activiteId) continue;
      quantites.set(ligne.activiteId, (quantites.get(ligne.activiteId) ?? 0) + (ligne.quantiteJour ?? 0));
    }
  }
  return quantites;
}

/**
 * L'avancement du lot au soir : la moyenne simple de ses activités, comme
 * le calcule la structure du chantier (le budget pondère les lots, pas les
 * activités).
 */
export function avancementLotSaisi(activites: ActivitePreparee[], quantites: Map<string, number>): number | null {
  if (activites.length === 0) return null;
  const total = activites.reduce(
    (somme, activite) => somme + avancementSaisi(activite, quantites.get(activite.activiteId) ?? null),
    0,
  );
  return Math.round(total / activites.length);
}

export function avancementTheoriqueLot(activites: ActivitePreparee[]): number | null {
  if (activites.length === 0) return null;
  return Math.round(activites.reduce((somme, activite) => somme + activite.avancementTheorique, 0) / activites.length);
}

/**
 * Les unités proposées pour un matériau consommé — une proposition, pas une
 * liste fermée : le chef de chantier peut en taper une autre.
 */
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

/**
 * Les unités à proposer : celles du stock du chantier d'abord, puis la liste
 * générale, sans doublon.
 */
export function unitesProposees(materiaux: Pick<MateriauDisponible, "unite">[]): string[] {
  return [...new Set([...materiaux.map((materiau) => materiau.unite), ...UNITES_MATERIAU])];
}

/** Les chiffres de la modale de soumission : ce que le CC certifie d'un coup d'œil. */
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
  blocage: NiveauBlocageSaisi;
  photos: number;
}

/** Les heures de main-d'œuvre d'une ligne d'effectifs : présents × heures. */
export function heuresEffectif(ligne: { presents: number | null; heures: number | null }): number {
  return (ligne.presents ?? 0) * (ligne.heures ?? 0);
}

export function resumeSaisie(
  saisie: SaisieRapport,
  preparation: Pick<PreparationSaisie, "activites" | "sections">,
): ResumeSaisie {
  const sections = sectionsActives(preparation.sections, saisie.arret !== null);
  const effectifs = sections.includes("EFFECTIFS") ? saisie.effectifs : [];
  const effectifPresent = effectifs.reduce((total, ligne) => total + (ligne.presents ?? 0), 0);
  const effectifPrevu = effectifs.reduce((total, ligne) => total + (ligne.prevus ?? 0), 0);
  const quantites = quantitesDuJour(saisie, preparation.sections);
  return {
    effectifPresent,
    effectifPrevu,
    heures: effectifs.reduce((total, ligne) => total + heuresEffectif(ligne), 0),
    taux: tauxPresence(effectifPresent, effectifPrevu),
    activitesAvancees: [...quantites.values()].filter((quantite) => quantite > 0).length,
    activites: preparation.activites.length,
    avancementLot: avancementLotSaisi(preparation.activites, quantites),
    materiaux: sections.includes("MATERIAUX")
      ? saisie.materiaux.filter((ligne) => (ligne.quantite ?? 0) > 0).length
      : 0,
    livraisons: sections.includes("LIVRAISONS") ? saisie.livraisons.length : 0,
    incidents: saisie.incidents.length,
    incidentsGraves: saisie.incidents.filter((incident) => incident.gravite === "GRAVE").length,
    blocage: saisie.blocage.niveau,
    photos: saisie.photos.length,
  };
}

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

import type {
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
  MateriauSynthese,
  RapportJournalier,
  SituationRapport,
  SynthesePeriodique,
  TypePeriode,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les constantes du circuit.
 * ------------------------------------------------------------------ */

/** L'heure à laquelle un lot sans rapport déclenche la relance automatique du CC. */
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
    a.lot.code.localeCompare(b.lot.code)
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
    chantiers: new Set(duJour.map((entree) => entree.lot.projetId)).size,
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

export interface GroupeChantier {
  projetId: string;
  projetNom: string;
  projetReference: string;
  entrees: EntreeJournal[];
}

/** Les lignes regroupées par chantier ; le chantier le plus en défaut d'abord. */
export function grouperParChantier(entrees: EntreeJournal[]): GroupeChantier[] {
  const groupes = new Map<string, GroupeChantier>();
  for (const entree of entrees) {
    const groupe = groupes.get(entree.lot.projetId) ?? {
      projetId: entree.lot.projetId,
      projetNom: entree.lot.projetNom,
      projetReference: entree.lot.projetReference,
      entrees: [],
    };
    groupe.entrees.push(entree);
    groupes.set(entree.lot.projetId, groupe);
  }
  const manquants = (groupe: GroupeChantier) =>
    groupe.entrees.filter((entree) => estManquant(entree.situation)).length;
  return [...groupes.values()]
    .map((groupe) => ({ ...groupe, entrees: [...groupe.entrees].sort(comparerSituations) }))
    .sort((a, b) => manquants(b) - manquants(a) || a.projetNom.localeCompare(b.projetNom));
}

/** Le nombre de jours ouvrés écoulés depuis le dernier rapport d'un lot. */
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
    .filter((entree) => !criteres.projetId || entree.lot.projetId === criteres.projetId)
    .filter((entree) => !criteres.situation || entree.situation === criteres.situation)
    .filter((entree) => !debut || entree.date >= debut)
    .filter(
      (entree) =>
        !recherche ||
        normaliser(
          [
            entree.reference ?? "",
            entree.lot.code,
            entree.lot.nom,
            entree.lot.projetNom,
            entree.lot.chefChantier,
          ].join(" "),
        ).includes(recherche),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.lot.projetNom.localeCompare(b.lot.projetNom) || a.lot.code.localeCompare(b.lot.code));
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

/** Le retard d'un lot sur son planning, en points (positif : en retard). */
export function retardPoints(entree: Pick<EntreeJournal, "avancementLot" | "avancementTheorique">): number | null {
  if (entree.avancementLot === null || entree.avancementTheorique === null) return null;
  return Math.round(entree.avancementTheorique - entree.avancementLot);
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

export function stockFin(ligne: Pick<LigneMateriau, "stockDebut" | "livre" | "utilise">): number {
  return ligne.stockDebut + ligne.livre - ligne.utilise;
}

/** Un stock passe en alerte à son seuil, pas en dessous. */
export function enAlerteStock(stock: number, seuil: number): boolean {
  return stock <= seuil;
}

/** Les activités qui avancent ce jour. */
export function activitesActives(lignes: LigneActivite[]): number {
  return lignes.filter((ligne) => ligne.quantiteJour > 0).length;
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

/** Le dernier avancement connu d'un lot à une date, rapports antérieurs compris. */
function avancementAu(entrees: EntreeJournal[], jour: string, cle: "avancementLot" | "avancementTheorique"): number | null {
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
    .sort((a, b) => a.date.localeCompare(b.date) || a.lot.code.localeCompare(b.lot.code));
  const detailles = rapports
    .filter((rapport) => dansPeriode(rapport.date) && estDepose(rapport.situation))
    .sort((a, b) => a.date.localeCompare(b.date));

  const veille = ajouterJours(periode.debut, -1);
  const finConnue = recapitulatif.at(-1)?.date ?? periode.fin;
  const parLot = lots.map((lot) => entrees.filter((entree) => entree.lot.id === lot.id));
  const releves = (jour: string, cle: "avancementLot" | "avancementTheorique") =>
    parLot.map((liste) => avancementAu(liste, jour, cle)).filter((valeur): valeur is number => valeur !== null);

  const debut = arrondi(moyenne(releves(veille, "avancementLot")));
  const fin = arrondi(moyenne(releves(finConnue, "avancementLot")));
  const theoriqueDebut = arrondi(moyenne(releves(veille, "avancementTheorique")));
  const theorique = arrondi(moyenne(releves(finConnue, "avancementTheorique")));

  const deposes = recapitulatif.filter((entree) => estDepose(entree.situation));
  const avecEffectifs = deposes.filter((entree) => entree.effectifPresent !== null && entree.effectifPrevu !== null);

  const avancement: LotSynthese[] = lots.map((lot) => {
    const duLot = detailles.filter((rapport) => rapport.lot.id === lot.id);
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
    rapport.listeIncidents.map((incident) => ({ ...incident, date: rapport.date, lotCode: rapport.lot.code })),
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

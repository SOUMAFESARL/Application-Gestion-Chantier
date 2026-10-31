/**
 * L'accès aux données du domaine Découpage — le seul fichier du domaine qui sait que le serveur
 * existe (style de `features/projets/adaptateur.ts`).
 *
 * Routes servies par `apps/projets/views/decoupage.py` :
 *
 *   GET        /decoupage/listes/                    listes plateforme + entreprise
 *   GET        /decoupage/modeles/?type_projet=      modèles, ceux du type en tête
 *   GET/POST   /projets/{id}/decoupage/              tableau pré-rempli / application
 *   POST       /projets/{id}/decoupage/verifier/     vérification C-1 à C-7, sans écrire
 *   POST       /projets/{id}/decoupage/importer/     un fichier Excel ou CSV devient un tableau
 *   GET        /projets/{id}/decoupage/exporter/     l'arbre au format du tableau
 *   GET        /projets/{id}/arbre/                  l'arbre, filtré par périmètre
 *   GET        /projets/{id}/planning/               temporel et écart de chaque case active
 *   GET        /projets/{id}/courbe/?element=        courbe en S du projet ou d'une case
 *   POST/PATCH /projets/{id}/niveaux/[{niveau_id}/]  réglages des niveaux
 *   POST       /projets/{id}/elements/               ajouter une case
 *   PATCH      /elements/{id}/                       renommer, chiffrer, métrer
 *   POST       /elements/{id}/planifier|mesure|cloturer|desactiver|reactiver/
 *
 * Les charges (`Charge*`) sont privées : elles décrivent un transport.
 */

import { api, ErreurApi } from "@/lib/api";

import { nouvelleCleLigne } from "./regles";
import type {
  ArbreProjet,
  CaseArbre,
  ConstatTableau,
  CourbeAvancement,
  CreationCase,
  EquipeCase,
  Mesure,
  ModeMesure,
  ModificationCase,
  ModificationNiveau,
  NiveauProjet,
  Planification,
  Prolongation,
  LigneTableau,
  ListeValeurs,
  ModeleApplique,
  NiveauGabarit,
  OrigineReference,
  ReferenceListe,
  RefusTableau,
  ResultatApplication,
  ResumeModele,
  TableauDemarrage,
  TableauImporte,
  UniteMesure,
  VerdictTableau,
} from "./types";
import { MODES_MESURE, UNITES_MESURE } from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur — la seule zone en `snake_case`.
 * ------------------------------------------------------------------ */

interface ChargeListePaginee<T> {
  results?: T[];
}

interface ChargeReference {
  origine: OrigineReference;
  id: string;
  libelle?: string;
}

interface ChargeValeur {
  id: string;
  libelle: string;
  groupe?: string;
  origine: OrigineReference;
}

interface ChargeListeValeurs extends ChargeReference {
  libelle: string;
  description?: string;
  modifiable?: boolean;
  valeurs?: ChargeValeur[];
}

interface ChargeResumeModele {
  origine: OrigineReference;
  id: string;
  nom: string;
  nom_affiche?: string;
  description?: string;
  types_projet?: string[];
  niveaux?: string[];
  nombre_lignes?: number;
  pour_ce_type?: boolean;
  par_defaut?: boolean;
}

interface ChargeNiveauGabarit {
  libelle: string;
  liste: ChargeReference | null;
  alerter?: boolean;
}

/** Une ligne : liste de cellules (modèle) ou objet avec les champs de la feuille (import). */
type ChargeLigne =
  | string[]
  | {
      cellules: string[];
      unite?: string | null;
      quantite?: number | string | null;
      montant?: number | string | null;
      date_debut?: string | null;
      date_fin?: string | null;
    };

interface ChargeTableau {
  modele: { origine: OrigineReference; id: string; nom: string } | null;
  niveaux: ChargeNiveauGabarit[];
  lignes: ChargeLigne[];
}

interface ChargeConstat {
  regle: string;
  ligne?: number;
  niveau?: number;
  discret?: boolean;
  message: string;
}

interface ChargeVerdict {
  bloquants: ChargeConstat[];
  avertissements: ChargeConstat[];
  apercu: { cases: number; feuilles: number; niveaux: number };
}

interface ChargeImport {
  niveaux: ChargeNiveauGabarit[];
  lignes: ChargeLigne[];
  verification: ChargeVerdict;
}

interface ChargeApplication {
  cases_creees: number;
  lignes_deja_presentes?: number[];
}

/* ------------------------------------------------------------------ *
 * Traductions — serveur vers domaine.
 * ------------------------------------------------------------------ */

function aPlat<T>(charge: T[] | ChargeListePaginee<T> | null | undefined): T[] {
  return Array.isArray(charge) ? charge : (charge?.results ?? []);
}

function versNombre(valeur: number | string | null | undefined): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const nombre = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(nombre) ? nombre : null;
}

function versUnite(valeur: string | null | undefined): UniteMesure | null {
  return (UNITES_MESURE as readonly string[]).includes(valeur ?? "") ? (valeur as UniteMesure) : null;
}

function versReference(charge: ChargeReference | null | undefined): ReferenceListe | null {
  if (!charge) return null;
  return { origine: charge.origine, id: charge.id, libelle: charge.libelle ?? "" };
}

function versListe(charge: ChargeListeValeurs): ListeValeurs {
  return {
    origine: charge.origine,
    id: charge.id,
    libelle: charge.libelle,
    description: charge.description ?? "",
    modifiable: charge.modifiable ?? false,
    valeurs: (charge.valeurs ?? []).map((valeur) => ({
      id: valeur.id,
      libelle: valeur.libelle,
      groupe: valeur.groupe ?? "",
      origine: valeur.origine,
    })),
  };
}

function versResumeModele(charge: ChargeResumeModele): ResumeModele {
  return {
    origine: charge.origine,
    id: charge.id,
    nom: charge.nom,
    nomAffiche: charge.nom_affiche ?? charge.nom,
    description: charge.description ?? "",
    typesProjet: charge.types_projet ?? [],
    niveaux: charge.niveaux ?? [],
    nombreLignes: charge.nombre_lignes ?? 0,
    pourCeType: charge.pour_ce_type ?? false,
    parDefaut: charge.par_defaut ?? false,
  };
}

function versNiveauGabarit(charge: ChargeNiveauGabarit): NiveauGabarit {
  return { libelle: charge.libelle, liste: versReference(charge.liste), alerter: charge.alerter ?? false };
}

function versLigne(charge: ChargeLigne, largeur: number): LigneTableau {
  const objet = Array.isArray(charge) ? { cellules: charge } : charge;
  const cellules = objet.cellules.map((cellule) => String(cellule ?? "")).slice(0, largeur);
  while (cellules.length < largeur) cellules.push("");
  return {
    cle: nouvelleCleLigne(),
    cellules,
    unite: "unite" in objet ? versUnite(objet.unite) : null,
    quantite: "quantite" in objet ? versNombre(objet.quantite) : null,
    montant: "montant" in objet ? versNombre(objet.montant) : null,
    dateDebut: "date_debut" in objet ? (objet.date_debut ?? null) : null,
    dateFin: "date_fin" in objet ? (objet.date_fin ?? null) : null,
  };
}

function versConstat(charge: ChargeConstat): ConstatTableau {
  return {
    regle: charge.regle,
    ligne: charge.ligne ?? null,
    niveau: charge.niveau ?? null,
    discret: charge.discret ?? false,
    message: charge.message,
  };
}

function versVerdict(charge: ChargeVerdict): VerdictTableau {
  return {
    bloquants: (charge.bloquants ?? []).map(versConstat),
    avertissements: (charge.avertissements ?? []).map(versConstat),
    apercu: charge.apercu ?? { cases: 0, feuilles: 0, niveaux: 0 },
  };
}

/* ------------------------------------------------------------------ *
 * Traductions — domaine vers serveur.
 * ------------------------------------------------------------------ */

function versChargeNiveau(niveau: NiveauGabarit) {
  return {
    libelle: niveau.libelle.trim(),
    liste: niveau.liste ? { origine: niveau.liste.origine, id: niveau.liste.id } : null,
    alerter: niveau.alerter,
  };
}

function versChargeLigne(ligne: LigneTableau) {
  return {
    cellules: ligne.cellules,
    unite: ligne.unite,
    quantite: ligne.quantite,
    montant: ligne.montant === null ? null : Math.round(ligne.montant),
    date_debut: ligne.dateDebut || null,
    date_fin: ligne.dateFin || null,
  };
}

function versChargeTableau(tableau: Pick<TableauDemarrage, "niveaux" | "lignes">) {
  return {
    niveaux: tableau.niveaux.map(versChargeNiveau),
    lignes: tableau.lignes.map(versChargeLigne),
  };
}

/* ------------------------------------------------------------------ *
 * Listes et modèles.
 * ------------------------------------------------------------------ */

export async function listerListes(signal?: AbortSignal): Promise<ListeValeurs[]> {
  const charge = await api.lire<ChargeListeValeurs[] | ChargeListePaginee<ChargeListeValeurs>>(
    "/decoupage/listes/",
    undefined,
    signal,
  );
  return aPlat(charge).map(versListe);
}

/** Les modèles, ceux du type de projet en tête et le modèle par défaut d'abord. */
export async function listerModeles(
  typeProjet: string | null,
  signal?: AbortSignal,
): Promise<ResumeModele[]> {
  const charge = await api.lire<ChargeResumeModele[] | ChargeListePaginee<ChargeResumeModele>>(
    "/decoupage/modeles/",
    typeProjet ? { type_projet: typeProjet } : undefined,
    signal,
  );
  return aPlat(charge).map(versResumeModele);
}

/* ------------------------------------------------------------------ *
 * Tableau de démarrage.
 * ------------------------------------------------------------------ */

/** Le tableau pré-rempli : le modèle demandé, sinon celui par défaut du type de projet. */
export async function lireTableauDemarrage(
  projetId: string,
  modele: Pick<ModeleApplique, "origine" | "id"> | null,
  signal?: AbortSignal,
): Promise<TableauDemarrage> {
  const charge = await api.lire<ChargeTableau>(
    `/projets/${projetId}/decoupage/`,
    modele ? { modele_origine: modele.origine, modele_id: modele.id } : undefined,
    signal,
  );
  const niveaux = (charge.niveaux ?? []).map(versNiveauGabarit);
  return {
    modele: charge.modele,
    niveaux,
    lignes: (charge.lignes ?? []).map((ligne) => versLigne(ligne, niveaux.length)),
  };
}

/** Le verdict du serveur sur le tableau (C-1 à C-7), sans rien écrire. */
export async function verifierTableau(
  projetId: string,
  tableau: Pick<TableauDemarrage, "niveaux" | "lignes">,
): Promise<VerdictTableau> {
  return versVerdict(
    await api.creer<ChargeVerdict>(
      `/projets/${projetId}/decoupage/verifier/`,
      versChargeTableau(tableau),
    ),
  );
}

/**
 * Un fichier Excel (.xlsx) ou CSV devient un tableau, vérifié ; rien n'est écrit.
 *
 * La colonne « Montant (FCFA) » est lue par le serveur **sans conversion** et rangée telle
 * quelle dans un champ en centimes — c'est aussi ce que son export écrit. Le domaine reprend
 * donc la valeur comme des centimes, pour qu'un fichier exporté se réimporte à l'identique.
 */
export async function importerFichier(projetId: string, fichier: File): Promise<TableauImporte> {
  const corps = new FormData();
  corps.append("fichier", fichier, fichier.name);
  const charge = await api.creer<ChargeImport>(`/projets/${projetId}/decoupage/importer/`, corps);
  const niveaux = (charge.niveaux ?? []).map(versNiveauGabarit);
  return {
    niveaux,
    lignes: (charge.lignes ?? []).map((ligne) => versLigne(ligne, niveaux.length)),
    verification: versVerdict(charge.verification),
  };
}

/** L'arbre d'un projet déjà découpé, au format du tableau (une ligne par tâche). */
export async function exporterArbre(projetId: string, format: "xlsx" | "csv"): Promise<Blob> {
  return api.telecharger(`/projets/${projetId}/decoupage/exporter/`, { type: format });
}

/**
 * Le refus d'une application, s'il en est un : des bloquants, ou des avertissements à
 * confirmer (`confirmation_requise`). Toute autre erreur reste une `ErreurApi` ordinaire.
 */
export function refusTableau(erreur: unknown): RefusTableau | null {
  if (!(erreur instanceof ErreurApi) || erreur.code !== "regle_metier") return null;
  const details = erreur.details as unknown as {
    bloquants?: ChargeConstat[];
    avertissements?: ChargeConstat[];
    confirmation_requise?: boolean;
  };
  if (!details.bloquants && !details.avertissements) return null;
  return {
    bloquants: (details.bloquants ?? []).map(versConstat),
    avertissements: (details.avertissements ?? []).map(versConstat),
    confirmationRequise: details.confirmation_requise === true,
  };
}

/**
 * Applique le tableau : sur un projet sans découpage, crée le gabarit et l'arbre ; sur un
 * projet déjà découpé, ajoute les branches nouvelles (rapprochées par chemin).
 */
export async function appliquerTableau(
  projetId: string,
  tableau: Pick<TableauDemarrage, "niveaux" | "lignes">,
  confirmerAvertissements: boolean,
): Promise<ResultatApplication> {
  const charge = await api.creer<ChargeApplication>(`/projets/${projetId}/decoupage/`, {
    ...versChargeTableau(tableau),
    confirmer_avertissements: confirmerAvertissements,
  });
  return {
    casesCreees: charge.cases_creees,
    lignesDejaPresentes: charge.lignes_deja_presentes ?? [],
  };
}

/* ------------------------------------------------------------------ *
 * L'arbre et ses gestes.
 * ------------------------------------------------------------------ */

interface ChargeNiveauProjet {
  id: string;
  ordre: number;
  libelle: string;
  alerter?: boolean;
  liste: ChargeReference | null;
}

interface ChargeEquipeCase {
  affectation_id: string;
  equipe_id: string;
  nom: string;
  nature?: string;
}

/** Une case : les champs au-delà de `acces` manquent quand l'accès est `CHEMIN`. */
interface ChargeCase {
  id: string;
  parent_id: string | null;
  libelle: string;
  numero: string | null;
  niveau: { id: string; ordre: number | null; libelle: string | null };
  est_feuille: boolean;
  acces: "COMPLET" | "CHEMIN";
  code?: string;
  ordre?: number;
  est_actif?: boolean;
  statut?: string;
  suspendu?: boolean;
  cloture?: boolean;
  commence?: boolean;
  motif?: string;
  mode_mesure?: string | null;
  unite?: string | null;
  /** Des `DecimalField` : chaînes possibles. */
  quantite_initiale?: number | string | null;
  quantite_prevue?: number | string | null;
  quantite_realisee?: number | string | null;
  pourcentage_declare?: number | string | null;
  a_completer?: boolean;
  depassement?: number | null;
  a_cloturer?: boolean;
  taches_en_depassement?: number | null;
  avancement?: number | string | null;
  avancement_partiel?: boolean;
  avancement_disponible?: boolean;
  poids?: number | null;
  montant?: number | null;
  montant_initial?: number | null;
  enveloppe?: number | null;
  somme_enfants?: number | null;
  depasse_enveloppe?: boolean;
  date_debut_prevue?: string | null;
  date_fin_prevue?: string | null;
  date_debut_baseline?: string | null;
  date_fin_baseline?: string | null;
  date_debut_reelle?: string | null;
  date_fin_reelle?: string | null;
  jours_accordes?: number;
  date_fin_contractuelle?: string | null;
  mode_execution?: string;
  mode_execution_effectif?: string;
  type_bordereau?: string;
  type_bordereau_effectif?: string;
  titulaire_id?: string | null;
  titulaire_effectif_id?: string | null;
  equipes?: ChargeEquipeCase[];
  equipes_heritees_de?: string | null;
  enfants?: ChargeCase[];
}

interface ChargeArbre {
  projet_id: string;
  niveaux: ChargeNiveauProjet[];
  avancement: number | null;
  avancement_disponible?: boolean;
  avancement_partiel?: boolean;
  voit_tout?: boolean;
  cases: ChargeCase[];
}

/** Une case du planning du serveur : seuls le temporel et l'écart en sont repris. */
interface ChargeCasePlanning {
  id: string;
  avancement_temporel: number | null;
  delta_retard: number | null;
  enfants?: ChargeCasePlanning[];
}

interface ChargePlanningArbre {
  aujourdhui: string;
  cases: ChargeCasePlanning[];
}

interface ChargeProlongation {
  type: "PROJET" | "ELEMENT";
  id: string;
  libelle: string | null;
  date_debut_avant: string | null;
  date_fin_avant: string | null;
  date_debut_apres: string | null;
  date_fin_apres: string | null;
}

function versModeMesure(valeur: string | null | undefined): ModeMesure | null {
  return (MODES_MESURE as readonly string[]).includes(valeur ?? "") ? (valeur as ModeMesure) : null;
}

function versNiveauProjet(charge: ChargeNiveauProjet): NiveauProjet {
  return {
    id: charge.id,
    ordre: charge.ordre,
    libelle: charge.libelle,
    alerter: charge.alerter ?? false,
    liste: versReference(charge.liste),
  };
}

function versEquipeCase(charge: ChargeEquipeCase): EquipeCase {
  return {
    affectationId: charge.affectation_id,
    equipeId: charge.equipe_id,
    nom: charge.nom,
    nature: charge.nature ?? "",
  };
}

type Temporels = Map<string, { temporel: number | null; ecart: number | null }>;

function versCase(charge: ChargeCase, temporels: Temporels): CaseArbre {
  const temporel = temporels.get(charge.id);
  return {
    id: charge.id,
    parentId: charge.parent_id,
    libelle: charge.libelle,
    numero: charge.numero,
    niveau: charge.niveau,
    estFeuille: charge.est_feuille,
    acces: charge.acces,
    code: charge.code ?? "",
    ordre: charge.ordre ?? 0,
    estActif: charge.est_actif ?? true,
    statut: charge.statut ?? "",
    suspendu: charge.suspendu ?? false,
    cloture: charge.cloture ?? false,
    commence: charge.commence ?? false,
    motif: charge.motif ?? "",
    modeMesure: versModeMesure(charge.mode_mesure),
    unite: versUnite(charge.unite),
    quantiteInitiale: versNombre(charge.quantite_initiale),
    quantitePrevue: versNombre(charge.quantite_prevue),
    quantiteRealisee: versNombre(charge.quantite_realisee),
    pourcentageDeclare: versNombre(charge.pourcentage_declare),
    aCompleter: charge.a_completer ?? false,
    depassement: charge.depassement ?? null,
    aCloturer: charge.a_cloturer ?? false,
    tachesEnDepassement: charge.taches_en_depassement ?? null,
    avancement: versNombre(charge.avancement),
    avancementPartiel: charge.avancement_partiel ?? false,
    avancementDisponible: charge.avancement_disponible ?? false,
    avancementTemporel: temporel?.temporel ?? null,
    ecart: temporel?.ecart ?? null,
    poids: charge.poids ?? null,
    montant: charge.montant ?? null,
    montantInitial: charge.montant_initial ?? null,
    enveloppe: charge.enveloppe ?? null,
    sommeEnfants: charge.somme_enfants ?? null,
    depasseEnveloppe: charge.depasse_enveloppe ?? false,
    dateDebutPrevue: charge.date_debut_prevue ?? null,
    dateFinPrevue: charge.date_fin_prevue ?? null,
    dateDebutBaseline: charge.date_debut_baseline ?? null,
    dateFinBaseline: charge.date_fin_baseline ?? null,
    dateDebutReelle: charge.date_debut_reelle ?? null,
    dateFinReelle: charge.date_fin_reelle ?? null,
    joursAccordes: charge.jours_accordes ?? 0,
    dateFinContractuelle: charge.date_fin_contractuelle ?? null,
    modeExecution: charge.mode_execution ?? "",
    modeExecutionEffectif: charge.mode_execution_effectif ?? "",
    typeBordereau: charge.type_bordereau ?? "",
    typeBordereauEffectif: charge.type_bordereau_effectif ?? "",
    titulaireId: charge.titulaire_id ?? null,
    titulaireEffectifId: charge.titulaire_effectif_id ?? null,
    equipes: (charge.equipes ?? []).map(versEquipeCase),
    equipesHeriteesDe: charge.equipes_heritees_de ?? null,
    enfants: (charge.enfants ?? []).map((enfant) => versCase(enfant, temporels)),
  };
}

function aplatirTemporels(cases: ChargeCasePlanning[], dans: Temporels = new Map()): Temporels {
  for (const charge of cases) {
    dans.set(charge.id, { temporel: charge.avancement_temporel, ecart: charge.delta_retard });
    aplatirTemporels(charge.enfants ?? [], dans);
  }
  return dans;
}

function versProlongation(charge: ChargeProlongation): Prolongation {
  return {
    type: charge.type,
    id: charge.id,
    libelle: charge.libelle ?? "",
    dateDebutAvant: charge.date_debut_avant,
    dateFinAvant: charge.date_fin_avant,
    dateDebutApres: charge.date_debut_apres,
    dateFinApres: charge.date_fin_apres,
  };
}

/**
 * L'arbre du projet, imbriqué, tel que le périmètre de la personne le laisse voir.
 *
 * Le serveur ne porte le temporel et l'écart de chaque case que sur son planning : les deux
 * lectures partent ensemble et sont réunies ici. Un planning illisible ne fait pas échouer
 * l'arbre : ses deux colonnes restent vides.
 */
export async function lireArbre(projetId: string, signal?: AbortSignal): Promise<ArbreProjet> {
  const [arbre, planning] = await Promise.all([
    api.lire<ChargeArbre>(`/projets/${projetId}/arbre/`, undefined, signal),
    api
      .lire<ChargePlanningArbre>(`/projets/${projetId}/planning/`, undefined, signal)
      .catch((): ChargePlanningArbre | null => null),
  ]);
  const temporels = aplatirTemporels(planning?.cases ?? []);
  return {
    projetId: arbre.projet_id,
    niveaux: (arbre.niveaux ?? []).map(versNiveauProjet),
    avancement: arbre.avancement,
    avancementDisponible: arbre.avancement_disponible ?? arbre.avancement !== null,
    avancementPartiel: arbre.avancement_partiel ?? false,
    voitTout: arbre.voit_tout ?? true,
    cases: (arbre.cases ?? []).map((charge) => versCase(charge, temporels)),
  };
}

/** Le refus d'une planification qui déborde du parent : les cases à prolonger. */
export function prolongationsRequises(erreur: unknown): Prolongation[] | null {
  if (!(erreur instanceof ErreurApi) || erreur.code !== "prolongation_requise") return null;
  const details = erreur.details as unknown as { prolongations?: ChargeProlongation[] };
  return (details.prolongations ?? []).map(versProlongation);
}

function sansIndefinis(charge: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(charge).filter(([, valeur]) => valeur !== undefined));
}

export async function creerCase(projetId: string, creation: CreationCase): Promise<CaseArbre> {
  const charge = await api.creer<ChargeCase>(
    `/projets/${projetId}/elements/`,
    sansIndefinis({
      parent_id: creation.parentId,
      libelle: creation.libelle,
      code: creation.code,
      mode_mesure: creation.modeMesure,
      unite: creation.unite,
      quantite_prevue: creation.quantitePrevue,
      montant: creation.montant,
      date_debut_prevue: creation.dateDebutPrevue,
      date_fin_prevue: creation.dateFinPrevue,
      motif: creation.motif,
    }),
  );
  return versCase(charge, new Map());
}

export async function modifierCase(caseId: string, modification: ModificationCase): Promise<CaseArbre> {
  const charge = await api.modifier<ChargeCase>(
    `/elements/${caseId}/`,
    sansIndefinis({
      libelle: modification.libelle,
      code: modification.code,
      mode_mesure: modification.modeMesure,
      unite: modification.unite,
      quantite_prevue: modification.quantitePrevue,
      montant: modification.montant,
      enveloppe: modification.enveloppe,
      motif: modification.motif,
    }),
  );
  return versCase(charge, new Map());
}

/**
 * La première saisie des dates d'une case. Des dates qui débordent du parent sont refusées
 * (`prolongation_requise`, voir `prolongationsRequises`) ; on confirme avec `prolonger`, un
 * motif de report et une justification.
 */
export async function planifierCase(
  caseId: string,
  planification: Planification,
): Promise<{ case: CaseArbre; prolongations: Prolongation[] }> {
  const charge = await api.creer<{ case: ChargeCase; prolongations?: ChargeProlongation[] }>(
    `/elements/${caseId}/planifier/`,
    sansIndefinis({
      date_debut_prevue: planification.dateDebutPrevue,
      date_fin_prevue: planification.dateFinPrevue,
      prolonger: planification.prolonger,
      motif_id: planification.motifId ?? undefined,
      justification: planification.justification,
    }),
  );
  return {
    case: versCase(charge.case, new Map()),
    prolongations: (charge.prolongations ?? []).map(versProlongation),
  };
}

export async function mesurerCase(caseId: string, mesure: Mesure): Promise<CaseArbre> {
  const charge = await api.creer<ChargeCase>(
    `/elements/${caseId}/mesure/`,
    sansIndefinis({
      quantite_realisee: mesure.quantiteRealisee,
      pourcentage_declare: mesure.pourcentageDeclare,
      atteint: mesure.atteint,
      commentaire: mesure.commentaire,
    }),
  );
  return versCase(charge, new Map());
}

export async function cloturerCase(caseId: string): Promise<CaseArbre> {
  return versCase(await api.creer<ChargeCase>(`/elements/${caseId}/cloturer/`, {}), new Map());
}

/** Sortir une case des calculs ; elle garde son historique. Motif de 10 caractères au moins. */
export async function desactiverCase(caseId: string, motif: string): Promise<CaseArbre> {
  return versCase(
    await api.creer<ChargeCase>(`/elements/${caseId}/desactiver/`, { motif }),
    new Map(),
  );
}

export async function reactiverCase(caseId: string): Promise<CaseArbre> {
  return versCase(await api.creer<ChargeCase>(`/elements/${caseId}/reactiver/`, {}), new Map());
}

export async function modifierNiveau(
  projetId: string,
  niveauId: string,
  modification: ModificationNiveau,
): Promise<NiveauProjet> {
  return versNiveauProjet(
    await api.modifier<ChargeNiveauProjet>(
      `/projets/${projetId}/niveaux/${niveauId}/`,
      sansIndefinis({
        libelle: modification.libelle,
        liste:
          modification.liste === undefined
            ? undefined
            : modification.liste && { origine: modification.liste.origine, id: modification.liste.id },
        alerter: modification.alerter,
      }),
    ),
  );
}

/** Ajoute un niveau à la fin du gabarit (A-3). */
export async function ajouterNiveauProjet(
  projetId: string,
  niveau: { libelle: string; liste: Pick<ReferenceListe, "origine" | "id"> | null; alerter: boolean },
): Promise<NiveauProjet> {
  return versNiveauProjet(
    await api.creer<ChargeNiveauProjet>(`/projets/${projetId}/niveaux/`, {
      libelle: niveau.libelle,
      liste: niveau.liste && { origine: niveau.liste.origine, id: niveau.liste.id },
      alerter: niveau.alerter,
    }),
  );
}

/* ------------------------------------------------------------------ *
 * La courbe en S.
 * ------------------------------------------------------------------ */

interface ChargeCourbe {
  element_id: string | null;
  debut: string | null;
  fin_prevue: string | null;
  fin_contractuelle: string | null;
  prevu: { date: string; valeur: number | null }[];
  reel: { date: string; valeur: number | null }[];
  rythme_par_semaine: number | null;
  fin_estimee: string | null;
}

/** Le prévu, le réel et la fin estimée du projet, ou d'une case (`caseId`). */
export async function lireCourbe(
  projetId: string,
  caseId: string | null,
  signal?: AbortSignal,
): Promise<CourbeAvancement> {
  const charge = await api.lire<ChargeCourbe>(
    `/projets/${projetId}/courbe/`,
    caseId ? { element: caseId } : undefined,
    signal,
  );
  return {
    caseId: charge.element_id,
    debut: charge.debut,
    finPrevue: charge.fin_prevue,
    finContractuelle: charge.fin_contractuelle,
    prevu: charge.prevu ?? [],
    reel: charge.reel ?? [],
    rythmeParSemaine: charge.rythme_par_semaine,
    finEstimee: charge.fin_estimee,
  };
}

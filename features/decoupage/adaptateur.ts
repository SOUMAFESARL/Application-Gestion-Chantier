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
 *
 * Les charges (`Charge*`) sont privées : elles décrivent un transport.
 */

import { api, ErreurApi } from "@/lib/api";

import { nouvelleCleLigne } from "./regles";
import type {
  ConstatTableau,
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
import { UNITES_MESURE } from "./types";

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

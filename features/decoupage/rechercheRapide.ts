/**
 * Moteur pur de recherche rapide multicritères partagé entre le Découpage et le Planning.
 *
 * **Zéro React, zéro appel réseau, zéro texte français en dur.**
 * Respecte strictement le droit `voitMontants` : sans ce droit, les critères
 * de montant sont ignorés et aucun montant n'est exposé dans les résultats.
 */

import type { CaseArbre } from "@/features/decoupage/types";
import type { CasePlanning } from "@/features/planning/types";

export type AccesElementRecherche = "COMPLET" | "CHEMIN";
export type NatureElementRecherche = "" | "FEUILLE" | "PARENT" | "JALON";

export interface ElementRecherchable {
  id: string;
  libelle: string;
  code: string;
  numero: string | null;
  niveau: string | null;
  statut: string;
  estFeuille: boolean;
  estJalon: boolean;
  estActif: boolean;
  acces: AccesElementRecherche;
  dateDebut: string | null;
  dateFin: string | null;
  /** Montant en centimes (`null` si absent, hors périmètre ou sans `voitMontants`). */
  montant: number | null;
  avancement: number | null;
  cheminAncetresIds: string[];
  filAriane: string[];
}

export interface CriteresRechercheElements {
  texte: string;
  dateDebut: string;
  dateFin: string;
  montantMinFcfa: string;
  montantMaxFcfa: string;
  statut: string;
  niveau: string;
  nature: NatureElementRecherche;
}

export interface OptionsRechercheElements {
  voitMontants: boolean;
}

export const CRITERES_RECHERCHE_ELEMENTS_VIDES: CriteresRechercheElements = {
  texte: "",
  dateDebut: "",
  dateFin: "",
  montantMinFcfa: "",
  montantMaxFcfa: "",
  statut: "",
  niveau: "",
  nature: "",
};

function normaliserTexte(valeur: string | null | undefined): string {
  if (!valeur) return "";
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function parserBorneDateIso(valeur: string): string | null {
  const court = valeur.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(court) ? court : null;
}

function parserMontantFcfaEnCentimes(valeur: string): number | null {
  const nettoye = valeur.replace(/[\s\u00a0]/g, "").replace(",", ".");
  if (!nettoye) return null;
  const nombre = Number(nettoye);
  if (!Number.isFinite(nombre) || nombre < 0) return null;
  return Math.round(nombre * 100);
}

/**
 * Aplatit l'arbre du Découpage (`CaseArbre[]`) en liste d'éléments normalisés
 * dans l'ordre hiérarchique naturel, avec chemin d'ancêtres et fil d'Ariane.
 */
export function aplatirArbreDecoupagePourRecherche(
  cases: readonly CaseArbre[],
): ElementRecherchable[] {
  const resultat: ElementRecherchable[] = [];

  function parcourir(
    liste: readonly CaseArbre[],
    ancetresIds: readonly string[],
    ancetresLibelles: readonly string[],
  ) {
    for (const une of liste) {
      const complet = une.acces === "COMPLET";
      const statutNormalise = !une.estActif
        ? "DESACTIVE"
        : une.statut ||
          (une.cloture
            ? "CLOTURE"
            : une.suspendu
              ? "SUSPENDU"
              : une.commence
                ? "EN_COURS"
                : "PLANIFIE");
      const montantBrut = une.estFeuille ? une.montant : (une.poids ?? une.montant);

      resultat.push({
        id: une.id,
        libelle: une.libelle,
        code: une.code ?? "",
        numero: une.numero ?? null,
        niveau: une.niveau?.libelle ?? null,
        statut: statutNormalise,
        estFeuille: une.estFeuille,
        estJalon: une.estFeuille && une.modeMesure === "JALON",
        estActif: une.estActif,
        acces: une.acces,
        dateDebut: complet ? (une.dateDebutPrevue ?? null) : null,
        dateFin: complet ? (une.dateFinPrevue ?? null) : null,
        montant: complet ? (montantBrut ?? null) : null,
        avancement: complet && une.avancementDisponible ? une.avancement : null,
        cheminAncetresIds: [...ancetresIds],
        filAriane: [...ancetresLibelles],
      });

      if (une.enfants.length > 0) {
        parcourir(une.enfants, [...ancetresIds, une.id], [...ancetresLibelles, une.libelle]);
      }
    }
  }

  parcourir(cases, [], []);
  return resultat;
}

/**
 * Aplatit l'arbre du Planning (`CasePlanning[]`) en liste d'éléments normalisés
 * dans l'ordre hiérarchique naturel, avec chemin d'ancêtres et fil d'Ariane.
 */
export function aplatirArbrePlanningPourRecherche(
  cases: readonly CasePlanning[],
): ElementRecherchable[] {
  const resultat: ElementRecherchable[] = [];

  function parcourir(
    liste: readonly CasePlanning[],
    ancetresIds: readonly string[],
    ancetresLibelles: readonly string[],
  ) {
    for (const item of liste) {
      const complet = item.acces === "COMPLET";
      resultat.push({
        id: item.id,
        libelle: item.libelle,
        code: item.code ?? "",
        numero: item.numero ?? null,
        niveau: item.niveau ?? null,
        statut: item.statut,
        estFeuille: item.estFeuille,
        estJalon: item.estFeuille && item.modeMesure === "JALON",
        estActif: true,
        acces: item.acces,
        dateDebut: complet ? (item.debutPrevu ?? item.debut ?? null) : null,
        dateFin: complet ? (item.finPrevue ?? item.fin ?? null) : null,
        montant: complet ? (item.montant ?? null) : null,
        avancement: complet ? item.avancement : null,
        cheminAncetresIds: [...ancetresIds],
        filAriane: [...ancetresLibelles],
      });

      if (item.enfants.length > 0) {
        parcourir(item.enfants, [...ancetresIds, item.id], [...ancetresLibelles, item.libelle]);
      }
    }
  }

  parcourir(cases, [], []);
  return resultat;
}

/** Compte les filtres avancés actifs (hors saisie texte). */
export function compterFiltresAvancesActifs(
  criteres: CriteresRechercheElements,
  options: OptionsRechercheElements,
): number {
  let total = 0;
  if (parserBorneDateIso(criteres.dateDebut) || parserBorneDateIso(criteres.dateFin)) total += 1;
  if (
    options.voitMontants &&
    (parserMontantFcfaEnCentimes(criteres.montantMinFcfa) !== null ||
      parserMontantFcfaEnCentimes(criteres.montantMaxFcfa) !== null)
  ) {
    total += 1;
  }
  if (criteres.statut !== "") total += 1;
  if (criteres.niveau !== "") total += 1;
  if (criteres.nature !== "") total += 1;
  return total;
}

/** Vrai dès qu'au moins un critère (texte ou filtre avancé) est renseigné. */
export function aCriteresRechercheActifs(
  criteres: CriteresRechercheElements,
  options: OptionsRechercheElements,
): boolean {
  return (
    normaliserTexte(criteres.texte) !== "" ||
    compterFiltresAvancesActifs(criteres, options) > 0
  );
}

/** Extrait la liste ordonnée des statuts distincts présents dans les éléments accessibles. */
export function extraireStatutsDisponibles(elements: readonly ElementRecherchable[]): string[] {
  const vus = new Set<string>();
  for (const el of elements) {
    if (el.acces === "COMPLET" && el.statut) {
      vus.add(el.statut);
    }
  }
  return [...vus];
}

/** Extrait la liste ordonnée des niveaux distincts présents dans les éléments. */
export function extraireNiveauxDisponibles(elements: readonly ElementRecherchable[]): string[] {
  const vus = new Set<string>();
  for (const el of elements) {
    if (el.niveau) {
      vus.add(el.niveau);
    }
  }
  return [...vus];
}

function correspondPeriode(
  el: ElementRecherchable,
  debutFiltre: string | null,
  finFiltre: string | null,
): boolean {
  if (!debutFiltre && !finFiltre) return true;
  if (el.acces !== "COMPLET") return false;
  const brutDebut = parserBorneDateIso(el.dateDebut ?? el.dateFin ?? "");
  const brutFin = parserBorneDateIso(el.dateFin ?? el.dateDebut ?? "");
  if (!brutDebut || !brutFin) return false;

  const elDebut = brutDebut <= brutFin ? brutDebut : brutFin;
  const elFin = brutDebut <= brutFin ? brutFin : brutDebut;

  if (debutFiltre && finFiltre) {
    const borneMin = debutFiltre <= finFiltre ? debutFiltre : finFiltre;
    const borneMax = debutFiltre <= finFiltre ? finFiltre : debutFiltre;
    return elDebut <= borneMax && elFin >= borneMin;
  }
  if (debutFiltre) return elFin >= debutFiltre;
  if (finFiltre) return elDebut <= finFiltre;
  return true;
}

function correspondNature(el: ElementRecherchable, nature: NatureElementRecherche): boolean {
  if (nature === "") return true;
  if (nature === "FEUILLE") return el.estFeuille;
  if (nature === "PARENT") return !el.estFeuille;
  if (nature === "JALON") return el.estJalon;
  return true;
}

function scorePertinenceTexte(el: ElementRecherchable, requeteNorm: string): number {
  if (!requeteNorm) return 0;
  const codeNorm = normaliserTexte(el.code);
  const numeroNorm = normaliserTexte(el.numero);
  const libelleNorm = normaliserTexte(el.libelle);

  if (codeNorm === requeteNorm || numeroNorm === requeteNorm) return 0;
  if (
    (codeNorm && codeNorm.startsWith(requeteNorm)) ||
    libelleNorm.startsWith(requeteNorm) ||
    (numeroNorm && numeroNorm.startsWith(requeteNorm))
  ) {
    return 1;
  }
  if (libelleNorm.includes(requeteNorm) || (codeNorm && codeNorm.includes(requeteNorm))) {
    return 2;
  }
  return 3;
}

/**
 * Filtre et trie par pertinence les éléments selon les critères multicritères.
 * Ignore les critères de montant et masque `montant` lorsque `voitMontants` est faux.
 */
export function rechercherElements(
  elements: readonly ElementRecherchable[],
  criteres: CriteresRechercheElements,
  options: OptionsRechercheElements,
): ElementRecherchable[] {
  const requeteNorm = normaliserTexte(criteres.texte);
  const termes = requeteNorm ? requeteNorm.split(/\s+/).filter(Boolean) : [];
  const debutFiltre = parserBorneDateIso(criteres.dateDebut);
  const finFiltre = parserBorneDateIso(criteres.dateFin);

  const minCentimes = options.voitMontants
    ? parserMontantFcfaEnCentimes(criteres.montantMinFcfa)
    : null;
  const maxCentimes = options.voitMontants
    ? parserMontantFcfaEnCentimes(criteres.montantMaxFcfa)
    : null;
  const aFiltreMontant = minCentimes !== null || maxCentimes !== null;

  const correspondances: { element: ElementRecherchable; score: number; index: number }[] = [];

  for (let index = 0; index < elements.length; index += 1) {
    const el = elements[index];

    if (criteres.statut && (el.acces !== "COMPLET" || el.statut !== criteres.statut)) {
      continue;
    }
    if (criteres.niveau && (el.niveau ?? "") !== criteres.niveau) {
      continue;
    }
    if (!correspondNature(el, criteres.nature)) {
      continue;
    }
    if (!correspondPeriode(el, debutFiltre, finFiltre)) {
      continue;
    }

    if (aFiltreMontant) {
      if (el.acces !== "COMPLET" || el.montant === null) continue;
      if (minCentimes !== null && el.montant < minCentimes) continue;
      if (maxCentimes !== null && el.montant > maxCentimes) continue;
    }

    if (termes.length > 0) {
      const champsTexte = [
        normaliserTexte(el.code),
        normaliserTexte(el.numero),
        normaliserTexte(el.libelle),
        normaliserTexte(el.niveau),
        ...el.filAriane.map(normaliserTexte),
      ];
      const tousTermesPresents = termes.every((terme) =>
        champsTexte.some((champ) => champ.includes(terme)),
      );
      if (!tousTermesPresents) continue;
    }

    const elementSecurise: ElementRecherchable = options.voitMontants
      ? el
      : { ...el, montant: null };

    correspondances.push({
      element: elementSecurise,
      score: scorePertinenceTexte(el, requeteNorm),
      index,
    });
  }

  if (requeteNorm) {
    correspondances.sort((a, b) => a.score - b.score || a.index - b.index);
  }

  return correspondances.map((entree) => entree.element);
}

/**
 * Filtre un arbre générique en conservant uniquement les nœuds dont l'identifiant
 * figure dans `idsCorrespondants` ainsi que leurs ancêtres directs et indirects.
 */
export function filtrerArbreParIds<T extends { id: string; enfants: T[] }>(
  cases: readonly T[],
  idsCorrespondants: ReadonlySet<string>,
): T[] {
  const resultat: T[] = [];
  for (const item of cases) {
    const enfantsFiltres = filtrerArbreParIds(item.enfants, idsCorrespondants);
    if (idsCorrespondants.has(item.id) || enfantsFiltres.length > 0) {
      resultat.push({
        ...item,
        enfants: enfantsFiltres,
      });
    }
  }
  return resultat;
}

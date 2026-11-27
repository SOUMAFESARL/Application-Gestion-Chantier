/**
 * Règles métier et calculs géométriques du domaine Planning (Gantt & MS Project).
 *
 * **Pur et sans React.** Aucun appel réseau, aucun état d'interface, aucune chaîne
 * française en dur : les intitulés de graduation viennent d'`Intl.DateTimeFormat` en UTC.
 */

import { UNITE_AVANCEMENT } from "@/lib/format";

import type {
  AnalyseMsProject,
  BornesGantt,
  CasePlanning,
  DependancePlanning,
  EchelleGantt,
  FlecheGantt,
  GeometrieBarreGantt,
  GraduationGantt,
  GroupeGraduationGantt,
  IndicateursPlanning,
  LigneExportPlanning,
  LigneGantt,
  PlanningGantt,
  ProjetXmlApercu,
  TacheMsProject,
  TypeDependance,
} from "./types";

/** Les quatre échelles de zoom du diagramme de Gantt, de la plus fine à la plus large. */
export const ECHELLES_GANTT: readonly EchelleGantt[] = ["JOUR", "SEMAINE", "MOIS", "TRIMESTRE"];

/** Les quatre types de dépendances planning supportés. */
export const TYPES_DEPENDANCE: readonly TypeDependance[] = ["FS", "SS", "FF", "SF"];

/** Parité fixe officielle Euro → Franc CFA (XOF). */
export const TAUX_CONVERSION_EUR_FCFA = 655.957;

/** Hauteur uniforme (px) de chaque ligne du panneau arbre et de la frise SVG. */
export const HAUTEUR_LIGNE_GANTT = 40;

/** Hauteur de l'en-tête double niveau du diagramme (24 px supérieur + 28 px inférieur). */
export const HAUTEUR_ENTETE_GANTT = 52;

/** Largeur d'une journée calendaire (px) selon le niveau de zoom. */
export const LARGEUR_JOUR_PAR_ECHELLE: Record<EchelleGantt, number> = {
  JOUR: 32,
  SEMAINE: 14,
  MOIS: 5,
  TRIMESTRE: 2.2,
};

/** Marge minimale (en jours) ajoutée de part et d'autre des dates du projet. */
const MARGE_JOURS_PAR_ECHELLE: Record<EchelleGantt, number> = {
  JOUR: 7,
  SEMAINE: 14,
  MOIS: 28,
  TRIMESTRE: 45,
};

/** Emprise minimale (en jours) garantie pour garder une frise lisible même sur un chantier court. */
const DUREE_MIN_JOURS_PAR_ECHELLE: Record<EchelleGantt, number> = {
  JOUR: 35,
  SEMAINE: 84,
  MOIS: 180,
  TRIMESTRE: 365,
};

/**
 * Seuil de retard (en points de `deltaRetard = temporel − physique`).
 * Miroir exact de `SEUIL_RETARD_POINTS = -5` dans `features/projets/regles.ts`.
 */
export const SEUIL_RETARD_GANTT = 5;

/** Taille maximale autorisée pour un export XML MS Project (20 Mo, alignée sur le serveur). */
export const TAILLE_MAX_FICHIER_MS_PROJECT = 20 * 1024 * 1024;

const JOUR_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * Utilitaires de dates ISO en UTC (aucun décalage de fuseau horaire).
 * ------------------------------------------------------------------ */

/** Parse `YYYY-MM-DD` (ou horodatage ISO) en Date à minuit UTC. */
export function parserDateIsoUtc(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const court = iso.slice(0, 10);
  const parties = court.split("-");
  if (parties.length !== 3) return null;
  const annee = Number.parseInt(parties[0], 10);
  const mois = Number.parseInt(parties[1], 10);
  const jour = Number.parseInt(parties[2], 10);
  if (!Number.isFinite(annee) || !Number.isFinite(mois) || !Number.isFinite(jour)) return null;
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Formate une Date UTC en `YYYY-MM-DD`. */
export function formaterDateIsoUtc(date: Date): string {
  const annee = date.getUTCFullYear();
  const mois = String(date.getUTCMonth() + 1).padStart(2, "0");
  const jour = String(date.getUTCDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/** Ajoute un nombre entier de jours calendaires en UTC. */
export function ajouterJoursUtc(date: Date, jours: number): Date {
  return new Date(date.getTime() + jours * JOUR_MS);
}

/** Nombre entier de jours entre deux dates UTC (`fin − debut`). */
export function diffJoursUtc(debut: Date, fin: Date): number {
  return Math.round((fin.getTime() - debut.getTime()) / JOUR_MS);
}

/** Numéro de semaine ISO-8601 (1..53) pour une date UTC. */
export function numeroSemaineIso(date: Date): number {
  const copie = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const jourSemaine = copie.getUTCDay() || 7;
  copie.setUTCDate(copie.getUTCDate() + 4 - jourSemaine);
  const debutAnnee = new Date(Date.UTC(copie.getUTCFullYear(), 0, 1));
  return Math.ceil(((copie.getTime() - debutAnnee.getTime()) / JOUR_MS + 1) / 7);
}

/** Date du jour en ISO court local. */
export function dateAujourdhuiIso(): string {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/* ------------------------------------------------------------------ *
 * Classification des cases et parcours de l'arbre.
 * ------------------------------------------------------------------ */

/** Vrai si la case feuille est un jalon (ponctuel, rendu en losange). */
export function estCaseJalon(item: Pick<CasePlanning, "estFeuille" | "modeMesure">): boolean {
  return item.estFeuille && item.modeMesure === "JALON";
}

/** Vrai si la case est signalée en retard (statut serveur ou dérive > seuil). */
export function estCaseEnRetard(item: Pick<CasePlanning, "statut" | "deltaRetard">): boolean {
  if (item.statut === "EN_RETARD") return true;
  return item.deltaRetard !== null && item.deltaRetard > SEUIL_RETARD_GANTT;
}

/**
 * Les dates actives affichées sur la barre principale du Gantt :
 * dates prévues courantes en priorité, sinon dates contractuelles (`debut`/`fin`).
 */
export function datesEffectivesCase(
  item: Pick<CasePlanning, "debut" | "fin" | "debutPrevu" | "finPrevue">,
): { debut: string | null; fin: string | null } {
  return {
    debut: item.debutPrevu ?? item.debut,
    fin: item.finPrevue ?? item.fin,
  };
}

/** Tous les identifiants des cases ayant des enfants (pour Tout déplier / Tout replier). */
export function collecterIdsParents(cases: readonly CasePlanning[]): string[] {
  const ids: string[] = [];
  function parcourir(liste: readonly CasePlanning[]) {
    for (const item of liste) {
      if (item.enfants.length > 0) {
        ids.push(item.id);
        parcourir(item.enfants);
      }
    }
  }
  parcourir(cases);
  return ids;
}

/** Toutes les tâches feuilles accessibles de l'arbre, dans l'ordre hiérarchique. */
export function collecterFeuilles(cases: readonly CasePlanning[]): CasePlanning[] {
  const feuilles: CasePlanning[] = [];
  function parcourir(liste: readonly CasePlanning[]) {
    for (const item of liste) {
      if (item.estFeuille) {
        feuilles.push(item);
      } else {
        parcourir(item.enfants);
      }
    }
  }
  parcourir(cases);
  return feuilles;
}

/** Retrouve une case par identifiant dans l'arbre, ou `null`. */
export function trouverCaseParId(cases: readonly CasePlanning[], id: string): CasePlanning | null {
  for (const item of cases) {
    if (item.id === id) return item;
    if (item.enfants.length > 0) {
      const trouvee = trouverCaseParId(item.enfants, id);
      if (trouvee) return trouvee;
    }
  }
  return null;
}

/**
 * Feuilles sélectionnables comme prédécesseurs FS d'une tâche cible :
 * exclut la cible elle-même, les cases hors périmètre (`CHEMIN`) et les liens déjà posés.
 */
export function candidatsPredecesseurs(
  feuilles: readonly CasePlanning[],
  cibleId: string,
  predecesseursExistants: ReadonlySet<string>,
): CasePlanning[] {
  return feuilles.filter(
    (feuille) =>
      feuille.id !== cibleId &&
      feuille.acces === "COMPLET" &&
      !predecesseursExistants.has(feuille.id),
  );
}

/* ------------------------------------------------------------------ *
 * Filtrage (recherche texte / retards) et aplatissement selon dépliage.
 * ------------------------------------------------------------------ */

function normaliserTexte(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * Filtre l'arbre en préservant le chemin hiérarchique de toute case correspondante.
 */
export function filtrerArbrePlanning(
  cases: readonly CasePlanning[],
  filtres: { recherche: string; retardsUniquement: boolean },
): CasePlanning[] {
  const requete = normaliserTexte(filtres.recherche);
  const aRecherche = requete.length > 0;
  const aRetard = filtres.retardsUniquement;

  if (!aRecherche && !aRetard) return [...cases];

  function correspondNoeud(item: CasePlanning): boolean {
    const okRecherche =
      !aRecherche ||
      normaliserTexte(item.libelle).includes(requete) ||
      normaliserTexte(item.numero ?? "").includes(requete) ||
      normaliserTexte(item.niveau ?? "").includes(requete);

    const okRetard = !aRetard || estCaseEnRetard(item);
    return okRecherche && okRetard;
  }

  function filtrerListe(liste: readonly CasePlanning[]): CasePlanning[] {
    const resultat: CasePlanning[] = [];
    for (const item of liste) {
      const enfantsFiltres = filtrerListe(item.enfants);
      const noeudOk = correspondNoeud(item);
      if (noeudOk || enfantsFiltres.length > 0) {
        resultat.push({
          ...item,
          enfants: enfantsFiltres.length > 0 ? enfantsFiltres : noeudOk && !aRetard ? item.enfants : [],
        });
      }
    }
    return resultat;
  }

  return filtrerListe(cases);
}

/**
 * Aplatit l'arbre visible dans l'ordre d'affichage en tenant compte des nœuds dépliés.
 */
export function aplatirArbrePlanning(
  cases: readonly CasePlanning[],
  noeudsDeplies: ReadonlySet<string>,
): LigneGantt[] {
  const lignes: LigneGantt[] = [];

  function parcourir(liste: readonly CasePlanning[], profondeur: number) {
    for (const item of liste) {
      const aEnfants = item.enfants.length > 0;
      const depliee = aEnfants && noeudsDeplies.has(item.id);
      lignes.push({
        caseItem: item,
        profondeur,
        aEnfants,
        depliee,
        estJalon: estCaseJalon(item),
        estEnRetard: estCaseEnRetard(item),
        indexLigne: lignes.length,
      });
      if (depliee) {
        parcourir(item.enfants, profondeur + 1);
      }
    }
  }

  parcourir(cases, 0);
  return lignes;
}

/* ------------------------------------------------------------------ *
 * Bornes temporelles et graduations (Jour / Semaine / Mois / Trimestre).
 * ------------------------------------------------------------------ */

function collecterToutesDates(
  cases: readonly CasePlanning[],
  projetDebut: string | null,
  projetFin: string | null,
): Date[] {
  const dates: Date[] = [];

  function pousser(iso: string | null | undefined) {
    const parsed = parserDateIsoUtc(iso);
    if (parsed) dates.push(parsed);
  }

  pousser(projetDebut);
  pousser(projetFin);

  function parcourir(liste: readonly CasePlanning[]) {
    for (const item of liste) {
      pousser(item.debut);
      pousser(item.fin);
      pousser(item.debutPrevu);
      pousser(item.finPrevue);
      pousser(item.debutBaseline);
      pousser(item.finBaseline);
      parcourir(item.enfants);
    }
  }

  parcourir(cases);
  return dates;
}

/** Calcule les bornes calendaires alignées et la largeur totale en pixels de la frise. */
export function calculerBornesGantt(
  cases: readonly CasePlanning[],
  aujourdhui: string,
  projetDebut: string | null,
  projetFin: string | null,
  echelle: EchelleGantt,
): BornesGantt {
  const dates = collecterToutesDates(cases, projetDebut, projetFin);
  const dateRef = parserDateIsoUtc(aujourdhui) ?? parserDateIsoUtc(dateAujourdhuiIso()) ?? new Date();

  let minDate: Date;
  let maxDate: Date;

  if (dates.length === 0) {
    minDate = ajouterJoursUtc(dateRef, -15);
    maxDate = ajouterJoursUtc(dateRef, 45);
  } else {
    let minMs = dates[0].getTime();
    let maxMs = dates[0].getTime();
    for (const d of dates) {
      const ms = d.getTime();
      if (ms < minMs) minMs = ms;
      if (ms > maxMs) maxMs = ms;
    }
    minDate = new Date(minMs);
    maxDate = new Date(maxMs);
  }

  const marge = MARGE_JOURS_PAR_ECHELLE[echelle];
  let debut = ajouterJoursUtc(minDate, -marge);
  let fin = ajouterJoursUtc(maxDate, marge);

  // Alignement propre du bord gauche selon l'échelle.
  if (echelle === "SEMAINE") {
    const jourSemaine = debut.getUTCDay() || 7;
    debut = ajouterJoursUtc(debut, -(jourSemaine - 1));
  } else if (echelle === "MOIS") {
    debut = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), 1));
  } else if (echelle === "TRIMESTRE") {
    const debutTrimestre = Math.floor(debut.getUTCMonth() / 3) * 3;
    debut = new Date(Date.UTC(debut.getUTCFullYear(), debutTrimestre, 1));
  }

  const dureeMin = DUREE_MIN_JOURS_PAR_ECHELLE[echelle];
  if (diffJoursUtc(debut, fin) < dureeMin) {
    fin = ajouterJoursUtc(debut, dureeMin);
  }

  const totalJours = Math.max(1, diffJoursUtc(debut, fin) + 1);
  const largeurJourPx = LARGEUR_JOUR_PAR_ECHELLE[echelle];

  return {
    debutIso: formaterDateIsoUtc(debut),
    finIso: formaterDateIsoUtc(fin),
    totalJours,
    largeurJourPx,
    largeurTotalePx: Math.round(totalJours * largeurJourPx),
  };
}

/** Abscisse horizontale (px) correspondant au début d'une date ISO sur la frise. */
export function xPourDate(iso: string, bornes: BornesGantt): number {
  const debut = parserDateIsoUtc(bornes.debutIso);
  const cible = parserDateIsoUtc(iso);
  if (!debut || !cible) return 0;
  return diffJoursUtc(debut, cible) * bornes.largeurJourPx;
}

function capitaliserPremier(texte: string): string {
  if (!texte) return "";
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * Produit les deux bandes de graduations (en-tête supérieur + cellules inférieures)
 * pour la frise chronologique du Gantt.
 */
export function genererGraduationsGantt(
  bornes: BornesGantt,
  echelle: EchelleGantt,
  locale = "fr-FR",
): { groupes: GroupeGraduationGantt[]; cellules: GraduationGantt[] } {
  const debut = parserDateIsoUtc(bornes.debutIso);
  const fin = parserDateIsoUtc(bornes.finIso);
  if (!debut || !fin) return { groupes: [], cellules: [] };

  const formatMoisAnnee = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const formatMoisCourt = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  });
  const formatJourSemaine = new Intl.DateTimeFormat(locale, {
    weekday: "narrow",
    timeZone: "UTC",
  });

  const groupes: GroupeGraduationGantt[] = [];
  const cellules: GraduationGantt[] = [];

  if (echelle === "JOUR") {
    let moisCourantCle = "";
    let groupeCourant: GroupeGraduationGantt | null = null;

    for (let i = 0; i < bornes.totalJours; i += 1) {
      const date = ajouterJoursUtc(debut, i);
      const x = i * bornes.largeurJourPx;
      const jourSemaine = date.getUTCDay();
      const cleMois = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

      if (cleMois !== moisCourantCle) {
        moisCourantCle = cleMois;
        groupeCourant = {
          cle: cleMois,
          libelle: capitaliserPremier(formatMoisAnnee.format(date)),
          x,
          largeur: bornes.largeurJourPx,
        };
        groupes.push(groupeCourant);
      } else if (groupeCourant) {
        groupeCourant.largeur += bornes.largeurJourPx;
      }

      cellules.push({
        cle: formaterDateIsoUtc(date),
        libelle: String(date.getUTCDate()).padStart(2, "0"),
        sousLibelle: formatJourSemaine.format(date).toUpperCase(),
        x,
        largeur: bornes.largeurJourPx,
        estWeekEnd: jourSemaine === 0 || jourSemaine === 6,
      });
    }
    return { groupes, cellules };
  }

  if (echelle === "SEMAINE") {
    // Groupes supérieurs par mois calendaire.
    let curseurMois = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), 1));
    while (curseurMois <= fin) {
      const debutMois = curseurMois < debut ? debut : curseurMois;
      const finMoisTheorique = new Date(
        Date.UTC(curseurMois.getUTCFullYear(), curseurMois.getUTCMonth() + 1, 0),
      );
      const finMois = finMoisTheorique > fin ? fin : finMoisTheorique;
      const x = Math.max(0, diffJoursUtc(debut, debutMois) * bornes.largeurJourPx);
      const largeur = Math.max(1, diffJoursUtc(debutMois, finMois) + 1) * bornes.largeurJourPx;
      groupes.push({
        cle: `${curseurMois.getUTCFullYear()}-${curseurMois.getUTCMonth()}`,
        libelle: capitaliserPremier(formatMoisAnnee.format(curseurMois)),
        x,
        largeur,
      });
      curseurMois = new Date(Date.UTC(curseurMois.getUTCFullYear(), curseurMois.getUTCMonth() + 1, 1));
    }

    // Cellules par semaine (lundi → dimanche).
    let curseur = debut;
    while (curseur <= fin) {
      const finSemaineTheorique = ajouterJoursUtc(curseur, 6);
      const finSemaine = finSemaineTheorique > fin ? fin : finSemaineTheorique;
      const x = diffJoursUtc(debut, curseur) * bornes.largeurJourPx;
      const largeur = (diffJoursUtc(curseur, finSemaine) + 1) * bornes.largeurJourPx;
      const jour = String(curseur.getUTCDate()).padStart(2, "0");
      const mois = String(curseur.getUTCMonth() + 1).padStart(2, "0");
      cellules.push({
        cle: formaterDateIsoUtc(curseur),
        libelle: `S${numeroSemaineIso(curseur)}`,
        sousLibelle: `${jour}/${mois}`,
        x,
        largeur,
      });
      curseur = ajouterJoursUtc(curseur, 7);
    }
    return { groupes, cellules };
  }

  if (echelle === "MOIS") {
    // Groupes supérieurs par année.
    for (let annee = debut.getUTCFullYear(); annee <= fin.getUTCFullYear(); annee += 1) {
      const debutAn = new Date(Date.UTC(annee, 0, 1));
      const finAn = new Date(Date.UTC(annee, 11, 31));
      const borneDebut = debutAn < debut ? debut : debutAn;
      const borneFin = finAn > fin ? fin : finAn;
      const x = diffJoursUtc(debut, borneDebut) * bornes.largeurJourPx;
      const largeur = (diffJoursUtc(borneDebut, borneFin) + 1) * bornes.largeurJourPx;
      groupes.push({ cle: String(annee), libelle: String(annee), x, largeur });
    }

    // Cellules par mois.
    let curseur = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), 1));
    while (curseur <= fin) {
      const borneDebut = curseur < debut ? debut : curseur;
      const finMois = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 1, 0));
      const borneFin = finMois > fin ? fin : finMois;
      const x = diffJoursUtc(debut, borneDebut) * bornes.largeurJourPx;
      const largeur = (diffJoursUtc(borneDebut, borneFin) + 1) * bornes.largeurJourPx;
      cellules.push({
        cle: `${curseur.getUTCFullYear()}-${curseur.getUTCMonth()}`,
        libelle: capitaliserPremier(formatMoisCourt.format(curseur)),
        x,
        largeur,
      });
      curseur = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 1, 1));
    }
    return { groupes, cellules };
  }

  // Echelle TRIMESTRE
  for (let annee = debut.getUTCFullYear(); annee <= fin.getUTCFullYear(); annee += 1) {
    const debutAn = new Date(Date.UTC(annee, 0, 1));
    const finAn = new Date(Date.UTC(annee, 11, 31));
    const borneDebut = debutAn < debut ? debut : debutAn;
    const borneFin = finAn > fin ? fin : finAn;
    const x = diffJoursUtc(debut, borneDebut) * bornes.largeurJourPx;
    const largeur = (diffJoursUtc(borneDebut, borneFin) + 1) * bornes.largeurJourPx;
    groupes.push({ cle: String(annee), libelle: String(annee), x, largeur });
  }

  let curseur = new Date(
    Date.UTC(debut.getUTCFullYear(), Math.floor(debut.getUTCMonth() / 3) * 3, 1),
  );
  while (curseur <= fin) {
    const trimestre = Math.floor(curseur.getUTCMonth() / 3) + 1;
    const borneDebut = curseur < debut ? debut : curseur;
    const finTrim = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 3, 0));
    const borneFin = finTrim > fin ? fin : finTrim;
    const x = diffJoursUtc(debut, borneDebut) * bornes.largeurJourPx;
    const largeur = (diffJoursUtc(borneDebut, borneFin) + 1) * bornes.largeurJourPx;
    cellules.push({
      cle: `${curseur.getUTCFullYear()}-T${trimestre}`,
      libelle: `T${trimestre}`,
      x,
      largeur,
    });
    curseur = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 3, 1));
  }

  return { groupes, cellules };
}

/* ------------------------------------------------------------------ *
 * Géométrie des barres, jalons, repère baseline, ligne Aujourd'hui et flèches FS.
 * ------------------------------------------------------------------ */

/** Calcule les coordonnées SVG d'une barre ou d'un jalon sur la frise. */
export function calculerGeometrieBarre(
  item: CasePlanning,
  bornes: BornesGantt,
): GeometrieBarreGantt | null {
  const { debut: brutDebut, fin: brutFin } = datesEffectivesCase(item);
  const debutIso = brutDebut ?? brutFin;
  const finIso = brutFin ?? brutDebut;
  if (!debutIso || !finIso) return null;

  const dDebut = parserDateIsoUtc(debutIso);
  const dFin = parserDateIsoUtc(finIso);
  if (!dDebut || !dFin) return null;

  const debutEffectif = dDebut <= dFin ? debutIso : finIso;
  const finEffective = dDebut <= dFin ? finIso : debutIso;
  const estJalon = estCaseJalon(item);
  const x = xPourDate(debutEffectif, bornes);

  const dureeJours = Math.max(1, Math.abs(diffJoursUtc(dDebut, dFin)) + 1);
  const largeur = estJalon ? 0 : Math.max(6, dureeJours * bornes.largeurJourPx);

  const avancementBorne =
    item.avancement === null ? 0 : Math.min(100, Math.max(0, item.avancement));
  const largeurAvancement = estJalon ? 0 : (avancementBorne / 100) * largeur;

  const xMarqueurTheorique =
    !estJalon && item.avancementTemporel !== null
      ? x + (Math.min(100, Math.max(0, item.avancementTemporel)) / 100) * largeur
      : null;

  let xDebutBaseline: number | null = null;
  let largeurBaseline: number | null = null;
  if (item.debutBaseline && item.finBaseline) {
    const bDebut = parserDateIsoUtc(item.debutBaseline);
    const bFin = parserDateIsoUtc(item.finBaseline);
    if (bDebut && bFin) {
      const bD = bDebut <= bFin ? item.debutBaseline : item.finBaseline;
      xDebutBaseline = xPourDate(bD, bornes);
      largeurBaseline = Math.max(4, (Math.abs(diffJoursUtc(bDebut, bFin)) + 1) * bornes.largeurJourPx);
    }
  }

  return {
    x,
    largeur,
    estJalon,
    debutIso: debutEffectif,
    finIso: finEffective,
    xDebutBaseline,
    largeurBaseline,
    xMarqueurTheorique,
    largeurAvancement,
  };
}

/** Position horizontale (px) de la ligne verticale « Aujourd'hui », ou `null` hors bornes. */
export function calculerPositionAujourdhui(aujourdhui: string, bornes: BornesGantt): number | null {
  const x = xPourDate(aujourdhui, bornes) + bornes.largeurJourPx / 2;
  if (x < 0 || x > bornes.largeurTotalePx) return null;
  return x;
}

function arrondirPx(valeur: number): number {
  return Math.round(valeur * 10) / 10;
}

/**
 * Formate le code technique d'une dépendance avec son décalage en jours ouvrés.
 * Exemples : `("FS", 0)` → `"FS"`, `("FS", 7)` → `"FS +7 j"`, `("SS", -2)` → `"SS -2 j"`.
 * Si `masquerDefaut` est vrai, renvoie `""` pour `FS` sans décalage.
 */
export function formaterEtiquetteDependance(
  typeLien: TypeDependance,
  decalageJours: number,
  options: { masquerDefaut?: boolean } = {},
): string {
  const decalage = Math.trunc(decalageJours || 0);
  if (options.masquerDefaut && typeLien === "FS" && decalage === 0) {
    return "";
  }
  if (decalage === 0) return typeLien;
  const signe = decalage > 0 ? "+" : "";
  return `${typeLien} ${signe}${decalage} j`;
}

/**
 * Routage orthogonal SVG des quatre types de dépendances (`FS`, `SS`, `FF`, `SF`)
 * entre lignes actuellement visibles sur le Gantt.
 */
export function calculerFlechesDependances(
  dependances: readonly DependancePlanning[],
  lignes: readonly LigneGantt[],
  geometrieParId: ReadonlyMap<string, GeometrieBarreGantt>,
  hauteurLigne = HAUTEUR_LIGNE_GANTT,
): FlecheGantt[] {
  const indexParId = new Map<string, number>();
  for (const ligne of lignes) {
    indexParId.set(ligne.caseItem.id, ligne.indexLigne);
  }

  const fleches: FlecheGantt[] = [];
  const margeSortie = 10;
  const margeEntree = 10;
  const margeBoucle = 14;

  for (const dep of dependances) {
    const indexPred = indexParId.get(dep.predecesseurId);
    const indexSucc = indexParId.get(dep.successeurId);
    if (indexPred === undefined || indexSucc === undefined) continue;

    const geoPred = geometrieParId.get(dep.predecesseurId);
    const geoSucc = geometrieParId.get(dep.successeurId);
    if (!geoPred || !geoSucc) continue;

    const xGauchePred = arrondirPx(geoPred.estJalon ? geoPred.x - 8 : geoPred.x);
    const xDroitePred = arrondirPx(geoPred.estJalon ? geoPred.x + 8 : geoPred.x + geoPred.largeur);
    const xGaucheSucc = arrondirPx(geoSucc.estJalon ? geoSucc.x - 8 : geoSucc.x);
    const xDroiteSucc = arrondirPx(geoSucc.estJalon ? geoSucc.x + 8 : geoSucc.x + geoSucc.largeur);

    const y1 = arrondirPx(indexPred * hauteurLigne + hauteurLigne / 2);
    const y2 = arrondirPx(indexSucc * hauteurLigne + hauteurLigne / 2);
    const direction = y2 >= y1 ? 1 : -1;
    const typeLien = dep.typeLien ?? "FS";
    const decalageJours = dep.decalageJours ?? 0;

    let cheminSvg: string;
    let xEtiquette: number;
    let yEtiquette: number;

    if (typeLien === "SS") {
      // Début A → Début B : boucle propre à gauche des deux barres.
      const x1 = xGauchePred;
      const x2 = xGaucheSucc;
      const xBoucle = arrondirPx(Math.max(4, Math.min(x1, x2) - margeBoucle));
      cheminSvg = `M ${x1} ${y1} L ${xBoucle} ${y1} L ${xBoucle} ${y2} L ${x2} ${y2}`;
      xEtiquette = xBoucle;
      yEtiquette = arrondirPx((y1 + y2) / 2);
    } else if (typeLien === "FF") {
      // Fin A → Fin B : boucle propre à droite des deux barres.
      const x1 = xDroitePred;
      const x2 = xDroiteSucc;
      const xBoucle = arrondirPx(Math.max(x1, x2) + margeBoucle);
      cheminSvg = `M ${x1} ${y1} L ${xBoucle} ${y1} L ${xBoucle} ${y2} L ${x2} ${y2}`;
      xEtiquette = xBoucle;
      yEtiquette = arrondirPx((y1 + y2) / 2);
    } else if (typeLien === "SF") {
      // Début A → Fin B : sortie à gauche de A, entrée à droite de B.
      const x1 = xGauchePred;
      const x2 = xDroiteSucc;
      if (x1 >= x2 + margeSortie + 4) {
        const xCoude = arrondirPx(x1 - Math.min(margeSortie + 4, (x1 - x2) / 2));
        cheminSvg = `M ${x1} ${y1} L ${xCoude} ${y1} L ${xCoude} ${y2} L ${x2} ${y2}`;
        xEtiquette = xCoude;
        yEtiquette = arrondirPx((y1 + y2) / 2);
      } else {
        const xSortie = arrondirPx(Math.max(4, x1 - margeSortie));
        const xEntree = arrondirPx(x2 + margeEntree);
        const yCouloir = arrondirPx(y1 + direction * (hauteurLigne / 2));
        cheminSvg = `M ${x1} ${y1} L ${xSortie} ${y1} L ${xSortie} ${yCouloir} L ${xEntree} ${yCouloir} L ${xEntree} ${y2} L ${x2} ${y2}`;
        xEtiquette = arrondirPx((xSortie + xEntree) / 2);
        yEtiquette = arrondirPx(yCouloir - 5);
      }
    } else {
      // FS (défaut) : Fin A → Début B.
      const x1 = xDroitePred;
      const x2 = xGaucheSucc;
      if (x2 >= x1 + margeSortie + 4) {
        const xCoude = arrondirPx(x1 + Math.min(margeSortie + 4, (x2 - x1) / 2));
        cheminSvg = `M ${x1} ${y1} L ${xCoude} ${y1} L ${xCoude} ${y2} L ${x2} ${y2}`;
        xEtiquette = x2 - xCoude >= 42 ? arrondirPx((xCoude + x2) / 2) : xCoude;
        yEtiquette = x2 - xCoude >= 42 ? arrondirPx(y2 - 7) : arrondirPx((y1 + y2) / 2);
      } else {
        const xSortie = arrondirPx(x1 + margeSortie);
        const xEntree = arrondirPx(Math.max(4, x2 - margeEntree));
        const yCouloir = arrondirPx(y1 + direction * (hauteurLigne / 2));
        cheminSvg = `M ${x1} ${y1} L ${xSortie} ${y1} L ${xSortie} ${yCouloir} L ${xEntree} ${yCouloir} L ${xEntree} ${y2} L ${x2} ${y2}`;
        xEtiquette = arrondirPx((xSortie + xEntree) / 2);
        yEtiquette = arrondirPx(yCouloir - 5);
      }
    }

    fleches.push({
      id: dep.id,
      predecesseurId: dep.predecesseurId,
      successeurId: dep.successeurId,
      typeLien,
      decalageJours,
      etiquette: formaterEtiquetteDependance(typeLien, decalageJours, { masquerDefaut: true }),
      xEtiquette,
      yEtiquette,
      cheminSvg,
      respectee: dep.respectee,
    });
  }

  return fleches;
}

/* ------------------------------------------------------------------ *
 * Indicateurs synthétiques, export tabulaire et conversion aperçu MS Project.
 * ------------------------------------------------------------------ */

/** Calcule les KPIs synthétiques du planning (sur l'ensemble de l'arbre chargé). */
export function calculerIndicateursPlanning(planning: PlanningGantt): IndicateursPlanning {
  let totalCases = 0;
  let totalFeuilles = 0;
  let feuillesPlanifiees = 0;
  let feuillesEnRetard = 0;
  let feuillesTerminees = 0;
  let jalons = 0;
  let dateDebutMin: string | null = planning.projetDebut;
  let dateFinMax: string | null = planning.projetFin;

  function etendreBornes(debut: string | null, fin: string | null) {
    if (debut && (!dateDebutMin || debut < dateDebutMin)) dateDebutMin = debut;
    if (fin && (!dateFinMax || fin > dateFinMax)) dateFinMax = fin;
  }

  function parcourir(liste: readonly CasePlanning[]) {
    for (const item of liste) {
      totalCases += 1;
      const { debut, fin } = datesEffectivesCase(item);
      etendreBornes(debut, fin);

      if (item.estFeuille) {
        totalFeuilles += 1;
        if (debut && fin) feuillesPlanifiees += 1;
        if (estCaseJalon(item)) jalons += 1;
        if (estCaseEnRetard(item)) feuillesEnRetard += 1;
        if (item.statut === "TERMINE" || item.statut === "CLOTURE" || item.avancement === 100) {
          feuillesTerminees += 1;
        }
      }
      parcourir(item.enfants);
    }
  }

  parcourir(planning.cases);

  const dependancesNonRespectees = planning.dependances.filter((d) => d.respectee === false).length;

  return {
    totalCases,
    totalFeuilles,
    feuillesPlanifiees,
    feuillesEnRetard,
    feuillesTerminees,
    jalons,
    dependancesTotal: planning.dependances.length,
    dependancesNonRespectees,
    dateDebutMin,
    dateFinMax,
  };
}

/** Construit les lignes brutes exportables en CSV/PDF à partir des lignes filtrées du Gantt. */
export function construireLignesExportPlanning(
  lignes: readonly LigneGantt[],
): LigneExportPlanning[] {
  return lignes.map((ligne) => {
    const item = ligne.caseItem;
    const { debut, fin } = datesEffectivesCase(item);
    return {
      numero: item.numero ?? "",
      libelle: item.libelle,
      niveau: item.niveau ?? "",
      statut: item.statut,
      type: !item.estFeuille ? "PARENT" : ligne.estJalon ? "JALON" : "FEUILLE",
      debut: debut ?? "",
      fin: fin ?? "",
      debutBaseline: item.debutBaseline ?? "",
      finBaseline: item.finBaseline ?? "",
      avancement: item.avancement,
      avancementTemporel: item.avancementTemporel,
      deltaRetard: item.deltaRetard,
    };
  });
}

function convertirTachesMsProjectActives(
  taches: readonly TacheMsProject[],
  idsActifs: Set<string>,
): CasePlanning[] {
  const resultat: CasePlanning[] = [];
  for (const tache of taches) {
    if (!tache.estActif) continue;
    idsActifs.add(tache.uid);
    const enfants = convertirTachesMsProjectActives(tache.enfants, idsActifs);
    resultat.push({
      id: tache.uid,
      libelle: tache.libelle,
      code: tache.code ?? "",
      numero: tache.numero,
      niveau: tache.niveau,
      montant: tache.coutFcfa,
      debut: tache.debut,
      fin: tache.fin,
      debutPrevu: tache.debut,
      finPrevue: tache.fin,
      debutBaseline: tache.debutBaseline,
      finBaseline: tache.finBaseline,
      avancement: tache.pourcentageXml,
      avancementTemporel: null,
      deltaRetard: null,
      statut: "PLANIFIE",
      acces: "COMPLET",
      estFeuille: tache.estFeuille,
      modeMesure: tache.estJalon ? "JALON" : "POURCENTAGE",
      enfants,
    });
  }
  return resultat;
}

/**
 * Convertit l'aperçu d'une analyse MS Project `.xml` en structure `PlanningGantt`
 * directement affichable en lecture seule dans `DiagrammeGantt`.
 * Les tâches désactivées (`estActif === false`) sont exclues du Gantt d'aperçu.
 */
export function convertirAnalyseMsProjectEnPlanning(
  analyse: AnalyseMsProject,
  aujourdhui = dateAujourdhuiIso(),
): PlanningGantt {
  const idsActifs = new Set<string>();
  const cases = convertirTachesMsProjectActives(analyse.taches, idsActifs);
  return {
    aujourdhui,
    projetDebut: analyse.projetXml.dateDebut,
    projetFin: analyse.projetXml.dateFin,
    uniteAvancement: UNITE_AVANCEMENT,
    importMsProject: analyse.etatImport,
    cases,
    dependances: analyse.dependances
      .filter((dep) => idsActifs.has(dep.predecesseurUid) && idsActifs.has(dep.successeurUid))
      .map((dep, index) => ({
        id: `${dep.predecesseurUid}-${dep.successeurUid}-${index}`,
        predecesseurId: dep.predecesseurUid,
        successeurId: dep.successeurUid,
        typeLien: dep.type,
        decalageJours: dep.decalageJours,
        respectee: dep.respectee,
      })),
  };
}

/** Taux de conversion initial proposé pour un export XML MS Project. */
export function tauxConversionInitialMsProject(projetXml: ProjetXmlApercu): number {
  if (projetXml.deviseCode === "XOF") return 1;
  if (projetXml.tauxConversionSuggere !== null && projetXml.tauxConversionSuggere > 0) {
    return projetXml.tauxConversionSuggere;
  }
  if (projetXml.deviseCode === "EUR") return TAUX_CONVERSION_EUR_FCFA;
  return 1;
}

/**
 * Calcule un montant converti en centimes de FCFA (format attendu par `formaterMontant`
 * et renvoyé par le serveur dans `cout_fcfa` / `cout_total_fcfa`) pour le recalcul en
 * direct dans l'aperçu d'import MS Project.
 */
export function calculerCoutFcfaCentimes(
  coutBrut: number | null,
  coutFcfaCentimesInitial: number | null,
  tauxConversion: number | null,
  tauxInitial: number,
): number | null {
  if (coutBrut !== null && coutBrut > 0) {
    if (tauxConversion === null || tauxConversion <= 0) return null;
    return Math.round(coutBrut * tauxConversion) * 100;
  }
  if (coutFcfaCentimesInitial !== null && coutFcfaCentimesInitial > 0) {
    if (
      tauxConversion !== null &&
      tauxConversion > 0 &&
      tauxInitial > 0 &&
      tauxConversion !== tauxInitial
    ) {
      return Math.round((coutFcfaCentimesInitial / 100 / tauxInitial) * tauxConversion) * 100;
    }
    return Math.round(coutFcfaCentimesInitial);
  }
  return null;
}

/** Vrai si la tâche porte des dates baseline distinctes de ses dates prévues. */
export function aBaselineDifferente(
  tache: Pick<TacheMsProject, "debut" | "fin" | "debutBaseline" | "finBaseline">,
): boolean {
  if (!tache.debutBaseline && !tache.finBaseline) return false;
  return tache.debutBaseline !== tache.debut || tache.finBaseline !== tache.fin;
}

/** Aplatit les tâches d'une analyse MS Project avec leur profondeur pour la liste structurée. */
export interface LigneApercuMsProject {
  tache: TacheMsProject;
  profondeur: number;
}

export function aplatirTachesMsProject(
  taches: readonly TacheMsProject[],
  profondeur = 0,
): LigneApercuMsProject[] {
  const resultat: LigneApercuMsProject[] = [];
  for (const tache of taches) {
    resultat.push({ tache, profondeur });
    if (tache.enfants.length > 0) {
      resultat.push(...aplatirTachesMsProject(tache.enfants, profondeur + 1));
    }
  }
  return resultat;
}

/** Valide localement un fichier MS Project avant envoi au serveur. */
export function validerFichierMsProject(fichier: File): "extension" | "taille" | null {
  if (!fichier.name.toLowerCase().endsWith(".xml")) return "extension";
  if (fichier.size > TAILLE_MAX_FICHIER_MS_PROJECT) return "taille";
  return null;
}

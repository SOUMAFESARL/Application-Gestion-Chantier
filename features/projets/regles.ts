/**
 * Les règles métier du domaine Projets — plan de refonte, lot 4, couche 2.
 *
 * **Pur, et sans React.** Pas de `useState`, pas de JSX, pas d'appel réseau :
 * une fonction d'ici doit pouvoir être appelée depuis un écran, depuis une
 * action serveur ou depuis un test, sans rien monter.
 *
 * Ce fichier existe parce que ces calculs vivaient jusqu'ici **dans le JSX**,
 * recopiés d'un écran à l'autre. Ce n'est pas une question de propreté : deux
 * copies d'une règle finissent par diverger, et c'est exactement ce qui
 * s'était produit — voir `SEUIL_RETARD_POINTS` plus bas.
 */

import type { Collaborateur } from "@/features/invitations/types";

import type {
  Activite,
  Equipe,
  Lot,
  MembreEquipe,
  ModeExecutionLot,
  NatureEquipe,
  Projet,
  StatutActivite,
  StatutProjet,
  TypeBordereau,
  TypeProjet,
  RoleMembreEquipe,
  UniteActivite,
} from "./types";

/**
 * À partir de combien de points de retard un chantier est-il « en retard ».
 *
 * **Cette constante répare une divergence réelle.** Le seuil existait en deux
 * exemplaires, et les deux ne disaient pas la même chose :
 *
 * * le tableau de bord tenait un chantier pour en retard à partir de **-5
 *   points** (`ecart < -5`, écrit en dur à trois endroits du même fichier) ;
 * * la fiche chantier, elle, le tenait pour en retard **dès le premier
 *   dixième de point** (`ecart < 0`).
 *
 * Un même chantier à -2,5 points s'affichait donc « conforme » sur le tableau
 * de bord et « en retard » sur sa propre fiche. C'est le seuil du tableau de
 * bord qui est retenu : un chantier qui glisse d'un point sur un planning à
 * dix mois n'est pas en retard, il est dans le bruit de mesure, et une alerte
 * qui se déclenche sur du bruit finit par ne plus être lue.
 */
export const SEUIL_RETARD_POINTS = -5;

/** Au-delà de ce ratio de consommation, le budget est en alerte. */
export const SEUIL_BUDGET_ALERTE = 80;

/** Au-delà de ce ratio, le budget initial est dépassé. */
export const SEUIL_BUDGET_DEPASSEMENT = 100;

/**
 * L'écart d'avancement, en points de pourcentage.
 *
 * Négatif quand le chantier est en retard sur son planning. Arrondi au
 * dixième : le serveur envoie des avancements à la décimale, et une
 * soustraction de flottants produit sinon des `-2.4999999999999996` qui
 * s'affichent tels quels.
 */
export function ecartAvancement(reel: number, theorique: number): number {
  return Math.round((reel - theorique) * 10) / 10;
}

/**
 * Le chantier est-il en retard. Une seule définition, pour tout le produit.
 */
export function estEnRetard(ecart: number): boolean {
  return ecart < SEUIL_RETARD_POINTS;
}

/**
 * L'écart, préfixé de son signe, pour l'affichage — « +3 », « -2.5 ».
 *
 * Le signe positif est explicite : « 3 » se lit comme une valeur absolue,
 * « +3 » se lit comme une avance.
 */
export function ecartSigne(ecart: number): string {
  return ecart >= 0 ? `+${ecart}` : `${ecart}`;
}

/**
 * La part du budget initial déjà consommée, en pourcentage entier.
 *
 * Renvoie `null` quand la question n'a pas de sens — budget non défini, ou
 * nul. C'est volontairement différent de `0` : « rien n'est consommé » et
 * « on ne sait pas » ne se peignent pas de la même couleur.
 *
 * Les deux copies précédentes de ce calcul ne se gardaient pas pareil du
 * budget absent (`initial > 0` d'un côté, `initial && initial > 0` de
 * l'autre) ; l'une des deux plantait sur un budget `null`.
 */
export function ratioConsommationBudget(
  budgetInitial: number | null | undefined,
  budgetConsomme: number | null | undefined,
): number | null {
  if (budgetInitial === null || budgetInitial === undefined || budgetInitial <= 0) {
    return null;
  }
  return Math.round(((budgetConsomme ?? 0) / budgetInitial) * 100);
}

/** Comment se lit un ratio de consommation budgétaire. */
export type NiveauBudget = "conforme" | "alerte" | "depassement";

/**
 * Le niveau d'alerte d'un budget, à partir de son ratio de consommation.
 *
 * Les bornes étaient écrites en dur dans le JSX du tableau de bord, sous
 * forme de deux ternaires imbriqués choisissant une classe CSS. Les nommer
 * ici permet à un autre écran de prendre la même décision sans recopier les
 * seuils — et de ne pas avoir à recopier la couleur avec.
 */
export function niveauBudget(ratio: number | null): NiveauBudget | null {
  if (ratio === null) return null;
  if (ratio > SEUIL_BUDGET_DEPASSEMENT) return "depassement";
  if (ratio > SEUIL_BUDGET_ALERTE) return "alerte";
  return "conforme";
}

/**
 * La largeur d'une jauge d'avancement, en pourcentage.
 *
 * Plafonnée à 100 : un chantier peut dépasser son avancement théorique, une
 * barre de progression ne peut pas dépasser son conteneur.
 */
export function largeurJauge(taux: number): number {
  return Math.min(Math.max(taux, 0), 100);
}

/** Comment se lit l'avancement réel d'un projet dans la liste. */
export type NiveauAvancement = "conforme" | "retard" | "critique";

/**
 * Le niveau d'avancement : critique si le projet l'est, en retard au-delà de
 * `SEUIL_RETARD_POINTS`, conforme sinon. Même seuil que partout ailleurs.
 */
export function niveauAvancement(projet: Projet): NiveauAvancement {
  if (projet.statut === "CRITIQUE") return "critique";
  const ecart = ecartAvancement(projet.avancementReel, projet.avancementTheorique);
  return estEnRetard(ecart) ? "retard" : "conforme";
}

/**
 * L'échéance est-elle dépassée : date de fin prévue passée, projet non
 * terminé. Comparaison en ISO court, comme `datesChantierCoherentes`.
 */
export function echeanceDepassee(projet: Projet, maintenant: Date = new Date()): boolean {
  if (projet.statut === "TERMINE" || projet.statut === "ARCHIVE") return false;
  return projet.dateFinPrevue < maintenant.toISOString().split("T")[0];
}

/**
 * Les statuts depuis lesquels un projet peut être suspendu : un projet qui
 * n'est pas encore clos. Suspendre un projet terminé n'arrête rien.
 */
const STATUTS_SUSPENDABLES: StatutProjet[] = ["EN_ATTENTE", "EN_COURS", "EN_RETARD", "CRITIQUE"];

export function peutSuspendre(projet: Pick<Projet, "statut">): boolean {
  return STATUTS_SUSPENDABLES.includes(projet.statut);
}

export function peutReprendre(projet: Pick<Projet, "statut">): boolean {
  return projet.statut === "SUSPENDU";
}

/** Un projet clos (terminé ou archivé) ne se modifie plus : il fait foi tel qu'il a fini. */
export function projetModifiable(projet: Pick<Projet, "statut">): boolean {
  return projet.statut !== "TERMINE" && projet.statut !== "ARCHIVE";
}

/** Un budget défini, moins ce qui en est déjà consommé. Négatif : budget dépassé. */
export function budgetRestant(projet: Pick<Projet, "budgetInitial" | "budgetConsomme">): number | null {
  if (projet.budgetInitial === null) return null;
  return projet.budgetInitial - projet.budgetConsomme;
}

/** Les jours calendaires d'une date ISO courte à une autre ; négatif si `fin` précède `debut`. */
function joursEntre(debut: string, fin: string): number | null {
  const depart = Date.parse(debut);
  const arrivee = Date.parse(fin);
  if (Number.isNaN(depart) || Number.isNaN(arrivee)) return null;
  return Math.round((arrivee - depart) / JOUR_MS);
}

/** Ce que les dates d'un projet disent de son délai. */
export interface EcheancierProjet {
  /** La durée prévue, en jours calendaires, bornes comprises. */
  dureeJours: number | null;
  /**
   * La part du délai prévu déjà écoulée, de 0 à 100. C'est le **temps**, pas
   * l'avancement théorique que le serveur calcule sur le planning : les deux
   * se lisent côte à côte, ils ne se remplacent pas.
   */
  tempsEcoule: number | null;
  /**
   * Les jours avant la fin prévue, négatifs une fois l'échéance passée.
   * `null` pour un projet clos : il n'a plus d'échéance.
   */
  joursRestants: number | null;
}

/**
 * L'échéancier d'un projet, compté depuis son **début prévu** : c'est la
 * référence contractuelle, et un démarrage tardif se lit justement comme du
 * délai consommé. Un projet clos s'arrête à sa fin réelle.
 */
export function echeancierProjet(projet: Projet, maintenant: Date = new Date()): EcheancierProjet {
  const aujourdhui = maintenant.toISOString().split("T")[0];
  const clos = projet.statut === "TERMINE" || projet.statut === "ARCHIVE";
  const duree = joursEntre(projet.dateDebutPrevue, projet.dateFinPrevue);
  const ecoules = joursEntre(
    projet.dateDebutPrevue,
    clos ? (projet.dateFinReelle ?? projet.dateFinPrevue) : aujourdhui,
  );
  return {
    dureeJours: duree === null || duree < 0 ? null : duree + 1,
    tempsEcoule:
      duree === null || duree <= 0 || ecoules === null
        ? null
        : largeurJauge(Math.round((ecoules / duree) * 100)),
    joursRestants: clos ? null : joursEntre(aujourdhui, projet.dateFinPrevue),
  };
}

/** « Koffi Kouamé » → « K. Kouamé » : ce qui tient dans une colonne étroite. */
export function nomAbrege(intervenant: { prenom: string; nom: string } | null): string | null {
  if (!intervenant) return null;
  const prenom = intervenant.prenom.trim();
  const nom = intervenant.nom.trim();
  if (!prenom) return nom || null;
  return nom ? `${prenom[0].toUpperCase()}. ${nom}` : prenom;
}

/**
 * Les initiales d'un intervenant, pour sa pastille d'avatar.
 *
 * Le repli n'est pas un choix d'affichage mais une règle : un chantier a
 * toujours un responsable, et la pastille doit rester lisible même quand la
 * fiche de la personne est incomplète.
 */
export function initiales(prenom: string | null | undefined, nom: string | null | undefined): string | null {
  if (!prenom || !nom) return null;
  return `${prenom[0]}${nom[0]}`.toUpperCase();
}

/**
 * Le lien WhatsApp d'un intervenant.
 *
 * On préfère **toujours** celui construit par le serveur : il connaît le
 * format attendu par l'opérateur du pays de l'entreprise. Le repli local ne
 * sert que lorsque la fiche a été chargée sans lui, et se contente de retirer
 * tout ce qui n'est pas un chiffre — l'indicatif compris dans le numéro
 * stocké en E.164.
 */
export function lienWhatsApp(
  lienServeur: string | null | undefined,
  telephone: string | null | undefined,
): string | null {
  if (lienServeur) return lienServeur;
  if (!telephone) return null;
  const chiffres = telephone.replace(/[^0-9]/g, "");
  return chiffres ? `https://wa.me/${chiffres}` : null;
}

/**
 * En centimes. Un budget nul ou négatif n'est pas un budget : c'est un budget
 * « non défini », et le domaine le représente par `null`, pas par zéro.
 */
export const BUDGET_MINIMAL_CENTIMES = 1;

/** Un montant de budget saisi est-il recevable. */
export function budgetRecevable(centimes: number | null): centimes is number {
  return centimes !== null && centimes >= BUDGET_MINIMAL_CENTIMES;
}

/**
 * La durée par défaut d'un chantier, en jours, quand aucune date de fin n'est
 * fournie. Six mois : l'ordre de grandeur d'un chantier de gros oeuvre.
 */
export const DUREE_DEFAUT_JOURS = 180;

/** Les dates de repli d'une création de chantier, au format ISO court. */
export function datesParDefaut(maintenant: Date = new Date()): {
  debut: string;
  fin: string;
} {
  const jour = 24 * 3600 * 1000;
  return {
    debut: maintenant.toISOString().split("T")[0],
    fin: new Date(maintenant.getTime() + DUREE_DEFAUT_JOURS * jour).toISOString().split("T")[0],
  };
}

/**
 * Les dates prévues d'un chantier se suivent-elles.
 *
 * Un chantier peut commencer et finir le même jour (une intervention
 * ponctuelle) ; il ne peut pas finir avant d'avoir commencé. Les dates sont en
 * ISO court, dont l'ordre alphabétique est l'ordre chronologique : pas besoin
 * de passer par `Date`, et donc pas de décalage de fuseau possible.
 */
export function datesChantierCoherentes(debut: string, fin: string): boolean {
  if (!debut || !fin) return true;
  return fin >= debut;
}

/**
 * Un chantier qui vient d'être créé n'a encore ni avancement ni consommation.
 *
 * Cet état initial était recopié dans le tableau de bord, au retour de la
 * modale de création, sous forme d'un objet littéral de quinze lignes — donc
 * à retoucher à chaque champ ajouté au domaine.
 */
export const INDICE_SANTE_INITIAL = 100;

/* ------------------------------------------------------------------ *
 * La création d'un projet.
 * ------------------------------------------------------------------ */

/** Les natures de projet, dans l'ordre du sélecteur. */
export const TYPES_PROJET: TypeProjet[] = [
  "BATIMENT_RESIDENTIEL",
  "BATIMENT_TERTIAIRE",
  "INDUSTRIEL",
  "GENIE_CIVIL",
  "VRD",
  "REHABILITATION",
  "AUTRE",
];

/** De la régie à la sous-traitance la moins encadrée. */
export const MODES_EXECUTION_LOT: ModeExecutionLot[] = [
  "REGIE_DIRECTE",
  "SOUS_TRAITANCE_STRUCTUREE",
  "SOUS_TRAITANCE_INFORMELLE",
];

export const TYPES_BORDEREAU: TypeBordereau[] = ["FORFAIT_GLOBAL", "PRIX_UNITAIRE"];

/**
 * Le numéro d'un lot à partir de son rang (0 pour le premier) : `L-01`.
 *
 * Il suit l'ordre des lignes, et se renumérote quand un lot est retiré —
 * un trou dans la séquence se lirait comme un lot supprimé après coup.
 */
export function numeroLot(rang: number): string {
  return `L-${String(rang + 1).padStart(2, "0")}`;
}

/**
 * Le nombre de jours ouvrés (lundi à vendredi) entre deux dates ISO courtes,
 * bornes comprises. `null` tant qu'une des deux dates manque ou qu'elles ne
 * se suivent pas : une durée négative n'a pas de sens.
 *
 * Le calcul se fait en UTC : `new Date("2026-03-29")` est minuit UTC, et
 * `getDay()` en heure locale décalerait le jour de la semaine à l'ouest de
 * Greenwich.
 */
export function joursOuvres(debut: string, fin: string): number | null {
  if (!debut || !fin || !datesChantierCoherentes(debut, fin)) return null;
  const depart = Date.parse(debut);
  const arrivee = Date.parse(fin);
  if (Number.isNaN(depart) || Number.isNaN(arrivee)) return null;

  const jour = 24 * 3600 * 1000;
  const total = Math.round((arrivee - depart) / jour) + 1;
  const semaines = Math.floor(total / 7);
  let ouvres = semaines * 5;
  // Les jours restants, après les semaines pleines.
  const premierJour = new Date(depart).getUTCDay();
  for (let i = 0; i < total % 7; i += 1) {
    const jourSemaine = (premierJour + i) % 7;
    if (jourSemaine !== 0 && jourSemaine !== 6) ouvres += 1;
  }
  return ouvres;
}


/* ------------------------------------------------------------------ *
 * Le filtrage du portefeuille.
 * ------------------------------------------------------------------ */

/**
 * L'ordre dans lequel les statuts se présentent à l'utilisateur.
 *
 * Ce n'est **pas** l'ordre alphabétique ni celui de l'énumération serveur :
 * c'est celui de l'urgence, du chantier qui réclame une décision à celui
 * qu'on archive. Un sélecteur classé par hasard oblige à relire la liste
 * entière à chaque ouverture.
 */
export const ORDRE_STATUTS: StatutProjet[] = [
  "CRITIQUE",
  "EN_RETARD",
  "EN_COURS",
  "SUSPENDU",
  "EN_ATTENTE",
  "TERMINE",
  "ARCHIVE",
];

/**
 * Le texte, réduit à ce qui se compare.
 *
 * Les accents sautent : on cherche « residence » et on veut trouver
 * « Résidence ». Sur un clavier de chantier, l'accent n'est pas toujours
 * à portée, et une recherche qui l'exige ne trouve rien.
 */
function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Ce sur quoi la liste des chantiers se restreint. */
export interface CriteresProjets {
  /** Recherche libre : référence, nom, client, ville ou quartier. */
  recherche: string;
  /** Vide : tous les statuts. */
  statut: StatutProjet | "";
  /** Vide : tous les chefs de projet. */
  chefProjetId: string;
}

export const CRITERES_VIDES: CriteresProjets = { recherche: "", statut: "", chefProjetId: "" };

/** Un critère est-il actif — de quoi proposer une remise à zéro à propos. */
export function criteresActifs(criteres: CriteresProjets): boolean {
  return (
    criteres.recherche.trim() !== "" || criteres.statut !== "" || criteres.chefProjetId !== ""
  );
}

/**
 * Le portefeuille, restreint aux critères de l'écran.
 *
 * Le filtrage vit ici et non dans le composant : c'est la même question que
 * pose déjà la fiche chantier (« quels chantiers de ce client ? ») et que
 * posera le rapport de portefeuille. Une copie dans le JSX, et les trois
 * écrans finiraient par ne plus chercher sur les mêmes champs.
 *
 * La recherche porte sur ce qu'un conducteur de travaux a en tête quand il
 * ouvre l'écran : une référence, un nom de chantier, un maître d'ouvrage ou
 * un lieu. Pas sur le budget ni sur les dates — on ne cherche pas un
 * chantier par son montant.
 */
export function filtrerProjets(projets: Projet[], criteres: CriteresProjets): Projet[] {
  const recherche = normaliser(criteres.recherche);

  return projets.filter((projet) => {
    if (criteres.statut && projet.statut !== criteres.statut) return false;
    if (criteres.chefProjetId && projet.chefProjet?.id !== criteres.chefProjetId) return false;
    if (!recherche) return true;

    return [
      projet.reference,
      projet.nom,
      projet.client.raisonSociale,
      projet.ville,
      projet.quartier,
    ].some((champ) => normaliser(champ).includes(recherche));
  });
}

/** Les statuts effectivement portés par le portefeuille, dans l'ordre d'urgence. */
export function statutsPresents(projets: Projet[]): StatutProjet[] {
  const presents = new Set(projets.map((projet) => projet.statut));
  return ORDRE_STATUTS.filter((statut) => presents.has(statut));
}

/**
 * Le nombre de chantiers par statut, **tous statuts présents** : un statut
 * sans chantier vaut zéro plutôt que de disparaître, pour que la rangée
 * d'indicateurs garde la même place d'un portefeuille à l'autre.
 */
export function compterParStatut(projets: Projet[]): Record<StatutProjet, number> {
  const compte = Object.fromEntries(ORDRE_STATUTS.map((statut) => [statut, 0])) as Record<
    StatutProjet,
    number
  >;
  for (const projet of projets) compte[projet.statut] += 1;
  return compte;
}

/**
 * Les chefs de projet à proposer au filtre, sans doublon et classés.
 *
 * Les chantiers sans responsable désigné n'y apparaissent pas : il n'y a
 * rien à sélectionner, et une entrée vide dans un sélecteur se lit comme
 * un bogue.
 */
export function chefsDeProjet(projets: Projet[]): { id: string; nomComplet: string }[] {
  const connus = new Map<string, string>();
  for (const projet of projets) {
    if (projet.chefProjet) connus.set(projet.chefProjet.id, projet.chefProjet.nomComplet);
  }
  return [...connus.entries()]
    .map(([id, nomComplet]) => ({ id, nomComplet }))
    .sort((a, b) => a.nomComplet.localeCompare(b.nomComplet));
}

/**
 * Les colonnes de l'export de la liste (CSV et PDF), dans l'ordre de
 * `valeursExportProjet`.
 *
 * L'export garde la référence et le client, que l'écran ne montre plus : un
 * fichier sorti de l'application se relit sans elle, et la référence est ce
 * qui permet d'y retrouver un chantier.
 */
export const COLONNES_EXPORT_PROJETS = [
  "reference",
  "nom",
  "client",
  "ville",
  "typeProjet",
  "chefProjet",
  "avancementReel",
  "indiceSante",
  "dateFinPrevue",
  "budgetInitial",
  "statut",
] as const;

/** Ce que l'export ne sait pas nommer seul : les libellés viennent de l'écran. */
export interface LibellesExportProjet {
  statut: (statut: StatutProjet) => string;
  typeProjet: (type: TypeProjet) => string;
  formaterDate: (date: string) => string;
}

/**
 * Une ligne d'export. Le budget sort **en francs entiers**, pas en millions
 * arrondis comme à l'écran : un fichier se recalcule, un arrondi s'y cumule.
 * Une valeur absente sort vide, pas « — » : une cellule vide se trie et se
 * somme, un tiret non.
 */
export function valeursExportProjet(
  projet: Projet,
  libelles: LibellesExportProjet,
): (string | number)[] {
  return [
    projet.reference,
    projet.nom,
    projet.client.raisonSociale,
    projet.ville,
    projet.typeProjet ? libelles.typeProjet(projet.typeProjet) : "",
    projet.chefProjet?.nomComplet ?? "",
    projet.avancementReel,
    projet.indiceSante ?? "",
    projet.dateFinPrevue ? libelles.formaterDate(projet.dateFinPrevue) : "",
    projet.budgetInitial === null ? "" : Math.round(projet.budgetInitial / 100),
    libelles.statut(projet.statut),
  ];
}

/* ------------------------------------------------------------------ *
 * Lots et activités.
 * ------------------------------------------------------------------ */

/** Les unités d'une activité, dans l'ordre du sélecteur : longueur, surface, volume, masse, compte. */
export const UNITES_ACTIVITE: UniteActivite[] = ["M", "ML", "M2", "M3", "KG", "T", "U", "ENS", "FFT"];

const JOUR_MS = 24 * 3600 * 1000;

/** La date du jour en ISO court — l'ordre alphabétique en est l'ordre chronologique. */
function isoCourt(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** Le code d'un lot à partir de son rang (0 pour le premier) : `01`. */
export function codeLot(rang: number): string {
  return String(rang + 1).padStart(2, "0");
}

/** Le code d'une activité : celui de son lot, puis son rang dans le lot — `03.02`. */
export function codeActivite(codeDuLot: string, rang: number): string {
  return `${codeDuLot}.${String(rang + 1).padStart(2, "0")}`;
}

/** Le plus grand rang d'une série de codes, 0 si elle est vide. */
function rangMaximal(rangs: number[]): number {
  return rangs.filter(Number.isFinite).reduce((maximum, rang) => Math.max(maximum, rang), 0);
}

/**
 * Le code que prendra le prochain lot : un de plus que le plus grand.
 *
 * Pas « le nombre de lots plus un » : un lot retiré laisserait sinon deux
 * lots sous le même code, et les activités de l'un se liraient dans l'autre.
 */
export function codeLotSuivant(lots: Lot[]): string {
  return codeLot(rangMaximal(lots.map((lot) => Number.parseInt(lot.code, 10))));
}

/** Le code que prendra la prochaine activité du lot, selon la même règle. */
export function codeActiviteSuivant(lot: Lot): string {
  const rangs = lot.activites.map((activite) =>
    Number.parseInt(activite.code.split(".")[1] ?? "", 10),
  );
  return codeActivite(lot.code, rangMaximal(rangs));
}

/**
 * L'avancement qu'une activité *devrait* avoir atteint aujourd'hui, en
 * supposant un rythme régulier entre ses deux dates. 0 avant le début, 100
 * après la fin.
 */
export function avancementTheoriqueActivite(
  activite: Pick<Activite, "dateDebutPrevue" | "dateFinPrevue">,
  maintenant: Date = new Date(),
): number {
  const jour = isoCourt(maintenant);
  if (jour < activite.dateDebutPrevue) return 0;
  if (jour >= activite.dateFinPrevue) return 100;
  const debut = Date.parse(activite.dateDebutPrevue);
  const duree = Math.max(Date.parse(activite.dateFinPrevue) - debut + JOUR_MS, JOUR_MS);
  return Math.round(((Date.parse(jour) - debut) / duree) * 100);
}

/**
 * L'état d'une activité, déduit de ses dates et de son avancement.
 *
 * « En retard » a **la même définition que pour un chantier** : un écart au
 * théorique au-delà de `SEUIL_RETARD_POINTS`. Une activité qui glisse d'un
 * jour n'allume pas d'alerte ; une activité dont la fin est passée sans
 * qu'elle soit terminée, si.
 */
export function statutActivite(activite: Activite, maintenant: Date = new Date()): StatutActivite {
  if (activite.avancement >= 100) return "TERMINE";
  const theorique = avancementTheoriqueActivite(activite, maintenant);
  if (theorique >= 100) return "EN_RETARD";
  if (estEnRetard(ecartAvancement(activite.avancement, theorique))) return "EN_RETARD";
  if (activite.avancement === 0 && theorique === 0) return "A_VENIR";
  return "EN_COURS";
}

/** La quantité déjà réalisée, déduite de l'avancement. `null` sans quantité prévue. */
export function quantiteRealisee(activite: Activite): number | null {
  if (activite.quantitePrevue === null) return null;
  return Math.round((activite.quantitePrevue * activite.avancement) / 100);
}

/**
 * L'avancement d'un ensemble d'activités, **pondéré par leur budget**.
 *
 * Une clôture de chantier et un gros œuvre ne pèsent pas pareil : les mettre
 * à égalité ferait d'un lot à 100 % sur ses petites activités un lot presque
 * fini. Quand aucun budget n'est défini, la moyenne simple est le seul repli
 * honnête. Aucune activité : 0.
 */
export function avancementPondere(activites: Activite[]): number {
  if (activites.length === 0) return 0;
  const poids = activites.reduce((somme, activite) => somme + (activite.budget ?? 0), 0);
  if (poids <= 0) {
    const somme = activites.reduce((total, activite) => total + activite.avancement, 0);
    return Math.round(somme / activites.length);
  }
  const avance = activites.reduce(
    (somme, activite) => somme + (activite.budget ?? 0) * activite.avancement,
    0,
  );
  return Math.round(avance / poids);
}

/** Le budget d'un lot : la somme de ses activités. `null` si aucune n'en a. */
export function budgetLot(lot: Lot): number | null {
  const budgets = lot.activites
    .map((activite) => activite.budget)
    .filter((budget): budget is number => budget !== null);
  return budgets.length === 0 ? null : budgets.reduce((somme, budget) => somme + budget, 0);
}

/**
 * La période d'un lot : du premier début à la dernière fin de ses activités.
 * Sans activité, les dates saisies sur le lot, quand il y en a.
 */
export function periodeLot(lot: Lot): { debut: string | null; fin: string | null } {
  if (lot.activites.length === 0) return { debut: lot.dateDebut, fin: lot.dateFin };
  const debuts = lot.activites.map((activite) => activite.dateDebutPrevue).sort();
  const fins = lot.activites.map((activite) => activite.dateFinPrevue).sort();
  return { debut: debuts[0], fin: fins[fins.length - 1] };
}

/** Toutes les activités d'un chantier, dans l'ordre des lots. */
export function activitesDuProjet(lots: Lot[]): Activite[] {
  return lots.flatMap((lot) => lot.activites);
}

/** Les quatre chiffres de l'en-tête de l'écran. */
export interface SyntheseLots {
  lots: number;
  activites: number;
  /** Pondéré par le budget, sur toutes les activités du chantier. */
  avancement: number;
  enRetard: number;
}

export function syntheseLots(lots: Lot[], maintenant: Date = new Date()): SyntheseLots {
  const activites = activitesDuProjet(lots);
  return {
    lots: lots.length,
    activites: activites.length,
    avancement: avancementPondere(activites),
    enRetard: activites.filter((activite) => statutActivite(activite, maintenant) === "EN_RETARD")
      .length,
  };
}

/**
 * L'activité montrée d'office dans le panneau de détail : la première en
 * retard — c'est elle qui réclame une décision — sinon la première tout court.
 */
export function activiteAMontrer(lots: Lot[], maintenant: Date = new Date()): Activite | null {
  const activites = activitesDuProjet(lots);
  return (
    activites.find((activite) => statutActivite(activite, maintenant) === "EN_RETARD") ??
    activites[0] ??
    null
  );
}

/**
 * Les lots restreints à une recherche et, s'il est donné, à un statut
 * d'activité.
 *
 * Un lot dont le nom ou le code correspond à la recherche garde toutes ses
 * activités ; sinon, il ne garde que celles qui correspondent, et disparaît
 * s'il n'en a aucune. Le statut, lui, ne porte que sur les activités : un lot
 * n'en a pas. Une activité qu'on cherche se lit toujours sous son lot, jamais
 * orpheline.
 */
export function filtrerLots(
  lots: Lot[],
  recherche: string,
  statut: StatutActivite | "" = "",
  maintenant: Date = new Date(),
): Lot[] {
  const cle = normaliser(recherche);
  if (!cle && !statut) return lots;

  return lots.flatMap((lot) => {
    const lotCorrespond =
      !cle || [lot.code, lot.nom].some((champ) => normaliser(champ).includes(cle));
    const activites = lot.activites.filter(
      (activite) =>
        (lotCorrespond ||
          [activite.code, activite.libelle].some((champ) => normaliser(champ).includes(cle))) &&
        (!statut || statutActivite(activite, maintenant) === statut),
    );
    if (activites.length > 0) return [{ ...lot, activites }];
    // Sans filtre de statut, un lot trouvé par son nom reste, même vide.
    return lotCorrespond && !statut ? [{ ...lot, activites }] : [];
  });
}

const ORDRE_STATUTS_ACTIVITE: StatutActivite[] = ["A_VENIR", "EN_COURS", "EN_RETARD", "TERMINE"];

/** Les statuts que portent réellement les activités — les options du filtre. */
export function statutsActivitesPresents(
  lots: Lot[],
  maintenant: Date = new Date(),
): StatutActivite[] {
  const presents = new Set(
    activitesDuProjet(lots).map((activite) => statutActivite(activite, maintenant)),
  );
  return ORDRE_STATUTS_ACTIVITE.filter((statut) => presents.has(statut));
}

/** Un morceau de lot sur une page de la structure. */
export interface TronconLot {
  lot: Lot;
  /** Les activités du lot qui tombent sur cette page. */
  activites: Activite[];
}

/**
 * La structure découpée en pages d'au plus `taille` lignes.
 *
 * Ce qui compte comme une ligne : une activité, ou le lot lui-même quand il
 * est replié ou vide — c'est alors lui seul qu'on lit. L'en-tête d'un lot
 * déplié ne compte pas : il est répété en haut de chaque page où ses
 * activités se poursuivent, pour qu'aucune ne s'y lise sans son lot.
 */
export function paginerLots(
  lots: Lot[],
  estReplie: (lotId: string) => boolean,
  taille: number,
): TronconLot[][] {
  const pages: TronconLot[][] = [];
  let page: TronconLot[] = [];
  let lignes = 0;

  function place(): void {
    if (lignes < taille) return;
    pages.push(page);
    page = [];
    lignes = 0;
  }

  for (const lot of lots) {
    if (estReplie(lot.id) || lot.activites.length === 0) {
      place();
      page.push({ lot, activites: [] });
      lignes += 1;
      continue;
    }
    let reste = lot.activites;
    while (reste.length > 0) {
      place();
      const morceau = reste.slice(0, taille - lignes);
      page.push({ lot, activites: morceau });
      lignes += morceau.length;
      reste = reste.slice(morceau.length);
    }
  }
  if (page.length > 0) pages.push(page);
  return pages;
}

/**
 * Les activités dont une autre peut dépendre : toutes celles du chantier,
 * sauf elle-même — une activité qui s'attend elle-même ne commence jamais.
 */
export function dependancesPossibles(lots: Lot[], activiteId?: string): Activite[] {
  return activitesDuProjet(lots).filter((activite) => activite.id !== activiteId);
}

/**
 * L'étendue du planning d'un chantier : du premier début à la dernière fin,
 * sur tous ses lots. `null` tant qu'aucune date n'est connue.
 */
export function etenduePlanning(lots: Lot[]): { debut: string; fin: string } | null {
  const periodes = lots.map(periodeLot);
  const debuts = periodes.map((periode) => periode.debut).filter((date): date is string => !!date);
  const fins = periodes.map((periode) => periode.fin).filter((date): date is string => !!date);
  if (debuts.length === 0 || fins.length === 0) return null;
  return { debut: debuts.sort()[0], fin: fins.sort()[fins.length - 1] };
}

/**
 * La position d'une barre de planning, en pourcentages de l'étendue :
 * décalage depuis la gauche, et largeur. Une barre d'un jour garde une
 * largeur visible.
 */
export function positionPlanning(
  debut: string,
  fin: string,
  etendue: { debut: string; fin: string },
): { gauche: number; largeur: number } {
  const origine = Date.parse(etendue.debut);
  const total = Math.max(Date.parse(etendue.fin) - origine + JOUR_MS, JOUR_MS);
  const gauche = largeurJauge(((Date.parse(debut) - origine) / total) * 100);
  const largeur = ((Date.parse(fin) - Date.parse(debut) + JOUR_MS) / total) * 100;
  return { gauche, largeur: Math.max(Math.min(largeur, 100 - gauche), 0.5) };
}

/** Le premier jour de chaque mois couvert par l'étendue — les graduations du planning. */
export function moisPlanning(etendue: { debut: string; fin: string }): string[] {
  const mois: string[] = [];
  const [annee, rangMois] = etendue.debut.split("-").map(Number);
  let curseur = new Date(Date.UTC(annee, rangMois - 1, 1));
  while (isoCourt(curseur) <= etendue.fin) {
    mois.push(isoCourt(curseur));
    curseur = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 1, 1));
  }
  return mois;
}

/** La position du jour sur le planning, en pourcentage ; `null` hors de l'étendue. */
export function positionAujourdhui(
  etendue: { debut: string; fin: string },
  maintenant: Date = new Date(),
): number | null {
  const jour = isoCourt(maintenant);
  if (jour < etendue.debut || jour > etendue.fin) return null;
  return positionPlanning(jour, jour, etendue).gauche;
}

/**
 * Le chantier ouvert d'office sur les écrans d'un chantier : le premier qui
 * vit encore. Un chantier terminé ou archivé n'a plus rien à piloter.
 */
export function projetParDefaut(projets: Projet[]): Projet | null {
  return (
    projets.find((projet) => projet.statut !== "TERMINE" && projet.statut !== "ARCHIVE") ??
    projets[0] ??
    null
  );
}

/**
 * Le chantier qu'un écran ouvre quand l'adresse en demande un : celui-là s'il
 * existe (on revient de la fiche d'une de ses équipes), le chantier par
 * défaut sinon — une adresse périmée ne doit pas ouvrir un écran vide.
 */
export function projetOuvert(projets: Projet[], demande: string | undefined): Projet | null {
  return projets.find((projet) => projet.id === demande) ?? projetParDefaut(projets);
}

/* ------------------------------------------------------------------ *
 * Équipes et affectations.
 * ------------------------------------------------------------------ */

/** Les natures d'équipe, dans l'ordre des filtres : les siennes d'abord. */
export const NATURES_EQUIPE: NatureEquipe[] = ["INTERNE", "SOUS_TRAITANT"];

/**
 * L'effectif d'une équipe : son chef, s'il est désigné, et ses membres. La
 * forme est lâche pour servir aussi la saisie en cours, avant tout identifiant.
 */
export function effectifEquipe(equipe: { chef: object | null; membres: readonly object[] }): number {
  return (equipe.chef ? 1 : 0) + equipe.membres.length;
}

/** Le nombre d'équipes de chaque nature — les compteurs des filtres. */
export function compterEquipesParNature(equipes: Equipe[]): Record<NatureEquipe, number> {
  const compte: Record<NatureEquipe, number> = { INTERNE: 0, SOUS_TRAITANT: 0 };
  for (const equipe of equipes) compte[equipe.nature] += 1;
  return compte;
}

/** Les équipes d'une nature ; toutes sans nature donnée. */
export function filtrerEquipes(equipes: Equipe[], nature: NatureEquipe | ""): Equipe[] {
  return nature ? equipes.filter((equipe) => equipe.nature === nature) : equipes;
}

/* ------------------------------------------------------------------ *
 * Les membres d'une équipe.
 * ------------------------------------------------------------------ */

/** Les rôles dans une équipe, du chef à l'apprenti : l'ordre des listes. */
export const ROLES_MEMBRE_EQUIPE: RoleMembreEquipe[] = [
  "CHEF_EQUIPE",
  "OUVRIER_QUALIFIE",
  "CONDUCTEUR_ENGIN",
  "OUVRIER",
  "MANOEUVRE",
  "APPRENTI",
];

/**
 * Les rôles qu'un membre prend à son arrivée. Le chef se désigne à part : on
 * ne le devient qu'en changeant de rôle, ce qui dit ce qu'il advient de
 * l'ancien (voir `changerRoleMembre`).
 */
export const ROLES_MEMBRE_SIMPLE: RoleMembreEquipe[] = ROLES_MEMBRE_EQUIPE.filter(
  (role) => role !== "CHEF_EQUIPE",
);

/** Le rôle proposé d'office à une personne qu'on ajoute. */
export const ROLE_MEMBRE_PAR_DEFAUT: RoleMembreEquipe = "OUVRIER";

/** Ce que redevient un chef d'équipe remplacé : il garde sa qualification. */
export const ROLE_ANCIEN_CHEF: RoleMembreEquipe = "OUVRIER_QUALIFIE";

/** Toute l'équipe, chef en tête : l'ordre du tableau et du tiroir des membres. */
export function membresEquipe(equipe: Pick<Equipe, "chef" | "membres">): MembreEquipe[] {
  return equipe.chef ? [equipe.chef, ...equipe.membres] : equipe.membres;
}

/**
 * Le nombre de personnes mobilisées sur un projet, toutes équipes confondues.
 * Un collaborateur de l'entreprise présent dans deux équipes compte une fois ;
 * une personne sans compte, saisie sur le chantier, compte pour elle-même.
 */
export function effectifProjet(equipes: Pick<Equipe, "chef" | "membres">[]): number {
  const personnes = new Set<string>();
  for (const equipe of equipes) {
    for (const membre of membresEquipe(equipe)) {
      personnes.add(membre.collaborateurId ?? membre.id);
    }
  }
  return personnes.size;
}

/**
 * Une équipe dont un membre change de rôle.
 *
 * Il n'y a qu'un chef par équipe : en nommer un nouveau fait redescendre
 * l'ancien au rang d'ouvrier qualifié, et un chef qui prend un autre rôle
 * laisse l'équipe sans chef désigné — jamais deux chefs, jamais un chef
 * choisi à la place de l'utilisateur.
 */
export function changerRoleMembre<E extends Pick<Equipe, "chef" | "membres">>(
  equipe: E,
  membreId: string,
  role: RoleMembreEquipe,
): E {
  const membre = membresEquipe(equipe).find((candidat) => candidat.id === membreId);
  if (!membre || membre.role === role) return equipe;

  const autres = equipe.membres.filter((candidat) => candidat.id !== membreId);
  if (role === "CHEF_EQUIPE") {
    const ancien = equipe.chef ? [{ ...equipe.chef, role: ROLE_ANCIEN_CHEF }] : [];
    return { ...equipe, chef: { ...membre, role }, membres: [...ancien, ...autres] };
  }
  if (equipe.chef?.id === membreId) {
    return { ...equipe, chef: null, membres: [{ ...membre, role }, ...autres] };
  }
  return {
    ...equipe,
    membres: equipe.membres.map((candidat) =>
      candidat.id === membreId ? { ...candidat, role } : candidat,
    ),
  };
}

/** Une équipe sans l'un de ses membres — le chef compris, qui laisse la place vide. */
export function retirerMembre<E extends Pick<Equipe, "chef" | "membres">>(
  equipe: E,
  membreId: string,
): E {
  return {
    ...equipe,
    chef: equipe.chef?.id === membreId ? null : equipe.chef,
    membres: equipe.membres.filter((membre) => membre.id !== membreId),
  };
}

/** Le collaborateur est-il déjà dans l'équipe — une personne n'y compte qu'une fois. */
export function collaborateurDansEquipe(
  equipe: Pick<Equipe, "chef" | "membres">,
  collaborateurId: string,
): boolean {
  return membresEquipe(equipe).some((membre) => membre.collaborateurId === collaborateurId);
}

/**
 * Les collaborateurs qu'on peut mettre dans une équipe : ceux dont le compte
 * vit (actif, ou invité qui n'a pas encore répondu) et qui n'y sont pas déjà.
 * `garde` reste proposé même pris : c'est le choix de la ligne en cours, qui
 * ne doit pas disparaître de sa propre liste.
 */
export function collaborateursDisponibles(
  collaborateurs: Collaborateur[],
  dejaPris: readonly string[],
  garde?: string,
): Collaborateur[] {
  const pris = new Set(dejaPris);
  return collaborateurs.filter(
    (collaborateur) =>
      collaborateur.statut !== "EXPIREE" &&
      (collaborateur.id === garde || !pris.has(collaborateur.id)),
  );
}

/**
 * « Koffi Kouassi Yao » → prénom « Koffi », nom « Kouassi Yao ». Le premier
 * mot fait le prénom : c'est l'usage du formulaire, qui les propose ensuite
 * séparément pour qu'on corrige un nom composé.
 */
export function separerNomComplet(nomComplet: string): { prenom: string; nom: string } {
  const [prenom = "", ...nom] = nomComplet.trim().split(/\s+/);
  return { prenom, nom: nom.join(" ") };
}

/** Les critères du tableau des membres d'une équipe. */
export interface CriteresMembres {
  recherche: string;
  role: RoleMembreEquipe | "";
}

export const CRITERES_MEMBRES_VIDES: CriteresMembres = { recherche: "", role: "" };

/** Les membres d'une équipe, chef en tête, restreints aux critères. */
export function filtrerMembres(
  equipe: Pick<Equipe, "chef" | "membres">,
  criteres: CriteresMembres,
): MembreEquipe[] {
  const cle = normaliser(criteres.recherche);
  return membresEquipe(equipe).filter((membre) => {
    if (criteres.role && membre.role !== criteres.role) return false;
    return !cle || normaliser(`${membre.prenom} ${membre.nom}`).includes(cle);
  });
}

export function criteresMembresActifs(criteres: CriteresMembres): boolean {
  return criteres.recherche.trim() !== "" || criteres.role !== "";
}

/** Les rôles que porte au moins un membre : un filtre ne propose que ce qui existe. */
export function rolesPresents(equipe: Pick<Equipe, "chef" | "membres">): RoleMembreEquipe[] {
  const presents = new Set(membresEquipe(equipe).map((membre) => membre.role));
  return ROLES_MEMBRE_EQUIPE.filter((role) => presents.has(role));
}

/**
 * Les activités sur lesquelles une équipe travaille aujourd'hui : celles qui
 * lui sont affectées et qui ont commencé sans être finies — en cours ou en
 * retard. Une activité à venir ne l'occupe pas encore.
 */
export function activitesEnCoursEquipe(
  equipeId: string,
  lots: Lot[],
  maintenant: Date = new Date(),
): Activite[] {
  return activitesDuProjet(lots).filter((activite) => {
    if (activite.equipe?.id !== equipeId) return false;
    const statut = statutActivite(activite, maintenant);
    return statut === "EN_COURS" || statut === "EN_RETARD";
  });
}

/** Les quatre chiffres de l'en-tête de l'écran « Équipes et affectations ». */
export interface SyntheseEquipes {
  equipes: number;
  /** Le total des effectifs de toutes les équipes du chantier. */
  effectif: number;
  /** Les activités qui ont une équipe. */
  affectees: number;
  /**
   * Les activités sans équipe **qui restent à faire** : une activité terminée
   * sans équipe renseignée n'appelle plus aucune décision.
   */
  aAffecter: number;
}

export function syntheseEquipes(
  equipes: Equipe[],
  lots: Lot[],
  maintenant: Date = new Date(),
): SyntheseEquipes {
  const activites = activitesDuProjet(lots);
  return {
    equipes: equipes.length,
    effectif: equipes.reduce((total, equipe) => total + equipe.effectif, 0),
    affectees: activites.filter((activite) => activite.equipe !== null).length,
    aAffecter: activites.filter(
      (activite) => activite.equipe === null && statutActivite(activite, maintenant) !== "TERMINE",
    ).length,
  };
}

/** Les critères de la liste des affectations. */
export interface CriteresAffectations {
  recherche: string;
  lotId: string;
  equipeId: string;
}

export const CRITERES_AFFECTATIONS_VIDES: CriteresAffectations = {
  recherche: "",
  lotId: "",
  equipeId: "",
};

/**
 * La valeur du filtre d'équipe qui retient les activités **sans** équipe :
 * c'est la question qu'on pose le plus souvent à cette liste.
 */
export const SANS_EQUIPE = "__sans_equipe__";

/**
 * Les affectations d'un chantier — une par activité, dans l'ordre des lots —
 * restreintes aux critères. La recherche porte sur le code et le libellé de
 * l'activité, et sur le nom de son équipe.
 */
export function filtrerAffectations(lots: Lot[], criteres: CriteresAffectations): Activite[] {
  const cle = normaliser(criteres.recherche);
  return activitesDuProjet(lots).filter((activite) => {
    if (criteres.lotId && activite.lotId !== criteres.lotId) return false;
    if (criteres.equipeId === SANS_EQUIPE && activite.equipe !== null) return false;
    if (
      criteres.equipeId &&
      criteres.equipeId !== SANS_EQUIPE &&
      activite.equipe?.id !== criteres.equipeId
    ) {
      return false;
    }
    if (!cle) return true;
    return [activite.code, activite.libelle, activite.equipe?.nom ?? ""].some((champ) =>
      normaliser(champ).includes(cle),
    );
  });
}

/** Vrai quand un critère des affectations restreint la liste. */
export function criteresAffectationsActifs(criteres: CriteresAffectations): boolean {
  return criteres.recherche.trim() !== "" || criteres.lotId !== "" || criteres.equipeId !== "";
}

/**
 * Les activités qu'on peut affecter : celles qui ne sont pas terminées. Une
 * activité close ne change plus d'équipe — ses heures sont déjà imputées.
 * L'activité déjà choisie reste proposée, même terminée, pour qu'un tiroir
 * ouvert sur elle ne l'efface pas de sa propre liste.
 */
export function activitesAffectables(
  lots: Lot[],
  activiteId?: string,
  maintenant: Date = new Date(),
): Activite[] {
  return activitesDuProjet(lots).filter(
    (activite) =>
      activite.id === activiteId || statutActivite(activite, maintenant) !== "TERMINE",
  );
}

/**
 * Les autres activités de l'équipe dont la période chevauche celle-ci, et qui
 * ne sont pas terminées : ce que l'équipe devrait faire en même temps. Ce
 * n'est pas un refus — une équipe de huit peut tenir deux fronts — mais une
 * question à se poser avant de valider.
 */
export function chevauchementsEquipe(
  lots: Lot[],
  equipeId: string,
  activite: Pick<Activite, "id" | "dateDebutPrevue" | "dateFinPrevue">,
  maintenant: Date = new Date(),
): Activite[] {
  return activitesDuProjet(lots).filter(
    (autre) =>
      autre.id !== activite.id &&
      autre.equipe?.id === equipeId &&
      autre.dateDebutPrevue <= activite.dateFinPrevue &&
      autre.dateFinPrevue >= activite.dateDebutPrevue &&
      statutActivite(autre, maintenant) !== "TERMINE",
  );
}

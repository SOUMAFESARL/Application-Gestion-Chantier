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
import { LOTS_INDICATIFS } from "@/features/referentiels/lots";

import type {
  Activite,
  AffectationProjet,
  AnomalieImportLot,
  CreationLotProjet,
  Equipe,
  FonctionAutreMembre,
  FonctionProjet,
  Intervenant,
  LigneImportLot,
  Lot,
  MembreEquipe,
  ModeExecutionLot,
  NatureEquipe,
  Projet,
  StatutActivite,
  StatutProjet,
  TypeBordereau,
  TypeProjet,
  TypeProjetPredefini,
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
  // Sans fin prévue, il n'y a pas d'échéance à dépasser.
  if (!projet.dateFinPrevue) return false;
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

/**
 * Les jours calendaires d'une date ISO courte à une autre ; négatif si `fin`
 * précède `debut`, `null` si l'une manque.
 */
function joursEntre(debut: string | null, fin: string | null): number | null {
  if (!debut || !fin) return null;
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

/**
 * Les natures de projet proposées, dans l'ordre du combobox. Pas d'« Autre » :
 * un type absent de la liste se tape dans la recherche.
 */
export const TYPES_PROJET: TypeProjetPredefini[] = [
  "BATIMENT_RESIDENTIEL",
  "BATIMENT_TERTIAIRE",
  "INDUSTRIEL",
  "GENIE_CIVIL",
  "VRD",
  "REHABILITATION",
];

/** Tous les codes que l'application sait nommer, `AUTRE` hérité compris. */
const TYPES_PROJET_CONNUS: readonly string[] = [...TYPES_PROJET, "AUTRE"];

/** Vrai si le type est un code connu, faux s'il a été saisi librement. */
export function estTypeProjetPredefini(type: TypeProjet): type is TypeProjetPredefini {
  return TYPES_PROJET_CONNUS.includes(type);
}

/**
 * Le libellé d'un type de projet : traduit s'il est prédéfini, tel que saisi
 * sinon. Le seul endroit où cette distinction se fait — un écran qui
 * traduirait directement le code planterait sur un type libre.
 */
export function libelleTypeProjet(
  type: TypeProjet,
  libellePredefini: (type: TypeProjetPredefini) => string,
): string {
  return estTypeProjetPredefini(type) ? libellePredefini(type) : type;
}

/* ------------------------------------------------------------------ *
 * Les contrats joints à la création.
 * ------------------------------------------------------------------ */

/** Le seul format accepté : un contrat signé circule en PDF, pas en Word. */
export const FORMAT_CONTRAT = "application/pdf";

/**
 * Le plafond d'un contrat, en octets. Un marché scanné avec ses annexes
 * dépasse rarement 10 Mo ; 20 Mo laissent de la marge sans laisser passer
 * un dossier entier qu'on aurait dû découper.
 */
export const TAILLE_MAX_CONTRAT = 20 * 1024 * 1024;

/** Contrat, avenants, annexes : au-delà, ce sont les documents du projet. */
export const NOMBRE_MAX_CONTRATS = 10;

export type RefusContrat = "FORMAT" | "TAILLE";

/**
 * Pourquoi un fichier ne peut pas être joint comme contrat — `null` s'il
 * convient. Certains navigateurs laissent `type` vide : l'extension tranche
 * alors.
 */
export function refusContrat(fichier: { name: string; type: string; size: number }): RefusContrat | null {
  const estPdf = fichier.type ? fichier.type === FORMAT_CONTRAT : fichier.name.toLowerCase().endsWith(".pdf");
  if (!estPdf) return "FORMAT";
  if (fichier.size > TAILLE_MAX_CONTRAT) return "TAILLE";
  return null;
}

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

/**
 * Un lot ne se supprime que tant qu'aucune de ses activités n'a avancé :
 * l'avancement vient du journal de chantier, et le supprimer effacerait ce
 * qui a été constaté sur le terrain. Ses activités encore à zéro partent
 * avec lui.
 */
export function lotSupprimable(lot: Pick<Lot, "activites">): boolean {
  return lot.activites.every((activite) => activite.avancement === 0);
}

/** Le code que prendra la prochaine activité du lot, selon la même règle. */
export function codeActiviteSuivant(lot: Lot): string {
  const rangs = lot.activites.map((activite) =>
    Number.parseInt(activite.code.split(".")[1] ?? "", 10),
  );
  return codeActivite(lot.code, rangMaximal(rangs));
}

/** Les deux dates d'une activité, quand elle est planifiée. `null` sinon. */
export function periodeActivite(
  activite: Pick<Activite, "dateDebutPrevue" | "dateFinPrevue">,
): { debut: string; fin: string } | null {
  if (!activite.dateDebutPrevue || !activite.dateFinPrevue) return null;
  return { debut: activite.dateDebutPrevue, fin: activite.dateFinPrevue };
}

/**
 * L'avancement qu'une activité *devrait* avoir atteint aujourd'hui, en
 * supposant un rythme régulier entre ses deux dates. 0 avant le début, 100
 * après la fin.
 *
 * `null` pour une activité qui n'est pas encore planifiée : sans dates, rien
 * n'est attendu d'elle — ni retard, ni avance.
 */
export function avancementTheoriqueActivite(
  activite: Pick<Activite, "dateDebutPrevue" | "dateFinPrevue">,
  maintenant: Date = new Date(),
): number | null {
  const periode = periodeActivite(activite);
  if (!periode) return null;
  const jour = isoCourt(maintenant);
  if (jour < periode.debut) return 0;
  if (jour >= periode.fin) return 100;
  const debut = Date.parse(periode.debut);
  const duree = Math.max(Date.parse(periode.fin) - debut + JOUR_MS, JOUR_MS);
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
  // Pas planifiée : elle n'est en retard sur rien.
  if (theorique === null) return activite.avancement === 0 ? "A_VENIR" : "EN_COURS";
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
 * L'avancement d'un ensemble d'activités : leur moyenne simple. Le budget se
 * tient au lot, pas à l'activité — il n'y a rien d'autre pour les départager.
 * Aucune activité : 0.
 */
export function avancementActivites(activites: Activite[]): number {
  if (activites.length === 0) return 0;
  const somme = activites.reduce((total, activite) => total + activite.avancement, 0);
  return Math.round(somme / activites.length);
}

/**
 * L'avancement d'un chantier, **pondéré par le budget de ses lots**.
 *
 * Une clôture de chantier et un gros œuvre ne pèsent pas pareil : les mettre
 * à égalité ferait d'un chantier dont les petits lots sont finis un chantier
 * presque fini. La pondération n'a de sens que si **chaque** lot qui a des
 * activités a son budget — un lot sans budget pèserait zéro et disparaîtrait
 * du calcul. Sinon, la moyenne simple des activités est le seul repli honnête.
 */
export function avancementPondere(lots: Lot[]): number {
  const mesures = lots.filter((lot) => lot.activites.length > 0);
  const toutBudgete = mesures.length > 0 && mesures.every((lot) => (lot.budget ?? 0) > 0);
  if (!toutBudgete) return avancementActivites(activitesDuProjet(lots));
  const poids = mesures.reduce((somme, lot) => somme + (lot.budget ?? 0), 0);
  const avance = mesures.reduce(
    (somme, lot) => somme + (lot.budget ?? 0) * avancementActivites(lot.activites),
    0,
  );
  return Math.round(avance / poids);
}

/**
 * La période d'un lot : du premier début à la dernière fin de ses activités
 * planifiées. Sans activité datée, les dates saisies sur le lot, quand il y
 * en a.
 */
export function periodeLot(lot: Lot): { debut: string | null; fin: string | null } {
  const debuts = lot.activites
    .map((activite) => activite.dateDebutPrevue)
    .filter((date): date is string => !!date)
    .sort();
  const fins = lot.activites
    .map((activite) => activite.dateFinPrevue)
    .filter((date): date is string => !!date)
    .sort();
  return { debut: debuts[0] ?? lot.dateDebut, fin: fins[fins.length - 1] ?? lot.dateFin };
}

/** Toutes les activités d'un chantier, dans l'ordre des lots. */
export function activitesDuProjet(lots: Lot[]): Activite[] {
  return lots.flatMap((lot) => lot.activites);
}

/** Les quatre chiffres de l'en-tête de l'écran. */
export interface SyntheseLots {
  lots: number;
  activites: number;
  /** Pondéré par le budget des lots (`avancementPondere`). */
  avancement: number;
  enRetard: number;
}

export function syntheseLots(lots: Lot[], maintenant: Date = new Date()): SyntheseLots {
  const activites = activitesDuProjet(lots);
  return {
    lots: lots.length,
    activites: activites.length,
    avancement: avancementPondere(lots),
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
      collaborateur.statut !== "DESACTIVE" &&
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
  // Une activité sans dates ne chevauche rien : on ne sait pas encore quand.
  const periode = periodeActivite(activite);
  if (!periode) return [];
  return activitesDuProjet(lots).filter((autre) => {
    const autrePeriode = periodeActivite(autre);
    return (
      autre.id !== activite.id &&
      autre.equipe?.id === equipeId &&
      autrePeriode !== null &&
      autrePeriode.debut <= periode.fin &&
      autrePeriode.fin >= periode.debut &&
      statutActivite(autre, maintenant) !== "TERMINE"
    );
  });
}

/* ------------------------------------------------------------------ *
 * La fiche projet générée (F1 §9).
 * ------------------------------------------------------------------ */

/** « Activités à démarrer dans les 14 prochains jours » (F1 §9.4, section 7). */
export const HORIZON_PROCHAINES_ETAPES_JOURS = 14;

/** La longueur maximale de la note du chef de projet, saisie à la génération. */
export const LONGUEUR_MAX_NOTE_FICHE = 2000;

/**
 * L'état d'un lot : celui de ses activités. `SANS_ACTIVITE` n'est pas un
 * zéro — F1 §10 : un lot sans activité est exclu du calcul et s'affiche « — ».
 */
export type StatutLot = StatutActivite | "SANS_ACTIVITE";

export function statutLot(lot: Lot, maintenant: Date = new Date()): StatutLot {
  if (lot.activites.length === 0) return "SANS_ACTIVITE";
  const statuts = lot.activites.map((activite) => statutActivite(activite, maintenant));
  if (statuts.every((statut) => statut === "TERMINE")) return "TERMINE";
  if (statuts.includes("EN_RETARD")) return "EN_RETARD";
  if (statuts.every((statut) => statut === "A_VENIR")) return "A_VENIR";
  return "EN_COURS";
}

/** L'avancement d'un lot, moyenne de ses activités. `null` sans activité (F1 §10). */
export function avancementLot(lot: Lot): number | null {
  return lot.activites.length === 0 ? null : avancementActivites(lot.activites);
}

/** Une activité, lue avec le lot qui la porte. */
export interface ActiviteDuLot {
  activite: Activite;
  lot: Lot;
}

/**
 * Les activités pas encore commencées dont le début prévu tombe dans les
 * `HORIZON_PROCHAINES_ETAPES_JOURS` prochains jours, la plus proche d'abord.
 */
export function prochainesEtapes(lots: Lot[], maintenant: Date = new Date()): ActiviteDuLot[] {
  const debut = isoCourt(maintenant);
  const fin = isoCourt(new Date(maintenant.getTime() + HORIZON_PROCHAINES_ETAPES_JOURS * JOUR_MS));
  return lots
    .flatMap((lot) => lot.activites.map((activite) => ({ activite, lot })))
    .filter(
      ({ activite }) =>
        activite.avancement === 0 &&
        !!activite.dateDebutPrevue &&
        activite.dateDebutPrevue >= debut &&
        activite.dateDebutPrevue <= fin,
    )
    .sort((a, b) => (a.activite.dateDebutPrevue ?? "").localeCompare(b.activite.dateDebutPrevue ?? ""));
}

/**
 * Le taux de respect des délais : la part des activités **attendues** — celles
 * dont le début prévu est passé — qui ne sont pas en retard. `null` tant
 * qu'aucune n'est attendue : 100 % se lirait comme une performance.
 */
export function tauxRespectDelais(lots: Lot[], maintenant: Date = new Date()): number | null {
  const attendues = activitesDuProjet(lots).filter(
    (activite) => (avancementTheoriqueActivite(activite, maintenant) ?? 0) > 0,
  );
  if (attendues.length === 0) return null;
  const aLHeure = attendues.filter(
    (activite) => statutActivite(activite, maintenant) !== "EN_RETARD",
  ).length;
  return Math.round((aLHeure / attendues.length) * 100);
}

/**
 * Un point de vigilance de la fiche (F1 §9.4, section 5). C'est un **code**
 * et ses chiffres, pas une phrase : le libellé appartient à l'écran.
 */
export type PointVigilance =
  | { code: "ECHEANCE_DEPASSEE"; jours: number }
  | { code: "RETARD_AVANCEMENT"; ecart: number }
  | { code: "BUDGET"; niveau: Exclude<NiveauBudget, "conforme">; ratio: number }
  | { code: "LOT_EN_RETARD"; lot: Lot }
  | { code: "ACTIVITE_EN_RETARD"; activite: Activite; lot: Lot; theorique: number };

/**
 * Ce qui réclame une décision, du plus large au plus fin : le projet (délai,
 * avancement, budget), puis chaque lot en retard **suivi de ses propres
 * activités en retard** — la fiche les hiérarchise lot par lot.
 */
export function pointsDeVigilance(
  projet: Projet,
  lots: Lot[],
  maintenant: Date = new Date(),
): PointVigilance[] {
  const points: PointVigilance[] = [];

  const { joursRestants } = echeancierProjet(projet, maintenant);
  if (joursRestants !== null && joursRestants < 0) {
    points.push({ code: "ECHEANCE_DEPASSEE", jours: Math.abs(joursRestants) });
  }

  const ecart = ecartAvancement(projet.avancementReel, projet.avancementTheorique);
  if (estEnRetard(ecart)) points.push({ code: "RETARD_AVANCEMENT", ecart });

  const ratio = ratioConsommationBudget(projet.budgetInitial, projet.budgetConsomme);
  const niveau = niveauBudget(ratio);
  if (ratio !== null && niveau && niveau !== "conforme") {
    points.push({ code: "BUDGET", niveau, ratio });
  }

  // Chaque lot en retard, suivi aussitôt de ses activités en retard.
  for (const lot of lots) {
    if (statutLot(lot, maintenant) !== "EN_RETARD") continue;
    points.push({ code: "LOT_EN_RETARD", lot });
    for (const activite of lot.activites) {
      if (statutActivite(activite, maintenant) === "EN_RETARD") {
        points.push({
          code: "ACTIVITE_EN_RETARD",
          activite,
          lot,
          // En retard, elle est forcément planifiée : le théorique existe.
          theorique: avancementTheoriqueActivite(activite, maintenant) ?? 0,
        });
      }
    }
  }
  return points;
}

/** Comment se lit un taux de conformité : délais tenus, rapports remis. */
export type NiveauConformite = "conforme" | "alerte" | "critique";

/** Au-dessus : conforme. */
export const SEUIL_CONFORMITE = 90;
/** En dessous : critique. Entre les deux : alerte. */
export const SEUIL_CONFORMITE_CRITIQUE = 70;

export function niveauConformite(taux: number | null): NiveauConformite | null {
  if (taux === null) return null;
  if (taux >= SEUIL_CONFORMITE) return "conforme";
  if (taux >= SEUIL_CONFORMITE_CRITIQUE) return "alerte";
  return "critique";
}

/* ------------------------------------------------------------------ *
 * Les chantiers d'un collaborateur — sa fiche dans les paramètres.
 * ------------------------------------------------------------------ */

/** L'ordre dans lequel les fonctions d'une même personne se lisent. */
export const ORDRE_FONCTIONS: FonctionProjet[] = [
  "CHEF_PROJET",
  "CONDUCTEUR_TRAVAUX",
  "CHEF_CHANTIER",
  "AUTRE_MEMBRE",
];

/** Les fonctions que la personne tient dans l'équipe d'encadrement d'un chantier. */
export function fonctionsDansProjet(projet: Projet, collaborateurId: string): FonctionProjet[] {
  return ORDRE_FONCTIONS.filter((fonction) =>
    membresDeFonction(projet, fonction).some((membre) => membre.id === collaborateurId),
  );
}

/* ------------------------------------------------------------------ *
 * L'équipe d'encadrement et de gestion du projet.
 * ------------------------------------------------------------------ */

/** Ce qu'un « autre membre » peut faire sur un projet, dans l'ordre du choix. */
export const FONCTIONS_AUTRE_MEMBRE: readonly FonctionAutreMembre[] = [
  "FINANCIER",
  "INGENIEUR",
  "DOCUMENTALISTE",
  "METREUR",
  "QHSE",
  "AUTRE",
];

/** Les personnes qui tiennent une fonction de l'encadrement, sans ce qui précise leur place. */
export function membresDeFonction(projet: Projet, fonction: FonctionProjet): Intervenant[] {
  switch (fonction) {
    case "CHEF_PROJET":
      return projet.chefProjet ? [projet.chefProjet] : [];
    case "CONDUCTEUR_TRAVAUX":
      return projet.conducteursTravaux;
    case "CHEF_CHANTIER":
      return projet.chefsChantier.map((chef) => chef.intervenant);
    case "AUTRE_MEMBRE":
      return projet.autresMembres.map((membre) => membre.intervenant);
  }
}

/** Le nombre de personnes distinctes dans l'encadrement — un cumul ne compte qu'une fois. */
export function effectifEncadrement(projet: Projet): number {
  const identifiants = new Set(
    ORDRE_FONCTIONS.flatMap((fonction) => membresDeFonction(projet, fonction).map((membre) => membre.id)),
  );
  return identifiants.size;
}

/**
 * Les utilisateurs du compte qu'on peut encore placer à cette fonction : un
 * compte désactivé ne se désigne pas, et une personne n'occupe pas deux fois
 * la même place — le chef de projet en place n'est donc pas reproposé.
 */
export function candidatsEncadrement(
  utilisateurs: Collaborateur[],
  projet: Projet,
  fonction: FonctionProjet,
): Collaborateur[] {
  const pris = new Set(membresDeFonction(projet, fonction).map((membre) => membre.id));
  return utilisateurs.filter((utilisateur) => utilisateur.statut !== "DESACTIVE" && !pris.has(utilisateur.id));
}

/** Un utilisateur du compte, vu comme un intervenant du projet. */
export function intervenantDuCollaborateur(collaborateur: Collaborateur): Intervenant {
  return {
    id: collaborateur.id,
    nom: collaborateur.nom,
    prenom: collaborateur.prenom,
    nomComplet: collaborateur.nomComplet,
    email: collaborateur.email,
    telephone: collaborateur.telephone,
    statut: collaborateur.statut === "DESACTIVE" ? null : collaborateur.statut,
    lienWhatsApp: null,
  };
}

/** Le premier membre financier de l'encadrement — le signataire financier de la fiche. */
export function financierDuProjet(projet: Projet): Intervenant | null {
  return projet.autresMembres.find((membre) => membre.fonction === "FINANCIER")?.intervenant ?? null;
}

/**
 * Les chantiers où la personne est désignée dans l'équipe projet.
 *
 * La correspondance se fait sur l'**identifiant du compte**, jamais sur le
 * nom : deux « Koné » ne sont pas la même personne. Les membres des équipes
 * de terrain n'y figurent pas — ils se lisent chantier par chantier.
 */
export function affectationsDuCollaborateur(
  projets: Projet[],
  collaborateurId: string,
): AffectationProjet[] {
  return projets
    .map((projet) => ({ projet, fonctions: fonctionsDansProjet(projet, collaborateurId) }))
    .filter((affectation) => affectation.fonctions.length > 0);
}

/**
 * Les affectations rangées par statut du chantier, dans l'ordre de
 * `ORDRE_STATUTS` — l'urgent d'abord. Un statut sans chantier n'apparaît pas.
 */
export function affectationsParStatut(
  affectations: AffectationProjet[],
): { statut: StatutProjet; affectations: AffectationProjet[] }[] {
  return ORDRE_STATUTS.map((statut) => ({
    statut,
    affectations: affectations.filter((affectation) => affectation.projet.statut === statut),
  })).filter((groupe) => groupe.affectations.length > 0);
}

/* ------------------------------------------------------------------ *
 * L'import de lots depuis un tableur.
 *
 * Le fichier n'a pas de gabarit imposé : un client remet sa liste de lots
 * telle qu'elle sort de son DCE. On cherche donc une ligne d'en-tête, on
 * reconnaît les colonnes à leur titre, et l'on n'exige que le nom. Ce qui
 * manque — mode d'exécution, bordereau — prend le choix par défaut de
 * l'écran ; ce qui est illisible est laissé vide et signalé.
 * ------------------------------------------------------------------ */

/** Au-delà, ce n'est plus une liste de lots, et l'aperçu deviendrait illisible. */
export const NOMBRE_MAX_LOTS_IMPORT = 200;

/** Une liste de lots tient en quelques dizaines de ko. */
export const TAILLE_MAX_IMPORT_LOTS = 5 * 1024 * 1024;

/** Le seul format lu. `.xls` (Excel 97, binaire) ne l'est pas : il faut l'enregistrer en `.xlsx`. */
export const EXTENSION_IMPORT_LOTS = ".xlsx";

/** Pourquoi un fichier de lots est écarté avant même d'être lu. */
export type RefusFichierLots = "FORMAT" | "TAILLE";

export function refusFichierLots(fichier: Pick<File, "name" | "size">): RefusFichierLots | null {
  if (!fichier.name.toLowerCase().endsWith(EXTENSION_IMPORT_LOTS)) return "FORMAT";
  if (fichier.size > TAILLE_MAX_IMPORT_LOTS) return "TAILLE";
  return null;
}

/**
 * Minuscules, sans accents, ligatures dépliées (« Gros œuvre » = « Gros
 * oeuvre »), apostrophes et espaces (insécables comprises) unifiées.
 */
function normaliserImport(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/æ/g, "ae")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Le texte d'une cellule, espaces nettoyées. Vide pour une cellule vide ou non textuelle. */
function texteCellule(valeur: unknown): string {
  if (typeof valeur === "string") return valeur.replace(/\s+/g, " ").trim();
  if (typeof valeur === "number") return String(valeur);
  return "";
}

type ColonneImport = "nom" | "modeExecution" | "typeBordereau" | "budget" | "dateDebut" | "dateFin";

/** Ce qu'annonce un titre de colonne. L'ordre compte : « Budget du lot » est un budget. */
function roleEntete(entete: string): ColonneImport | null {
  const titre = normaliserImport(entete);
  if (!titre) return null;
  if (titre.includes("mode") || titre.includes("execution")) return "modeExecution";
  if (titre.includes("bordereau")) return "typeBordereau";
  if (titre.includes("budget") || titre.includes("montant")) return "budget";
  if (titre.includes("debut")) return "dateDebut";
  if (/\bfin\b/.test(titre)) return "dateFin";
  if (/^(nom|lots?|libelle|designation|intitule)\b/.test(titre)) return "nom";
  return null;
}

/** Le nombre de textes distincts d'une colonne : une colonne qui répète « Lot » n'est pas celle des noms. */
function diversite(lignes: unknown[][], colonne: number): number {
  return new Set(lignes.map((ligne) => texteCellule(ligne[colonne])).filter(Boolean)).size;
}

/** Parmi des colonnes candidates, celle qui porte le plus de noms différents. */
function colonnePlusDiverse(lignes: unknown[][], candidates: number[]): number | undefined {
  return candidates.reduce<number | undefined>(
    (meilleure, colonne) =>
      meilleure === undefined || diversite(lignes, colonne) > diversite(lignes, meilleure)
        ? colonne
        : meilleure,
    undefined,
  );
}

function sansPrefixeFamille(titre: string): string {
  return titre.replace(/^[a-z]\s*:\s*/, "").replace(/^lots?\s+/, "");
}

/** Un intitulé de corps d'état, tel qu'une liste de lots les intercale : « LOTS TECHNIQUES », « E: EQUIPEMENTS ». */
const INTITULES_FAMILLES = new Set(
  LOTS_INDICATIFS.map((famille) => sansPrefixeFamille(normaliserImport(famille.famille))),
);

/** Un mode d'exécution écrit en clair (« Régie directe », « sous-traitance informelle ») ou par son code. */
export function modeExecutionDepuisTexte(valeur: string): ModeExecutionLot | null {
  const texte = normaliserImport(valeur).replace(/[^a-z]/g, "");
  if (texte.includes("regie")) return "REGIE_DIRECTE";
  if (texte.includes("informel")) return "SOUS_TRAITANCE_INFORMELLE";
  if (texte.includes("structur")) return "SOUS_TRAITANCE_STRUCTUREE";
  return null;
}

/** Un type de bordereau écrit en clair (« Forfait », « PU ») ou par son code. */
export function typeBordereauDepuisTexte(valeur: string): TypeBordereau | null {
  const texte = normaliserImport(valeur).replace(/[^a-z]/g, "");
  if (texte.includes("forfait")) return "FORFAIT_GLOBAL";
  if (texte.includes("unitaire") || texte === "pu") return "PRIX_UNITAIRE";
  return null;
}

/**
 * Un budget lu dans une cellule, en centimes. Un nombre est pris en francs ;
 * un texte peut grouper ses milliers (« 2 500 000 », « 2.500.000 ») et
 * porter la devise. `undefined` : la cellule est vide ; `null` : illisible.
 */
function budgetCellule(valeur: unknown): number | null | undefined {
  if (valeur === null || valeur === undefined || valeur === "") return undefined;
  let francs: number | null = null;
  if (typeof valeur === "number") francs = valeur;
  else if (typeof valeur === "string") {
    const chiffres = normaliserImport(valeur).replace(/(f ?cfa|xof|f)$/, "").replace(/[\s.]/g, "");
    if (chiffres === "") return undefined;
    francs = /^\d+$/.test(chiffres) ? Number(chiffres) : null;
  }
  if (francs === null || !Number.isFinite(francs)) return null;
  const centimes = Math.round(francs * 100);
  return budgetRecevable(centimes) ? centimes : null;
}

/** Une date ISO courte réelle — « 2026-02-30 » n'en est pas une. */
function dateIsoValide(annee: number, mois: number, jour: number): string | null {
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (date.getUTCFullYear() !== annee || date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) {
    return null;
  }
  return isoCourt(date);
}

/** Le décalage entre l'origine des dates d'Excel (30/12/1899) et celle de JavaScript, en jours. */
const ORIGINE_EXCEL_JOURS = 25569;

/**
 * Une date lue dans une cellule : une vraie date du tableur, un numéro de
 * série Excel, ou un texte « jj/mm/aaaa » / « aaaa-mm-jj ».
 * `undefined` : la cellule est vide ; `null` : illisible.
 */
function dateCellule(valeur: unknown): string | null | undefined {
  if (valeur === null || valeur === undefined || valeur === "") return undefined;
  if (valeur instanceof Date) return Number.isNaN(valeur.getTime()) ? null : isoCourt(valeur);
  if (typeof valeur === "number") {
    const date = new Date(Math.round((valeur - ORIGINE_EXCEL_JOURS) * JOUR_MS));
    return Number.isNaN(date.getTime()) ? null : isoCourt(date);
  }
  const texte = texteCellule(valeur);
  if (texte === "") return undefined;
  const francaise = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texte);
  if (francaise) return dateIsoValide(Number(francaise[3]), Number(francaise[2]), Number(francaise[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texte);
  if (iso) return dateIsoValide(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return null;
}

/**
 * Les lots d'une feuille de tableur, ligne par ligne.
 *
 * L'en-tête est la première des dix premières lignes qui annonce une colonne
 * de noms (« Nom », « Lots », « Désignation »…) ; sans elle, toute la
 * feuille est lue et la colonne des noms est la plus variée. Les lignes
 * vides sont sautées, et la lecture s'arrête à `NOMBRE_MAX_LOTS_IMPORT`.
 */
export function lireLotsImportes(feuille: unknown[][], lotsExistants: Lot[]): LigneImportLot[] {
  const rangEntete = feuille
    .slice(0, 10)
    .findIndex((ligne) => ligne.some((cellule) => roleEntete(texteCellule(cellule)) === "nom"));
  const donnees = rangEntete === -1 ? feuille : feuille.slice(rangEntete + 1);
  // Le numéro, dans le tableur, de la première ligne de données.
  const premiereLigne = rangEntete + 2;

  const colonnes: Partial<Record<ColonneImport, number>> = {};
  if (rangEntete === -1) {
    const largeur = Math.max(0, ...donnees.map((ligne) => ligne.length));
    colonnes.nom = colonnePlusDiverse(donnees, Array.from({ length: largeur }, (_, rang) => rang));
  } else {
    const candidatesNom: number[] = [];
    feuille[rangEntete].forEach((cellule, rang) => {
      const role = roleEntete(texteCellule(cellule));
      if (role === "nom") candidatesNom.push(rang);
      else if (role && colonnes[role] === undefined) colonnes[role] = rang;
    });
    colonnes.nom = colonnePlusDiverse(donnees, candidatesNom);
  }
  const colonneNom = colonnes.nom;
  if (colonneNom === undefined) return [];

  const existants = new Set(lotsExistants.map((lot) => normaliserImport(lot.nom)));
  const vus = new Set<string>();
  const lignes: LigneImportLot[] = [];

  donnees.forEach((ligne, rang) => {
    if (lignes.length >= NOMBRE_MAX_LOTS_IMPORT) return;
    const nom = texteCellule(ligne[colonneNom]);
    if (nom === "") return;
    const cle = normaliserImport(nom);
    const anomalies: AnomalieImportLot[] = [];

    const cellule = (role: ColonneImport) => {
      const colonne = colonnes[role];
      return colonne === undefined ? undefined : ligne[colonne];
    };

    const budget = budgetCellule(cellule("budget"));
    if (budget === null) anomalies.push("BUDGET_INVALIDE");
    let dateDebut = dateCellule(cellule("dateDebut"));
    let dateFin = dateCellule(cellule("dateFin"));
    if (dateDebut === null || dateFin === null) anomalies.push("DATE_INVALIDE");
    if (dateDebut && dateFin && !datesChantierCoherentes(dateDebut, dateFin)) {
      anomalies.push("DATES_INCOHERENTES");
      dateDebut = null;
      dateFin = null;
    }

    if (INTITULES_FAMILLES.has(sansPrefixeFamille(cle))) anomalies.push("INTITULE_FAMILLE");
    if (existants.has(cle)) anomalies.push("DEJA_PRESENT");
    else if (vus.has(cle)) anomalies.push("EN_DOUBLE");
    vus.add(cle);

    lignes.push({
      ligne: premiereLigne + rang,
      nom,
      modeExecution: modeExecutionDepuisTexte(texteCellule(cellule("modeExecution"))),
      typeBordereau: typeBordereauDepuisTexte(texteCellule(cellule("typeBordereau"))),
      budget: budget ?? null,
      dateDebut: dateDebut ?? null,
      dateFin: dateFin ?? null,
      anomalies,
    });
  });
  return lignes;
}

/**
 * Les anomalies qui décochent une ligne d'office : un intitulé de corps
 * d'état, un lot déjà là, un nom répété. L'utilisateur peut la recocher —
 * c'est un avis, pas un refus.
 */
const ANOMALIES_ECARTEES: readonly AnomalieImportLot[] = ["INTITULE_FAMILLE", "DEJA_PRESENT", "EN_DOUBLE"];

export function ligneRetenueParDefaut(ligne: LigneImportLot): boolean {
  return !ligne.anomalies.some((anomalie) => ANOMALIES_ECARTEES.includes(anomalie));
}

/** Les choix de l'écran qui complètent ce que le fichier ne dit pas. */
export interface DefautsImportLots {
  modeExecution: ModeExecutionLot | null;
  typeBordereau: TypeBordereau | null;
}

/** Ce qui manque encore aux lignes retenues pour être importées. */
export function defautsManquants(
  lignes: LigneImportLot[],
  defauts: DefautsImportLots,
): { modeExecution: boolean; typeBordereau: boolean } {
  return {
    modeExecution: !defauts.modeExecution && lignes.some((ligne) => !ligne.modeExecution),
    typeBordereau: !defauts.typeBordereau && lignes.some((ligne) => !ligne.typeBordereau),
  };
}

/**
 * Une ligne importée, complétée des choix par défaut de l'écran. `null`
 * tant qu'il lui manque un mode d'exécution ou un type de bordereau : ils
 * sont exigés d'un lot, importé ou non.
 */
export function creationDepuisLigneImport(
  ligne: LigneImportLot,
  defauts: DefautsImportLots,
): CreationLotProjet | null {
  const modeExecution = ligne.modeExecution ?? defauts.modeExecution;
  const typeBordereau = ligne.typeBordereau ?? defauts.typeBordereau;
  if (!modeExecution || !typeBordereau) return null;
  return {
    nom: ligne.nom,
    modeExecution,
    typeBordereau,
    budget: ligne.budget ?? undefined,
    dateDebut: ligne.dateDebut ?? undefined,
    dateFin: ligne.dateFin ?? undefined,
  };
}

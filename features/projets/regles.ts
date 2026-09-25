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

import type {
  ModeExecutionLot,
  Projet,
  StatutProjet,
  TypeBordereau,
  TypeProjet,
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

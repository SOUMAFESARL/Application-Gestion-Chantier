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
 * Un chantier qui vient d'être créé n'a encore ni avancement ni consommation.
 *
 * Cet état initial était recopié dans le tableau de bord, au retour de la
 * modale de création, sous forme d'un objet littéral de quinze lignes — donc
 * à retoucher à chaque champ ajouté au domaine.
 */
export const INDICE_SANTE_INITIAL = 100;

/**
 * Les tons du back-office, rassembles ici plutot que repetes dans trois
 * ecrans.
 *
 * C'est le meme role que `app/(app)/tableau-de-bord/classes.ts` : ce que la
 * feuille de style partageait autrefois se partage maintenant par un module
 * de constantes, explicitement. Trois ecrans dependent de ces valeurs pour
 * rester coherents entre eux.
 *
 * **Aucune valeur en dur** (regle 4 du plan de refonte) : chaque couleur passe
 * par un jeton semantique de la charte. Un statut n'a pas sa propre teinte, il
 * emprunte celle de sa gravite — ce qui fait qu'ajouter un statut demain ne
 * demande pas d'inventer une couleur.
 */

import type {
  AlerteClient,
  CleIndicateur,
  EtatCommercial,
  StatutAbonnement,
  StatutClient,
  TonVariation,
} from "@/features/administration";

export const BADGE =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap";

const NEUTRE = "border border-neutral-200 bg-neutral-100 text-neutral-800";
const BON = "border border-succes/30 bg-succes-fond text-succes";
const ATTENTION = "border border-avertissement/30 bg-avertissement-fond text-avertissement";
const GRAVE = "border border-erreur/30 bg-erreur-fond text-erreur";
const INFO = "border border-information/30 bg-information-fond text-information";

export const TON_STATUT_CLIENT: Record<StatutClient, string> = {
  EN_ATTENTE: NEUTRE,
  ACTIF: BON,
  SUSPENDU: GRAVE,
  RESILIE: NEUTRE,
};

export const TON_STATUT_ABONNEMENT: Record<StatutAbonnement, string> = {
  ESSAI: INFO,
  ACTIF: BON,
  IMPAYE: GRAVE,
  SUSPENDU: GRAVE,
  RESILIE: NEUTRE,
};

export const TON_ALERTE: Record<NonNullable<AlerteClient>, string> = {
  IMPAYE: GRAVE,
  SUSPENDU: GRAVE,
  ESSAI_BIENTOT_EXPIRE: ATTENTION,
  INSCRIPTION_SANS_SUITE: ATTENTION,
};

/**
 * La tuile d'indicateur du tableau de bord.
 *
 * Deux ecrans la posent (la vue d'ensemble et les abonnements) : elle reste
 * donc ici, et non dans l'un des deux. La classe ne porte que la structure —
 * le fond vient de `TUILE_TEINTE`, indexe par la cle de l'indicateur, pour
 * que le meme chiffre garde la meme couleur d'un ecran a l'autre.
 *
 * La tuile est **plate** : meme carte claire que partout ailleurs dans le
 * produit (bord `neutral-200`, ombre discrete). Les degrades sombres d'avant
 * faisaient une ligne de quatre paves noirs au milieu d'un ecran clair, et
 * obligeaient chaque teinte de texte a etre choisie deux fois.
 */
export const TUILE =
  "relative flex flex-col gap-1 overflow-hidden rounded-xl border border-neutral-200 p-4 shadow-sm transition-shadow hover:shadow-md";
export const TUILE_LIBELLE = "text-xs font-medium text-neutral-600";
export const TUILE_VALEUR = "text-h3 font-bold tabular-nums text-neutral-900";
export const TUILE_DETAIL = "text-xs text-neutral-500";

/**
 * Le fond de chaque tuile : un aplat clair, teinte par l'indicateur.
 *
 * La teinte n'est pas decorative, elle dit de quoi parle le chiffre : la
 * marque pour l'argent, le succes pour les clients actifs, l'information pour
 * les essais en cours, l'erreur pour ce qui n'est pas encaisse. Ce sont les
 * fonds pales de la charte — assez pour distinguer les quatre chiffres, pas
 * assez pour se disputer l'oeil ni pour forcer du texte clair.
 */
export const TUILE_TEINTE: Record<CleIndicateur, string> = {
  nbClients: "bg-secondary-50",
  clientsActifs: "bg-succes-fond",
  enEssai: "bg-information-fond",
  impayes: "bg-erreur-fond",
  revenuMensuel: "bg-primary-50",
};

/**
 * Le filet du bas, qui donne son ton a la tuile sans la colorer entierement.
 *
 * Il n'y a **pas d'icone** sur ces tuiles : quatre pictogrammes alignes se
 * regardent les uns les autres au lieu de laisser lire les chiffres, et aucun
 * d'eux n'apprend quoi que ce soit qu'un libelle ne dise deja.
 */
export const TUILE_FILET = "absolute inset-x-0 bottom-0 h-1";

/**
 * La teinte de chaque etat commercial dans le camembert du parc.
 *
 * Elle vit ici, et non dans le composant : la pastille de la legende et la
 * part du camembert doivent la partager, sinon les deux divergent au premier
 * changement. Ce sont les jetons de `globals.css`, donc la couleur de marque
 * du produit — pas une palette de graphique inventee a cote.
 */
export const TEINTE_ETAT_COMMERCIAL: Record<EtatCommercial, string> = {
  ABONNEMENT_ACTIF: "var(--color-graphique-1)",
  ESSAI: "var(--color-graphique-2)",
  SANS_ABONNEMENT: "var(--color-graphique-3)",
};

/**
 * Ce que vaut une variation, a l'oeil : la teinte de la mini-courbe et celle
 * de son pourcentage.
 *
 * Le ton vient d'une regle du domaine (`tonVariation`), pas de la tuile : une
 * hausse d'impayes est une mauvaise nouvelle, une hausse de clients une bonne,
 * et ce n'est pas une feuille de style qui doit en decider.
 *
 * Ce sont les **teintes pleines** de la charte : la tuile etant claire, ce
 * sont elles qui se lisent, la ou les teintes claires servaient au fond
 * sombre d'avant.
 */
export const TEINTE_VARIATION: Record<TonVariation, string> = {
  FAVORABLE: "var(--color-semantic-success)",
  DEFAVORABLE: "var(--color-semantic-error)",
  NEUTRE: "var(--color-neutral-400)",
};

export const TON_VARIATION: Record<TonVariation, string> = {
  FAVORABLE: "text-succes",
  DEFAVORABLE: "text-erreur",
  NEUTRE: "text-neutral-500",
};

/** Le filet du bas reprend le meme ton que la variation. */
export const TON_FILET_VARIATION: Record<TonVariation, string> = {
  FAVORABLE: "bg-succes",
  DEFAVORABLE: "bg-erreur",
  NEUTRE: "bg-neutral-300",
};

/**
 * La mecanique des graphiques : la grille, le curseur, le trait qui separe
 * deux parts d'un camembert.
 *
 * Ce sont des jetons de la charte, pas des couleurs de serie — d'ou leur
 * place a part. Les nommer ici evite en outre de les ecrire en clair dans un
 * attribut SVG, ou ils passeraient pour du texte affiche.
 */
export const TEINTE_GRILLE = "var(--color-neutral-200)";
export const TEINTE_CURSEUR = "var(--color-neutral-300)";
export const TEINTE_SEPARATION = "var(--color-neutral-0)";

/** Les blocs de la fiche client. */
export const CARTE = "rounded-lg border border-neutral-200 bg-neutral-0 p-5";
export const CARTE_TITRE = "mb-4 text-sm font-semibold text-neutral-900";
export const LIGNE_DEFINITION = "flex items-baseline justify-between gap-4 py-1.5 text-sm";
export const LIGNE_LIBELLE = "shrink-0 text-neutral-600";
export const LIGNE_VALEUR = "text-right font-medium text-neutral-900";

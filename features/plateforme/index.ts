/**
 * Le domaine Plateforme — ce que l'éditeur publie pour toutes les entreprises.
 *
 * L'adaptateur n'est **pas** réexporté : on l'importe par son chemin, pour
 * qu'un appel réseau reste visible à la lecture des imports d'un écran.
 */
export * from "./types";
export * from "./regles";
export { CLES_PLATEFORME } from "./cles";

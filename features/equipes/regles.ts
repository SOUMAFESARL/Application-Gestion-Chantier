/**
 * Les règles du domaine Équipes — pures, sans React.
 */

import type { LigneImport, Personne, StatutLigneImport } from "./types";

/** D'où vient une personne du registre : notre entreprise, ou un partenaire. */
export const ORIGINES_PERSONNE = ["INTERNE", "PARTENAIRE"] as const;
export type OriginePersonne = (typeof ORIGINES_PERSONNE)[number];

function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Le registre filtré par la recherche (nom, métier, entreprise, téléphone) et par l'origine. */
export function filtrerRegistre(
  personnes: Personne[],
  criteres: { recherche: string; origine: OriginePersonne | "" },
): Personne[] {
  const cherche = normaliser(criteres.recherche.trim());
  return personnes.filter((personne) => {
    if (criteres.origine === "INTERNE" && !personne.entreprise.interne) return false;
    if (criteres.origine === "PARTENAIRE" && personne.entreprise.interne) return false;
    if (!cherche) return true;
    return [personne.nomComplet, personne.metier, personne.entreprise.nom, personne.telephone].some((champ) =>
      normaliser(champ).includes(cherche),
    );
  });
}

/** Les personnes du registre qu'on peut encore ajouter à une équipe : actives, pas déjà présentes. */
export function personnesAjoutables(
  registre: Personne[],
  membres: { personne: { id: string }; enCours: boolean }[],
): Personne[] {
  const presents = new Set(membres.filter((m) => m.enCours).map((m) => m.personne.id));
  return registre.filter((personne) => personne.estActive && !presents.has(personne.id));
}

/** La date du jour au format ISO (AAAA-MM-JJ), heure locale : la date d'arrivée par défaut. */
export function aujourdhuiIso(maintenant: Date = new Date()): string {
  const decalage = maintenant.getTimezoneOffset() * 60_000;
  return new Date(maintenant.getTime() - decalage).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * Import du registre depuis Excel.
 * ------------------------------------------------------------------ */

/** Ce que l'import fera des lignes, compté par statut. */
export function compterLignesImport(lignes: LigneImport[]): Record<StatutLigneImport, number> {
  const comptes: Record<StatutLigneImport, number> = { VALIDE: 0, DOUBLON: 0, ERREUR: 0, CREEE: 0 };
  for (const ligne of lignes) comptes[ligne.statut] += 1;
  return comptes;
}

/** Les champs qu'une correction à l'écran touche — leur changement relance la vérification. */
export type ChampLigneImport = "nom" | "prenom" | "telephone" | "metier" | "entreprisePartenaireId";

/**
 * Corriger une cellule. Choisir une entreprise (ou « notre entreprise », `null`) efface le nom
 * non reconnu du fichier : le choix vient désormais des tiers.
 */
export function corrigerLigneImport(ligne: LigneImport, champ: ChampLigneImport, valeur: string | null): LigneImport {
  if (champ === "entreprisePartenaireId") {
    return { ...ligne, entreprisePartenaireId: valeur, entrepriseSaisie: "" };
  }
  return { ...ligne, [champ]: valeur ?? "" };
}

/** Après l'enregistrement, restent à l'écran les lignes non créées, à corriger ou abandonner. */
export function lignesRestantes(lignes: LigneImport[]): LigneImport[] {
  return lignes.filter((ligne) => ligne.statut !== "CREEE");
}

/** Le nom du fichier modèle téléchargé. */
export const NOM_MODELE_IMPORT = "modele-main-oeuvre.xlsx";

/** Les extensions acceptées à l'import, comme le serveur. */
export const EXTENSIONS_IMPORT = ".xlsx,.csv";

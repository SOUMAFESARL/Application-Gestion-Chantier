/**
 * Les règles du domaine Équipes — pures, sans React.
 */

import type { EntreeReferentiel } from "@/features/projets/referentiels";
import type { RoleTiers, Tiers } from "@/features/tiers/types";

import type { LigneImport, Personne, StatutLigneImport } from "./types";

/** Seuls les tiers pouvant fournir de la main-d'œuvre peuvent porter une équipe ou un salarié. */
const ROLES_PARTENAIRES_EQUIPE: ReadonlySet<RoleTiers> = new Set([
  "SOUS_TRAITANT",
  "TACHERON",
  "PRESTATAIRE",
]);

/** Filtre les tiers aux seuls partenaires éligibles (sous-traitant, tâcheron, prestataire). */
export function filtrerPartenairesEligibles<
  T extends Pick<Tiers, "roles"> & { estActif?: boolean },
>(tiers: T[]): T[] {
  return tiers.filter(
    (item) => (item.estActif ?? true) && item.roles.some((role) => ROLES_PARTENAIRES_EQUIPE.has(role)),
  );
}

/** D'où vient une personne du registre : notre entreprise, ou un partenaire. */
export const ORIGINES_PERSONNE = ["INTERNE", "PARTENAIRE"] as const;
export type OriginePersonne = (typeof ORIGINES_PERSONNE)[number];

function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Trie les personnes du registre pour une équipe : d'abord celles de l'entreprise de
 * l'équipe (partenaire donné, ou notre entreprise si `entrepriseId === null`), puis les autres.
 */
export function trierPersonnesPourEquipe(
  personnes: Personne[],
  entrepriseId: string | null,
): Personne[] {
  const estDeLEntreprise = (p: Personne) =>
    entrepriseId === null ? p.entreprise.interne : p.entreprise.id === entrepriseId;
  return [...personnes].sort((a, b) => {
    const prioA = estDeLEntreprise(a) ? 0 : 1;
    const prioB = estDeLEntreprise(b) ? 0 : 1;
    return prioA - prioB;
  });
}

/**
 * Retrouve le code de fonction du référentiel correspondant au métier d'une personne
 * (comparaison insensible à la casse et aux accents).
 */
export function resoudreCodeFonctionDepuisMetier(
  metier: string,
  entrees: Pick<EntreeReferentiel, "code" | "libelle">[],
): string | null {
  const cle = normaliser(metier.trim());
  if (!cle) return null;
  const trouvee = entrees.find(
    (e) => normaliser(e.libelle) === cle || normaliser(e.code) === cle,
  );
  return trouvee ? trouvee.code : null;
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

/**
 * Les règles du domaine Équipes — pures, sans React.
 */

import type { Personne } from "./types";

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

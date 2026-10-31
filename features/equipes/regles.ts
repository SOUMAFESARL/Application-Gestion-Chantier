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

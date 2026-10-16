/**
 * Les référentiels dynamiques du domaine Projets : types de projet et noms de
 * lot. Chaque liste réunit deux origines — la **plateforme** (posée par le
 * super admin, commune à toutes les entreprises, non supprimable ici) et
 * l'**entreprise** (ajoutée par qui en a la permission, supprimable par elle).
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { api } from "@/lib/api";

export const REFERENTIEL_TYPES_PROJET = "types-projet";
export const REFERENTIEL_LOTS = "lots";

export type CategorieReferentiel = typeof REFERENTIEL_TYPES_PROJET | typeof REFERENTIEL_LOTS;

export type OrigineReferentiel = "PLATEFORME" | "ENTREPRISE";

export interface EntreeReferentiel {
  /** Ce que le projet enregistre pour un type ; sans usage pour un lot, qui garde le libellé. */
  code: string;
  libelle: string;
  /** Le titre de groupe dans la liste — le corps d'état d'un lot. Vide : aucun. */
  groupe: string;
  origine: OrigineReferentiel;
}

export const cleReferentiel = (categorie: CategorieReferentiel) =>
  ["referentiels", categorie] as const;

/** `GET /referentiels/{categorie}/` — plateforme et entreprise réunies, triées. */
export async function listerReferentiel(
  categorie: CategorieReferentiel,
  signal?: AbortSignal,
): Promise<EntreeReferentiel[]> {
  const charges = await api.lire<EntreeReferentiel[]>(
    `/referentiels/${categorie}/`,
    undefined,
    signal,
  );
  return Array.isArray(charges) ? charges : [];
}

/** `POST /referentiels/{categorie}/` — le serveur dérive le code du libellé. */
export async function ajouterAuReferentiel(
  categorie: CategorieReferentiel,
  libelle: string,
): Promise<EntreeReferentiel> {
  return api.creer<EntreeReferentiel>(`/referentiels/${categorie}/`, { libelle: libelle.trim() });
}

/** `DELETE /referentiels/{categorie}/{code}/` — une entrée de l'entreprise seulement. */
export async function retirerDuReferentiel(
  categorie: CategorieReferentiel,
  code: string,
): Promise<void> {
  await api.supprimer(`/referentiels/${categorie}/${encodeURIComponent(code)}/`);
}

/**
 * Une liste et sa résolution de libellé. Un code inconnu (entrée supprimée,
 * ancienne saisie libre) s'affiche tel quel plutôt que de disparaître.
 */
export function useReferentiel(categorie: CategorieReferentiel) {
  const requete = useQuery({
    queryKey: cleReferentiel(categorie),
    queryFn: ({ signal }) => listerReferentiel(categorie, signal),
    staleTime: 5 * 60 * 1000,
  });
  const entrees = useMemo(() => requete.data ?? [], [requete.data]);
  const libelle = useCallback(
    (code: string | null | undefined) =>
      code ? (entrees.find((e) => e.code === code)?.libelle ?? code) : "",
    [entrees],
  );
  return { requete, entrees, libelle };
}

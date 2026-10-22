/**
 * Les référentiels dynamiques du domaine Projets : types de projet, noms de
 * lot et modes d'exécution. Chaque liste réunit deux origines — la
 * **plateforme** (posée par le super admin, commune à toutes les entreprises,
 * non supprimable ici) et l'**entreprise** (ajoutée par qui en a la
 * permission, retirée par le DG ou l'administrateur).
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { api } from "@/lib/api";

export const REFERENTIEL_TYPES_PROJET = "types-projet";
export const REFERENTIEL_LOTS = "lots";
export const REFERENTIEL_MODES_EXECUTION = "modes-execution";

export type CategorieReferentiel =
  | typeof REFERENTIEL_TYPES_PROJET
  | typeof REFERENTIEL_LOTS
  | typeof REFERENTIEL_MODES_EXECUTION;

/**
 * Les listes où l'on ajoute sur place, depuis un champ de formulaire : un mode
 * d'exécution demande un groupe obligatoire, il ne s'ajoute que depuis la page des listes.
 */
export type CategorieReferentielLibre = Exclude<
  CategorieReferentiel,
  typeof REFERENTIEL_MODES_EXECUTION
>;

export type OrigineReferentiel = "PLATEFORME" | "ENTREPRISE";

export interface EntreeReferentiel {
  /** Ce que le projet enregistre pour un type ; sans usage pour un lot, qui garde le libellé. */
  code: string;
  libelle: string;
  /**
   * Le titre de groupe dans la liste — le corps d'état d'un lot. Vide : aucun.
   * Pour un mode d'exécution, le code du mode de base auquel il se rattache.
   */
  groupe: string;
  origine: OrigineReferentiel;
}

/** Ce que l'utilisateur courant peut faire sur les listes. */
export interface DroitsReferentiels {
  peutAjouter: boolean;
  peutRetirer: boolean;
}

interface ChargeDroitsReferentiels {
  peut_ajouter: boolean;
  peut_retirer: boolean;
}

export const cleReferentiel = (categorie: CategorieReferentiel) =>
  ["referentiels", categorie] as const;

export const CLE_DROITS_REFERENTIELS = ["referentiels", "droits"] as const;

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

/**
 * `POST /referentiels/{categorie}/` — le serveur dérive le code du libellé.
 * `groupe` est facultatif, sauf pour un mode d'exécution (l'un des trois modes de base).
 */
export async function ajouterAuReferentiel(
  categorie: CategorieReferentiel,
  libelle: string,
  groupe = "",
): Promise<EntreeReferentiel> {
  const corps: { libelle: string; groupe?: string } = { libelle: libelle.trim() };
  if (groupe.trim()) corps.groupe = groupe.trim();
  return api.creer<EntreeReferentiel>(`/referentiels/${categorie}/`, corps);
}

/** `DELETE /referentiels/{categorie}/{code}/` — une entrée de l'entreprise seulement. */
export async function retirerDuReferentiel(
  categorie: CategorieReferentiel,
  code: string,
): Promise<void> {
  await api.supprimer(`/referentiels/${categorie}/${encodeURIComponent(code)}/`);
}

/** `GET /referentiels/droits/` — les boutons d'ajout et de retrait à montrer. */
export async function lireDroitsReferentiels(signal?: AbortSignal): Promise<DroitsReferentiels> {
  const charge = await api.lire<ChargeDroitsReferentiels>(
    "/referentiels/droits/",
    undefined,
    signal,
  );
  return { peutAjouter: Boolean(charge?.peut_ajouter), peutRetirer: Boolean(charge?.peut_retirer) };
}

/** Les droits sur les listes ; tant qu'ils ne sont pas lus, rien ne s'ajoute ni ne se retire. */
export function useDroitsReferentiels() {
  const requete = useQuery({
    queryKey: CLE_DROITS_REFERENTIELS,
    queryFn: ({ signal }) => lireDroitsReferentiels(signal),
    staleTime: 5 * 60 * 1000,
  });
  const droits: DroitsReferentiels = requete.data ?? { peutAjouter: false, peutRetirer: false };
  return { requete, droits };
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

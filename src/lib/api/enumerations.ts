"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { Enumerations } from "./types";

/**
 * Libellés des énumérations — conventions d'API §6.1.
 *
 * L'API renvoie partout des codes (`"EN_COURS"`), jamais des libellés.
 * Cette table est chargée une fois et conservée très longtemps : elle ne
 * change qu'au déploiement d'une nouvelle version du backend.
 */
export function useEnumerations() {
  return useQuery({
    queryKey: ["enumerations"],
    queryFn: () => api.lire<Enumerations>("/referentiels/enumerations/"),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * Libellé d'un code, avec repli sur le code lui-même.
 *
 * Le repli est volontaire : si le backend ajoute une valeur que le client
 * ne connaît pas encore, l'écran affiche `NOUVEAU_STATUT` — moche, mais
 * lisible et diagnosticable. Il n'affiche jamais une case vide.
 */
export function libelle(
  enumerations: Enumerations | undefined,
  nomEnumeration: string,
  code: string | null | undefined,
): string {
  if (!code) return "—";
  const option = enumerations?.[nomEnumeration]?.find((o) => o.code === code);
  return option?.libelle ?? code;
}

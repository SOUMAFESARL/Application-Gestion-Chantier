"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import type { CodePlan } from "@/features/abonnement/types";

import { lireIdentite, lireTarifs } from "./adaptateur";
import { CLES_PLATEFORME } from "./cles";
import { tarifDuPlan } from "./regles";

/**
 * Le nom et le logo de la plateforme, pour les deux coquilles.
 *
 * `staleTime` long : ils changent quelques fois par an, et chaque navigation
 * ne doit pas les redemander. Le back-office invalide la clé quand il les
 * modifie — c'est ce qui rend l'effet immédiat dans l'onglet qui les écrit.
 */
export function useIdentitePlateforme() {
  return useQuery({
    queryKey: CLES_PLATEFORME.identite(),
    queryFn: ({ signal }) => lireIdentite(signal),
    staleTime: 10 * 60 * 1000,
  });
}

/** Les prix publiés, pour la page de tarifs et l'écran qui les paramètre. */
export function useTarifsPlateforme() {
  return useQuery({
    queryKey: CLES_PLATEFORME.tarifs(),
    queryFn: ({ signal }) => lireTarifs(signal),
  });
}

/**
 * Le nom commercial d'un plan, tel que la plateforme l'a paramétré.
 *
 * Partout où un plan se nomme — page de tarifs, historique des paiements,
 * listes du back-office —, pour qu'un renommage se lise dans tout le produit
 * et pas seulement sur la page de vente. Tant que les tarifs ne sont pas
 * arrivés (ou s'ils n'ont pas pu l'être), c'est le nom du catalogue qui
 * s'affiche : celui que le plan portait avant d'être renommé, pas un nom
 * inventé.
 */
export function useLibellePlan(): (code: CodePlan) => string {
  const t = useTranslations("abonnement.plan");
  const { data } = useTarifsPlateforme();
  return useCallback(
    (code: CodePlan) => (data && tarifDuPlan(data, code)?.libelle) || t(`${code}.libelle`),
    [data, t],
  );
}

"use client";

import { createContext, useContext } from "react";

import type { ProfilAdministrateur } from "@/features/administration";

/**
 * Qui est connecte au back-office, mis a disposition des ecrans.
 *
 * La coquille charge le profil une fois ; sans ce contexte, chacun des trois
 * ecrans referait l'appel a son montage — trois requetes pour une donnee qui
 * ne change pas d'un ecran a l'autre.
 *
 * `null` veut dire « pas encore charge », et non « pas d'administrateur » :
 * la coquille ne rend ses enfants qu'une fois la session verifiee, mais le
 * profil peut arriver apres. Les ecrans doivent donc traiter le `null`
 * autrement que comme une absence de droits — `peutAgirSurClients(null)`
 * repond `false`, ce qui est le bon sens de lecture le temps du chargement.
 */
const ContexteAdministrateur = createContext<ProfilAdministrateur | null>(null);

export const FournisseurAdministrateur = ContexteAdministrateur.Provider;

export function useAdministrateur(): ProfilAdministrateur | null {
  return useContext(ContexteAdministrateur);
}

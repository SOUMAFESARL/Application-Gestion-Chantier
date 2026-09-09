"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import { ErreurApi } from "@/lib/api";
import { SurveillantSession } from "@/lib/auth/SurveillantSession";

/**
 * Fournisseur d'état serveur.
 *
 * Deux réglages méritent une explication :
 *
 * `retry` — on ne réessaie **jamais** une erreur 4xx. Rejouer une requête
 * refusée pour droits insuffisants ou pour règle métier ne changera rien,
 * et sur un réseau de chantier chaque tentative inutile coûte des secondes.
 * Seules les pannes réseau et les erreurs serveur sont réessayées.
 *
 * `staleTime` — 30 secondes. Les données de chantier ne changent pas à la
 * seconde, et sur une connexion lente, refaire une requête à chaque retour
 * sur un écran est perceptible.
 */
function creerClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (nombreEchecs, erreur) => {
          if (erreur instanceof ErreurApi) {
            if (!erreur.estTemporaire) return false;
          }
          return nombreEchecs < 2;
        },
      },
      mutations: {
        // Une écriture n'est jamais rejouée automatiquement : le doublon
        // coûte plus cher que l'échec. L'utilisateur relance lui-même.
        retry: false,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // `useState` et non une constante de module : en rendu serveur, un client
  // partagé mêlerait les caches de deux utilisateurs différents.
  const [client] = useState(creerClient);

  return (
    <QueryClientProvider client={client}>
      <SurveillantSession />
      {children}
    </QueryClientProvider>
  );
}

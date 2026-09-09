"use client";

import { useEffect } from "react";
import { appliquerCouleurPrimaire } from "./theme";

interface FournisseurThemeProps {
  couleurPrimaire?: string | null;
  children: React.ReactNode;
}

/**
 * Fournisseur de thème dynamique (White-Label).
 *
 * Applique l'échelle complète de nuances CSS 50→900 selon la couleur primaire
 * de l'entreprise cliente, tout en préservant le rendu côté client.
 */
export function FournisseurTheme({ couleurPrimaire, children }: FournisseurThemeProps) {
  useEffect(() => {
    appliquerCouleurPrimaire(couleurPrimaire);
  }, [couleurPrimaire]);

  return <>{children}</>;
}

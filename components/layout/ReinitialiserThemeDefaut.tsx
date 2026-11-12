"use client";

import { useEffect } from "react";

import { appliquerCouleurPrimaire } from "@/styles/couleurs";

/**
 * Réinitialise le thème CSS au défaut de la plateforme.
 * Utilisé par les layouts hors-entreprise (auth, public, admin) pour garantir
 * qu'aucune fuite de variables CSS d'une entreprise précédente ne subsiste.
 */
export function ReinitialiserThemeDefaut() {
  useEffect(() => {
    appliquerCouleurPrimaire(null);
  }, []);

  return null;
}

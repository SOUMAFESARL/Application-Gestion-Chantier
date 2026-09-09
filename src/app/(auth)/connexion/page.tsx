import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Suspense } from "react";

import {
  AccrocheAuth,
  CarteAuth,
  TitreAuth,
} from "@/components/layout/CarteAuth";

import { FormulaireConnexion } from "./FormulaireConnexion";

import styles from "./page.module.css";

/**
 * Écran « Connexion » — maquette 04_Conception/maquettes/M1_Connexion.html
 *
 * Motif d'interface : authentification.
 *
 * Sept états, tous atteignables : saisie, chargement, succès, identifiants
 * invalides (avec le compteur de tentatives), compte temporairement bloqué,
 * compte désactivé, erreur réseau et session expirée.
 *
 * Le formulaire est un composant client séparé : il lit `?session=expiree`
 * avec `useSearchParams`, ce qui empêcherait le rendu statique de la page
 * entière s'il n'était pas isolé derrière une frontière Suspense.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("connexion");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  const t = useTranslations("connexion");

  return (
    <CarteAuth>
      <TitreAuth>{t("titre")}</TitreAuth>
      <AccrocheAuth>{t("accroche")}</AccrocheAuth>

      <Suspense fallback={<div className={styles.attente} aria-hidden="true" />}>
        <FormulaireConnexion />
      </Suspense>
    </CarteAuth>
  );
}

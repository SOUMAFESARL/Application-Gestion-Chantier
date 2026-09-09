"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { House, MapTrifold } from "@phosphor-icons/react";
import { Bouton } from "@/components/ui";

import styles from "./not-found.module.css";

/**
 * Page d'erreur 404 — Conforme à la maquette 04_Conception/maquettes/M11_Erreurs_CCD_Digital.html (Écran 1).
 */
export default function NotFound() {
  const t = useTranslations("erreurs");

  return (
    <div className={styles.conteneur}>
      <div className={styles.carte}>
        <div className={styles.iconeWrap} aria-hidden="true">
          <MapTrifold size={40} weight="regular" />
        </div>
        <div className={styles.codeErreur}>{t("code404")}</div>
        <h1 className={styles.titre}>{t("titre404")}</h1>
        <p className={styles.description}>{t("description404")}</p>
        <div className={styles.actions}>
          <Link href="/tableau-de-bord" style={{ textDecoration: "none" }}>
            <Bouton variante="primaire">
              <House size={18} weight="bold" />
              <span>{t("retourTableauDeBord")}</span>
            </Bouton>
          </Link>
        </div>
      </div>
    </div>
  );
}

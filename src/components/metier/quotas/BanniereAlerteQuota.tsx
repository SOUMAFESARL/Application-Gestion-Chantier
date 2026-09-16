"use client";

import {
  ArrowRight,
  Sparkle,
  Warning,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EVENEMENT_QUOTAS_MODIFIE, obtenirQuotasActuels } from "@/features/quotas/api";
import { MetriqueQuota, ResumeQuotas } from "@/features/quotas/types";

import styles from "./BanniereAlerteQuota.module.css";

interface BanniereAlerteQuotaProps {
  /**
   * Filtrer sur une ressource particulière (ex: "CHANTIERS" sur la page /projets)
   */
  ressourceCible?: "CHANTIERS" | "COLLABORATEURS" | "STOCKAGE" | "IA";
  /**
   * Forcer l'affichage sans masquer par dismissal
   */
  persistant?: boolean;
}

export default function BanniereAlerteQuota({
  ressourceCible,
  persistant = false,
}: BanniereAlerteQuotaProps) {
  const [quotas, setQuotas] = useState<ResumeQuotas | null>(null);
  const [estMasquee, setEstMasquee] = useState(false);

  const recharger = useCallback(() => {
    obtenirQuotasActuels().then(setQuotas).catch(() => {});
  }, []);

  useEffect(() => {
    recharger();
    window.addEventListener(EVENEMENT_QUOTAS_MODIFIE, recharger);
    window.addEventListener("storage", recharger);
    return () => {
      window.removeEventListener(EVENEMENT_QUOTAS_MODIFIE, recharger);
      window.removeEventListener("storage", recharger);
    };
  }, [recharger]);

  if (estMasquee && !persistant) return null;
  if (!quotas) return null;

  // Détermination de la métrique concernée
  let metriqueAffichee: MetriqueQuota | null = null;

  if (ressourceCible) {
    const cle =
      ressourceCible === "CHANTIERS"
        ? "chantiers"
        : ressourceCible === "COLLABORATEURS"
        ? "collaborateurs"
        : ressourceCible === "STOCKAGE"
        ? "stockage"
        : "ia";
    const m = quotas.ressources[cle];
    if (m.statut === "BLOQUANT" || m.statut === "AVERTISSEMENT") {
      metriqueAffichee = m;
    }
  } else {
    // Ordre de priorité : Bloquant d'abord, puis Avertissement
    const r = quotas.ressources;
    if (r.chantiers.statut === "BLOQUANT") metriqueAffichee = r.chantiers;
    else if (r.collaborateurs.statut === "BLOQUANT") metriqueAffichee = r.collaborateurs;
    else if (r.stockage.statut === "BLOQUANT") metriqueAffichee = r.stockage;
    else if (r.ia.statut === "BLOQUANT" && quotas.forfaitCode === "BATISSEUR") metriqueAffichee = r.ia;
    else if (r.chantiers.statut === "AVERTISSEMENT") metriqueAffichee = r.chantiers;
    else if (r.collaborateurs.statut === "AVERTISSEMENT") metriqueAffichee = r.collaborateurs;
    else if (r.stockage.statut === "AVERTISSEMENT") metriqueAffichee = r.stockage;
  }

  // Pas d'alerte à afficher
  if (!metriqueAffichee) return null;

  const estBloquant = metriqueAffichee.statut === "BLOQUANT";
  const recommandation = quotas.recommandationSurclassement;
  const planCible = recommandation?.forfaitCibleCode || "MAITRE_OEUVRE";
  const lienSurclassement = `/abonnement?plan=${planCible}`;

  return (
    <div
      className={`${styles.banniere} ${
        estBloquant ? styles.bloquant : styles.avertissement
      }`}
      role="alert"
    >
      <div className={styles.gauche}>
        <div
          className={`${styles.iconeCadre} ${
            estBloquant ? styles.iconeCadreBloquant : styles.iconeCadreAvertissement
          }`}
        >
          {estBloquant ? <Warning size={24} weight="fill" /> : <Sparkle size={24} weight="fill" />}
        </div>
        <div className={styles.texteConteneur}>
          <div className={styles.titre}>
            <span>
              {estBloquant
                ? `Quota de ${metriqueAffichee.libelle.toLowerCase()} atteint`
                : `Quota de ${metriqueAffichee.libelle.toLowerCase()} presque atteint`}
            </span>
            <span
              className={`${styles.badgePourcent} ${
                estBloquant ? styles.badgeBloquant : styles.badgeAvertissement
              }`}
            >
              {metriqueAffichee.limite !== null
                ? `${metriqueAffichee.actuel} / ${metriqueAffichee.limite} (${metriqueAffichee.pourcentage}%)`
                : "Non inclus"}
            </span>
          </div>
          <p className={styles.description}>
            {estBloquant ? (
              metriqueAffichee.messageAlerte ||
              "Vous avez atteint la limite de votre forfait actuel. Débloquez immédiatement vos opérations en passant à la formule supérieure."
            ) : (
              <span>
                Vous avez utilisé <strong>{metriqueAffichee.pourcentage}%</strong> de votre capacité.
                {recommandation
                  ? ` Passez à la formule ${recommandation.forfaitCibleLibelle} pour débloquer plus de chantiers et d'espace.`
                  : " Anticipez vos besoins en surclassant votre formule."}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className={styles.droite}>
        <Link href="/alertes-quotas" className={styles.btnQuotasLien}>
          Voir mes quotas
        </Link>

        <Link href={lienSurclassement} className={styles.btnSurclasser}>
          <span>
            {recommandation
              ? `Passer à ${recommandation.forfaitCibleLibelle}`
              : "Passer à la formule supérieure"}
          </span>
          <ArrowRight size={16} weight="bold" />
        </Link>

        {!persistant && (
          <button
            type="button"
            className={styles.btnFermer}
            onClick={() => setEstMasquee(true)}
            aria-label="Fermer temporairement l'alerte"
            title="Masquer"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

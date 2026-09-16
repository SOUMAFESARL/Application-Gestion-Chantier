"use client";

import {
  ArrowRight,
  Buildings,
  CheckCircle,
  HardDrive,
  Sparkle,
  Users,
  WarningOctagon,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect } from "react";

import { InfoSurclassement, MetriqueQuota } from "@/features/quotas/types";

import styles from "./ModaleQuotaAtteint.module.css";

interface ModaleQuotaAtteintProps {
  ouvert: boolean;
  surFermer: () => void;
  ressourceBloquante?: MetriqueQuota;
  recommandation?: InfoSurclassement | null;
}

export default function ModaleQuotaAtteint({
  ouvert,
  surFermer,
  ressourceBloquante,
  recommandation,
}: ModaleQuotaAtteintProps) {
  // Verrouillage du scroll quand la modale est active
  useEffect(() => {
    if (ouvert) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [ouvert]);

  if (!ouvert) return null;

  const formuleCibleCode = recommandation?.forfaitCibleCode || "MAITRE_OEUVRE";
  const formuleCibleNom = recommandation?.forfaitCibleLibelle || "Maître d'Œuvre";
  const formuleCiblePrix = recommandation
    ? `${recommandation.prixCibleMensuelFcfa.toLocaleString("fr-FR")} FCFA/mois`
    : "79 000 FCFA/mois";

  const getIconeRessource = (type?: string) => {
    switch (type) {
      case "CHANTIERS":
        return <Buildings size={20} weight="fill" />;
      case "COLLABORATEURS":
        return <Users size={20} weight="fill" />;
      case "STOCKAGE":
        return <HardDrive size={20} weight="fill" />;
      case "IA":
        return <Sparkle size={20} weight="fill" />;
      default:
        return <Buildings size={20} weight="fill" />;
    }
  };

  const benefices = recommandation?.beneficesDebloques || [
    {
      ressource: "Chantiers actifs",
      avant: "5 chantiers",
      apres: "50 chantiers",
      gainCle: "x10 chantiers supplémentaires",
    },
    {
      ressource: "Collaborateurs inclus",
      avant: "5 collaborateurs",
      apres: "25 collaborateurs",
      gainCle: "+20 accès",
    },
    {
      ressource: "Stockage photos & plans",
      avant: "5 Go",
      apres: "20 Go",
      gainCle: "Stockage quadruplé",
    },
    {
      ressource: "Assistant IA Chantier",
      avant: "Non inclus",
      apres: "Inclus",
      gainCle: "Comptes-rendus automatisés",
    },
  ];

  return (
    <div className={styles.overlay} onClick={surFermer} role="dialog" aria-modal="true">
      <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
        {/* En-tête héroïque percutant */}
        <div className={styles.enTeteHero}>
          <button
            type="button"
            className={styles.fermerBouton}
            onClick={surFermer}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>

          <div className={styles.badgeHeader}>
            <WarningOctagon size={14} weight="fill" />
            <span>Plafond de Formule Atteint</span>
          </div>

          <h2 className={styles.titreHero}>
            {ressourceBloquante
              ? `Votre quota de ${ressourceBloquante.libelle.toLowerCase()} est atteint`
              : "Passez à la formule supérieure pour continuer"}
          </h2>

          <p className={styles.sousTitreHero}>
            Votre activité grandit ! Pour créer de nouveaux chantiers, ajouter des collaborateurs et
            débloquer les outils d&apos;automatisation, activez le forfait {formuleCibleNom}.
          </p>
        </div>

        <div className={styles.corpsModale}>
          {/* Badge de la ressource saturée */}
          {ressourceBloquante && (
            <div className={styles.carteSaturation}>
              <div className={styles.carteSaturationInfo}>
                <div className={styles.saturationIcone}>
                  {getIconeRessource(ressourceBloquante.type)}
                </div>
                <div>
                  <div className={styles.saturationLabel}>{ressourceBloquante.libelle}</div>
                  <div className={styles.saturationValeur}>
                    {ressourceBloquante.limite !== null
                      ? `${ressourceBloquante.actuel} sur ${ressourceBloquante.limite} ${ressourceBloquante.unite}`
                      : "Non disponible sur votre formule actuelle"}
                  </div>
                </div>
              </div>
              <span className={styles.badgePlafond}>100% UTILISÉ</span>
            </div>
          )}

          {/* Comparatif des gains immédiats */}
          <div className={styles.sectionComparatif}>
            <div className={styles.titreComparatif}>
              Débloqué avec le forfait {formuleCibleNom} :
            </div>

            <div className={styles.grilleBenefices}>
              {benefices.map((b, idx) => (
                <div key={idx} className={styles.ligneBenefice}>
                  <div className={styles.beneficeNom}>
                    <CheckCircle size={18} weight="fill" style={{ color: "#10B981" }} />
                    <span>{b.ressource}</span>
                  </div>
                  <div className={styles.beneficeComparaison}>
                    <span className={styles.valeurAvant}>{b.avant}</span>
                    <span className={styles.valeurApres}>➜ {b.apres}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pied de dialogue avec incitation CTA claire */}
        <div className={styles.piedModale}>
          <Link
            href={`/abonnement?plan=${formuleCibleCode}`}
            className={styles.btnSurclasserModal}
            onClick={surFermer}
          >
            <Sparkle size={20} weight="fill" />
            <span>Passer à {formuleCibleNom} — {formuleCiblePrix}</span>
            <ArrowRight size={18} weight="bold" />
          </Link>

          <div className={styles.actionsSecondaires}>
            <Link href="/abonnement" className={styles.lienTarifs} onClick={surFermer}>
              Voir toutes les formules BTP
            </Link>

            <button type="button" className={styles.btnFermerModal} onClick={surFermer}>
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

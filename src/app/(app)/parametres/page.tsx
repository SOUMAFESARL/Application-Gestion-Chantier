"use client";

import {
  ArrowRight,
  Buildings,
  CreditCard,
  HardDrive,
  IdentificationBadge,
  Palette,
  ShieldCheck,
  Sparkle,
  Users,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

import { Abonnement, lireAbonnement } from "@/features/abonnement/api";
import { obtenirQuotasActuels, EVENEMENT_QUOTAS_MODIFIE } from "@/features/quotas/api";
import { ResumeQuotas } from "@/features/quotas/types";
import BanniereAlerteQuota from "@/components/metier/quotas/BanniereAlerteQuota";

import styles from "./page.module.css";

export default function PageParametres() {
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [quotas, setQuotas] = useState<ResumeQuotas | null>(null);

  const recharger = useCallback(() => {
    lireAbonnement().then(setAbonnement).catch(() => {});
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

  const chantiers = quotas?.ressources.chantiers;
  const collaborateurs = quotas?.ressources.collaborateurs;
  const stockage = quotas?.ressources.stockage;

  return (
    <main className={styles.page}>
      <header className={styles.entete}>
        <h1 className={styles.titre}>Paramètres & Administration</h1>
        <p className={styles.sousTitre}>
          Gérez votre formule d&apos;abonnement, vos collaborateurs, les droits d&apos;accès et les données de votre entreprise.
        </p>
      </header>

      {/* Alerte contextuelle si quota critique */}
      <BanniereAlerteQuota />

      <div className={styles.grilleSections}>
        {/* SECTION 1 : ABONNEMENT & FACTURATION (Mise en avant) */}
        <section className={styles.carteAbonnementHero}>
          <div className={styles.enteteAbonnement}>
            <div className={styles.titreBloc}>
              <div className={styles.iconeAbonnement}>
                <CreditCard size={24} weight="fill" />
              </div>
              <div>
                <h2 className={styles.nomSection}>Abonnement & Facturation CinetPay</h2>
                <p style={{ fontSize: "0.875rem", color: "var(--color-neutral-600)" }}>
                  Gérez votre formule, vos quotas et le renouvellement par Mobile Money ou Carte Bancaire.
                </p>
              </div>
            </div>
            <div>
              <span className={styles.planActuelBadge}>
                <Sparkle size={14} weight="fill" />
                <span>{quotas?.forfaitLibelle || abonnement?.plan?.libelle || "Forfait BTP"}</span>
              </span>
            </div>
          </div>

          {/* Consommation des quotas */}
          <div className={styles.grilleQuotas}>
            <div className={styles.itemQuota}>
              <div className={styles.quotaEntete}>
                <span>Chantiers & Projets</span>
                <Buildings size={16} weight="duotone" />
              </div>
              <div className={styles.quotaValeur}>
                {chantiers ? `${chantiers.actuel} / ${chantiers.limite !== null ? chantiers.limite : "∞"}` : "3 / 50"}
              </div>
              <div className={styles.barreFond}>
                <div
                  className={styles.barreProgression}
                  style={{
                    width: `${chantiers ? chantiers.pourcentage : 6}%`,
                    backgroundColor:
                      chantiers?.statut === "BLOQUANT"
                        ? "#EF4444"
                        : chantiers?.statut === "AVERTISSEMENT"
                        ? "#F59E0B"
                        : undefined,
                  }}
                />
              </div>
            </div>

            <div className={styles.itemQuota}>
              <div className={styles.quotaEntete}>
                <span>Collaborateurs</span>
                <Users size={16} weight="duotone" />
              </div>
              <div className={styles.quotaValeur}>
                {collaborateurs ? `${collaborateurs.actuel} / ${collaborateurs.limite !== null ? collaborateurs.limite : "∞"}` : "5 / 25"}
              </div>
              <div className={styles.barreFond}>
                <div
                  className={styles.barreProgression}
                  style={{
                    width: `${collaborateurs ? collaborateurs.pourcentage : 20}%`,
                    backgroundColor:
                      collaborateurs?.statut === "BLOQUANT"
                        ? "#EF4444"
                        : collaborateurs?.statut === "AVERTISSEMENT"
                        ? "#F59E0B"
                        : undefined,
                  }}
                />
              </div>
            </div>

            <div className={styles.itemQuota}>
              <div className={styles.quotaEntete}>
                <span>Stockage Cloud</span>
                <HardDrive size={16} weight="duotone" />
              </div>
              <div className={styles.quotaValeur}>
                {stockage ? `${stockage.actuel} Go / ${stockage.limite !== null ? `${stockage.limite} Go` : "∞"}` : "1.2 Go / 20 Go"}
              </div>
              <div className={styles.barreFond}>
                <div
                  className={styles.barreProgression}
                  style={{
                    width: `${stockage ? stockage.pourcentage : 6}%`,
                    backgroundColor:
                      stockage?.statut === "BLOQUANT"
                        ? "#EF4444"
                        : stockage?.statut === "AVERTISSEMENT"
                        ? "#F59E0B"
                        : undefined,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Boutons d'action pour l'abonnement */}
          <div className={styles.actionsAbonnement}>
            <Link href="/abonnement" className={styles.btnChangerFormule}>
              <span>Changer de formule / Renouveler l&apos;abonnement</span>
              <ArrowRight size={16} weight="bold" />
            </Link>
            <Link
              href="/alertes-quotas"
              style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-primary-600, #D4652A)" }}
            >
              Superviser les quotas & simulateur ➜
            </Link>
          </div>
        </section>

        {/* SECTION 2 : AUTRES PARAMÈTRES */}
        <div className={styles.grilleCartesStandard}>
          <div className={styles.carteStandard}>
            <div>
              <h3 className={styles.carteStandardTitre}>
                <Users size={22} weight="duotone" style={{ color: "var(--color-primary-600)" }} />
                <span>Collaborateurs & Équipes</span>
              </h3>
              <p className={styles.carteStandardDesc}>
                Invitez de nouveaux membres sur le terrain ou au bureau, et définissez leurs affectations par chantier.
              </p>
            </div>
            <Link href="/parametres/utilisateurs" className={styles.lienAction}>
              <span>Gérer les collaborateurs</span>
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>

          <div className={styles.carteStandard}>
            <div>
              <h3 className={styles.carteStandardTitre}>
                <IdentificationBadge size={22} weight="duotone" style={{ color: "var(--color-primary-600)" }} />
                <span>Rôles & Permissions</span>
              </h3>
              <p className={styles.carteStandardDesc}>
                Configurez les profils d&apos;accès : Conducteurs de travaux, Chefs de chantier, Comptables, Observateurs.
              </p>
            </div>
            <Link href="/parametres/roles" className={styles.lienAction}>
              <span>Configurer les rôles</span>
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>

          <div className={styles.carteStandard}>
            <div>
              <h3 className={styles.carteStandardTitre}>
                <Palette size={22} weight="duotone" style={{ color: "var(--color-primary-600)" }} />
                <span>Identité visuelle & Marque</span>
              </h3>
              <p className={styles.carteStandardDesc}>
                Personnalisez le logo de votre entreprise et les couleurs primaires appliquées à vos rapports et chantiers.
              </p>
            </div>
            <Link href="/configuration" className={styles.lienAction}>
              <span>Modifier l&apos;identité</span>
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>

          <div className={styles.carteStandard}>
            <div>
              <h3 className={styles.carteStandardTitre}>
                <ShieldCheck size={22} weight="duotone" style={{ color: "var(--color-primary-600)" }} />
                <span>Sécurité & Sessions</span>
              </h3>
              <p className={styles.carteStandardDesc}>
                Consultez les journaux d&apos;audit des connexions, gérez la double authentification et l&apos;expiration des sessions.
              </p>
            </div>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)", fontStyle: "italic" }}>
              Actif · Chiffrement SSL
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

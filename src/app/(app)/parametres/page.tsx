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
import { useEffect, useState } from "react";

import { Abonnement, lireAbonnement } from "@/features/abonnement/api";

import styles from "./page.module.css";

export default function PageParametres() {
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);

  useEffect(() => {
    lireAbonnement().then(setAbonnement).catch(() => {});
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.entete}>
        <h1 className={styles.titre}>Paramètres & Administration</h1>
        <p className={styles.sousTitre}>
          Gérez votre formule d&apos;abonnement, vos collaborateurs, les droits d&apos;accès et les données de votre entreprise.
        </p>
      </header>

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
                <span>{abonnement?.plan?.libelle || "Forfait Maître d'Œuvre (Essai)"}</span>
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
                3 / {abonnement?.plan?.limite_projets ? `${abonnement.plan.limite_projets}` : "50"}
              </div>
              <div className={styles.barreFond}>
                <div className={styles.barreProgression} style={{ width: "6%" }} />
              </div>
            </div>

            <div className={styles.itemQuota}>
              <div className={styles.quotaEntete}>
                <span>Collaborateurs</span>
                <Users size={16} weight="duotone" />
              </div>
              <div className={styles.quotaValeur}>
                5 / {abonnement?.plan?.limite_utilisateurs ? `${abonnement.plan.limite_utilisateurs}` : "25"}
              </div>
              <div className={styles.barreFond}>
                <div className={styles.barreProgression} style={{ width: "20%" }} />
              </div>
            </div>

            <div className={styles.itemQuota}>
              <div className={styles.quotaEntete}>
                <span>Stockage Cloud</span>
                <HardDrive size={16} weight="duotone" />
              </div>
              <div className={styles.quotaValeur}>
                1.2 Go / {abonnement?.plan?.limite_stockage_mo ? `${Math.round(abonnement.plan.limite_stockage_mo / 1000)} Go` : "20 Go"}
              </div>
              <div className={styles.barreFond}>
                <div className={styles.barreProgression} style={{ width: "6%" }} />
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
              href="/abonnement"
              style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-neutral-700)" }}
            >
              Consulter la grille des tarifs
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

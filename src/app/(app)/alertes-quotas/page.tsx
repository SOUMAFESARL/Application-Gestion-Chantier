"use client";

import {
  ArrowRight,
  ArrowsCounterClockwise,
  Buildings,
  CheckCircle,
  Flask,
  HardDrive,
  SlidersHorizontal,
  Sparkle,
  Users,
  Warning,
  WarningOctagon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import BanniereAlerteQuota from "@/components/metier/quotas/BanniereAlerteQuota";
import ModaleQuotaAtteint from "@/components/metier/quotas/ModaleQuotaAtteint";
import {
  appliquerScenarioSimulation,
  EVENEMENT_QUOTAS_MODIFIE,
  obtenirQuotasActuels,
  reinitialiserQuotasParDefaut,
} from "@/features/quotas/api";
import { SCENARIOS_SIMULATION } from "@/features/quotas/mockData";
import { MetriqueQuota, ResumeQuotas } from "@/features/quotas/types";

import styles from "./page.module.css";

export default function PageAlertesQuotas() {
  const [quotas, setQuotas] = useState<ResumeQuotas | null>(null);
  const [scenarioActifId, setScenarioActifId] = useState<string | null>(null);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [ressourcePourModale, setRessourcePourModale] = useState<MetriqueQuota | undefined>(undefined);

  const recharger = useCallback(() => {
    obtenirQuotasActuels()
      .then((data) => {
        setQuotas(data);
      })
      .catch(() => {});
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

  const handleChoisirScenario = (scenarioId: string) => {
    setScenarioActifId(scenarioId);
    appliquerScenarioSimulation(scenarioId);
  };

  const handleReinitialiser = () => {
    setScenarioActifId(null);
    reinitialiserQuotasParDefaut();
  };

  const handleDeclencherModale = (ressource: MetriqueQuota) => {
    setRessourcePourModale(ressource);
    setModaleOuverte(true);
  };

  if (!quotas) {
    return (
      <main className={styles.page}>
        <p>Chargement des métriques de quotas...</p>
      </main>
    );
  }

  const { chantiers, collaborateurs, stockage, ia } = quotas.ressources;
  const recommandation = quotas.recommandationSurclassement;

  return (
    <main className={styles.page}>
      {/* Modale d'incitation au surclassement */}
      <ModaleQuotaAtteint
        ouvert={modaleOuverte}
        surFermer={() => setModaleOuverte(false)}
        ressourceBloquante={ressourcePourModale}
        recommandation={recommandation}
      />

      {/* En-tête de la page */}
      <header className={styles.enTete}>
        <div>
          <h1 className={styles.titre}>
            <SlidersHorizontal size={30} weight="duotone" style={{ color: "var(--color-primary-500)" }} />
            <span>Gestion des Quotas & Alertes de Surclassement</span>
          </h1>
          <p className={styles.sousTitre}>
            Surveillez en temps réel les capacités allouées à votre entreprise et anticipez les besoins d&apos;extension de formule.
          </p>
        </div>

        <div className={styles.actionsHaut}>
          <span className={styles.badgeFormuleActuelle}>
            <Sparkle size={14} weight="fill" />
            <span>{quotas.forfaitLibelle}</span>
          </span>

          <Link href="/abonnement" className={styles.btnLienAbonnement}>
            <span>Changer de formule</span>
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      </header>

      {/* Bannière contextuelle en haut */}
      <BanniereAlerteQuota persistant />

      {/* GRILLE DES 4 QUOTAS */}
      <section className={styles.grilleQuotas}>
        {/* 1. CHANTIERS */}
        <div
          className={`${styles.carteQuota} ${
            chantiers.statut === "BLOQUANT"
              ? styles.carteQuotaBloquant
              : chantiers.statut === "AVERTISSEMENT"
              ? styles.carteQuotaAvertissement
              : ""
          }`}
        >
          <div className={styles.quotaEntete}>
            <div className={styles.quotaTitreEtIcone}>
              <div className={styles.quotaIcone}>
                <Buildings size={20} weight="duotone" />
              </div>
              <span className={styles.quotaNom}>Chantiers Actifs</span>
            </div>
            <span
              className={`${styles.badgeStatut} ${
                chantiers.statut === "BLOQUANT"
                  ? styles.badgeBloquant
                  : chantiers.statut === "AVERTISSEMENT"
                  ? styles.badgeAvertissement
                  : chantiers.statut === "ILLIMITE"
                  ? styles.badgeIllimite
                  : styles.badgeNormal
              }`}
            >
              {chantiers.statut}
            </span>
          </div>

          <div className={styles.quotaChiffres}>
            <span className={styles.valeurChiffre}>
              {chantiers.actuel} / {chantiers.limite !== null ? chantiers.limite : "∞"}
            </span>
            <span className={styles.valeurPourcent}>
              {chantiers.limite !== null ? `${chantiers.pourcentage}%` : "Illimité"}
            </span>
          </div>

          <div className={styles.barreFond}>
            <div
              className={`${styles.barreRemplissage} ${
                chantiers.statut === "BLOQUANT"
                  ? styles.remplissageBloquant
                  : chantiers.statut === "AVERTISSEMENT"
                  ? styles.remplissageAvertissement
                  : chantiers.statut === "ILLIMITE"
                  ? styles.remplissageIllimite
                  : styles.remplissageNormal
              }`}
              style={{ width: `${chantiers.pourcentage}%` }}
            />
          </div>

          <div className={styles.cartePied}>
            <span>{chantiers.limite !== null ? `${chantiers.limite - chantiers.actuel} restant(s)` : "Sans restriction"}</span>
            <button
              type="button"
              className={styles.btnActionTest}
              onClick={() => handleDeclencherModale(chantiers)}
            >
              Tester blocage
            </button>
          </div>
        </div>

        {/* 2. COLLABORATEURS */}
        <div
          className={`${styles.carteQuota} ${
            collaborateurs.statut === "BLOQUANT"
              ? styles.carteQuotaBloquant
              : collaborateurs.statut === "AVERTISSEMENT"
              ? styles.carteQuotaAvertissement
              : ""
          }`}
        >
          <div className={styles.quotaEntete}>
            <div className={styles.quotaTitreEtIcone}>
              <div className={styles.quotaIcone}>
                <Users size={20} weight="duotone" />
              </div>
              <span className={styles.quotaNom}>Collaborateurs</span>
            </div>
            <span
              className={`${styles.badgeStatut} ${
                collaborateurs.statut === "BLOQUANT"
                  ? styles.badgeBloquant
                  : collaborateurs.statut === "AVERTISSEMENT"
                  ? styles.badgeAvertissement
                  : collaborateurs.statut === "ILLIMITE"
                  ? styles.badgeIllimite
                  : styles.badgeNormal
              }`}
            >
              {collaborateurs.statut}
            </span>
          </div>

          <div className={styles.quotaChiffres}>
            <span className={styles.valeurChiffre}>
              {collaborateurs.actuel} / {collaborateurs.limite !== null ? collaborateurs.limite : "∞"}
            </span>
            <span className={styles.valeurPourcent}>
              {collaborateurs.limite !== null ? `${collaborateurs.pourcentage}%` : "Illimité"}
            </span>
          </div>

          <div className={styles.barreFond}>
            <div
              className={`${styles.barreRemplissage} ${
                collaborateurs.statut === "BLOQUANT"
                  ? styles.remplissageBloquant
                  : collaborateurs.statut === "AVERTISSEMENT"
                  ? styles.remplissageAvertissement
                  : collaborateurs.statut === "ILLIMITE"
                  ? styles.remplissageIllimite
                  : styles.remplissageNormal
              }`}
              style={{ width: `${collaborateurs.pourcentage}%` }}
            />
          </div>

          <div className={styles.cartePied}>
            <span>
              {collaborateurs.limite !== null ? `${collaborateurs.limite - collaborateurs.actuel} accès dispo` : "Équipe illimitée"}
            </span>
            <button
              type="button"
              className={styles.btnActionTest}
              onClick={() => handleDeclencherModale(collaborateurs)}
            >
              Tester blocage
            </button>
          </div>
        </div>

        {/* 3. STOCKAGE */}
        <div
          className={`${styles.carteQuota} ${
            stockage.statut === "BLOQUANT"
              ? styles.carteQuotaBloquant
              : stockage.statut === "AVERTISSEMENT"
              ? styles.carteQuotaAvertissement
              : ""
          }`}
        >
          <div className={styles.quotaEntete}>
            <div className={styles.quotaTitreEtIcone}>
              <div className={styles.quotaIcone}>
                <HardDrive size={20} weight="duotone" />
              </div>
              <span className={styles.quotaNom}>Stockage Cloud</span>
            </div>
            <span
              className={`${styles.badgeStatut} ${
                stockage.statut === "BLOQUANT"
                  ? styles.badgeBloquant
                  : stockage.statut === "AVERTISSEMENT"
                  ? styles.badgeAvertissement
                  : stockage.statut === "ILLIMITE"
                  ? styles.badgeIllimite
                  : styles.badgeNormal
              }`}
            >
              {stockage.statut}
            </span>
          </div>

          <div className={styles.quotaChiffres}>
            <span className={styles.valeurChiffre}>
              {stockage.actuel} Go / {stockage.limite !== null ? `${stockage.limite} Go` : "∞"}
            </span>
            <span className={styles.valeurPourcent}>{stockage.pourcentage}%</span>
          </div>

          <div className={styles.barreFond}>
            <div
              className={`${styles.barreRemplissage} ${
                stockage.statut === "BLOQUANT"
                  ? styles.remplissageBloquant
                  : stockage.statut === "AVERTISSEMENT"
                  ? styles.remplissageAvertissement
                  : stockage.statut === "ILLIMITE"
                  ? styles.remplissageIllimite
                  : styles.remplissageNormal
              }`}
              style={{ width: `${stockage.pourcentage}%` }}
            />
          </div>

          <div className={styles.cartePied}>
            <span>Plans, photos et PV</span>
            <button
              type="button"
              className={styles.btnActionTest}
              onClick={() => handleDeclencherModale(stockage)}
            >
              Tester alerte
            </button>
          </div>
        </div>

        {/* 4. ASSISTANT IA */}
        <div
          className={`${styles.carteQuota} ${
            ia.statut === "BLOQUANT" ? styles.carteQuotaBloquant : ""
          }`}
        >
          <div className={styles.quotaEntete}>
            <div className={styles.quotaTitreEtIcone}>
              <div className={styles.quotaIcone}>
                <Sparkle size={20} weight="duotone" />
              </div>
              <span className={styles.quotaNom}>Assistant IA Chantier</span>
            </div>
            <span
              className={`${styles.badgeStatut} ${
                ia.statut === "BLOQUANT" ? styles.badgeBloquant : styles.badgeNormal
              }`}
            >
              {ia.statut === "BLOQUANT" ? "NON INCLUS" : "ACTIF"}
            </span>
          </div>

          <div className={styles.quotaChiffres}>
            <span className={styles.valeurChiffre} style={{ fontSize: "1.125rem" }}>
              {ia.statut === "BLOQUANT" ? "Réservé Maître d'Œuvre" : "Comptes-rendus & résumés"}
            </span>
          </div>

          <div className={styles.barreFond}>
            <div
              className={`${styles.barreRemplissage} ${
                ia.statut === "BLOQUANT" ? styles.remplissageBloquant : styles.remplissageNormal
              }`}
              style={{ width: ia.statut === "BLOQUANT" ? "100%" : "100%" }}
            />
          </div>

          <div className={styles.cartePied}>
            <span>Rédaction automatisée</span>
            <button
              type="button"
              className={styles.btnActionTest}
              onClick={() => handleDeclencherModale(ia)}
            >
              Tester accès
            </button>
          </div>
        </div>
      </section>

      {/* BAC A SABLE & SIMULATEUR DE SCÉNARIOS */}
      <section className={styles.sectionSimulateur}>
        <div className={styles.enTeteSimulateur}>
          <div>
            <h2 className={styles.titreSimulateur}>
              <Flask size={22} weight="duotone" style={{ color: "var(--color-primary-500)" }} />
              <span>Simulateur & Bac à Sable de Dépassement de Quotas</span>
            </h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748B" }}>
              Testez instantanément les différents états d&apos;alerte, de blocage et de surclassement recommandés.
            </p>
          </div>

          <button
            type="button"
            className={styles.btnActionTest}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px" }}
            onClick={handleReinitialiser}
          >
            <ArrowsCounterClockwise size={16} />
            <span>Réinitialiser par défaut</span>
          </button>
        </div>

        <div className={styles.grilleScenarios}>
          {SCENARIOS_SIMULATION.map((s) => (
            <div
              key={s.id}
              className={`${styles.carteScenario} ${
                scenarioActifId === s.id ? styles.carteScenarioActive : ""
              }`}
              onClick={() => handleChoisirScenario(s.id)}
            >
              <div className={styles.nomScenario}>
                {s.chantiers.actuel >= (s.chantiers.limite ?? Infinity) ||
                s.collaborateurs.actuel >= (s.collaborateurs.limite ?? Infinity) ? (
                  <WarningOctagon size={16} weight="fill" style={{ color: "#EF4444", marginRight: 6 }} />
                ) : (
                  <Warning size={16} weight="fill" style={{ color: "#F59E0B", marginRight: 6 }} />
                )}
                <span>{s.nom}</span>
              </div>
              <p className={styles.descScenario}>{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CARTE HERO : RECOMMANDATION PERSONNALISÉE DE SURCLASSEMENT */}
      {recommandation && (
        <section className={styles.carteSurclassementHero}>
          <div className={styles.heroGauche}>
            <span className={styles.heroTag}>
              <Sparkle size={14} weight="fill" />
              <span>Recommandation Surclassement BTP</span>
            </span>

            <h2 className={styles.heroTitre}>{recommandation.titreIncitation}</h2>
            <p className={styles.heroDescription}>{recommandation.argumentaire}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              {recommandation.beneficesDebloques.map((b, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.875rem" }}>
                  <CheckCircle size={18} weight="fill" style={{ color: "#10B981" }} />
                  <span>
                    <strong>{b.ressource}</strong> : {b.avant} ➜ <strong style={{ color: "#34D399" }}>{b.apres}</strong> ({b.gainCle})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.heroDroite}>
            <div>
              <div className={styles.heroPrixLabel}>Offre {recommandation.forfaitCibleLibelle}</div>
              <div className={styles.heroPrixValeur}>
                {recommandation.prixCibleMensuelFcfa.toLocaleString("fr-FR")} FCFA
                <span className={styles.heroPrixCycle}> / mois</span>
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#94A3B8", marginTop: "4px" }}>
                Ou {recommandation.prixCibleAnnuelFcfa.toLocaleString("fr-FR")} FCFA / an (-15%)
              </div>
            </div>

            <Link
              href={`/abonnement?plan=${recommandation.forfaitCibleCode}`}
              className={styles.btnHeroSurclasser}
            >
              <Sparkle size={20} weight="fill" />
              <span>Passer à {recommandation.forfaitCibleLibelle}</span>
              <ArrowRight size={18} weight="bold" />
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}

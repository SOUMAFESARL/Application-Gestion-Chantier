"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BadgeEssai } from "@/components/metier/BadgeEssai";
import { Bouton, EtatChargement } from "@/components/ui";
import { lireRecapitulatif } from "@/features/configuration/api";
import type { Progression, Recapitulatif } from "@/features/configuration/api";
import { afficherTelephone } from "@/features/referentiels/telephone";
import { ABSENT, formaterMontant } from "@/lib/format";

import styles from "./page.module.css";

/**
 * Écran de confirmation — M9.
 *
 * **La phrase sur les invitations est conditionnelle** (T-022 §6). « Les
 * invitations ont été envoyées » est faux quand l'étape 3 a été passée, et
 * l'email part par Celery *après* la transaction : l'invitation peut exister
 * sans que le message soit parti.
 */
export function Confirmation({ progression }: { progression: Progression }) {
  const t = useTranslations("configuration.confirmation");
  const router = useRouter();
  const [recapitulatif, setRecapitulatif] = useState<Recapitulatif | null>(null);

  useEffect(() => {
    let vivant = true;
    lireRecapitulatif()
      .then((r) => {
        if (vivant) setRecapitulatif(r);
      })
      .catch(() => {
        // Le récapitulatif est un confort : son échec ne doit pas empêcher
        // d'entrer dans le produit.
        if (vivant) setRecapitulatif({ entreprise: null, projet: null, reference: null, invitations: 0 });
      });
    return () => {
      vivant = false;
    };
  }, []);

  if (!recapitulatif) return <EtatChargement message={t("preparation")} />;

  const entreprise = recapitulatif.entreprise as { raison_sociale?: string } | null;
  const projet = recapitulatif.projet as
    | {
        nom?: string;
        budget_initial_montant?: number | null;
        conducteur_travaux?: {
          nom?: string;
          prenom?: string;
          nom_complet?: string;
          email?: string;
          telephone?: string;
        } | null;
        conducteur_travaux_invite?: {
          nom?: string;
          prenom?: string;
          email?: string;
          telephone?: string;
        } | null;
        chef_projet?: {
          nom?: string;
          prenom?: string;
          nom_complet?: string;
          email?: string;
          telephone?: string;
        } | null;
        chef_projet_invite?: {
          nom?: string;
          prenom?: string;
          email?: string;
          telephone?: string;
        } | null;
      }
    | null;
  const invitations = recapitulatif.invitations;
  const etapeEquipe = progression.etapes.find((e) => e.code === "EQUIPE");

  const cp = (projet?.conducteur_travaux ??
    projet?.conducteur_travaux_invite ??
    projet?.chef_projet ??
    projet?.chef_projet_invite) as {
    nom?: string;
    prenom?: string;
    nom_complet?: string;
    email?: string;
    telephone?: string;
  } | null | undefined;

  const chefProjetNom = cp
    ? cp.nom_complet || `${cp.prenom ?? ""} ${cp.nom ?? ""}`.trim() || cp.email || null
    : null;

  const chefProjetDetails = cp
    ? [chefProjetNom !== cp.email ? cp.email : null, afficherTelephone(cp.telephone ?? "")]
        .filter(Boolean)
        .join(" · ")
    : null;

  const messageEquipe =
    invitations > 0
      ? t("equipeInvitee")
      : etapeEquipe?.mode === "PASSEE"
        ? t("equipePassee")
        : t("equipeAucune");

  return (
    <div className={styles.confirmation}>
      <span className={styles.confirmationPastille} aria-hidden="true">
        <CheckCircle size={36} weight="fill" />
      </span>

      <h1 className={styles.confirmationTitre}>{t("titre")}</h1>
      <p className={styles.confirmationAccroche}>
        {entreprise?.raison_sociale
          ? t.rich("espacePret", {
              entreprise: entreprise.raison_sociale,
              fort: (morceaux) => <strong>{morceaux}</strong>,
            })
          : t("espacePretSansNom")}{" "}
        {messageEquipe}
      </p>

      <dl className={styles.recapitulatif}>
        <div className={styles.recapLigne}>
          <dt>{t("ligneEntreprise")}</dt>
          <dd>{entreprise?.raison_sociale || ABSENT}</dd>
        </div>
        <div className={styles.recapLigne}>
          <dt>{t("ligneProjet")}</dt>
          <dd>
            {projet?.nom ? (
              <>
                <span>{projet.nom}</span>
                {recapitulatif.reference && (
                  <span className={styles.reference}>{recapitulatif.reference}</span>
                )}
              </>
            ) : (
              ABSENT
            )}
          </dd>
        </div>
        <div className={styles.recapLigne}>
          <dt>{t("ligneChefProjet")}</dt>
          <dd>
            {chefProjetNom ? (
              <div className={styles.cpDetails}>
                <span>{chefProjetNom}</span>
                {chefProjetDetails && (
                  <span className={styles.reference}>{chefProjetDetails}</span>
                )}
              </div>
            ) : (
              ABSENT
            )}
          </dd>
        </div>
        <div className={styles.recapLigne}>
          <dt>{t("ligneBudget")}</dt>
          <dd>
            {projet?.budget_initial_montant != null
              ? formaterMontant(projet.budget_initial_montant)
              : ABSENT}
          </dd>
        </div>
        <div className={styles.recapLigne}>
          <dt>{t("ligneCollaborateurs")}</dt>
          <dd>{invitations}</dd>
        </div>
        <div className={styles.recapLigne}>
          <dt>{t("ligneEssai")}</dt>
          <dd>
            <BadgeEssai />
          </dd>
        </div>
      </dl>

      <p className={styles.prochaine}>
        {t.rich("prochaineEtape", { fort: (morceaux) => <strong>{morceaux}</strong> })}
      </p>

      <div className={styles.actionsConfirmation}>
        <Bouton taille="lg" onClick={() => router.push("/tableau-de-bord")}>
          {t("allerTableauDeBord")}
        </Bouton>
        <Bouton
          variante="secondaire"
          taille="lg"
          onClick={() => router.push("/parametres/utilisateurs")}
        >
          {t("inviterEncore")}
        </Bouton>
      </div>
    </div>
  );
}

"use client";

import {
  ArrowLeft,
  BuildingOffice,
  CalendarBlank,
  CheckCircle,
  CurrencyCircleDollar,
  Envelope,
  Phone,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Carte } from "@/components/ui/Carte";
import { lireProjetDetail } from "@/features/projets/api";
import { afficherTelephone } from "@/features/referentiels/telephone";
import type { ProjetDetail } from "@/features/projets/api";
import { formaterMontantCourt } from "@/lib/format";

import styles from "./page.module.css";

const PROJET_DEFAUT: ProjetDetail = {
  id: "b1b72e51-4fa3-433b-821b-cfc1901ddfa2",
  reference: "PRJ-2026-004",
  nom: "Résidence Les Merveilles",
  description: "Programme immobilier R+4 de 16 logements avec sous-sol parking.",
  client: {
    id: "4a180182-e35b-4c4f-9e73-b5419b165b4c",
    raison_sociale: "SCI Les Lagunes",
    telephone: "+2250102030405",
    email: "contact@scilagunes.ci",
    ville: "Abidjan",
  },
  ville: "Abidjan",
  quartier: "Cocody Angré",
  statut: "EN_COURS",
  avancement_reel: 22.5,
  avancement_theorique: 25.0,
  budget_initial_montant: 650_000_000_00,
  budget_consomme_montant: 146_250_000_00,
  date_debut_prevue: "2026-10-01",
  date_fin_prevue: "2027-08-31",
  date_debut_reelle: "2026-10-05",
  date_fin_reelle: null,
  chef_projet: {
    id: "99ea7b42-1234-4b55-89af-d01948ba2345",
    nom: "Soro",
    prenom: "Mamadou",
    nom_complet: "Mamadou Soro",
    email: "m.soro@btp-ci.com",
    telephone: "+2250701020304",
    statut: "ACTIF",
    lien_whatsapp: "https://wa.me/2250701020304",
  },
};

/**
 * Fiche projet enrichie — Maquette M10 & T-S1-07 (US-023).
 * Intègre l'encart Chef de Projet avec bouton direct WhatsApp (wa.me).
 */
export default function Page() {
  const t = useTranslations("ficheProjet");
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [projet, setProjet] = useState<ProjetDetail>(PROJET_DEFAUT);

  useEffect(() => {
    if (!id) return;
    let vivant = true;

    lireProjetDetail(id)
      .then((data) => {
        if (vivant && data && data.nom) {
          setProjet(data);
        }
      })
      .catch(() => {
        // En cas d'erreur ou d'id mocké, on conserve le modèle par défaut
      });

    return () => {
      vivant = false;
    };
  }, [id]);

  const ecart = Math.round((projet.avancement_reel - projet.avancement_theorique) * 10) / 10;
  const estRetard = ecart < 0;

  // Calcul initiales Conducteur de Travaux
  const lead = projet.conducteur_travaux || projet.chef_projet;
  const initialesCp =
    lead?.prenom && lead?.nom
      ? `${lead.prenom[0]}${lead.nom[0]}`.toUpperCase()
      : "CT";

  const lienWhatsApp =
    lead?.lien_whatsapp ||
    (lead?.telephone
      ? `https://wa.me/${lead.telephone.replace(/[^0-9]/g, "")}`
      : undefined);

  return (
    <main className={styles.page}>
      {/* Navigation retour */}
      <nav className={styles.navigation}>
        <Link href="/tableau-de-bord" className={styles.lienRetour}>
          <ArrowLeft size={16} weight="bold" />
          <span>{t("retourDashboard")}</span>
        </Link>
      </nav>

      {/* En-tête principal de la fiche chantier */}
      <header className={styles.entete}>
        <div className={styles.titreBloc}>
          <h1 className={styles.titre}>{t("titre", { nom: projet.nom })}</h1>
          <p className={styles.sousTitre}>
            {t("sousTitre", {
              reference: projet.reference,
              client: projet.client?.raison_sociale || "",
              ville: projet.ville,
            })}
          </p>
        </div>

        <div className={styles.enteteActions}>
          <Badge variante={estRetard ? "avertissement" : "succes"}>
            {estRetard
              ? t("badgeRetard", { ecart: Math.abs(ecart) })
              : t("badgeConforme", { ecart: Math.abs(ecart) })}
          </Badge>
          <Badge variante="neutre">{projet.statut}</Badge>
        </div>
      </header>

      {/* Grille principale */}
      <div className={styles.grille}>
        {/* Colonne gauche : Métriques, Avancement, Budget et Planning */}
        <div className={styles.colonneGauche}>
          {/* Section Avancement des travaux */}
          <Carte>
            <div className={styles.carteEntete}>
              <div className={styles.carteTitre}>
                <CheckCircle size={18} style={{ color: "var(--color-semantic-success, #166534)" }} />
                <span>{t("avancementTitre")}</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: "14px" }}>
                {projet.avancement_reel}%
              </span>
            </div>

            <div className={styles.gaugeContainer}>
              <div className={styles.gaugeLegend}>
                <span>{projet.avancement_reel}%</span>
                <span style={{ color: "var(--color-neutral-500, #8A8680)" }}>
                  {projet.avancement_theorique}%
                </span>
              </div>
              <div className={styles.gaugeTrack}>
                <div
                  className={`${styles.gaugeFill} ${estRetard ? styles.gaugeFillDelay : ""}`}
                  style={{ width: `${Math.min(projet.avancement_reel, 100)}%` }}
                />
                <div
                  className={styles.gaugeTarget}
                  style={{ left: `${Math.min(projet.avancement_theorique, 100)}%` }}
                />
              </div>
            </div>
          </Carte>

          {/* Section Budget */}
          <Carte>
            <div className={styles.carteEntete}>
              <div className={styles.carteTitre}>
                <CurrencyCircleDollar size={18} style={{ color: "var(--color-primary-500, #D4652A)" }} />
                <span>{t("budgetTitre")}</span>
              </div>
            </div>

            <div className={styles.grilleBudget}>
              <div className={styles.kpiBox}>
                <div className={styles.kpiLibelle}>{t("budgetTitre")}</div>
                <div className={styles.kpiMontant}>
                  {projet.budget_initial_montant !== null
                    ? formaterMontantCourt(projet.budget_initial_montant)
                    : t("budgetNonDefini")}
                </div>
              </div>

              <div className={styles.kpiBox}>
                <div className={styles.kpiLibelle}>{t("metriquesTitre")}</div>
                <div className={styles.kpiMontant}>
                  {formaterMontantCourt(projet.budget_consomme_montant || 0)}
                </div>
              </div>
            </div>
          </Carte>

          {/* Section Planning & Client */}
          <Carte>
            <div className={styles.carteEntete}>
              <div className={styles.carteTitre}>
                <CalendarBlank size={18} style={{ color: "var(--color-neutral-700, #4F4C47)" }} />
                <span>{t("planningTitre")}</span>
              </div>
            </div>

            <div className={styles.listeInfos}>
              <div className={styles.infoItem}>
                <CalendarBlank size={16} className={styles.infoIcone} />
                <span>
                  {t("dates", {
                    debut: projet.date_debut_prevue,
                    fin: projet.date_fin_prevue,
                  })}
                </span>
              </div>

              <div className={styles.infoItem}>
                <BuildingOffice size={16} className={styles.infoIcone} />
                <span>
                  <strong>{t("clientTitre")} : </strong>
                  {projet.client?.raison_sociale} (
                  {afficherTelephone(projet.client?.telephone ?? "") ||
                    projet.client?.email ||
                    projet.ville}
                  )
                </span>
              </div>

              {projet.description && (
                <p style={{ margin: "8px 0 0 0", color: "var(--color-neutral-600, #6B6762)", fontSize: "14px" }}>
                  {projet.description}
                </p>
              )}
            </div>
          </Carte>
        </div>

        {/* Colonne droite : Encart Conducteur de Travaux responsable (T-S1-07 / US-023) */}
        <div className={styles.colonneDroite}>
          <div className={styles.encartCp}>
            <div className={styles.carteEntete}>
              <div className={styles.carteTitre}>
                <span>{t("encartCpTitre")}</span>
              </div>
              <Badge variante={lead?.statut === "INVITE" ? "avertissement" : "succes"}>
                {lead?.statut || "ACTIF"}
              </Badge>
            </div>

            <div className={styles.cpHeader}>
              <div className={styles.cpAvatar}>{initialesCp}</div>
              <div className={styles.cpIdentite}>
                <div className={styles.cpNom}>
                  {lead?.nom_complet ||
                    (lead?.prenom && lead?.nom ? `${lead.prenom} ${lead.nom}` : lead?.email || "")}
                </div>
                <div className={styles.cpRole}>{t("encartCpSousTitre")}</div>
              </div>
            </div>

            <div className={styles.cpDetails}>
              <div className={styles.cpDetailLigne}>
                <Envelope size={16} style={{ color: "var(--color-neutral-500, #8A8680)" }} />
                <span>{t("email")} </span>
                <a
                  href={`mailto:${lead?.email}`}
                  style={{ color: "var(--color-primary-600, #B85522)", textDecoration: "none" }}
                >
                  {lead?.email}
                </a>
              </div>

              <div className={styles.cpDetailLigne}>
                <Phone size={16} style={{ color: "var(--color-neutral-500, #8A8680)" }} />
                <span>{t("telephone")} </span>
                <span>{afficherTelephone(lead?.telephone ?? "")}</span>
              </div>
            </div>

            {/* Bouton direct WhatsApp (wa.me) — Spécification majeure démo SOUMAFE */}
            {lienWhatsApp && (
              <a
                href={lienWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.boutonWhatsApp}
              >
                <WhatsappLogo size={20} weight="fill" />
                <span>{t("actionWhatsApp")}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

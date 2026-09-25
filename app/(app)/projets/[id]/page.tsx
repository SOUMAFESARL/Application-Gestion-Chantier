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

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Badge } from "@/components/ui/Badge";
import { Carte } from "@/components/ui/Carte";
import { lireProjet } from "@/features/projets/adaptateur";
import {
  ecartAvancement,
  estEnRetard,
  initiales,
  largeurJauge,
  lienWhatsApp as construireLienWhatsApp,
} from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import { afficherTelephone } from "@/features/referentiels/telephone";
import { formaterMontantCourt } from "@/lib/format";
import { cn } from "@/lib/utils";


/** Le repli d'affichage tant que le serveur n'a pas répondu — jeu de démonstration. */
const PROJET_DEFAUT: Projet = {
  id: "b1b72e51-4fa3-433b-821b-cfc1901ddfa2",
  reference: "PRJ-2026-004",
  nom: "Résidence Les Merveilles",
  description: "Programme immobilier R+4 de 16 logements avec sous-sol parking.",
  typeProjet: "BATIMENT_RESIDENTIEL",
  client: {
    id: "4a180182-e35b-4c4f-9e73-b5419b165b4c",
    raisonSociale: "SCI Les Lagunes",
    telephone: "+2250102030405",
    email: "contact@scilagunes.ci",
    ville: "Abidjan",
  },
  ville: "Abidjan",
  quartier: "Cocody Angré",
  statut: "EN_COURS",
  avancementReel: 22.5,
  avancementTheorique: 25.0,
  indiceSante: 82,
  budgetInitial: 650_000_000_00,
  budgetConsomme: 146_250_000_00,
  dateDebutPrevue: "2026-10-01",
  dateFinPrevue: "2027-08-31",
  dateDebutReelle: "2026-10-05",
  dateFinReelle: null,
  chefProjet: {
    id: "99ea7b42-1234-4b55-89af-d01948ba2345",
    nom: "Soro",
    prenom: "Mamadou",
    nomComplet: "Mamadou Soro",
    email: "m.soro@btp-ci.com",
    telephone: "+2250701020304",
    statut: "ACTIF",
    lienWhatsApp: "https://wa.me/2250701020304",
  },
  conducteurTravaux: null,
};

/** Le repli d'initiales quand la fiche de l'intervenant est incomplète. */
const INITIALES_DEFAUT = "CT";

/**
 * Fiche projet enrichie — Maquette M10 & T-S1-07 (US-023).
 * Intègre l'encart Chef de Projet avec bouton direct WhatsApp (wa.me).
 *
 * L'écran ne calcule plus rien : l'écart, le retard, les jauges et le lien
 * WhatsApp viennent de `features/projets/regles`. C'est ce qui garantit que
 * la fiche et le tableau de bord ne peuvent plus qualifier le même chantier
 * différemment — ce qu'ils faisaient avec deux seuils de retard distincts.
 */

/** Les deux colonnes du detail, et la carte qui les habille. */
const COLONNE = "flex flex-col gap-5";
const CARTE_ENTETE = "mb-3 flex items-center justify-between";
const CARTE_TITRE = "flex items-center gap-2 text-base font-semibold text-neutral-900";
const KPI_BOITE = "rounded-md border border-neutral-200 bg-neutral-50 p-3";

export default function Page() {
  const t = useTranslations("ficheProjet");
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [projet, setProjet] = useState<Projet>(PROJET_DEFAUT);

  useEffect(() => {
    if (!id) return;
    let vivant = true;

    lireProjet(id)
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

  const ecart = ecartAvancement(projet.avancementReel, projet.avancementTheorique);
  const estRetard = estEnRetard(ecart);

  const lead = projet.conducteurTravaux ?? projet.chefProjet;
  const initialesCp = initiales(lead?.prenom, lead?.nom) ?? INITIALES_DEFAUT;
  const lienWhatsApp = construireLienWhatsApp(lead?.lienWhatsApp, lead?.telephone);

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Navigation retour */}
      <nav className="-mb-2">
        <Link href="/tableau-de-bord" className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 no-underline transition-colors hover:text-primary-600 hover:underline">
          <ArrowLeft size={16} weight="bold" />
          <span>{t("retourDashboard")}</span>
        </Link>
      </nav>

      {/* En-tête principal de la fiche chantier */}
      <EnTetePage
        className="border-b border-neutral-200 pb-4"
        titre={t("titre", { nom: projet.nom })}
        description={t("sousTitre", {
          reference: projet.reference,
          client: projet.client.raisonSociale,
          ville: projet.ville,
        })}
        actions={
          <>
            <Badge variante={estRetard ? "avertissement" : "succes"}>
              {estRetard
                ? t("badgeRetard", { ecart: Math.abs(ecart) })
                : t("badgeConforme", { ecart: Math.abs(ecart) })}
            </Badge>
            <Badge variante="neutre">{projet.statut}</Badge>
          </>
        }
      />

      {/* Grille principale */}
      <div className="grid grid-cols-[2fr_1fr] items-start gap-8 max-[900px]:grid-cols-1">
        {/* Colonne gauche : Métriques, Avancement, Budget et Planning */}
        <div className={COLONNE}>
          {/* Section Avancement des travaux */}
          <Carte>
            <div className={CARTE_ENTETE}>
              <div className={CARTE_TITRE}>
                <CheckCircle size={18} style={{ color: "var(--color-semantic-success, #166534)" }} />
                <span>{t("avancementTitre")}</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: "14px" }}>
                {projet.avancementReel}%
              </span>
            </div>

            <div className="mt-2 flex flex-col gap-2">
              <div className="flex justify-between text-[13px] text-neutral-700">
                <span>{projet.avancementReel}%</span>
                <span style={{ color: "var(--color-neutral-500, #8A8680)" }}>
                  {projet.avancementTheorique}%
                </span>
              </div>
              <div className="relative h-3 rounded-full bg-neutral-200">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300",
                    estRetard ? "bg-avertissement" : "bg-succes",
                  )}
                  style={{ width: `${largeurJauge(projet.avancementReel)}%` }}
                />
                <div
                  className="absolute top-[-3px] bottom-[-3px] w-[3px] -translate-x-1/2 rounded-sm bg-neutral-900"
                  style={{ left: `${largeurJauge(projet.avancementTheorique)}%` }}
                />
              </div>
            </div>
          </Carte>

          {/* Section Budget */}
          <Carte>
            <div className={CARTE_ENTETE}>
              <div className={CARTE_TITRE}>
                <CurrencyCircleDollar size={18} style={{ color: "var(--color-primary-500)" }} />
                <span>{t("budgetTitre")}</span>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-4">
              <div className={KPI_BOITE}>
                <div className="mb-1 text-xs text-neutral-500">{t("budgetTitre")}</div>
                <div className="text-xl font-bold text-neutral-900 tabular-nums">
                  {projet.budgetInitial !== null
                    ? formaterMontantCourt(projet.budgetInitial)
                    : t("budgetNonDefini")}
                </div>
              </div>

              <div className={KPI_BOITE}>
                <div className="mb-1 text-xs text-neutral-500">{t("metriquesTitre")}</div>
                <div className="text-xl font-bold text-neutral-900 tabular-nums">
                  {formaterMontantCourt(projet.budgetConsomme)}
                </div>
              </div>
            </div>
          </Carte>

          {/* Section Planning & Client */}
          <Carte>
            <div className={CARTE_ENTETE}>
              <div className={CARTE_TITRE}>
                <CalendarBlank size={18} style={{ color: "var(--color-neutral-700, #4F4C47)" }} />
                <span>{t("planningTitre")}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 text-sm text-neutral-800">
              <div className="flex items-start gap-2">
                <CalendarBlank size={16} className="mt-0.5 shrink-0 text-primary-500" />
                <span>
                  {t("dates", {
                    debut: projet.dateDebutPrevue,
                    fin: projet.dateFinPrevue,
                  })}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <BuildingOffice size={16} className="mt-0.5 shrink-0 text-primary-500" />
                <span>
                  <strong>{t("clientTitre")} : </strong>
                  {projet.client.raisonSociale} (
                  {afficherTelephone(projet.client.telephone ?? "") ||
                    projet.client.email ||
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
        <div className={COLONNE}>
          <div className="flex flex-col gap-4 rounded-lg border-2 border-primary-300 bg-gradient-to-b from-neutral-0 to-primary-50 p-5">
            <div className={CARTE_ENTETE}>
              <div className={CARTE_TITRE}>
                <span>{t("encartCpTitre")}</span>
              </div>
              <Badge variante={lead?.statut === "INVITE" ? "avertissement" : "succes"}>
                {lead?.statut ?? "ACTIF"}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-primary-400 text-lg font-bold text-neutral-0 shadow-[0_2px_4px_rgb(0_0_0/0.1)]">{initialesCp}</div>
              <div className="flex flex-col gap-0.5">
                <div className="text-base font-bold text-neutral-900">{lead?.nomComplet || lead?.email || ""}</div>
                <div className="text-xs text-neutral-600">{t("encartCpSousTitre")}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-0/70 p-3 text-[13px] text-neutral-700">
              <div className="flex items-center gap-2">
                <Envelope size={16} style={{ color: "var(--color-neutral-500, #8A8680)" }} />
                <span>{t("email")} </span>
                <a
                  href={`mailto:${lead?.email}`}
                  style={{ color: "var(--color-primary-600, #B85522)", textDecoration: "none" }}
                >
                  {lead?.email}
                </a>
              </div>

              <div className="flex items-center gap-2">
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
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-3 text-sm font-semibold text-neutral-0 no-underline shadow-[0_2px_4px_rgb(37_211_102/0.25)] transition-[background-color,transform] hover:-translate-y-px hover:bg-[#1EBE5D] active:translate-y-0"
              >
                <WhatsappLogo size={20} weight="fill" />
                <span>{t("actionWhatsApp")}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

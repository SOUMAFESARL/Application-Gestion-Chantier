"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { SyntheseQhse as DonneesQhse } from "@/features/tableauDeBord";
import { cn } from "@/lib/utils";

import { BLOC, BLOC_CORPS, BLOC_ENTETE, BLOC_SOUS_TITRE, BLOC_TITRE } from "./classes";

const CASE = "flex flex-col gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3";
const CASE_VALEUR = "text-h3 font-bold tabular-nums";
const CASE_LIBELLE = "text-xs text-neutral-600";

/**
 * La sécurité et la qualité, à l'échelle de l'entreprise — CDC module 8 et
 * KPI « taux d'incidents chantier » du module 12.
 *
 * Un accident dans le mois se lit en rouge **même si** le reste est sain :
 * c'est le seul chiffre de l'écran qui ne se rattrape pas.
 */
export function SyntheseQhse({ qhse }: { qhse: DonneesQhse }) {
  const t = useTranslations("tableauDeBord.qhse");

  const cases = [
    {
      cle: "joursSansAccident",
      valeur: qhse.joursSansAccident,
      alerte: qhse.accidentsMois > 0,
    },
    { cle: "accidents", valeur: qhse.accidentsMois, alerte: qhse.accidentsMois > 0 },
    { cle: "presqueAccidents", valeur: qhse.presqueAccidentsMois, alerte: false },
    { cle: "ncOuvertes", valeur: qhse.nonConformitesOuvertes, alerte: qhse.nonConformitesEnRetard > 0 },
  ] as const;

  return (
    <section className={BLOC}>
      <header className={BLOC_ENTETE}>
        <div>
          <h2 className={BLOC_TITRE}>{t("titre")}</h2>
          <p className={BLOC_SOUS_TITRE}>{t("sousTitre")}</p>
        </div>
      </header>

      <div className={cn(BLOC_CORPS, "flex flex-col gap-3")}>
        <div className="grid grid-cols-2 gap-3">
          {cases.map((caseQhse) => (
            <div key={caseQhse.cle} className={CASE}>
              <span className={cn(CASE_VALEUR, caseQhse.alerte ? "text-erreur" : "text-neutral-900")}>
                {caseQhse.valeur}
              </span>
              <span className={CASE_LIBELLE}>{t(caseQhse.cle)}</span>
            </div>
          ))}
        </div>
        <p
          className={cn(
            "text-xs font-medium",
            qhse.nonConformitesEnRetard > 0 ? "text-avertissement" : "text-succes",
          )}
        >
          {t("ncEnRetard", { n: qhse.nonConformitesEnRetard })}
        </p>
        <Link
          href="/qhse"
          className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-primary-600 no-underline hover:text-primary-700 hover:underline"
        >
          {t("voir")}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

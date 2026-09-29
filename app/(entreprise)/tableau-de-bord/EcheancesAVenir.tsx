"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui";
import { ECHEANCE_PROCHE_JOURS, echeancesAVenir, joursAvant } from "@/features/tableauDeBord";
import type { Echeance } from "@/features/tableauDeBord";
import { formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  BLOC,
  BLOC_CORPS,
  BLOC_ENTETE,
  BLOC_SOUS_TITRE,
  BLOC_TITRE,
  BLOC_VIDE,
  LIGNE_LISTE,
  PROJET_DETAIL,
} from "./classes";

/**
 * Ce qui tombe dans les trente prochains jours : réceptions de travaux,
 * démarrages, fins de contrat, cautions, situations de travaux.
 *
 * Le CDC (module 9) demande des alertes « en cas d'échéance contractuelle
 * approchante » ; une alerte prévient la veille, une liste d'échéances
 * prévient le mois d'avant — c'est elle qui laisse au DG le temps d'agir.
 */
export function EcheancesAVenir({ echeances }: { echeances: Echeance[] }) {
  const t = useTranslations("tableauDeBord.echeances");
  const lignes = echeancesAVenir(echeances);

  return (
    <section className={BLOC}>
      <header className={BLOC_ENTETE}>
        <div>
          <h2 className={BLOC_TITRE}>{t("titre")}</h2>
          <p className={BLOC_SOUS_TITRE}>{t("sousTitre")}</p>
        </div>
      </header>

      <div className={BLOC_CORPS}>
        {lignes.length === 0 ? (
          <p className={BLOC_VIDE}>{t("aucune")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {lignes.map((echeance) => {
              const jours = joursAvant(echeance.date);
              const proche = jours <= ECHEANCE_PROCHE_JOURS;

              return (
                <li key={echeance.id} className={LIGNE_LISTE}>
                  <div
                    className={cn(
                      "flex w-14 shrink-0 flex-col items-center rounded-md border px-1 py-1.5 text-center",
                      proche
                        ? "border-primary-200 bg-primary-50 text-primary-700"
                        : "border-neutral-200 bg-neutral-50 text-neutral-700",
                    )}
                  >
                    <span className="text-[11px] leading-tight font-semibold">
                      {t("dans", { jours })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{echeance.libelle}</p>
                    {echeance.chantierId ? (
                      <Link
                        href={`/projets/${echeance.chantierId}`}
                        className={cn(PROJET_DETAIL, "no-underline hover:text-primary-600 hover:underline")}
                      >
                        {echeance.chantierNom}
                      </Link>
                    ) : (
                      <span className={PROJET_DETAIL}>{echeance.chantierNom}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variante="neutre">{t(`types.${echeance.type}`)}</Badge>
                    <span className={cn(PROJET_DETAIL, "tabular-nums")}>{formaterDate(echeance.date)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

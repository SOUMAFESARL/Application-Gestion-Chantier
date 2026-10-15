"use client";

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";

import { EtatChargement } from "@/components/ui";
import { lireHistoriqueDates } from "@/features/projets/adaptateur";
import { cleHistoriqueDates } from "@/features/projets/cles";
import { formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  objet: "lots" | "activites";
  id: string;
}

/**
 * Liste courte de traçabilité des reports de dates pour un lot ou une activité.
 * Affichée dans le tiroir de modification (US 3.8).
 */
export function HistoriqueDatesCourt({ objet, id }: Props) {
  const t = useTranslations("projets.reprogrammation");

  const requete = useQuery({
    queryKey: cleHistoriqueDates(objet, id),
    queryFn: ({ signal }) => lireHistoriqueDates(objet, id, signal),
    enabled: Boolean(id),
  });

  const evenements = requete.data ?? [];

  if (requete.isPending) return <EtatChargement />;
  if (evenements.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
        <History className="size-3.5 text-neutral-500" aria-hidden="true" />
        <span>{t("historiqueTitre")}</span>
      </div>

      <ul className="m-0 flex flex-col gap-2 p-0 list-none">
        {evenements.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-1 border-b border-neutral-100 pb-2 last:border-b-0 last:pb-0 text-xs text-neutral-600"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-neutral-900">
                {t("transitionDates", { avant: formaterDate(e.avant), apres: formaterDate(e.apres) })}
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  (e.ecartJours ?? 0) > 0 ? "text-amber-600" : "text-neutral-500",
                )}
              >
                {t("ecartJours", { jours: e.ecartJours ?? 0 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-500">
              <span>{e.motif}</span>
              <span>{t("auteurEtDate", { auteur: e.auteur, date: formaterDate(e.le) })}</span>
            </div>
            {e.justification && (
              <p className="m-0 italic text-neutral-500 text-[11px] line-clamp-2" title={e.justification}>
                {t("citation", { texte: e.justification })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

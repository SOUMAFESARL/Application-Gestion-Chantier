"use client";

import { Flag, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";

import { JOURS_SEMAINE, joursDuMois, libelleDuJour } from "@/features/calendrier";
import type { Calendrier, MoisAffiche, StatutJour } from "@/features/calendrier";
import { cn } from "@/lib/utils";

interface Props {
  mois: MoisAffiche;
  calendrier: Calendrier;
  /** Le jour d'aujourd'hui, `AAAA-MM-JJ` : il est cerclé dans la grille. */
  aujourdhui: string;
  /** Avec le droit d'écriture, un jour se clique ; sans, la grille se lit seulement. */
  peutGerer: boolean;
  onChoisir: (date: string) => void;
}

/**
 * Le fond d'un jour dit **pourquoi** il est ce qu'il est — mais la couleur ne
 * porte jamais seule l'information (charte §8.4) : l'état s'écrit aussi en
 * toutes lettres, et l'explication complète est dans le nom accessible.
 */
function tonDuJour(jour: StatutJour): string {
  if (jour.raison === "EXCEPTION") return "border-primary-300 bg-primary-50";
  if (jour.raison === "FERIE") return "border-avertissement/40 bg-avertissement/12";
  return jour.ouvre ? "border-neutral-200 bg-neutral-0" : "border-neutral-200 bg-neutral-100";
}

/** La case d'un jour : son fond, et le cercle qui repère aujourd'hui. */
function classeDeLaCase(jour: StatutJour, estAujourdhui: boolean): string {
  return cn(
    "flex min-h-16 min-w-0 flex-col items-start gap-0.5 rounded-md border p-1.5 text-left text-xs sm:min-h-20 sm:p-2",
    tonDuJour(jour),
    estAujourdhui && "ring-2 ring-primary-500",
  );
}

/** Les pastilles de la légende, avec le fond de la case qu'elles décrivent. */
const PASTILLES_LEGENDE = [
  { cle: "ouvre", ton: "border-neutral-200 bg-neutral-0" },
  { cle: "nonOuvre", ton: "border-neutral-200 bg-neutral-100" },
  { cle: "ferie", ton: "border-avertissement/40 bg-avertissement/12" },
  { cle: "exception", ton: "border-primary-300 bg-primary-50" },
] as const;

/**
 * La vue du mois : sept colonnes du lundi au dimanche, un jour par case, avec
 * son état (ouvré ou non) et sa raison (semaine type, férié national, exception).
 */
export function GrilleMois({ mois, calendrier, aujourdhui, peutGerer, onChoisir }: Props) {
  const t = useTranslations("calendrier");
  const { decalage, jours } = joursDuMois(mois, calendrier);

  function raison(jour: StatutJour): string {
    if (jour.raison === "EXCEPTION") return t("raison.exception", { motif: jour.libelle ?? "" });
    if (jour.raison === "FERIE") return t("raison.ferie", { libelle: jour.libelle ?? "" });
    return t("raison.semaineType");
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={t("grille.aria")}>
        {JOURS_SEMAINE.map((nom) => (
          <div
            key={nom}
            role="columnheader"
            className="pb-1 text-center text-xs font-semibold text-neutral-600"
          >
            {t(`joursCourts.${nom}`)}
          </div>
        ))}

        {Array.from({ length: decalage }, (_, rang) => (
          <div key={`vide-${rang}`} aria-hidden="true" />
        ))}

        {jours.map((jour) => {
          const numero = Number(jour.date.slice(8));
          const etat = jour.ouvre ? t("etat.ouvre") : t("etat.nonOuvre");
          const nom = `${libelleDuJour(jour.date)} — ${etat}. ${raison(jour)}`;
          const classes = classeDeLaCase(jour, jour.date === aujourdhui);
          const contenu = (
            <>
              <span className="flex w-full items-center justify-between gap-1">
                <span className="text-sm font-semibold text-neutral-900">{numero}</span>
                {jour.raison === "EXCEPTION" && (
                  <PencilLine className="size-3.5 text-primary-600" aria-hidden="true" />
                )}
                {jour.raison === "FERIE" && (
                  <Flag className="size-3.5 text-avertissement" aria-hidden="true" />
                )}
              </span>
              {!jour.ouvre && <span className="font-medium text-neutral-700">{etat}</span>}
              {jour.libelle && (
                <span className="hidden w-full break-words text-neutral-600 sm:line-clamp-2">
                  {jour.libelle}
                </span>
              )}
            </>
          );

          return peutGerer ? (
            <button
              key={jour.date}
              type="button"
              role="gridcell"
              aria-label={nom}
              title={nom}
              onClick={() => onChoisir(jour.date)}
              className={cn(
                classes,
                "cursor-pointer appearance-none hover:border-primary-500 focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none",
              )}
            >
              {contenu}
            </button>
          ) : (
            <div key={jour.date} role="gridcell" aria-label={nom} title={nom} className={classes}>
              {contenu}
            </div>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600">
        {PASTILLES_LEGENDE.map(({ cle, ton }) => (
          <li key={cle} className="flex items-center gap-2">
            <span className={cn("size-4 rounded-sm border", ton)} aria-hidden="true" />
            {t(`legende.${cle}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

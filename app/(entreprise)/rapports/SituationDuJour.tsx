"use client";

import { AlarmClock, ArrowRight, CalendarOff } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { EtatVide } from "@/components/ui";
import {
  HEURE_ALERTE_NON_SOUMIS,
  HEURE_ESCALADE,
  aUnDocument,
  estDepose,
  estManquant,
  grouperParChantier,
  joursSansRapport,
  retardPoints,
  tauxPresence,
} from "@/features/chantier";
import type { EntreeJournal, Journal } from "@/features/chantier";
import { formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BLOC } from "./classes";
import { BadgeSituation, BoutonRelance, CircuitCompact } from "./composants";

/**
 * L'onglet « Aujourd'hui » : un lot actif, une carte — rangées par chantier,
 * le chantier qui a le plus de rapports manquants en tête, et dans chaque
 * chantier ce qui manque avant ce qui est clos.
 *
 * Une carte dit ce que le DG veut savoir d'un coup d'œil : le rapport est-il
 * là, que dit-il (présence, avancement contre planning, incidents, blocages),
 * et où en est sa signature. Un lot sans rapport dit depuis quand, et se
 * relance.
 */
export function SituationDuJour({ journal }: { journal: Journal }) {
  const t = useTranslations("journal.jour");
  const duJour = journal.entrees.filter((entree) => entree.date === journal.aujourdhui);

  if (duJour.length === 0) {
    return (
      <EtatVide
        icone={<CalendarOff className="size-8" aria-hidden="true" />}
        titre={t("videTitre")}
        description={t("videDescription")}
      />
    );
  }

  const groupes = grouperParChantier(duJour);

  return (
    <div className="flex flex-col gap-6">
      {groupes.map((groupe) => {
        const deposes = groupe.entrees.filter((entree) => estDepose(entree.situation)).length;
        return (
          <section key={groupe.projetId} aria-labelledby={`chantier-${groupe.projetId}`} className="flex flex-col gap-3">
            <header className="flex items-center gap-3">
              <h2 id={`chantier-${groupe.projetId}`} className="m-0 min-w-0 text-base font-semibold text-neutral-900">
                <Link href={`/projets/${groupe.projetId}`} className="text-inherit no-underline hover:text-primary-600 hover:underline">
                  {groupe.projetNom}
                </Link>
              </h2>
              <span className="h-px min-w-6 flex-1 bg-neutral-200" aria-hidden="true" />
              <span className="shrink-0 text-xs text-neutral-600">
                {t("deposesChantier", { deposes, total: groupe.entrees.length })}
              </span>
            </header>
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groupe.entrees.map((entree) => (
                <CarteLot key={entree.id} entree={entree} aujourdhui={journal.aujourdhui} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="m-0 flex items-start gap-2 rounded-lg border border-information/20 bg-information-fond px-4 py-3 text-sm text-neutral-700">
        <AlarmClock className="mt-0.5 size-4 shrink-0 text-information" aria-hidden="true" />
        <span>{t("alerteAutomatique", { heure: HEURE_ALERTE_NON_SOUMIS, escalade: HEURE_ESCALADE })}</span>
      </p>
    </div>
  );
}

function Ligne({ libelle, children, alerte = false }: { libelle: string; children: ReactNode; alerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-neutral-500">{libelle}</dt>
      <dd className={cn("m-0 text-right font-medium tabular-nums", alerte ? "text-erreur" : "text-neutral-800")}>
        {children}
      </dd>
    </div>
  );
}

function CarteLot({ entree, aujourdhui }: { entree: EntreeJournal; aujourdhui: string }) {
  const t = useTranslations("journal.jour");
  const tMode = useTranslations("projets.tiroirCreation.modeExecution");
  const manquant = estManquant(entree.situation);
  const retard = retardPoints(entree);
  const presence = tauxPresence(entree.effectifPresent, entree.effectifPrevu);
  const silence = joursSansRapport(entree);

  return (
    <article className={BLOC}>
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-3 py-2">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-sm font-semibold text-neutral-900">
            {t("titreLot", { code: entree.lot.code, nom: entree.lot.nom })}
          </h3>
          <p className="m-0 mt-0.5 text-xs text-neutral-500">{tMode(entree.lot.modeExecution)}</p>
        </div>
        <BadgeSituation situation={entree.situation} />
      </header>

      <div className="flex flex-col gap-2 px-3 py-2">
        <dl className="m-0 flex flex-col gap-1">
          <Ligne libelle={t("chefChantier")}>{entree.lot.chefChantier}</Ligne>
          {manquant ? (
            <Ligne libelle={t("dernierRapport")} alerte={silence !== null && silence > 1}>
              {entree.dernierRapportLe
                ? t("dernierRapportLe", { date: formaterDate(entree.dernierRapportLe), jours: silence ?? 0 })
                : t("jamais")}
            </Ligne>
          ) : (
            <>
              <Ligne libelle={t("effectifs")}>
                {entree.effectifPresent === null
                  ? t("nonRenseigne")
                  : t("effectifsValeur", {
                      presents: entree.effectifPresent,
                      prevus: entree.effectifPrevu ?? 0,
                      taux: presence ?? 0,
                    })}
              </Ligne>
              <Ligne libelle={t("avancement")} alerte={retard !== null && retard >= 10}>
                {entree.avancementLot === null
                  ? t("nonRenseigne")
                  : t("avancementValeur", {
                      reel: entree.avancementLot,
                      theorique: entree.avancementTheorique ?? 0,
                    })}
              </Ligne>
              <Ligne libelle={t("incidents")} alerte={(entree.incidents ?? 0) > 0}>
                {entree.incidents ?? 0}
              </Ligne>
              <Ligne libelle={t("blocages")} alerte={(entree.blocages ?? 0) > 0}>
                {entree.blocages ?? 0}
              </Ligne>
            </>
          )}
        </dl>

        {entree.noteChefChantier && !manquant && (
          <p className="m-0 line-clamp-2 border-l-2 border-neutral-200 pl-2 text-xs text-neutral-600 italic">
            {entree.noteChefChantier}
          </p>
        )}

        {!manquant && <CircuitCompact circuit={entree.circuit} aujourdhui={aujourdhui} />}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-3 py-2">
        {manquant ? (
          <BoutonRelance entree={entree} libelle={t("relancerChef")} aujourdhui={aujourdhui} />
        ) : (
          <span className="text-xs text-neutral-500">{entree.reference}</span>
        )}
        {aUnDocument(entree) && (
          <Link
            href={`/rapports/${entree.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 no-underline hover:underline"
          >
            {t("voirRapport")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </footer>
    </article>
  );
}

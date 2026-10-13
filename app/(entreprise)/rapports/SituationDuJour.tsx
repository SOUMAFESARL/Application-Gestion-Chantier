"use client";

import { AlarmClock, ArrowRight, CalendarOff, FilePen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Bouton, EtatVide } from "@/components/ui";
import {
  HEURE_ALERTE_NON_SOUMIS,
  HEURE_ESCALADE,
  aUnDocument,
  codesLots,
  comparerSituations,
  estDepose,
  estManquant,
  joursSansRapport,
  retardPoints,
  tauxPresence,
} from "@/features/chantier";
import type { EntreeJournal, Journal } from "@/features/chantier";
import { formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BLOC } from "./classes";
import { BadgeSituation, BoutonRelance, CircuitCompact, horodatageCourt } from "./composants";
import { CircuitSignatures } from "./document";

/**
 * L'onglet « Aujourd'hui » : un chantier, une carte — le rapport du jour
 * couvre tout le chantier, quels que soient les lots travaillés. Ce qui
 * manque d'abord, puis ce qui attend, enfin ce qui est clos.
 *
 * Une carte dit ce que le DG veut savoir d'un coup d'œil : le rapport est-il
 * là, quels lots il couvre, que dit-il (présence, avancement contre planning,
 * incidents, blocages), et où en est sa signature. Un chantier sans rapport
 * dit depuis quand, et se relance.
 *
 * Celui qui rédige (le chef de chantier) n'a rien à relancer : l'onglet lui
 * dit s'il a déposé son rapport du jour, et où en est sa signature.
 */
export function SituationDuJour({ journal, peutRediger }: { journal: Journal; peutRediger: boolean }) {
  const t = useTranslations("journal.jour");
  const duJour = journal.entrees.filter((entree) => entree.date === journal.aujourdhui);

  if (peutRediger) return <JourDuRedacteur duJour={duJour} aujourdhui={journal.aujourdhui} />;

  if (duJour.length === 0) {
    return (
      <EtatVide
        icone={<CalendarOff className="size-8" aria-hidden="true" />}
        titre={t("videTitre")}
        description={t("videDescription")}
      />
    );
  }

  const deposes = duJour.filter((entree) => estDepose(entree.situation)).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-neutral-600">{t("deposesChantiers", { deposes, total: duJour.length })}</p>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[...duJour].sort(comparerSituations).map((entree) => (
          <CarteChantier key={entree.id} entree={entree} aujourdhui={journal.aujourdhui} />
        ))}
      </div>

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

/** Les lots dont parle le rapport — ou, sans rapport, la référence du chantier. */
function SousTitreChantier({ entree }: { entree: EntreeJournal }) {
  const t = useTranslations("journal.jour");
  return (
    <p className="m-0 mt-0.5 text-xs text-neutral-500">
      {entree.lots.length > 0
        ? t("lotsTravailles", { n: entree.lots.length, codes: codesLots(entree.lots) })
        : entree.chantier.projetReference}
    </p>
  );
}

function CarteChantier({ entree, aujourdhui }: { entree: EntreeJournal; aujourdhui: string }) {
  const t = useTranslations("journal.jour");
  const manquant = estManquant(entree.situation);
  const retard = retardPoints(entree);
  const presence = tauxPresence(entree.effectifPresent, entree.effectifPrevu);
  const silence = joursSansRapport(entree);

  return (
    <article className={BLOC}>
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-3 py-2">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-sm font-semibold text-neutral-900">
            <Link
              href={`/projets/${entree.chantier.projetId}`}
              className="text-inherit no-underline hover:text-primary-600 hover:underline"
            >
              {entree.chantier.projetNom}
            </Link>
          </h3>
          <SousTitreChantier entree={entree} />
        </div>
        <BadgeSituation situation={entree.situation} />
      </header>

      <div className="flex flex-col gap-2 px-3 py-2">
        <dl className="m-0 flex flex-col gap-1">
          <Ligne libelle={t("chefChantier")}>{entree.chantier.chefChantier}</Ligne>
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
                {entree.avancement === null
                  ? t("nonRenseigne")
                  : t("avancementValeur", {
                      reel: entree.avancement,
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

/**
 * Le jour vu du chef de chantier : tant qu'aucun rapport n'est déposé, le
 * seul geste utile est de le rédiger ; ensuite, le récapitulatif de ce qu'il
 * a soumis et le circuit CC → CT → CP en entier.
 */
function JourDuRedacteur({ duJour, aujourdhui }: { duJour: EntreeJournal[]; aujourdhui: string }) {
  const t = useTranslations("journal.jour.redacteur");
  const router = useRouter();
  const deposes = duJour.filter((entree) => estDepose(entree.situation));
  const restants = duJour.length - deposes.length;

  const boutonRediger = (
    <Bouton
      variante="primaire"
      iconeGauche={<FilePen className="size-4" aria-hidden="true" />}
      onClick={() => router.push("/rapports/saisie")}
    >
      {t("rediger")}
    </Bouton>
  );

  if (deposes.length === 0) {
    return (
      <EtatVide
        icone={<FilePen className="size-8" aria-hidden="true" />}
        titre={t("videTitre")}
        description={t("videDescription", { heure: HEURE_ALERTE_NON_SOUMIS })}
        action={boutonRediger}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {restants > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-avertissement/20 bg-avertissement-fond px-4 py-3">
          <span className="text-sm text-neutral-700">
            {t("restants", { n: restants, heure: HEURE_ALERTE_NON_SOUMIS })}
          </span>
          {boutonRediger}
        </div>
      )}
      {deposes.map((entree) => (
        <RecapRapport key={entree.id} entree={entree} aujourdhui={aujourdhui} />
      ))}
    </div>
  );
}

/** Le récapitulatif d'un rapport soumis : ses chiffres, sa note, ses signatures. */
function RecapRapport({ entree, aujourdhui }: { entree: EntreeJournal; aujourdhui: string }) {
  const t = useTranslations("journal.jour");
  const tRecap = useTranslations("journal.jour.redacteur");
  const retard = retardPoints(entree);
  const presence = tauxPresence(entree.effectifPresent, entree.effectifPrevu);

  return (
    <article className={BLOC}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold text-neutral-900">{entree.chantier.projetNom}</h2>
          <SousTitreChantier entree={entree} />
          <p className="m-0 mt-0.5 text-xs text-neutral-500">
            {tRecap("sousTitre", {
              chantier: entree.chantier.projetReference,
              reference: entree.reference ?? "aucune",
              quand: entree.soumisLe ? horodatageCourt(entree.soumisLe, aujourdhui) : "aucun",
            })}
          </p>
        </div>
        <BadgeSituation situation={entree.situation} />
      </header>

      <div className="flex flex-col gap-4 px-4 py-3">
        <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
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
            {entree.avancement === null
              ? t("nonRenseigne")
              : t("avancementValeur", { reel: entree.avancement, theorique: entree.avancementTheorique ?? 0 })}
          </Ligne>
          <Ligne libelle={t("incidents")} alerte={(entree.incidents ?? 0) > 0}>
            {entree.incidents ?? 0}
          </Ligne>
          <Ligne libelle={t("blocages")} alerte={(entree.blocages ?? 0) > 0}>
            {entree.blocages ?? 0}
          </Ligne>
        </dl>

        {entree.noteChefChantier && (
          <p className="m-0 border-l-2 border-neutral-200 pl-2 text-sm text-neutral-600 italic">
            {entree.noteChefChantier}
          </p>
        )}

        <section aria-labelledby={`circuit-${entree.id}`} className="flex flex-col gap-2">
          <h3 id={`circuit-${entree.id}`} className="m-0 text-sm font-semibold text-neutral-800">
            {tRecap("circuit")}
          </h3>
          <CircuitSignatures circuit={entree.circuit} />
        </section>
      </div>

      <footer className="flex justify-end border-t border-neutral-100 px-4 py-2">
        <Link
          href={`/rapports/${entree.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 no-underline hover:underline"
        >
          {t("voirRapport")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </footer>
    </article>
  );
}

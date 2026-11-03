"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, FileCheck2, MapPin } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { Badge, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { jourDe, jourSaisissable, rapportModifiable } from "@/features/chantier";
import type { PreparationSaisie } from "@/features/chantier";
import { preparerSaisie } from "@/features/chantier/adaptateur";
import { clePreparation } from "@/features/chantier/cles";
import { AccesNonAutorise, peutRedigerJournal, projetVisible, useDroits } from "@/features/habilitations";
import { lireProjet } from "@/features/projets/adaptateur";
import { cleProjet } from "@/features/projets/cles";
import { ErreurApi } from "@/lib/api";

import { FormulaireRapport } from "../FormulaireRapport";

/**
 * Le rapport journalier d'un chantier pour un jour ouvré, côté rédacteur.
 *
 * Lit le chantier puis la préparation du formulaire (feuilles attendues de l'arbre,
 * équipes du jour, météo suggérée, calendrier d'entreprise). Un rapport rejeté reste
 * toujours corrigeable ; un jour non ouvré sans rapport n'attend aucune saisie.
 */
export function EcranSaisie({ projetId, date: demandee }: { projetId: string; date: string | null }) {
  const t = useTranslations("journal.saisie");
  const { droits } = useDroits();

  const date = demandee ?? jourDe(new Date());

  const projet = useQuery({ queryKey: cleProjet(projetId), queryFn: () => lireProjet(projetId) });

  const preparation = useQuery({
    queryKey: clePreparation(projetId, date),
    queryFn: ({ signal }) => preparerSaisie(projetId, date, signal),
    enabled: projet.isSuccess,
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (!peutRedigerJournal(droits)) return <AccesNonAutorise />;
  if (projet.isPending || preparation.isPending) return <EtatChargement />;
  if (projet.isError) {
    return <EtatErreur message={t("erreurChargement")} onReessayer={() => void projet.refetch()} />;
  }
  if (!projetVisible(projet.data, droits)) return <AccesNonAutorise />;
  if (preparation.isError) {
    const message =
      preparation.error instanceof ErreurApi && preparation.error.message
        ? preparation.error.message
        : t("erreurChargement");
    return <EtatErreur message={message} onReessayer={() => void preparation.refetch()} />;
  }

  const donnees = preparation.data;
  const retourListe = `/rapports/saisie?date=${date}&projet=${projetId}`;
  const haut = <HautSaisie preparation={donnees} retour={retourListe} />;
  const titre = <TitreSaisie preparation={donnees} date={date} ville={projet.data.ville} />;
  const entete = (
    <header className="flex flex-col gap-3">
      {haut}
      {titre}
    </header>
  );

  const rapport = donnees.rapport;
  const estRejete = rapport?.statut === "REJETE";

  if (!estRejete && !donnees.estJourOuvre && !rapport) {
    return (
      <div className="flex w-full flex-col gap-4">
        {entete}
        <EtatVide
          icone={<CalendarDays className="size-8" aria-hidden="true" />}
          titre={t("jourNonOuvre.titre")}
          description={t("jourNonOuvre.description")}
          action={
            <Button asChild>
              <Link href={`/rapports/saisie?projet=${projetId}`}>{t("jourNonOuvre.action")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!estRejete && !jourSaisissable(date, donnees.aujourdhui, donnees.joursSaisissables)) {
    const dernierJourOuvre = donnees.joursSaisissables[0] ?? donnees.aujourdhui;
    return (
      <div className="flex w-full flex-col gap-4">
        {entete}
        <EtatVide
          titre={t("horsDelai.titre")}
          description={t("horsDelai.description")}
          action={
            <Button asChild>
              <Link href={`/rapports/saisie/${projetId}?date=${dernierJourOuvre}`}>
                {t("horsDelai.action")}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (donnees.lots.length === 0) {
    return (
      <div className="flex w-full flex-col gap-4">
        {entete}
        <EtatVide titre={t("aucunLot.titre")} description={t("aucunLot.description")} />
      </div>
    );
  }

  if (rapport && !rapportModifiable(rapport.statut)) {
    return (
      <div className="flex w-full flex-col gap-4">
        {entete}
        <EtatVide
          icone={<FileCheck2 className="size-8 text-succes" aria-hidden="true" />}
          titre={t("dejaSoumis.titre")}
          description={t("dejaSoumis.description")}
          action={
            <Button asChild>
              <Link href={`/rapports/${rapport.id}`}>{t("dejaSoumis.action")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <FormulaireRapport
        key={`${projetId}-${date}`}
        preparation={donnees}
        date={date}
        entete={haut}
        titre={titre}
      />
    </div>
  );
}

function HautSaisie({
  preparation,
  retour,
}: {
  preparation: PreparationSaisie;
  retour: string;
}) {
  const t = useTranslations("journal.saisie");
  const { lots, rapport } = preparation;
  const statut = rapport?.statut === "REJETE" ? "REJETE" : rapport ? "BROUILLON" : "NOUVEAU";
  return (
    <div className="flex flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href={retour}>
          <ArrowLeft aria-hidden="true" />
          {t("retourRapports")}
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variante={statut === "REJETE" ? "erreur" : statut === "BROUILLON" ? "avertissement" : "neutre"}>
          {t(`statuts.${statut}`)}
        </Badge>
        {lots.length > 0 && <Badge variante="information">{t("lotsCouverts", { n: lots.length })}</Badge>}
      </div>
    </div>
  );
}

function TitreSaisie({
  preparation,
  date,
  ville,
}: {
  preparation: PreparationSaisie;
  date: string;
  ville: string;
}) {
  const format = useFormatter();
  return (
    <div className="flex flex-col gap-1">
      <h1 className="m-0 text-h3 font-semibold text-neutral-900">{preparation.projet.nom}</h1>
      <p className="m-0 flex flex-wrap items-center gap-x-2 text-sm text-neutral-600">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {format.dateTime(new Date(`${date}T00:00:00Z`), {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </span>
        {ville && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            {ville}
          </span>
        )}
      </p>
    </div>
  );
}

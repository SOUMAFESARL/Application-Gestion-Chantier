"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, FileCheck2, MapPin } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { jourDe, jourSaisissable, rapportModifiable } from "@/features/chantier";
import type { PreparationSaisie } from "@/features/chantier";
import { preparerSaisie } from "@/features/chantier/adaptateur";
import { clePreparation } from "@/features/chantier/cles";
import { lireProfilLocal } from "@/features/auth/api";
import { AccesNonAutorise, peutRedigerJournal, projetVisible, useDroits } from "@/features/habilitations";
import { listerLots, lireProjet, obtenirMeteo } from "@/features/projets/adaptateur";
import { cleLots, cleProjet } from "@/features/projets/cles";
import { ErreurApi } from "@/lib/api";

import { FormulaireRapport } from "../FormulaireRapport";

/**
 * Le rapport journalier d'un chantier pour un jour, côté chef de chantier.
 *
 * Lit le chantier et ses lots (les vrais, `/projets/{id}/lots/`), puis la
 * préparation du formulaire, qui couvre tous les lots en cours. Un rapport
 * déjà soumis ne se rouvre pas : on renvoie à sa lecture (RG-F2-03).
 */
export function EcranSaisie({ projetId, date: demandee }: { projetId: string; date: string | null }) {
  const t = useTranslations("journal.saisie");
  const { droits } = useDroits();

  // Le jour du poste pour commencer ; la préparation renvoie celui du serveur.
  const date = demandee ?? jourDe(new Date());

  const projet = useQuery({ queryKey: cleProjet(projetId), queryFn: () => lireProjet(projetId) });
  const lots = useQuery({
    queryKey: cleLots(projetId),
    queryFn: ({ signal }) => listerLots(projetId, signal),
    enabled: projet.isSuccess,
  });

  const redacteur = useMemo(() => {
    const profil = lireProfilLocal();
    return profil ? `${profil.prenom} ${profil.nom}`.trim() : "";
  }, []);

  const preparation = useQuery({
    queryKey: clePreparation(projetId, date),
    queryFn: ({ signal }) => {
      if (!projet.data || !lots.data) throw new Error("contexte_absent");
      return preparerSaisie({ projet: projet.data, lots: lots.data, redacteur }, date, signal);
    },
    enabled: projet.isSuccess && lots.isSuccess,
    // Toujours relue à l'ouverture : un rejet du CT a pu tomber entre-temps.
    staleTime: 0,
    refetchOnMount: "always",
  });

  // La météo du chantier, pour préremplir le ciel du jour — jamais celui d'hier.
  const releve = useQuery({
    queryKey: ["chantier", "saisie", "meteo", projetId],
    queryFn: () => obtenirMeteo({ projetId }),
    enabled: preparation.isSuccess && date === preparation.data.aujourdhui,
    staleTime: 15 * 60_000,
    retry: false,
  });

  if (!peutRedigerJournal(droits)) return <AccesNonAutorise />;
  if (projet.isPending || lots.isPending || preparation.isPending) return <EtatChargement />;
  if (projet.isError || lots.isError) {
    return <EtatErreur message={t("erreurChargement")} onReessayer={() => void (projet.isError ? projet.refetch() : lots.refetch())} />;
  }
  if (!projetVisible(projet.data, droits)) return <AccesNonAutorise />;
  if (preparation.isError) {
    const message =
      preparation.error instanceof ErreurApi && preparation.error.message ? preparation.error.message : t("erreurChargement");
    return <EtatErreur message={message} onReessayer={() => void preparation.refetch()} />;
  }

  const donnees = preparation.data;
  const lien = (jour: string) => `/rapports/saisie/${projetId}?date=${jour}`;
  const haut = <HautSaisie preparation={donnees} retour={`/rapports/saisie?date=${date}&projet=${projetId}`} />;
  const titre = <TitreSaisie preparation={donnees} date={date} ville={projet.data.ville} />;
  const entete = (
    <header className="flex flex-col gap-3">
      {haut}
      {titre}
    </header>
  );

  if (!jourSaisissable(date, donnees.aujourdhui)) {
    return (
      <div className="flex w-full flex-col gap-4">
        {entete}
        <EtatVide
          titre={t("horsDelai.titre")}
          description={t("horsDelai.description")}
          action={
            <Button asChild>
              <Link href={lien(donnees.aujourdhui)}>{t("horsDelai.action")}</Link>
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

  const rapport = donnees.rapport;
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
        releve={releve.data ?? null}
        entete={haut}
        titre={titre}
      />
    </div>
  );
}

/** Le retour à la liste et l'état du rapport — ils défilent avec la page. */
function HautSaisie({
  preparation,
  retour,
}: {
  preparation: PreparationSaisie;
  /** La liste des rapports, sur le même jour et le même chantier. */
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

/** Le chantier et le jour — collés en haut avec les étapes sur grand écran. */
function TitreSaisie({
  preparation,
  date,
  ville,
}: {
  preparation: PreparationSaisie;
  /** Le jour du rapport : il se choisit sur la liste, il se rappelle ici. */
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

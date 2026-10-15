"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { aideColonnes } from "@/components/ui/data-table";
import { EtatChargement, EtatErreur } from "@/components/ui";
import type { ExportTableau } from "@/components/ui/export-tableau";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { lireJournalReports } from "@/features/projets/adaptateur";
import { cleJournalReports } from "@/features/projets/cles";
import type { EvenementDate, Projet } from "@/features/projets/types";
import { formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const colonne = aideColonnes<EvenementDate>();

export function HistoriqueDatesProjet({ projet }: { projet: Projet }) {
  const t = useTranslations("projets.reprogrammation");
  const [recherche, setRecherche] = useState("");
  const [typeFiltre, setTypeFiltre] = useState<string>("");

  const requete = useQuery({
    queryKey: cleJournalReports(projet.id),
    queryFn: ({ signal }) => lireJournalReports(projet.id, signal),
  });

  const evenements = useMemo(() => requete.data ?? [], [requete.data]);

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return evenements.filter((e) => {
      if (typeFiltre && e.typeObjet !== typeFiltre) return false;
      if (!q) return true;
      return (
        e.objet.toLowerCase().includes(q) ||
        e.motif.toLowerCase().includes(q) ||
        e.justification.toLowerCase().includes(q) ||
        e.auteur.toLowerCase().includes(q)
      );
    });
  }, [evenements, recherche, typeFiltre]);

  const colonnes = useMemo(
    () => [
      colonne.display({
        id: "date",
        header: t("colonnes.date"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-neutral-600">
            {formaterDate(row.original.le)}
          </span>
        ),
      }),
      colonne.display({
        id: "type",
        header: t("colonnes.type"),
        cell: ({ row }) => (
          <Badge variante="neutre">
            {t(`typesObjet.${row.original.typeObjet}`)}
          </Badge>
        ),
      }),
      colonne.display({
        id: "objet",
        header: t("colonnes.objet"),
        cell: ({ row }) => (
          <span className="font-medium text-neutral-900 text-xs">
            {row.original.objet}
          </span>
        ),
      }),
      colonne.display({
        id: "avantApres",
        header: t("colonnes.apres"),
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap">
            {t("transitionDates", { avant: formaterDate(row.original.avant), apres: formaterDate(row.original.apres) })}
          </span>
        ),
      }),
      colonne.display({
        id: "ecart",
        header: t("colonnes.ecart"),
        cell: ({ row }) => {
          const ecart = row.original.ecartJours ?? 0;
          return (
            <span
              className={cn(
                "text-xs font-semibold tabular-nums whitespace-nowrap",
                ecart > 0 ? "text-amber-600" : "text-neutral-600",
              )}
            >
              {ecart > 0 ? `+${ecart} j` : `${ecart} j`}
            </span>
          );
        },
      }),
      colonne.display({
        id: "motif",
        header: t("colonnes.motif"),
        cell: ({ row }) => (
          <span className="text-xs text-neutral-800 font-medium">
            {row.original.motif}
          </span>
        ),
      }),
      colonne.display({
        id: "justification",
        header: t("colonnes.justification"),
        cell: ({ row }) => (
          <p
            className="text-xs text-neutral-600 max-w-xs truncate"
            title={row.original.justification}
          >
            {row.original.justification}
          </p>
        ),
      }),
      colonne.display({
        id: "auteur",
        header: t("colonnes.auteur"),
        meta: { classe: BORD_DROIT_TABLEAU },
        cell: ({ row }) => (
          <span className="text-xs text-neutral-600 whitespace-nowrap">
            {row.original.auteur}
          </span>
        ),
      }),
    ],
    [t],
  );

  const exporter: ExportTableau<EvenementDate> = useMemo(
    () => ({
      titre: t("historiqueTitre"),
      nomFichier: `historique-dates-${projet.reference}`,
      colonnes: [
        { entete: t("colonnes.date"), valeur: (e) => formaterDate(e.le) },
        { entete: t("colonnes.type"), valeur: (e) => t(`typesObjet.${e.typeObjet}`) },
        { entete: t("colonnes.objet"), valeur: (e) => e.objet },
        { entete: t("colonnes.avant"), valeur: (e) => formaterDate(e.avant) },
        { entete: t("colonnes.apres"), valeur: (e) => formaterDate(e.apres) },
        { entete: t("colonnes.ecart"), valeur: (e) => (e.ecartJours ? `${e.ecartJours} j` : "0 j") },
        { entete: t("colonnes.motif"), valeur: (e) => e.motif },
        { entete: t("colonnes.justification"), valeur: (e) => e.justification },
        { entete: t("colonnes.auteur"), valeur: (e) => e.auteur },
      ],
    }),
    [t, projet.reference],
  );

  const filtresActifs = Boolean(recherche || typeFiltre);

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) {
    return <EtatErreur onReessayer={() => void requete.refetch()} />;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-neutral-900">{t("historiqueTitre")}</h2>
        <p className="text-xs text-neutral-500">{t("historiqueDescription")}</p>
      </div>

      <TableauListe
        colonnes={colonnes}
        donnees={lignes}
        cleLigne={(ligne) => ligne.id}
        messageVide={t("historiqueVide")}
        filtresActifs={filtresActifs}
        onReinitialiser={() => {
          setRecherche("");
          setTypeFiltre("");
        }}
        cleCriteres={`${recherche}|${typeFiltre}`}
        exporter={exporter}
        outils={
          <>
            <RechercheTableau
              valeur={recherche}
              onChangement={setRecherche}
              libelle={t("colonnes.objet")}
              placeholder={t("placeholderRecherche")}
            />
            <FiltreTableau
              valeur={typeFiltre}
              onChangement={setTypeFiltre}
              libelle={t("colonnes.type")}
              libelleTous={t("tousLesTypes")}
              options={[
                { valeur: "PROJET", libelle: t("typesObjet.PROJET") },
                { valeur: "LOT", libelle: t("typesObjet.LOT") },
                { valeur: "ACTIVITE", libelle: t("typesObjet.ACTIVITE") },
              ]}
            />
          </>
        }
      />
    </section>
  );
}

"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { BORD_DROIT_TABLEAU, FiltreTableau, RechercheTableau, TableauListe } from "@/components/ui/tableau-liste";
import { filtrerMouvements, valeursPresentes } from "@/features/stocks";
import type { MouvementStock, SourceMouvement, TypeMouvement } from "@/features/stocks";
import { formaterDateHeure, formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { TON_MOUVEMENT, classeQuantite } from "./classes";
import { useStock } from "./contexte";

const TYPES: readonly TypeMouvement[] = ["ENTREE", "SORTIE", "TRANSFERT", "INVENTAIRE"];
const SOURCES: readonly SourceMouvement[] = ["BRV", "F2", "MANUEL", "TRANSFERT", "INVENTAIRE"];
const colonne = aideColonnes<MouvementStock>();

/**
 * Le journal des mouvements (F9-5) — le stock n'en est que le cumul. Rien ne
 * s'y modifie ni ne s'y supprime (RG-STK-05) : une erreur se corrige par un
 * mouvement de plus, motivé, qui cite celui qu'il corrige.
 */
export function OngletMouvements() {
  const t = useTranslations("stocks.mouvements");
  const tc = useTranslations("stocks");
  const { donnees, libelleLot, libelleProjet, libelleMateriau, materiau, projets } = useStock();
  const [recherche, setRecherche] = useState("");
  const [type, setType] = useState<TypeMouvement | "">("");
  const [source, setSource] = useState<SourceMouvement | "">("");

  const libelles = useMemo(
    () => ({ materiau: libelleMateriau, lot: libelleLot, projet: libelleProjet }),
    [libelleMateriau, libelleLot, libelleProjet],
  );
  const filtres = useMemo(
    () => filtrerMouvements(donnees.mouvements, { recherche, statut: type, source }, libelles),
    [donnees.mouvements, recherche, type, source, libelles],
  );
  const plusieurs = projets.length > 1;

  const exporter = useMemo<ExportTableau<MouvementStock>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.fichier"),
      colonnes: [
        { entete: t("colonnes.horodatage"), valeur: (m) => m.horodatage.slice(0, 16).replace("T", " ") },
        { entete: t("colonnes.chantier"), valeur: (m) => libelleProjet(m.projetId) },
        { entete: t("colonnes.lot"), valeur: (m) => libelleLot(m.lotId) },
        { entete: t("colonnes.article"), valeur: (m) => libelleMateriau(m.materiauId) },
        { entete: t("colonnes.type"), valeur: (m) => tc(`typeMouvement.${m.type}`) },
        { entete: t("colonnes.source"), valeur: (m) => tc(`sourceMouvement.${m.source}`) },
        { entete: t("colonnes.quantite"), valeur: (m) => m.quantite },
        { entete: t("colonnes.unite"), valeur: (m) => materiau(m.materiauId)?.unite },
        { entete: t("colonnes.reference"), valeur: (m) => m.reference },
        { entete: t("colonnes.auteur"), valeur: (m) => m.auteur.nom },
        { entete: t("colonnes.motif"), valeur: (m) => m.motif },
      ],
    }),
    [t, tc, libelleLot, libelleProjet, libelleMateriau, materiau],
  );

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("horodatage", {
          header: t("colonnes.horodatage"),
          meta: { classe: "tabular-nums text-neutral-600 whitespace-nowrap" },
          cell: ({ getValue }) => formaterDateHeure(getValue()),
        }),
        colonne.display({
          id: "article",
          header: t("colonnes.article"),
          cell: ({ row }) => (
            <span className="flex flex-col">
              <span className="font-medium text-neutral-900">{libelleMateriau(row.original.materiauId)}</span>
              <span className="text-xs text-neutral-500">
                {plusieurs
                  ? tc("projetEtLot", { projet: libelleProjet(row.original.projetId), lot: libelleLot(row.original.lotId) })
                  : libelleLot(row.original.lotId)}
              </span>
            </span>
          ),
        }),
        colonne.accessor("type", {
          header: t("colonnes.type"),
          cell: ({ row }) => (
            <span className="flex flex-col items-start gap-0.5">
              <Badge variante={TON_MOUVEMENT[row.original.type]}>{tc(`typeMouvement.${row.original.type}`)}</Badge>
              <span className="text-xs text-neutral-500">{tc(`sourceMouvement.${row.original.source}`)}</span>
            </span>
          ),
        }),
        colonne.accessor("quantite", {
          header: t("colonnes.quantite"),
          cell: ({ row }) => (
            <span className={cn("font-semibold tabular-nums", classeQuantite(row.original.quantite))}>
              {t("signee", {
                signe: row.original.quantite > 0 ? "+" : "",
                quantite: formaterQuantite(row.original.quantite),
                unite: materiau(row.original.materiauId)?.unite ?? "",
              })}
            </span>
          ),
        }),
        colonne.accessor("reference", {
          header: t("colonnes.reference"),
          meta: { classe: "text-neutral-700" },
        }),
        colonne.display({
          id: "auteur",
          header: t("colonnes.auteur"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => (
            <span className="flex flex-col items-end text-right">
              <span className="text-neutral-800">{row.original.auteur.nom}</span>
              {row.original.motif && <span className="max-w-64 text-xs text-neutral-500">{row.original.motif}</span>}
            </span>
          ),
        }),
      ]),
    [t, tc, libelleLot, libelleProjet, libelleMateriau, materiau, plusieurs],
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 flex items-center gap-2 text-xs text-neutral-500">
        <Lock className="size-3.5" aria-hidden="true" />
        {t("immuable")}
      </p>
      <TableauListe
        colonnes={colonnes}
        donnees={filtres}
        cleLigne={(m) => m.id}
        messageVide={donnees.mouvements.length === 0 ? t("vide") : t("aucunResultat")}
        cleCriteres={`${recherche}|${type}|${source}`}
        filtresActifs={Boolean(recherche || type || source)}
        onReinitialiser={() => {
          setRecherche("");
          setType("");
          setSource("");
        }}
        outils={
          <>
            <RechercheTableau valeur={recherche} onChangement={setRecherche} libelle={t("recherche")} placeholder={t("recherchePlaceholder")} />
            <FiltreTableau
              valeur={type}
              onChangement={setType}
              libelle={t("filtreType")}
              libelleTous={t("tousTypes")}
              options={valeursPresentes(TYPES, donnees.mouvements.map((m) => m.type)).map((v) => ({ valeur: v, libelle: tc(`typeMouvement.${v}`) }))}
            />
            <FiltreTableau
              valeur={source}
              onChangement={setSource}
              libelle={t("filtreSource")}
              libelleTous={t("toutesSources")}
              options={valeursPresentes(SOURCES, donnees.mouvements.map((m) => m.source)).map((v) => ({ valeur: v, libelle: tc(`sourceMouvement.${v}`) }))}
            />
          </>
        }
        exporter={exporter}
      />
    </div>
  );
}

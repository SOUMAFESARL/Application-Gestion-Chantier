"use client";

import { Plus, TriangleAlert, UserPen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge, Bouton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import {
  CRITERES_AFFECTATIONS_VIDES,
  criteresAffectationsActifs,
  filtrerAffectations,
  SANS_EQUIPE,
  statutActivite,
} from "@/features/projets/regles";
import type { CriteresAffectations } from "@/features/projets/regles";
import { useDroits } from "@/features/habilitations";
import type { Activite, Equipe, Lot } from "@/features/projets/types";
import { ABSENT, formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BADGE_STATUT } from "../lots-activites/classes";
import { Periode } from "../lots-activites/StructureLots";
import { pastilleEquipe } from "./classes";

const colonne = aideColonnes<Activite>();

interface Props {
  lots: Lot[];
  equipes: Equipe[];
  onNouvelle: () => void;
  onModifier: (activite: Activite) => void;
}

/**
 * Les affectations du chantier : une ligne par activité, avec l'équipe qui la
 * tient — ou « À affecter ». Le filtre d'équipe propose aussi « À affecter »,
 * la question qu'on pose le plus souvent à cette liste.
 */
export function AffectationsProjet({ lots, equipes, onNouvelle, onModifier }: Props) {
  const t = useTranslations("projets.equipesAffectations");
  const tLots = useTranslations("projets.lotsActivites");
  // Affecter une équipe à une activité, c'est saisir dans « chantier ».
  const peutSaisir = useDroits().peut("chantier", "saisie");
  const [criteres, setCriteres] = useState<CriteresAffectations>(CRITERES_AFFECTATIONS_VIDES);

  const lignes = useMemo(() => filtrerAffectations(lots, criteres), [lots, criteres]);
  const filtresActifs = criteresAffectationsActifs(criteres);

  const colonnes = useMemo(() => {
    /** Le rang d'une équipe dans le chantier, qui fixe sa pastille. */
    const rangs = new Map(equipes.map((equipe, rang) => [equipe.id, rang]));

    return colonne.columns([
      colonne.accessor("libelle", {
        header: t("colonnes.activite"),
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs text-neutral-500">{row.original.code}</span>
            <span className="text-neutral-900">{row.original.libelle}</span>
          </span>
        ),
      }),
      colonne.accessor("equipe", {
        header: t("colonnes.equipe"),
        cell: ({ getValue }) => {
          const equipe = getValue();
          if (!equipe) {
            return (
              <Badge variante="avertissement" icone={<TriangleAlert size={12} aria-hidden="true" />}>
                {t("aAffecter")}
              </Badge>
            );
          }
          return (
            <span className="flex items-center gap-2 text-neutral-800">
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  pastilleEquipe(rangs.get(equipe.id) ?? -1),
                )}
                aria-hidden="true"
              />
              {equipe.nom}
            </span>
          );
        },
      }),
      colonne.display({
        id: "periode",
        header: t("colonnes.periode"),
        meta: { classe: "whitespace-nowrap tabular-nums text-neutral-700" },
        cell: ({ row }) => (
          <Periode debut={row.original.dateDebutPrevue} fin={row.original.dateFinPrevue} />
        ),
      }),
      colonne.display({
        id: "effectif",
        header: t("colonnes.effectif"),
        meta: { classe: "text-right tabular-nums text-neutral-800" },
        cell: ({ row }) => row.original.equipe?.effectif ?? ABSENT,
      }),
      colonne.display({
        id: "statut",
        header: t("colonnes.statut"),
        cell: ({ row }) => {
          const statut = statutActivite(row.original);
          return <Badge variante={BADGE_STATUT[statut]}>{tLots(`statutActivite.${statut}`)}</Badge>;
        },
      }),
      colonne.display({
        id: "actions",
        header: t("colonnes.actions"),
        meta: { classe: BORD_DROIT_TABLEAU },
        cell: ({ row }) => {
          if (!peutSaisir) return null;
          const libelle = row.original.equipe
            ? t("actionReaffecter", { code: row.original.code })
            : t("actionAffecterActivite", { code: row.original.code });
          return (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={libelle}
              title={libelle}
              onClick={() => onModifier(row.original)}
            >
              <UserPen />
            </Button>
          );
        },
      }),
    ]);
  }, [t, tLots, equipes, onModifier, peutSaisir]);

  /** Le lot et les dates complètes en plus de l'écran : le fichier se relit seul. */
  const exporter = useMemo<ExportTableau<Activite>>(() => {
    const lotsParId = new Map(lots.map((lot) => [lot.id, lot]));
    return {
      titre: t("export.titre"),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        {
          entete: t("export.lot"),
          valeur: (activite) => {
            const lot = lotsParId.get(activite.lotId);
            return lot ? tLots("libelleLot", { code: lot.code, nom: lot.nom }) : null;
          },
        },
        { entete: t("export.code"), valeur: (activite) => activite.code },
        { entete: t("colonnes.activite"), valeur: (activite) => activite.libelle },
        {
          entete: t("colonnes.equipe"),
          valeur: (activite) => activite.equipe?.nom ?? t("aAffecter"),
        },
        { entete: t("export.debut"), valeur: (activite) => formaterDate(activite.dateDebutPrevue) },
        { entete: t("export.fin"), valeur: (activite) => formaterDate(activite.dateFinPrevue) },
        { entete: t("colonnes.effectif"), valeur: (activite) => activite.equipe?.effectif },
        {
          entete: t("colonnes.statut"),
          valeur: (activite) => tLots(`statutActivite.${statutActivite(activite)}`),
        },
      ],
    };
  }, [t, tLots, lots]);

  return (
    <TableauListe
      colonnes={colonnes}
      donnees={lignes}
      cleLigne={(activite) => activite.id}
      messageVide={filtresActifs ? t("aucunResultat") : t("aucuneActivite")}
      filtresActifs={filtresActifs}
      onReinitialiser={() => setCriteres(CRITERES_AFFECTATIONS_VIDES)}
      cleCriteres={`${criteres.recherche}|${criteres.lotId}|${criteres.equipeId}`}
      exporter={exporter}
      actions={
        peutSaisir && (
          <Bouton
            variante="primaire"
            taille="sm"
            iconeGauche={<Plus size={16} aria-hidden="true" />}
            onClick={onNouvelle}
          >
            {t("actionNouvelleAffectation")}
          </Bouton>
        )
      }
      outils={
        <>
          <RechercheTableau
            valeur={criteres.recherche}
            onChangement={(recherche) => setCriteres({ ...criteres, recherche })}
            libelle={t("recherche")}
            placeholder={t("recherchePlaceholder")}
          />
          <FiltreTableau
            valeur={criteres.lotId}
            onChangement={(lotId) => setCriteres({ ...criteres, lotId })}
            libelle={t("filtreLot")}
            libelleTous={t("tousLots")}
            options={lots.map((lot) => ({
              valeur: lot.id,
              libelle: tLots("libelleLot", { code: lot.code, nom: lot.nom }),
            }))}
          />
          <FiltreTableau
            valeur={criteres.equipeId}
            onChangement={(equipeId) => setCriteres({ ...criteres, equipeId })}
            libelle={t("filtreEquipe")}
            libelleTous={t("toutesEquipes")}
            options={[
              { valeur: SANS_EQUIPE, libelle: t("aAffecter") },
              ...equipes.map((equipe) => ({ valeur: equipe.id, libelle: equipe.nom })),
            ]}
          />
        </>
      }
    />
  );
}

"use client";

import { Crown, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormContext, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import type { EquipeDuJour } from "@/features/chantier";
import { QUALITES_EXECUTION, type ValeursRapport } from "@/features/chantier/validations";
import { cn } from "@/lib/utils";

import { ChampPuces, ChampTexte, PAIRE, Signal, SousRubrique, useErreurSection } from "./elementsSaisie";

/**
 * Les équipes des tâches du jour (30/10/2026) : pour chacune, ses membres ce jour, à cocher
 * présents ou en retard, ses heures, la qualité du travail quand elle se note, et le motif d'une
 * absence. Remplace les effectifs par catégorie sur les tâches tenues par une équipe.
 *
 * Pensé pour le téléphone (P16) : une personne par ligne, des cases larges, aucun tableau.
 */
export function SectionEquipes({ equipes }: { equipes: EquipeDuJour[] }) {
  const t = useTranslations("journal.saisie.equipes");
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useWatch({ control, name: "equipes" }) ?? [];
  const erreur = useErreurSection("equipes");

  return (
    <SousRubrique titre={t("titre")} description={t("description")} erreur={erreur}>
      {lignes.length === 0 && <Signal ton="information">{t("aucune")}</Signal>}
      {lignes.map((ligne, rang) => {
        const equipe = equipes.find((e) => e.equipeId === ligne.equipeId);
        if (!equipe) return null;
        return <CarteEquipe key={equipe.equipeId} equipe={equipe} rang={rang} />;
      })}
    </SousRubrique>
  );
}

function CarteEquipe({ equipe, rang }: { equipe: EquipeDuJour; rang: number }) {
  const t = useTranslations("journal.saisie.equipes");
  const tQualite = useTranslations("journal.saisie.presence.qualites");
  const { control, setValue } = useFormContext<ValeursRapport>();
  const presents = useWatch({ control, name: `equipes.${rang}.presents` }) ?? [];
  const retards = useWatch({ control, name: `equipes.${rang}.retards` }) ?? [];
  const absents = equipe.membres.length - presents.length;

  function basculer(liste: "presents" | "retards", personneId: string, coche: boolean) {
    const actuelle = liste === "presents" ? presents : retards;
    const suivante = coche ? [...actuelle, personneId] : actuelle.filter((id) => id !== personneId);
    setValue(`equipes.${rang}.${liste}`, suivante, { shouldDirty: true });
    // Un absent n'est pas en retard.
    if (liste === "presents" && !coche) {
      setValue(
        `equipes.${rang}.retards`,
        retards.filter((id) => id !== personneId),
        { shouldDirty: true },
      );
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-solid border-neutral-200 bg-card p-3">
      <header className="flex flex-wrap items-center gap-2">
        <Users size={16} className="text-neutral-500" aria-hidden="true" />
        <span className="flex-1 font-semibold text-neutral-900">{equipe.nom}</span>
        {equipe.entreprise && <Badge variante="neutre">{equipe.entreprise}</Badge>}
        {equipe.attendue && <Badge variante="information">{t("attendue")}</Badge>}
        <span className="text-xs text-neutral-600">
          {t("compte", { presents: presents.length, total: equipe.membres.length })}
        </span>
      </header>
      {equipe.membres.length === 0 ? (
        <p className="m-0 text-sm text-neutral-500">{t("sansMembre")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {equipe.membres.map((membre) => {
            const present = presents.includes(membre.personneId);
            return (
              <li
                key={membre.personneId}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-2 py-1.5",
                  present ? "bg-succes-fond" : "bg-neutral-50",
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-neutral-900">
                  {membre.estChef && <Crown size={14} className="text-primary-600" aria-label={t("chef")} />}
                  {membre.nom}
                </span>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <Checkbox
                    checked={present}
                    onCheckedChange={(coche) => basculer("presents", membre.personneId, coche === true)}
                    className="size-5"
                  />
                  {t("present")}
                </label>
                <label
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-2 text-sm text-neutral-700",
                    !present && "opacity-50",
                  )}
                >
                  <Checkbox
                    checked={retards.includes(membre.personneId)}
                    onCheckedChange={(coche) => basculer("retards", membre.personneId, coche === true)}
                    disabled={!present}
                    className="size-5"
                  />
                  {t("retard")}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className={PAIRE}>
        <ChampTexte
          name={`equipes.${rang}.heures`}
          libelle={t("heures")}
          inputMode="decimal"
          suffixe={t("uniteHeures")}
          requis={presents.length > 0}
        />
      </div>
      {equipe.qualite && presents.length > 0 && (
        <ChampPuces
          name={`equipes.${rang}.qualite`}
          libelle={t("qualite")}
          requis
          colonnes={2}
          options={QUALITES_EXECUTION.map((valeur) => ({
            valeur,
            libelle: tQualite(valeur),
            ton: valeur === "CONFORME" ? "succes" : "erreur",
          }))}
        />
      )}
      <ChampTexte
        name={`equipes.${rang}.observation`}
        libelle={t("observation")}
        requis={absents > 0 || retards.length > 0}
        multiligne
        lignes={2}
      />
    </div>
  );
}

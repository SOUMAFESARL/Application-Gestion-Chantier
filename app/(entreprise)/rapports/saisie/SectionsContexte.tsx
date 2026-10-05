"use client";

import { CloudSun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cielDepuisReleve, LONGUEUR_MIN_NOTE } from "@/features/chantier";
import {
  CONDITIONS_TRAVAIL,
  METEOS,
  MOTIFS_ARRET,
  previsionVide,
  type ValeursRapport,
} from "@/features/chantier/validations";
import type { MeteoProjet } from "@/features/projets/types";

import {
  BoutonAjout,
  CarteLigne,
  CarteSection,
  ChampPuces,
  ChampTexte,
  PAIRE,
  RANGEE,
  RANGEE_TROIS,
  Signal,
  SousRubrique,
} from "./elementsSaisie";

/** Les horaires, la journée d'arrêt éventuelle et le ciel du jour. */
export function SectionContexte({ releve }: { releve: MeteoProjet | null }) {
  const t = useTranslations("journal.saisie");
  const tEnum = useTranslations("journal.enumerations");
  const { control, setValue, getValues } = useFormContext<ValeursRapport>();
  const arret = useWatch({ control, name: "arret" });

  const ciel = releve?.disponible ? cielDepuisReleve(releve.condition) : null;
  const reprendreReleve = () => {
    if (!releve?.disponible) return;
    const options = { shouldDirty: true } as const;
    if (ciel) {
      setValue("meteo.matin", ciel, options);
      setValue("meteo.apresMidi", ciel, options);
    }
    if (releve.temperature !== null && !getValues("meteo.temperatureMax")) {
      setValue("meteo.temperatureMax", String(Math.round(releve.temperature)), options);
    }
    if (!releve.praticable) setValue("meteo.conditions", "DIFFICILES", options);
  };

  const optionsCiel = METEOS.map((valeur) => ({ valeur, libelle: tEnum(`meteo.${valeur}`) }));

  return (
    <CarteSection
      id="section-journee"
      titre={t("rubriques.journee")}
      description={t("contenuRubriques.journee")}
    >
      <div className={PAIRE}>
        <ChampTexte name="heureDebut" libelle={t("contexte.heureDebut")} type="time" requis />
        <ChampTexte name="heureFin" libelle={t("contexte.heureFin")} type="time" requis />
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3">
        <Checkbox
          id="journee-arret"
          className="mt-0.5"
          checked={arret}
          onCheckedChange={(valeur) => setValue("arret", valeur === true, { shouldDirty: true })}
        />
        <label htmlFor="journee-arret" className="flex cursor-pointer flex-col gap-0.5">
          <span className="text-sm font-medium text-neutral-900">{t("contexte.arret")}</span>
          <span className="text-xs text-neutral-500">{t("contexte.arretAide")}</span>
        </label>
      </div>
      {arret && (
        <div className="flex flex-col gap-3">
          <ChampPuces
            name="motifArret"
            libelle={t("contexte.motifArret")}
            requis
            colonnes={3}
            options={MOTIFS_ARRET.map((valeur) => ({ valeur, libelle: t(`motifsArret.${valeur}`) }))}
          />
          <ChampTexte name="precisionArret" libelle={t("contexte.precisionArret")} placeholder={t("contexte.precisionArretExemple")} />
          <Signal ton="information">{t("contexte.arretEffet")}</Signal>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <CloudSun className="size-4 text-neutral-500" aria-hidden="true" />
            {t("contexte.meteo")}
          </h3>
          {releve?.disponible && (
            <Button type="button" variant="ghost" size="sm" onClick={reprendreReleve}>
              {t("contexte.reprendreReleve", {
                temperature: releve.temperature === null ? "" : Math.round(releve.temperature),
                ville: releve.ville,
              })}
            </Button>
          )}
        </div>
        <ChampPuces name="meteo.matin" libelle={t("contexte.matin")} requis options={optionsCiel} />
        <ChampPuces name="meteo.apresMidi" libelle={t("contexte.apresMidi")} requis options={optionsCiel} />
        <ChampPuces
          name="meteo.conditions"
          libelle={t("contexte.conditions")}
          requis
          colonnes={3}
          options={CONDITIONS_TRAVAIL.map((valeur) => ({
            valeur,
            libelle: tEnum(`conditions.${valeur}`),
            ton: valeur === "FAVORABLES" ? "succes" : valeur === "DIFFICILES" ? "avertissement" : "erreur",
          }))}
        />
        <div className={RANGEE_TROIS}>
          <div className={PAIRE}>
            <ChampTexte name="meteo.temperatureMin" libelle={t("contexte.temperatureMin")} inputMode="decimal" suffixe={t("unites.degres")} />
            <ChampTexte name="meteo.temperatureMax" libelle={t("contexte.temperatureMax")} inputMode="decimal" suffixe={t("unites.degres")} />
          </div>
          <ChampTexte name="meteo.humidite" libelle={t("contexte.humidite")} inputMode="numeric" suffixe={t("unites.pourcent")} />
          <ChampTexte name="meteo.vent" libelle={t("contexte.vent")} placeholder={t("contexte.ventExemple")} />
        </div>
        <ChampTexte name="meteo.prevision" libelle={t("contexte.prevision")} placeholder={t("contexte.previsionExemple")} />
      </div>
    </CarteSection>
  );
}

/** Ce que le chantier prévoit pour demain — ce que le CT lit en premier le matin. */
export function SectionPrevisions() {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "previsions" });
  return (
    <SousRubrique titre={t("sections.previsions")} description={t("previsions.description")}>
      {lignes.fields.map((ligne, rang) => (
        <CarteLigne
          key={ligne.id}
          titre={t("previsions.titre", { rang: rang + 1 })}
          libelleSupprimer={t("previsions.supprimer", { rang: rang + 1 })}
          onSupprimer={() => lignes.remove(rang)}
        >
          <div className={RANGEE}>
            <ChampTexte name={`previsions.${rang}.activite`} libelle={t("previsions.activite")} requis />
            <ChampTexte name={`previsions.${rang}.equipe`} libelle={t("previsions.equipe")} />
          </div>
          <div className={RANGEE}>
            <ChampTexte name={`previsions.${rang}.objectif`} libelle={t("previsions.objectif")} placeholder={t("previsions.objectifExemple")} requis />
            <ChampTexte name={`previsions.${rang}.prerequis`} libelle={t("previsions.prerequis")} />
          </div>
        </CarteLigne>
      ))}
      <BoutonAjout onClick={() => lignes.append(previsionVide())}>{t("previsions.ajouter")}</BoutonAjout>
    </SousRubrique>
  );
}

/** La note du chef de chantier — le seul champ entièrement libre du rapport. */
export function SectionNote() {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const note = useWatch({ control, name: "note" });
  const longueur = note.trim().length;
  return (
    <SousRubrique titre={t("sections.note")}>
      <ChampTexte
        name="note"
        libelle={t("note.libelle")}
        masquerLibelle
        multiligne
        lignes={4}
        placeholder={t("note.exemple")}
        aide={t("note.compteur", { n: longueur, min: LONGUEUR_MIN_NOTE })}
      />
    </SousRubrique>
  );
}

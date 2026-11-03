"use client";

import { CloudSun, History, OctagonMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LONGUEUR_MIN_NOTE } from "@/features/chantier";
import type { ActivitePreparee, EquipeDuJour, MeteoSuggeree, Prevision } from "@/features/chantier";
import {
  CONDITIONS_TRAVAIL,
  METEOS,
  MOTIFS_ARRET,
  previsionVide,
  type ValeursRapport,
} from "@/features/chantier/validations";
import { cn } from "@/lib/utils";

import {
  BoutonAjout,
  CarteLigne,
  CarteSection,
  CHAMP,
  ChampPuces,
  ChampTexte,
  PAIRE,
  RANGEE,
  SousRubrique,
} from "./elementsSaisie";

const SAISIE_LIBRE = "__libre__";

/** Les horaires, la journée d'arrêt éventuelle et la météo pré-remplie du jour. */
export function SectionContexte({ meteoSuggeree }: { meteoSuggeree: MeteoSuggeree | null }) {
  const t = useTranslations("journal.saisie");
  const tEnum = useTranslations("journal.enumerations");
  const { control, setValue } = useFormContext<ValeursRapport>();
  const arret = useWatch({ control, name: "arret" });
  const motifArret = useWatch({ control, name: "motifArret" });

  const reappliquerMeteo = () => {
    if (!meteoSuggeree) return;
    const options = { shouldDirty: true } as const;
    setValue("meteo.matin", meteoSuggeree.matin, options);
    setValue("meteo.apresMidi", meteoSuggeree.apresMidi, options);
    setValue("meteo.conditions", meteoSuggeree.conditions, options);
  };

  const optionsCiel = METEOS.map((valeur) => ({ valeur, libelle: tEnum(`meteo.${valeur}`) }));

  return (
    <CarteSection
      id="section-journee"
      titre={t("rubriques.journee")}
      description={t("contenuRubriques.journee")}
    >
      <div className={PAIRE}>
        <ChampTexte name="heureDebut" libelle={t("contexte.heureDebut")} type="time" requis={!arret} />
        <ChampTexte name="heureFin" libelle={t("contexte.heureFin")} type="time" requis={!arret} />
      </div>

      <Item
        asChild
        variant="outline"
        size="sm"
        className={cn(
          "cursor-pointer",
          arret
            ? "border-avertissement/40 bg-avertissement-fond"
            : "border-neutral-200 bg-neutral-50 hover:bg-neutral-100",
        )}
      >
        <label htmlFor="journee-arret">
          <ItemMedia
            variant="icon"
            className={cn("bg-card", arret && "border-avertissement/30 text-avertissement")}
          >
            <OctagonMinus aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{t("contexte.arret")}</ItemTitle>
            <ItemDescription className="text-xs">{t("contexte.arretAide")}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Checkbox
              id="journee-arret"
              className="size-5 rounded-full border-neutral-300 bg-card data-[state=checked]:border-avertissement data-[state=checked]:bg-avertissement data-[state=checked]:text-white"
              checked={arret}
              onCheckedChange={(valeur) => setValue("arret", valeur === true, { shouldDirty: true })}
            />
          </ItemActions>
        </label>
      </Item>
      {arret && (
        <div className="flex flex-col gap-3">
          <ChampPuces
            name="motifArret"
            libelle={t("contexte.motifArret")}
            requis
            colonnes={3}
            options={MOTIFS_ARRET.map((valeur) => ({ valeur, libelle: t(`motifsArret.${valeur}`) }))}
          />
          <ChampTexte
            name="precisionArret"
            libelle={t("contexte.precisionArret")}
            placeholder={t("contexte.precisionArretExemple")}
            requis={motifArret === "AUTRE"}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <CloudSun className="size-4 text-neutral-500" aria-hidden="true" />
            {t("contexte.meteo")}
            {meteoSuggeree?.sourceAuto && (
              <Badge variante="information">{t("contexte.meteoAuto")}</Badge>
            )}
          </h3>
          {meteoSuggeree && (
            <Button type="button" variant="ghost" size="sm" onClick={reappliquerMeteo}>
              {t("contexte.reappliquerMeteo")}
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
            ton:
              valeur === "FAVORABLES"
                ? "succes"
                : valeur === "DIFFICILES"
                  ? "avertissement"
                  : "erreur",
          }))}
        />
      </div>
    </CarteSection>
  );
}

/** Les actions et prévisions pour le prochain jour ouvré, bouclées avec la veille. */
export function SectionPrevisions({
  previsionsVeille,
  activites,
  equipes,
}: {
  previsionsVeille: Prevision[];
  activites: ActivitePreparee[];
  equipes: EquipeDuJour[];
}) {
  const t = useTranslations("journal.saisie");
  const { control, setValue } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "previsions" });
  const valeurs = useWatch({ control, name: "previsions" });

  return (
    <SousRubrique titre={t("sections.previsions")} description={t("previsions.description")}>
      {previsionsVeille.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-information/25 bg-information-fond p-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-information">
            <History className="size-3.5 shrink-0" aria-hidden="true" />
            {t("previsions.rappelVeille")}
          </span>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-neutral-700">
            {previsionsVeille.map((prev, idx) => (
              <li key={`${prev.activite}-${idx}`} className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-semibold text-neutral-900">{prev.activite}</span>
                {prev.equipe && <Badge variante="neutre">{prev.equipe}</Badge>}
                <span>{prev.objectif}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lignes.fields.map((ligne, rang) => {
        const courante = valeurs[rang];
        return (
          <CarteLigne
            key={ligne.id}
            titre={t("previsions.titre", { rang: rang + 1 })}
            libelleSupprimer={t("previsions.supprimer", { rang: rang + 1 })}
            onSupprimer={() => lignes.remove(rang)}
          >
            {activites.length > 0 && (
              <div className={RANGEE}>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-neutral-700">
                    {t("previsions.tacheArbre")}
                  </span>
                  <Select
                    value={courante?.activiteId || SAISIE_LIBRE}
                    onValueChange={(choisi) => {
                      const options = { shouldDirty: true } as const;
                      if (choisi === SAISIE_LIBRE) {
                        setValue(`previsions.${rang}.activiteId`, "", options);
                        return;
                      }
                      const feuille = activites.find((act) => act.activiteId === choisi);
                      setValue(`previsions.${rang}.activiteId`, choisi, options);
                      if (feuille) {
                        setValue(`previsions.${rang}.activite`, feuille.libelle, options);
                      }
                    }}
                  >
                    <SelectTrigger className={cn(CHAMP, "w-full bg-card")}>
                      <SelectValue placeholder={t("previsions.choisirTache")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SAISIE_LIBRE}>{t("previsions.saisieLibre")}</SelectItem>
                      {activites.map((act) => (
                        <SelectItem key={act.activiteId} value={act.activiteId}>
                          {t("avancement.activiteValeur", {
                            code: act.code,
                            libelle: act.cheminLibelle || act.libelle,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {equipes.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-neutral-700">
                      {t("previsions.equipeConfiguree")}
                    </span>
                    <Select
                      value={courante?.equipeId || SAISIE_LIBRE}
                      onValueChange={(choisi) => {
                        const options = { shouldDirty: true } as const;
                        if (choisi === SAISIE_LIBRE) {
                          setValue(`previsions.${rang}.equipeId`, "", options);
                          return;
                        }
                        const eq = equipes.find((item) => item.equipeId === choisi);
                        setValue(`previsions.${rang}.equipeId`, choisi, options);
                        if (eq) {
                          setValue(`previsions.${rang}.equipe`, eq.nom, options);
                        }
                      }}
                    >
                      <SelectTrigger className={cn(CHAMP, "w-full bg-card")}>
                        <SelectValue placeholder={t("previsions.choisirEquipe")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SAISIE_LIBRE}>{t("previsions.saisieLibre")}</SelectItem>
                        {equipes.map((eq) => (
                          <SelectItem key={eq.equipeId} value={eq.equipeId}>
                            {eq.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className={RANGEE}>
              <ChampTexte
                name={`previsions.${rang}.activite`}
                libelle={t("previsions.activite")}
                requis
              />
              <ChampTexte name={`previsions.${rang}.equipe`} libelle={t("previsions.equipe")} />
            </div>
            <div className={RANGEE}>
              <ChampTexte
                name={`previsions.${rang}.objectif`}
                libelle={t("previsions.objectif")}
                placeholder={t("previsions.objectifExemple")}
                requis
              />
              <ChampTexte name={`previsions.${rang}.prerequis`} libelle={t("previsions.prerequis")} />
            </div>
          </CarteLigne>
        );
      })}
      <BoutonAjout onClick={() => lignes.append(previsionVide())}>
        {t("previsions.ajouter")}
      </BoutonAjout>
    </SousRubrique>
  );
}

/** La synthèse de fin de journée du rédacteur. */
export function SectionNote({ arret }: { arret: boolean }) {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const note = useWatch({ control, name: "noteRedacteur" }) ?? "";
  const longueur = note.trim().length;
  return (
    <SousRubrique titre={t("sections.note")}>
      <ChampTexte
        name="noteRedacteur"
        libelle={t("note.libelle")}
        masquerLibelle
        requis={!arret}
        multiligne
        lignes={4}
        placeholder={t("note.exemple")}
        aide={!arret ? t("note.compteur", { n: longueur, min: LONGUEUR_MIN_NOTE }) : undefined}
      />
    </SousRubrique>
  );
}

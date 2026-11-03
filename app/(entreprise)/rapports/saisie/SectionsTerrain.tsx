"use client";

import { Check, ChevronRight, Layers, Plus, Trash2, TriangleAlert, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFieldArray, useFormContext, useFormState, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  avancementLotSaisi,
  avancementSaisi,
  avancementTheoriqueLot,
  cumulSaisi,
  depassePrevu,
  lotsSuivisAvancement,
} from "@/features/chantier";
import type { ActivitePreparee, EquipeDuJour, LotJournal, MesureFeuilleSaisie } from "@/features/chantier";
import { estRenseigne, versNombre, type ValeursRapport } from "@/features/chantier/validations";
import { formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  ChampTexte,
  Requis,
  Signal,
  SousRubrique,
  useErreurSection,
} from "./elementsSaisie";

function useUnite() {
  const tUnites = useTranslations("projets.lotsActivites.unites");
  const t = useTranslations("journal.saisie");
  return (activite: Pick<ActivitePreparee, "unite"> | undefined) =>
    activite?.unite ? tUnites(activite.unite) : t("avancement.unitePourcent");
}

/**
 * L'avancement des feuilles de l'arbre regroupées par lot, selon leur mode de mesure
 * (`QUANTITE`, `POURCENTAGE`, `JALON`) et rattachées aux équipes configurées (garde-fou A3).
 */
export function SectionAvancement({
  activites,
  lots,
  equipes,
}: {
  activites: ActivitePreparee[];
  lots: LotJournal[];
  equipes: EquipeDuJour[];
}) {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const points = useFieldArray({ control, name: "lotsTravailles", keyName: "cle" });
  const erreurLots = useErreurSection("lotsTravailles");
  const erreurActivites = useErreurSection("activites");
  const choisissables = lotsSuivisAvancement({ lots, activites });
  const choisis = new Set(points.fields.map((point) => point.lotId));

  const basculer = (lot: LotJournal) => {
    const rang = points.fields.findIndex((point) => point.lotId === lot.id);
    if (rang >= 0) {
      points.remove(rang);
      return;
    }
    const ordre = (lotId: string) => choisissables.findIndex((candidat) => candidat.id === lotId);
    const avant = points.fields.filter((point) => ordre(point.lotId) < ordre(lot.id)).length;
    points.insert(avant, { lotId: lot.id, observation: "" }, { shouldFocus: false });
  };

  const [recherche, setRecherche] = useState(false);
  const [ouverts, setOuverts] = useState<Set<string>>(() =>
    points.fields.length <= 3 ? new Set(points.fields.map((point) => point.lotId)) : new Set(),
  );
  const basculerOuvert = (lotId: string, ouvert: boolean) =>
    setOuverts((actuels) => {
      const suivants = new Set(actuels);
      if (ouvert) suivants.add(lotId);
      else suivants.delete(lotId);
      return suivants;
    });

  const choisir = (lot: LotJournal) => {
    if (!choisis.has(lot.id)) basculerOuvert(lot.id, true);
    basculer(lot);
  };

  return (
    <SousRubrique erreur={erreurLots ?? erreurActivites}>
      {activites.length === 0 && <Signal ton="avertissement">{t("avancement.aucuneActivite")}</Signal>}
      {choisissables.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-neutral-900">{t("avancement.lotsTravailles")}</span>
            <span className="text-xs text-neutral-500 tabular-nums">
              {t("avancement.lotsChoisis", { n: choisis.size, total: choisissables.length })}
            </span>
          </div>
          <SelecteurAjout
            ouvert={recherche}
            onOuvrir={setRecherche}
            libelle={t("avancement.ajouterLot")}
            recherche={t("avancement.rechercherLot")}
            aucunResultat={t("avancement.aucunLotTrouve")}
            options={choisissables.map((lot) => ({
              id: lot.id,
              titre: t("lotValeur", { code: lot.code, nom: lot.nom }),
              detail: t("avancement.nbActivites", {
                nombre: activites.filter((activite) => activite.lotId === lot.id).length,
              }),
              choisi: choisis.has(lot.id),
            }))}
            onBasculer={(id) => {
              const lot = choisissables.find((candidat) => candidat.id === id);
              if (lot) choisir(lot);
            }}
          />
        </div>
      )}
      {choisissables.length > 0 && points.fields.length === 0 && (
        <button
          type="button"
          onClick={() => setRecherche(true)}
          className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center transition-colors hover:bg-neutral-100"
        >
          <Layers className="size-5 text-neutral-400" aria-hidden="true" />
          <span className="text-sm font-medium text-neutral-700">{t("avancement.aucunLotChoisi")}</span>
          <span className="text-xs text-neutral-500">{t("avancement.aucunLotChoisiAide")}</span>
        </button>
      )}
      {points.fields.length > 0 && (
        <div className="flex flex-col gap-2">
          {points.fields.map((point, rangPoint) => {
            const lot = lots.find((candidat) => candidat.id === point.lotId);
            if (!lot) return null;
            return (
              <PointDuLot
                key={point.cle}
                lot={lot}
                rangPoint={rangPoint}
                activites={activites}
                equipes={equipes}
                ouvert={ouverts.has(lot.id)}
                onOuvrir={(ouvert) => basculerOuvert(lot.id, ouvert)}
                onRetirer={() => points.remove(rangPoint)}
              />
            );
          })}
        </div>
      )}
    </SousRubrique>
  );
}

function PointDuLot({
  lot,
  rangPoint,
  activites,
  equipes,
  ouvert,
  onOuvrir,
  onRetirer,
}: {
  lot: LotJournal;
  rangPoint: number;
  activites: ActivitePreparee[];
  equipes: EquipeDuJour[];
  ouvert: boolean;
  onOuvrir: (ouvert: boolean) => void;
  onRetirer: () => void;
}) {
  const t = useTranslations("journal.saisie");
  const unite = useUnite();
  const { control, getValues, setValue } = useFormContext<ValeursRapport>();
  const { errors } = useFormState({ control, name: ["activites", "lotsTravailles"] });
  const valeurs = useWatch({ control, name: "activites" });
  const duLot = activites.flatMap((activite, rang) => (activite.lotId === lot.id ? [{ activite, rang }] : []));

  const mesures = new Map<string, MesureFeuilleSaisie>(
    duLot.map(({ activite, rang }) => [
      activite.activiteId,
      {
        quantiteJour: versNombre(valeurs[rang]?.quantiteJour ?? ""),
        pourcentageJour: versNombre(valeurs[rang]?.pourcentageJour ?? ""),
        jalonAtteint: Boolean(valeurs[rang]?.jalonAtteint),
      },
    ]),
  );

  const avancementLot = avancementLotSaisi(duLot.map(({ activite }) => activite), mesures) ?? 0;
  const theoriqueLot = avancementTheoriqueLot(duLot.map(({ activite }) => activite)) ?? 0;
  const lotEnRetard = avancementLot < theoriqueLot;
  const renseignees = duLot.filter(({ rang }) => {
    const ligne = valeurs[rang];
    return (
      estRenseigne(ligne?.quantiteJour ?? "") ||
      estRenseigne(ligne?.pourcentageJour ?? "") ||
      Boolean(ligne?.jalonAtteint)
    );
  }).length;

  const enErreur =
    Boolean(errors.lotsTravailles?.[rangPoint]) || duLot.some(({ rang }) => Boolean(errors.activites?.[rang]));
  const deplie = ouvert || enErreur;

  const [affichees, setAffichees] = useState<Set<string>>(() => {
    const lignes = getValues("activites");
    return new Set(
      duLot
        .filter(({ activite, rang }) => {
          const ligne = lignes[rang];
          return (
            duLot.length === 1 ||
            activite.attendueCeJour ||
            (ligne !== undefined &&
              (estRenseigne(ligne.quantiteJour) ||
                estRenseigne(ligne.pourcentageJour) ||
                ligne.jalonAtteint ||
                estRenseigne(ligne.localisation) ||
                estRenseigne(ligne.observation)))
          );
        })
        .map(({ activite }) => activite.activiteId),
    );
  });
  const [ajout, setAjout] = useState(false);
  const visibles = duLot.filter(
    ({ activite, rang }) => affichees.has(activite.activiteId) || Boolean(errors.activites?.[rang]),
  );
  const visible = new Set(visibles.map(({ activite }) => activite.activiteId));

  const basculerActivite = (activiteId: string) => {
    const cible = duLot.find(({ activite }) => activite.activiteId === activiteId);
    if (!cible) return;
    if (visible.has(activiteId)) {
      const options = { shouldDirty: true } as const;
      setValue(`activites.${cible.rang}.quantiteJour`, "", options);
      setValue(`activites.${cible.rang}.pourcentageJour`, "", options);
      setValue(`activites.${cible.rang}.jalonAtteint`, false, options);
      setValue(`activites.${cible.rang}.localisation`, "", options);
      setValue(`activites.${cible.rang}.observation`, "", options);
    }
    setAffichees((actuelles) => {
      const suivantes = new Set(actuelles);
      if (visible.has(activiteId)) suivantes.delete(activiteId);
      else suivantes.add(activiteId);
      return suivantes;
    });
  };

  return (
    <Collapsible
      open={deplie}
      onOpenChange={onOuvrir}
      className={cn(
        "group/lot rounded-xl border bg-card",
        enErreur ? "border-erreur" : deplie ? "border-primary-200" : "border-neutral-200",
      )}
    >
      <div className="flex items-center gap-2 p-3 sm:px-4">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
          >
            <ChevronRight
              className="size-4 shrink-0 text-neutral-400 transition-transform group-data-[state=open]/lot:rotate-90"
              aria-hidden="true"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm font-semibold text-neutral-900">
                {t("lotValeur", { code: lot.code, nom: lot.nom })}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 tabular-nums">
                <span className={cn("font-medium", lotEnRetard ? "text-avertissement" : "text-succes")}>
                  {t("pourcent", { valeur: avancementLot })}
                </span>
                <span>{t("avancement.activitesRenseignees", { n: renseignees, total: duLot.length })}</span>
              </span>
            </span>
          </button>
        </CollapsibleTrigger>
        {enErreur && <TriangleAlert className="size-4 shrink-0 text-erreur" aria-label={t("sectionEnErreur")} />}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-erreur hover:bg-erreur-fond hover:text-erreur"
          aria-label={t("avancement.retirerLot", { code: lot.code })}
          onClick={onRetirer}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <CollapsibleContent className="rounded-b-xl border-t border-neutral-100 bg-neutral-50 p-3 sm:p-4">
        <p className={cn("m-0 mb-3 text-xs font-medium tabular-nums", lotEnRetard ? "text-avertissement" : "text-succes")}>
          {t("avancement.avancementLot", { avancement: avancementLot, theorique: theoriqueLot })}
        </p>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-neutral-500 tabular-nums">
            {t("avancement.activitesDuJour", { n: visibles.length, total: duLot.length })}
          </span>
          <SelecteurAjout
            ouvert={ajout}
            onOuvrir={setAjout}
            libelle={t("avancement.ajouterActivite")}
            recherche={t("avancement.rechercherActivite")}
            aucunResultat={t("avancement.aucuneActiviteTrouvee")}
            options={duLot.map(({ activite }) => ({
              id: activite.activiteId,
              titre: t("avancement.activiteValeur", {
                code: activite.code,
                libelle: activite.cheminLibelle || activite.libelle,
              }),
              detail: t("avancement.activiteAvancement", {
                avancement: avancementSaisi(activite, null),
                theorique: activite.avancementTheorique,
              }),
              choisi: visible.has(activite.activiteId),
            }))}
            onBasculer={basculerActivite}
          />
        </div>
        {visibles.length === 0 && (
          <button
            type="button"
            onClick={() => setAjout(true)}
            className="mb-3 flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-neutral-300 bg-card px-4 py-5 text-center transition-colors hover:bg-neutral-100"
          >
            <span className="text-sm font-medium text-neutral-700">{t("avancement.aucuneActiviteChoisie")}</span>
            <span className="text-xs text-neutral-500">{t("avancement.aucuneActiviteChoisieAide")}</span>
          </button>
        )}
        <ul className="m-0 mb-3 flex list-none flex-col gap-3 p-0 empty:hidden">
          {visibles.map(({ activite, rang }) => {
            const mesure = mesures.get(activite.activiteId) ?? {
              quantiteJour: null,
              pourcentageJour: null,
              jalonAtteint: false,
            };
            const avancement = avancementSaisi(activite, mesure);
            const depasse = depassePrevu(activite, mesure.quantiteJour);
            const enRetard = avancement < activite.avancementTheorique;

            return (
              <li key={activite.activiteId} className="rounded-lg border border-neutral-200 bg-card p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-neutral-500 tabular-nums">{activite.code}</span>
                      {activite.attendueCeJour && (
                        <Badge variante="information">{t("avancement.attendueCeJour")}</Badge>
                      )}
                    </div>
                    <span className="mt-0.5 block text-sm font-semibold text-neutral-900">
                      {activite.cheminLibelle || activite.libelle}
                    </span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1">
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        enRetard ? "text-avertissement" : "text-succes",
                      )}
                    >
                      {t("pourcent", { valeur: avancement })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-neutral-400 hover:bg-erreur-fond hover:text-erreur"
                      aria-label={t("avancement.retirerActivite", { code: activite.code })}
                      onClick={() => basculerActivite(activite.activiteId)}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </span>
                </div>

                {activite.modeMesure === "QUANTITE" && (
                  <>
                    <p className="m-0 mb-3 text-xs text-neutral-500 tabular-nums">
                      {t("avancement.repere", {
                        veille: formaterQuantite(activite.cumulVeille),
                        cumul: formaterQuantite(cumulSaisi(activite, mesure.quantiteJour)),
                        prevu: formaterQuantite(activite.quantitePrevue),
                        unite: unite(activite),
                        theorique: activite.avancementTheorique,
                      })}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
                      <ChampTexte
                        name={`activites.${rang}.quantiteJour`}
                        libelle={t("avancement.quantiteJour")}
                        inputMode="decimal"
                        suffixe={unite(activite)}
                        placeholder="0"
                      />
                      <ChampTexte
                        name={`activites.${rang}.localisation`}
                        libelle={t("avancement.localisation")}
                        placeholder={t("avancement.localisationExemple")}
                      />
                    </div>
                  </>
                )}

                {activite.modeMesure === "POURCENTAGE" && (
                  <>
                    <p className="m-0 mb-3 text-xs text-neutral-500 tabular-nums">
                      {t("avancement.reperePourcentage", {
                        veille: formaterQuantite(activite.pourcentageVeille),
                        cumul: formaterQuantite(avancement),
                        theorique: activite.avancementTheorique,
                      })}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
                      <ChampTexte
                        name={`activites.${rang}.pourcentageJour`}
                        libelle={t("avancement.pourcentageJour")}
                        inputMode="decimal"
                        suffixe={t("unites.pourcent")}
                        placeholder={formaterQuantite(activite.pourcentageVeille)}
                      />
                      <ChampTexte
                        name={`activites.${rang}.localisation`}
                        libelle={t("avancement.localisation")}
                        placeholder={t("avancement.localisationExemple")}
                      />
                    </div>
                  </>
                )}

                {activite.modeMesure === "JALON" && (
                  <>
                    <p className="m-0 mb-3 text-xs text-neutral-500 tabular-nums">
                      {t("avancement.repereJalon", { theorique: activite.avancementTheorique })}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField
                        control={control}
                        name={`activites.${rang}.jalonAtteint`}
                        render={({ field }) => (
                          <FormItem className="gap-1.5">
                            <FormLabel>{t("avancement.statutJalon")}</FormLabel>
                            <FormControl>
                              <label
                                className={cn(
                                  "flex min-h-[var(--input-height-md)] cursor-pointer items-center gap-2.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                                  field.value
                                    ? "border-succes bg-succes-fond text-succes"
                                    : "border-neutral-200 bg-card text-neutral-700 hover:bg-neutral-50",
                                )}
                              >
                                <Checkbox
                                  checked={Boolean(field.value)}
                                  onCheckedChange={(coche) => field.onChange(coche === true)}
                                  className="size-5"
                                />
                                <span>{t("avancement.jalonAtteint")}</span>
                              </label>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <ChampTexte
                        name={`activites.${rang}.localisation`}
                        libelle={t("avancement.localisation")}
                        placeholder={t("avancement.localisationExemple")}
                      />
                    </div>
                  </>
                )}

                <div className="mt-3">
                  <ChampEquipesActivite
                    rang={rang}
                    activite={activite}
                    equipes={equipes}
                    requis={
                      activite.modeMesure === "POURCENTAGE"
                        ? mesure.pourcentageJour !== null && mesure.pourcentageJour > activite.pourcentageVeille
                        : activite.modeMesure === "JALON"
                          ? mesure.jalonAtteint
                          : (mesure.quantiteJour ?? 0) > 0
                    }
                  />
                </div>

                <div className="mt-3">
                  <ChampTexte name={`activites.${rang}.observation`} libelle={t("avancement.observation")} />
                </div>

                {depasse && (
                  <div className="mt-2">
                    <Signal ton="avertissement" icone={<TriangleAlert />}>
                      {t("avancement.depassement")}
                    </Signal>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <ChampTexte
          name={`lotsTravailles.${rangPoint}.observation`}
          libelle={t("avancement.pointLot")}
          aide={t("avancement.pointLotAide")}
          multiligne
          lignes={2}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Les équipes affectées à la feuille qui ont réalisé le travail aujourd'hui (garde-fou A3).
 */
function ChampEquipesActivite({
  rang,
  activite,
  equipes,
  requis,
}: {
  rang: number;
  activite: ActivitePreparee;
  equipes: EquipeDuJour[];
  requis: boolean;
}) {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const affectees = equipes.filter((equipe) => activite.equipesAffectees.includes(equipe.equipeId));

  return (
    <FormField
      control={control}
      name={`activites.${rang}.equipeIds`}
      render={({ field, fieldState }) => {
        const choisies: string[] = Array.isArray(field.value) ? field.value : [];
        const basculerEquipe = (equipeId: string) => {
          const suivante = choisies.includes(equipeId)
            ? choisies.filter((id) => id !== equipeId)
            : [...choisies, equipeId];
          field.onChange(suivante);
        };

        return (
          <FormItem className="gap-1.5">
            <FormLabel className="flex items-center gap-1.5">
              <Users className="size-3.5 text-neutral-500" aria-hidden="true" />
              <span>{t("avancement.equipesIntervenantes")}</span>
              {requis && <Requis />}
            </FormLabel>
            {affectees.length === 0 ? (
              <Signal ton="avertissement">{t("avancement.aucuneEquipeAffectee")}</Signal>
            ) : (
              <div className="flex flex-wrap gap-2">
                {affectees.map((equipe) => {
                  const choisie = choisies.includes(equipe.equipeId);
                  return (
                    <button
                      key={equipe.equipeId}
                      type="button"
                      aria-pressed={choisie}
                      onClick={() => basculerEquipe(equipe.equipeId)}
                      className={cn(
                        "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        choisie
                          ? "border-primary-500 bg-primary-50 text-primary-800"
                          : cn(
                              "bg-card text-neutral-700 hover:bg-neutral-50",
                              fieldState.error ? "border-erreur" : "border-neutral-200",
                            ),
                      )}
                    >
                      {choisie && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                      <span>{equipe.nom}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function SelecteurAjout({
  ouvert,
  onOuvrir,
  libelle,
  recherche,
  aucunResultat,
  options,
  onBasculer,
}: {
  ouvert: boolean;
  onOuvrir: (ouvert: boolean) => void;
  libelle: string;
  recherche: string;
  aucunResultat: string;
  options: { id: string; titre: string; detail: string; choisi: boolean }[];
  onBasculer: (id: string) => void;
}) {
  return (
    <Popover open={ouvert} onOpenChange={onOuvrir}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={ouvert}
          className="border-primary-200 bg-primary-50 text-primary-700 hover:border-primary-300 hover:bg-primary-100 hover:text-primary-800"
        >
          <Plus aria-hidden="true" />
          {libelle}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] p-0" align="end">
        <Command>
          <CommandInput placeholder={recherche} />
          <CommandList>
            <CommandEmpty>{aucunResultat}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.titre} ${option.id}`}
                  onSelect={() => onBasculer(option.id)}
                  className="items-start"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border",
                      option.choisi ? "border-primary bg-primary text-primary-foreground" : "border-neutral-300",
                    )}
                  >
                    {option.choisi && <Check className="size-3" aria-hidden="true" />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{option.titre}</span>
                    <span className="text-xs text-neutral-500">{option.detail}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

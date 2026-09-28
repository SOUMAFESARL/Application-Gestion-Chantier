"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleX, LoaderCircle, TriangleAlert, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { affecterEquipe } from "@/features/projets/adaptateur";
import {
  activitesAffectables,
  activitesDuProjet,
  chevauchementsEquipe,
} from "@/features/projets/regles";
import type { Activite, Equipe, Lot } from "@/features/projets/types";
import { schemaAffectation, type SaisieAffectation } from "@/features/projets/validations";
import type { ErreurApi } from "@/lib/api";
import { formaterJourMoisNumerique } from "@/lib/format";
import { cn } from "@/lib/utils";

const FORM_ID = "form-affectation";

const CHAMP = "h-[var(--input-height-md)]";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  projetId: string;
  lots: Lot[];
  equipes: Equipe[];
  /** L'activité présélectionnée — depuis une ligne de la liste. */
  activiteIdInitiale?: string;
  /** L'équipe présélectionnée — depuis le bouton « Affecter » d'une carte. */
  equipeIdInitiale?: string;
  onAffectee: (activite: Activite) => void;
}

function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

/**
 * L'affectation d'une équipe à une activité du chantier.
 *
 * On y arrive de trois endroits : « Nouvelle affectation » (rien de choisi),
 * une ligne de la liste (l'activité est choisie) ou le bouton « Affecter »
 * d'une équipe (l'équipe est choisie). Les activités terminées ne sont pas
 * proposées (`activitesAffectables`).
 *
 * Avant de valider, le tiroir dit si l'équipe est déjà prise sur la même
 * période (`chevauchementsEquipe`) : un avertissement, pas un refus.
 *
 * L'écran le remonte à chaque ouverture (`key`).
 */
export function TiroirAffectation({
  ouverte,
  onFermer,
  projetId,
  lots,
  equipes,
  activiteIdInitiale = "",
  equipeIdInitiale,
  onAffectee,
}: Props) {
  const t = useTranslations("projets.equipesAffectations.formAffectation");
  const tEcran = useTranslations("projets.equipesAffectations");
  const tLots = useTranslations("projets.lotsActivites");
  const [erreur, setErreur] = useState<string | null>(null);
  const [retrait, setRetrait] = useState(false);

  const activiteInitiale = activitesDuProjet(lots).find(
    (activite) => activite.id === activiteIdInitiale,
  );

  const form = useForm<SaisieAffectation>({
    resolver: zodResolver(schemaAffectation),
    defaultValues: {
      activiteId: activiteIdInitiale,
      equipeId: equipeIdInitiale ?? activiteInitiale?.equipe?.id ?? "",
    },
    mode: "onTouched",
  });

  const [activiteId, equipeId] = useWatch({
    control: form.control,
    name: ["activiteId", "equipeId"],
  });
  const activite = activitesDuProjet(lots).find((candidate) => candidate.id === activiteId);
  const affectables = activitesAffectables(lots, activiteIdInitiale);
  const chevauchements =
    activite && equipeId ? chevauchementsEquipe(lots, equipeId, activite) : [];
  const enCours = form.formState.isSubmitting || retrait;

  async function enregistrer(cible: string, equipe: string | null) {
    setErreur(null);
    try {
      onAffectee(await affecterEquipe(projetId, cible, equipe));
      onFermer();
    } catch (err) {
      const cause = err as ErreurApi;
      setErreur(cause.message || t("erreurGenerique"));
    }
  }

  async function retirer() {
    if (!activite) return;
    setRetrait(true);
    await enregistrer(activite.id, null);
    setRetrait(false);
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg text-neutral-900">
            {activiteInitiale?.equipe ? t("titreModification") : t("titre")}
          </SheetTitle>
          <SheetDescription>{t("sousTitre")}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit((saisie) => enregistrer(saisie.activiteId, saisie.equipeId))}
            noValidate
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 [scrollbar-width:thin]"
          >
            {erreur && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="activiteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("champActivite")} <Requis />
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={enCours}>
                    <FormControl>
                      <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                        <SelectValue placeholder={t("selectionner")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lots.map((lot) => {
                        const duLot = affectables.filter((candidate) => candidate.lotId === lot.id);
                        if (duLot.length === 0) return null;
                        return (
                          <SelectGroup key={lot.id}>
                            <SelectLabel>
                              {tLots("libelleLot", { code: lot.code, nom: lot.nom })}
                            </SelectLabel>
                            {duLot.map((candidate) => (
                              <SelectItem key={candidate.id} value={candidate.id}>
                                {tLots("libelleActivite", {
                                  code: candidate.code,
                                  libelle: candidate.libelle,
                                })}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {activite && (
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-solid border-neutral-200 bg-neutral-50 p-3 text-sm">
                <dt className="text-neutral-500">{t("periode")}</dt>
                <dd className="m-0 text-neutral-900 tabular-nums">
                  {tLots("periode", {
                    debut: formaterJourMoisNumerique(activite.dateDebutPrevue),
                    fin: formaterJourMoisNumerique(activite.dateFinPrevue),
                  })}
                </dd>
                <dt className="text-neutral-500">{t("equipeActuelle")}</dt>
                <dd className="m-0 text-neutral-900">
                  {activite.equipe ? (
                    tLots("libelleEquipe", {
                      nom: activite.equipe.nom,
                      effectif: activite.equipe.effectif,
                    })
                  ) : (
                    <span className="text-avertissement italic">{tEcran("aAffecter")}</span>
                  )}
                </dd>
              </dl>
            )}

            <FormField
              control={form.control}
              name="equipeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("champEquipe")} <Requis />
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={enCours}>
                    <FormControl>
                      <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                        <SelectValue placeholder={t("selectionner")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {equipes.map((equipe) => (
                        <SelectItem key={equipe.id} value={equipe.id}>
                          {tLots("libelleEquipe", { nom: equipe.nom, effectif: equipe.effectif })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {chevauchements.length > 0 && (
              <Alert variant="avertissement">
                <TriangleAlert />
                <AlertDescription>
                  {t("chevauchement", {
                    activites: chevauchements.map((autre) => autre.code).join(", "),
                  })}
                </AlertDescription>
              </Alert>
            )}
          </form>
        </Form>

        <SheetFooter className="flex-row items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          {activite?.equipe && (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-erreur hover:text-erreur"
              onClick={() => void retirer()}
              disabled={enCours}
            >
              {retrait ? <LoaderCircle className="animate-spin" /> : <UserMinus />}
              {t("retirer")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={enCours} aria-busy={enCours}>
            {form.formState.isSubmitting && <LoaderCircle className="animate-spin" />}
            {t("affecter")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

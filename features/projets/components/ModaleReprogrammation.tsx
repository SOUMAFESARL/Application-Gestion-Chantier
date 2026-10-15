"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleX, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import { Textarea } from "@/components/ui/textarea";
import {
  listerMotifsReport,
  reprogrammer,
} from "@/features/projets/adaptateur";
import {
  CLE_LISTE_PROJETS,
  CLE_MOTIFS_REPORT,
  cleHistoriqueDates,
  cleJournalReports,
  cleLots,
  cleProjet,
  cleStatistiques,
} from "@/features/projets/cles";
import type { ResultatReprogrammation } from "@/features/projets/types";
import {
  JUSTIFICATION_MIN,
  schemaReprogrammation,
  versReprogrammation,
  type SaisieReprogrammation,
} from "@/features/projets/validations";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const FORM_ID = "form-reprogrammation";
const CHAMP = "h-[var(--input-height-md)]";

export interface PropsModaleReprogrammation {
  ouverte: boolean;
  onFermer: () => void;
  objet: "projets" | "lots" | "activites";
  id: string;
  nomObjet: string;
  projetId: string;
  datesActuelles: { debut: string | null; fin: string | null };
  datesBaseline?: { debut: string | null; fin: string | null } | null;
  bornesParent?: { debutMin?: string | null; finMax?: string | null } | null;
  onSucces?: (resultat: ResultatReprogrammation) => void;
}

/**
 * Modale de reprogrammation des dates (US 3.8, RG-11).
 *
 * Partagée par les projets, lots et activités :
 * - Date de début (facultative) et date de fin (obligatoire)
 * - Motif du report (liste dynamique du référentiel)
 * - Justification détaillée (≥ 30 caractères)
 * - Rappel du cadre actuel et de la baseline
 * - Signalement DG en cas d'écart baseline.
 */
export function ModaleReprogrammation({
  ouverte,
  onFermer,
  objet,
  id,
  nomObjet,
  projetId,
  datesActuelles,
  datesBaseline,
  bornesParent,
  onSucces,
}: PropsModaleReprogrammation) {
  const t = useTranslations("projets.reprogrammation");
  const clientRequetes = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);

  const requeteMotifs = useQuery({
    queryKey: CLE_MOTIFS_REPORT,
    queryFn: ({ signal }) => listerMotifsReport(signal),
    enabled: ouverte,
  });
  const motifs = useMemo(() => requeteMotifs.data ?? [], [requeteMotifs.data]);

  const schema = useMemo(
    () =>
      schemaReprogrammation({
        debutMin: bornesParent?.debutMin,
        finMax: bornesParent?.finMax,
        typeObjet: objet === "projets" ? "PROJET" : objet === "lots" ? "LOT" : "ACTIVITE",
      }),
    [bornesParent, objet],
  );

  const form = useForm<SaisieReprogrammation>({
    resolver: zodResolver(schema),
    defaultValues: {
      dateDebut: datesActuelles.debut ?? "",
      dateFin: datesActuelles.fin ?? "",
      motifId: "",
      justification: "",
    },
    mode: "onTouched",
  });

  const enCours = form.formState.isSubmitting;
  const justification = useWatch({ control: form.control, name: "justification" }) ?? "";
  const longueur = justification.trim().length;

  async function soumettre(valeurs: SaisieReprogrammation) {
    setErreur(null);
    try {
      const resultat = await reprogrammer(objet, id, versReprogrammation(valeurs));
      toast.success(t("succes"));
      if (resultat.alerteDg) {
        toast.info(t("alerteDg"));
      }

      void clientRequetes.invalidateQueries({ queryKey: cleProjet(projetId) });
      void clientRequetes.invalidateQueries({ queryKey: cleLots(projetId) });
      void clientRequetes.invalidateQueries({ queryKey: cleStatistiques(projetId) });
      void clientRequetes.invalidateQueries({ queryKey: CLE_LISTE_PROJETS });
      void clientRequetes.invalidateQueries({ queryKey: cleHistoriqueDates(objet, id) });
      void clientRequetes.invalidateQueries({ queryKey: cleJournalReports(projetId) });

      onSucces?.(resultat);
      onFermer();
    } catch (err) {
      if (err instanceof ErreurApi) {
        if (err.erreursParChamp) {
          if (err.erreursParChamp.date_debut_prevue) {
            form.setError("dateDebut", { message: err.erreursParChamp.date_debut_prevue });
          }
          if (err.erreursParChamp.date_fin_prevue) {
            form.setError("dateFin", { message: err.erreursParChamp.date_fin_prevue });
          }
          if (err.erreursParChamp.motif_id) {
            form.setError("motifId", { message: err.erreursParChamp.motif_id });
          }
          if (err.erreursParChamp.justification) {
            form.setError("justification", { message: err.erreursParChamp.justification });
          }
        }
        setErreur(err.message || t("erreurGenerique"));
      } else {
        setErreur(t("erreurGenerique"));
      }
    }
  }

  return (
    <Dialog open={ouverte} onOpenChange={(visible) => !visible && onFermer()}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{t("titreObjet", { objet: nomObjet })}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("titreObjet", { objet: nomObjet })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 flex flex-col gap-1">
          <p>
            <span className="font-semibold text-neutral-900">{t("datesActuelles")} : </span>
            {datesActuelles.debut && datesActuelles.fin
              ? t("periode", {
                  debut: formaterDate(datesActuelles.debut),
                  fin: formaterDate(datesActuelles.fin),
                })
              : datesActuelles.fin
                ? formaterDate(datesActuelles.fin)
                : ABSENT}
          </p>
          {datesBaseline && (datesBaseline.debut || datesBaseline.fin) && (
            <p className="text-neutral-500">
              <span className="font-semibold">{t("planningInitial")} : </span>
              {datesBaseline.debut && datesBaseline.fin
                ? t("periode", {
                    debut: formaterDate(datesBaseline.debut),
                    fin: formaterDate(datesBaseline.fin),
                  })
                : datesBaseline.fin
                  ? formaterDate(datesBaseline.fin)
                  : ABSENT}
            </p>
          )}
        </div>

        {erreur && (
          <Alert variant="erreur">
            <CircleX className="size-4" />
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}

        <Form {...form} preRempli>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(soumettre)}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <FormField
                control={form.control}
                name="dateDebut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("debut")}</FormLabel>
                    <FormControl>
                      <SelecteurDate
                        className={CHAMP}
                        valeur={field.value ?? ""}
                        placeholder={t("debut")}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        auPlusTot={bornesParent?.debutMin || undefined}
                        auPlusTard={bornesParent?.finMax || undefined}
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateFin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fin")}</FormLabel>
                    <FormControl>
                      <SelecteurDate
                        className={CHAMP}
                        valeur={field.value ?? ""}
                        placeholder={t("fin")}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        auPlusTot={bornesParent?.debutMin || undefined}
                        auPlusTard={bornesParent?.finMax || undefined}
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="motifId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("motif")}</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={enCours || requeteMotifs.isPending}
                  >
                    <FormControl>
                      <SelectTrigger className={CHAMP}>
                        <SelectValue placeholder={t("motifPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {motifs.map((motif) => (
                        <SelectItem key={motif.id} value={motif.id}>
                          {motif.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>{t("justification")}</FormLabel>
                    <span
                      className={cn(
                        "text-xs",
                        longueur >= JUSTIFICATION_MIN
                          ? "text-neutral-500"
                          : "font-medium text-amber-600",
                      )}
                    >
                      {t("compteur", { actuel: longueur, min: JUSTIFICATION_MIN })}
                    </span>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder={t("justificationAide")}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormDescription>{t("justificationAide")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter className="flex-row justify-end gap-2 max-sm:flex-col-reverse">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler", { defaultValue: "Annuler" })}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={enCours || longueur < JUSTIFICATION_MIN}
            aria-busy={enCours}
          >
            {enCours && <LoaderCircle className="animate-spin" />}
            {t("enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

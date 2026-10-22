"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CircleX, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { Textarea } from "@/components/ui/textarea";
import { cloturerAlerte } from "@/features/alertes/adaptateur";
import type { AlerteRetard } from "@/features/alertes/types";
import {
  COMMENTAIRE_CLOTURE_MIN,
  schemaClotureAlerte,
  type SaisieClotureAlerte,
} from "@/features/alertes/validations";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const FORM_ID = "form-cloture-alerte";

interface Props {
  /** `null` : la modale est fermée. */
  alerte: AlerteRetard | null;
  onFermer: () => void;
  /** Reçoit l'alerte clôturée, telle que le serveur la renvoie. */
  onCloturee: (alerte: AlerteRetard) => void;
}

/**
 * La clôture d'une alerte de retard : un commentaire de dix caractères au
 * moins, que le serveur conserve avec le nom de qui clôture et la date.
 *
 * Un refus du serveur — 403 (ni chef de projet du chantier, ni DO), 422
 * (déjà résolue) — s'affiche dans la modale avec **son** message : c'est lui
 * qui dit pourquoi, et la modale reste ouverte pour qu'on le lise.
 */
export function ModaleClotureAlerte({ alerte, onFermer, onCloturee }: Props) {
  return (
    <Dialog open={alerte !== null} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-[520px]">
        {alerte && <FormulaireCloture alerte={alerte} onFermer={onFermer} onCloturee={onCloturee} />}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Le formulaire vit dans le contenu de la modale : Radix le démonte à la
 * fermeture, donc chaque ouverture repart d'un commentaire vide et sans erreur.
 */
function FormulaireCloture({
  alerte,
  onFermer,
  onCloturee,
}: {
  alerte: AlerteRetard;
  onFermer: () => void;
  onCloturee: (alerte: AlerteRetard) => void;
}) {
  const t = useTranslations("alertes.cloture");

  const form = useForm<SaisieClotureAlerte>({
    resolver: zodResolver(schemaClotureAlerte),
    defaultValues: { commentaire: "" },
    mode: "onTouched",
  });

  const mutation = useMutation({
    mutationFn: (saisie: SaisieClotureAlerte) => cloturerAlerte(alerte.id, saisie.commentaire),
    onSuccess: (cloturee) => {
      toast.success(t("succes"));
      onCloturee(cloturee);
      onFermer();
    },
    onError: (erreur) => {
      const champ = erreur instanceof ErreurApi ? erreur.erreursParChamp.commentaire_resolution : null;
      if (champ) form.setError("commentaire", { message: champ });
    },
  });

  const commentaire = useWatch({ control: form.control, name: "commentaire" }) ?? "";
  const longueur = commentaire.trim().length;
  const erreur = mutation.error;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("titre")}</DialogTitle>
        <DialogDescription>
          {t("description", {
            projet: alerte.projet.nom,
            lot: alerte.lot ? t("cible", { code: alerte.lot.code, libelle: alerte.lot.libelle }) : t("cibleProjet"),
          })}
        </DialogDescription>
      </DialogHeader>

      {erreur && (
        <Alert variant="erreur">
          <CircleX />
          <AlertDescription>
            {erreur instanceof ErreurApi && erreur.message ? erreur.message : t("erreurGenerique")}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit((saisie) => mutation.mutate(saisie))}
          noValidate
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="commentaire"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t("commentaire")}</FormLabel>
                  <span
                    className={cn(
                      "text-xs",
                      longueur >= COMMENTAIRE_CLOTURE_MIN
                        ? "text-neutral-500"
                        : "font-medium text-avertissement",
                    )}
                  >
                    {t("compteur", { actuel: longueur, min: COMMENTAIRE_CLOTURE_MIN })}
                  </span>
                </div>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder={t("commentairePlaceholder")}
                    disabled={mutation.isPending}
                  />
                </FormControl>
                <FormDescription>{t("commentaireAide")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <DialogFooter className="flex-row justify-end gap-2 max-sm:flex-col-reverse">
        <Button type="button" variant="outline" onClick={onFermer} disabled={mutation.isPending}>
          {t("annuler")}
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          disabled={mutation.isPending || longueur < COMMENTAIRE_CLOTURE_MIN}
          aria-busy={mutation.isPending}
        >
          {mutation.isPending && <LoaderCircle className="animate-spin" />}
          {t("confirmer")}
        </Button>
      </DialogFooter>
    </>
  );
}

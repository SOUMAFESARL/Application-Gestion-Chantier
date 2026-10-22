"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Bouton, Modale } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { creerException, supprimerException } from "@/features/calendrier/adaptateur";
import { CLE_CALENDRIER } from "@/features/calendrier/cles";
import { libelleDuJour, MOTIF_EXCEPTION_MAX, sensNouvelleException } from "@/features/calendrier";
import type { Calendrier, StatutJour } from "@/features/calendrier";
import { schemaException } from "@/features/calendrier/validations";
import type { SaisieException } from "@/features/calendrier/validations";
import { ErreurApi } from "@/lib/api";

/** Relie le bouton du pied de modale au formulaire, rendu dans le corps. */
const ID_FORM_EXCEPTION = "form-exception-calendrier";

interface Props {
  /** Le jour cliqué ; `null` : modale fermée. */
  jour: StatutJour | null;
  calendrier: Calendrier;
  onFermer: () => void;
}

/**
 * Le geste sur un jour : le marquer comme non ouvré (ou ouvré) avec un motif
 * obligatoire, ou retirer l'exception qu'il porte déjà.
 *
 * Le sens d'une nouvelle exception est l'inverse de ce qu'est le jour sans elle
 * (`sensNouvelleException`) : une exception qui répéterait le statut de base ne
 * changerait rien. Succès comme échec passent par un toast ; la modale se ferme
 * sur un succès et reste ouverte sur un échec, pour corriger sans tout ressaisir.
 */
export function ModaleException({ jour, calendrier, onFermer }: Props) {
  const t = useTranslations("calendrier");
  const cache = useQueryClient();
  const idMotif = useId();

  const exception = jour?.exception ?? null;
  const ouvre = jour ? sensNouvelleException(jour.date, calendrier) : false;

  const formulaire = useForm<SaisieException>({
    resolver: zodResolver(schemaException),
    defaultValues: { motif: "" },
  });

  // Chaque ouverture repart d'un motif vide.
  const date = jour?.date;
  useEffect(() => {
    formulaire.reset({ motif: "" });
  }, [date, formulaire]);

  function apresEcriture(message: string) {
    void cache.invalidateQueries({ queryKey: CLE_CALENDRIER });
    toast.success(message);
    onFermer();
  }

  function surErreur(cause: unknown) {
    toast.error(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
  }

  const creation = useMutation({
    mutationFn: (saisie: { date: string; ouvre: boolean; motif: string }) => creerException(saisie),
    onSuccess: () => apresEcriture(t("modale.succesCreation")),
    onError: (cause) => {
      if (cause instanceof ErreurApi && cause.erreursParChamp.motif) {
        formulaire.setError("motif", { message: cause.erreursParChamp.motif });
        return;
      }
      surErreur(cause);
    },
  });

  const retrait = useMutation({
    mutationFn: (id: string) => supprimerException(id),
    onSuccess: () => apresEcriture(t("modale.succesRetrait")),
    onError: surErreur,
  });

  const enCours = creation.isPending || retrait.isPending;
  const erreurMotif = formulaire.formState.errors.motif?.message;
  const idErreurMotif = `${idMotif}-erreur`;
  const motifSaisi = useWatch({ control: formulaire.control, name: "motif" }) ?? "";

  const titre = !jour
    ? ""
    : exception
      ? t("modale.titreRetrait", { date: libelleDuJour(jour.date) })
      : t(ouvre ? "modale.titreOuvre" : "modale.titreNonOuvre", { date: libelleDuJour(jour.date) });

  return (
    <Modale
      ouverte={jour !== null}
      titre={titre}
      libelleFermeture={t("modale.fermer")}
      onFermer={enCours ? undefined : onFermer}
      actions={
        <>
          <Bouton variante="ghost" disabled={enCours} onClick={onFermer}>
            {t("modale.annuler")}
          </Bouton>
          {exception ? (
            <Bouton
              variante="danger"
              enCours={retrait.isPending}
              onClick={() => retrait.mutate(exception.id)}
            >
              {retrait.isPending ? t("modale.retraitEnCours") : t("modale.retirer")}
            </Bouton>
          ) : (
            <Bouton
              variante="primaire"
              type="submit"
              form={ID_FORM_EXCEPTION}
              enCours={creation.isPending}
            >
              {creation.isPending ? t("modale.enCours") : t("modale.confirmer")}
            </Bouton>
          )}
        </>
      }
    >
      {jour && exception && (
        <div className="flex flex-col gap-2">
          <p>
            {exception.ouvre ? t("modale.exceptionOuvre") : t("modale.exceptionNonOuvre")}
          </p>
          <p className="font-semibold text-neutral-900">{exception.motif}</p>
          <p className="text-neutral-600">{t("modale.aideRetrait")}</p>
        </div>
      )}

      {jour && !exception && (
        <form
          id={ID_FORM_EXCEPTION}
          noValidate
          onSubmit={formulaire.handleSubmit((valeurs) =>
            creation.mutate({ date: jour.date, ouvre, motif: valeurs.motif }),
          )}
          className="flex flex-col gap-3"
        >
          <p className="text-neutral-600">
            {ouvre ? t("modale.descriptionOuvre") : t("modale.descriptionNonOuvre")}
          </p>
          <label
            className="flex flex-col gap-1.5 text-sm font-semibold text-neutral-800"
            htmlFor={idMotif}
          >
            {t("modale.motif")}
            <Input
              id={idMotif}
              {...formulaire.register("motif")}
              placeholder={t("modale.motifPlaceholder")}
              maxLength={MOTIF_EXCEPTION_MAX}
              disabled={enCours}
              aria-invalid={erreurMotif ? true : undefined}
              aria-describedby={erreurMotif ? idErreurMotif : undefined}
            />
          </label>
          {erreurMotif ? (
            <p id={idErreurMotif} className="-mt-2 text-xs font-medium text-erreur">
              {erreurMotif}
            </p>
          ) : (
            <p className="-mt-2 text-xs text-neutral-500">
              {t("modale.aideMotif", { n: motifSaisi.length, max: MOTIF_EXCEPTION_MAX })}
            </p>
          )}
        </form>
      )}
    </Modale>
  );
}

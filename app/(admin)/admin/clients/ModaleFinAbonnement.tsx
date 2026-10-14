"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Bouton, Modale } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import { ZonePreRemplie } from "@/components/ui/form";
import { aujourdhuiIso, premiereEcheancePossible } from "@/features/administration";
import type { ClientPlateforme } from "@/features/administration";
import { modifierFinAbonnement } from "@/features/administration/adaptateur";
import { schemaFinAbonnement } from "@/features/administration/validations";
import type {
  SaisieFinAbonnement,
  ValeursFinAbonnement,
} from "@/features/administration/validations";
import { useLibellePlan } from "@/features/plateforme/hooks";
import { ErreurApi } from "@/lib/api";
import { formaterDate } from "@/lib/format";

import { CLES_ADMINISTRATION } from "../cles";

/** Relie le bouton du pied de modale au formulaire, rendu dans le corps. */
const ID_FORM_FIN_ABONNEMENT = "form-fin-abonnement";

/** Le calendrier s'ouvre hors de la modale (`z-100`) : il doit passer devant. */
const CALENDRIER_AU_DESSUS_DE_LA_MODALE = "z-110";

/**
 * Les dates du serveur sont des jours (`2026-10-05`), lus en minuit UTC par
 * `new Date` : les relire en UTC rend le jour exact, quel que soit le fuseau
 * du poste.
 */
function versIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface Props {
  /** Le client dont on modifie l'échéance ; `null` : modale fermée. */
  client: ClientPlateforme | null;
  onFermer: () => void;
}

/**
 * La modification de la date de fin d'abonnement d'un client.
 *
 * Succès comme échec passent par un toast : la modale se ferme sur un succès,
 * reste ouverte sur un échec pour qu'on corrige sans tout ressaisir.
 */
export function ModaleFinAbonnement({ client, onFermer }: Props) {
  const t = useTranslations("administration");
  const libellePlan = useLibellePlan();
  const cache = useQueryClient();
  const idDate = useId();
  const idMotif = useId();

  const dateDebut = client ? versIso(client.abonnement.dateDebut) : "";
  const aujourdhui = aujourdhuiIso();
  const schema = useMemo(
    () => schemaFinAbonnement(dateDebut, aujourdhui),
    [dateDebut, aujourdhui],
  );

  const formulaire = useForm<SaisieFinAbonnement, unknown, ValeursFinAbonnement>({
    resolver: zodResolver(schema),
    defaultValues: { dateFin: "", motif: "" },
  });

  // Chaque ouverture repart de l'échéance actuelle du client visé et vide le motif.
  useEffect(() => {
    if (client) {
      formulaire.reset({
        dateFin: versIso(client.abonnement.dateFin),
        motif: "",
      });
    }
  }, [client, formulaire]);

  const enregistrement = useMutation({
    mutationFn: ({ cible, valeurs }: { cible: ClientPlateforme; valeurs: ValeursFinAbonnement }) =>
      modifierFinAbonnement(cible.id, valeurs.dateFin, valeurs.motif),
    onSuccess: (clientMisAJour) => {
      cache.setQueryData(CLES_ADMINISTRATION.client(clientMisAJour.id), clientMisAJour);
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.clients() });
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.indicateurs() });
      toast.success(
        t("finAbonnement.succes", {
          client: clientMisAJour.nomCommercial,
          date: formaterDate(clientMisAJour.abonnement.dateFin),
        }),
      );
      onFermer();
    },
    onError: (cause) => {
      if (
        cause instanceof ErreurApi &&
        (cause.erreursParChamp.date_fin || cause.erreursParChamp.motif)
      ) {
        if (cause.erreursParChamp.date_fin) {
          formulaire.setError("dateFin", { message: cause.erreursParChamp.date_fin });
        }
        if (cause.erreursParChamp.motif) {
          formulaire.setError("motif", { message: cause.erreursParChamp.motif });
        }
        return;
      }
      toast.error(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
    },
  });

  const erreurDate = formulaire.formState.errors.dateFin?.message;
  const idErreurDate = `${idDate}-erreur`;
  const erreurMotif = formulaire.formState.errors.motif?.message;
  const idErreurMotif = `${idMotif}-erreur`;

  const dateAuPlusTot = useMemo(
    () => (dateDebut ? premiereEcheancePossible(dateDebut, aujourdhui) : aujourdhui),
    [dateDebut, aujourdhui],
  );

  return (
    <Modale
      ouverte={client !== null}
      titre={client ? t("finAbonnement.titre", { client: client.nomCommercial }) : ""}
      onFermer={onFermer}
      actions={
        <>
          <Bouton variante="ghost" onClick={onFermer}>
            {t("finAbonnement.annuler")}
          </Bouton>
          <Bouton
            variante="primaire"
            type="submit"
            form={ID_FORM_FIN_ABONNEMENT}
            enCours={enregistrement.isPending}
          >
            {enregistrement.isPending ? t("finAbonnement.enCours") : t("finAbonnement.confirmer")}
          </Bouton>
        </>
      }
    >
      {client && (
        <form
          id={ID_FORM_FIN_ABONNEMENT}
          noValidate
          onSubmit={formulaire.handleSubmit((valeurs) =>
            enregistrement.mutate({ cible: client, valeurs }),
          )}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-neutral-600">
            {t("finAbonnement.description", {
              plan: libellePlan(client.abonnement.plan),
              debut: formaterDate(client.abonnement.dateDebut),
            })}
          </p>
          <p className="text-xs text-neutral-500">{t("finAbonnement.aideMotif")}</p>
          {client.abonnement.statut === "ESSAI" && (
            <p className="text-xs font-medium text-primaire">{t("finAbonnement.aideEssai")}</p>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-neutral-800" htmlFor={idDate}>
              {t("finAbonnement.date")}
            </label>
            <ZonePreRemplie control={formulaire.control} nom="dateFin">
              <Controller
                control={formulaire.control}
                name="dateFin"
                render={({ field }) => (
                  <SelecteurDate
                    id={idDate}
                    valeur={field.value}
                    onChange={field.onChange}
                    placeholder={t("finAbonnement.datePlaceholder")}
                    auPlusTot={dateAuPlusTot}
                    classeCalendrier={CALENDRIER_AU_DESSUS_DE_LA_MODALE}
                    disabled={enregistrement.isPending}
                    aria-invalid={erreurDate ? true : undefined}
                    aria-describedby={erreurDate ? idErreurDate : undefined}
                  />
                )}
              />
            </ZonePreRemplie>
            {erreurDate && (
              <p id={idErreurDate} className="text-xs font-medium text-erreur">
                {erreurDate}
              </p>
            )}
          </div>
          <label
            className="flex flex-col gap-1.5 text-sm font-semibold text-neutral-800"
            htmlFor={idMotif}
          >
            {t("finAbonnement.motif")}
            <Input
              id={idMotif}
              {...formulaire.register("motif")}
              placeholder={t("finAbonnement.motifPlaceholder")}
              disabled={enregistrement.isPending}
              aria-invalid={erreurMotif ? true : undefined}
              aria-describedby={erreurMotif ? idErreurMotif : undefined}
            />
          </label>
          {erreurMotif && (
            <p id={idErreurMotif} className="text-xs font-medium text-erreur">
              {erreurMotif}
            </p>
          )}
        </form>
      )}
    </Modale>
  );
}

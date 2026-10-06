"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Bouton, Modale } from "@/components/ui";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
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

  const dateDebut = client ? versIso(client.abonnement.dateDebut) : "";
  const schema = useMemo(() => schemaFinAbonnement(dateDebut), [dateDebut]);

  const formulaire = useForm<SaisieFinAbonnement, unknown, ValeursFinAbonnement>({
    resolver: zodResolver(schema),
    defaultValues: { dateFin: "" },
  });

  // Chaque ouverture repart de l'échéance actuelle du client visé.
  useEffect(() => {
    if (client) formulaire.reset({ dateFin: versIso(client.abonnement.dateFin) });
  }, [client, formulaire]);

  const enregistrement = useMutation({
    mutationFn: ({ cible, dateFin }: { cible: ClientPlateforme; dateFin: string }) =>
      modifierFinAbonnement(cible.id, dateFin, cible.abonnement.statut === "ESSAI"),
    onSuccess: (_, { cible, dateFin }) => {
      // La liste, la fiche et la vue d'ensemble comptent toutes les échéances.
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.clients() });
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.indicateurs() });
      toast.success(
        t("finAbonnement.succes", { client: cible.nomCommercial, date: formaterDate(dateFin) }),
      );
      onFermer();
    },
    onError: (cause) => {
      toast.error(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
    },
  });

  const erreur = formulaire.formState.errors.dateFin?.message;
  const idErreur = `${idDate}-erreur`;

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
          onSubmit={formulaire.handleSubmit(({ dateFin }) =>
            enregistrement.mutate({ cible: client, dateFin }),
          )}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-neutral-600">
            {t("finAbonnement.description", {
              plan: libellePlan(client.abonnement.plan),
              debut: formaterDate(client.abonnement.dateDebut),
            })}
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-neutral-800" htmlFor={idDate}>
              {t("finAbonnement.date")}
            </label>
            <Controller
              control={formulaire.control}
              name="dateFin"
              render={({ field }) => (
                <SelecteurDate
                  id={idDate}
                  valeur={field.value}
                  onChange={field.onChange}
                  placeholder={t("finAbonnement.datePlaceholder")}
                  auPlusTot={dateDebut}
                  classeCalendrier={CALENDRIER_AU_DESSUS_DE_LA_MODALE}
                  disabled={enregistrement.isPending}
                  aria-invalid={erreur ? true : undefined}
                  aria-describedby={erreur ? idErreur : undefined}
                />
              )}
            />
            {erreur && (
              <p id={idErreur} className="text-xs font-medium text-erreur">
                {erreur}
              </p>
            )}
          </div>
        </form>
      )}
    </Modale>
  );
}

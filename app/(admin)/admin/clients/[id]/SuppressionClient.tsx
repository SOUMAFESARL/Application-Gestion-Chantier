"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Alerte, Bouton, Modale } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ClientPlateforme } from "@/features/administration";
import {
  lireApercuSuppression,
  supprimerClientDefinitivement,
} from "@/features/administration/adaptateur";
import { refusSuppression } from "@/features/administration/regles";
import {
  schemaSuppressionClient,
  type ValeursSuppressionClient,
} from "@/features/administration/validations";
import { ErreurApi } from "@/lib/api";

import { CLES_ADMINISTRATION } from "../../cles";
import { CARTE, CARTE_TITRE } from "../../tons";

/**
 * La zone dangereuse de la fiche : supprimer définitivement une entreprise.
 *
 * **Réservée au superviseur** et masquée pour le SUPPORT.
 * L'aperçu est chargé dès l'affichage de la carte pour expliquer immédiatement
 * tout motif de refus avant le moindre clic.
 */
export function SuppressionClient({ client }: { client: ClientPlateforme }) {
  const t = useTranslations("administration.suppressionDefinitive");
  const cache = useQueryClient();
  const routeur = useRouter();

  const [ouverte, setOuverte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const apercu = useQuery({
    queryKey: CLES_ADMINISTRATION.apercuSuppression(client.id),
    queryFn: () => lireApercuSuppression(client.id),
  });

  const donnees = apercu.data;
  const slug = donnees?.slug ?? client.slug;
  const motifMin = donnees?.motifLongueurMin ?? 20;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isValid },
  } = useForm<ValeursSuppressionClient>({
    resolver: zodResolver(schemaSuppressionClient(slug, motifMin)),
    mode: "onChange",
    defaultValues: {
      motif: "",
      confirmation: "",
    },
  });

  const suppression = useMutation({
    mutationFn: (valeurs: ValeursSuppressionClient) =>
      supprimerClientDefinitivement(client.id, valeurs.confirmation, valeurs.motif),
    onSuccess: (resultat) => {
      toast.success(
        t("succes", { client: client.nomCommercial, fichier: resultat.sauvegarde }),
      );
      cache.removeQueries({ queryKey: CLES_ADMINISTRATION.client(client.id) });
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.clients() });
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.indicateurs() });
      routeur.replace("/admin/clients");
    },
    onError: (cause) =>
      setErreur(cause instanceof ErreurApi ? cause.message : t("erreur")),
  });

  function fermer() {
    if (suppression.isPending) return;
    setOuverte(false);
    reset();
    setErreur(null);
  }

  const motifValeur = useWatch({ control, name: "motif" }) ?? "";
  const refus = donnees ? refusSuppression(donnees) : null;

  return (
    <>
      <section className={`${CARTE} border-erreur lg:col-span-3`}>
        <h2 className={CARTE_TITRE}>{t("titre")}</h2>

        {apercu.isPending && (
          <p className="text-sm text-neutral-600">{t("chargementApercu")}</p>
        )}

        {apercu.isError && (
          <Alerte type="erreur">{t("erreurApercu")}</Alerte>
        )}

        {donnees && refus === "protegee" && (
          <Alerte type="information">{t("refus.protegee")}</Alerte>
        )}

        {donnees && refus === "desactivee" && (
          <Alerte type="information">{t("refus.desactivee")}</Alerte>
        )}

        {donnees && refus === "nonSuspendue" && (
          <div className="flex flex-col gap-3">
            <Alerte type="avertissement">{t("refus.nonSuspendue")}</Alerte>
            <div>
              <Bouton
                variante="danger"
                taille="sm"
                disabled
                iconeGauche={<Trash size={16} />}
              >
                {t("ouvrir")}
              </Bouton>
            </div>
          </div>
        )}

        {donnees && refus === null && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-neutral-600">{t("description")}</p>
            <div>
              <Bouton
                variante="danger"
                taille="sm"
                iconeGauche={<Trash size={16} />}
                onClick={() => {
                  setErreur(null);
                  setOuverte(true);
                }}
              >
                {t("ouvrir")}
              </Bouton>
            </div>
          </div>
        )}
      </section>

      {donnees && (
        <Modale
          ouverte={ouverte}
          titre={t("titreModale", { client: client.nomCommercial })}
          onFermer={suppression.isPending ? undefined : fermer}
          actions={
            <>
              <Bouton
                variante="ghost"
                onClick={fermer}
                disabled={suppression.isPending}
              >
                {t("annuler")}
              </Bouton>
              <Bouton
                variante="danger"
                disabled={!isValid || suppression.isPending}
                enCours={suppression.isPending}
                onClick={handleSubmit((valeurs) => {
                  setErreur(null);
                  suppression.mutate(valeurs);
                })}
              >
                {suppression.isPending ? t("enCours") : t("confirmer")}
              </Bouton>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Alerte type="erreur">{t("avertissement")}</Alerte>

            <p className="text-sm text-neutral-600">
              {t("sauvegarde", { jours: donnees.sauvegardeConserveeJours })}
            </p>

            <p className="text-sm text-neutral-600">{t("courrielDirigeant")}</p>

            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-700">
              <li>{t("compteUtilisateurs", { nombre: donnees.nbUtilisateurs })}</li>
              <li>{t("compteProjets", { nombre: donnees.nbProjets })}</li>
              {donnees.nbPaiements > 0 && (
                <li>{t("comptePaiements", { nombre: donnees.nbPaiements })}</li>
              )}
            </ul>

            {donnees.adresses.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-neutral-800">
                  {t("adressesLiberees", { nombre: donnees.adresses.length })}
                </p>
                <ul className="flex max-h-32 flex-col gap-0.5 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  {donnees.adresses.map((adresse) => (
                    <li key={adresse}>{adresse}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="suppression-motif"
                className="text-sm font-medium text-neutral-800"
              >
                {t("motif")}
              </label>
              <Textarea
                id="suppression-motif"
                placeholder={t("motifPlaceholder")}
                disabled={suppression.isPending}
                {...register("motif")}
              />
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{t("motifAide")}</span>
                <span>
                  {t("motifCompteur", {
                    n: motifValeur.length,
                    min: donnees.motifLongueurMin,
                  })}
                </span>
              </div>
              {errors.motif && (
                <p className="text-sm text-erreur">{errors.motif.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="suppression-confirmation"
                className="text-sm font-medium text-neutral-800"
              >
                {t("saisie", { slug: donnees.slug })}
              </label>
              <Input
                id="suppression-confirmation"
                placeholder={donnees.slug}
                autoComplete="off"
                disabled={suppression.isPending}
                {...register("confirmation")}
              />
              {errors.confirmation && (
                <p className="text-sm text-erreur">
                  {errors.confirmation.message}
                </p>
              )}
            </div>

            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          </div>
        </Modale>
      )}
    </>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useForm, useWatch } from "react-hook-form";

import { LogoPlateforme } from "@/components/layout/LogoPlateforme";
import { Alerte, Bouton, Champ, EtatChargement, EtatErreur } from "@/components/ui";
import {
  FORMATS_LOGO_PLATEFORME,
  peutParametrerPlateforme,
  refusLogo,
} from "@/features/administration";
import { modifierIdentite } from "@/features/administration/adaptateur";
import { schemaIdentitePlateforme } from "@/features/administration/validations";
import type {
  SaisieIdentitePlateforme,
  ValeursIdentitePlateforme,
} from "@/features/administration/validations";
import { CLES_PLATEFORME } from "@/features/plateforme";
import { useIdentitePlateforme } from "@/features/plateforme/hooks";
import { ErreurApi } from "@/lib/api";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CARTE } from "../../tons";

const ACCEPT_LOGO = FORMATS_LOGO_PLATEFORME.join(",");

/**
 * Ce qu'on a fait du logo depuis le dernier enregistrement.
 *
 * Trois états et non un simple fichier : « rien touché » et « revenu au logo
 * par défaut » donnent tous deux un fichier absent, et le serveur doit
 * pourtant les distinguer (`retirer_logo`).
 */
type ChoixLogo =
  | { type: "inchange" }
  | { type: "nouveau"; fichier: File; apercu: string }
  | { type: "retire" };

/**
 * Le nom et le logo sous lesquels la plateforme se présente.
 *
 * L'aperçu reproduit **la barre latérale telle qu'elle sera** — signe et nom
 * côte à côte, à la taille réelle — plutôt qu'un logo agrandi : c'est à 28 px
 * qu'un logo trop détaillé devient illisible, et c'est là qu'il faut le voir.
 */
export function EcranIdentite() {
  const t = useTranslations("administration");
  const profil = useAdministrateur();
  const cache = useQueryClient();
  const peutAgir = peutParametrerPlateforme(profil);

  const [choix, setChoix] = useState<ChoixLogo>({ type: "inchange" });
  const [erreurLogo, setErreurLogo] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const requete = useIdentitePlateforme();

  const formulaire = useForm<SaisieIdentitePlateforme, unknown, ValeursIdentitePlateforme>({
    resolver: zodResolver(schemaIdentitePlateforme),
    defaultValues: { nom: "" },
  });
  const { reset } = formulaire;

  useEffect(() => {
    if (requete.data) reset({ nom: requete.data.nom });
  }, [requete.data, reset]);

  // L'URL d'aperçu d'un fichier local tient de la mémoire tant qu'on ne la
  // libère pas : on la rend dès qu'un autre choix la remplace.
  useEffect(() => {
    if (choix.type !== "nouveau") return;
    return () => URL.revokeObjectURL(choix.apercu);
  }, [choix]);

  const enregistrement = useMutation({
    mutationFn: (valeurs: ValeursIdentitePlateforme) =>
      modifierIdentite({
        nom: valeurs.nom,
        logo: choix.type === "nouveau" ? choix.fichier : null,
        retirerLogo: choix.type === "retire",
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: CLES_PLATEFORME.identite() });
      setChoix({ type: "inchange" });
      setErreur(null);
      setSucces(true);
    },
    onError: (cause) => {
      setSucces(false);
      setErreur(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
    },
  });

  const nomSaisi = useWatch({ control: formulaire.control, name: "nom" });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) {
    return (
      <EtatErreur message={t("erreurs.chargement")} onReessayer={() => void requete.refetch()} />
    );
  }

  const identite = requete.data;
  const logoAffiche =
    choix.type === "nouveau" ? choix.apercu : choix.type === "retire" ? null : identite.logo;
  const modifie = formulaire.formState.isDirty || choix.type !== "inchange";
  const verrouille = !peutAgir || enregistrement.isPending;

  function choisirLogo(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    // Vidé tout de suite : choisir deux fois le même fichier doit redéclencher `change`.
    evenement.target.value = "";
    if (!fichier) return;

    const refus = refusLogo(fichier);
    if (refus) {
      setErreurLogo(refus === "FORMAT" ? t("parametres.identite.logoFormatInvalide") : t("parametres.identite.logoTropLourd"));
      return;
    }
    setErreurLogo(null);
    setSucces(false);
    setChoix({ type: "nouveau", fichier, apercu: URL.createObjectURL(fichier) });
  }

  function annuler() {
    reset({ nom: identite.nom });
    setChoix({ type: "inchange" });
    setErreurLogo(null);
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={formulaire.handleSubmit((valeurs) => {
        setSucces(false);
        setErreur(null);
        enregistrement.mutate(valeurs);
      })}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <section className={CARTE}>
          <Champ
            libelle={t("parametres.identite.nom")}
            required
            maxLength={40}
            disabled={verrouille}
            erreur={formulaire.formState.errors.nom?.message}
            {...formulaire.register("nom")}
          />

          <span className="mb-2 block text-sm font-semibold text-neutral-800">{t("parametres.identite.logo")}</span>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
              <LogoPlateforme logo={logoAffiche} taille={56} />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <label
                  className={
                    verrouille
                      ? "inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-400"
                      : "inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-300 bg-neutral-0 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-within:border-primary-500"
                  }
                >
                  <input
                    type="file"
                    accept={ACCEPT_LOGO}
                    className="sr-only"
                    disabled={verrouille}
                    onChange={choisirLogo}
                  />
                  <Upload size={16} aria-hidden="true" />
                  {logoAffiche ? t("parametres.identite.logoRemplacer") : t("parametres.identite.logoChoisir")}
                </label>
                {logoAffiche && (
                  <Bouton
                    variante="ghost"
                    taille="sm"
                    disabled={verrouille}
                    iconeGauche={<RotateCcw size={16} aria-hidden="true" />}
                    onClick={() => {
                      setErreurLogo(null);
                      setSucces(false);
                      setChoix({ type: "retire" });
                    }}
                  >
                    {t("parametres.identite.logoRetirer")}
                  </Bouton>
                )}
              </div>
              {!logoAffiche && (
                <span className="text-xs font-medium text-neutral-700">{t("parametres.identite.logoParDefaut")}</span>
              )}
              <span className="text-xs text-neutral-500">{t("parametres.identite.logoContrainte")}</span>
            </div>
          </div>
          {erreurLogo && <p className="mt-2 text-sm text-erreur">{erreurLogo}</p>}
        </section>

        <section className={CARTE}>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            {t("parametres.identite.apercu")}
          </h3>
          <div className="flex items-center gap-2 rounded-md bg-sidebar p-2">
            <LogoPlateforme logo={logoAffiche} taille={28} />
            <span className="truncate text-base font-bold tracking-tight text-sidebar-accent-foreground">
              {nomSaisi.trim() || identite.nom}
            </span>
          </div>
        </section>
      </div>

      {succes && !modifie && <Alerte type="succes">{t("parametres.identite.succes")}</Alerte>}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {peutAgir && (
        <div className="flex flex-wrap justify-end gap-2">
          <Bouton variante="ghost" disabled={!modifie || enregistrement.isPending} onClick={annuler}>
            {t("parametres.identite.annuler")}
          </Bouton>
          <Bouton
            type="submit"
            variante="primaire"
            disabled={!modifie}
            enCours={enregistrement.isPending}
          >
            {enregistrement.isPending ? t("parametres.identite.enCours") : t("parametres.identite.enregistrer")}
          </Bouton>
        </div>
      )}
    </form>
  );
}

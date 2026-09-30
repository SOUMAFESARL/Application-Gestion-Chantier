"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { Alerte, Badge, Bouton, Champ, EtatChargement, EtatErreur } from "@/components/ui";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  BasculePeriodicite,
  CadreForfait,
} from "@/features/abonnement/components/CadreForfait";
import { PLANS_DISPONIBLES } from "@/features/abonnement/types";
import type { Periodicite } from "@/features/abonnement/types";
import { peutParametrerPlateforme } from "@/features/administration";
import type { TarifPlan } from "@/features/administration";
import { modifierTarifs } from "@/features/administration/adaptateur";
import {
  LONGUEUR_MAX_AVANTAGE,
  LONGUEUR_MAX_NOM_PLAN,
  NOMBRE_MAX_AVANTAGES,
  REMISE_MAX_POURCENT,
  schemaTarifs,
} from "@/features/administration/validations";
import type { SaisieTarifs, ValeursTarifs } from "@/features/administration/validations";
import { CLES_PLATEFORME, prixAnnuelAvecRemise } from "@/features/plateforme";
import { useTarifsPlateforme } from "@/features/plateforme/hooks";
import { ErreurApi } from "@/lib/api";
import { centimesEnFrancs, formaterMontant } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useAdministrateur } from "../../ContexteAdministrateur";

const CENTIMES_PAR_FRANC = 100;

/** Hors du JSX : `no-literal-string` y verrait un libellé. */
const SYMBOLE_POURCENT = "%";

type FormulaireTarifs = UseFormReturn<SaisieTarifs, unknown, ValeursTarifs>;
type SaisieTarif = SaisieTarifs["tarifs"][number];

/**
 * Le champ discret d'une ligne de la carte : il se lit comme le texte de la
 * page de vente, et ne montre son cadre qu'au survol et à la saisie.
 */
const CHAMP_EN_LIGNE =
  "h-8 min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-neutral-800 outline-none transition-colors hover:border-neutral-300 hover:bg-neutral-0 focus:border-primary-500 focus:bg-neutral-0 disabled:hover:border-transparent disabled:hover:bg-transparent aria-invalid:border-erreur";

/** Le champ d'un quota : un nombre court, cadré en permanence pour qu'on le voie éditable. */
const CHAMP_QUOTA =
  "h-8 w-20 rounded-md border border-neutral-300 bg-neutral-0 px-2 text-right text-sm font-semibold tabular-nums text-neutral-900 outline-none focus:border-primary-500 disabled:bg-neutral-50 aria-invalid:border-erreur";

function saisieDe(tarifs: TarifPlan[]): SaisieTarifs {
  return {
    tarifs: tarifs.map((tarif) => ({
      code: tarif.code,
      libelle: tarif.libelle,
      prixMensuel: centimesEnFrancs(tarif.prixMensuelCentimes),
      remiseAnnuelle: tarif.remiseAnnuellePourcent,
      chantiersIllimites: tarif.limiteChantiers === null,
      // `NaN` : le champ se rouvre vide si l'agent décoche « illimité ».
      limiteChantiers: tarif.limiteChantiers ?? Number.NaN,
      utilisateursIllimites: tarif.limiteUtilisateurs === null,
      limiteUtilisateurs: tarif.limiteUtilisateurs ?? Number.NaN,
      limiteStockageGo: tarif.limiteStockageGo,
      avantages: tarif.avantages.map((avantage) => ({ ...avantage })),
    })),
  };
}

/** L'annuel d'une saisie en cours, ou `null` tant qu'un des deux chiffres manque. */
function annuelSaisi(saisie: SaisieTarif): number | null {
  if (!Number.isFinite(saisie.prixMensuel) || !Number.isFinite(saisie.remiseAnnuelle)) return null;
  return prixAnnuelAvecRemise(saisie.prixMensuel * CENTIMES_PAR_FRANC, saisie.remiseAnnuelle);
}

/**
 * Les forfaits de la page d'abonnement de l'espace entreprise : prix, remise
 * annuelle, quotas et avantages.
 *
 * **Chaque plan s'édite dans la carte même que le client verra**
 * (`CadreForfait`, partagé avec la page de tarifs) : le prix s'affiche en
 * grand, à la périodicité choisie au-dessus, et chaque ligne de la liste se
 * modifie en place. Ce n'est pas un tableau de données : rien à filtrer ni à
 * exporter.
 *
 * On saisit le **mensuel et une remise** ; l'annuel s'en déduit
 * (`prixAnnuelAvecRemise`) et part calculé au serveur, qui le débite tel quel.
 *
 * Tout est relu depuis la route **publique** (`useTarifsPlateforme`), celle de
 * la page de tarifs : ce que l'agent voit ici est ce que les clients voient,
 * pas une copie.
 */
export function EcranTarifs() {
  const t = useTranslations("administration");
  const tVente = useTranslations("abonnement.tarifs");
  const profil = useAdministrateur();
  const cache = useQueryClient();
  const peutAgir = peutParametrerPlateforme(profil);
  const [erreur, setErreur] = useState<string | null>(null);
  const [periodicite, setPeriodicite] = useState<Periodicite>("MENSUELLE");

  const requete = useTarifsPlateforme();

  const formulaire = useForm<SaisieTarifs, unknown, ValeursTarifs>({
    resolver: zodResolver(schemaTarifs),
    defaultValues: { tarifs: [] },
  });
  const { reset } = formulaire;

  useEffect(() => {
    if (requete.data) reset(saisieDe(requete.data));
  }, [requete.data, reset]);

  const enregistrement = useMutation({
    mutationFn: (valeurs: ValeursTarifs) =>
      modifierTarifs(
        valeurs.tarifs.map((tarif) => {
          const mensuel = tarif.prixMensuel * CENTIMES_PAR_FRANC;
          return {
            code: tarif.code,
            libelle: tarif.libelle,
            prixMensuelCentimes: mensuel,
            remiseAnnuellePourcent: tarif.remiseAnnuelle,
            prixAnnuelCentimes: prixAnnuelAvecRemise(mensuel, tarif.remiseAnnuelle),
            limiteChantiers: tarif.chantiersIllimites ? null : tarif.limiteChantiers,
            limiteUtilisateurs: tarif.utilisateursIllimites ? null : tarif.limiteUtilisateurs,
            limiteStockageGo: tarif.limiteStockageGo,
            avantages: tarif.avantages,
          };
        }),
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: CLES_PLATEFORME.tarifs() });
      setErreur(null);
      toast.success(t("parametres.tarifs.succes"));
    },
    onError: (cause) => {
      setErreur(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
    },
  });

  const saisies = useWatch({ control: formulaire.control, name: "tarifs" });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) {
    return (
      <EtatErreur message={t("erreurs.chargement")} onReessayer={() => void requete.refetch()} />
    );
  }

  const { isDirty } = formulaire.formState;
  const verrouille = !peutAgir || enregistrement.isPending;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={formulaire.handleSubmit((valeurs) => {
        setErreur(null);
        enregistrement.mutate(valeurs);
      })}
    >
      <div className="flex flex-col items-center gap-2">
        <BasculePeriodicite<Periodicite>
          valeur={periodicite}
          onChange={setPeriodicite}
          options={[
            { valeur: "MENSUELLE", libelle: tVente("facturationMensuelle") },
            { valeur: "ANNUELLE", libelle: tVente("facturationAnnuelle") },
          ]}
        />
        <p className="text-xs text-neutral-500">{t("parametres.tarifs.apercu")}</p>
      </div>

      <div className="grid w-full gap-5 lg:grid-cols-3 lg:items-start lg:pt-9">
        {saisies.map((saisie, rang) => (
          <CarteTarif
            key={saisie.code}
            formulaire={formulaire}
            rang={rang}
            saisie={saisie}
            periodicite={periodicite}
            verrouille={verrouille}
          />
        ))}
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {peutAgir && (
        <div className="flex flex-wrap justify-end gap-2">
          <Bouton
            variante="ghost"
            disabled={!isDirty || enregistrement.isPending}
            onClick={() => requete.data && reset(saisieDe(requete.data))}
          >
            {t("parametres.tarifs.annuler")}
          </Bouton>
          <Bouton
            type="submit"
            variante="primaire"
            disabled={!isDirty}
            enCours={enregistrement.isPending}
          >
            {enregistrement.isPending ? t("parametres.tarifs.enCours") : t("parametres.tarifs.enregistrer")}
          </Bouton>
        </div>
      )}
    </form>
  );
}

/** Un forfait, dans la carte de la page de vente, éditable en place. */
function CarteTarif({
  formulaire,
  rang,
  saisie,
  periodicite,
  verrouille,
}: {
  formulaire: FormulaireTarifs;
  rang: number;
  saisie: SaisieTarif;
  periodicite: Periodicite;
  verrouille: boolean;
}) {
  const t = useTranslations("administration.parametres.tarifs");
  const tVente = useTranslations("abonnement.tarifs");
  const tPlans = useTranslations("abonnement.plan");
  const definition = PLANS_DISPONIBLES.find((plan) => plan.code === saisie.code);
  const erreurs = formulaire.formState.errors.tarifs?.[rang];
  const annuel = annuelSaisi(saisie);
  const mensuel = Number.isFinite(saisie.prixMensuel)
    ? saisie.prixMensuel * CENTIMES_PAR_FRANC
    : null;
  const affiche = periodicite === "ANNUELLE" ? annuel : mensuel;
  const erreurQuota =
    erreurs?.limiteChantiers?.message ??
    erreurs?.limiteUtilisateurs?.message ??
    erreurs?.limiteStockageGo?.message;

  return (
    <CadreForfait
      populaire={definition?.etiquette === "POPULAIRE"}
      libellePopulaire={tVente("populaire")}
    >
      <div>
        <div className="flex items-center gap-2">
          <h3 className="m-0 min-w-0 flex-1">
            <input
              aria-label={t("nomPlan", { code: saisie.code })}
              aria-invalid={Boolean(erreurs?.libelle)}
              maxLength={LONGUEUR_MAX_NOM_PLAN}
              disabled={verrouille}
              className={cn(CHAMP_EN_LIGNE, "-ml-2 w-full font-medium text-neutral-600")}
              {...formulaire.register(`tarifs.${rang}.libelle`)}
            />
          </h3>
          {definition?.etiquette === "GRANDS_COMPTES" && (
            <Badge variante="secondaire">{tVente("grandsComptes")}</Badge>
          )}
        </div>
        {erreurs?.libelle?.message && (
          <p className="text-xs text-erreur">{erreurs.libelle.message}</p>
        )}
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight text-neutral-900">
            {affiche === null ? t("prixIncomplet") : formaterMontant(affiche)}
          </span>
          <span className="text-xs text-neutral-600">
            {periodicite === "ANNUELLE" ? tVente("parAn") : tVente("parMois")}
          </span>
        </div>
        {saisie.remiseAnnuelle > 0 && (
          <p className="mt-2 inline-flex rounded-full border border-succes/30 bg-succes-fond px-2 py-0.5 text-xs font-medium text-succes">
            {tVente("remiseAnnuelle", { valeur: saisie.remiseAnnuelle })}
          </p>
        )}
        <p className="mt-2 text-sm text-neutral-700">{tPlans(`${saisie.code}.accroche`)}</p>
      </div>

      {/* Là où la page de vente pose son bouton « Passer au forfait » : les
          deux chiffres qui fixent le prix. */}
      <div className="grid grid-cols-[1fr_7rem] gap-x-3 rounded-lg bg-neutral-0/70 p-3 ring-1 ring-primary-100">
        <Champ
          taille="md"
          className="mb-0"
          libelle={t("prixMensuel")}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          disabled={verrouille}
          erreur={erreurs?.prixMensuel?.message}
          {...formulaire.register(`tarifs.${rang}.prixMensuel`, { valueAsNumber: true })}
        />
        <Champ
          taille="md"
          className="mb-0"
          libelle={t("remiseAnnuelle")}
          type="number"
          inputMode="numeric"
          min={0}
          max={REMISE_MAX_POURCENT}
          step={1}
          required
          disabled={verrouille}
          erreur={erreurs?.remiseAnnuelle?.message}
          iconeDroite={<span className="text-sm text-neutral-500">{SYMBOLE_POURCENT}</span>}
          {...formulaire.register(`tarifs.${rang}.remiseAnnuelle`, { valueAsNumber: true })}
        />
        {annuel !== null && (
          <p className="col-span-2 mt-2 text-xs text-neutral-600">
            {t("soitAnnuel", { montant: formaterMontant(annuel) })}
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        <LigneQuota
          formulaire={formulaire}
          rang={rang}
          champ="limiteChantiers"
          illimite="chantiersIllimites"
          estIllimite={saisie.chantiersIllimites}
          unite={t("uniteChantiers")}
          libelleIllimite={tVente("chantiersIllimites")}
          verrouille={verrouille}
          enErreur={Boolean(erreurs?.limiteChantiers)}
        />
        <LigneQuota
          formulaire={formulaire}
          rang={rang}
          champ="limiteUtilisateurs"
          illimite="utilisateursIllimites"
          estIllimite={saisie.utilisateursIllimites}
          unite={t("uniteUtilisateurs")}
          libelleIllimite={tVente("utilisateursIllimites")}
          verrouille={verrouille}
          enErreur={Boolean(erreurs?.limiteUtilisateurs)}
        />
        <LigneQuota
          formulaire={formulaire}
          rang={rang}
          champ="limiteStockageGo"
          unite={t("uniteStockage")}
          verrouille={verrouille}
          enErreur={Boolean(erreurs?.limiteStockageGo)}
        />
        {erreurQuota && <li className="pl-6.5 text-xs text-erreur">{erreurQuota}</li>}
      </ul>

      <EditeurAvantages formulaire={formulaire} rang={rang} verrouille={verrouille} />
    </CadreForfait>
  );
}

/**
 * Une ligne de quota : la coche de la page de vente, le nombre éditable, et
 * pour les chantiers et utilisateurs la case « illimité ».
 */
function LigneQuota({
  formulaire,
  rang,
  champ,
  illimite,
  estIllimite = false,
  unite,
  libelleIllimite,
  verrouille,
  enErreur,
}: {
  formulaire: FormulaireTarifs;
  rang: number;
  champ: "limiteChantiers" | "limiteUtilisateurs" | "limiteStockageGo";
  illimite?: "chantiersIllimites" | "utilisateursIllimites";
  estIllimite?: boolean;
  unite: string;
  libelleIllimite?: string;
  verrouille: boolean;
  enErreur: boolean;
}) {
  const t = useTranslations("administration.parametres.tarifs");

  return (
    <li className="flex min-h-8 items-center gap-2.5 text-sm text-neutral-800">
      <Check size={16} className="shrink-0 text-neutral-700" aria-hidden="true" />
      {estIllimite ? (
        <span className="flex-1 font-medium">{libelleIllimite}</span>
      ) : (
        <label className="flex flex-1 items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            disabled={verrouille}
            aria-invalid={enErreur}
            className={CHAMP_QUOTA}
            {...formulaire.register(`tarifs.${rang}.${champ}`, { valueAsNumber: true })}
          />
          <span>{unite}</span>
        </label>
      )}
      {illimite && (
        <Controller
          control={formulaire.control}
          name={`tarifs.${rang}.${illimite}`}
          render={({ field }) => (
            <RadioGroup
              className="flex shrink-0 items-center gap-3"
              value={field.value ? "illimite" : "limite"}
              onValueChange={(valeur) => field.onChange(valeur === "illimite")}
              disabled={verrouille}
              aria-label={unite}
            >
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600">
                <RadioGroupItem value="limite" className="bg-neutral-0" />
                {t("limite")}
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600">
                <RadioGroupItem value="illimite" className="bg-neutral-0" />
                {t("illimite")}
              </label>
            </RadioGroup>
          )}
        />
      )}
    </li>
  );
}

/**
 * Les avantages d'un plan, dans la liste même de la carte de vente.
 *
 * La coche de gauche bascule la ligne entre « inclus » et « non inclus »
 * (croix grise, texte barré) : c'est exactement ce que la page de vente
 * affichera, pour que l'agent n'ait pas à l'imaginer.
 */
function EditeurAvantages({
  formulaire,
  rang,
  verrouille,
}: {
  formulaire: FormulaireTarifs;
  rang: number;
  verrouille: boolean;
}) {
  const t = useTranslations("administration.parametres.tarifs");
  const { fields, append, remove } = useFieldArray({
    control: formulaire.control,
    name: `tarifs.${rang}.avantages`,
  });
  const avantages = useWatch({ control: formulaire.control, name: `tarifs.${rang}.avantages` });
  const erreurs = formulaire.formState.errors.tarifs?.[rang]?.avantages;
  const complet = fields.length >= NOMBRE_MAX_AVANTAGES;

  return (
    <div className="flex flex-col gap-2 pt-1">
      <p className="text-xs text-neutral-500">{t("avantagesAide")}</p>

      <ul className="flex flex-col gap-1">
        {fields.map((champ, indice) => {
          const inclus = avantages?.[indice]?.inclus ?? true;
          const message = erreurs?.[indice]?.libelle?.message;
          const numero = indice + 1;

          return (
            <li key={champ.id} className="group flex flex-col">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={verrouille}
                  aria-pressed={inclus}
                  aria-label={inclus ? t("marquerNonInclus") : t("marquerInclus")}
                  title={inclus ? t("marquerNonInclus") : t("marquerInclus")}
                  className={cn(
                    "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 transition-colors disabled:cursor-default",
                    inclus
                      ? "bg-succes-fond text-succes hover:bg-succes/20"
                      : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200",
                  )}
                  onClick={() =>
                    formulaire.setValue(`tarifs.${rang}.avantages.${indice}.inclus`, !inclus, {
                      shouldDirty: true,
                    })
                  }
                >
                  {inclus ? (
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <X size={14} strokeWidth={3} aria-hidden="true" />
                  )}
                </button>
                <input
                  aria-label={t("avantageLibelle", { numero })}
                  aria-invalid={Boolean(message)}
                  placeholder={t("avantagePlaceholder")}
                  maxLength={LONGUEUR_MAX_AVANTAGE}
                  disabled={verrouille}
                  className={cn(CHAMP_EN_LIGNE, "flex-1", !inclus && "text-neutral-400 line-through")}
                  {...formulaire.register(`tarifs.${rang}.avantages.${indice}.libelle`)}
                />
                {!verrouille && (
                  <button
                    type="button"
                    aria-label={t("retirerAvantage", { numero })}
                    title={t("retirerAvantage", { numero })}
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-neutral-400 opacity-60 transition hover:bg-erreur-fond hover:text-erreur hover:opacity-100 group-focus-within:opacity-100"
                    onClick={() => remove(indice)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              {message && <p className="pl-8 text-xs text-erreur">{message}</p>}
            </li>
          );
        })}
      </ul>

      {fields.length === 0 && (
        <p className="px-3 py-3 text-center text-xs text-neutral-500">
          {t("aucunAvantage")}
        </p>
      )}

      {!verrouille && (
        <button
          type="button"
          disabled={complet}
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border-0 bg-neutral-0 px-3 py-2 text-sm font-medium text-primary-700 shadow-sm transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => append({ libelle: "", inclus: true }, { shouldFocus: true })}
        >
          <Plus size={16} aria-hidden="true" />
          {complet ? t("avantagesMax", { max: NOMBRE_MAX_AVANTAGES }) : t("ajouterAvantage")}
        </button>
      )}
    </div>
  );
}

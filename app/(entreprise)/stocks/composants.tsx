"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFieldArray, useForm, useFormContext, useWatch } from "react-hook-form";

import { Modale } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { schemaMotif, schemaSeuil, lireQuantite } from "@/features/stocks/validations";
import type { FormulaireMotif } from "@/features/stocks/validations";
import type { Materiau } from "@/features/stocks";
import { formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CHAMP } from "./classes";

const FORM_MOTIF = "form-motif";

/** L'astérisque d'un champ obligatoire. */
export function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

/** Une ligne d'un formulaire à articles. */
interface LigneFormulaire {
  materiauId: string;
  quantite: string;
}

/**
 * Les lignes « article + quantité » d'une DA ou d'un BC. Chaque article ne se
 * choisit qu'une fois ; l'unité s'affiche à côté de la quantité, et le reste
 * disponible (`plafonds`) sous la ligne quand il y en a un.
 */
export function LignesArticles({
  materiaux,
  plafonds,
  desactive = false,
}: {
  materiaux: Materiau[];
  /** Le reste à commander d'une DA, par article. */
  plafonds?: Map<string, number>;
  desactive?: boolean;
}) {
  const t = useTranslations("stocks.lignes");
  const { control } = useFormContext<{ lignes: LigneFormulaire[] }>();
  const { fields, append, remove } = useFieldArray({ control, name: "lignes" });
  const lignes = useWatch({ control, name: "lignes" }) ?? [];
  const choisis = new Set(lignes.map((l) => l.materiauId));

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-neutral-900">
        {t("titre")} <Requis />
      </legend>
      {fields.map((champ, index) => {
        const materiau = materiaux.find((m) => m.id === lignes[index]?.materiauId);
        const plafond = materiau ? plafonds?.get(materiau.id) : undefined;
        const options = materiaux
          .filter((m) => m.id === lignes[index]?.materiauId || !choisis.has(m.id))
          .map((m) => ({ valeur: m.id, libelle: `${m.code} — ${m.designation}`, groupe: t(`nature.${m.nature}`) }));
        return (
          <div key={champ.id} className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-3">
            <div className="flex items-start gap-2 max-[480px]:flex-col max-[480px]:items-stretch">
              <FormField
                control={control}
                name={`lignes.${index}.materiauId`}
                render={({ field }) => (
                  <FormItem className="min-w-0 flex-1">
                    <FormLabel className="sr-only">{t("article")}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={options}
                        valeur={field.value}
                        onChange={field.onChange}
                        placeholder={t("choisirArticle")}
                        placeholderRecherche={t("rechercherArticle")}
                        aucunResultat={t("aucunArticle")}
                        className={cn(CHAMP, "w-full")}
                        disabled={desactive}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-start gap-2">
                <FormField
                  control={control}
                  name={`lignes.${index}.quantite`}
                  render={({ field }) => (
                    <FormItem className="w-32">
                      <FormLabel className="sr-only">{t("quantite")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            inputMode="decimal"
                            placeholder={t("quantitePlaceholder")}
                            className={cn(CHAMP, "pr-12 text-right tabular-nums")}
                            disabled={desactive}
                          />
                          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-neutral-500">
                            {materiau?.unite}
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={desactive || fields.length === 1}
                  aria-label={t("retirer")}
                  title={t("retirer")}
                  className="mt-0.5 text-neutral-500 hover:text-erreur"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            {plafond !== undefined && materiau && (
              <p
                className={cn(
                  "m-0 text-xs",
                  (lireQuantite(lignes[index]?.quantite ?? "") ?? 0) > plafond ? "text-erreur" : "text-neutral-500",
                )}
              >
                {t("plafond", { quantite: formaterQuantite(plafond), unite: materiau.unite })}
              </p>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ materiauId: "", quantite: "" })}
        disabled={desactive || fields.length >= materiaux.length}
        className="self-start"
      >
        <Plus />
        {t("ajouter")}
      </Button>
    </fieldset>
  );
}

/**
 * Un geste qui exige un motif — annuler une DA ou un BC, clôturer un BC
 * partiel, rejeter une livraison. Le motif est journalisé : il n'est jamais
 * facultatif (RG-STK-07).
 */
export function ModaleMotif({
  ouverte,
  titre,
  description,
  libelleAction,
  danger = false,
  onFermer,
  onConfirmer,
}: {
  ouverte: boolean;
  titre: string;
  description: string;
  libelleAction: string;
  danger?: boolean;
  onFermer: () => void;
  /** Rend `true` si le geste a abouti : la modale se ferme alors. */
  onConfirmer: (motif: string) => Promise<boolean>;
}) {
  const t = useTranslations("stocks.motif");
  const form = useForm<FormulaireMotif>({ resolver: zodResolver(schemaMotif), defaultValues: { motif: "" } });
  const enCours = form.formState.isSubmitting;

  async function soumettre(valeurs: FormulaireMotif) {
    if (await onConfirmer(valeurs.motif.trim())) onFermer();
  }

  return (
    <Modale
      ouverte={ouverte}
      titre={titre}
      onFermer={enCours ? undefined : onFermer}
      actions={
        <>
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button
            type="submit"
            form={FORM_MOTIF}
            variant={danger ? "destructive" : "default"}
            disabled={enCours}
            aria-busy={enCours}
          >
            {enCours && <LoaderCircle className="animate-spin" />}
            {libelleAction}
          </Button>
        </>
      }
    >
      <form id={FORM_MOTIF} onSubmit={form.handleSubmit(soumettre)} noValidate className="flex flex-col gap-3">
        <p className="m-0 text-sm text-neutral-600">{description}</p>
        <label htmlFor="motif" className="text-sm font-medium text-neutral-900">
          {t("libelle")} <Requis />
        </label>
        <Textarea
          id="motif"
          rows={3}
          placeholder={t("placeholder")}
          disabled={enCours}
          aria-invalid={form.formState.errors.motif ? true : undefined}
          {...form.register("motif")}
        />
        {form.formState.errors.motif && (
          <p className="m-0 text-sm text-erreur">{form.formState.errors.motif.message}</p>
        )}
      </form>
    </Modale>
  );
}

/**
 * Le seuil d'alerte d'un matériau sur un lot (RG-STK-09) : celui du
 * référentiel est proposé, on l'accepte d'un clic ou on le modifie.
 */
export function ModaleSeuil({
  ouverte,
  titre,
  seuilPropose,
  unite,
  onFermer,
  onEnregistrer,
}: {
  ouverte: boolean;
  titre: string;
  seuilPropose: number;
  unite: string;
  onFermer: () => void;
  onEnregistrer: (seuil: number) => Promise<boolean>;
}) {
  const t = useTranslations("stocks.seuil");
  const [saisie, setSaisie] = useState(String(seuilPropose));
  const [enCours, setEnCours] = useState(false);
  const erreur = schemaSeuil.safeParse({ seuil: saisie }).success ? null : t("invalide");

  async function enregistrer() {
    const valeur = lireQuantite(saisie);
    if (valeur === null) return;
    setEnCours(true);
    const fait = await onEnregistrer(valeur);
    setEnCours(false);
    if (fait) onFermer();
  }

  return (
    <Modale
      ouverte={ouverte}
      titre={titre}
      onFermer={enCours ? undefined : onFermer}
      actions={
        <>
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button type="button" onClick={() => void enregistrer()} disabled={enCours || erreur !== null} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {t("enregistrer")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-neutral-600">{t("description", { seuil: formaterQuantite(seuilPropose), unite })}</p>
        <label htmlFor="seuil-lot" className="text-sm font-medium text-neutral-900">
          {t("libelle", { unite })}
        </label>
        <Input
          id="seuil-lot"
          value={saisie}
          onChange={(evenement) => setSaisie(evenement.target.value)}
          inputMode="decimal"
          className={cn(CHAMP, "w-40 tabular-nums")}
          disabled={enCours}
          aria-invalid={erreur ? true : undefined}
        />
        {erreur && <p className="m-0 text-sm text-erreur">{erreur}</p>}
      </div>
    </Modale>
  );
}

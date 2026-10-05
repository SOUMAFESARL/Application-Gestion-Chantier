"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { useFormContext, useFormState } from "react-hook-form";
import type { FieldPath } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelecteurHeure } from "@/components/ui/SelecteurHeure";
import { Textarea } from "@/components/ui/textarea";
import type { ValeursRapport } from "@/features/chantier/validations";
import { cn } from "@/lib/utils";

/**
 * Les briques de l'écran de saisie — pensées pour un téléphone tenu d'une
 * main sur un chantier : une colonne sous 640 px, claviers numériques, et des
 * choix courts en puces plutôt qu'en listes déroulantes (un pouce rate une
 * liste, pas un bouton). Les champs gardent le gabarit des autres formulaires
 * du produit (`CHAMP`).
 */

export type CheminRapport = FieldPath<ValeursRapport>;

/** La hauteur des champs, des listes et des sélecteurs — celle des formulaires des projets. */
export const CHAMP = "h-[var(--input-height-md)]";

/** Deux champs côte à côte à partir de 640 px, empilés en dessous. */
export const RANGEE = "grid grid-cols-1 gap-3 sm:grid-cols-2";
export const RANGEE_TROIS = "grid grid-cols-1 gap-3 sm:grid-cols-3";
/** Deux champs courts restent côte à côte, même sur téléphone. */
export const PAIRE = "grid grid-cols-2 gap-3";

export function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

/** Une section du rapport : un titre numéroté, et son contenu. */
export function CarteSection({
  id,
  numero,
  titre,
  complement,
  description,
  erreur,
  children,
}: {
  id: string;
  /** Les six rubriques du journal sont numérotées ; la journée et la synthèse qui les encadrent, non. */
  numero?: number;
  titre: string;
  complement?: ReactNode;
  description?: ReactNode;
  /** L'erreur qui porte sur la section entière (« aucune quantité saisie »). */
  erreur?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className={cn(
        "scroll-mt-32 rounded-xl lg:scroll-mt-48 border bg-card p-4 shadow-xs sm:p-5",
        erreur ? "border-erreur" : "border-neutral-200",
      )}
    >
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id={`${id}-titre`} className="m-0 flex-1 text-base font-semibold text-neutral-900">
          {numero !== undefined && <span className="mr-1 text-neutral-400 tabular-nums">{numero}.</span>}
          {titre}
        </h2>
        {complement}
        {description && <p className="m-0 w-full text-sm text-neutral-500">{description}</p>}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
      {erreur && (
        <p role="alert" className="m-0 mt-3 text-sm font-medium text-erreur">
          {erreur}
        </p>
      )}
    </section>
  );
}

/**
 * Un bloc d'une rubrique (« Matériaux reçus » dans « Matériaux /
 * approvisionnement ») : un sous-titre, et un filet qui le sépare du précédent.
 */
export function SousRubrique({
  titre,
  complement,
  description,
  erreur,
  children,
}: {
  /** Sans titre, le bloc n'a pas d'en-tête : le titre de la rubrique suffit. */
  titre?: string;
  complement?: ReactNode;
  description?: ReactNode;
  erreur?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4 first:border-t-0 first:pt-0">
      {(titre || complement || description) && (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {titre && <h3 className="m-0 flex-1 text-sm font-semibold text-neutral-900">{titre}</h3>}
          {complement}
          {description && <p className="m-0 w-full text-xs text-neutral-500">{description}</p>}
        </header>
      )}
      {children}
      {erreur && (
        <p role="alert" className="m-0 text-sm font-medium text-erreur">
          {erreur}
        </p>
      )}
    </div>
  );
}

/** L'erreur qu'un tableau de lignes porte à sa racine, quelle que soit la forme qu'en donne le résolveur. */
export function useErreurSection(nom: CheminRapport): string | undefined {
  const { errors } = useFormState<ValeursRapport>({ name: nom });
  const brute = nom.split(".").reduce<unknown>((noeud, cle) => (noeud as Record<string, unknown> | undefined)?.[cle], errors) as
    | { message?: string; root?: { message?: string } }
    | undefined;
  return brute?.message ?? brute?.root?.message;
}

export interface OptionPuce<T extends string> {
  valeur: T;
  libelle: string;
  detail?: string;
  /** La teinte de l'option choisie. */
  ton?: "neutre" | "succes" | "avertissement" | "erreur" | "information";
}

const TON_CHOISI: Record<NonNullable<OptionPuce<string>["ton"]>, string> = {
  neutre: "border-primary-500 bg-primary-50 text-primary-800",
  succes: "border-succes bg-succes-fond text-succes",
  avertissement: "border-avertissement bg-avertissement-fond text-avertissement",
  erreur: "border-erreur bg-erreur-fond text-erreur",
  information: "border-information bg-information-fond text-information",
};

/** Un choix unique en puces — le pendant tactile d'un groupe de boutons radio. */
export function ChoixPuces<T extends string>({
  options,
  valeur,
  onChange,
  libelle,
  colonnes = "auto",
  desactive,
  invalide,
}: {
  options: readonly OptionPuce<T>[];
  valeur: T | "";
  onChange: (valeur: T) => void;
  libelle: string;
  /** `auto` : les puces s'enroulent ; un nombre : une grille fixe. */
  colonnes?: "auto" | 2 | 3 | 4;
  desactive?: boolean;
  invalide?: boolean;
}) {
  const grille =
    colonnes === "auto"
      ? "flex flex-wrap"
      : { 2: "grid grid-cols-2", 3: "grid grid-cols-3", 4: "grid grid-cols-2 sm:grid-cols-4" }[colonnes];
  return (
    <div role="radiogroup" aria-label={libelle} aria-invalid={invalide} className={cn(grille, "gap-2")}>
      {options.map((option) => {
        const choisi = option.valeur === valeur;
        return (
          <button
            key={option.valeur}
            type="button"
            role="radio"
            aria-checked={choisi}
            disabled={desactive}
            onClick={() => onChange(option.valeur)}
            className={cn(
              "flex min-h-[var(--input-height-md)] cursor-pointer flex-col items-start justify-center rounded-md border px-3 py-1 text-left text-sm font-medium transition-colors",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
              choisi
                ? TON_CHOISI[option.ton ?? "neutre"]
                : cn("bg-card text-neutral-700 hover:bg-neutral-50", invalide ? "border-erreur" : "border-neutral-200"),
            )}
          >
            <span>{option.libelle}</span>
            {option.detail && <span className="text-xs font-normal opacity-80">{option.detail}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Un champ de choix en puces, branché sur le formulaire. */
export function ChampPuces<T extends string>({
  name,
  libelle,
  options,
  colonnes,
  requis,
  masquerLibelle,
}: {
  name: CheminRapport;
  libelle: string;
  options: readonly OptionPuce<T>[];
  colonnes?: "auto" | 2 | 3 | 4;
  requis?: boolean;
  masquerLibelle?: boolean;
}) {
  const { control } = useFormContext<ValeursRapport>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="gap-1.5">
          <FormLabel className={cn(masquerLibelle && "sr-only")}>
            {libelle} {requis && <Requis />}
          </FormLabel>
          <ChoixPuces
            options={options}
            valeur={(field.value as T | "") ?? ""}
            onChange={field.onChange}
            libelle={libelle}
            colonnes={colonnes}
            invalide={!!fieldState.error}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Un champ texte du rapport — une ligne, ou plusieurs. */
export function ChampTexte({
  name,
  libelle,
  requis,
  multiligne,
  lignes = 3,
  suffixe,
  aide,
  className,
  masquerLibelle,
  ...props
}: {
  name: CheminRapport;
  libelle: string;
  requis?: boolean;
  multiligne?: boolean;
  lignes?: number;
  /** L'unité affichée au bout du champ (« m³ », « h »). */
  suffixe?: string;
  aide?: ReactNode;
  className?: string;
  masquerLibelle?: boolean;
} & Pick<
  ComponentProps<"input">,
  "type" | "inputMode" | "placeholder" | "autoComplete" | "enterKeyHint" | "min" | "max" | "list"
>) {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("gap-1.5", className)}>
          <FormLabel className={cn(masquerLibelle && "sr-only")}>
            {libelle} {requis && <Requis />}
          </FormLabel>
          {multiligne ? (
            <FormControl>
              <Textarea {...field} value={String(field.value ?? "")} rows={lignes} placeholder={props.placeholder} />
            </FormControl>
          ) : props.type === "time" ? (
            <FormControl>
              <SelecteurHeure
                valeur={String(field.value ?? "")}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={props.placeholder ?? t("choisirHeure")}
                className={CHAMP}
              />
            </FormControl>
          ) : (
            <div className="relative">
              <FormControl>
                <Input
                  {...field}
                  {...props}
                  value={String(field.value ?? "")}
                  className={cn(CHAMP, suffixe && "pr-12")}
                />
              </FormControl>
              {suffixe && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-neutral-500">
                  {suffixe}
                </span>
              )}
            </div>
          )}
          {aide && <p className="m-0 text-xs text-neutral-500">{aide}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Un nombre entier qu'on ajuste au pouce : − / champ / +. */
export function ChampCompteur({
  name,
  libelle,
  requis,
  min = 0,
  max,
}: {
  name: CheminRapport;
  libelle: string;
  requis?: boolean;
  min?: number;
  max?: number;
}) {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const actuel = Number.parseInt(String(field.value ?? ""), 10);
        const ajuster = (pas: number) => {
          const suivant = (Number.isNaN(actuel) ? 0 : actuel) + pas;
          if (suivant < min || (max !== undefined && suivant > max)) return;
          field.onChange(String(suivant));
        };
        return (
          <FormItem className="gap-1.5">
            <FormLabel>
              {libelle} {requis && <Requis />}
            </FormLabel>
            <div className="flex items-stretch gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label={t("moins", { champ: libelle })}
                onClick={() => ajuster(-1)}
              >
                <Minus aria-hidden="true" />
              </Button>
              <FormControl>
                <Input
                  {...field}
                  value={String(field.value ?? "")}
                  inputMode="numeric"
                  className={cn(CHAMP, "min-w-0 text-center tabular-nums")}
                />
              </FormControl>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label={t("plus", { champ: libelle })}
                onClick={() => ajuster(1)}
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/** Une ligne d'une liste répétable (un incident, un engin) — une carte, pas une rangée de tableau. */
export function CarteLigne({
  titre,
  complement,
  onSupprimer,
  libelleSupprimer,
  children,
}: {
  titre: ReactNode;
  complement?: ReactNode;
  onSupprimer?: () => void;
  libelleSupprimer: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold text-neutral-900">{titre}</span>
        {complement}
        {onSupprimer && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-erreur hover:bg-erreur-fond hover:text-erreur"
            aria-label={libelleSupprimer}
            onClick={onSupprimer}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function BoutonAjout({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full border-dashed text-primary-700"
      onClick={onClick}
      disabled={disabled}
    >
      <Plus aria-hidden="true" />
      {children}
    </Button>
  );
}

/** Une ligne d'information sous un champ, dans la teinte de son importance. */
export function Signal({ ton, icone, children }: { ton: "information" | "avertissement" | "erreur" | "succes"; icone?: ReactNode; children: ReactNode }) {
  const teinte = {
    information: "bg-information-fond text-information",
    avertissement: "bg-avertissement-fond text-avertissement",
    erreur: "bg-erreur-fond text-erreur",
    succes: "bg-succes-fond text-succes",
  }[ton];
  return (
    <p className={cn("m-0 flex items-start gap-2 rounded-lg px-3 py-2 text-sm", teinte)}>
      {icone && <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icone}</span>}
      <span>{children}</span>
    </p>
  );
}

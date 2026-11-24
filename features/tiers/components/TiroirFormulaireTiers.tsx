"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, LoaderCircle, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { ComboboxVille } from "@/components/metier/ComboboxVille";
import { Alerte, Bouton } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PAYS_TELEPHONE_DEFAUT } from "@/features/referentiels/telephone";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

import { creerTiers, modifierTiers } from "../adaptateur";
import { CLES_TIERS } from "../cles";
import { ROLES_TIERS, TYPES_TIERS, type RoleTiers, type Tiers } from "../types";
import {
  LONGUEUR_MAX_ADRESSE,
  LONGUEUR_MAX_NIF,
  LONGUEUR_MAX_RAISON_SOCIALE,
  LONGUEUR_MAX_RCCM,
  saisieDepuisTiers,
  saisieTiersVide,
  schemaTiers,
  versDemandeTiers,
  type SaisieTiers,
  type ValeursTiers,
} from "../validations";

const FORM_TIERS_ID = "formulaire-tiers";

function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

/**
 * Tiroir de création ou d'édition d'un tiers.
 *
 * Utilise `ChampTelephone` (E.164 + indicatifs), `ComboboxVille` (référentiel
 * du pays de l'entreprise) et la sélection multi-rôles.
 */
export function TiroirFormulaireTiers({
  tiers,
  pays,
  onFermer,
  onEnregistre,
}: {
  /** `null` pour une création, l'objet tiers pour une modification. */
  tiers: Tiers | null;
  pays: string;
  onFermer: () => void;
  onEnregistre?: (tiers: Tiers) => void;
}) {
  const t = useTranslations("tiers.formulaire");
  const tTypes = useTranslations("tiers.types");
  const tRoles = useTranslations("tiers.roles");
  const cache = useQueryClient();

  const paysEffectif = pays || PAYS_TELEPHONE_DEFAUT;
  const enModification = tiers !== null;
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const resolver = useMemo(
    () => zodResolver(schemaTiers(paysEffectif)),
    [paysEffectif],
  );

  const form = useForm<SaisieTiers, unknown, ValeursTiers>({
    resolver,
    defaultValues: tiers ? saisieDepuisTiers(tiers) : saisieTiersVide(),
  });

  const mutation = useMutation({
    mutationFn: (valeurs: ValeursTiers) => {
      const demande = versDemandeTiers(valeurs);
      return enModification
        ? modifierTiers(tiers.id, demande)
        : creerTiers(demande);
    },
    onSuccess: (resultat) => {
      toast.success(
        enModification
          ? t("succesModification", { nom: resultat.raisonSociale })
          : t("succesCreation", { nom: resultat.raisonSociale }),
      );
      void cache.invalidateQueries({ queryKey: CLES_TIERS.tous });
      onEnregistre?.(resultat);
      onFermer();
    },
    onError: (cause) => {
      if (cause instanceof ErreurApi) {
        const champsServeur: Record<string, keyof SaisieTiers> = {
          type_tiers: "typeTiers",
          raison_sociale: "raisonSociale",
          roles: "roles",
          telephone: "telephone",
          email: "email",
          rccm: "rccm",
          nif: "nif",
          adresse: "adresse",
          ville: "ville",
          note_evaluation: "noteEvaluation",
        };
        let auMoinsUnChamp = false;
        for (const [cleServeur, cleForm] of Object.entries(champsServeur)) {
          const msg = cause.details[cleServeur];
          if (msg) {
            const texteMsg = Array.isArray(msg) ? msg[0] : msg;
            if (texteMsg) {
              form.setError(cleForm, { message: texteMsg });
              auMoinsUnChamp = true;
            }
          }
        }
        if (auMoinsUnChamp) {
          setErreurServeur(null);
          return;
        }
        setErreurServeur(cause.message || t("erreur"));
        return;
      }
      setErreurServeur(t("erreur"));
    },
  });

  const enCours = mutation.isPending;

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg text-neutral-900">
            {enModification
              ? t("titreModification", { nom: tiers.raisonSociale })
              : t("titreCreation")}
          </SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Form {...form} preRempli={enModification}>
            <form
              id={FORM_TIERS_ID}
              onSubmit={form.handleSubmit((valeurs) => {
                setErreurServeur(null);
                mutation.mutate(valeurs);
              })}
              noValidate
              className="flex flex-col gap-5"
            >
              {/* Type de tiers */}
              <FormField
                control={form.control}
                name="typeTiers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("typeTiers")} <Requis />
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-2.5">
                      {TYPES_TIERS.map((typeOption) => {
                        const actif = field.value === typeOption;
                        const Icone = typeOption === "ENTREPRISE" ? Building2 : UserRound;
                        return (
                          <button
                            key={typeOption}
                            type="button"
                            disabled={enCours}
                            onClick={() => field.onChange(typeOption)}
                            className={cn(
                              "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                              actif
                                ? "border-primary-600 bg-primary-50/70 text-primary-800"
                                : "border-neutral-200 bg-neutral-0 text-neutral-700 hover:bg-neutral-50",
                            )}
                          >
                            <Icone className="size-4 shrink-0" aria-hidden="true" />
                            <span>{tTypes(typeOption)}</span>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Raison sociale / Nom complet */}
              <FormField
                control={form.control}
                name="raisonSociale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("raisonSociale")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={LONGUEUR_MAX_RAISON_SOCIALE}
                        placeholder={t("raisonSocialePlaceholder")}
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Multi-rôles */}
              <FormField
                control={form.control}
                name="roles"
                render={({ field }) => {
                  const selection: RoleTiers[] = field.value ?? [];
                  const basculerRole = (role: RoleTiers, coche: boolean) => {
                    if (coche) {
                      if (!selection.includes(role)) {
                        field.onChange([...selection, role]);
                      }
                    } else {
                      field.onChange(selection.filter((r) => r !== role));
                    }
                  };
                  return (
                    <FormItem>
                      <FormLabel>
                        {t("roles")} <Requis />
                      </FormLabel>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ROLES_TIERS.map((role) => {
                          const coche = selection.includes(role);
                          return (
                            <label
                              key={role}
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                                coche
                                  ? "border-primary-500 bg-primary-50/60 text-primary-900"
                                  : "border-neutral-200 bg-neutral-0 text-neutral-700 hover:bg-neutral-50",
                              )}
                            >
                              <Checkbox
                                checked={coche}
                                disabled={enCours}
                                onCheckedChange={(v) => basculerRole(role, v === true)}
                              />
                              <span>{tRoles(role)}</span>
                            </label>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Téléphone & Email */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="telephone"
                  render={({ field, fieldState }) => (
                    <ChampTelephone
                      libelle={t("telephone")}
                      paysDefaut={paysEffectif}
                      international
                      required
                      valeur={field.value}
                      onChange={field.onChange}
                      erreur={fieldState.error?.message}
                      disabled={enCours}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("email")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          inputMode="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder={t("emailPlaceholder")}
                          disabled={enCours}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Ville & Adresse */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="ville"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("ville")}</FormLabel>
                      <FormControl>
                        <ComboboxVille
                          pays={pays}
                          valeur={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={enCours}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="adresse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("adresse")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          maxLength={LONGUEUR_MAX_ADRESSE}
                          placeholder={t("adressePlaceholder")}
                          disabled={enCours}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* RCCM & NIF */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="rccm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("rccm")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          maxLength={LONGUEUR_MAX_RCCM}
                          placeholder={t("rccmPlaceholder")}
                          disabled={enCours}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nif"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("nif")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          maxLength={LONGUEUR_MAX_NIF}
                          placeholder={t("nifPlaceholder")}
                          disabled={enCours}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Note d'évaluation & Statut */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="noteEvaluation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("noteEvaluation")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={5}
                          step={0.1}
                          placeholder={t("notePlaceholder")}
                          disabled={enCours}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {enModification && (
                  <FormField
                    control={form.control}
                    name="estActif"
                    render={({ field }) => (
                      <FormItem className="flex flex-col justify-end">
                        <label className="flex h-[var(--input-height)] cursor-pointer items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-800">
                          <Checkbox
                            checked={field.value}
                            disabled={enCours}
                            onCheckedChange={(v) => field.onChange(v === true)}
                          />
                          <span>{t("estActif")}</span>
                        </label>
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {erreurServeur && <Alerte type="erreur">{erreurServeur}</Alerte>}
            </form>
          </Form>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-neutral-200 px-6 py-4">
          <Bouton variante="ghost" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Bouton>
          <Bouton type="submit" form={FORM_TIERS_ID} disabled={enCours} enCours={enCours}>
            {enCours ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                <span>{t("enregistrement")}</span>
              </>
            ) : enModification ? (
              t("enregistrer")
            ) : (
              t("creer")
            )}
          </Bouton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

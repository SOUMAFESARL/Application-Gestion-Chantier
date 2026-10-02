"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { creerActivite, listerEquipes, modifierActivite } from "@/features/projets/adaptateur";
import { cleEquipes } from "@/features/projets/cles";
import { dependancesPossibles, UNITES_ACTIVITE } from "@/features/projets/regles";
import type { Activite, Lot } from "@/features/projets/types";
import {
  LONGUEUR_MAX_LIBELLE_ACTIVITE,
  saisieActiviteVide,
  saisieDepuisActivite,
  schemaActivite,
  versSaisieActiviteDomaine,
  type SaisieActivite,
  type ValeursActivite,
} from "@/features/projets/validations";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const FORM_ID = "form-activite";

/** Deux champs côte à côte, empilés sous 640 px. */
const RANGEE = "grid grid-cols-2 gap-x-4 gap-y-3 max-[640px]:grid-cols-1";

/** La hauteur « moyenne » des champs du tiroir, comme celui de création de projet. */
const CHAMP = "h-[var(--input-height-md)]";

/**
 * Un `SelectItem` ne peut pas porter la valeur vide : le choix « aucune »
 * passe par une valeur réservée, ramenée à `""` dans le formulaire.
 */
const AUCUN = "__aucun";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  projetId: string;
  lots: Lot[];
  /** Absente : création. Présente : modification de cette activité. */
  activite?: Activite | null;
  /** Le lot présélectionné à la création. */
  lotIdInitial?: string;
  onEnregistree: (activite: Activite) => void;
}

/** L'astérisque des champs obligatoires — décoratif, le schéma fait foi. */
function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

/**
 * L'ajout — ou la modification — d'une activité : une tâche mesurable du
 * chantier, rattachée à un lot.
 *
 * Même tiroir que la création de projet, en plus étroit : une colonne de
 * champs, deux par rangée quand ils vont ensemble (quantité et unité, début
 * et fin). Les dates sont facultatives — une activité se déclare souvent
 * avant d'être planifiée — et le budget n'y figure pas : il se tient au lot.
 * L'avancement n'y figure pas : il vient du journal de chantier,
 * que le chef de chantier tient, pas de ce formulaire.
 */
export function TiroirActivite({
  ouverte,
  onFermer,
  projetId,
  lots,
  activite,
  lotIdInitial,
  onEnregistree,
}: Props) {
  const t = useTranslations("projets.lotsActivites.formActivite");
  const tLots = useTranslations("projets.lotsActivites");
  const modification = !!activite;

  // Le cache des équipes est partagé avec l'écran « Équipes et affectations ».
  const equipes = useQuery({
    queryKey: cleEquipes(projetId),
    queryFn: ({ signal }) => listerEquipes(projetId, signal),
    enabled: ouverte,
  });

  /**
   * Le formulaire part de l'activité à modifier, ou vierge sur le lot d'où
   * l'on vient. L'écran **remonte le tiroir à chaque ouverture** (`key`) :
   * garder la saisie précédente ferait créer la même activité deux fois.
   */
  const form = useForm<SaisieActivite, unknown, ValeursActivite>({
    resolver: zodResolver(schemaActivite),
    defaultValues: activite ? saisieDepuisActivite(activite) : saisieActiviteVide(lotIdInitial),
    mode: "onTouched",
  });

  const valeurs = useWatch({ control: form.control }) as SaisieActivite;
  const enCours = form.formState.isSubmitting;
  const dependances = dependancesPossibles(lots, activite?.id);

  async function soumettre(saisie: ValeursActivite) {
    try {
      const domaine = versSaisieActiviteDomaine(saisie);
      const enregistree = activite
        ? await modifierActivite(projetId, activite.id, domaine)
        : await creerActivite(projetId, domaine);
      onEnregistree(enregistree);
      toast.success(
        t(modification ? "succesModification" : "succesCreation", {
          code: enregistree.code,
          libelle: enregistree.libelle,
        }),
      );
      onFermer();
    } catch (err) {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurGenerique"));
    }
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg text-neutral-900">
            {modification ? t("titreModification", { code: activite.code }) : t("titre")}
          </SheetTitle>
          <SheetDescription>{t("sousTitre")}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(soumettre)}
            noValidate
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 [scrollbar-width:thin]"
          >
            <FormField
              control={form.control}
              name="lotId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("champLot")} <Requis />
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={enCours}>
                    <FormControl>
                      <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                        <SelectValue placeholder={t("selectionner")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lots.map((lot) => (
                        <SelectItem key={lot.id} value={lot.id}>
                          {tLots("libelleLot", { code: lot.code, nom: lot.nom })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="libelle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("champLibelle")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={CHAMP}
                      maxLength={LONGUEUR_MAX_LIBELLE_ACTIVITE}
                      placeholder={t("champLibellePlaceholder")}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={RANGEE}>
              <FormField
                control={form.control}
                name="quantite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("champQuantite")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={CHAMP}
                        inputMode="decimal"
                        placeholder={t("champQuantitePlaceholder")}
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("champUnite")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={enCours}>
                      <FormControl>
                        <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                          <SelectValue placeholder={t("selectionner")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNITES_ACTIVITE.map((unite) => (
                          <SelectItem key={unite} value={unite}>
                            {tLots(`unites.${unite}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className={RANGEE}>
              <FormField
                control={form.control}
                name="dateDebut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("champDebut")}</FormLabel>
                    <FormControl>
                      <SelecteurDate
                        valeur={field.value}
                        onChange={(valeur) => {
                          field.onChange(valeur);
                          if (form.getFieldState("dateFin").isTouched) void form.trigger("dateFin");
                        }}
                        onBlur={field.onBlur}
                        auPlusTard={valeurs.dateFin}
                        className={CHAMP}
                        placeholder={t("champDateChoisir")}
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateFin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("champFin")}</FormLabel>
                    <FormControl>
                      <SelecteurDate
                        valeur={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        auPlusTot={valeurs.dateDebut}
                        className={CHAMP}
                        placeholder={t("champDateChoisir")}
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dependanceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("champDependance")}</FormLabel>
                  <Select
                    value={field.value || AUCUN}
                    onValueChange={(valeur) => field.onChange(valeur === AUCUN ? "" : valeur)}
                    disabled={enCours}
                  >
                    <FormControl>
                      <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={AUCUN}>{t("aucuneDependance")}</SelectItem>
                      {dependances.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {tLots("libelleActivite", { code: candidate.code, libelle: candidate.libelle })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="equipeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("champEquipe")}</FormLabel>
                  <Select
                    value={field.value || AUCUN}
                    onValueChange={(valeur) => field.onChange(valeur === AUCUN ? "" : valeur)}
                    disabled={enCours}
                  >
                    <FormControl>
                      <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={AUCUN}>{t("equipeAAffecter")}</SelectItem>
                      {(equipes.data ?? []).map((equipe) => (
                        <SelectItem key={equipe.id} value={equipe.id}>
                          {tLots("libelleEquipe", { nom: equipe.nom, effectif: equipe.effectif })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={enCours} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {modification ? t("enregistrer") : t("ajouter")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

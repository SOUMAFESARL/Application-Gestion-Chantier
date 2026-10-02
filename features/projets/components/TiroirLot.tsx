"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileSpreadsheet, LoaderCircle, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui";
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
import { creerLot } from "@/features/projets/adaptateur";
import { codeLotSuivant, MODES_EXECUTION_LOT, TYPES_BORDEREAU } from "@/features/projets/regles";
import type { Lot } from "@/features/projets/types";
import {
  lotVide,
  schemaLot,
  versCreationLotProjet,
  type SaisieLotProjet,
} from "@/features/projets/validations";
import { ErreurApi } from "@/lib/api";
import { formaterSaisieMontant } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ComboboxNomLot } from "./ComboboxNomLot";
import { ImportLots } from "./ImportLots";

const FORM_ID = "form-lot";

const RANGEE = "grid grid-cols-2 gap-x-4 gap-y-3 max-[640px]:grid-cols-1";
const CHAMP = "h-[var(--input-height-md)]";

/** Les deux façons d'ajouter des lots : un par un, ou tout un fichier. */
const MODES_AJOUT = ["saisie", "import"] as const;
type ModeAjout = (typeof MODES_AJOUT)[number];

const ICONES_MODE: Record<ModeAjout, typeof PenLine> = {
  saisie: PenLine,
  import: FileSpreadsheet,
};

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  projetId: string;
  lots: Lot[];
  onCree: (lot: Lot) => void;
  onImportes: (lots: Lot[]) => void;
}

function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

/**
 * L'ajout de lots à un chantier déjà ouvert — un par un, ou par l'import
 * d'un fichier Excel déjà constitué (souvent la liste du DCE).
 *
 * L'écran le remonte à chaque ouverture (`key`) : il repart toujours vierge,
 * sur la saisie.
 */
export function TiroirLot({ ouverte, onFermer, projetId, lots, onCree, onImportes }: Props) {
  const t = useTranslations("projets.lotsActivites.formLot");
  const tImport = useTranslations("projets.lotsActivites.importLots");
  const [modeAjout, setModeAjout] = useState<ModeAjout>("saisie");
  const [occupe, setOccupe] = useState(false);

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent
        side="right"
        className={cn("w-full gap-0 p-0", modeAjout === "import" ? "sm:max-w-2xl" : "sm:max-w-md")}
      >
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="flex items-center gap-2 text-lg text-neutral-900">
            {modeAjout === "saisie" ? (
              <>
                {t("titre")} <Badge variante="primaire">{t("code", { code: codeLotSuivant(lots) })}</Badge>
              </>
            ) : (
              tImport("titre")
            )}
          </SheetTitle>
          <SheetDescription>{modeAjout === "saisie" ? t("sousTitre") : tImport("sousTitre")}</SheetDescription>
        </SheetHeader>

        <div
          role="tablist"
          aria-label={t("modeAjout")}
          className="mx-6 mt-4 grid grid-cols-2 gap-1 rounded-lg border border-solid border-primary-200 bg-primary-50 p-1"
        >
          {MODES_AJOUT.map((mode) => {
            const Icone = ICONES_MODE[mode];
            const actif = mode === modeAjout;
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={actif}
                disabled={occupe}
                onClick={() => setModeAjout(mode)}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-md border-0 px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed",
                  actif
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-transparent text-primary-600 hover:bg-primary-100",
                )}
              >
                <Icone className="size-4" aria-hidden="true" />
                {t(`modes.${mode}`)}
              </button>
            );
          })}
        </div>

        {modeAjout === "saisie" ? (
          <SaisieLot projetId={projetId} onFermer={onFermer} onCree={onCree} onOccupe={setOccupe} />
        ) : (
          <ImportLots
            projetId={projetId}
            lots={lots}
            onFermer={onFermer}
            onImportes={onImportes}
            onOccupe={setOccupe}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Un lot saisi à la main. Mêmes champs, même schéma (`schemaLot`) que
 * partout ailleurs. Le budget se fixe ici, au lot ; budget et dates restent
 * facultatifs. Le code est attribué par le serveur — l'en-tête affiche celui
 * qu'il prendra.
 */
function SaisieLot({
  projetId,
  onFermer,
  onCree,
  onOccupe,
}: {
  projetId: string;
  onFermer: () => void;
  onCree: (lot: Lot) => void;
  onOccupe: (occupe: boolean) => void;
}) {
  const t = useTranslations("projets.lotsActivites.formLot");
  const tCreation = useTranslations("projets.tiroirCreation");

  const form = useForm<SaisieLotProjet>({
    resolver: zodResolver(schemaLot),
    defaultValues: lotVide(),
    mode: "onTouched",
  });

  const valeurs = useWatch({ control: form.control }) as SaisieLotProjet;
  const enCours = form.formState.isSubmitting;

  async function soumettre(saisie: SaisieLotProjet) {
    onOccupe(true);
    try {
      const lot = await creerLot(projetId, versCreationLotProjet(schemaLot.parse(saisie)));
      onCree(lot);
      toast.success(t("succes", { code: lot.code, nom: lot.nom }));
      onFermer();
    } catch (err) {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurGenerique"));
    } finally {
      onOccupe(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit(soumettre)}
          noValidate
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 [scrollbar-width:thin]"
        >
          <FormField
            control={form.control}
            name="nom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("champNom")} <Requis />
                </FormLabel>
                <FormControl>
                  <ComboboxNomLot
                    valeur={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className={CHAMP}
                    disabled={enCours}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="modeExecution"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {tCreation("colonneModeExecution")} <Requis />
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={enCours}>
                  <FormControl>
                    <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                      <SelectValue placeholder={tCreation("selectionner")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MODES_EXECUTION_LOT.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {tCreation(`modeExecution.${mode}`)}
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
            name="typeBordereau"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {tCreation("colonneTypeBordereau")} <Requis />
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={enCours}>
                  <FormControl>
                    <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                      <SelectValue placeholder={tCreation("selectionner")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TYPES_BORDEREAU.map((type) => (
                      <SelectItem key={type} value={type}>
                        {tCreation(`typeBordereau.${type}`)}
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
            name="budget"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("champBudget")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(evenement) => field.onChange(formaterSaisieMontant(evenement.target.value))}
                    className={cn(CHAMP, "tabular-nums")}
                    inputMode="numeric"
                    placeholder={t("champBudgetPlaceholder")}
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
              name="dateDebut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tCreation("colonneDateDebut")}</FormLabel>
                  <FormControl>
                    <SelecteurDate
                      valeur={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      auPlusTard={valeurs.dateFin}
                      className={CHAMP}
                      placeholder={tCreation("champDateChoisir")}
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
                  <FormLabel>{tCreation("colonneDateFin")}</FormLabel>
                  <FormControl>
                    <SelecteurDate
                      valeur={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      auPlusTot={valeurs.dateDebut}
                      className={CHAMP}
                      placeholder={tCreation("champDateChoisir")}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>

      <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
        <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
          {t("annuler")}
        </Button>
        <Button type="submit" form={FORM_ID} disabled={enCours} aria-busy={enCours}>
          {enCours && <LoaderCircle className="animate-spin" />}
          {t("ajouter")}
        </Button>
      </SheetFooter>
    </>
  );
}

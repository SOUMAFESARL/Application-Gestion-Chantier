"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleX, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const FORM_ID = "form-lot";

const RANGEE = "grid grid-cols-2 gap-x-4 gap-y-3 max-[640px]:grid-cols-1";
const CHAMP = "h-[var(--input-height-md)]";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  projetId: string;
  lots: Lot[];
  onCree: (lot: Lot) => void;
}

function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

/**
 * L'ajout d'un lot à un chantier déjà ouvert.
 *
 * Mêmes champs, même schéma (`schemaLot`) que l'étape 2 de la création d'un
 * projet : un lot ajouté après coup ne doit pas être moins bien décrit qu'un
 * lot déclaré d'emblée. Le code est attribué par le serveur ; on affiche
 * celui qu'il prendra, pour que l'utilisateur sache où il atterrit.
 *
 * L'écran le remonte à chaque ouverture (`key`) : il repart toujours vierge.
 */
export function TiroirLot({ ouverte, onFermer, projetId, lots, onCree }: Props) {
  const t = useTranslations("projets.lotsActivites.formLot");
  const tCreation = useTranslations("projets.tiroirCreation");
  const [erreur, setErreur] = useState<string | null>(null);

  const form = useForm<SaisieLotProjet>({
    resolver: zodResolver(schemaLot),
    defaultValues: lotVide(),
    mode: "onTouched",
  });

  const valeurs = useWatch({ control: form.control }) as SaisieLotProjet;
  const enCours = form.formState.isSubmitting;

  async function soumettre(saisie: SaisieLotProjet) {
    setErreur(null);
    try {
      const lot = await creerLot(projetId, versCreationLotProjet(schemaLot.parse(saisie)));
      onCree(lot);
      onFermer();
    } catch (err) {
      const cause = err as ErreurApi;
      setErreur(cause.message || t("erreurGenerique"));
    }
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="flex items-center gap-2 text-lg text-neutral-900">
            {t("titre")} <Badge variante="primaire">{t("code", { code: codeLotSuivant(lots) })}</Badge>
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
            {erreur && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="nom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("champNom")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={CHAMP}
                      placeholder={tCreation("champNomLotPlaceholder")}
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
      </SheetContent>
    </Sheet>
  );
}

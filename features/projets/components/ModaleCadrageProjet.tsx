"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleX, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import { definirBudgetProjet, definirPlanningProjet } from "@/features/projets/adaptateur";
import { echeancierProjet } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import {
  saisieDepuisPlanning,
  schemaBudget,
  schemaPlanning,
  versBudgetCentimes,
  versPlanningProjet,
  type SaisieBudget,
  type SaisiePlanning,
} from "@/features/projets/validations";
import type { ErreurApi } from "@/lib/api";
import { centimesEnFrancs, formaterDuree, formaterSaisieMontant } from "@/lib/format";

const FORM_ID = "form-cadrage";
const CHAMP = "h-[var(--input-height-md)]";

/** Ce que le chef de projet fixe : le planning contractuel, ou le budget prévisionnel. */
export type ObjetCadrage = "planning" | "budget";

interface Props {
  /** `null` : la modale est fermée. */
  cadrage: { projet: Projet; objet: ObjetCadrage } | null;
  onFermer: () => void;
  onModifie: (projet: Projet) => void;
}

/**
 * Le cadrage d'un projet par son chef de projet : le planning contractuel et
 * le budget prévisionnel, qui ne se demandent plus à la création. Deux
 * formulaires distincts, chacun sa propre écriture — fixer le budget ne
 * renvoie pas les dates.
 */
export function ModaleCadrageProjet({ cadrage, onFermer, onModifie }: Props) {
  return (
    <Dialog open={cadrage !== null} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-[480px]">
        {cadrage?.objet === "planning" && (
          <FormulairePlanning projet={cadrage.projet} onFermer={onFermer} onModifie={onModifie} />
        )}
        {cadrage?.objet === "budget" && (
          <FormulaireBudget projet={cadrage.projet} onFermer={onFermer} onModifie={onModifie} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PropsFormulaire {
  projet: Projet;
  onFermer: () => void;
  onModifie: (projet: Projet) => void;
}

function FormulairePlanning({ projet, onFermer, onModifie }: PropsFormulaire) {
  const t = useTranslations("projets.cadrage");
  const [erreur, setErreur] = useState<string | null>(null);

  const form = useForm<SaisiePlanning>({
    resolver: zodResolver(schemaPlanning),
    defaultValues: saisieDepuisPlanning(projet),
    mode: "onTouched",
  });
  const enCours = form.formState.isSubmitting;
  const [dateDebut, dateFin] = useWatch({ control: form.control, name: ["dateDebut", "dateFin"] });
  const { dureeJours } = echeancierProjet({
    ...projet,
    dateDebutPrevue: dateDebut || null,
    dateFinPrevue: dateFin || null,
  });

  async function soumettre(valeurs: SaisiePlanning) {
    setErreur(null);
    try {
      onModifie(await definirPlanningProjet(projet.id, versPlanningProjet(valeurs)));
      toast.success(t("planning.succes"));
      onFermer();
    } catch (err) {
      setErreur((err as ErreurApi).message || t("erreurGenerique"));
    }
  }

  return (
    <Cadre
      titre={t("planning.titre")}
      sousTitre={t("planning.sousTitre")}
      erreur={erreur}
      enCours={enCours}
      onFermer={onFermer}
    >
      <Form {...form}>
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit(soumettre)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <FormField
              control={form.control}
              name="dateDebut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("planning.champDateDebut")}</FormLabel>
                  <FormControl>
                    <SelecteurDate
                      className={CHAMP}
                      valeur={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder={t("planning.champDateChoisir")}
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
                  <FormLabel>{t("planning.champDateFin")}</FormLabel>
                  <FormControl>
                    <SelecteurDate
                      className={CHAMP}
                      valeur={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder={t("planning.champDateChoisir")}
                      auPlusTot={dateDebut || undefined}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {dureeJours !== null && (
            <p className="m-0 text-sm text-neutral-600">
              {t("planning.duree", { duree: formaterDuree(dureeJours) })}
            </p>
          )}
        </form>
      </Form>
    </Cadre>
  );
}

function FormulaireBudget({ projet, onFermer, onModifie }: PropsFormulaire) {
  const t = useTranslations("projets.cadrage");
  const [erreur, setErreur] = useState<string | null>(null);

  const form = useForm<SaisieBudget>({
    resolver: zodResolver(schemaBudget),
    defaultValues: {
      montant:
        projet.budgetInitial === null
          ? ""
          : formaterSaisieMontant(String(centimesEnFrancs(projet.budgetInitial))),
    },
    mode: "onTouched",
  });
  const enCours = form.formState.isSubmitting;

  async function soumettre(valeurs: SaisieBudget) {
    setErreur(null);
    try {
      onModifie(await definirBudgetProjet(projet.id, versBudgetCentimes(valeurs)));
      toast.success(t("budget.succes"));
      onFermer();
    } catch (err) {
      setErreur((err as ErreurApi).message || t("erreurGenerique"));
    }
  }

  return (
    <Cadre
      titre={t("budget.titre")}
      sousTitre={t("budget.sousTitre")}
      erreur={erreur}
      enCours={enCours}
      onFermer={onFermer}
    >
      <Form {...form}>
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit(soumettre)}
          noValidate
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="montant"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("budget.champMontant")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(evenement) => field.onChange(formaterSaisieMontant(evenement.target.value))}
                    inputMode="numeric"
                    className={`${CHAMP} tabular-nums`}
                    placeholder={t("budget.montantPlaceholder")}
                    disabled={enCours}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Cadre>
  );
}

/** L'en-tête, l'erreur et les boutons, communs aux deux formulaires. */
function Cadre({
  titre,
  sousTitre,
  erreur,
  enCours,
  onFermer,
  children,
}: {
  titre: string;
  sousTitre: string;
  erreur: string | null;
  enCours: boolean;
  onFermer: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("projets.cadrage");
  return (
    <>
      <DialogHeader>
        <DialogTitle>{titre}</DialogTitle>
        <DialogDescription>{sousTitre}</DialogDescription>
      </DialogHeader>

      {erreur && (
        <Alert variant="erreur">
          <CircleX />
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}

      {children}

      <DialogFooter className="gap-3">
        <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
          {t("annuler")}
        </Button>
        <Button type="submit" form={FORM_ID} disabled={enCours} aria-busy={enCours}>
          {enCours && <LoaderCircle className="animate-spin" />}
          {enCours ? t("enregistrementEnCours") : t("enregistrer")}
        </Button>
      </DialogFooter>
    </>
  );
}

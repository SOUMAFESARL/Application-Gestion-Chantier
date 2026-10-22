"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CircleX, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import {
  definirBudgetProjet,
  definirPlanningProjet,
  listerLots,
} from "@/features/projets/adaptateur";
import { useDroits } from "@/features/habilitations";
import { cleLots } from "@/features/projets/cles";
import { ModaleReprogrammation } from "./ModaleReprogrammation";
import {
  datesVerrouillees,
  echeancierProjet,
  plancherBudget,
  planningDefini,
} from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import {
  saisieDepuisPlanning,
  schemaBudgetProjet,
  schemaPlanning,
  versBudgetCentimes,
  versPlanningProjet,
  type SaisieBudget,
  type SaisiePlanning,
} from "@/features/projets/validations";
import { ErreurApi } from "@/lib/api";
import {
  centimesEnFrancs,
  formaterDuree,
  formaterMontant,
  formaterSaisieMontant,
} from "@/lib/format";

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
 *
 * Dès que le projet a ses dates, la modification passe par la
 * reprogrammation officielle (US 3.8, RG-11).
 */
export function ModaleCadrageProjet({ cadrage, onFermer, onModifie }: Props) {
  const { voitMontants } = useDroits();

  if (cadrage?.objet === "budget" && !voitMontants) {
    return null;
  }

  if (cadrage?.objet === "planning" && planningDefini(cadrage.projet)) {
    return (
      <ModaleReprogrammation
        ouverte={cadrage !== null}
        onFermer={onFermer}
        objet="projets"
        id={cadrage.projet.id}
        nomObjet={cadrage.projet.nom}
        projetId={cadrage.projet.id}
        datesActuelles={{
          debut: cadrage.projet.dateDebutPrevue,
          fin: cadrage.projet.dateFinPrevue,
        }}
        onSucces={(resultat) => {
          onModifie({
            ...cadrage.projet,
            dateDebutPrevue: resultat.dateDebutPrevue,
            dateFinPrevue: resultat.dateFinPrevue,
          });
        }}
      />
    );
  }

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
  // Une seule date peut être déjà fixée : elle ne part pas par le PATCH (RG-11).
  const verrou = datesVerrouillees({ debut: projet.dateDebutPrevue, fin: projet.dateFinPrevue });
  const [dateDebut, dateFin] = useWatch({ control: form.control, name: ["dateDebut", "dateFin"] });
  const { duree } = echeancierProjet({
    ...projet,
    dateDebutPrevue: dateDebut || null,
    dateFinPrevue: dateFin || null,
  });

  async function soumettre(valeurs: SaisiePlanning) {
    setErreur(null);
    try {
      const planning = versPlanningProjet(valeurs);
      if (verrou.debut) delete planning.dateDebutPrevue;
      if (verrou.fin) delete planning.dateFinPrevue;
      onModifie(await definirPlanningProjet(projet.id, planning));
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
      <Form {...form} preRempli>
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
                      disabled={enCours || verrou.debut}
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
                      disabled={enCours || verrou.fin}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {duree !== null && (
            <p className="m-0 text-sm text-neutral-600">
              {t("planning.duree", { duree: formaterDuree(duree) })}
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

  const requeteLots = useQuery({
    queryKey: cleLots(projet.id),
    queryFn: ({ signal }) => listerLots(projet.id, signal),
  });
  const lots = useMemo(() => requeteLots.data ?? [], [requeteLots.data]);
  const plancher = useMemo(() => plancherBudget(lots), [lots]);
  const schema = useMemo(() => schemaBudgetProjet(plancher), [plancher]);

  const form = useForm<SaisieBudget>({
    resolver: zodResolver(schema),
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
      if (err instanceof ErreurApi && err.erreursParChamp.budget_initial_montant) {
        form.setError("montant", { message: err.erreursParChamp.budget_initial_montant });
        return;
      }
      setErreur(err instanceof ErreurApi ? err.message : t("erreurGenerique"));
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
      <Form {...form} preRempli>
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
                {plancher !== null && (
                  <FormDescription>
                    {t("aideSommeLots", { somme: formaterMontant(plancher) })}
                  </FormDescription>
                )}
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

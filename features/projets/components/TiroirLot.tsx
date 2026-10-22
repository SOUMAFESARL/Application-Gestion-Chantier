"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileSpreadsheet, LoaderCircle, Pencil, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Alerte, Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { HistoriqueDatesCourt } from "./HistoriqueDatesCourt";
import { ModaleReprogrammation } from "./ModaleReprogrammation";
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
import { useDroits } from "@/features/habilitations";
import { creerLot, modifierLot } from "@/features/projets/adaptateur";
import {
  budgetDisponible,
  codeLotSuivant,
  datesVerrouillees,
  lotCreable,
  STATUTS_DECLARES,
  TYPES_BORDEREAU,
} from "@/features/projets/regles";
import type { Lot } from "@/features/projets/types";
import {
  lotEnSaisie,
  lotVide,
  schemaLotBorne,
  versCreationLotProjet,
  type SaisieLotProjet,
} from "@/features/projets/validations";
import { ErreurApi } from "@/lib/api";
import { formaterDate, formaterMontant, formaterSaisieMontant } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ComboboxModeExecution } from "./ComboboxModeExecution";
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
  /** En centimes ; `null` tant qu'il n'est pas défini — il ne borne alors rien. */
  budgetProjet: number | null;
  /** Dates du projet parent pour borner les dates des lots. */
  datesProjet?: { dateDebutPrevue?: string | null; dateFinPrevue?: string | null } | null;
  /** Le lot à modifier ; absent, le tiroir en ajoute. */
  lot?: Lot | null;
  onCree: (lot: Lot) => void;
  onModifie: (lot: Lot) => void;
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
 * d'un fichier Excel déjà constitué (souvent la liste du DCE) —, ou la
 * modification d'un lot existant, qui ne propose alors que la saisie.
 *
 * L'écran le remonte à chaque ouverture (`key`) : il repart toujours de sa
 * saisie initiale, vierge ou celle du lot.
 */
export function TiroirLot({
  ouverte,
  onFermer,
  projetId,
  lots,
  budgetProjet,
  datesProjet,
  lot = null,
  onCree,
  onModifie,
  onImportes,
}: Props) {
  const t = useTranslations("projets.lotsActivites.formLot");
  const tImport = useTranslations("projets.lotsActivites.importLots");
  const [modeAjout, setModeAjout] = useState<ModeAjout>("saisie");
  const [occupe, setOccupe] = useState(false);

  if (lot) {
    return (
      <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
            <SheetTitle className="flex items-center gap-2 text-lg text-neutral-900">
              {t("titreModification")} <Badge variante="primaire">{t("code", { code: lot.code })}</Badge>
            </SheetTitle>
            <SheetDescription>{t("sousTitreModification")}</SheetDescription>
          </SheetHeader>
          <SaisieLot
            projetId={projetId}
            budgetProjet={budgetProjet}
            datesProjet={datesProjet}
            lot={lot}
            lots={lots}
            onFermer={onFermer}
            onEnregistre={onModifie}
            onOccupe={setOccupe}
          />
        </SheetContent>
      </Sheet>
    );
  }

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
          <SaisieLot
            projetId={projetId}
            budgetProjet={budgetProjet}
            datesProjet={datesProjet}
            lots={lots}
            onFermer={onFermer}
            onEnregistre={onCree}
            onOccupe={setOccupe}
          />
        ) : (
          <ImportLots
            projetId={projetId}
            lots={lots}
            budgetProjet={budgetProjet}
            datesProjet={datesProjet}
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
 * Un lot saisi à la main — neuf, ou existant quand `lot` est fourni. Mêmes
 * champs, même schéma (`schemaLot`, borné par `schemaLotBorne`) que partout ailleurs. Le budget se fixe
 * ici, au lot ; budget et dates restent facultatifs. Le code est attribué par
 * le serveur — l'en-tête affiche celui qu'il prendra, ou qu'il porte.
 */
function SaisieLot({
  projetId,
  budgetProjet,
  datesProjet,
  lot = null,
  lots = [],
  onFermer,
  onEnregistre,
  onOccupe,
}: {
  projetId: string;
  budgetProjet: number | null;
  datesProjet?: { dateDebutPrevue?: string | null; dateFinPrevue?: string | null } | null;
  lot?: Lot | null;
  lots?: Lot[];
  onFermer: () => void;
  onEnregistre: (lot: Lot) => void;
  onOccupe: (occupe: boolean) => void;
}) {
  const t = useTranslations("projets.lotsActivites.formLot");
  const tCreation = useTranslations("projets.tiroirCreation");
  const tLots = useTranslations("projets.lotsActivites");
  const tReprog = useTranslations("projets.reprogrammation");
  const { voitMontants } = useDroits();

  const datesProjetDefinies =
    !datesProjet ||
    lotCreable({
      dateDebutPrevue: datesProjet.dateDebutPrevue ?? null,
      dateFinPrevue: datesProjet.dateFinPrevue ?? null,
    });

  const autresLots = useMemo(() => lots.filter((l) => l.id !== lot?.id), [lots, lot]);
  const schema = schemaLotBorne(budgetProjet, lot, autresLots, datesProjet);
  const disponible = useMemo(
    () => (budgetProjet !== null ? budgetDisponible(budgetProjet, autresLots) : null),
    [budgetProjet, autresLots],
  );
  const aideDisponible =
    voitMontants && disponible !== null
      ? t("aideDisponible", { montant: formaterMontant(disponible) })
      : null;

  const form = useForm<SaisieLotProjet>({
    resolver: zodResolver(schema),
    defaultValues: lot
      ? { ...lotEnSaisie(lot), budget: voitMontants ? lotEnSaisie(lot).budget : "" }
      : lotVide(),
    mode: "onTouched",
  });

  const valeurs = useWatch({ control: form.control }) as SaisieLotProjet;
  const enCours = form.formState.isSubmitting;
  // Les dates déjà fixées ne partent plus par le PATCH (RG-11) : on les change par
  // la reprogrammation, et on garde ici celles qu'elle vient d'écrire.
  const [datesLot, setDatesLot] = useState({ debut: lot?.dateDebut ?? null, fin: lot?.dateFin ?? null });
  const verrou = datesVerrouillees(datesLot);
  const [reprogrammationOuverte, setReprogrammationOuverte] = useState(false);

  async function soumettre(saisie: SaisieLotProjet) {
    onOccupe(true);
    try {
      const parsed = schema.parse({
        ...saisie,
        budget: voitMontants ? saisie.budget : "",
      });
      const valeurs = versCreationLotProjet(parsed);
      if (!voitMontants) {
        delete valeurs.budget;
      }
      if (lot && verrou.debut) {
        delete valeurs.dateDebut;
      }
      if (lot && verrou.fin) {
        delete valeurs.dateFin;
      }
      // Le serveur renvoie le lot seul : ses activités restent celles qu'on a.
      const enregistre = lot
        ? { ...(await modifierLot(lot.id, valeurs)), activites: lot.activites }
        : await creerLot(projetId, valeurs);
      onEnregistre(enregistre);
      toast.success(
        t(lot ? "succesModification" : "succes", { code: enregistre.code, nom: enregistre.nom }),
      );
      onFermer();
    } catch (err) {
      if (err instanceof ErreurApi) {
        if (err.erreursParChamp.budget_initial_montant) {
          form.setError("budget", { message: err.erreursParChamp.budget_initial_montant });
          return;
        }
        if (err.erreursParChamp.date_debut_prevue) {
          form.setError("dateDebut", { message: err.erreursParChamp.date_debut_prevue });
          return;
        }
        if (err.erreursParChamp.date_fin_prevue) {
          form.setError("dateFin", { message: err.erreursParChamp.date_fin_prevue });
          return;
        }
      }
      const repli = lot ? t("erreurModification") : t("erreurGenerique");
      toast.error(err instanceof ErreurApi && err.message ? err.message : repli);
    } finally {
      onOccupe(false);
    }
  }

  return (
    <>
      <Form {...form} preRempli={Boolean(lot)}>
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit(soumettre)}
          noValidate
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 [scrollbar-width:thin]"
        >
          {!lot && !datesProjetDefinies && (
            <Alerte type="information">{tLots("datesProjetRequises")}</Alerte>
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
                <FormControl>
                  <ComboboxModeExecution
                    valeur={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    libelleActuel={lot?.modeExecutionLibelle}
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
            name="statut"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {tLots("champStatut")} <Requis />
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={enCours}>
                  <FormControl>
                    <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {STATUTS_DECLARES.map((statut) => (
                      <SelectItem key={statut} value={statut}>
                        {tLots(`statutDeclare.${statut}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {voitMontants && (
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
                  {aideDisponible && <FormDescription>{aideDisponible}</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {verrou.reprogrammable && lot && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
              <span className="text-xs text-neutral-600">
                {tReprog("datesActuellesFormat", {
                  label: tReprog("datesActuelles"),
                  debut: formaterDate(datesLot.debut),
                  fin: formaterDate(datesLot.fin),
                })}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setReprogrammationOuverte(true)}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                {tReprog("modifierDates")}
              </Button>
            </div>
          )}

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
                      auPlusTot={datesProjet?.dateDebutPrevue || undefined}
                      auPlusTard={valeurs.dateFin || datesProjet?.dateFinPrevue || undefined}
                      className={CHAMP}
                      placeholder={tCreation("champDateChoisir")}
                      disabled={enCours || (Boolean(lot) && verrou.debut)}
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
                      auPlusTot={valeurs.dateDebut || datesProjet?.dateDebutPrevue || undefined}
                      auPlusTard={datesProjet?.dateFinPrevue || undefined}
                      className={CHAMP}
                      placeholder={tCreation("champDateChoisir")}
                      disabled={enCours || (Boolean(lot) && verrou.fin)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {lot && <HistoriqueDatesCourt objet="lots" id={lot.id} />}
        </form>
      </Form>

      <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
        <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
          {t("annuler")}
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          disabled={enCours || (!lot && !datesProjetDefinies)}
          aria-busy={enCours}
        >
          {enCours && <LoaderCircle className="animate-spin" />}
          {lot ? t("enregistrer") : t("ajouter")}
        </Button>
      </SheetFooter>

      {lot && verrou.reprogrammable && (
        <ModaleReprogrammation
          ouverte={reprogrammationOuverte}
          onFermer={() => setReprogrammationOuverte(false)}
          objet="lots"
          id={lot.id}
          nomObjet={lot.nom}
          projetId={projetId}
          datesActuelles={datesLot}
          bornesParent={
            datesProjet
              ? { debutMin: datesProjet.dateDebutPrevue, finMax: datesProjet.dateFinPrevue }
              : null
          }
          onSucces={(resultat) => {
            form.setValue("dateDebut", resultat.dateDebutPrevue ?? "");
            form.setValue("dateFin", resultat.dateFinPrevue);
            setDatesLot({ debut: resultat.dateDebutPrevue, fin: resultat.dateFinPrevue });
            onEnregistre({
              ...lot,
              dateDebut: resultat.dateDebutPrevue,
              dateFin: resultat.dateFinPrevue,
            });
          }}
        />
      )}
    </>
  );
}

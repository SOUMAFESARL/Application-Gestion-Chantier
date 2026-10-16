"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Alerte } from "@/components/ui/Alerte";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import { CLE_COLLABORATEURS, listerCollaborateurs } from "@/features/invitations/adaptateur";
import {
  creerActivite,
  erreursChampsActivite,
  listerEquipes,
  modifierActivite,
} from "@/features/projets/adaptateur";
import { cleEquipes } from "@/features/projets/cles";
import {
  activiteCreable,
  budgetDisponible,
  collaborateursDisponibles,
  STATUTS_DECLARES,
  UNITES_ACTIVITE,
} from "@/features/projets/regles";
import type { Activite, Lot } from "@/features/projets/types";
import {
  LONGUEUR_MAX_LIBELLE_ACTIVITE,
  saisieActiviteVide,
  saisieDepuisActivite,
  schemaActiviteBornee,
  versSaisieActiviteDomaine,
  type SaisieActivite,
  type ValeursActivite,
} from "@/features/projets/validations";
import { ErreurApi } from "@/lib/api";
import { formaterDate, formaterMontant, formaterSaisieMontant } from "@/lib/format";
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
  /** En centimes ; `null` tant qu'il n'est pas défini — il ne borne alors rien. */
  budgetProjet: number | null;
  /** Absente : création. Présente : modification de cette activité. */
  activite?: Activite | null;
  /** Le lot présélectionné à la création. */
  lotIdInitial?: string;
  onEnregistree: (activite: Activite) => void;
  /** Raccourci vers les dates du lot quand celui-ci n'est pas planifié (US 3.7). */
  onDefinirDatesLot?: (lot: Lot) => void;
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
 * et fin). Les dates et le budget sont facultatifs — une activité se déclare
 * souvent avant d'être planifiée ou chiffrée ; le budget se tient d'abord au lot.
 * L'avancement n'y figure pas : il vient du journal de chantier,
 * que le chef de chantier tient, pas de ce formulaire.
 */
export function TiroirActivite({
  ouverte,
  onFermer,
  projetId,
  lots,
  budgetProjet,
  activite,
  lotIdInitial,
  onEnregistree,
  onDefinirDatesLot,
}: Props) {
  const t = useTranslations("projets.lotsActivites.formActivite");
  const tLots = useTranslations("projets.lotsActivites");
  const tReprog = useTranslations("projets.reprogrammation");
  const modification = !!activite;
  const datesActiviteFigees = Boolean(activite && (activite.dateDebutPrevue || activite.dateFinPrevue));
  const [reprogrammationOuverte, setReprogrammationOuverte] = useState(false);

  // Le cache des équipes est partagé avec l'écran « Équipes et affectations ».
  const equipes = useQuery({
    queryKey: cleEquipes(projetId),
    queryFn: ({ signal }) => listerEquipes(projetId, signal),
    enabled: ouverte,
  });

  // Le responsable se choisit parmi les collaborateurs de l'entreprise.
  const collaborateurs = useQuery({
    queryKey: CLE_COLLABORATEURS,
    queryFn: listerCollaborateurs,
    enabled: ouverte,
  });

  const { voitMontants } = useDroits();

  /**
   * Le formulaire part de l'activité à modifier, ou vierge sur le lot d'où
   * l'on vient. L'écran **remonte le tiroir à chaque ouverture** (`key`) :
   * garder la saisie précédente ferait créer la même activité deux fois.
   */
  const form = useForm<SaisieActivite, unknown, ValeursActivite>({
    // Le budget ne dépasse ni celui du lot choisi, ni celui du projet.
    resolver: zodResolver(schemaActiviteBornee(budgetProjet, lots, activite?.id)),
    defaultValues: activite
      ? {
          ...saisieDepuisActivite(activite),
          budget: voitMontants ? saisieDepuisActivite(activite).budget : "",
        }
      : saisieActiviteVide(lotIdInitial),
    mode: "onTouched",
  });

  const valeurs = useWatch({ control: form.control }) as SaisieActivite;
  const enCours = form.formState.isSubmitting;
  const lotChoisi = useMemo(() => lots.find((l) => l.id === valeurs.lotId), [lots, valeurs.lotId]);
  const autresActivites = useMemo(
    () => (lotChoisi ? lotChoisi.activites.filter((a) => a.id !== activite?.id) : []),
    [lotChoisi, activite],
  );
  const disponible = useMemo(
    () => (lotChoisi?.budget != null ? budgetDisponible(lotChoisi.budget, autresActivites) : null),
    [lotChoisi, autresActivites],
  );
  const aideDisponible =
    voitMontants && disponible !== null
      ? t("aideDisponible", { montant: formaterMontant(disponible) })
      : null;

  // Un compte désactivé n'est plus proposé — sauf s'il est déjà le responsable.
  const responsables = collaborateursDisponibles(
    collaborateurs.data ?? [],
    [],
    valeurs.responsableId,
  );
  const optionsResponsable = [
    { valeur: AUCUN, libelle: t("aucunResponsable") },
    ...responsables.map((collaborateur) => ({
      valeur: collaborateur.id,
      libelle: collaborateur.nomComplet,
    })),
  ];

  async function soumettre(saisie: ValeursActivite) {
    try {
      const domaine = versSaisieActiviteDomaine(saisie);
      if (!voitMontants) {
        delete domaine.budget;
      }
      if (datesActiviteFigees) {
        delete domaine.dateDebutPrevue;
        delete domaine.dateFinPrevue;
      }
      const enregistree = activite
        ? await modifierActivite(projetId, activite.id, domaine)
        : await creerActivite(projetId, domaine);
      onEnregistree(enregistree);
      // Le serveur ne code pas les activités : restée dans son lot, l'activité
      // modifiée garde le code qu'elle avait à l'écran.
      const code =
        enregistree.code || (activite?.lotId === enregistree.lotId ? activite.code : "");
      toast.success(
        t(modification ? "succesModification" : "succesCreation", {
          code,
          libelle: enregistree.libelle,
        }),
      );
      onFermer();
    } catch (err) {
      if (!(err instanceof ErreurApi)) {
        toast.error(t("erreurGenerique"));
        return;
      }
      // Chaque champ refusé reçoit son message ; ceux qui n'ont pas de place
      // dans le formulaire rejoignent le message général.
      const horsFormulaire: string[] = [];
      for (const [champ, message] of Object.entries(erreursChampsActivite(err))) {
        if (champ in saisie) form.setError(champ as keyof ValeursActivite, { message });
        else horsFormulaire.push(`${champ} : ${message}`);
      }
      toast.error(err.message || t("erreurGenerique"), {
        description: horsFormulaire.join(" · ") || undefined,
      });
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

        <Form {...form} preRempli={modification}>
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
                  <Select
                    value={field.value}
                    onValueChange={(valeur) => {
                      field.onChange(valeur);
                      // Le plafond du budget suit le lot choisi.
                      if (form.getFieldState("budget").isTouched) void form.trigger("budget");
                    }}
                    disabled={enCours}
                  >
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

            {lotChoisi && !activiteCreable(lotChoisi) && (
              <Alerte
                type="information"
                action={
                  onDefinirDatesLot ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onDefinirDatesLot(lotChoisi)}
                    >
                      {tLots("definirDatesLot")}
                    </Button>
                  ) : undefined
                }
              >
                {tLots("datesLotRequises")}
              </Alerte>
            )}

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

            {datesActiviteFigees && activite && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
                <span className="text-xs text-neutral-600">
                  {tReprog("datesActuellesFormat", {
                    label: tReprog("datesActuelles"),
                    debut: formaterDate(activite.dateDebutPrevue),
                    fin: formaterDate(activite.dateFinPrevue),
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
                    <FormLabel>{t("champDebut")}</FormLabel>
                    <FormControl>
                      <SelecteurDate
                        valeur={field.value}
                        onChange={(valeur) => {
                          field.onChange(valeur);
                          if (form.getFieldState("dateFin").isTouched) void form.trigger("dateFin");
                        }}
                        onBlur={field.onBlur}
                        auPlusTot={lotChoisi?.dateDebut || undefined}
                        auPlusTard={valeurs.dateFin || lotChoisi?.dateFin || undefined}
                        className={CHAMP}
                        placeholder={t("champDateChoisir")}
                        disabled={enCours || datesActiviteFigees}
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
                        auPlusTot={valeurs.dateDebut || lotChoisi?.dateDebut || undefined}
                        auPlusTard={lotChoisi?.dateFin || undefined}
                        className={CHAMP}
                        placeholder={t("champDateChoisir")}
                        disabled={enCours || datesActiviteFigees}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="responsableId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("champResponsable")}</FormLabel>
                  <FormControl>
                    <Combobox
                      className={CHAMP}
                      options={optionsResponsable}
                      valeur={field.value || AUCUN}
                      onChange={(valeur) => field.onChange(valeur === AUCUN ? "" : valeur)}
                      onBlur={field.onBlur}
                      placeholder={t("selectionner")}
                      placeholderRecherche={t("responsableRecherche")}
                      aucunResultat={t("responsableAucunResultat")}
                      disabled={enCours}
                    />
                  </FormControl>
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

            {activite && <HistoriqueDatesCourt objet="activites" id={activite.id} />}
          </form>
        </Form>

        <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={enCours || Boolean(lotChoisi && !activiteCreable(lotChoisi))}
            aria-busy={enCours}
          >
            {enCours && <LoaderCircle className="animate-spin" />}
            {modification ? t("enregistrer") : t("ajouter")}
          </Button>
        </SheetFooter>
      </SheetContent>

      {activite && datesActiviteFigees && (
        <ModaleReprogrammation
          ouverte={reprogrammationOuverte}
          onFermer={() => setReprogrammationOuverte(false)}
          objet="activites"
          id={activite.id}
          nomObjet={activite.libelle}
          projetId={projetId}
          datesActuelles={{ debut: activite.dateDebutPrevue, fin: activite.dateFinPrevue }}
          bornesParent={
            lotChoisi
              ? { debutMin: lotChoisi.dateDebut, finMax: lotChoisi.dateFin }
              : null
          }
          onSucces={(resultat) => {
            form.setValue("dateDebut", resultat.dateDebutPrevue ?? "");
            form.setValue("dateFin", resultat.dateFinPrevue);
            onEnregistree({
              ...activite,
              dateDebutPrevue: resultat.dateDebutPrevue,
              dateFinPrevue: resultat.dateFinPrevue,
            });
          }}
        />
      )}
    </Sheet>
  );
}

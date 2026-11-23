"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, FileDown, LoaderCircle, Lock, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { ReactNode } from "react";

import { ComboboxVille } from "@/components/metier/ComboboxVille";
import { Badge } from "@/components/ui";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ZoneDepotFichiers } from "@/components/ui/zone-depot-fichiers";
import { paysEntreprise } from "@/features/configuration/api";
import { useDroits } from "@/features/habilitations";
import {
  creerProjet,
  modifierProjet,
  telechargerContratProjet,
  telechargerOrdreServiceProjet,
} from "@/features/projets/adaptateur";
import {
  FORMAT_CONTRAT,
  NATURES_PROJET,
  NOMBRE_MAX_CONTRATS,
  TAILLE_MAX_CONTRAT,
  aDureeContractuelle,
  datesVerrouillees,
  dureeProjet,
  refusContrat,
} from "@/features/projets/regles";
import type { ContratProjet, Projet } from "@/features/projets/types";
import {
  LONGUEUR_MAX_DESCRIPTION,
  LONGUEUR_MAX_NOM,
  saisieDepuisProjet,
  saisieProjetVide,
  schemaProjetPour,
  versCreationProjet,
  versModificationProjet,
  type SaisieProjet,
  type ValeursProjet,
} from "@/features/projets/validations";
import { ComboboxTiers } from "@/features/tiers/components/ComboboxTiers";
import type { ErreurApi } from "@/lib/api";
import {
  formaterDate,
  formaterDuree,
  formaterDureeCalendaire,
  formaterMontant,
  formaterSaisieMontant,
  formaterTailleFichier,
  saisieEnCentimes,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { ComboboxTypeProjet } from "./ComboboxTypeProjet";
import { ModaleReprogrammation } from "./ModaleReprogrammation";

const FORM_ID = "form-creation-projet";

/** La hauteur « moyenne » des champs du tiroir — 40 px au lieu des 48 px terrain. */
const CHAMP = "h-[var(--input-height-md)]";

/**
 * Des ascenseurs fins et d'un gris léger pour le corps du tiroir.
 * `scrollbar-color` s'hérite, `scrollbar-width` non : il est posé sur le
 * conteneur qui défile.
 */
const ASCENSEUR_FIN =
  "[scrollbar-width:thin] [scrollbar-color:var(--color-neutral-200)_transparent]";

/** Deux champs par ligne, un seul sur téléphone. */
const RANGEE = "grid grid-cols-2 gap-x-4 gap-y-4 max-[640px]:grid-cols-1";

/** Trois champs par ligne — les dates et la durée du planning. */
const RANGEE_TROIS = "grid grid-cols-3 gap-x-4 gap-y-4 max-[640px]:grid-cols-1";

/** Un champ calculé ou proposé : lisible, mais visiblement pas une saisie libre. */
const CHAMP_CALCULE = "bg-[var(--input-fond-pre-rempli)]";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  onProjetCree?: (projet: Projet) => void;
  /**
   * Le projet à modifier. Absent : le tiroir crée un projet. Présent, il
   * s'ouvre sur ses valeurs — le parent le remonte (`key`) à chaque
   * ouverture pour qu'il reparte de l'état actuel du projet.
   */
  projet?: Projet;
  onProjetModifie?: (projet: Projet) => void;
}

/** L'astérisque des champs obligatoires — décoratif, le schéma fait foi. */
function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

/** Le bandeau de titre d'une section : filet orange à gauche, fond béton. */
function TitreSection({ children }: { children: ReactNode }) {
  return (
    <h3 className="m-0 border-0 border-l-4 border-solid border-primary bg-neutral-100 px-3 py-2 text-xs font-semibold tracking-wider text-neutral-800 uppercase">
      {children}
    </h3>
  );
}

/**
 * La création — ou la modification — d'un projet, dans un **tiroir**, en
 * **une seule étape**. À la création, le planning contractuel et le budget
 * prévisionnel peuvent déjà être renseignés, mais **rien n'y est exigé** :
 * laissés vides, le chef de projet les fixe depuis le projet ouvert. La
 * modification reprend les dates — un lot ne s'ajoute qu'une fois le projet
 * daté —, pas le budget, qui garde sa propre écriture sur la fiche.
 * Les lots et l'équipe se fixent toujours ensuite.
 *
 * Un tiroir latéral prend toute la hauteur disponible, garde l'écran qu'on
 * quitte visible derrière lui, et devient plein écran sur téléphone sans
 * changer de composant.
 */
export function TiroirCreationProjet({
  ouverte,
  onFermer,
  onProjetCree,
  projet,
  onProjetModifie,
}: Props) {
  const t = useTranslations("projets.tiroirCreation");
  const tReprog = useTranslations("projets.reprogrammation");
  const { voitMontants } = useDroits();
  const router = useRouter();
  const modification = projet !== undefined;

  // Les dates déjà fixées ne partent plus par le PATCH (RG-11) : on les change par
  // la reprogrammation, et on garde ici celles qu'elle vient d'écrire.
  const [datesFixees, setDatesFixees] = useState({
    debut: projet?.dateDebutPrevue ?? null,
    fin: projet?.dateFinPrevue ?? null,
  });
  const verrou = datesVerrouillees(datesFixees);
  const [reprogrammationOuverte, setReprogrammationOuverte] = useState(false);
  const [saisieAConfirmer, setSaisieAConfirmer] = useState<ValeursProjet | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const aContratExistant = Boolean(projet && projet.contrats.length > 0);
  const aOsExistant = Boolean(projet?.ordreService);
  const budgetContractuelVerrouille = Boolean(projet && projet.budgetContractuelInitial !== null);
  const dureeContractuelleVerrouillee = Boolean(projet && aDureeContractuelle(projet));
  const dateDebutContractuelleInitiale = projet?.dateDebutContractuelle ?? null;

  const schema = useMemo(
    () =>
      schemaProjetPour({
        modification,
        aContratExistant,
        aOsExistant,
        budgetContractuelVerrouille,
        dureeContractuelleVerrouillee,
        dateDebutContractuelleInitiale,
      }),
    [
      modification,
      aContratExistant,
      aOsExistant,
      budgetContractuelVerrouille,
      dureeContractuelleVerrouillee,
      dateDebutContractuelleInitiale,
    ],
  );

  // Vide tant que le serveur ne l'a pas dit : la liste des villes en dépend,
  // et un pays deviné serait faux hors de Côte d'Ivoire.
  const [pays, setPays] = useState("");

  const form = useForm<SaisieProjet, unknown, ValeursProjet>({
    resolver: zodResolver(schema),
    defaultValues: projet ? saisieDepuisProjet(projet) : saisieProjetVide(),
    mode: "onTouched",
  });

  const valeurs = useWatch({ control: form.control }) as SaisieProjet;
  const enCours = form.formState.isSubmitting || envoiEnCours;
  const duree = dureeProjet(valeurs.dateDebut ?? null, valeurs.dateFin ?? null);

  useEffect(() => {
    let vivant = true;
    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });
    return () => {
      vivant = false;
    };
  }, []);

  /**
   * La saisie repart à vide après une création réussie.
   *
   * Le tiroir reste monté entre deux ouvertures : sans cette remise à zéro,
   * l'utilisateur qui ouvre deux projets de suite retrouve le nom et le
   * maître d'ouvrage du précédent — et crée un doublon sans s'en apercevoir. Ce n'est
   * **pas** fait à la fermeture : un abandon involontaire ne doit pas
   * effacer un formulaire à moitié rempli.
   */
  function reinitialiser() {
    form.reset(saisieProjetVide());
  }

  /** Le motif affiché sous la zone de dépôt quand un fichier est écarté. */
  function motifRefusContrat(fichier: File): string | null {
    switch (refusContrat(fichier)) {
      case "FORMAT":
        return t("refusContratFormat");
      case "TAILLE":
        return t("refusContratTaille", { taille: formaterTailleFichier(TAILLE_MAX_CONTRAT) });
      default:
        return null;
    }
  }

  async function telechargerContratActuel(contrat: ContratProjet) {
    if (!projet) return;
    try {
      const blob = await telechargerContratProjet(projet.id, contrat.id);
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(blob);
      lien.download = contrat.nom;
      lien.click();
      URL.revokeObjectURL(lien.href);
    } catch (err) {
      const cause = err as ErreurApi;
      toast.error(cause.message || t("erreurGenerique"));
    }
  }

  async function telechargerOsActuel() {
    if (!projet?.ordreService) return;
    try {
      const blob = await telechargerOrdreServiceProjet(projet.id);
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(blob);
      lien.download = projet.ordreService.nom || `ordre-service-${projet.reference}`;
      lien.click();
      URL.revokeObjectURL(lien.href);
    } catch (err) {
      const cause = err as ErreurApi;
      toast.error(cause.message || t("erreurGenerique"));
    }
  }

  function doitConfirmerImmuabilite(saisie: ValeursProjet): boolean {
    const poseBudgetContractuel =
      !budgetContractuelVerrouille && voitMontants && saisie.budgetContractuel.trim() !== "";
    const poseDureeContractuelle =
      !dureeContractuelleVerrouillee &&
      (saisie.dureeAnnees.trim() !== "" ||
        saisie.dureeMois.trim() !== "" ||
        saisie.dureeJours.trim() !== "");
    return poseBudgetContractuel || poseDureeContractuelle;
  }

  async function executerSoumission(saisie: ValeursProjet) {
    setEnvoiEnCours(true);
    try {
      if (projet) {
        const modifications = versModificationProjet(saisie, projet.peutRenommer, {
          budgetContractuelVerrouille,
          dureeContractuelleVerrouillee,
          dateDebutContractuelleInitiale,
          voitMontants,
        });
        if (verrou.debut) delete modifications.dateDebutPrevue;
        if (verrou.fin) delete modifications.dateFinPrevue;
        const projetModifie = await modifierProjet(projet.id, modifications);
        onProjetModifie?.(projetModifie);
        toast.success(t("succesModification", { nom: projetModifie.nom }));
        setSaisieAConfirmer(null);
        onFermer();
        return;
      }
      const projetCree = await creerProjet(
        versCreationProjet({
          ...saisie,
          budget: voitMontants ? saisie.budget : "",
          budgetContractuel: voitMontants ? saisie.budgetContractuel : "",
        }),
      );
      reinitialiser();
      onProjetCree?.(projetCree);
      toast.success(t("succesCreation", { nom: projetCree.nom }));
      setSaisieAConfirmer(null);
      onFermer();
      router.push("/projets");
    } catch (err) {
      const cause = err as ErreurApi;
      setSaisieAConfirmer(null);
      const champsApi = cause.erreursParChamp ?? {};
      const correspondance: Record<string, keyof SaisieProjet> = {
        budget_contractuel_initial: "budgetContractuel",
        duree_contractuelle_annees: "dureeAnnees",
        duree_contractuelle_mois: "dureeMois",
        duree_contractuelle_jours: "dureeJours",
        date_debut_contractuelle: "dateDebutContractuelle",
      };
      let messageSpecifique: string | null = null;
      for (const [cleServeur, champForm] of Object.entries(correspondance)) {
        if (champsApi[cleServeur]) {
          form.setError(champForm, { message: champsApi[cleServeur] });
          messageSpecifique = messageSpecifique ?? champsApi[cleServeur];
        }
      }
      toast.error(messageSpecifique || cause.message || t("erreurGenerique"));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function soumettre(saisie: ValeursProjet) {
    if (doitConfirmerImmuabilite(saisie)) {
      setSaisieAConfirmer(saisie);
      return;
    }
    await executerSoumission(saisie);
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-4xl">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg text-neutral-900">
            {projet ? t("titreModification", { nom: projet.nom }) : t("titre")}
          </SheetTitle>
          <SheetDescription>
            {modification ? t("sousTitreModification") : t("sousTitre")}
          </SheetDescription>
        </SheetHeader>

        {/* Seul le corps défile : l'en-tête et les boutons restent en vue. */}
        <Form {...form} preRempli={modification}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(soumettre)}
            noValidate
            className={cn(
              "flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5",
              ASCENSEUR_FIN,
            )}
          >
            <TitreSection>{t("sectionIdentification")}</TitreSection>

            <FormField
              control={form.control}
              name="natureProjet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("champNatureProjet")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <div
                      role="radiogroup"
                      aria-label={t("champNatureProjet")}
                      className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1"
                    >
                      {NATURES_PROJET.map((nature) => {
                        const actif = field.value === nature;
                        return (
                          <button
                            key={nature}
                            type="button"
                            role="radio"
                            aria-checked={actif}
                            disabled={enCours}
                            onClick={() => field.onChange(nature)}
                            className={cn(
                              "flex cursor-pointer flex-col items-start gap-0.5 rounded-md border px-3.5 py-2.5 text-left transition-colors",
                              actif
                                ? "border-primary bg-primary-50/70 text-neutral-900"
                                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
                            )}
                          >
                            <span className="text-sm font-semibold">
                              {t(`natureProjet.${nature}`)}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {t(`natureProjetDescription.${nature}`)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={RANGEE}>
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
                        maxLength={LONGUEUR_MAX_NOM}
                        placeholder={t("champNomPlaceholder")}
                        disabled={enCours || (Boolean(projet) && !projet?.peutRenommer)}
                      />
                    </FormControl>
                    {Boolean(projet) && !projet?.peutRenommer && (
                      <FormDescription>
                        {t("nomReserve")}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("champReference")}{" "}
                      <Badge variante="primaire">{t("badgeAuto")}</Badge>
                    </FormLabel>
                    <FormControl>
                      {/* Unique dans l'entreprise, et citée par les documents
                        déjà émis : elle ne change plus une fois le projet ouvert. */}
                      <Input
                        {...field}
                        className={cn(CHAMP, CHAMP_CALCULE)}
                        placeholder={t("champReferencePlaceholder")}
                        readOnly={modification}
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="typeProjet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("champType")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <ComboboxTypeProjet
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
                name="ville"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("champVille")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <ComboboxVille
                        pays={pays}
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
                name="maitreOuvrage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("champMaitreOuvrage")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <ComboboxTiers
                        role="CLIENT_MOA"
                        paysDefaut={pays}
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
                name="maitreOeuvre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("champMaitreOeuvre")}</FormLabel>
                    <FormControl>
                      <ComboboxTiers
                        role="MAITRE_OEUVRE"
                        paysDefaut={pays}
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
            </div>

            <TitreSection>
              {modification || !voitMontants
                ? t("sectionCalendrier")
                : t("sectionCalendrierBudget")}
            </TitreSection>

            {modification && verrou.reprogrammable && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
                <span className="text-xs text-neutral-600">
                  {tReprog("datesActuellesFormat", {
                    label: tReprog("datesActuelles"),
                    debut: formaterDate(datesFixees.debut),
                    fin: formaterDate(datesFixees.fin),
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

            <div className={RANGEE_TROIS}>
              <FormField
                control={form.control}
                name="dateDebut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("champDateDebut")}</FormLabel>
                    <FormControl>
                      <SelecteurDate
                        valeur={field.value}
                        onChange={(valeur) => {
                          field.onChange(valeur);
                          // La fin se revérifie dès que le début bouge : sinon
                          // l'erreur « fin avant début » survit à sa correction.
                          if (form.getFieldState("dateFin").isTouched)
                            void form.trigger("dateFin");
                        }}
                        onBlur={field.onBlur}
                        auPlusTard={valeurs.dateFin || undefined}
                        className={CHAMP}
                        placeholder={t("champDateChoisir")}
                        disabled={enCours || (modification && verrou.debut)}
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
                    <FormLabel>{t("champDateFin")}</FormLabel>
                    <FormControl>
                      <SelecteurDate
                        valeur={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        auPlusTot={valeurs.dateDebut || undefined}
                        className={CHAMP}
                        placeholder={t("champDateChoisir")}
                        disabled={enCours || (modification && verrou.fin)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-sm leading-none font-medium">
                  {t("champDuree")}{" "}
                  <Badge variante="primaire">{t("badgeCalculee")}</Badge>
                </span>
                <Input
                  readOnly
                  tabIndex={-1}
                  aria-label={t("champDuree")}
                  value={
                    duree === null
                      ? ""
                      : formaterDuree(duree)
                  }
                  placeholder={t("dureePlaceholder")}
                  className={cn(CHAMP, CHAMP_CALCULE)}
                />
              </div>
            </div>

            {!modification && (
              <div className={RANGEE}>
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
                            onChange={(evenement) =>
                              field.onChange(
                                formaterSaisieMontant(evenement.target.value),
                              )
                            }
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
                )}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel>{t("champDescription")}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          maxLength={LONGUEUR_MAX_DESCRIPTION}
                          placeholder={t("champDescriptionPlaceholder")}
                          disabled={enCours}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <TitreSection>{t("sectionContrat")}</TitreSection>

            {modification && projet && projet.contrats.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <span className="text-xs font-medium text-neutral-500">
                  {t("contratsExistants")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {projet.contrats.map((contrat) => (
                    <Button
                      key={contrat.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void telechargerContratActuel(contrat)}
                    >
                      <FileDown className="size-4" aria-hidden="true" />
                      <span className="max-w-56 truncate">{contrat.nom}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="contrats"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("champContrats")}</FormLabel>
                  <FormControl>
                    <ZoneDepotFichiers
                      fichiers={field.value}
                      onChange={(fichiers) => {
                        field.onChange(fichiers);
                        field.onBlur();
                        void form.trigger([
                          "budgetContractuel",
                          "dureeAnnees",
                          "dureeMois",
                          "dureeJours",
                        ]);
                      }}
                      name={field.name}
                      accept={FORMAT_CONTRAT}
                      multiple
                      maximum={NOMBRE_MAX_CONTRATS}
                      refuser={motifRefusContrat}
                      consigne={t("consigneContrats", {
                        taille: formaterTailleFichier(TAILLE_MAX_CONTRAT),
                        max: NOMBRE_MAX_CONTRATS,
                      })}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(budgetContractuelVerrouille || dureeContractuelleVerrouillee) && (
              <Alert variant="information">
                <Lock className="size-4" aria-hidden="true" />
                <AlertDescription>{t("verrouContratAide")}</AlertDescription>
              </Alert>
            )}

            <div className={RANGEE}>
              {voitMontants && (
                <FormField
                  control={form.control}
                  name="budgetContractuel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <span>{t("champBudgetContractuel")}</span>
                        {budgetContractuelVerrouille && (
                          <Badge variante="neutre">{t("verrouContratBadge")}</Badge>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(evenement) =>
                            field.onChange(formaterSaisieMontant(evenement.target.value))
                          }
                          className={cn(
                            CHAMP,
                            "tabular-nums",
                            budgetContractuelVerrouille && CHAMP_CALCULE,
                          )}
                          inputMode="numeric"
                          placeholder={t("champBudgetContractuelPlaceholder")}
                          disabled={enCours || budgetContractuelVerrouille}
                          readOnly={budgetContractuelVerrouille}
                        />
                      </FormControl>
                      {!budgetContractuelVerrouille && (
                        <FormDescription>{t("aideBudgetContractuel")}</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-sm leading-none font-medium">
                  <span>{t("champDureeContractuelle")}</span>
                  {dureeContractuelleVerrouillee && (
                    <Badge variante="neutre">{t("verrouContratBadge")}</Badge>
                  )}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <FormField
                    control={form.control}
                    name="dureeAnnees"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-neutral-500">
                          {t("champDureeAnnees")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            className={cn(
                              CHAMP,
                              "tabular-nums",
                              dureeContractuelleVerrouillee && CHAMP_CALCULE,
                            )}
                            disabled={enCours || dureeContractuelleVerrouillee}
                            readOnly={dureeContractuelleVerrouillee}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dureeMois"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-neutral-500">
                          {t("champDureeMois")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            className={cn(
                              CHAMP,
                              "tabular-nums",
                              dureeContractuelleVerrouillee && CHAMP_CALCULE,
                            )}
                            disabled={enCours || dureeContractuelleVerrouillee}
                            readOnly={dureeContractuelleVerrouillee}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dureeJours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-neutral-500">
                          {t("champDureeJours")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            className={cn(
                              CHAMP,
                              "tabular-nums",
                              dureeContractuelleVerrouillee && CHAMP_CALCULE,
                            )}
                            disabled={enCours || dureeContractuelleVerrouillee}
                            readOnly={dureeContractuelleVerrouillee}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {!dureeContractuelleVerrouillee && (
                  <p className="m-0 text-xs text-neutral-500">{t("aideDureeContractuelle")}</p>
                )}
              </div>
            </div>

            <TitreSection>{t("sectionOrdreService")}</TitreSection>

            {modification && projet?.ordreService && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs text-neutral-500">{t("ordreServiceActuel")}</span>
                  <span className="truncate text-sm font-medium text-neutral-900">
                    {projet.ordreService.nom}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void telechargerOsActuel()}
                >
                  <FileDown className="size-4" aria-hidden="true" />
                  {t("telechargerOrdreService")}
                </Button>
              </div>
            )}

            <FormField
              control={form.control}
              name="ordreService"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {modification && projet?.ordreService
                      ? t("champOrdreServiceRemplacer")
                      : t("champOrdreService")}
                  </FormLabel>
                  <FormControl>
                    <ZoneDepotFichiers
                      fichiers={field.value}
                      onChange={(fichiers) => {
                        field.onChange(fichiers);
                        field.onBlur();
                        void form.trigger("dateDebutContractuelle");
                      }}
                      name={field.name}
                      accept={FORMAT_CONTRAT}
                      maximum={1}
                      refuser={motifRefusContrat}
                      consigne={t("consigneOrdreService", {
                        taille: formaterTailleFichier(TAILLE_MAX_CONTRAT),
                      })}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateDebutContractuelle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("champDateDebutContractuelle")}</FormLabel>
                  <FormControl>
                    <SelecteurDate
                      valeur={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      className={CHAMP}
                      placeholder={t("champDateChoisir")}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormDescription>
                    {dateDebutContractuelleInitiale
                      ? t("aideDateDebutContractuelleRemplacement")
                      : t("aideDateDebutContractuelle")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onFermer}
            disabled={enCours}
          >
            {t("annuler")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={enCours}
            aria-busy={enCours}
          >
            {enCours ? <LoaderCircle className="animate-spin" /> : null}
            {enCours &&
              (modification
                ? t("enregistrementEnCours")
                : t("creationEnCours"))}
            {!enCours && (modification ? t("enregistrer") : t("creer"))}
            {!enCours && <ArrowUpRight />}
          </Button>
        </SheetFooter>
      </SheetContent>

      {saisieAConfirmer && (
        <Dialog
          open
          onOpenChange={(ouvert) => !ouvert && !envoiEnCours && setSaisieAConfirmer(null)}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("confirmationImmuabilite.titre")}</DialogTitle>
              <DialogDescription>{t("confirmationImmuabilite.description")}</DialogDescription>
            </DialogHeader>
            <dl className="m-0 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 text-sm">
              {!budgetContractuelVerrouille &&
                voitMontants &&
                saisieAConfirmer.budgetContractuel.trim() !== "" && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-600">
                      {t("confirmationImmuabilite.budgetContractuel")}
                    </dt>
                    <dd className="m-0 font-semibold tabular-nums text-neutral-900">
                      {formaterMontant(saisieEnCentimes(saisieAConfirmer.budgetContractuel))}
                    </dd>
                  </div>
                )}
              {!dureeContractuelleVerrouillee &&
                (saisieAConfirmer.dureeAnnees.trim() !== "" ||
                  saisieAConfirmer.dureeMois.trim() !== "" ||
                  saisieAConfirmer.dureeJours.trim() !== "") && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-600">
                      {t("confirmationImmuabilite.dureeContractuelle")}
                    </dt>
                    <dd className="m-0 font-semibold text-neutral-900">
                      {formaterDureeCalendaire({
                        annees: Number.parseInt(saisieAConfirmer.dureeAnnees || "0", 10) || 0,
                        mois: Number.parseInt(saisieAConfirmer.dureeMois || "0", 10) || 0,
                        jours: Number.parseInt(saisieAConfirmer.dureeJours || "0", 10) || 0,
                      })}
                    </dd>
                  </div>
                )}
              {saisieAConfirmer.dateDebutContractuelle.trim() !== "" && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-neutral-600">
                    {t("confirmationImmuabilite.dateDebutContractuelle")}
                  </dt>
                  <dd className="m-0 font-semibold tabular-nums text-neutral-900">
                    {formaterDate(saisieAConfirmer.dateDebutContractuelle)}
                  </dd>
                </div>
              )}
            </dl>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaisieAConfirmer(null)}
                disabled={envoiEnCours}
              >
                {t("confirmationImmuabilite.annuler")}
              </Button>
              <Button
                type="button"
                onClick={() => void executerSoumission(saisieAConfirmer)}
                disabled={envoiEnCours}
                aria-busy={envoiEnCours}
              >
                {envoiEnCours && <LoaderCircle className="animate-spin" />}
                {t("confirmationImmuabilite.confirmer")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {projet && verrou.reprogrammable && (
        <ModaleReprogrammation
          ouverte={reprogrammationOuverte}
          onFermer={() => setReprogrammationOuverte(false)}
          objet="projets"
          id={projet.id}
          nomObjet={projet.nom}
          projetId={projet.id}
          datesActuelles={datesFixees}
          onSucces={(resultat) => {
            form.setValue("dateDebut", resultat.dateDebutPrevue ?? "");
            form.setValue("dateFin", resultat.dateFinPrevue);
            setDatesFixees({ debut: resultat.dateDebutPrevue, fin: resultat.dateFinPrevue });
            onProjetModifie?.({
              ...projet,
              dateDebutPrevue: resultat.dateDebutPrevue,
              dateFinPrevue: resultat.dateFinPrevue,
            });
          }}
        />
      )}
    </Sheet>
  );
}

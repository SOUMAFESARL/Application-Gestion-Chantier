"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, CircleCheck, CircleX, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { FormEvent, ReactNode } from "react";

import { ComboboxVille } from "@/components/metier/ComboboxVille";
import { Badge } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { ComboboxMultiple } from "@/components/ui/combobox-multiple";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { paysEntreprise } from "@/features/configuration/api";
import { creerProjet, proposerReferenceProjet } from "@/features/projets/adaptateur";
import {
  joursOuvres,
  MODES_EXECUTION_LOT,
  numeroLot,
  TYPES_BORDEREAU,
  TYPES_PROJET,
} from "@/features/projets/regles";
import { COLLABORATEURS_DEMONSTRATION } from "@/features/projets/simulationProjets";
import type { Projet } from "@/features/projets/types";
import {
  CHAMPS_ETAPES,
  LONGUEUR_MAX_DESCRIPTION,
  LONGUEUR_MAX_NOM,
  lotVide,
  saisieCreationVide,
  schemaCreationProjet,
  schemaEtapeEquipe,
  schemaEtapeInformations,
  schemaEtapeLots,
  versCreationProjet,
  type SaisieCreationProjet,
  type ValeursCreationProjet,
} from "@/features/projets/validations";
import type { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * La liste de repli vient du jeu de démonstration du domaine, et non d'une
 * copie locale : c'est lui qui retrouvera le collaborateur à partir de
 * l'identifiant soumis ici.
 */
const COLLABORATEURS = COLLABORATEURS_DEMONSTRATION;

const FORM_ID = "form-creation-projet";

/** Les trois étapes, dans l'ordre, avec le schéma qui les déverrouille. */
const ETAPES = [
  { cle: "etapeInformations", schema: schemaEtapeInformations },
  { cle: "etapeLots", schema: schemaEtapeLots },
  { cle: "etapeEquipe", schema: schemaEtapeEquipe },
] as const;

const DERNIERE_ETAPE = ETAPES.length - 1;

/** Deux champs côte à côte, empilés sous 640 px. */
const RANGEE = "grid grid-cols-2 gap-x-4 gap-y-3 max-[640px]:grid-cols-1";

/** Trois champs côte à côte (le planning), empilés sous 640 px. */
const RANGEE_TROIS = "grid grid-cols-3 gap-x-4 gap-y-3 max-[640px]:grid-cols-1";

/** La hauteur « moyenne » des champs du tiroir — 40 px au lieu des 48 px terrain. */
const CHAMP = "h-[var(--input-height-md)]";

/**
 * Des ascenseurs fins et d'un gris léger, pour le corps du tiroir comme pour
 * le tableau des lots (qui défile en largeur sur petit écran).
 * `scrollbar-color` s'hérite, `scrollbar-width` non : il est posé sur chaque
 * conteneur qui défile.
 */
const ASCENSEUR_FIN =
  "[scrollbar-width:thin] [scrollbar-color:var(--color-neutral-200)_transparent] [&_[data-slot=table-container]]:[scrollbar-width:thin]";

/** Un champ calculé ou proposé : lisible, mais visiblement pas une saisie libre. */
const CHAMP_CALCULE = "bg-neutral-100";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  onProjetCree?: (projet: Projet) => void;
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
 * La création d'un projet, dans un **tiroir**, en **trois étapes** :
 * informations générales, lots & bordereau, équipe projet.
 *
 * Un tiroir latéral prend toute la hauteur disponible, garde l'écran qu'on
 * quitte visible derrière lui, et devient plein écran sur téléphone sans
 * changer de composant. Il est plus large qu'avant : le tableau des lots de
 * l'étape 2 compte sept colonnes.
 *
 * **Un seul formulaire** (`react-hook-form` + `schemaCreationProjet`) porte les
 * trois étapes : revenir en arrière ne perd rien. Chaque étape a son propre
 * schéma (`features/projets/validations.ts`), et « Suivant » reste désactivé
 * tant que celui de l'étape en cours n'est pas satisfait.
 *
 * **Aucun collaborateur n'est présélectionné** — le premier de la liste,
 * choisi à la place de l'utilisateur, finissait rattaché à des projets qui
 * n'étaient pas les siens.
 */
export function TiroirCreationProjet({ ouverte, onFermer, onProjetCree }: Props) {
  const t = useTranslations("projets.tiroirCreation");

  const [etape, setEtape] = useState(0);
  // Vide tant que le serveur ne l'a pas dit : la liste des villes en dépend,
  // et un pays deviné serait faux hors de Côte d'Ivoire.
  const [pays, setPays] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const form = useForm<SaisieCreationProjet, unknown, ValeursCreationProjet>({
    resolver: zodResolver(schemaCreationProjet),
    defaultValues: saisieCreationVide(),
    mode: "onTouched",
  });

  const lots = useFieldArray({ control: form.control, name: "lots" });

  const valeurs = useWatch({ control: form.control }) as SaisieCreationProjet;
  const enCours = form.formState.isSubmitting;
  const etapeValide = ETAPES[etape].schema.safeParse(valeurs).success;
  const duree = joursOuvres(valeurs.dateDebut, valeurs.dateFin);

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
   * La référence proposée est demandée à chaque ouverture, et seulement si le
   * champ est encore vierge : elle dépend des projets créés entre-temps, mais
   * une référence retouchée à la main ne doit pas être écrasée.
   */
  useEffect(() => {
    if (!ouverte) return;
    let vivant = true;
    proposerReferenceProjet()
      .then((reference) => {
        if (vivant && reference && !form.getValues("reference")) {
          form.setValue("reference", reference);
        }
      })
      .catch(() => {
        // Sans proposition, le serveur engendrera la référence.
      });
    return () => {
      vivant = false;
    };
  }, [ouverte, form]);

  /**
   * La saisie repart à vide après une création réussie.
   *
   * Le tiroir reste monté entre deux ouvertures : sans cette remise à zéro,
   * l'utilisateur qui ouvre deux projets de suite retrouve le nom, les dates
   * et l'équipe du précédent — et crée un doublon sans s'en apercevoir. Ce
   * n'est **pas** fait à la fermeture : un abandon involontaire ne doit pas
   * effacer un formulaire à moitié rempli.
   */
  function reinitialiser() {
    form.reset(saisieCreationVide());
    setEtape(0);
    setErreur(null);
  }

  async function suivant() {
    // Revérifie l'étape pour afficher ses messages — le bouton est déjà
    // désactivé tant qu'elle est incomplète, mais « Entrée » passe par ici.
    const valide = await form.trigger(CHAMPS_ETAPES[etape]);
    if (valide) setEtape((courante) => Math.min(courante + 1, DERNIERE_ETAPE));
  }

  async function soumettre(saisie: ValeursCreationProjet) {
    setErreur(null);
    try {
      const projetCree = await creerProjet(versCreationProjet(saisie));
      reinitialiser();
      onProjetCree?.(projetCree);
      onFermer();
    } catch (err) {
      const cause = err as ErreurApi;
      setErreur(cause.message || t("erreurGenerique"));
    }
  }

  /** « Entrée » dans un champ avance d'une étape ; seule la dernière crée le projet. */
  function surSoumission(evenement: FormEvent<HTMLFormElement>) {
    if (etape < DERNIERE_ETAPE) {
      evenement.preventDefault();
      if (etapeValide) void suivant();
      return;
    }
    void form.handleSubmit(soumettre)(evenement);
  }

  const optionsCollaborateurs = COLLABORATEURS.map((personne) => ({
    valeur: personne.id,
    libelle: personne.nomComplet,
  }));
  // Aucun référentiel de bailleurs n'existe encore : le champ l'annonce
  // plutôt que de proposer une liste vide.
  const optionsBailleurs: typeof optionsCollaborateurs = [];

  const libelleSuivant = etape === 0 ? t("suivantLots") : t("suivantEquipe");

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      {/* 896 px : les sept colonnes du tableau des lots tiennent sans se
          casser. En dessous de cette largeur d'écran, le tiroir l'occupe
          entièrement et le tableau défile horizontalement. */}
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-4xl">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg text-neutral-900">{t("titre")}</SheetTitle>
          <SheetDescription>{t("sousTitre")}</SheetDescription>
        </SheetHeader>

        {/* Seul le corps défile : l'en-tête et la navigation entre étapes
            restent en vue. */}
        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={surSoumission}
            noValidate
            className={cn("flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5", ASCENSEUR_FIN)}
          >
            {erreur && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}

            {etape === 0 && (
              <>
                <TitreSection>{t("sectionIdentification")}</TitreSection>

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
                            disabled={enCours}
                          />
                        </FormControl>
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
                          {t("champReference")} <Badge variante="primaire">{t("badgeAuto")}</Badge>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className={cn(CHAMP, CHAMP_CALCULE)}
                            placeholder={t("champReferencePlaceholder")}
                            disabled={enCours}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className={RANGEE}>
                  <FormField
                    control={form.control}
                    name="typeProjet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("champType")} <Requis />
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={enCours}
                        >
                          <FormControl>
                            <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                              <SelectValue placeholder={t("selectionner")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TYPES_PROJET.map((type) => (
                              <SelectItem key={type} value={type}>
                                {t(`typeProjet.${type}`)}
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
                </div>

                <div className={RANGEE}>
                  <FormField
                    control={form.control}
                    name="maitreOuvrage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("champMaitreOuvrage")} <Requis />
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className={CHAMP}
                            placeholder={t("champMaitreOuvragePlaceholder")}
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
                          <Input
                            {...field}
                            className={CHAMP}
                            placeholder={t("champMaitreOeuvrePlaceholder")}
                            disabled={enCours}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <TitreSection>{t("sectionPlanning")}</TitreSection>

                <div className={RANGEE_TROIS}>
                  <FormField
                    control={form.control}
                    name="dateDebut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("champDateDebut")} <Requis />
                        </FormLabel>
                        <FormControl>
                          <SelecteurDate
                            valeur={field.value}
                            onChange={(valeur) => {
                              field.onChange(valeur);
                              // La fin se revérifie dès que le début bouge : sinon
                              // l'erreur « fin avant début » survit à sa correction.
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
                        <FormLabel>
                          {t("champDateFin")} <Requis />
                        </FormLabel>
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
                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-2 text-sm leading-none font-medium">
                      {t("champDuree")} <Badge variante="primaire">{t("badgeCalculee")}</Badge>
                    </span>
                    <Input
                      readOnly
                      tabIndex={-1}
                      aria-label={t("champDuree")}
                      value={duree === null ? "" : t("dureeJoursOuvres", { jours: duree })}
                      placeholder={t("dureePlaceholder")}
                      className={cn(CHAMP, CHAMP_CALCULE)}
                    />
                  </div>
                </div>

                <TitreSection>{t("sectionBudget")}</TitreSection>

                <div className={RANGEE}>
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("champBudget")} <Requis />
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className={CHAMP}
                            inputMode="numeric"
                            placeholder={t("champBudgetPlaceholder")}
                            disabled={enCours}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
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
              </>
            )}

            {etape === 1 && (
              <>
                <TitreSection>{t("sectionLots")}</TitreSection>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">{t("colonneNumero")}</TableHead>
                      <TableHead className="min-w-44">
                        {t("colonneNomLot")} <Requis />
                      </TableHead>
                      <TableHead className="min-w-40">
                        {t("colonneModeExecution")} <Requis />
                      </TableHead>
                      <TableHead className="min-w-36">
                        {t("colonneTypeBordereau")} <Requis />
                      </TableHead>
                      <TableHead className="min-w-40">{t("colonneDateDebut")}</TableHead>
                      <TableHead className="min-w-40">{t("colonneDateFin")}</TableHead>
                      <TableHead className="w-12 text-center">{t("colonneAction")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lots.fields.map((lot, rang) => (
                      <TableRow key={lot.id}>
                        <TableCell className="font-mono text-xs font-semibold text-neutral-700">
                          {numeroLot(rang)}
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`lots.${rang}.nom`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">{t("colonneNomLot")}</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    className={CHAMP}
                                    placeholder={t("champNomLotPlaceholder")}
                                    disabled={enCours}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`lots.${rang}.modeExecution`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">{t("colonneModeExecution")}</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled={enCours}
                                >
                                  <FormControl>
                                    <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                                      <SelectValue placeholder={t("selectionner")} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {MODES_EXECUTION_LOT.map((mode) => (
                                      <SelectItem key={mode} value={mode}>
                                        {t(`modeExecution.${mode}`)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`lots.${rang}.typeBordereau`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">{t("colonneTypeBordereau")}</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled={enCours}
                                >
                                  <FormControl>
                                    <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                                      <SelectValue placeholder={t("selectionner")} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {TYPES_BORDEREAU.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {t(`typeBordereau.${type}`)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`lots.${rang}.dateDebut`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">{t("colonneDateDebut")}</FormLabel>
                                <FormControl>
                                  <SelecteurDate
                                    valeur={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    auPlusTard={valeurs.lots?.[rang]?.dateFin}
                                    className={cn(CHAMP, "text-sm")}
                                    placeholder={t("champDateChoisir")}
                                    disabled={enCours}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`lots.${rang}.dateFin`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">{t("colonneDateFin")}</FormLabel>
                                <FormControl>
                                  <SelecteurDate
                                    valeur={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    auPlusTot={valeurs.lots?.[rang]?.dateDebut}
                                    className={cn(CHAMP, "text-sm")}
                                    placeholder={t("champDateChoisir")}
                                    disabled={enCours}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {/* Le dernier lot ne se retire pas : un projet en compte au moins un. */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t("retirerLot", { numero: numeroLot(rang) })}
                            onClick={() => lots.remove(rang)}
                            disabled={enCours || lots.fields.length === 1}
                            className="text-erreur hover:text-erreur"
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={7} className="p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => lots.append(lotVide())}
                          disabled={enCours}
                          className="w-full text-neutral-600"
                        >
                          <Plus />
                          {t("ajouterLot")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            )}

            {etape === 2 && (
              <>
                <TitreSection>{t("sectionEquipe")}</TitreSection>

                <div className={RANGEE}>
                  <FormField
                    control={form.control}
                    name="chefProjetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("champChefProjet")} <Requis />
                        </FormLabel>
                        <FormControl>
                          <Combobox
                            options={optionsCollaborateurs}
                            valeur={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            className={CHAMP}
                            placeholder={t("selectionnerUtilisateur")}
                            placeholderRecherche={t("rechercherCollaborateur")}
                            aucunResultat={t("aucunCollaborateur")}
                            disabled={enCours}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="conducteurTravauxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("champConducteur")} <Requis />
                        </FormLabel>
                        <FormControl>
                          <Combobox
                            options={optionsCollaborateurs}
                            valeur={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            className={CHAMP}
                            placeholder={t("selectionner")}
                            placeholderRecherche={t("rechercherCollaborateur")}
                            aucunResultat={t("aucunCollaborateur")}
                            disabled={enCours}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className={RANGEE}>
                  <FormField
                    control={form.control}
                    name="chefsChantierIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("champChefsChantier")} <Requis />
                        </FormLabel>
                        <FormControl>
                          <ComboboxMultiple
                            options={optionsCollaborateurs}
                            valeurs={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            className={CHAMP}
                            placeholder={t("selectionner")}
                            placeholderRecherche={t("rechercherCollaborateur")}
                            aucunResultat={t("aucunCollaborateur")}
                            disabled={enCours}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="directeurFinancierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("champDirecteurFinancier")}</FormLabel>
                        <FormControl>
                          <Combobox
                            options={optionsCollaborateurs}
                            valeur={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            className={CHAMP}
                            placeholder={t("selectionner")}
                            placeholderRecherche={t("rechercherCollaborateur")}
                            aucunResultat={t("aucunCollaborateur")}
                            disabled={enCours}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className={RANGEE}>
                  <FormField
                    control={form.control}
                    name="visiteursIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("champVisiteurs")}</FormLabel>
                        <FormControl>
                          <ComboboxMultiple
                            options={optionsCollaborateurs}
                            valeurs={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            className={CHAMP}
                            placeholder={t("selectionner")}
                            placeholderRecherche={t("rechercherCollaborateur")}
                            aucunResultat={t("aucunCollaborateur")}
                            disabled={enCours}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bailleursIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("champBailleurs")}</FormLabel>
                        <FormControl>
                          <ComboboxMultiple
                            options={optionsBailleurs}
                            valeurs={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            className={CHAMP}
                            placeholder={
                              optionsBailleurs.length === 0 ? t("aucunBailleur") : t("selectionner")
                            }
                            placeholderRecherche={t("rechercherBailleur")}
                            aucunResultat={t("aucunBailleur")}
                            disabled={enCours || optionsBailleurs.length === 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {etapeValide && (
                  <Alert variant="succes">
                    <CircleCheck />
                    <AlertDescription>{t("toutEstPret")}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </form>
        </Form>

        <SheetFooter className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-neutral-200 px-6 py-4 max-[640px]:grid-cols-2">
          <div className="max-[640px]:order-2">
            {etape === 0 ? (
              <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
                {t("annuler")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEtape((courante) => Math.max(courante - 1, 0))}
                disabled={enCours}
              >
                {t("retour")}
              </Button>
            )}
          </div>

          <p
            className="m-0 text-center text-sm text-neutral-600 max-[640px]:order-1 max-[640px]:col-span-2"
            aria-live="polite"
          >
            {t("indicateurEtape", {
              numero: etape + 1,
              total: ETAPES.length,
              libelle: t(ETAPES[etape].cle),
            })}
          </p>

          <div className="flex justify-end max-[640px]:order-3">
            {etape < DERNIERE_ETAPE ? (
              <Button
                type="button"
                onClick={() => void suivant()}
                disabled={enCours || !etapeValide}
              >
                {libelleSuivant}
              </Button>
            ) : (
              <Button
                type="submit"
                form={FORM_ID}
                disabled={enCours || !etapeValide}
                aria-busy={enCours}
              >
                {enCours ? <LoaderCircle className="animate-spin" /> : null}
                {enCours ? t("creationEnCours") : t("creer")}
                {!enCours && <ArrowUpRight />}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

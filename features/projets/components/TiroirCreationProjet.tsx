"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, CircleX, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { ReactNode } from "react";

import { ComboboxVille } from "@/components/metier/ComboboxVille";
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
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  creerProjet,
  modifierProjet,
  proposerReferenceProjet,
} from "@/features/projets/adaptateur";
import {
  FORMAT_CONTRAT,
  NOMBRE_MAX_CONTRATS,
  TAILLE_MAX_CONTRAT,
  TYPES_PROJET,
  joursOuvres,
  refusContrat,
} from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import {
  LONGUEUR_MAX_DESCRIPTION,
  LONGUEUR_MAX_NOM,
  saisieDepuisProjet,
  saisieProjetVide,
  schemaProjet,
  versCreationProjet,
  versModificationProjet,
  type SaisieProjet,
  type ValeursProjet,
} from "@/features/projets/validations";
import type { ErreurApi } from "@/lib/api";
import { formaterSaisieMontant, formaterTailleFichier } from "@/lib/format";
import { cn } from "@/lib/utils";

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
const CHAMP_CALCULE = "bg-neutral-100";

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
 * modification ne les montre pas — ils ont leur propre écriture sur la fiche.
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
  const modification = projet !== undefined;

  // Vide tant que le serveur ne l'a pas dit : la liste des villes en dépend,
  // et un pays deviné serait faux hors de Côte d'Ivoire.
  const [pays, setPays] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const form = useForm<SaisieProjet, unknown, ValeursProjet>({
    resolver: zodResolver(schemaProjet),
    defaultValues: projet ? saisieDepuisProjet(projet) : saisieProjetVide(),
    mode: "onTouched",
  });

  const valeurs = useWatch({ control: form.control }) as SaisieProjet;
  const enCours = form.formState.isSubmitting;
  const saisieValide = schemaProjet.safeParse(valeurs).success;
  const duree = joursOuvres(valeurs.dateDebut ?? "", valeurs.dateFin ?? "");

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
    // Un projet existant a déjà sa référence : elle ne se repropose pas.
    if (!ouverte || modification) return;
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
  }, [ouverte, modification, form]);

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
    setErreur(null);
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

  async function soumettre(saisie: ValeursProjet) {
    setErreur(null);
    try {
      if (projet) {
        onProjetModifie?.(
          await modifierProjet(projet.id, versModificationProjet(saisie)),
        );
        onFermer();
        return;
      }
      const projetCree = await creerProjet(versCreationProjet(saisie));
      reinitialiser();
      onProjetCree?.(projetCree);
      onFermer();
    } catch (err) {
      const cause = err as ErreurApi;
      setErreur(cause.message || t("erreurGenerique"));
    }
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
        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(soumettre)}
            noValidate
            className={cn(
              "flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5",
              ASCENSEUR_FIN,
            )}
          >
            {erreur && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}

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
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={enCours}
                    >
                      <FormControl>
                        <SelectTrigger
                          className={cn(CHAMP, "w-full bg-card")}
                          onBlur={field.onBlur}
                        >
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

            {!modification && (
              <>
                <TitreSection>{t("sectionCalendrierBudget")}</TitreSection>

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
                        <FormLabel>{t("champDateFin")}</FormLabel>
                        <FormControl>
                          <SelecteurDate
                            valeur={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            auPlusTot={valeurs.dateDebut || undefined}
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
                          : t("dureeJoursOuvres", { jours: duree })
                      }
                      placeholder={t("dureePlaceholder")}
                      className={cn(CHAMP, CHAMP_CALCULE)}
                    />
                  </div>
                </div>

                <div className={RANGEE}>
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

                <TitreSection>{t("sectionContrat")}</TitreSection>

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
                          }}
                          name={field.name}
                          accept={`${FORMAT_CONTRAT},.pdf`}
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
              </>
            )}
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
            disabled={enCours || !saisieValide}
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
    </Sheet>
  );
}

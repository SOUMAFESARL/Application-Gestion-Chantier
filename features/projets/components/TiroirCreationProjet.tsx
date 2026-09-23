"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleX, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { ComboboxVille } from "@/components/metier/ComboboxVille";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { paysEntreprise } from "@/features/configuration/api";
import { creerProjet } from "@/features/projets/adaptateur";
import {
  COLLABORATEURS_DEMONSTRATION,
  OPTIONS_CLIENTS_DEMONSTRATION,
} from "@/features/projets/simulationProjets";
import type { Projet } from "@/features/projets/types";
import {
  LONGUEUR_MAX_DESCRIPTION,
  LONGUEUR_MAX_NOM,
  saisieCreationVide,
  schemaCreationProjet,
  versCreationProjet,
  type SaisieCreationProjet,
  type ValeursCreationProjet,
} from "@/features/projets/validations";
import { listerTiers } from "@/features/tiers/adaptateur";
import type { TiersOption } from "@/features/tiers/types";
import type { ErreurApi } from "@/lib/api";
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";

/**
 * Les listes de repli viennent du jeu de démonstration du domaine, et non
 * d'une copie locale : c'est lui qui retrouvera la raison sociale du client
 * à partir de l'identifiant soumis ici. Deux copies, et un chantier
 * fraîchement créé s'afficherait sous un client inconnu.
 */
const CLIENTS_INITIAUX: TiersOption[] = OPTIONS_CLIENTS_DEMONSTRATION;

const UTILISATEURS_INITIAUX = COLLABORATEURS_DEMONSTRATION;

const FORM_ID = "form-creation-projet";

/** Deux champs côte à côte, empilés sous 640 px. */
const RANGEE = "grid grid-cols-2 gap-3 max-[640px]:grid-cols-1";

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

/**
 * La création d'un chantier, dans un **tiroir** et non dans une modale.
 *
 * Le formulaire compte treize champs : dans une modale centrée, il fallait
 * lui donner son propre défilement interne et il restait à l'étroit sur un
 * portable. Un tiroir latéral prend toute la hauteur disponible, garde
 * l'écran qu'on quitte visible derrière lui, et devient plein écran sur
 * téléphone sans changer de composant.
 *
 * La saisie est tenue par `react-hook-form` et vérifiée par
 * `schemaCreationProjet` (`features/projets/validations.ts`) : les messages
 * d'erreur s'affichent sous chaque champ, et plus seulement par la bulle
 * native d'un `required`. **Aucun client ni responsable n'est présélectionné**
 * — le premier de la liste, choisi à la place de l'utilisateur, finissait
 * rattaché à des chantiers qui n'étaient pas les siens.
 */
export function TiroirCreationProjet({ ouverte, onFermer, onProjetCree }: Props) {
  const t = useTranslations("projets.tiroirCreation");

  const [clients, setClients] = useState<TiersOption[]>(CLIENTS_INITIAUX);
  const utilisateurs = UTILISATEURS_INITIAUX;
  // Vide tant que le serveur ne l'a pas dit : la liste des villes et
  // l'indicatif téléphonique en dépendent, et un pays deviné serait faux
  // hors de Côte d'Ivoire.
  const [pays, setPays] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const form = useForm<SaisieCreationProjet, unknown, ValeursCreationProjet>({
    resolver: zodResolver(schemaCreationProjet),
    defaultValues: saisieCreationVide(),
  });

  const modeCp = useWatch({ control: form.control, name: "modeCp" });
  const dateDebut = useWatch({ control: form.control, name: "dateDebut" });
  const enCours = form.formState.isSubmitting;

  // Chargement asynchrone des tiers clients existants
  useEffect(() => {
    let vivant = true;

    /**
     * Sous simulation, on **ne lit pas** les vrais tiers : le chantier créé
     * est écrit par `simulationProjets`, qui ne connaît que les clients de
     * démonstration. Un identifiant venu du serveur ne s'y retrouverait pas,
     * et la ligne s'afficherait sous une raison sociale qui n'est pas la sienne.
     */
    if (!SIMULATION_ACTIVE) {
      listerTiers()
        .then((liste) => {
          if (vivant && liste.length > 0) {
            setClients(liste);
          }
        })
        .catch(() => {
          // Maintient la liste par défaut
        });
    }

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
   * l'utilisateur qui ouvre deux chantiers de suite retrouve le nom, les
   * dates et le conducteur de travaux du précédent — et crée un doublon
   * sans s'en apercevoir. Ce n'est **pas** fait à la fermeture : un abandon
   * involontaire ne doit pas effacer un formulaire à moitié rempli.
   */
  function reinitialiser() {
    form.reset(saisieCreationVide());
    setErreur(null);
  }

  async function soumettre(valeurs: ValeursCreationProjet) {
    setErreur(null);
    try {
      const projetCree = await creerProjet(versCreationProjet(valeurs));
      reinitialiser();
      onProjetCree?.(projetCree);
      onFermer();
    } catch (err) {
      const cause = err as ErreurApi;
      setErreur(cause.message || t("erreurGenerique"));
    }
  }

  const optionsClients = clients.map((client) => ({
    valeur: client.id,
    libelle: client.raisonSociale,
  }));
  const optionsCollaborateurs = utilisateurs.map((utilisateur) => ({
    valeur: utilisateur.id,
    libelle: `${utilisateur.prenom} ${utilisateur.nom}`,
  }));

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      {/* 560 px : les rangées à deux colonnes (ville/quartier, les deux dates)
          tiennent sans se casser. En dessous de cette largeur d'écran, le
          tiroir l'occupe entièrement. */}
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg text-neutral-900">{t("titre")}</SheetTitle>
          <SheetDescription>{t("sousTitre")}</SheetDescription>
        </SheetHeader>

        {/* Seul le corps défile : l'en-tête et les deux boutons restent en vue,
            ce qui évite de chercher « Créer » au bas d'un formulaire long. */}
        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(soumettre)}
            noValidate
            className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5"
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
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("champClient")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      options={optionsClients}
                      valeur={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder={t("champClientChoisir")}
                      placeholderRecherche={t("champClientRecherche")}
                      aucunResultat={t("champClientAucun")}
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
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quartier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("champQuartier")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("champQuartierPlaceholder")}
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
                          if (form.formState.isSubmitted) void form.trigger("dateFin");
                        }}
                        onBlur={field.onBlur}
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
                        auPlusTot={dateDebut}
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
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("champBudget")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      placeholder={t("champBudgetPlaceholder")}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormDescription>{t("champBudgetFacultatif")}</FormDescription>
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
                      rows={3}
                      maxLength={LONGUEUR_MAX_DESCRIPTION}
                      placeholder={t("champDescriptionPlaceholder")}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <fieldset className="m-0 flex flex-col gap-4 rounded-md border border-neutral-200 bg-neutral-50 p-4">
              <legend className="px-1 text-sm font-semibold text-neutral-800">
                {t("sectionChefProjet")}
              </legend>

              <FormField
                control={form.control}
                name="modeCp"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={enCours}
                        className="flex flex-wrap gap-x-5 gap-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="inviter" id="mode-cp-inviter" />
                          <Label htmlFor="mode-cp-inviter" className="cursor-pointer font-normal">
                            {t("optionCpInviter")}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="existant" id="mode-cp-existant" />
                          <Label htmlFor="mode-cp-existant" className="cursor-pointer font-normal">
                            {t("optionCpExistant")}
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              {modeCp === "inviter" ? (
                <>
                  <div className={RANGEE}>
                    <FormField
                      control={form.control}
                      name="cpNom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("champCpNom")} <Requis />
                          </FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="off" disabled={enCours} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cpPrenom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("champCpPrenom")} <Requis />
                          </FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="off" disabled={enCours} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="cpEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("champCpEmail")} <Requis />
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            inputMode="email"
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            disabled={enCours}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* `ChampTelephone` porte son propre libellé et son message :
                      il reçoit l'erreur du schéma plutôt que `FormLabel`. */}
                  <FormField
                    control={form.control}
                    name="cpTelephone"
                    render={({ field, fieldState }) => (
                      <ChampTelephone
                        libelle={t("champCpTelephone")}
                        paysDefaut={pays}
                        valeur={field.value}
                        onChange={field.onChange}
                        erreur={fieldState.error?.message}
                        disabled={enCours}
                        required
                      />
                    )}
                  />
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="cpId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("optionCpExistant")} <Requis />
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          options={optionsCollaborateurs}
                          valeur={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder={t("champCpChoisir")}
                          placeholderRecherche={t("champCpRecherche")}
                          aucunResultat={t("champCpAucun")}
                          disabled={enCours}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </fieldset>
          </form>
        </Form>

        <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={enCours} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {enCours ? t("creationEnCours") : t("creer")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

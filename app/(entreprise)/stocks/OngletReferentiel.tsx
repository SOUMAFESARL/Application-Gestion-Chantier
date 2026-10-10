"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Badge, Bouton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { aideColonnes } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BORD_DROIT_TABLEAU, FiltreTableau, RechercheTableau, TableauListe } from "@/components/ui/tableau-liste";
import { filtrerMateriaux, materiauUtilise, prochainCodeMateriau, valeursOuvertes } from "@/features/stocks";
import type { Materiau } from "@/features/stocks";
import { basculerMateriau, creerMateriau, modifierMateriau, supprimerMateriau } from "@/features/stocks/adaptateur";
import { CATEGORIES_ARTICLE, NATURES_ARTICLE, UNITES_ARTICLE, schemaMateriau, versSaisieMateriau } from "@/features/stocks/validations";
import type { FormulaireMateriau } from "@/features/stocks/validations";
import { formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CHAMP, CORPS_TIROIR, ENTETE_TIROIR, PIED_TIROIR, RANGEE } from "./classes";
import { Requis, useLibellesArticle } from "./composants";
import { useEcriture, useStock } from "./contexte";

const FORM_MATERIAU = "form-materiau";
const ID_CODE = "code-materiau";

const colonne = aideColonnes<Materiau>();

/**
 * Le référentiel des matériaux et équipements (F9-1) — commun à tous les
 * projets de l'entreprise. Chaque article porte son seuil d'alerte **par
 * défaut**, proposé au premier approvisionnement d'un lot (RG-STK-09).
 * Un article utilisé ne se supprime pas : il se désactive. Seul un article
 * qu'aucune pièce ne cite encore (une saisie erronée) se supprime.
 */
export function OngletReferentiel() {
  const t = useTranslations("stocks.referentiel");
  const libellesArticle = useLibellesArticle();
  const { donnees, gestes } = useStock();
  const ecrire = useEcriture();
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("");
  const [tiroir, setTiroir] = useState<Materiau | "nouveau" | null>(null);
  const [aSupprimer, setASupprimer] = useState<Materiau | null>(null);

  const filtres = useMemo(
    () => filtrerMateriaux(donnees.materiaux, { recherche, statut: categorie }),
    [donnees.materiaux, recherche, categorie],
  );

  const exporter = useMemo<ExportTableau<Materiau>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.fichier"),
      colonnes: [
        { entete: t("colonnes.code"), valeur: (m) => m.code },
        { entete: t("colonnes.designation"), valeur: (m) => m.designation },
        { entete: t("colonnes.categorie"), valeur: (m) => libellesArticle.categorie(m.categorie) },
        { entete: t("colonnes.nature"), valeur: (m) => libellesArticle.nature(m.nature) },
        { entete: t("colonnes.unite"), valeur: (m) => m.unite },
        { entete: t("colonnes.seuil"), valeur: (m) => m.seuilDefaut },
        { entete: t("colonnes.etat"), valeur: (m) => (m.actif ? t("actif") : t("inactif")) },
      ],
    }),
    [t, libellesArticle],
  );

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("code", {
          header: t("colonnes.code"),
          meta: { classe: "font-mono text-xs text-neutral-700" },
        }),
        colonne.accessor("designation", {
          header: t("colonnes.designation"),
          cell: ({ row }) => (
            <span className={cn("font-medium", row.original.actif ? "text-neutral-900" : "text-neutral-400 line-through")}>
              {row.original.designation}
            </span>
          ),
        }),
        colonne.accessor("categorie", {
          header: t("colonnes.categorie"),
          cell: ({ getValue }) => <Badge variante="neutre">{libellesArticle.categorie(getValue())}</Badge>,
        }),
        colonne.accessor("nature", {
          header: t("colonnes.nature"),
          cell: ({ getValue }) => (
            <Badge variante={getValue() === "EQUIPEMENT" ? "secondaire" : "neutre"}>{libellesArticle.nature(getValue())}</Badge>
          ),
        }),
        colonne.accessor("unite", { header: t("colonnes.unite"), meta: { classe: "text-neutral-700" } }),
        colonne.accessor("seuilDefaut", {
          header: t("colonnes.seuil"),
          meta: { classe: "tabular-nums" },
          cell: ({ getValue }) => formaterQuantite(getValue()),
        }),
        colonne.display({
          id: "actions",
          header: t("colonnes.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) =>
            gestes.gererReferentiel ? (
              <span className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setTiroir(row.original)}
                  aria-label={t("modifier", { nom: row.original.designation })}
                  title={t("modifier", { nom: row.original.designation })}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    void ecrire(
                      () => basculerMateriau(row.original),
                      row.original.actif
                        ? t("desactive", { nom: row.original.designation })
                        : t("reactive", { nom: row.original.designation }),
                    )
                  }
                  aria-label={row.original.actif ? t("desactiver", { nom: row.original.designation }) : t("reactiver", { nom: row.original.designation })}
                  title={row.original.actif ? t("desactiver", { nom: row.original.designation }) : t("reactiver", { nom: row.original.designation })}
                  className={row.original.actif ? "text-neutral-500" : "text-succes"}
                >
                  <Power />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setASupprimer(row.original)}
                  aria-label={t("supprimer", { nom: row.original.designation })}
                  title={t("supprimer", { nom: row.original.designation })}
                  className="text-erreur"
                >
                  <Trash2 />
                </Button>
              </span>
            ) : (
              <Badge variante={row.original.actif ? "succes" : "neutre"}>{row.original.actif ? t("actif") : t("inactif")}</Badge>
            ),
        }),
      ]),
    [t, libellesArticle, gestes.gererReferentiel, ecrire],
  );

  return (
    <>
      <TableauListe
        colonnes={colonnes}
        donnees={filtres}
        cleLigne={(m) => m.id}
        messageVide={t("aucunResultat")}
        cleCriteres={`${recherche}|${categorie}`}
        filtresActifs={Boolean(recherche || categorie)}
        onReinitialiser={() => {
          setRecherche("");
          setCategorie("");
        }}
        outils={
          <>
            <RechercheTableau valeur={recherche} onChangement={setRecherche} libelle={t("recherche")} placeholder={t("recherchePlaceholder")} />
            <FiltreTableau
              valeur={categorie}
              onChangement={setCategorie}
              libelle={t("filtreCategorie")}
              libelleTous={t("toutesCategories")}
              options={valeursOuvertes(CATEGORIES_ARTICLE, donnees.materiaux.map((m) => m.categorie), true).map((c) => ({
                valeur: c,
                libelle: libellesArticle.categorie(c),
              }))}
            />
          </>
        }
        exporter={exporter}
        actions={
          gestes.gererReferentiel && (
            <Bouton
              variante="primaire"
              taille="sm"
              aria-label={t("nouveau")}
              iconeGauche={<Plus size={16} aria-hidden="true" />}
              onClick={() => setTiroir("nouveau")}
              className="max-sm:gap-0 max-sm:px-3"
            >
              <span className="max-sm:hidden">{t("nouveau")}</span>
            </Bouton>
          )
        }
      />
      {tiroir && <TiroirMateriau materiau={tiroir === "nouveau" ? null : tiroir} onFermer={() => setTiroir(null)} />}
      {aSupprimer && <ModaleSuppressionMateriau materiau={aSupprimer} onFermer={() => setASupprimer(null)} />}
    </>
  );
}

/**
 * La confirmation de la suppression d'un article. Un article déjà cité par
 * une pièce ne se supprime pas (`materiauUtilise`) : la modale l'explique et
 * propose la désactivation au lieu d'un bouton que le serveur refuserait.
 */
function ModaleSuppressionMateriau({ materiau, onFermer }: { materiau: Materiau; onFermer: () => void }) {
  const t = useTranslations("stocks.referentiel.suppression");
  const { donnees } = useStock();
  const ecrire = useEcriture();
  const [enCours, setEnCours] = useState(false);
  const supprimable = !materiauUtilise(donnees, materiau.id);
  const nom = materiau.designation;

  async function confirmer(geste: () => Promise<unknown>, succes: string) {
    setEnCours(true);
    const fait = await ecrire(geste, succes);
    setEnCours(false);
    if (fait !== null) onFermer();
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("titre", { code: materiau.code, nom })}</DialogTitle>
          <DialogDescription>
            {supprimable ? t("description") : materiau.actif ? t("impossible") : t("impossibleInactif")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-3">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {supprimable ? t("annuler") : t("fermer")}
          </Button>
          {supprimable ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmer(() => supprimerMateriau(materiau.id), t("succes", { nom }))}
              disabled={enCours}
              aria-busy={enCours}
            >
              {enCours && <LoaderCircle className="animate-spin" />}
              {t("supprimer")}
            </Button>
          ) : (
            materiau.actif && (
              <Button
                type="button"
                onClick={() => void confirmer(() => basculerMateriau(materiau), t("desactive", { nom }))}
                disabled={enCours}
                aria-busy={enCours}
              >
                {enCours && <LoaderCircle className="animate-spin" />}
                {t("desactiver")}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Une liste ouverte du tiroir : les valeurs prévues et déjà utilisées, plus « Ajouter … ». */
function ChampListeOuverte({
  valeurs,
  libelle,
  ...props
}: {
  valeurs: readonly string[];
  libelle: (valeur: string) => string;
  valeur: string;
  onChange: (valeur: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations("stocks.referentiel");
  return (
    <Combobox
      {...props}
      options={valeurs.map((v) => ({ valeur: v, libelle: libelle(v) }))}
      placeholder={t("choisir")}
      placeholderRecherche={t("rechercher")}
      aucunResultat={t("aucuneValeur")}
      libelleSaisieLibre={(saisie) => t("ajouterValeur", { valeur: saisie })}
      className={cn(CHAMP, "w-full")}
    />
  );
}

/**
 * Le tiroir d'un article. Le code n'est pas saisi : un nouvel article prend
 * le numéro suivant de son préfixe (`prochainCodeMateriau`), qui suit la
 * nature tant qu'il n'est pas enregistré ; un article existant garde le sien.
 */
function TiroirMateriau({ materiau, onFermer }: { materiau: Materiau | null; onFermer: () => void }) {
  const t = useTranslations("stocks.referentiel");
  const libellesArticle = useLibellesArticle();
  const { donnees } = useStock();
  const ecrire = useEcriture();
  const form = useForm<FormulaireMateriau>({
    resolver: zodResolver(schemaMateriau),
    mode: "onTouched",
    defaultValues: materiau
      ? {
          designation: materiau.designation,
          categorie: materiau.categorie,
          nature: materiau.nature,
          unite: materiau.unite,
          seuilDefaut: String(materiau.seuilDefaut),
        }
      : { designation: "", categorie: "", nature: "MATERIAU", unite: "", seuilDefaut: "0" },
  });
  const enCours = form.formState.isSubmitting;
  const nature = useWatch({ control: form.control, name: "nature" });
  const code = materiau?.code ?? prochainCodeMateriau(donnees.materiaux, nature);

  const listes = useMemo(
    () => ({
      categories: valeursOuvertes(CATEGORIES_ARTICLE, donnees.materiaux.map((m) => m.categorie)),
      natures: valeursOuvertes(NATURES_ARTICLE, donnees.materiaux.map((m) => m.nature)),
      unites: valeursOuvertes(UNITES_ARTICLE, donnees.materiaux.map((m) => m.unite)),
    }),
    [donnees.materiaux],
  );

  async function soumettre(valeurs: FormulaireMateriau) {
    const saisie = versSaisieMateriau(valeurs, code);
    const fait = materiau
      ? await ecrire(() => modifierMateriau(materiau.id, saisie), t("modifie", { nom: saisie.designation }))
      : await ecrire(() => creerMateriau(saisie), t("cree", { nom: saisie.designation }));
    if (fait) onFermer();
  }

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className={ENTETE_TIROIR}>
          <SheetTitle className="text-lg text-neutral-900">{materiau ? t("titreModification") : t("titre")}</SheetTitle>
          <SheetDescription>{t("sousTitre")}</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form id={FORM_MATERIAU} onSubmit={form.handleSubmit(soumettre)} noValidate className={CORPS_TIROIR}>
            <FormField
              control={form.control}
              name="designation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("colonnes.designation")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <Input {...field} className={CHAMP} disabled={enCours} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col gap-2">
              <label htmlFor={ID_CODE} className="text-sm font-medium text-neutral-900">
                {t("colonnes.code")}
              </label>
              <Input
                id={ID_CODE}
                value={code}
                readOnly
                tabIndex={-1}
                aria-describedby={materiau ? undefined : `${ID_CODE}-aide`}
                className={cn(CHAMP, "w-40 bg-neutral-50 font-mono text-neutral-700")}
              />
              {!materiau && (
                <p id={`${ID_CODE}-aide`} className="m-0 text-xs text-neutral-500">
                  {t("codeAide")}
                </p>
              )}
            </div>
            <FormField
              control={form.control}
              name="categorie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("colonnes.categorie")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <ChampListeOuverte
                      valeurs={listes.categories}
                      libelle={libellesArticle.categorie}
                      valeur={field.value}
                      onChange={(valeur) => {
                        field.onChange(valeur);
                        if (valeur === "EQUIPEMENT") form.setValue("nature", "EQUIPEMENT", { shouldValidate: true });
                      }}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nature"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("colonnes.nature")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <ChampListeOuverte
                      valeurs={listes.natures}
                      libelle={libellesArticle.nature}
                      valeur={field.value}
                      onChange={field.onChange}
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
                name="seuilDefaut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("colonnes.seuil")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" className={cn(CHAMP, "tabular-nums")} disabled={enCours} />
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
                    <FormLabel>
                      {t("colonnes.unite")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <ChampListeOuverte
                        valeurs={listes.unites}
                        libelle={libellesArticle.unite}
                        valeur={field.value}
                        onChange={field.onChange}
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
        <SheetFooter className={PIED_TIROIR}>
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button type="submit" form={FORM_MATERIAU} disabled={enCours} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {materiau ? t("enregistrer") : t("ajouter")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

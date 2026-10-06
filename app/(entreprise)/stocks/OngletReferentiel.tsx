"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Pencil, Plus, Power } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Badge, Bouton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BORD_DROIT_TABLEAU, FiltreTableau, RechercheTableau, TableauListe } from "@/components/ui/tableau-liste";
import { filtrerMateriaux, valeursPresentes } from "@/features/stocks";
import type { CategorieArticle, Materiau } from "@/features/stocks";
import { basculerMateriau, creerMateriau, modifierMateriau } from "@/features/stocks/adaptateur";
import { CATEGORIES_ARTICLE, NATURES_ARTICLE, schemaMateriau, versSaisieMateriau } from "@/features/stocks/validations";
import type { FormulaireMateriau } from "@/features/stocks/validations";
import { formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CHAMP, CORPS_TIROIR, ENTETE_TIROIR, PIED_TIROIR, RANGEE } from "./classes";
import { Requis } from "./composants";
import { useEcriture, useStock } from "./contexte";

const FORM_MATERIAU = "form-materiau";

const colonne = aideColonnes<Materiau>();

/**
 * Le référentiel des matériaux et équipements (F9-1) — commun à tous les
 * projets de l'entreprise. Chaque article porte son seuil d'alerte **par
 * défaut**, proposé au premier approvisionnement d'un lot (RG-STK-09).
 * Un article utilisé ne se supprime pas : il se désactive.
 */
export function OngletReferentiel() {
  const t = useTranslations("stocks.referentiel");
  const tc = useTranslations("stocks");
  const { donnees, gestes } = useStock();
  const ecrire = useEcriture();
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<CategorieArticle | "">("");
  const [tiroir, setTiroir] = useState<Materiau | "nouveau" | null>(null);

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
        { entete: t("colonnes.categorie"), valeur: (m) => tc(`categories.${m.categorie}`) },
        { entete: t("colonnes.nature"), valeur: (m) => tc(`nature.${m.nature}`) },
        { entete: t("colonnes.unite"), valeur: (m) => m.unite },
        { entete: t("colonnes.seuil"), valeur: (m) => m.seuilDefaut },
        { entete: t("colonnes.etat"), valeur: (m) => (m.actif ? t("actif") : t("inactif")) },
      ],
    }),
    [t, tc],
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
          cell: ({ getValue }) => <Badge variante="neutre">{tc(`categories.${getValue()}`)}</Badge>,
        }),
        colonne.accessor("nature", {
          header: t("colonnes.nature"),
          cell: ({ getValue }) => (
            <Badge variante={getValue() === "EQUIPEMENT" ? "secondaire" : "neutre"}>{tc(`nature.${getValue()}`)}</Badge>
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
              </span>
            ) : (
              <Badge variante={row.original.actif ? "succes" : "neutre"}>{row.original.actif ? t("actif") : t("inactif")}</Badge>
            ),
        }),
      ]),
    [t, tc, gestes.gererReferentiel, ecrire],
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
              options={valeursPresentes(CATEGORIES_ARTICLE, donnees.materiaux.map((m) => m.categorie)).map((c) => ({
                valeur: c,
                libelle: tc(`categories.${c}`),
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
    </>
  );
}

function TiroirMateriau({ materiau, onFermer }: { materiau: Materiau | null; onFermer: () => void }) {
  const t = useTranslations("stocks.referentiel");
  const tc = useTranslations("stocks");
  const ecrire = useEcriture();
  const form = useForm<FormulaireMateriau>({
    resolver: zodResolver(schemaMateriau),
    mode: "onTouched",
    defaultValues: materiau
      ? {
          code: materiau.code,
          designation: materiau.designation,
          categorie: materiau.categorie,
          nature: materiau.nature,
          unite: materiau.unite,
          seuilDefaut: String(materiau.seuilDefaut),
        }
      : { code: "", designation: "", categorie: "LIANTS", nature: "MATERIAU", unite: "", seuilDefaut: "0" },
  });
  const enCours = form.formState.isSubmitting;

  async function soumettre(valeurs: FormulaireMateriau) {
    const saisie = versSaisieMateriau(valeurs);
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
            <div className={RANGEE}>
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("colonnes.code")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} className={cn(CHAMP, "font-mono uppercase")} disabled={enCours} />
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
                      <Input {...field} className={CHAMP} placeholder={t("unitePlaceholder")} disabled={enCours} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
            <div className={RANGEE}>
              <FormField
                control={form.control}
                name="categorie"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("colonnes.categorie")} <Requis />
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(valeur) => {
                        field.onChange(valeur);
                        form.setValue("nature", valeur === "EQUIPEMENT" ? "EQUIPEMENT" : "MATERIAU");
                      }}
                      disabled={enCours}
                    >
                      <FormControl>
                        <SelectTrigger className={cn(CHAMP, "w-full bg-card")}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES_ARTICLE.map((c) => (
                          <SelectItem key={c} value={c}>
                            {tc(`categories.${c}`)}
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
                name="nature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("colonnes.nature")} <Requis />
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={enCours}>
                      <FormControl>
                        <SelectTrigger className={cn(CHAMP, "w-full bg-card")}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NATURES_ARTICLE.map((n) => (
                          <SelectItem key={n} value={n}>
                            {tc(`nature.${n}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="seuilDefaut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("colonnes.seuil")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="decimal" className={cn(CHAMP, "w-40 tabular-nums")} disabled={enCours} />
                  </FormControl>
                  <p className="m-0 text-xs text-neutral-500">{t("seuilAide")}</p>
                  <FormMessage />
                </FormItem>
              )}
            />
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

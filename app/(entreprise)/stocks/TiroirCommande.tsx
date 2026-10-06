"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Siren } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { resteACommander } from "@/features/stocks";
import type { DemandeAppro } from "@/features/stocks";
import { emettreCommande } from "@/features/stocks/adaptateur";
import { schemaCommande, versSaisieCommande } from "@/features/stocks/validations";
import type { FormulaireCommande } from "@/features/stocks/validations";
import { formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CHAMP, CORPS_TIROIR, ENTETE_TIROIR, FICHE, FICHE_LIBELLE, FICHE_VALEUR, PIED_TIROIR, RANGEE } from "./classes";
import { LignesArticles, Requis } from "./composants";
import { useEcriture, useStock } from "./contexte";

const FORM_ID = "form-commande";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * L'émission d'un bon de commande (F9-3) — la direction seule (RG-STK-03).
 *
 * **Un BC par livraison attendue** : si le fournisseur livre en trois fois,
 * trois BC. Issu d'une DA, il en reprend le reste à commander, sans pouvoir le
 * dépasser ; sans DA, c'est une **commande directe** d'urgence, tracée comme
 * telle (RG-STK-06). Transmis, il prévient le magasinier et le conducteur de
 * travaux qu'une livraison arrive.
 */
export function TiroirCommande({
  ouverte,
  onFermer,
  demande = null,
}: {
  ouverte: boolean;
  onFermer: () => void;
  demande?: DemandeAppro | null;
}) {
  const t = useTranslations("stocks.tiroirCommande");
  const { donnees, projets, gestesDe, libelleLot, libelleProjet } = useStock();
  const ecrire = useEcriture();
  const reste = demande ? resteACommander(demande) : [];
  const plafonds = new Map(reste.map((l) => [l.materiauId, l.quantite]));
  const projetsPermis = projets.filter((p) => gestesDe(p.id).emettreCommande);

  const form = useForm<FormulaireCommande>({
    resolver: zodResolver(schemaCommande),
    mode: "onTouched",
    defaultValues: {
      projetId: demande?.projetId ?? (projetsPermis.length === 1 ? projetsPermis[0].id : ""),
      lotId: demande?.lotId ?? "",
      fournisseur: "",
      dateLivraisonPrevue: demande && demande.dateSouhaitee >= aujourdhui() ? demande.dateSouhaitee : "",
      transmettre: true,
      lignes: demande
        ? reste.map((l) => ({ materiauId: l.materiauId, quantite: String(l.quantite) }))
        : [{ materiauId: "", quantite: "" }],
    },
  });
  const projetId = useWatch({ control: form.control, name: "projetId" });
  const lots = donnees.lots.filter((l) => l.projetId === projetId);
  const materiaux = demande
    ? donnees.materiaux.filter((m) => plafonds.has(m.id))
    : donnees.materiaux.filter((m) => m.actif);
  const enCours = form.formState.isSubmitting;

  async function soumettre(valeurs: FormulaireCommande) {
    const fait = await ecrire(
      () => emettreCommande(versSaisieCommande(valeurs, demande?.id ?? null)),
      valeurs.transmettre ? t("succesTransmis") : t("succes"),
    );
    if (fait) onFermer();
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className={ENTETE_TIROIR}>
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg text-neutral-900">
            {demande ? t("titre") : t("titreDirect")}
            {demande ? (
              <Badge variante="primaire">{demande.reference}</Badge>
            ) : (
              <Badge variante="avertissement" icone={<Siren size={12} aria-hidden="true" />}>
                {t("urgence")}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>{demande ? t("sousTitre") : t("sousTitreDirect")}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form id={FORM_ID} onSubmit={form.handleSubmit(soumettre)} noValidate className={CORPS_TIROIR}>
            {demande ? (
              <dl className={FICHE}>
                <div>
                  <dt className={FICHE_LIBELLE}>{t("chantier")}</dt>
                  <dd className={FICHE_VALEUR}>{libelleProjet(demande.projetId)}</dd>
                </div>
                <div>
                  <dt className={FICHE_LIBELLE}>{t("lot")}</dt>
                  <dd className={FICHE_VALEUR}>{libelleLot(demande.lotId)}</dd>
                </div>
                <div>
                  <dt className={FICHE_LIBELLE}>{t("demandeur")}</dt>
                  <dd className={FICHE_VALEUR}>{demande.emetteur.nom}</dd>
                </div>
                <div>
                  <dt className={FICHE_LIBELLE}>{t("souhaitee")}</dt>
                  <dd className={FICHE_VALEUR}>{formaterDate(demande.dateSouhaitee)}</dd>
                </div>
                {demande.observation && (
                  <div className="col-span-full">
                    <dt className={FICHE_LIBELLE}>{t("observation")}</dt>
                    <dd className="text-neutral-700">{demande.observation}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className={RANGEE}>
                <FormField
                  control={form.control}
                  name="projetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("chantier")} <Requis />
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(valeur) => {
                          field.onChange(valeur);
                          form.setValue("lotId", "");
                        }}
                        disabled={enCours}
                      >
                        <FormControl>
                          <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                            <SelectValue placeholder={t("choisir")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projetsPermis.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nom}
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
                  name="lotId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("lot")} <Requis />
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={enCours || !projetId}>
                        <FormControl>
                          <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                            <SelectValue placeholder={t("choisir")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {lots.map((lot) => (
                            <SelectItem key={lot.id} value={lot.id}>
                              {t("libelleLot", { code: lot.code, nom: lot.nom })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className={RANGEE}>
              <FormField
                control={form.control}
                name="fournisseur"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("fournisseur")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} className={CHAMP} placeholder={t("fournisseurPlaceholder")} disabled={enCours} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateLivraisonPrevue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("livraisonPrevue")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <SelecteurDate
                        valeur={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        auPlusTot={aujourdhui()}
                        className={CHAMP}
                        placeholder={t("choisirDate")}
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <p className="m-0 rounded-md bg-information-fond px-3 py-2 text-xs text-neutral-700">{t("unParLivraison")}</p>

            <LignesArticles materiaux={materiaux} plafonds={demande ? plafonds : undefined} desactive={enCours} />
            {form.formState.errors.lignes?.root?.message && (
              <p className="m-0 text-sm text-erreur">{form.formState.errors.lignes.root.message}</p>
            )}
            {form.formState.errors.lignes?.message && (
              <p className="m-0 text-sm text-erreur">{form.formState.errors.lignes.message}</p>
            )}

            <FormField
              control={form.control}
              name="transmettre"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(coche) => field.onChange(coche === true)} disabled={enCours} />
                  </FormControl>
                  <div className="flex flex-col gap-0.5">
                    <FormLabel className="font-medium">{t("transmettre")}</FormLabel>
                    <p className="m-0 text-xs text-neutral-500">{t("transmettreAide")}</p>
                  </div>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <SheetFooter className={PIED_TIROIR}>
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={enCours} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {t("emettre")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

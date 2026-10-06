"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { DemandeAppro } from "@/features/stocks";
import { emettreDemande, modifierDemande } from "@/features/stocks/adaptateur";
import { LONGUEUR_MAX_OBSERVATION, schemaDemande, versSaisieDemande } from "@/features/stocks/validations";
import type { FormulaireDemande } from "@/features/stocks/validations";
import { cn } from "@/lib/utils";

import { CHAMP, CORPS_TIROIR, ENTETE_TIROIR, PIED_TIROIR, RANGEE } from "./classes";
import { LignesArticles, Requis } from "./composants";
import { useEcriture, useStock } from "./contexte";

const FORM_ID = "form-demande";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * La demande d'approvisionnement (F9-2) — elle remplace l'appel ou le message
 * WhatsApp au bureau : un chantier, un lot, des articles et leurs quantités,
 * une date souhaitée. Aucune signature.
 *
 * Modifiable par son émetteur tant qu'elle est EN_ATTENTE (RG-STK-08) : le
 * serveur journalise chaque modification et prévient la direction.
 */
export function TiroirDemande({
  ouverte,
  onFermer,
  demande = null,
  prerempli,
}: {
  ouverte: boolean;
  onFermer: () => void;
  demande?: DemandeAppro | null;
  /** Depuis une ligne de stock en alerte : le lot et l'article sont déjà choisis. */
  prerempli?: { projetId: string; lotId: string; materiauId: string };
}) {
  const t = useTranslations("stocks.tiroirDemande");
  const { donnees, projets, gestesDe } = useStock();
  const ecrire = useEcriture();
  const projetsPermis = projets.filter((p) => gestesDe(p.id).emettreDemande);
  const projetDefaut = demande?.projetId ?? prerempli?.projetId ?? (projetsPermis.length === 1 ? projetsPermis[0].id : "");

  const form = useForm<FormulaireDemande>({
    resolver: zodResolver(schemaDemande),
    mode: "onTouched",
    defaultValues: demande
      ? {
          projetId: demande.projetId,
          lotId: demande.lotId,
          dateSouhaitee: demande.dateSouhaitee,
          observation: demande.observation,
          lignes: demande.lignes.map((l) => ({ materiauId: l.materiauId, quantite: String(l.quantiteDemandee) })),
        }
      : {
          projetId: projetDefaut,
          lotId: prerempli?.lotId ?? "",
          dateSouhaitee: "",
          observation: "",
          lignes: [{ materiauId: prerempli?.materiauId ?? "", quantite: "" }],
        },
  });
  const projetId = useWatch({ control: form.control, name: "projetId" });
  const lots = donnees.lots.filter((l) => l.projetId === projetId);
  const materiaux = donnees.materiaux.filter((m) => m.actif);
  const enCours = form.formState.isSubmitting;

  async function soumettre(valeurs: FormulaireDemande) {
    const saisie = versSaisieDemande(valeurs);
    const fait = demande
      ? await ecrire(() => modifierDemande(demande.id, saisie), t("succesModification", { reference: demande.reference }))
      : await ecrire(() => emettreDemande(saisie), t("succes"));
    if (fait) onFermer();
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className={ENTETE_TIROIR}>
          <SheetTitle className="flex items-center gap-2 text-lg text-neutral-900">
            {demande ? t("titreModification") : t("titre")}
            {demande && <Badge variante="primaire">{demande.reference}</Badge>}
          </SheetTitle>
          <SheetDescription>{demande ? t("sousTitreModification") : t("sousTitre")}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form id={FORM_ID} onSubmit={form.handleSubmit(soumettre)} noValidate className={CORPS_TIROIR}>
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
                      disabled={enCours || demande !== null}
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

            <FormField
              control={form.control}
              name="dateSouhaitee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("dateSouhaitee")} <Requis />
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

            <LignesArticles materiaux={materiaux} desactive={enCours} />
            {form.formState.errors.lignes?.root?.message && (
              <p className="m-0 text-sm text-erreur">{form.formState.errors.lignes.root.message}</p>
            )}
            {form.formState.errors.lignes?.message && (
              <p className="m-0 text-sm text-erreur">{form.formState.errors.lignes.message}</p>
            )}

            <FormField
              control={form.control}
              name="observation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("observation")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      maxLength={LONGUEUR_MAX_OBSERVATION}
                      placeholder={t("observationPlaceholder")}
                      disabled={enCours}
                    />
                  </FormControl>
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
          <Button type="submit" form={FORM_ID} disabled={enCours} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {demande ? t("enregistrer") : t("emettre")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

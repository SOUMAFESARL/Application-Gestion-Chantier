"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ZoneDepotFichiers } from "@/components/ui/zone-depot-fichiers";
import { compresserPhoto } from "@/features/chantier/photos";
import { PHOTOS_MAX, resteALivrer } from "@/features/stocks";
import type { BonCommande } from "@/features/stocks";
import { receptionner } from "@/features/stocks/adaptateur";
import {
  LONGUEUR_MAX_OBSERVATION,
  lireQuantite,
  refusJustificatif,
  refusPhoto,
  schemaReception,
} from "@/features/stocks/validations";
import type { FormulaireReception } from "@/features/stocks/validations";
import { formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CHAMP, CORPS_TIROIR, ENTETE_TIROIR, PIED_TIROIR } from "./classes";
import { useEcriture, useStock } from "./contexte";

const FORM_ID = "form-reception";

/**
 * La réception d'une livraison (F9-4), par le magasinier, au pied du camion —
 * mobile d'abord.
 *
 * Il ouvre le BC, saisit ce qu'il reçoit ligne par ligne (une livraison
 * partielle est normale), signale ce qui n'est pas conforme, photographie le
 * camion et le BL. Rien n'entre en stock ici : il faut **deux** conditions
 * (RG-STK-01), la validation du CT (puis du CP pour un équipement) et le BL
 * signé déposé — qui peut suivre si le livreur n'a pas encore signé.
 */
export function TiroirReception({ commande, onFermer }: { commande: BonCommande; onFermer: () => void }) {
  const t = useTranslations("stocks.reception");
  const { donnees, libelleLot, libelleMateriau, materiau } = useStock();
  const ecrire = useEcriture();
  const [photos, setPhotos] = useState<File[]>([]);
  const [justificatif, setJustificatif] = useState<File[]>([]);
  const reste = resteALivrer(commande, donnees.livraisons).filter((l) => l.quantite > 0);

  const form = useForm<FormulaireReception>({
    resolver: zodResolver(schemaReception),
    mode: "onTouched",
    defaultValues: {
      observation: "",
      lignes: reste.map((l) => ({
        materiauId: l.materiauId,
        attendue: l.quantite,
        quantiteRecue: String(l.quantite),
        conforme: true,
        motif: "",
      })),
    },
  });
  const { fields } = useFieldArray({ control: form.control, name: "lignes" });
  const lignes = useWatch({ control: form.control, name: "lignes" });
  const enCours = form.formState.isSubmitting;
  const equipement = reste.some((l) => materiau(l.materiauId)?.nature === "EQUIPEMENT");

  async function soumettre(valeurs: FormulaireReception) {
    const apercus = await Promise.all(
      photos.map(async (photo) => ({ nom: photo.name, url: await compresserPhoto(photo).catch(() => "") })),
    );
    const fait = await ecrire(
      () =>
        receptionner(
          {
            bonCommandeId: commande.id,
            observation: valeurs.observation.trim(),
            photos: apercus,
            justificatif: justificatif[0] ?? null,
            lignes: valeurs.lignes.map((l) => ({
              materiauId: l.materiauId,
              quantiteRecue: lireQuantite(l.quantiteRecue) ?? 0,
              conforme: l.conforme,
              motif: l.conforme ? "" : l.motif.trim(),
            })),
          },
          photos,
        ),
      justificatif.length > 0 ? t("succesAvecBl") : t("succesSansBl"),
    );
    if (fait) onFermer();
  }

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className={ENTETE_TIROIR}>
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg text-neutral-900">
            {t("titre")} <Badge variante="primaire">{commande.reference}</Badge>
          </SheetTitle>
          <SheetDescription>
            {t("sousTitre", { fournisseur: commande.fournisseur, lot: libelleLot(commande.lotId) })}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form id={FORM_ID} onSubmit={form.handleSubmit(soumettre)} noValidate className={CORPS_TIROIR}>
            <p className="m-0 rounded-md bg-information-fond px-3 py-2 text-xs text-neutral-700">
              {equipement ? t("regleEquipement") : t("regleMateriau")}
            </p>

            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
              <legend className="mb-1 text-sm font-medium text-neutral-900">{t("lignes")}</legend>
              {fields.map((champ, index) => {
                const ligne = lignes?.[index];
                const unite = materiau(champ.materiauId)?.unite ?? "";
                const recue = lireQuantite(ligne?.quantiteRecue ?? "") ?? 0;
                return (
                  <div key={champ.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-900">{libelleMateriau(champ.materiauId)}</span>
                      <span className="text-xs text-neutral-500">
                        {t("attendu", { quantite: formaterQuantite(champ.attendue), unite })}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-start gap-4">
                      <FormField
                        control={form.control}
                        name={`lignes.${index}.quantiteRecue`}
                        render={({ field }) => (
                          <FormItem className="w-36">
                            <FormLabel className="text-xs">{t("recue")}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  inputMode="decimal"
                                  className={cn(CHAMP, "pr-12 text-right tabular-nums")}
                                  disabled={enCours}
                                />
                                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-neutral-500">
                                  {unite}
                                </span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lignes.${index}.conforme`}
                        render={({ field }) => (
                          <FormItem className="mt-7 flex flex-row items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(coche) => field.onChange(coche === true)}
                                disabled={enCours}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">{t("conforme")}</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                    {recue > 0 && recue < champ.attendue && (
                      <p className="m-0 text-xs text-avertissement">
                        {t("partielle", { reste: formaterQuantite(champ.attendue - recue), unite })}
                      </p>
                    )}
                    {ligne && !ligne.conforme && (
                      <FormField
                        control={form.control}
                        name={`lignes.${index}.motif`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("motifNonConforme")}</FormLabel>
                            <FormControl>
                              <Input {...field} className={CHAMP} placeholder={t("motifPlaceholder")} disabled={enCours} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                );
              })}
              {form.formState.errors.lignes?.root?.message && (
                <p className="m-0 text-sm text-erreur">{form.formState.errors.lignes.root.message}</p>
              )}
              {form.formState.errors.lignes?.message && (
                <p className="m-0 text-sm text-erreur">{form.formState.errors.lignes.message}</p>
              )}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-neutral-900">{t("photos", { max: PHOTOS_MAX })}</span>
              <ZoneDepotFichiers
                fichiers={photos}
                onChange={setPhotos}
                multiple
                maximum={PHOTOS_MAX}
                refuser={refusPhoto}
                consigne={t("consignePhotos", { max: PHOTOS_MAX })}
                accept="image/*"
                capture="environment"
                disabled={enCours}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-neutral-900">{t("justificatif")}</span>
              <p className="m-0 text-xs text-neutral-500">{t("justificatifAide")}</p>
              <ZoneDepotFichiers
                fichiers={justificatif}
                onChange={setJustificatif}
                refuser={refusJustificatif}
                consigne={t("consigneJustificatif")}
                accept="image/*,application/pdf"
                capture="environment"
                disabled={enCours}
              />
            </div>

            <FormField
              control={form.control}
              name="observation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("observation")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} maxLength={LONGUEUR_MAX_OBSERVATION} disabled={enCours} />
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
            {t("soumettre")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

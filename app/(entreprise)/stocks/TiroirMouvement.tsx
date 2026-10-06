"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ZoneDepotFichiers } from "@/components/ui/zone-depot-fichiers";
import { lireQuantite, refusJustificatif, schemaMouvement, schemaTransfert, SENS_MOUVEMENT, versSaisieMouvement } from "@/features/stocks/validations";
import type { FormulaireMouvement, FormulaireTransfert } from "@/features/stocks/validations";
import { stockDuLot } from "@/features/stocks";
import type { LigneStock } from "@/features/stocks";
import { saisirMouvement, transferer } from "@/features/stocks/adaptateur";
import { formaterDate, formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CHAMP, CORPS_TIROIR, ENTETE_TIROIR, PIED_TIROIR, RANGEE } from "./classes";
import { Requis } from "./composants";
import { useEcriture, useStock } from "./contexte";

const FORM_MOUVEMENT = "form-mouvement";
const FORM_TRANSFERT = "form-transfert";

/** Les sélecteurs chantier / lot, partagés par les deux tiroirs — pilotés par le formulaire. */
function ChoixLot({
  projets,
  projetId,
  lotId,
  onProjet,
  onLot,
  erreurProjet,
  erreurLot,
  libelleProjet,
  libelleLot,
  desactive,
}: {
  projets: { id: string; nom: string }[];
  projetId: string;
  lotId: string;
  onProjet: (id: string) => void;
  onLot: (id: string) => void;
  erreurProjet?: string;
  erreurLot?: string;
  libelleProjet: string;
  libelleLot: string;
  desactive: boolean;
}) {
  const t = useTranslations("stocks.tiroirMouvement");
  const { donnees } = useStock();
  const lots = donnees.lots.filter((l) => l.projetId === projetId);
  return (
    <div className={RANGEE}>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-900">
          {libelleProjet} <Requis />
        </span>
        <Select value={projetId} onValueChange={onProjet} disabled={desactive}>
          <SelectTrigger className={cn(CHAMP, "w-full bg-card")} aria-label={libelleProjet} aria-invalid={erreurProjet ? true : undefined}>
            <SelectValue placeholder={t("choisir")} />
          </SelectTrigger>
          <SelectContent>
            {projets.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {erreurProjet && <p className="m-0 text-sm text-erreur">{erreurProjet}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-900">
          {libelleLot} <Requis />
        </span>
        <Select value={lotId} onValueChange={onLot} disabled={desactive || !projetId}>
          <SelectTrigger className={cn(CHAMP, "w-full bg-card")} aria-label={libelleLot} aria-invalid={erreurLot ? true : undefined}>
            <SelectValue placeholder={t("choisir")} />
          </SelectTrigger>
          <SelectContent>
            {lots.map((lot) => (
              <SelectItem key={lot.id} value={lot.id}>
                {t("libelleLot", { code: lot.code, nom: lot.nom })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {erreurLot && <p className="m-0 text-sm text-erreur">{erreurLot}</p>}
      </div>
    </div>
  );
}

/**
 * Un mouvement manuel (F9-5) : une consommation hors rapport journalier, ou
 * la correction d'une erreur. Un mouvement ne se modifie ni ne se supprime
 * (RG-STK-05) : on en écrit un autre, motivé, qui cite celui qu'il corrige.
 */
export function TiroirMouvement({
  ouverte,
  onFermer,
  ligne,
}: {
  ouverte: boolean;
  onFermer: () => void;
  ligne: LigneStock | null;
}) {
  const t = useTranslations("stocks.tiroirMouvement");
  const { donnees, projets, gestesDe, libelleMateriau, quantite } = useStock();
  const ecrire = useEcriture();
  const projetsPermis = projets.filter((p) => gestesDe(p.id).mouvementManuel);

  const form = useForm<FormulaireMouvement>({
    resolver: zodResolver(schemaMouvement),
    mode: "onTouched",
    defaultValues: {
      projetId: ligne?.projetId ?? (projetsPermis.length === 1 ? projetsPermis[0].id : ""),
      lotId: ligne?.lotId ?? "",
      materiauId: ligne?.materiau.id ?? "",
      sens: "SORTIE",
      quantite: "",
      motif: "",
      corrige: "",
    },
  });
  const [projetId, lotId, materiauId, sens] = useWatch({
    control: form.control,
    name: ["projetId", "lotId", "materiauId", "sens"],
  });
  const erreurs = form.formState.errors;
  const choisir = (nom: "projetId" | "lotId" | "materiauId", valeur: string) =>
    form.setValue(nom, valeur, { shouldValidate: true });
  const enCours = form.formState.isSubmitting;
  const suivis = [...new Set(donnees.mouvements.filter((m) => m.lotId === lotId).map((m) => m.materiauId))];
  const stock = lotId && materiauId ? stockDuLot(donnees.mouvements, lotId, materiauId) : null;
  const corrigibles = donnees.mouvements.filter((m) => m.lotId === lotId && m.materiauId === materiauId).slice(0, 30);

  async function soumettre(valeurs: FormulaireMouvement) {
    const fait = await ecrire(() => saisirMouvement(versSaisieMouvement(valeurs)), t("succes"));
    if (fait) onFermer();
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className={ENTETE_TIROIR}>
          <SheetTitle className="text-lg text-neutral-900">{t("titre")}</SheetTitle>
          <SheetDescription>{t("sousTitre")}</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form id={FORM_MOUVEMENT} onSubmit={form.handleSubmit(soumettre)} noValidate className={CORPS_TIROIR}>
            <ChoixLot
              projets={projetsPermis}
              projetId={projetId}
              lotId={lotId}
              onProjet={(id) => {
                choisir("projetId", id);
                form.setValue("lotId", "");
                form.setValue("materiauId", "");
              }}
              onLot={(id) => {
                choisir("lotId", id);
                form.setValue("materiauId", "");
              }}
              erreurProjet={erreurs.projetId?.message}
              erreurLot={erreurs.lotId?.message}
              libelleProjet={t("chantier")}
              libelleLot={t("lot")}
              desactive={enCours}
            />
            <FormField
              control={form.control}
              name="materiauId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("article")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      options={suivis.map((id) => ({ valeur: id, libelle: libelleMateriau(id) }))}
                      valeur={field.value}
                      onChange={field.onChange}
                      placeholder={t("choisirArticle")}
                      placeholderRecherche={t("rechercherArticle")}
                      aucunResultat={t("aucunArticle")}
                      className={cn(CHAMP, "w-full")}
                      disabled={enCours || !lotId}
                    />
                  </FormControl>
                  {stock !== null && <p className="m-0 text-xs text-neutral-500">{t("stockActuel", { stock: quantite(stock, materiauId) })}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sens"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("nature")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-2" disabled={enCours}>
                      {SENS_MOUVEMENT.map((valeur) => (
                        <label key={valeur} className="flex cursor-pointer items-start gap-2 text-sm">
                          <RadioGroupItem value={valeur} className="mt-0.5" />
                          <span className="flex flex-col">
                            <span className="font-medium text-neutral-900">{t(`sens.${valeur}`)}</span>
                            <span className="text-xs text-neutral-500">{t(`sensAide.${valeur}`)}</span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("quantite")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="decimal" className={cn(CHAMP, "w-40 tabular-nums")} disabled={enCours} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {sens !== "SORTIE" && (
              <FormField
                control={form.control}
                name="corrige"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("corrige")}</FormLabel>
                    <Combobox
                      options={corrigibles.map((m) => ({
                        valeur: m.id,
                        libelle: t("libelleMouvement", {
                          date: formaterDate(m.horodatage),
                          reference: m.reference,
                          quantite: formaterQuantite(m.quantite),
                        }),
                      }))}
                      valeur={field.value}
                      onChange={field.onChange}
                      placeholder={t("aucunCorrige")}
                      placeholderRecherche={t("rechercherMouvement")}
                      aucunResultat={t("aucunMouvement")}
                      className={cn(CHAMP, "w-full")}
                      disabled={enCours || !materiauId}
                    />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="motif"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("motif")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder={t("motifPlaceholder")} disabled={enCours} />
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
          <Button type="submit" form={FORM_MOUVEMENT} disabled={enCours} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {t("enregistrer")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Un transfert (F9-5, RG-STK-10) : une sortie du lot source et une entrée du
 * lot destinataire, simultanées. Entre deux lots du même chantier, c'est le
 * conducteur de travaux ; entre deux chantiers, le chef de projet. Le
 * justificatif signé est exigé avant toute effectivité.
 */
export function TiroirTransfert({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const t = useTranslations("stocks.tiroirTransfert");
  const { donnees, projets, tousProjets, gestesDe, libelleMateriau, quantite } = useStock();
  const ecrire = useEcriture();
  const [justificatif, setJustificatif] = useState<File[]>([]);
  const [justificatifManquant, setJustificatifManquant] = useState(false);
  const sources = projets.filter((p) => gestesDe(p.id).transfertInterLots || gestesDe(p.id).transfertInterChantiers);

  const form = useForm<FormulaireTransfert>({
    resolver: zodResolver(schemaTransfert),
    mode: "onTouched",
    defaultValues: {
      projetId: sources.length === 1 ? sources[0].id : "",
      sourceLotId: "",
      materiauId: "",
      quantite: "",
      destinationProjetId: "",
      destinationLotId: "",
      motif: "",
    },
  });
  const [projetId, sourceLotId, materiauId, saisieQuantite, destinationProjetId, destinationLotId] = useWatch({
    control: form.control,
    name: ["projetId", "sourceLotId", "materiauId", "quantite", "destinationProjetId", "destinationLotId"],
  });
  const erreurs = form.formState.errors;
  const enCours = form.formState.isSubmitting;
  const gestes = projetId ? gestesDe(projetId) : null;
  // Le même chantier pour le conducteur ; tous les siens pour le chef de projet.
  const destinations = tousProjets.filter((p) =>
    p.id === projetId ? gestes?.transfertInterLots || gestes?.transfertInterChantiers : gestes?.transfertInterChantiers,
  );
  const enStock = [...new Set(donnees.mouvements.filter((m) => m.lotId === sourceLotId).map((m) => m.materiauId))].filter(
    (id) => stockDuLot(donnees.mouvements, sourceLotId, id) > 0,
  );
  const disponible = sourceLotId && materiauId ? stockDuLot(donnees.mouvements, sourceLotId, materiauId) : null;
  const depasse = disponible !== null && (lireQuantite(saisieQuantite) ?? 0) > disponible;

  async function soumettre(valeurs: FormulaireTransfert) {
    const fichier = justificatif[0];
    if (!fichier) {
      setJustificatifManquant(true);
      return;
    }
    if (depasse) return;
    const fait = await ecrire(
      () =>
        transferer({
          materiauId: valeurs.materiauId,
          quantite: lireQuantite(valeurs.quantite) ?? 0,
          source: { projetId: valeurs.projetId, lotId: valeurs.sourceLotId },
          destination: { projetId: valeurs.destinationProjetId, lotId: valeurs.destinationLotId },
          motif: valeurs.motif.trim(),
          justificatif: fichier,
        }),
      t("succes"),
    );
    if (fait) onFermer();
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className={ENTETE_TIROIR}>
          <SheetTitle className="text-lg text-neutral-900">{t("titre")}</SheetTitle>
          <SheetDescription>{t("sousTitre")}</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form id={FORM_TRANSFERT} onSubmit={form.handleSubmit(soumettre)} noValidate className={CORPS_TIROIR}>
            <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("source")}</h3>
            <ChoixLot
              projets={sources}
              projetId={projetId}
              lotId={sourceLotId}
              onProjet={(id) => {
                form.setValue("projetId", id);
                form.setValue("sourceLotId", "");
                form.setValue("materiauId", "");
                form.setValue("destinationProjetId", "");
                form.setValue("destinationLotId", "");
              }}
              onLot={(id) => {
                form.setValue("sourceLotId", id, { shouldValidate: true });
                form.setValue("materiauId", "");
              }}
              erreurLot={erreurs.sourceLotId?.message}
              libelleProjet={t("chantier")}
              libelleLot={t("lot")}
              desactive={enCours}
            />
            <div className={RANGEE}>
              <FormField
                control={form.control}
                name="materiauId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("article")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        options={enStock.map((id) => ({ valeur: id, libelle: libelleMateriau(id) }))}
                        valeur={field.value}
                        onChange={field.onChange}
                        placeholder={t("choisirArticle")}
                        placeholderRecherche={t("rechercherArticle")}
                        aucunResultat={t("aucunArticle")}
                        className={cn(CHAMP, "w-full")}
                        disabled={enCours || !sourceLotId}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("quantite")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" className={cn(CHAMP, "tabular-nums")} disabled={enCours} />
                    </FormControl>
                    {disponible !== null && (
                      <p className={cn("m-0 text-xs", depasse ? "text-erreur" : "text-neutral-500")}>
                        {t("disponible", { stock: quantite(disponible, materiauId) })}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <h3 className="m-0 mt-2 text-sm font-semibold text-neutral-900">{t("destination")}</h3>
            <ChoixLot
              projets={destinations}
              projetId={destinationProjetId}
              lotId={destinationLotId}
              onProjet={(id) => {
                form.setValue("destinationProjetId", id, { shouldValidate: true });
                form.setValue("destinationLotId", "");
              }}
              onLot={(id) => form.setValue("destinationLotId", id, { shouldValidate: true })}
              erreurProjet={erreurs.destinationProjetId?.message}
              erreurLot={erreurs.destinationLotId?.message}
              libelleProjet={t("chantier")}
              libelleLot={t("lot")}
              desactive={enCours || !projetId}
            />

            <FormField
              control={form.control}
              name="motif"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("motif")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder={t("motifPlaceholder")} disabled={enCours} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-neutral-900">
                {t("justificatif")} <Requis />
              </span>
              <ZoneDepotFichiers
                fichiers={justificatif}
                onChange={(fichiers) => {
                  setJustificatif(fichiers);
                  setJustificatifManquant(false);
                }}
                refuser={refusJustificatif}
                consigne={t("consigneJustificatif")}
                accept="image/*,application/pdf"
                capture="environment"
                disabled={enCours}
              />
              {justificatifManquant && <p className="m-0 text-sm text-erreur">{t("justificatifRequis")}</p>}
            </div>
          </form>
        </Form>
        <SheetFooter className={PIED_TIROIR}>
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button type="submit" form={FORM_TRANSFERT} disabled={enCours || depasse} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {t("transferer")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

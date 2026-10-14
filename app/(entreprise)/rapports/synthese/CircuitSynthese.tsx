"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, FilePenLine, LoaderCircle, PenLine, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { lireProfilLocal } from "@/features/auth/api";
import {
  etapeSynthese,
  LONGUEUR_MIN_APPRECIATION,
  LONGUEUR_MIN_COMMENTAIRE_REJET,
  objectifComplet,
  redactionEnregistrable,
  redactionSignable,
} from "@/features/chantier";
import type { DemandeSynthese, ObjectifSuivant, RedactionSynthese, SynthesePeriodique } from "@/features/chantier";
import {
  approuverSynthese,
  enregistrerSynthese,
  rejeterSynthese,
  soumettreSynthese,
} from "@/features/chantier/adaptateur";
import { CLE_SUIVI_SYNTHESES, cleSynthese } from "@/features/chantier/cles";
import { personneQuiSigne, tientEtape, useDroits, useProjetsVisibles } from "@/features/habilitations";
import { ErreurApi } from "@/lib/api";

/** Un objectif sans lot : `SelectItem` n'accepte pas la chaîne vide. */
const SANS_LOT = "__sans_lot__";

const OBJECTIF_VIDE: ObjectifSuivant = { lotCode: "", activite: "", objectif: "", cible: 0, prerequis: "" };

/**
 * Le geste attendu sur la synthèse, posé au-dessus du document : le
 * conducteur de travaux la rédige et la signe, le chef de projet l'approuve
 * ou la lui renvoie.
 *
 * Personne d'autre ne voit ce panneau : signe celui qui tient la fonction sur
 * le chantier (`tientEtape`), comme pour le rapport journalier. Une période
 * personnalisée ou en cours n'attend personne (`etapeSynthese`).
 */
export function CircuitSynthese({ synthese, demande }: { synthese: SynthesePeriodique; demande: DemandeSynthese }) {
  const { droits } = useDroits();
  const projets = useProjetsVisibles();
  const projet = projets.data?.find((candidat) => candidat.id === synthese.projetId);
  const moi = personneQuiSigne(droits, lireProfilLocal());
  const etape = etapeSynthese(synthese.statut);

  if (!etape || !tientEtape(etape, projet, droits, moi)) return null;
  if (etape === "CP" && synthese.id) return <DecisionChefProjet synthese={synthese} demande={demande} id={synthese.id} />;
  if (etape === "CT") return <RedactionConducteur synthese={synthese} demande={demande} />;
  return null;
}

function useMiseAJour(demande: DemandeSynthese) {
  const cache = useQueryClient();
  return (aJour: SynthesePeriodique) => {
    cache.setQueryData(cleSynthese(demande), aJour);
    void cache.invalidateQueries({ queryKey: CLE_SUIVI_SYNTHESES });
  };
}

function messageErreur(err: unknown, repli: string): string {
  return err instanceof ErreurApi && err.message ? err.message : repli;
}

/* ------------------------------------------------------------------ *
 * Le conducteur de travaux.
 * ------------------------------------------------------------------ */

function RedactionConducteur({ synthese, demande }: { synthese: SynthesePeriodique; demande: DemandeSynthese }) {
  const t = useTranslations("journal.syntheseCircuit.redaction");
  const tCircuit = useTranslations("journal.syntheseCircuit");
  const mettreAJour = useMiseAJour(demande);
  const idAppreciation = useId();
  const [redaction, setRedaction] = useState<RedactionSynthese>(
    synthese.redaction ?? { appreciation: "", objectifs: [] },
  );
  const [confirmation, setConfirmation] = useState(false);
  const rejet = synthese.circuit.find((etape) => etape.role === "CP" && etape.etat === "REJETE");

  const mutation = useMutation({
    mutationFn: (signer: boolean) =>
      signer ? soumettreSynthese(demande, redaction) : enregistrerSynthese(demande, redaction),
    onSuccess: (aJour, signer) => {
      mettreAJour(aJour);
      toast.success(signer ? t("succesSignature") : t("succesEnregistrement"));
      setConfirmation(false);
    },
    onError: (err) => toast.error(messageErreur(err, tCircuit("erreur"))),
  });

  const enregistrable = redactionEnregistrable(redaction);
  const signable = redactionSignable(redaction);
  const longueur = redaction.appreciation.trim().length;

  function modifierObjectif(rang: number, changement: Partial<ObjectifSuivant>) {
    setRedaction((avant) => ({
      ...avant,
      objectifs: avant.objectifs.map((objectif, i) => (i === rang ? { ...objectif, ...changement } : objectif)),
    }));
  }

  return (
    <section
      aria-labelledby="titre-redaction-synthese"
      className="flex flex-col gap-4 rounded-xl border border-solid border-primary-200 bg-primary-50 p-4 print:hidden"
    >
      <div className="flex items-start gap-3">
        <FilePenLine className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden="true" />
        <div>
          <h2 id="titre-redaction-synthese" className="m-0 text-sm font-semibold text-neutral-900">
            {t("titre")}
          </h2>
          <p className="m-0 text-sm text-neutral-600">{t("description")}</p>
        </div>
      </div>

      {rejet && (
        <p
          role="alert"
          className="m-0 flex items-start gap-2 rounded-lg bg-erreur-fond px-3 py-2 text-sm text-erreur"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("rejetee", { motif: rejet.commentaire ?? "" })}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idAppreciation}>{t("appreciation")}</Label>
        <Textarea
          id={idAppreciation}
          value={redaction.appreciation}
          onChange={(evenement) => setRedaction((avant) => ({ ...avant, appreciation: evenement.target.value }))}
          rows={5}
          maxLength={10000}
          className="bg-card"
        />
        <p className="m-0 text-xs text-neutral-500">
          {t("aideAppreciation", { min: LONGUEUR_MIN_APPRECIATION, n: longueur })}
        </p>
      </div>

      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-1 p-0 text-sm font-medium text-neutral-800">{t("objectifs")}</legend>
        <p className="m-0 text-xs text-neutral-500">{t("aideObjectifs")}</p>
        {redaction.objectifs.map((objectif, rang) => (
          <LigneObjectif
            key={rang}
            rang={rang}
            objectif={objectif}
            lots={synthese.lots.map((lot) => lot.code)}
            onChanger={(changement) => modifierObjectif(rang, changement)}
            onRetirer={() =>
              setRedaction((avant) => ({ ...avant, objectifs: avant.objectifs.filter((_, i) => i !== rang) }))
            }
          />
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRedaction((avant) => ({ ...avant, objectifs: [...avant.objectifs, OBJECTIF_VIDE] }))}
          >
            <Plus aria-hidden="true" />
            {t("ajouter")}
          </Button>
        </div>
        {!enregistrable && (
          <p role="alert" className="m-0 text-xs text-erreur">
            {t("incomplet")}
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => mutation.mutate(false)}
          disabled={!enregistrable || mutation.isPending}
        >
          {mutation.isPending && !confirmation ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          {t("enregistrer")}
        </Button>
        <Button type="button" onClick={() => setConfirmation(true)} disabled={!signable || mutation.isPending}>
          <PenLine aria-hidden="true" />
          {t("signer")}
        </Button>
      </div>

      <Dialog open={confirmation} onOpenChange={(ouvert) => !ouvert && !mutation.isPending && setConfirmation(false)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("modaleTitre")}</DialogTitle>
            <DialogDescription>{t("modaleDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-3 sm:flex">
            <Button type="button" variant="outline" onClick={() => setConfirmation(false)} disabled={mutation.isPending}>
              {t("annuler")}
            </Button>
            <Button type="button" onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {t("signer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LigneObjectif({
  rang,
  objectif,
  lots,
  onChanger,
  onRetirer,
}: {
  rang: number;
  objectif: ObjectifSuivant;
  lots: string[];
  onChanger: (changement: Partial<ObjectifSuivant>) => void;
  onRetirer: () => void;
}) {
  const t = useTranslations("journal.syntheseCircuit.redaction");
  const id = useId();
  const incomplet = !objectifComplet(objectif);
  return (
    <div
      role="group"
      aria-label={t("objectifNumero", { n: rang + 1 })}
      className="grid grid-cols-1 gap-2 rounded-lg border border-solid border-neutral-200 bg-card p-3 sm:grid-cols-12"
    >
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label htmlFor={`${id}-lot`} className="text-xs">
          {t("lot")}
        </Label>
        <Select
          value={objectif.lotCode || SANS_LOT}
          onValueChange={(valeur) => onChanger({ lotCode: valeur === SANS_LOT ? "" : valeur })}
        >
          <SelectTrigger id={`${id}-lot`} className="h-[var(--input-height)] w-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SANS_LOT}>{t("sansLot")}</SelectItem>
            {lots.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-3">
        <Label htmlFor={`${id}-activite`} className="text-xs">
          {t("activite")}
        </Label>
        <Input
          id={`${id}-activite`}
          value={objectif.activite}
          maxLength={300}
          aria-invalid={incomplet && objectif.activite.trim() === ""}
          onChange={(evenement) => onChanger({ activite: evenement.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-3">
        <Label htmlFor={`${id}-objectif`} className="text-xs">
          {t("objectif")}
        </Label>
        <Input
          id={`${id}-objectif`}
          value={objectif.objectif}
          maxLength={300}
          aria-invalid={incomplet && objectif.objectif.trim() === ""}
          onChange={(evenement) => onChanger({ objectif: evenement.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-1">
        <Label htmlFor={`${id}-cible`} className="text-xs">
          {t("cible")}
        </Label>
        <Input
          id={`${id}-cible`}
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          value={Number.isFinite(objectif.cible) ? objectif.cible : ""}
          onChange={(evenement) =>
            onChanger({ cible: evenement.target.value === "" ? Number.NaN : Number(evenement.target.value) })
          }
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label htmlFor={`${id}-prerequis`} className="text-xs">
          {t("prerequis")}
        </Label>
        <Input
          id={`${id}-prerequis`}
          value={objectif.prerequis}
          maxLength={1000}
          onChange={(evenement) => onChanger({ prerequis: evenement.target.value })}
        />
      </div>
      <div className="flex items-end sm:col-span-1 sm:justify-end">
        <Button type="button" variant="ghost" size="icon" onClick={onRetirer} aria-label={t("retirer")}>
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Le chef de projet.
 * ------------------------------------------------------------------ */

type Decision = "approuver" | "rejeter";

function DecisionChefProjet({
  synthese,
  demande,
  id,
}: {
  synthese: SynthesePeriodique;
  demande: DemandeSynthese;
  id: string;
}) {
  const t = useTranslations("journal.syntheseCircuit.decision");
  const tCircuit = useTranslations("journal.syntheseCircuit");
  const mettreAJour = useMiseAJour(demande);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [texte, setTexte] = useState("");
  const idTexte = useId();

  const mutation = useMutation({
    mutationFn: (choix: Decision) =>
      choix === "rejeter" ? rejeterSynthese(id, texte.trim()) : approuverSynthese(id, texte.trim()),
    onSuccess: (aJour, choix) => {
      mettreAJour(aJour);
      toast.success(choix === "rejeter" ? t("succesRejet") : t("succesApprobation"));
      fermer();
    },
    onError: (err) => toast.error(messageErreur(err, tCircuit("erreur"))),
  });

  function ouvrir(choix: Decision) {
    setTexte("");
    setDecision(choix);
  }

  function fermer() {
    setDecision(null);
    setTexte("");
  }

  const rejet = decision === "rejeter";
  const motifTropCourt = rejet && texte.trim().length < LONGUEUR_MIN_COMMENTAIRE_REJET;

  return (
    <>
      <section
        aria-labelledby="titre-decision-synthese"
        className="flex flex-col gap-3 rounded-xl border border-solid border-primary-200 bg-primary-50 p-4 print:hidden sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <PenLine className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden="true" />
          <div>
            <h2 id="titre-decision-synthese" className="m-0 text-sm font-semibold text-neutral-900">
              {t("titre")}
            </h2>
            <p className="m-0 text-sm text-neutral-600">
              {t("description", { conducteur: synthese.conducteurTravaux })}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="outline" onClick={() => ouvrir("rejeter")}>
            <Undo2 aria-hidden="true" />
            {t("rejeter")}
          </Button>
          <Button type="button" onClick={() => ouvrir("approuver")}>
            <Check aria-hidden="true" />
            {t("approuver")}
          </Button>
        </div>
      </section>

      <Dialog open={decision !== null} onOpenChange={(ouvert) => !ouvert && !mutation.isPending && fermer()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{rejet ? t("titreRejet") : t("modaleTitre")}</DialogTitle>
            <DialogDescription>{rejet ? t("descriptionRejet") : t("modaleDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={idTexte}>{rejet ? t("motif") : t("commentaire")}</Label>
            <Textarea
              id={idTexte}
              value={texte}
              onChange={(evenement) => setTexte(evenement.target.value)}
              rows={4}
              maxLength={5000}
              aria-invalid={motifTropCourt && texte.length > 0}
            />
            {rejet && (
              <p className="m-0 text-xs text-neutral-500">
                {t("aideMotif", { min: LONGUEUR_MIN_COMMENTAIRE_REJET, n: texte.trim().length })}
              </p>
            )}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3 sm:flex">
            <Button type="button" variant="outline" onClick={fermer} disabled={mutation.isPending}>
              {t("annuler")}
            </Button>
            <Button
              type="button"
              variant={rejet ? "destructive" : "default"}
              onClick={() => decision && mutation.mutate(decision)}
              disabled={mutation.isPending || motifTropCourt}
            >
              {mutation.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : rejet ? (
                <Undo2 aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {rejet ? t("confirmerRejet") : t("approuver")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

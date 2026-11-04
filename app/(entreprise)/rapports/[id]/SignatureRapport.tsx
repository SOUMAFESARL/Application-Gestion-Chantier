"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FilePen, LoaderCircle, PenLine, Undo2 } from "lucide-react";
import Link from "next/link";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lireProfilLocal } from "@/features/auth/api";
import { LONGUEUR_MIN_COMMENTAIRE_REJET } from "@/features/chantier";
import type { RapportJournalier } from "@/features/chantier";
import { approuverRapport, rejeterRapport, validerRapport } from "@/features/chantier/adaptateur";
import { CLE_JOURNAL, CLE_SUIVI_SYNTHESES, cleRapport, cleRapportsProjet } from "@/features/chantier/cles";
import { cleDecoupage } from "@/features/decoupage/cles";
import { CLE_LISTE_PROJETS, cleProjet } from "@/features/projets/cles";
import { CLE_TABLEAU_DE_BORD } from "@/features/tableauDeBord";
import { etapeASigner, peutRedigerJournal, personneQuiSigne, useDroits } from "@/features/habilitations";
import { ErreurApi } from "@/lib/api";

type Geste = "signer" | "rejeter";

/**
 * Le geste du signataire attendu : un validateur (`journal.valider`) sur un rapport
 * soumis, un approbateur (`journal.approuver`) sur un rapport validé.
 *
 * Il vit sur le rapport lui-même, et non dans la file : on signe ce qu'on a lu.
 * Personne d'autre ne voit ce bandeau : signe celui qui détient la permission sur
 * le périmètre couvert par le rapport (`etapeASigner`).
 */
export function SignatureRapport({ rapport }: { rapport: RapportJournalier }) {
  const t = useTranslations("journal.signature");
  const { droits } = useDroits();
  const cache = useQueryClient();
  const [geste, setGeste] = useState<Geste | null>(null);
  const [texte, setTexte] = useState("");
  const idTexte = useId();

  const moi = personneQuiSigne(droits, lireProfilLocal());
  const etape = etapeASigner(rapport.situation, rapport.circuit, moi);

  const mutation = useMutation({
    mutationFn: (choix: Geste) => {
      if (choix === "rejeter") return rejeterRapport(rapport.id, texte.trim());
      return etape === "APPROBATION"
        ? approuverRapport(rapport.id, texte.trim())
        : validerRapport(rapport.id, texte.trim());
    },
    onSuccess: (aJour, choix) => {
      const projetId = rapport.chantier.projetId;
      cache.setQueryData(cleRapport(rapport.id), aJour);
      void cache.invalidateQueries({ queryKey: CLE_JOURNAL });
      void cache.invalidateQueries({ queryKey: cleRapportsProjet(projetId) });
      if (choix === "signer" && (aJour.situation === "VALIDE" || aJour.situation === "APPROUVE")) {
        void cache.invalidateQueries({ queryKey: cleDecoupage(projetId) });
        void cache.invalidateQueries({ queryKey: cleProjet(projetId) });
        void cache.invalidateQueries({ queryKey: CLE_LISTE_PROJETS });
        void cache.invalidateQueries({ queryKey: CLE_TABLEAU_DE_BORD });
        void cache.invalidateQueries({ queryKey: ["chantier", "syntheses", projetId] });
        void cache.invalidateQueries({ queryKey: CLE_SUIVI_SYNTHESES });
      }
      toast.success(choix === "rejeter" ? t("succes.rejet") : t(`succes.${etape ?? "VALIDATION"}`));
      fermer();
    },
    onError: (err) => {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreur"));
    },
  });

  if (rapport.situation === "REJETE") {
    const etapeRejetee = rapport.circuit.find((e) => e.etat === "REJETE");
    const roleRejet = etapeRejetee?.role === "APPROBATION" ? "APPROBATION" : "VALIDATION";
    const rejeteur =
      etapeRejetee?.signataires?.find((s) => s.etat === "REJETE")?.nom ||
      etapeRejetee?.signataire ||
      "";
    const motif = etapeRejetee?.commentaire ?? "";
    const peutCorriger = peutRedigerJournal(droits);

    return (
      <section
        aria-labelledby="titre-rejet-rapport"
        className="flex flex-col gap-3 rounded-xl border border-solid border-erreur bg-erreur-fond p-4 print:hidden sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <Undo2 className="mt-0.5 size-5 shrink-0 text-erreur" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h2 id="titre-rejet-rapport" className="m-0 text-sm font-semibold text-neutral-900">
              {t(`rejete.titre.${roleRejet}`)}
            </h2>
            {motif && (
              <p className="m-0 text-sm text-neutral-800">
                {rejeteur ? t("rejete.par", { nom: rejeteur, motif }) : t("rejete.motifSeul", { motif })}
              </p>
            )}
            <p className="m-0 text-xs text-neutral-600">{t("rejete.rappel")}</p>
          </div>
        </div>
        {peutCorriger && (
          <Button asChild className="shrink-0">
            <Link href={`/rapports/saisie/${rapport.chantier.projetId}?date=${rapport.date}`}>
              <FilePen aria-hidden="true" />
              {t("rejete.corriger")}
            </Link>
          </Button>
        )}
      </section>
    );
  }

  if (!etape) return null;

  function ouvrir(choix: Geste) {
    setTexte("");
    setGeste(choix);
  }

  function fermer() {
    setGeste(null);
    setTexte("");
  }

  const rejet = geste === "rejeter";
  const motifTropCourt = rejet && texte.trim().length < LONGUEUR_MIN_COMMENTAIRE_REJET;

  return (
    <>
      <section
        aria-labelledby="titre-signature"
        className="flex flex-col gap-3 rounded-xl border border-solid border-primary-200 bg-primary-50 p-4 print:hidden sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <PenLine className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden="true" />
          <div>
            <h2 id="titre-signature" className="m-0 text-sm font-semibold text-neutral-900">
              {t(`titre.${etape}`)}
            </h2>
            <p className="m-0 text-sm text-neutral-600">{t(`description.${etape}`)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="outline" onClick={() => ouvrir("rejeter")}>
            <Undo2 aria-hidden="true" />
            {t("rejeter")}
          </Button>
          <Button type="button" onClick={() => ouvrir("signer")}>
            <Check aria-hidden="true" />
            {t(`signer.${etape}`)}
          </Button>
        </div>
      </section>

      <Dialog open={geste !== null} onOpenChange={(ouvert) => !ouvert && !mutation.isPending && fermer()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{rejet ? t("modale.titreRejet") : t(`modale.titre.${etape}`)}</DialogTitle>
            <DialogDescription>
              {rejet ? t("modale.descriptionRejet") : t(`modale.description.${etape}`)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={idTexte}>{rejet ? t("modale.motif") : t("modale.commentaire")}</Label>
            <Textarea
              id={idTexte}
              value={texte}
              onChange={(evenement) => setTexte(evenement.target.value)}
              rows={4}
              maxLength={5000}
              aria-invalid={motifTropCourt && texte.length > 0}
            />
            <p className="m-0 text-xs text-neutral-500">
              {rejet
                ? t("modale.aideMotif", { min: LONGUEUR_MIN_COMMENTAIRE_REJET, n: texte.trim().length })
                : t("modale.aideCommentaire")}
            </p>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3 sm:flex">
            <Button type="button" variant="outline" onClick={fermer} disabled={mutation.isPending}>
              {t("modale.annuler")}
            </Button>
            <Button
              type="button"
              variant={rejet ? "destructive" : "default"}
              onClick={() => geste && mutation.mutate(geste)}
              disabled={mutation.isPending || motifTropCourt}
            >
              {mutation.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : rejet ? (
                <Undo2 aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {rejet ? t("modale.confirmerRejet") : t(`signer.${etape}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

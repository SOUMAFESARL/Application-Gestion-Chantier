"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, PenLine, Undo2 } from "lucide-react";
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
import { CLE_JOURNAL, cleRapport } from "@/features/chantier/cles";
import { etapeASigner, useDroits, useProjetsVisibles } from "@/features/habilitations";
import { ErreurApi } from "@/lib/api";

type Geste = "signer" | "rejeter";

/**
 * Le geste du signataire attendu : le conducteur de travaux sur un rapport
 * soumis, le chef de projet sur un rapport validé par le CT (SFD F2, RG-F2-03).
 *
 * Il vit sur le rapport lui-même, et non dans la file : on signe ce qu'on a
 * lu. Personne d'autre ne voit ce bandeau : signe celui qui tient la
 * fonction sur le chantier, directeur général compris (`etapeASigner`).
 */
export function SignatureRapport({ rapport }: { rapport: RapportJournalier }) {
  const t = useTranslations("journal.signature");
  const { droits } = useDroits();
  const projets = useProjetsVisibles();
  const cache = useQueryClient();
  const [geste, setGeste] = useState<Geste | null>(null);
  const [texte, setTexte] = useState("");
  const idTexte = useId();

  const projet = projets.data?.find((candidat) => candidat.id === rapport.chantier.projetId);
  // La personne dont on lit la fonction : celle que portent les droits (y
  // compris un rôle incarné en développement), sinon le compte connecté — la
  // portée de la direction ne nomme personne.
  const moi = droits?.portee.type === "PERSONNE" ? droits.portee.collaborateurId : (lireProfilLocal()?.id ?? null);
  const etape = etapeASigner(rapport.situation, projet, droits, moi);

  const mutation = useMutation({
    mutationFn: (choix: Geste) => {
      if (choix === "rejeter") return rejeterRapport(rapport.id, texte.trim());
      return etape === "CP" ? approuverRapport(rapport.id, texte.trim()) : validerRapport(rapport.id, texte.trim());
    },
    onSuccess: (aJour, choix) => {
      cache.setQueryData(cleRapport(rapport.id), aJour);
      void cache.invalidateQueries({ queryKey: CLE_JOURNAL });
      toast.success(choix === "rejeter" ? t("succes.rejet") : t(`succes.${etape ?? "CT"}`));
      fermer();
    },
    onError: (err) => {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreur"));
    },
  });

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

"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleX, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { retirerMembreEncadrement } from "@/features/projets/adaptateur";
import type { FonctionProjet, Intervenant, Projet } from "@/features/projets/types";
import type { ErreurApi } from "@/lib/api";

/** Ce qu'on s'apprête à retirer : une personne, à une place. */
export interface RetraitEncadrement {
  projet: Projet;
  fonction: FonctionProjet;
  intervenant: Intervenant;
}

interface Props {
  /** `null` : la modale est fermée. */
  retrait: RetraitEncadrement | null;
  onFermer: () => void;
  onModifie: (projet: Projet) => void;
}

/**
 * La confirmation du retrait d'une personne de l'encadrement. Elle quitte
 * cette place sur ce projet, pas l'entreprise : son compte reste, et ses
 * autres places dans l'équipe aussi.
 */
export function ModaleRetraitEncadrement({ retrait, onFermer, onModifie }: Props) {
  const t = useTranslations("projets.encadrement");

  const mutation = useMutation({
    mutationFn: (cible: RetraitEncadrement) =>
      retirerMembreEncadrement(cible.projet.id, cible.fonction, cible.intervenant.id),
    onSuccess: (projet, cible) => {
      onModifie(projet);
      toast.success(t("retrait.succes", { nom: cible.intervenant.nomComplet }));
      mutation.reset();
      onFermer();
    },
  });

  const erreur = mutation.error as ErreurApi | null;
  const nom = retrait?.intervenant.nomComplet ?? "";

  // Une erreur ne doit pas resurgir au retrait suivant.
  function fermer() {
    if (mutation.isPending) return;
    mutation.reset();
    onFermer();
  }

  return (
    <Dialog
      open={retrait !== null}
      onOpenChange={(ouvert) => !ouvert && fermer()}
    >
      <DialogContent className="sm:max-w-[480px]">
        {retrait && (
          <>
            <DialogHeader>
              <DialogTitle>{t("retrait.titre", { nom })}</DialogTitle>
              <DialogDescription>
                {t("retrait.description", {
                  nom,
                  fonction: t(`fonctionUnitaire.${retrait.fonction}`).toLowerCase(),
                })}
              </DialogDescription>
            </DialogHeader>

            {erreur && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{erreur.message || t("retrait.erreurGenerique")}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={fermer} disabled={mutation.isPending}>
                {t("retrait.annuler")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => mutation.mutate(retrait)}
                disabled={mutation.isPending}
                aria-busy={mutation.isPending}
              >
                {mutation.isPending && <LoaderCircle className="animate-spin" />}
                {t("retrait.retirer")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

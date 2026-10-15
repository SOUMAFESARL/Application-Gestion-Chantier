"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleX, Info, LoaderCircle } from "lucide-react";
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
import { retraitDuDernierCp } from "@/features/projets/regles";
import type { FonctionProjet, Intervenant, Projet } from "@/features/projets/types";
import type { ErreurApi } from "@/lib/api";

/** Ce qu'on s'apprête à retirer : une personne, à une place, via son affectation. */
export interface RetraitEncadrement {
  projet: Projet;
  fonction: FonctionProjet;
  intervenant: Intervenant;
  affectationId: string;
}

interface Props {
  /** `null` : la modale est fermée. */
  retrait: RetraitEncadrement | null;
  onFermer: () => void;
  onModifie: (projet: Projet) => void;
}

/**
 * La confirmation du retrait d'une personne de l'encadrement. Elle quitte
 * cette place sur ce projet, pas l'entreprise : son compte reste.
 */
export function ModaleRetraitEncadrement({ retrait, onFermer, onModifie }: Props) {
  const t = useTranslations("projets.encadrement");

  const mutation = useMutation({
    mutationFn: (cible: RetraitEncadrement) =>
      retirerMembreEncadrement(cible.projet.id, cible.affectationId),
    onSuccess: (projet, cible) => {
      onModifie(projet);
      toast.success(t("retrait.succes", { nom: cible.intervenant.nomComplet }));
      mutation.reset();
      onFermer();
    },
  });

  const erreur = mutation.error as ErreurApi | null;
  const nom = retrait?.intervenant.nomComplet ?? "";
  const estDernierCp = retrait ? retraitDuDernierCp(retrait.projet, retrait.intervenant.id) : false;

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

            <p className="m-0 text-sm text-neutral-600">
              {t("retraitTexte", { nom })}
            </p>

            {estDernierCp && (
              <Alert variant="avertissement">
                <Info />
                <AlertDescription>
                  <p className="font-semibold">{t("dernierCpTitre", { nom })}</p>
                  <p className="mt-1">{t("dernierCpTexte")}</p>
                </AlertDescription>
              </Alert>
            )}

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
                {estDernierCp ? t("retirerQuandMeme") : t("retrait.retirer")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

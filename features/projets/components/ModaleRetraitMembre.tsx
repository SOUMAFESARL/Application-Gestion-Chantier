"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleX, LoaderCircle, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { retirerMembreEquipe } from "@/features/projets/adaptateur";
import type { Equipe, MembreEquipe } from "@/features/projets/types";
import type { ErreurApi } from "@/lib/api";

interface Props {
  /** `null` : la modale est fermée. */
  membre: MembreEquipe | null;
  onFermer: () => void;
  projetId: string;
  equipe: Equipe;
  onRetire: (equipe: Equipe) => void;
}

/**
 * La confirmation du retrait d'une personne de l'équipe. Elle quitte
 * l'équipe, pas l'entreprise : son compte collaborateur, s'il en a un, reste.
 */
export function ModaleRetraitMembre({ membre, onFermer, projetId, equipe, onRetire }: Props) {
  const t = useTranslations("projets.equipesAffectations.fiche.retrait");
  const tEcran = useTranslations("projets.equipesAffectations");

  const mutation = useMutation({
    mutationFn: (cible: MembreEquipe) => retirerMembreEquipe(projetId, equipe.id, cible.id),
    onSuccess: (modifiee) => {
      onRetire(modifiee);
      onFermer();
    },
  });

  const nom = membre ? tEcran("nomComplet", { prenom: membre.prenom, nom: membre.nom }) : "";
  const erreur = mutation.error as ErreurApi | null;

  return (
    <Dialog
      open={membre !== null}
      onOpenChange={(ouvert) => !ouvert && !mutation.isPending && onFermer()}
    >
      <DialogContent className="sm:max-w-[480px]">
        {membre && (
          <>
            <DialogHeader>
              <DialogTitle>{t("titre", { nom })}</DialogTitle>
              <DialogDescription>{t("description", { nom, equipe: equipe.nom })}</DialogDescription>
            </DialogHeader>

            {equipe.chef?.id === membre.id && (
              <Alert variant="avertissement">
                <TriangleAlert />
                <AlertDescription>{t("chef")}</AlertDescription>
              </Alert>
            )}
            {erreur && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{erreur.message || t("erreurGenerique")}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onFermer}
                disabled={mutation.isPending}
              >
                {t("annuler")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => mutation.mutate(membre)}
                disabled={mutation.isPending}
                aria-busy={mutation.isPending}
              >
                {mutation.isPending && <LoaderCircle className="animate-spin" />}
                {t("retirer")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

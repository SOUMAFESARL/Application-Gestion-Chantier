"use client";

import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { supprimerProjet } from "@/features/projets/adaptateur";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";

interface Props {
  /** `null` : la modale est fermée. */
  projet: Projet | null;
  onFermer: () => void;
  onSupprime: (projet: Projet) => void;
}

/**
 * La confirmation de la suppression d'un projet. Le geste est irréversible :
 * la modale le dit. C'est le serveur qui décide si le projet peut encore
 * disparaître ; un refus s'affiche avec son message.
 */
export function ModaleSuppressionProjet({ projet, onFermer, onSupprime }: Props) {
  const t = useTranslations("projets.suppression");

  const mutation = useMutation({
    mutationFn: (cible: Projet) => supprimerProjet(cible.id),
    onSuccess: (_, cible) => {
      toast.success(t("succes", { nom: cible.nom }));
      onFermer();
      onSupprime(cible);
    },
    onError: (err) => {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurGenerique"));
    },
  });

  return (
    <Dialog
      open={projet !== null}
      onOpenChange={(ouvert) => !ouvert && !mutation.isPending && onFermer()}
    >
      <DialogContent className="sm:max-w-[480px]">
        {projet && (
          <>
            <DialogHeader>
              <DialogTitle>{t("titre", { nom: projet.nom })}</DialogTitle>
              <DialogDescription>{t("description", { reference: projet.reference })}</DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={onFermer} disabled={mutation.isPending}>
                {t("annuler")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => mutation.mutate(projet)}
                disabled={mutation.isPending}
                aria-busy={mutation.isPending}
              >
                {mutation.isPending && <LoaderCircle className="animate-spin" />}
                {t("supprimer")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

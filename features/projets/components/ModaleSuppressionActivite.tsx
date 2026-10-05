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
import { supprimerActivite } from "@/features/projets/adaptateur";
import { activiteSupprimable } from "@/features/projets/regles";
import type { Activite } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";

interface Props {
  /** `null` : la modale est fermée. */
  activite: Activite | null;
  onFermer: () => void;
  onSupprimee: (activite: Activite) => void;
}

/**
 * La confirmation de la suppression d'une activité. Une activité qui a déjà
 * avancé ne se supprime pas (`activiteSupprimable`) : la modale l'explique au
 * lieu de proposer un bouton que le serveur refuserait.
 */
export function ModaleSuppressionActivite({ activite, onFermer, onSupprimee }: Props) {
  const t = useTranslations("projets.lotsActivites.suppressionActivite");

  const mutation = useMutation({
    mutationFn: (cible: Activite) => supprimerActivite(cible.id),
    onSuccess: (_, cible) => {
      onSupprimee(cible);
      toast.success(t("succes", { code: cible.code, libelle: cible.libelle }));
      onFermer();
    },
    onError: (err) => {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurGenerique"));
    },
  });

  const supprimable = activite ? activiteSupprimable(activite) : false;

  return (
    <Dialog
      open={activite !== null}
      onOpenChange={(ouvert) => !ouvert && !mutation.isPending && onFermer()}
    >
      <DialogContent className="sm:max-w-[480px]">
        {activite && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("titre", { code: activite.code, libelle: activite.libelle })}
              </DialogTitle>
              <DialogDescription>{supprimable ? t("description") : t("impossible")}</DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={onFermer} disabled={mutation.isPending}>
                {supprimable ? t("annuler") : t("fermer")}
              </Button>
              {supprimable && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => mutation.mutate(activite)}
                  disabled={mutation.isPending}
                  aria-busy={mutation.isPending}
                >
                  {mutation.isPending && <LoaderCircle className="animate-spin" />}
                  {t("supprimer")}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

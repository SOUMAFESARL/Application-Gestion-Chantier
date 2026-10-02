"use client";

import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, TriangleAlert } from "lucide-react";
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
import { supprimerLot } from "@/features/projets/adaptateur";
import { lotSupprimable } from "@/features/projets/regles";
import type { Lot } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";

interface Props {
  /** `null` : la modale est fermée. */
  lot: Lot | null;
  onFermer: () => void;
  projetId: string;
  onSupprime: (lot: Lot) => void;
}

/**
 * La confirmation de la suppression d'un lot. Ses activités partent avec
 * lui — la modale le dit et les compte. Un lot dont une activité a déjà
 * avancé ne se supprime pas (`lotSupprimable`) : la modale l'explique au
 * lieu de proposer un bouton que le serveur refuserait.
 */
export function ModaleSuppressionLot({ lot, onFermer, projetId, onSupprime }: Props) {
  const t = useTranslations("projets.lotsActivites.suppressionLot");

  const mutation = useMutation({
    mutationFn: (cible: Lot) => supprimerLot(projetId, cible.id),
    onSuccess: (_, cible) => {
      onSupprime(cible);
      toast.success(t("succes", { code: cible.code, nom: cible.nom }));
      onFermer();
    },
    onError: (err) => {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurGenerique"));
    },
  });

  const supprimable = lot ? lotSupprimable(lot) : false;

  return (
    <Dialog open={lot !== null} onOpenChange={(ouvert) => !ouvert && !mutation.isPending && onFermer()}>
      <DialogContent className="sm:max-w-[480px]">
        {lot && (
          <>
            <DialogHeader>
              <DialogTitle>{t("titre", { code: lot.code, nom: lot.nom })}</DialogTitle>
              <DialogDescription>{supprimable ? t("description") : t("impossible")}</DialogDescription>
            </DialogHeader>

            {supprimable && lot.activites.length > 0 && (
              <Alert variant="avertissement">
                <TriangleAlert />
                <AlertDescription>
                  {t("activitesSupprimees", { nombre: lot.activites.length })}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={onFermer} disabled={mutation.isPending}>
                {supprimable ? t("annuler") : t("fermer")}
              </Button>
              {supprimable && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => mutation.mutate(lot)}
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

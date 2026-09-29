"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleX, LoaderCircle } from "lucide-react";
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
import { reprendreProjet, suspendreProjet } from "@/features/projets/adaptateur";
import { peutReprendre } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import type { ErreurApi } from "@/lib/api";

interface Props {
  /** `null` : la modale est fermée. */
  projet: Projet | null;
  onFermer: () => void;
  onTermine: (projet: Projet) => void;
}

/**
 * La confirmation de la suspension d'un projet, ou de sa reprise. Le sens se
 * déduit du statut (`peutReprendre`) : un projet suspendu se reprend, les
 * autres se suspendent. Suspendre arrête un chantier entier — le geste mérite
 * une confirmation, et la reprise la même, par symétrie.
 */
export function ModaleSuspensionProjet({ projet, onFermer, onTermine }: Props) {
  const t = useTranslations("projets.suspension");

  const mutation = useMutation({
    mutationFn: (cible: Projet) =>
      peutReprendre(cible) ? reprendreProjet(cible.id) : suspendreProjet(cible.id),
    onSuccess: (modifie) => {
      onTermine(modifie);
      onFermer();
    },
  });

  const reprise = projet !== null && peutReprendre(projet);
  const erreur = mutation.error as ErreurApi | null;

  return (
    <Dialog
      open={projet !== null}
      onOpenChange={(ouvert) => !ouvert && !mutation.isPending && onFermer()}
    >
      <DialogContent className="sm:max-w-[480px]">
        {projet && (
          <>
            <DialogHeader>
              <DialogTitle>
                {reprise
                  ? t("titreReprendre", { nom: projet.nom })
                  : t("titreSuspendre", { nom: projet.nom })}
              </DialogTitle>
              <DialogDescription>
                {reprise ? t("descriptionReprendre") : t("descriptionSuspendre")}
              </DialogDescription>
            </DialogHeader>

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
                variant={reprise ? "default" : "destructive"}
                onClick={() => mutation.mutate(projet)}
                disabled={mutation.isPending}
                aria-busy={mutation.isPending}
              >
                {mutation.isPending && <LoaderCircle className="animate-spin" />}
                {reprise ? t("confirmerReprendre") : t("confirmerSuspendre")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

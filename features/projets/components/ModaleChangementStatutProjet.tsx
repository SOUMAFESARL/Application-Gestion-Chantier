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
import { changerStatutProjet } from "@/features/projets/adaptateur";
import type { ChangementStatut } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import type { ErreurApi } from "@/lib/api";

export interface ChangementOuvert {
  projet: Projet;
  changement: ChangementStatut;
}

interface Props {
  /** `null` : la modale est fermée. */
  ouvert: ChangementOuvert | null;
  onFermer: () => void;
  onTermine: (projet: Projet) => void;
}

/**
 * La confirmation d'un changement de statut qui est un acte : réceptionner, archiver, désactiver,
 * résilier, réactiver. Chacun a son texte, qui dit ce qu'il change. C'est le serveur qui juge la
 * règle : réceptionner est refusé tant qu'une tâche n'est pas clôturée, et le message du refus
 * s'affiche tel quel, avec la liste des tâches concernées.
 */
export function ModaleChangementStatutProjet({ ouvert, onFermer, onTermine }: Props) {
  const t = useTranslations("projets.changementStatut");

  const mutation = useMutation({
    mutationFn: ({ projet, changement }: ChangementOuvert) => changerStatutProjet(projet, changement),
    onSuccess: (modifie, { projet, changement }) => {
      toast.success(t(`${changement}.succes`, { nom: projet.nom }));
      onTermine(modifie);
      onFermer();
    },
  });

  const erreur = mutation.error as ErreurApi | null;

  return (
    <Dialog
      open={ouvert !== null}
      onOpenChange={(visible) => !visible && !mutation.isPending && onFermer()}
    >
      <DialogContent className="sm:max-w-[480px]">
        {ouvert && (
          <>
            <DialogHeader>
              <DialogTitle>{t(`${ouvert.changement}.titre`, { nom: ouvert.projet.nom })}</DialogTitle>
              <DialogDescription>{t(`${ouvert.changement}.description`)}</DialogDescription>
            </DialogHeader>

            {erreur && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{erreur.message || t("erreurGenerique")}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={onFermer} disabled={mutation.isPending}>
                {t("annuler")}
              </Button>
              <Button
                type="button"
                variant={ouvert.changement === "resilier" ? "destructive" : "default"}
                onClick={() => mutation.mutate(ouvert)}
                disabled={mutation.isPending}
                aria-busy={mutation.isPending}
              >
                {mutation.isPending && <LoaderCircle className="animate-spin" />}
                {t(`${ouvert.changement}.confirmer`)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

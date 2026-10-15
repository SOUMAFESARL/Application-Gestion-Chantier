"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Alerte, Bouton, Modale } from "@/components/ui";
import {
  CLE_COLLABORATEURS,
  cleCollaborateur,
  reactiverCollaborateur,
  renvoyerInvitation,
  supprimerCollaborateur,
  suspendreCollaborateur,
} from "@/features/invitations/adaptateur";
import type { Collaborateur, InvitationRenvoyee } from "@/features/invitations/types";
import { ErreurApi } from "@/lib/api";

type Geste = "suspension" | "reactivation" | "suppression" | "renvoi";

/**
 * Les gestes qu'on fait sur un collaborateur — le suspendre, le
 * réactiver, le supprimer, ou renvoyer son invitation — pour la liste
 * comme pour sa fiche.
 *
 * Même raison d'être que `useGestionProjet` : les deux écrans doivent laisser
 * **le même cache** dans le même état après coup. Chaque geste passe par une
 * confirmation : aucun ne se fait sur un clic égaré.
 *
 * `modaux` est à rendre une fois dans l'écran. `onSupprime` sert à la fiche,
 * qui n'a plus rien à montrer une fois le compte supprimé.
 */
export function useGestionCollaborateur({ onSupprime }: { onSupprime?: () => void } = {}) {
  const t = useTranslations("gestionCollaborateurs.gestes");
  const cache = useQueryClient();
  const [cible, setCible] = useState<{ geste: Geste; collaborateur: Collaborateur } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const ouvrir = useCallback((geste: Geste, collaborateur: Collaborateur) => {
    setErreur(null);
    setCible({ geste, collaborateur });
  }, []);

  const suspendre = useCallback((c: Collaborateur) => ouvrir("suspension", c), [ouvrir]);
  const reactiver = useCallback((c: Collaborateur) => ouvrir("reactivation", c), [ouvrir]);
  const supprimer = useCallback((c: Collaborateur) => ouvrir("suppression", c), [ouvrir]);
  const renvoyer = useCallback((c: Collaborateur) => ouvrir("renvoi", c), [ouvrir]);

  /** Le compte modifié est posé dans la liste et dans sa fiche. */
  function actualiser(collaborateur: Collaborateur) {
    cache.setQueryData(cleCollaborateur(collaborateur.id), collaborateur);
    cache.setQueryData<Collaborateur[]>(CLE_COLLABORATEURS, (liste) =>
      liste?.map((c) => (c.id === collaborateur.id ? collaborateur : c)),
    );
  }

  const mutation = useMutation({
    mutationFn: async ({
      geste,
      collaborateur,
    }: NonNullable<typeof cible>): Promise<{
      collaborateur: Collaborateur | null;
      renvoi?: InvitationRenvoyee;
    }> => {
      if (geste === "suppression") {
        await supprimerCollaborateur(collaborateur.id);
        return { collaborateur: null };
      }
      if (geste === "renvoi") {
        const renvoi = await renvoyerInvitation(collaborateur.id);
        return { collaborateur: renvoi.collaborateur, renvoi };
      }
      const resultat =
        geste === "suspension"
          ? await suspendreCollaborateur(collaborateur.id)
          : await reactiverCollaborateur(collaborateur.id);
      return { collaborateur: resultat };
    },
    onSuccess: ({ collaborateur: resultat, renvoi }, { geste, collaborateur }) => {
      if (geste === "suppression") {
        cache.setQueryData<Collaborateur[]>(CLE_COLLABORATEURS, (liste) =>
          liste?.filter((c) => c.id !== collaborateur.id),
        );
        cache.removeQueries({ queryKey: cleCollaborateur(collaborateur.id), exact: true });
        onSupprime?.();
        toast.success(t(`${geste}.succes`, { nom: collaborateur.nomComplet }));
      } else if (geste === "renvoi" && renvoi && resultat) {
        actualiser(resultat);
        const actionCopier = renvoi.lienActivation
          ? {
              action: {
                label: t("renvoi.copierLien"),
                onClick: async () => {
                  try {
                    const urlComplete = `${window.location.origin}${renvoi.lienActivation}`;
                    await navigator.clipboard.writeText(urlComplete);
                    toast.success(t("renvoi.lienCopie"));
                  } catch {
                    toast.error(t("renvoi.copieImpossible"));
                  }
                },
              },
            }
          : undefined;

        if (renvoi.emailEnvoye) {
          toast.success(t("renvoi.succes", { nom: collaborateur.nomComplet }), actionCopier);
        } else {
          toast.warning(t("renvoi.sansCourriel", { nom: collaborateur.nomComplet }), actionCopier);
        }
      } else if (resultat) {
        actualiser(resultat);
        toast.success(t(`${geste}.succes`, { nom: collaborateur.nomComplet }));
      }
      setCible(null);
    },
    onError: (cause) => {
      setErreur(cause instanceof ErreurApi && cause.message ? cause.message : t("erreur"));
    },
  });

  function fermer() {
    if (mutation.isPending) return;
    setCible(null);
    setErreur(null);
  }

  const geste = cible?.geste;

  const modaux = (
    <Modale
      ouverte={cible !== null}
      titre={cible ? t(`${cible.geste}.titre`, { nom: cible.collaborateur.nomComplet }) : ""}
      libelleFermeture={t("fermer")}
      onFermer={fermer}
      actions={
        <>
          <Bouton variante="ghost" onClick={fermer} disabled={mutation.isPending}>
            {t("annuler")}
          </Bouton>
          <Bouton
            variante={geste === "reactivation" || geste === "renvoi" ? "primaire" : "danger"}
            enCours={mutation.isPending}
            onClick={() => cible && mutation.mutate(cible)}
          >
            {geste && (mutation.isPending ? t(`${geste}.enCours`) : t(`${geste}.confirmer`))}
          </Bouton>
        </>
      }
    >
      {geste && <p className="text-sm text-neutral-600">{t(`${geste}.description`)}</p>}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
    </Modale>
  );

  return { suspendre, reactiver, supprimer, renvoyer, modaux };
}

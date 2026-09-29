"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { indicateursJournalProjet } from "@/features/chantier";
import { lireJournal } from "@/features/chantier/adaptateur";
import { CLE_JOURNAL } from "@/features/chantier/cles";
import { lireEntreprise } from "@/features/configuration/api";
import { useIdentitePlateforme } from "@/features/plateforme/hooks";
import { listerEquipes, listerLots } from "@/features/projets/adaptateur";
import { cleEquipes, cleLots } from "@/features/projets/cles";
import type { Projet } from "@/features/projets/types";
import { chargerImagePdf, telechargerDocumentPdf } from "@/lib/export/documentPdf";

import { contenuFicheProjet } from "./contenuFichePdf";

/** Une lecture qui échoue donne `null` : la fiche sort quand même, et le dit. */
async function ouNull<T>(promesse: Promise<T>): Promise<T | null> {
  try {
    return await promesse;
  } catch {
    return null;
  }
}

/**
 * La génération de la fiche projet (F1 §9).
 *
 * Le clic lance directement le téléchargement : plus de formulaire préalable
 * (la note du chef de projet n'est plus demandée, la section 8 n'apparaît
 * donc pas). Tout est lu au moment du clic, pour que le document soit figé à
 * cette heure-là et non à celle du dernier chargement de l'écran.
 *
 * Pendant la génération, `indicateur` affiche un chargeur bloquant — les
 * lectures et la mise en page prennent quelques secondes sur une connexion
 * de chantier, et un second clic sortirait un second PDF. En cas d'échec, le
 * même cadre porte l'erreur et propose de réessayer.
 *
 * Seuls les lots sont indispensables : sans eux, la moitié de la fiche serait
 * fausse. Le journal, les équipes, l'entreprise et son logo sont facultatifs —
 * leur absence se lit dans le document au lieu de l'empêcher.
 */
export function useGenerationFicheProjet(projet: Projet | undefined) {
  const t = useTranslations("ficheProjet.pdf");
  const tProjets = useTranslations("projets");
  const tMarque = useTranslations("marque");
  const client = useQueryClient();
  const identite = useIdentitePlateforme().data;

  const generation = useMutation({
    mutationFn: async (projet: Projet) => {
      const maintenant = new Date();
      const [lots, equipes, journal, entreprise] = await Promise.all([
        client.fetchQuery({
          queryKey: cleLots(projet.id),
          queryFn: ({ signal }) => listerLots(projet.id, signal),
        }),
        ouNull(
          client.fetchQuery({
            queryKey: cleEquipes(projet.id),
            queryFn: ({ signal }) => listerEquipes(projet.id, signal),
          }),
        ),
        ouNull(
          client.fetchQuery({
            queryKey: CLE_JOURNAL,
            queryFn: ({ signal }) => lireJournal(signal),
          }),
        ),
        ouNull(lireEntreprise()),
      ]);
      const logo = await chargerImagePdf(entreprise?.logo_original ?? entreprise?.logo);

      await telechargerDocumentPdf(
        contenuFicheProjet((cle, valeurs) => t(cle, valeurs), {
          projet,
          lots,
          equipes,
          journal: journal
            ? indicateursJournalProjet(journal.entrees, projet.id, journal.aujourdhui)
            : null,
          entreprise,
          logo,
          note: "",
          marque: identite?.nom || tMarque("nom"),
          libelles: {
            typeProjet: (type) => tProjets(`tiroirCreation.typeProjet.${type}`),
            statutProjet: (statut) => tProjets(`statut.${statut}`),
            modeExecution: (mode) => tProjets(`tiroirCreation.modeExecution.${mode}`),
            typeBordereau: (type) => tProjets(`tiroirCreation.typeBordereau.${type}`),
            statutActivite: (statut) => tProjets(`lotsActivites.statutActivite.${statut}`),
          },
          maintenant,
        }),
      );
    },
  });

  function generer() {
    if (projet && !generation.isPending) generation.mutate(projet);
  }

  const ouverte = generation.isPending || generation.isError;

  const indicateur = (
    <Dialog open={ouverte} onOpenChange={(ouvert) => !ouvert && !generation.isPending && generation.reset()}>
      <DialogContent className="sm:max-w-[420px]" showCloseButton={generation.isError}>
        <DialogHeader>
          <DialogTitle>{t("generation.titre")}</DialogTitle>
          <DialogDescription>
            {generation.isPending ? t("generation.enCours") : t("generation.echec")}
          </DialogDescription>
        </DialogHeader>

        {generation.isPending ? (
          <div className="flex justify-center py-4" role="status" aria-live="polite">
            <LoaderCircle className="size-8 animate-spin text-primary-600" aria-hidden="true" />
          </div>
        ) : (
          <>
            <Alert variant="erreur">
              <CircleX />
              <AlertDescription>{t("generation.erreur")}</AlertDescription>
            </Alert>
            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={() => generation.reset()}>
                {t("generation.fermer")}
              </Button>
              <Button type="button" onClick={generer}>
                {t("generation.reessayer")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  return { generer, enCours: generation.isPending, indicateur };
}

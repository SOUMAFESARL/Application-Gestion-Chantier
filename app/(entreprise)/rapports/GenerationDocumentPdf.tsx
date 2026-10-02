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
import type { DonneesEntreprise } from "@/features/configuration/api";
import { lireEntreprise } from "@/features/configuration/api";
import { useIdentitePlateforme } from "@/features/plateforme/hooks";
import type { DocumentPdf, ImagePdf } from "@/lib/export/documentPdf";
import { chargerImagePdf, imprimerDocumentPdf, telechargerDocumentPdf } from "@/lib/export/documentPdf";

type Sortie = "telecharger" | "imprimer";

/** Ce qui est lu au clic, pour tout document du journal : son émetteur, à cette heure-là. */
export interface SourcePdf {
  entreprise: DonneesEntreprise | null;
  logo: ImagePdf | null;
  /** Le nom de la plateforme : l'émetteur à défaut d'entreprise connue. */
  marque: string;
  maintenant: Date;
}

/**
 * La sortie PDF d'un document du journal — le rapport journalier comme la
 * synthèse périodique —, sur le modèle de la fiche projet : même en-tête
 * (logo de l'entreprise, titre, date de génération), même pied paginé, et
 * des tableaux dessinés par autoTable, qui passent à la ligne et se
 * poursuivent d'une page à l'autre au lieu d'être rognés.
 *
 * « Imprimer » passe par le même PDF que « Télécharger » : les deux sorties
 * sont identiques. Le contenu est celui déjà affiché ; seules l'entreprise et
 * son logo sont lus au clic, et leur absence n'empêche pas le document de
 * sortir.
 */
export function useGenerationDocumentPdf(titre: string, construire: (source: SourcePdf) => DocumentPdf) {
  const t = useTranslations("journal.document.generation");
  const tMarque = useTranslations("marque");
  const identite = useIdentitePlateforme().data;

  const generation = useMutation({
    mutationFn: async (sortie: Sortie) => {
      const maintenant = new Date();
      const entreprise = await lireEntreprise().catch(() => null);
      const logo = await chargerImagePdf(entreprise?.logo_original ?? entreprise?.logo);
      const sortir = sortie === "imprimer" ? imprimerDocumentPdf : telechargerDocumentPdf;
      await sortir(construire({ entreprise, logo, marque: identite?.nom || tMarque("nom"), maintenant }));
    },
  });

  function lancer(sortie: Sortie) {
    if (!generation.isPending) generation.mutate(sortie);
  }

  const ouverte = generation.isPending || generation.isError;

  const indicateur = (
    <Dialog open={ouverte} onOpenChange={(ouvert) => !ouvert && !generation.isPending && generation.reset()}>
      <DialogContent className="sm:max-w-[420px]" showCloseButton={generation.isError}>
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          <DialogDescription>
            {generation.isPending
              ? t(generation.variables === "imprimer" ? "enCoursImpression" : "enCours")
              : t("echec")}
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
              <AlertDescription>{t("erreur")}</AlertDescription>
            </Alert>
            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={() => generation.reset()}>
                {t("fermer")}
              </Button>
              <Button type="button" onClick={() => generation.variables && lancer(generation.variables)}>
                {t("reessayer")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  return {
    pdf: { telecharger: () => lancer("telecharger"), imprimer: () => lancer("imprimer"), enCours: generation.isPending },
    indicateur,
  };
}

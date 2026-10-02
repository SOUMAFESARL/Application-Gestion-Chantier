"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleX, Download, LoaderCircle, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

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
import { chargerImagePdf, genererDocumentPdf } from "@/lib/export/documentPdf";

import { contenuFicheProjet } from "./contenuFichePdf";

/** Une lecture qui échoue donne `null` : la fiche sort quand même, et le dit. */
async function ouNull<T>(promesse: Promise<T>): Promise<T | null> {
  try {
    return await promesse;
  } catch {
    return null;
  }
}

/** Le PDF généré, prêt à l'aperçu : son URL `blob:` et le nom sous lequel le télécharger. */
interface ApercuPdf {
  url: string;
  nomFichier: string;
}

/**
 * La génération de la fiche projet (F1 §9).
 *
 * Le clic ouvre l'étape **« Imprimer »** : la fiche est générée puis montrée
 * en aperçu, et c'est seulement là qu'on choisit de la télécharger ou de
 * l'imprimer — on voit ce qu'on sort avant de le sortir. Les deux sorties
 * partent du même PDF que l'aperçu. Tout est lu au moment du clic, pour que
 * le document soit figé à cette heure-là et non à celle du dernier
 * chargement de l'écran.
 *
 * Pendant la génération, `indicateur` affiche un chargeur bloquant — les
 * lectures et la mise en page prennent quelques secondes sur une connexion
 * de chantier. En cas d'échec, le même cadre porte l'erreur et propose de
 * réessayer.
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

  const cadre = useRef<HTMLIFrameElement>(null);

  const generation = useMutation({
    mutationFn: async (projet: Projet): Promise<ApercuPdf> => {
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

      const contenu = contenuFicheProjet((cle, valeurs) => t(cle, valeurs), {
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
          fonctionAutreMembre: (fonction) => tProjets(`encadrement.fonctionAutreMembre.${fonction}`),
        },
        maintenant,
      });
      const blob = await genererDocumentPdf(contenu);
      return { url: URL.createObjectURL(blob), nomFichier: contenu.nomFichier };
    },
  });

  // L'URL `blob:` retient le PDF en mémoire : on la libère quand l'aperçu change ou se ferme.
  const url = generation.data?.url;
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  function generer() {
    if (projet && !generation.isPending) generation.mutate(projet);
  }

  function telecharger() {
    if (!generation.data) return;
    const lien = document.createElement("a");
    lien.href = generation.data.url;
    lien.download = generation.data.nomFichier;
    lien.click();
  }

  /**
   * On imprime le PDF de l'aperçu, pas la page : imprimer l'écran donnerait
   * un autre papier. Un navigateur qui refuse d'imprimer le cadre (lecteur
   * PDF externe, mobile) reçoit le PDF dans un onglet, où il s'imprime.
   */
  function imprimer() {
    if (!generation.data) return;
    try {
      cadre.current?.contentWindow?.focus();
      cadre.current?.contentWindow?.print();
    } catch {
      window.open(generation.data.url, "_blank", "noopener");
    }
  }

  const ouverte = generation.isPending || generation.isError || generation.isSuccess;

  const indicateur = (
    <Dialog open={ouverte} onOpenChange={(ouvert) => !ouvert && !generation.isPending && generation.reset()}>
      <DialogContent
        className={generation.isSuccess ? "flex h-[90vh] flex-col sm:max-w-[960px]" : "sm:max-w-[420px]"}
        showCloseButton={!generation.isPending}
      >
        <DialogHeader>
          <DialogTitle>{t("generation.titre")}</DialogTitle>
          <DialogDescription>
            {generation.isPending
              ? t("generation.enCours")
              : generation.isSuccess
                ? t("generation.apercu")
                : t("generation.echec")}
          </DialogDescription>
        </DialogHeader>

        {generation.isSuccess ? (
          <>
            <iframe
              ref={cadre}
              src={generation.data.url}
              title={t("generation.titreApercu")}
              className="min-h-0 w-full flex-1 rounded-md border border-solid border-neutral-200 bg-neutral-100"
            />
            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={() => generation.reset()}>
                {t("generation.fermer")}
              </Button>
              <Button type="button" variant="outline" onClick={telecharger}>
                <Download aria-hidden="true" />
                {t("generation.telecharger")}
              </Button>
              <Button type="button" onClick={imprimer}>
                <Printer aria-hidden="true" />
                {t("generation.imprimer")}
              </Button>
            </DialogFooter>
          </>
        ) : generation.isPending ? (
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

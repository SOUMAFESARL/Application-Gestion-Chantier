"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleX, Download, LoaderCircle, Maximize2, Printer } from "lucide-react";
import Link from "next/link";
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
import { listerAvenants } from "@/features/avenants/adaptateur";
import { cleAvenants } from "@/features/avenants/cles";
import { indicateursJournalProjet } from "@/features/chantier";
import { lireJournal } from "@/features/chantier/adaptateur";
import { CLE_JOURNAL } from "@/features/chantier/cles";
import { lireEntreprise } from "@/features/configuration/api";
import { lireArbre } from "@/features/decoupage/adaptateur";
import { cleArbre } from "@/features/decoupage/cles";
import { lireDocumentsOuNull } from "@/features/documents/adaptateur";
import { useIdentitePlateforme } from "@/features/plateforme/hooks";
import { listerEquipes, listerLots } from "@/features/projets/adaptateur";
import { cleEquipes, cleLots } from "@/features/projets/cles";
import { REFERENTIEL_TYPES_PROJET, useReferentiel } from "@/features/projets/referentiels";
import type { Projet } from "@/features/projets/types";
import { chargerImagePdf, genererDocumentPdf } from "@/lib/export/documentPdf";

import { contenuFicheProjet, lotsDepuisArbre } from "./contenuFichePdf";

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

export function useGenerationFicheProjet(projet: Projet | undefined) {
  const t = useTranslations("ficheProjet.pdf");
  const tProjets = useTranslations("projets");
  const tMarque = useTranslations("marque");
  const { libelle: libelleType } = useReferentiel(REFERENTIEL_TYPES_PROJET);
  const client = useQueryClient();
  const identite = useIdentitePlateforme().data;

  const cadre = useRef<HTMLIFrameElement>(null);

  const generation = useMutation({
    mutationFn: async (cible: Projet): Promise<ApercuPdf> => {
      const maintenant = new Date();
      const note = cible.informationsComplementaires?.note_cp ?? "";
      const [lotsApi, arbre, avenants, equipes, journal, entreprise, documents] = await Promise.all([
        client
          .fetchQuery({
            queryKey: cleLots(cible.id),
            queryFn: ({ signal }) => listerLots(cible.id, signal),
          })
          .catch(() => []),
        ouNull(
          client.fetchQuery({
            queryKey: cleArbre(cible.id),
            queryFn: ({ signal }) => lireArbre(cible.id, signal),
          }),
        ),
        ouNull(
          client.fetchQuery({
            queryKey: cleAvenants(cible.id),
            queryFn: ({ signal }) => listerAvenants(cible.id, signal),
          }),
        ),
        ouNull(
          client.fetchQuery({
            queryKey: cleEquipes(cible.id),
            queryFn: ({ signal }) => listerEquipes(cible.id, signal),
          }),
        ),
        ouNull(
          client.fetchQuery({
            queryKey: CLE_JOURNAL,
            queryFn: ({ signal }) => lireJournal(signal),
          }),
        ),
        ouNull(lireEntreprise()),
        lireDocumentsOuNull(),
      ]);
      const lots =
        lotsApi.length > 0
          ? lotsApi
          : arbre && arbre.cases.length > 0
            ? lotsDepuisArbre(cible.id, arbre.cases)
            : [];
      const logo = await chargerImagePdf(entreprise?.logo_original ?? entreprise?.logo);

      const contenu = contenuFicheProjet((cle, valeurs) => t(cle, valeurs), {
        projet: cible,
        lots,
        avenants,
        equipes,
        journal: journal
          ? indicateursJournalProjet(journal.entrees, cible.id, journal.aujourdhui)
          : null,
        entreprise,
        logo,
        documents,
        note,
        marque: identite?.nom || tMarque("nom"),
        libelles: {
          natureProjet: (nature) => tProjets(`natureProjet.${nature}`),
          typeProjet: (type) => libelleType(type),
          statutProjet: (statut) => tProjets(`statut.${statut}`),
          typeBordereau: (type) => tProjets(`tiroirCreation.typeBordereau.${type}`),
          statutActivite: (statut) => tProjets(`lotsActivites.statutActivite.${statut}`),
          fonctionAutreMembre: (fonction) =>
            tProjets(`encadrement.fonctionAutreMembre.${fonction}`),
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
    if (projet && !generation.isPending) {
      generation.mutate(projet);
    }
  }

  function telecharger() {
    if (!generation.data) return;
    const lien = document.createElement("a");
    lien.href = generation.data.url;
    lien.download = generation.data.nomFichier;
    lien.click();
  }

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
    <Dialog
      open={ouverte}
      onOpenChange={(ouvert) => !ouvert && !generation.isPending && generation.reset()}
    >
      <DialogContent
        className={
          generation.isSuccess
            ? "flex h-[90vh] flex-col sm:max-w-[960px]"
            : "sm:max-w-[420px]"
        }
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
            <DialogFooter className="gap-3 sm:justify-between">
              {projet && (
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  onClick={() => generation.reset()}
                >
                  <Link href={`/projets/${projet.id}/fiche`}>
                    <Maximize2 aria-hidden="true" />
                    {t("generation.ouvrirPleinePage")}
                  </Link>
                </Button>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
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
              </div>
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

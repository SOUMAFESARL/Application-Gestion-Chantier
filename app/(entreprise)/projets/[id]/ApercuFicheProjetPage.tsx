"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CircleX, Download, LoaderCircle, Printer } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { listerAvenants } from "@/features/avenants/adaptateur";
import { cleAvenants } from "@/features/avenants/cles";
import type { Avenant } from "@/features/avenants/types";
import { indicateursJournalProjet } from "@/features/chantier";
import { lireJournal } from "@/features/chantier/adaptateur";
import { CLE_JOURNAL } from "@/features/chantier/cles";
import { lireEntreprise } from "@/features/configuration/api";
import { lireArbre } from "@/features/decoupage/adaptateur";
import { cleArbre } from "@/features/decoupage/cles";
import { lireDocumentsOuNull } from "@/features/documents/adaptateur";
import { useIdentitePlateforme } from "@/features/plateforme/hooks";
import { lireProjet, listerEquipes, listerLots } from "@/features/projets/adaptateur";
import { cleEquipes, cleLots, cleProjet } from "@/features/projets/cles";
import { REFERENTIEL_TYPES_PROJET, useReferentiel } from "@/features/projets/referentiels";
import type { Lot, Projet } from "@/features/projets/types";
import { chargerImagePdf, genererDocumentPdf } from "@/lib/export/documentPdf";

import { contenuFicheProjet, lotsDepuisArbre } from "./contenuFichePdf";

function declencherTelechargement(blob: Blob, nomFichier: string) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

/**
 * Prévisualisation pleine page (`/projets/[id]/fiche`) de la fiche projet :
 * génère automatiquement et affiche directement le document PDF intégré pleine page,
 * avec barre d'outils collante (retour, référence, téléchargement, impression).
 */
export function ApercuFicheProjetPage({ projetId }: { projetId: string }) {
  const t = useTranslations("ficheProjet.pdf");
  const tApercu = useTranslations("ficheProjet.apercuPage");
  const tProjets = useTranslations("projets");
  const tMarque = useTranslations("marque");
  const { libelle: libelleType } = useReferentiel(REFERENTIEL_TYPES_PROJET);
  const identite = useIdentitePlateforme().data;

  const cadrePdfRef = useRef<HTMLIFrameElement>(null);

  const requeteProjet = useQuery({
    queryKey: cleProjet(projetId),
    queryFn: () => lireProjet(projetId),
  });
  const requeteLots = useQuery({
    queryKey: cleLots(projetId),
    queryFn: ({ signal }) => listerLots(projetId, signal),
  });
  const requeteArbre = useQuery({
    queryKey: cleArbre(projetId),
    queryFn: ({ signal }) => lireArbre(projetId, signal),
  });
  const requeteAvenants = useQuery({
    queryKey: cleAvenants(projetId),
    queryFn: ({ signal }) => listerAvenants(projetId, signal),
  });
  const requeteEquipes = useQuery({
    queryKey: cleEquipes(projetId),
    queryFn: ({ signal }) => listerEquipes(projetId, signal),
  });
  const requeteJournal = useQuery({
    queryKey: CLE_JOURNAL,
    queryFn: ({ signal }) => lireJournal(signal),
  });
  const requeteEntreprise = useQuery({
    queryKey: ["entreprise-configuration"],
    queryFn: lireEntreprise,
  });
  const requeteDocuments = useQuery({
    queryKey: ["entreprise-documents-pdf"],
    queryFn: lireDocumentsOuNull,
  });

  const projet = requeteProjet.data;
  const noteCp = projet?.informationsComplementaires?.note_cp ?? "";

  const donneesPretes =
    Boolean(projet) &&
    !requeteLots.isPending &&
    !requeteArbre.isPending &&
    !requeteAvenants.isPending &&
    !requeteEquipes.isPending &&
    !requeteJournal.isPending &&
    !requeteEntreprise.isPending &&
    !requeteDocuments.isPending;

  const lots = useMemo<Lot[]>(() => {
    const lotsApi = requeteLots.data ?? [];
    if (lotsApi.length > 0) return lotsApi;
    if (requeteArbre.data && requeteArbre.data.cases.length > 0) {
      return lotsDepuisArbre(projetId, requeteArbre.data.cases);
    }
    return [];
  }, [projetId, requeteArbre.data, requeteLots.data]);

  const avenants = useMemo<Avenant[]>(() => requeteAvenants.data ?? [], [requeteAvenants.data]);
  const equipes = requeteEquipes.data ?? null;
  const entreprise = requeteEntreprise.data ?? null;
  const documents = requeteDocuments.data ?? null;
  const journalIndicateurs = useMemo(() => {
    if (!requeteJournal.data || !projet) return null;
    return indicateursJournalProjet(
      requeteJournal.data.entrees,
      projet.id,
      requeteJournal.data.aujourdhui,
    );
  }, [projet, requeteJournal.data]);

  const marque = identite?.nom || tMarque("nom");

  const construireDocumentPdf = useCallback(
    async (cible: Projet, noteTexte: string, horodatage: Date) => {
      const logo = await chargerImagePdf(entreprise?.logo_original ?? entreprise?.logo);
      const contenu = contenuFicheProjet((cle, valeurs) => t(cle, valeurs), {
        projet: cible,
        lots,
        avenants,
        equipes,
        journal: journalIndicateurs,
        entreprise,
        logo,
        documents,
        note: noteTexte,
        marque,
        libelles: {
          natureProjet: (nature) => tProjets(`natureProjet.${nature}`),
          typeProjet: (type) => libelleType(type),
          statutProjet: (statut) => tProjets(`statut.${statut}`),
          typeBordereau: (type) => tProjets(`tiroirCreation.typeBordereau.${type}`),
          statutActivite: (statut) => tProjets(`lotsActivites.statutActivite.${statut}`),
          fonctionAutreMembre: (fonction) =>
            tProjets(`encadrement.fonctionAutreMembre.${fonction}`),
        },
        maintenant: horodatage,
      });
      const blob = await genererDocumentPdf(contenu);
      return {
        blob,
        url: URL.createObjectURL(blob),
        nomFichier: contenu.nomFichier,
      };
    },
    [
      avenants,
      documents,
      entreprise,
      equipes,
      journalIndicateurs,
      libelleType,
      lots,
      marque,
      t,
      tProjets,
    ],
  );

  const generationPdf = useMutation({
    mutationFn: async ({
      cible,
      noteTexte,
      horodatage,
    }: {
      cible: Projet;
      noteTexte: string;
      horodatage: Date;
    }) => construireDocumentPdf(cible, noteTexte, horodatage),
  });

  const urlPdf = generationPdf.data?.url;
  useEffect(() => {
    if (!urlPdf) return;
    return () => URL.revokeObjectURL(urlPdf);
  }, [urlPdf]);

  const lancerGenerationPdf = useCallback(
    (cible: Projet, noteTexte: string) => {
      generationPdf.mutate({ cible, noteTexte, horodatage: new Date() });
    },
    // `generationPdf.mutate` est stable (React Query) : éviter la boucle sur l'objet mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (
      donneesPretes &&
      projet &&
      !generationPdf.data &&
      !generationPdf.isPending &&
      !generationPdf.isError
    ) {
      lancerGenerationPdf(projet, noteCp);
    }
  }, [
    donneesPretes,
    generationPdf.data,
    generationPdf.isError,
    generationPdf.isPending,
    lancerGenerationPdf,
    noteCp,
    projet,
  ]);

  async function telechargerPdf() {
    if (!projet) return;
    if (generationPdf.data) {
      declencherTelechargement(generationPdf.data.blob, generationPdf.data.nomFichier);
      return;
    }
    try {
      const sortie = await construireDocumentPdf(projet, noteCp, new Date());
      declencherTelechargement(sortie.blob, sortie.nomFichier);
      URL.revokeObjectURL(sortie.url);
    } catch {
      toast.error(t("generation.erreur"));
    }
  }

  function imprimer() {
    if (!generationPdf.data) return;
    try {
      cadrePdfRef.current?.contentWindow?.focus();
      cadrePdfRef.current?.contentWindow?.print();
    } catch {
      window.open(generationPdf.data.url, "_blank", "noopener");
    }
  }

  if (requeteProjet.isPending) {
    return <EtatChargement />;
  }

  if (requeteProjet.isError || !projet) {
    return <EtatErreur onReessayer={() => void requeteProjet.refetch()} />;
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-6">
      {/* Barre d'outils collante */}
      <div className="sticky top-16 z-30 -mx-2 -mt-3 flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-neutral-200 bg-neutral-0/95 px-3 py-3 backdrop-blur-xs sm:-mx-6 sm:-mt-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={`/projets/${projet.id}`}>
              <ArrowLeft aria-hidden="true" />
              {tApercu("retourFiche")}
            </Link>
          </Button>
          <span className="hidden text-sm font-semibold text-neutral-900 sm:inline">
            {projet.reference}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void telechargerPdf()}
            disabled={!donneesPretes || generationPdf.isPending}
          >
            <Download aria-hidden="true" />
            {tApercu("telechargerPdf")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={imprimer}
            disabled={!generationPdf.data}
          >
            <Printer aria-hidden="true" />
            {tApercu("imprimer")}
          </Button>
        </div>
      </div>

      <section className="w-full">
        {(!donneesPretes || generationPdf.isPending) && (
          <div
            className="flex h-[calc(100vh-9.5rem)] min-h-[540px] flex-col items-center justify-center gap-3 rounded-lg border border-solid border-neutral-200 bg-neutral-50"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle className="size-8 animate-spin text-primary-600" aria-hidden="true" />
            <p className="m-0 text-sm text-neutral-600">{tApercu("generationPdfEnCours")}</p>
          </div>
        )}
        {donneesPretes && generationPdf.isError && (
          <Alert variant="erreur">
            <CircleX />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{tApercu("generationPdfErreur")}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => lancerGenerationPdf(projet, noteCp)}
              >
                {tApercu("reessayer")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {generationPdf.data && (
          <iframe
            ref={cadrePdfRef}
            src={generationPdf.data.url}
            title={t("generation.titreApercu")}
            className="h-[calc(100vh-9.5rem)] min-h-[540px] w-full rounded-lg border border-solid border-neutral-200 bg-neutral-100 shadow-sm"
          />
        )}
      </section>
    </div>
  );
}

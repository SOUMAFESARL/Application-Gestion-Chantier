"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CircleX,
  Download,
  FileDown,
  FileSignature,
  FileText,
  LayoutList,
  LoaderCircle,
  Printer,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Badge, EtatChargement, EtatErreur } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listerAvenants, telechargerDocumentAvenant, telechargerOrdreServiceAvenant } from "@/features/avenants/adaptateur";
import { cleAvenants } from "@/features/avenants/cles";
import type { Avenant } from "@/features/avenants/types";
import { indicateursJournalProjet } from "@/features/chantier";
import { lireJournal } from "@/features/chantier/adaptateur";
import { CLE_JOURNAL } from "@/features/chantier/cles";
import { lireEntreprise } from "@/features/configuration/api";
import { lireArbre } from "@/features/decoupage/adaptateur";
import { cleArbre } from "@/features/decoupage/cles";
import { MONTANT_MASQUE } from "@/features/decoupage/components/CellulesCase";
import { lireDocumentsOuNull } from "@/features/documents/adaptateur";
import { useDroits } from "@/features/habilitations";
import { useIdentitePlateforme } from "@/features/plateforme/hooks";
import {
  lireProjet,
  listerEquipes,
  listerLots,
  telechargerContratProjet,
  telechargerOrdreServiceProjet,
} from "@/features/projets/adaptateur";
import { cleEquipes, cleLots, cleProjet } from "@/features/projets/cles";
import { REFERENTIEL_TYPES_PROJET, useReferentiel } from "@/features/projets/referentiels";
import {
  aProlongationContractuelle,
  avancementLot,
  budgetEnVigueur,
  budgetRestant,
  dureeContractuelleTotale,
  ecartAvancement,
  echeancierProjet,
  effectifProjet,
  estEnRetard,
  financierDuProjet,
  largeurJauge,
  libelleDelta,
  libelleRoleEncadrementMembre,
  niveauBudget,
  nomFichierSansExtension,
  pointsDeVigilance,
  precisionChefChantier,
  ratioConsommationBudget,
  statutLot,
} from "@/features/projets/regles";
import type { Intervenant, Lot, Projet } from "@/features/projets/types";
import { afficherTelephone } from "@/features/referentiels/telephone";
import { chargerImagePdf, genererDocumentPdf } from "@/lib/export/documentPdf";
import {
  ABSENT,
  couleurIndiceSante,
  formaterDate,
  formaterDateHeure,
  formaterDuree,
  formaterDureeCalendaire,
  formaterMontant,
  formaterPourcentage,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { BADGE_STATUT, TON_SANTE, TON_STATUT } from "../classes";
import {
  contenuFicheProjet,
  emetteurDocument,
  libelleEcheance,
  lotsDepuisArbre,
  pointVigilance,
} from "./contenuFichePdf";

type ModeApercu = "synthese" | "pdf";

const CLASSE_SECTION_A4 =
  "bg-secondary-800 px-3 py-1.5 text-xs font-bold tracking-wider text-neutral-0 uppercase print:bg-secondary-800";

const CLASSE_CELLULE_ENTETE =
  "border-0 border-b border-solid border-neutral-200 bg-secondary-800 px-2.5 py-2 text-left text-xs font-semibold text-neutral-0";

const CLASSE_CELLULE =
  "border-0 border-b border-solid border-neutral-200 px-2.5 py-2 align-top text-xs text-neutral-800";

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
 * - Barre d'outils collante masquée à l'impression (`print:hidden`)
 * - Vue synthétique A4 centrée et imprimable (`window.print()`)
 * - Aperçu PDF intégré pleine hauteur (`h-[calc(100vh-11rem)]`)
 */
export function ApercuFicheProjetPage({ projetId }: { projetId: string }) {
  const t = useTranslations("ficheProjet.pdf");
  const tApercu = useTranslations("ficheProjet.apercuPage");
  const tProjets = useTranslations("projets");
  const tMarque = useTranslations("marque");
  const { libelle: libelleType } = useReferentiel(REFERENTIEL_TYPES_PROJET);
  const { voitMontants } = useDroits();
  const identite = useIdentitePlateforme().data;

  const [mode, setMode] = useState<ModeApercu>("synthese");
  const [noteModifiee, setNoteModifiee] = useState<string | null>(null);
  const [noteAppliquee, setNoteAppliquee] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState<Date>(() => new Date());
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
  const noteParDefaut = projet?.informationsComplementaires?.note_cp ?? "";
  const noteSaisie = noteModifiee ?? noteParDefaut;
  const noteCourante = noteAppliquee ?? noteSaisie;

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
    (noteTexte: string, horodatage: Date) => {
      if (!projet) return;
      generationPdf.mutate({ cible: projet, noteTexte, horodatage });
    },
    // `generationPdf.mutate` est stable (React Query) : éviter la boucle sur l'objet mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projet],
  );

  useEffect(() => {
    if (mode === "pdf" && projet && !generationPdf.data && !generationPdf.isPending && !generationPdf.isError) {
      lancerGenerationPdf(noteCourante, maintenant);
    }
  }, [
    generationPdf.data,
    generationPdf.isError,
    generationPdf.isPending,
    lancerGenerationPdf,
    maintenant,
    mode,
    noteCourante,
    projet,
  ]);

  function actualiserFiche() {
    const nouvelleDate = new Date();
    setMaintenant(nouvelleDate);
    setNoteAppliquee(noteSaisie);
    if (mode === "pdf" || generationPdf.data) {
      lancerGenerationPdf(noteSaisie, nouvelleDate);
    }
  }

  async function telechargerPdf() {
    if (!projet) return;
    try {
      const sortie = await construireDocumentPdf(projet, noteSaisie, new Date());
      declencherTelechargement(sortie.blob, sortie.nomFichier);
      URL.revokeObjectURL(sortie.url);
    } catch {
      toast.error(t("generation.erreur"));
    }
  }

  function imprimer() {
    if (mode === "synthese") {
      window.print();
      return;
    }
    if (generationPdf.data) {
      try {
        cadrePdfRef.current?.contentWindow?.focus();
        cadrePdfRef.current?.contentWindow?.print();
      } catch {
        window.open(generationPdf.data.url, "_blank", "noopener");
      }
    }
  }

  if (requeteProjet.isPending) {
    return <EtatChargement />;
  }

  if (requeteProjet.isError || !projet) {
    return <EtatErreur onReessayer={() => void requeteProjet.refetch()} />;
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-8 print:gap-0 print:pb-0">
      {/* Barre d'outils collante (masquée à l'impression) */}
      <div className="sticky top-16 z-30 -mx-2 -mt-3 flex flex-col gap-3 border-0 border-b border-solid border-neutral-200 bg-neutral-0/95 px-3 py-3 backdrop-blur-xs sm:-mx-6 sm:-mt-6 sm:px-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            <div
              className="inline-flex rounded-md border border-solid border-neutral-200 bg-neutral-50 p-0.5"
              role="group"
              aria-label={tApercu("modeSynthese")}
            >
              <Button
                type="button"
                size="sm"
                variant={mode === "synthese" ? "default" : "ghost"}
                onClick={() => setMode("synthese")}
              >
                <LayoutList aria-hidden="true" />
                {tApercu("modeSynthese")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "pdf" ? "default" : "ghost"}
                onClick={() => setMode("pdf")}
              >
                <FileText aria-hidden="true" />
                {tApercu("modePdf")}
              </Button>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={() => void telechargerPdf()}>
              <Download aria-hidden="true" />
              {tApercu("telechargerPdf")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={imprimer}
              disabled={mode === "pdf" && !generationPdf.data}
            >
              <Printer aria-hidden="true" />
              {tApercu("imprimer")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-solid border-neutral-200 bg-neutral-50 p-2.5">
          <div className="flex min-w-60 flex-1 flex-col gap-1">
            <Label htmlFor="apercu-note-cp" className="text-xs font-semibold text-neutral-700">
              {tApercu("noteLabel")}
            </Label>
            <Textarea
              id="apercu-note-cp"
              rows={2}
              value={noteSaisie}
              placeholder={tApercu("notePlaceholder")}
              onChange={(e) => setNoteModifiee(e.target.value)}
              className="bg-neutral-0 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={actualiserFiche}
            disabled={generationPdf.isPending}
          >
            {generationPdf.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            {tApercu("actualiser")}
          </Button>
        </div>
      </div>

      {mode === "pdf" ? (
        <section className="w-full">
          {generationPdf.isPending && (
            <div
              className="flex h-[calc(100vh-11rem)] flex-col items-center justify-center gap-3 rounded-lg border border-solid border-neutral-200 bg-neutral-50"
              role="status"
              aria-live="polite"
            >
              <LoaderCircle className="size-8 animate-spin text-primary-600" aria-hidden="true" />
              <p className="m-0 text-sm text-neutral-600">{tApercu("generationPdfEnCours")}</p>
            </div>
          )}
          {generationPdf.isError && (
            <Alert variant="erreur">
              <CircleX />
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{tApercu("generationPdfErreur")}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => lancerGenerationPdf(noteCourante, maintenant)}
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
              className="h-[calc(100vh-11rem)] w-full rounded-lg border border-solid border-neutral-200 bg-neutral-100 shadow-sm"
            />
          )}
        </section>
      ) : (
        <FeuilleSynthetiqueA4
          projet={projet}
          lots={lots}
          avenants={avenants}
          equipes={equipes}
          journal={journalIndicateurs}
          entreprise={entreprise}
          documents={documents}
          marque={marque}
          note={noteSaisie}
          maintenant={maintenant}
          voitMontants={voitMontants}
          libelleType={libelleType}
        />
      )}
    </div>
  );
}

interface PropsFeuilleA4 {
  projet: Projet;
  lots: Lot[];
  avenants: Avenant[];
  equipes: ReturnType<typeof listerEquipes> extends Promise<infer T> ? T | null : never;
  journal: ReturnType<typeof indicateursJournalProjet> | null;
  entreprise: Awaited<ReturnType<typeof lireEntreprise>> | null;
  documents: Awaited<ReturnType<typeof lireDocumentsOuNull>> | null;
  marque: string;
  note: string;
  maintenant: Date;
  voitMontants: boolean;
  libelleType: (type: string) => string;
}

function FeuilleSynthetiqueA4({
  projet,
  lots,
  avenants,
  equipes,
  journal,
  entreprise,
  documents,
  marque,
  note,
  maintenant,
  voitMontants,
  libelleType,
}: PropsFeuilleA4) {
  const tFiche = useTranslations("ficheProjet");
  const tApercu = useTranslations("ficheProjet.apercuPage");
  const t = useTranslations("ficheProjet.pdf");
  const tProjets = useTranslations("projets");

  const infos = projet.informationsComplementaires ?? {};
  const estPublic = projet.natureProjet === "PUBLIC";
  const lieu = [projet.quartier, projet.ville].filter(Boolean).join(", ");
  const genereLe = formaterDateHeure(maintenant);
  const { emetteur, pied } = emetteurDocument(entreprise, marque);
  const urlLogo = documents
    ? documents.entete.logoUrl
    : entreprise?.logo_original || entreprise?.logo || null;

  const sante = couleurIndiceSante(projet.indiceSante);
  const ecart = ecartAvancement(projet.avancementReel, projet.avancementTheorique);
  const retard = estEnRetard(ecart);
  const deltaInfo = libelleDelta(projet.deltaRetard);

  const echeancier = echeancierProjet(projet, maintenant);
  const dureeTotale = dureeContractuelleTotale(projet);
  const aProlongation = aProlongationContractuelle(projet);
  const libelleProlongation = aProlongation
    ? tFiche("calendrier.avenantsDelai", {
        duree: formaterDureeCalendaire({
          annees: projet.prolongationAnnees,
          mois: projet.prolongationMois,
          jours: projet.prolongationJours,
        }),
      })
    : null;
  const budgetInitialMarche =
    projet.syntheseAvenantsDelai?.montantMarcheInitial ??
    projet.budgetContractuelInitial ??
    projet.budgetInitial;
  const cumulAvenants =
    projet.syntheseAvenantsDelai?.montantAvenants ?? projet.montantAvenants;
  const budgetActuel = budgetEnVigueur(projet);
  const ratioBudget = ratioConsommationBudget(budgetActuel, projet.budgetConsomme);
  const nivBudget = niveauBudget(ratioBudget);
  const restant = budgetRestant(projet);

  const contratActif = projet.contratActif ?? projet.contrats[0] ?? null;
  const contactDepuisMoa = [
    projet.client.telephone ? afficherTelephone(projet.client.telephone) : null,
    projet.client.email,
  ]
    .filter(Boolean)
    .join(" · ");
  const contactClient = contactDepuisMoa || infos.contact?.trim() || "";
  const phaseCourante = infos.phase?.trim() || projet.phaseActuelle || "";

  const nomOuAbsent = (intervenant: Intervenant | null) =>
    intervenant ? intervenant.nomComplet || intervenant.email : t("equipe.nonDesigne");

  const membres: { role: string; nom: string; tel: string; email: string }[] = [];
  if (infos.coordonnateur?.nom?.trim()) {
    membres.push({
      role: t("equipe.coordonnateur"),
      nom: infos.coordonnateur.nom.trim(),
      tel: infos.coordonnateur.tel?.trim()
        ? afficherTelephone(infos.coordonnateur.tel.trim())
        : ABSENT,
      email: infos.coordonnateur.email?.trim() || ABSENT,
    });
  }
  const ajouterMembre = (role: string, intervenant: Intervenant | null) => {
    membres.push({
      role,
      nom: intervenant ? nomOuAbsent(intervenant) : t("equipe.nonDesigne"),
      tel: intervenant?.telephone ? afficherTelephone(intervenant.telephone) : ABSENT,
      email: intervenant?.email || ABSENT,
    });
  };
  ajouterMembre(t("equipe.chefProjet"), projet.chefProjet);
  if (projet.conducteursTravaux.length > 0) {
    for (const ct of projet.conducteursTravaux) {
      ajouterMembre(t("equipe.conducteurTravaux"), ct);
    }
  } else {
    ajouterMembre(t("equipe.conducteurTravaux"), null);
  }
  for (const chef of projet.chefsChantier) {
    const precision = precisionChefChantier(chef);
    ajouterMembre(
      precision ? t("equipe.chefChantierZone", { zone: precision }) : t("equipe.chefChantier"),
      chef.intervenant,
    );
  }
  for (const membre of projet.autresMembres) {
    const roleReel =
      libelleRoleEncadrementMembre(membre) ||
      (membre.fonction && membre.fonction !== "AUTRE"
        ? tProjets(`encadrement.fonctionAutreMembre.${membre.fonction}`)
        : t("equipe.membreEncadrement"));
    ajouterMembre(roleReel, membre.intervenant);
  }

  const intervenantsExternes =
    infos.intervenants && infos.intervenants.length > 0
      ? infos.intervenants.map((intv) => ({
          role: intv.role,
          org: intv.org,
          perimetre: intv.perimetre || intv.lot,
        }))
      : projet.intervenantsExternes.map((intv) => ({
          role: intv.role,
          org: intv.org || intv.nom,
          perimetre: intv.perimetre,
        }));

  const pointsVigilance = pointsDeVigilance(projet, lots, maintenant).map((pt) =>
    pointVigilance((cle, valeurs) => t(cle, valeurs), pt),
  );
  if (journal && journal.blocages > 0) {
    pointsVigilance.push({
      texte: t("vigilance.BLOCAGES", { nombre: journal.blocages }),
      ton: "avertissement",
    });
  }

  const texteNote = note.trim();
  const mentionsEntete = documents?.entete.lignes ?? [];
  const mentionsPied = documents?.pied.lignes ?? [];
  const financier = financierDuProjet(projet);

  async function telechargerOsDemarrage() {
    if (!projet.ordreService) return;
    try {
      const blob = await telechargerOrdreServiceProjet(projet.id);
      declencherTelechargement(blob, projet.ordreService.nom || `ordre-service-${projet.reference}`);
    } catch {
      toast.error(tApercu("erreurTelechargement"));
    }
  }

  async function telechargerContrat() {
    if (!contratActif) return;
    try {
      const blob = await telechargerContratProjet(projet.id, contratActif.id);
      declencherTelechargement(blob, contratActif.nom);
    } catch {
      toast.error(tApercu("erreurTelechargement"));
    }
  }

  async function telechargerDocAvenant(av: Avenant) {
    try {
      const blob = await telechargerDocumentAvenant(av.id);
      declencherTelechargement(blob, av.document?.nom || `avenant-${av.numero}`);
    } catch {
      toast.error(tApercu("erreurTelechargement"));
    }
  }

  async function telechargerOsAvenant(av: Avenant) {
    try {
      const blob = await telechargerOrdreServiceAvenant(av.id);
      declencherTelechargement(blob, av.ordreService?.nom || `ordre-service-avenant-${av.numero}`);
    } catch {
      toast.error(tApercu("erreurTelechargement"));
    }
  }

  const tonBadgeSante =
    sante === "vert"
      ? "succes"
      : sante === "orange"
        ? "avertissement"
        : sante === "rouge"
          ? "erreur"
          : "neutre";

  const classeConsommation = nivBudget === "depassement" ? "text-erreur" : "text-succes";
  const classeRestant = restant !== null && restant < 0 ? "text-erreur" : undefined;
  const classeEcheance =
    echeancier.joursRestants !== null && echeancier.joursRestants < 0 ? "text-erreur" : undefined;
  const classeAvenants = cumulAvenants > 0 ? "text-primary-700" : undefined;
  const classeProlongation = "text-primary-700";

  return (
    <article className="mx-auto flex w-full max-w-[210mm] flex-col gap-4 rounded-lg border border-solid border-neutral-200 bg-neutral-0 p-6 text-neutral-900 shadow-md sm:p-10 print:max-w-none print:gap-3 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {/* En-tête entreprise */}
      <header className="flex flex-col gap-3 border-0 border-b-2 border-solid border-primary-600 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {urlLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlLogo}
                alt={emetteur}
                className="max-h-14 max-w-36 object-contain"
              />
            ) : (
              <div className="flex h-12 min-w-28 items-center justify-center rounded-md bg-primary-600 px-3 text-center text-xs font-bold text-neutral-0">
                {emetteur}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-neutral-900">{emetteur}</span>
              {mentionsEntete.length > 0 && (
                <div className="flex flex-col text-[11px] text-neutral-600">
                  {mentionsEntete.map((ligne, idx) => (
                    <span key={idx}>{ligne}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <h1 className="m-0 text-base font-bold tracking-wide text-secondary-800 uppercase">
              {tApercu("enteteOfficielle")}
            </h1>
            <span className="text-xs text-neutral-600">
              {t("dateGeneration", { date: genereLe })}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1 text-right">
            <span className="rounded bg-secondary-800 px-2.5 py-0.5 font-mono text-xs font-bold text-neutral-0">
              {projet.reference}
            </span>
            <span className="text-xs font-bold text-primary-600">{marque}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 text-lg font-bold text-neutral-900">{projet.nom}</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {projet.natureProjet && (
                <Badge variante={estPublic ? "secondaire" : "primaire"}>
                  {tProjets(`natureProjet.${projet.natureProjet}`)}
                </Badge>
              )}
              {projet.typeProjet && (
                <Badge variante="neutre">{libelleType(projet.typeProjet)}</Badge>
              )}
              {phaseCourante && <Badge variante="neutre">{phaseCourante}</Badge>}
              <Badge variante={TON_STATUT[projet.statut]}>
                {tProjets(`statut.${projet.statut}`)}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Identification, localisation & OS de démarrage */}
      <section className="flex flex-col gap-2">
        <h3 className={CLASSE_SECTION_A4}>{t("sections.identification")}</h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-md border border-solid border-neutral-200 p-3 sm:grid-cols-2 print:grid-cols-2">
          <PaireCleValeur libelle={t("identification.reference")} valeur={projet.reference} />
          <PaireCleValeur
            libelle={
              estPublic ? t("identification.maitreOuvrage") : t("identification.client")
            }
            valeur={projet.client.raisonSociale}
          />
          <PaireCleValeur
            libelle={t("identification.contactClient")}
            valeur={contactClient || ABSENT}
          />
          <PaireCleValeur
            libelle={t("identification.maitreOeuvre")}
            valeur={projet.maitreOeuvre ?? t("identification.nonRenseigne")}
          />
          <PaireCleValeur
            libelle={t("identification.localisation")}
            valeur={lieu || ABSENT}
          />
          {infos.region?.trim() && (
            <PaireCleValeur libelle={t("identification.region")} valeur={infos.region} />
          )}
          <PaireCleValeur
            libelle={t("identification.ordreService")}
            valeur={
              projet.ordreService ? (
                <span className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void telechargerOsDemarrage()}
                    className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left text-xs font-semibold text-primary-600 hover:underline print:hidden"
                  >
                    <FileDown className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{projet.ordreService.nom}</span>
                  </button>
                  <span className="hidden print:inline">{projet.ordreService.nom}</span>
                </span>
              ) : (
                <span className="text-neutral-500">{tApercu("osDemarrageNonJoint")}</span>
              )
            }
          />
          <PaireCleValeur
            libelle={t("identification.contrats")}
            valeur={
              contratActif ? (
                <span className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void telechargerContrat()}
                    className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left text-xs font-semibold text-primary-600 hover:underline print:hidden"
                  >
                    <FileDown className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {contratActif.nomSansExtension || nomFichierSansExtension(contratActif.nom)}
                    </span>
                  </button>
                  <span className="hidden print:inline">
                    {contratActif.nomSansExtension || nomFichierSansExtension(contratActif.nom)}
                  </span>
                </span>
              ) : (
                t("identification.nonRenseigne")
              )
            }
          />
          {infos.tutelle?.trim() && (
            <PaireCleValeur libelle={t("identification.tutelle")} valeur={infos.tutelle} />
          )}
          {infos.delegue?.trim() && (
            <PaireCleValeur libelle={t("identification.delegue")} valeur={infos.delegue} />
          )}
          {infos.agence?.trim() && (
            <PaireCleValeur libelle={t("identification.agence")} valeur={infos.agence} />
          )}
          {infos.operateur?.trim() && (
            <PaireCleValeur libelle={t("identification.operateur")} valeur={infos.operateur} />
          )}
          {projet.description?.trim() && (
            <PaireCleValeur
              libelle={t("identification.description")}
              valeur={projet.description}
              large
            />
          )}
        </div>
      </section>

      {/* KPIs synthétiques */}
      <section className="flex flex-col gap-2">
        <h3 className={CLASSE_SECTION_A4}>{tApercu("kpisTitre")}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
          {/* KPI 1 : Avancement physique vs théorique */}
          <div className="flex flex-col gap-2 rounded-md border border-solid border-neutral-200 p-3">
            <span className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">
              {tApercu("avancementTitre")}
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span>{t("avancement.reel")}</span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    retard ? "text-avertissement" : "text-succes",
                  )}
                >
                  {formaterPourcentage(projet.avancementReel)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={cn("h-full rounded-full", retard ? "bg-avertissement" : "bg-succes")}
                  style={{ width: `${largeurJauge(projet.avancementReel)}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span>{t("avancement.theorique")}</span>
                <span className="font-bold text-secondary-800 tabular-nums">
                  {formaterPourcentage(projet.avancementTheorique)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-secondary-700"
                  style={{ width: `${largeurJauge(projet.avancementTheorique)}%` }}
                />
              </div>
            </div>
            {deltaInfo && (
              <span
                className={cn(
                  "text-[11px] font-medium",
                  retard ? "text-erreur" : "text-neutral-600",
                )}
              >
                {t(deltaInfo.cle, deltaInfo.params)}
              </span>
            )}
          </div>

          {/* KPI 2 : Indice de santé */}
          <div className="flex flex-col items-center justify-between gap-2 rounded-md border border-solid border-neutral-200 p-3 text-center">
            <span className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">
              {t("sante")}
            </span>
            <span className={cn("text-2xl font-bold tabular-nums", TON_SANTE[sante])}>
              {projet.indiceSante === null
                ? ABSENT
                : t("santeValeur", { valeur: projet.indiceSante })}
            </span>
            <Badge variante={tonBadgeSante}>{t(`santeNiveau.${sante}`)}</Badge>
          </div>

          {/* KPI 3 : Synthèse budgétaire */}
          <div className="flex flex-col gap-1.5 rounded-md border border-solid border-neutral-200 p-3">
            <span className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">
              {tApercu("budgetTitre")}
            </span>
            {voitMontants ? (
              <div className="flex flex-col gap-1 text-xs">
                <LigneKpi
                  libelle={t("budget.initial")}
                  valeur={
                    budgetInitialMarche === null
                      ? t("budget.nonDefini")
                      : formaterMontant(budgetInitialMarche)
                  }
                />
                <LigneKpi
                  libelle={t("budget.avenants")}
                  valeur={
                    cumulAvenants > 0
                      ? tApercu("cumulAvenantsBudget", {
                          montant: formaterMontant(cumulAvenants),
                        })
                      : formaterMontant(0)
                  }
                  className={classeAvenants}
                />
                <LigneKpi
                  libelle={t("budget.contractuel")}
                  valeur={budgetActuel === null ? ABSENT : formaterMontant(budgetActuel)}
                />
                <LigneKpi
                  libelle={t("budget.consomme")}
                  valeur={
                    ratioBudget !== null
                      ? `${formaterMontant(projet.budgetConsomme)} (${tApercu("pourcentageValeur", { valeur: ratioBudget })})`
                      : formaterMontant(projet.budgetConsomme)
                  }
                  className={classeConsommation}
                />
                {restant !== null && (
                  <LigneKpi
                    libelle={restant < 0 ? t("budget.depasse") : t("budget.restant")}
                    valeur={formaterMontant(Math.abs(restant))}
                    className={classeRestant}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-xs text-neutral-500">
                <span className="font-mono text-base font-bold">{MONTANT_MASQUE}</span>
                <span>{tApercu("montantMasque")}</span>
              </div>
            )}
          </div>

          {/* KPI 4 : Calendrier & délais */}
          <div className="flex flex-col gap-1.5 rounded-md border border-solid border-neutral-200 p-3">
            <span className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">
              {tApercu("calendrierTitre")}
            </span>
            <div className="flex flex-col gap-1 text-xs">
              <LigneKpi
                libelle={t("calendrier.debutPrevu")}
                valeur={formaterDate(projet.dateDebutContractuelle ?? projet.dateDebutPrevue)}
              />
              <LigneKpi
                libelle={t("calendrier.finPrevue")}
                valeur={formaterDate(projet.dateFinContractuelle ?? projet.dateFinPrevue)}
              />
              <LigneKpi
                libelle={t("calendrier.duree")}
                valeur={
                  dureeTotale
                    ? formaterDureeCalendaire(dureeTotale)
                    : formaterDuree(projet.duree ?? echeancier.duree)
                }
              />
              {libelleProlongation && (
                <LigneKpi
                  libelle={libelleProlongation}
                  valeur={formaterDate(projet.dateFinContractuelle)}
                  className={classeProlongation}
                />
              )}
              <LigneKpi
                libelle={t("calendrier.echeance")}
                valeur={libelleEcheance((cle, valeurs) => t(cle, valeurs), projet, echeancier.joursRestants)}
                className={classeEcheance}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Encadrement & équipes */}
      <section className="flex flex-col gap-2">
        <h3 className={CLASSE_SECTION_A4}>{t("sections.equipe")}</h3>
        <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={CLASSE_CELLULE_ENTETE}>{t("equipe.role")}</th>
                <th className={CLASSE_CELLULE_ENTETE}>{t("equipe.nom")}</th>
                <th className={CLASSE_CELLULE_ENTETE}>{t("equipe.telephone")}</th>
                <th className={CLASSE_CELLULE_ENTETE}>{t("equipe.email")}</th>
              </tr>
            </thead>
            <tbody>
              {membres.map((m, idx) => (
                <tr key={`${m.role}-${idx}`} className="even:bg-neutral-50">
                  <td className={cn(CLASSE_CELLULE, "font-semibold")}>{m.role}</td>
                  <td className={CLASSE_CELLULE}>{m.nom}</td>
                  <td className={cn(CLASSE_CELLULE, "whitespace-nowrap")}>{m.tel}</td>
                  <td className={CLASSE_CELLULE}>{m.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {intervenantsExternes.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("equipe.intervenants.role")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("equipe.intervenants.org")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("equipe.intervenants.lot")}</th>
                </tr>
              </thead>
              <tbody>
                {intervenantsExternes.map((intv, idx) => (
                  <tr key={`${intv.org}-${idx}`} className="even:bg-neutral-50">
                    <td className={cn(CLASSE_CELLULE, "font-semibold")}>{intv.role || ABSENT}</td>
                    <td className={CLASSE_CELLULE}>{intv.org || ABSENT}</td>
                    <td className={CLASSE_CELLULE}>{intv.perimetre || ABSENT}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {equipes && (
          <p className="m-0 text-xs text-neutral-600">
            {t("equipe.equipesChantier", {
              equipes: equipes.length,
              personnes: effectifProjet(equipes),
            })}
          </p>
        )}
      </section>

      {/* Tableau synthétique des lots / avancement */}
      <section className="flex flex-col gap-2">
        <h3 className={CLASSE_SECTION_A4}>{t("sections.avancement")}</h3>
        {infos.lots && infos.lots.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.numero")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.lot")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.mode")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.avancement")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.budget")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.statut")}</th>
                </tr>
              </thead>
              <tbody>
                {infos.lots.map((lot, idx) => (
                  <tr key={`${lot.code}-${idx}`} className="even:bg-neutral-50">
                    <td className={cn(CLASSE_CELLULE, "font-mono font-semibold")}>
                      {lot.code || ABSENT}
                    </td>
                    <td className={cn(CLASSE_CELLULE, "font-semibold")}>{lot.nom || ABSENT}</td>
                    <td className={CLASSE_CELLULE}>{lot.prestataire || ABSENT}</td>
                    <td className={cn(CLASSE_CELLULE, "font-semibold tabular-nums")}>
                      {lot.avancement
                        ? tApercu("pourcentageValeur", { valeur: lot.avancement })
                        : ABSENT}
                    </td>
                    <td className={cn(CLASSE_CELLULE, "tabular-nums")}>
                      {voitMontants ? lot.montant || ABSENT : MONTANT_MASQUE}
                    </td>
                    <td className={CLASSE_CELLULE}>{lot.statut || ABSENT}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : projet.avancementComposantes.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.numero")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.lot")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.mode")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.avancement")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.budget")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.statut")}</th>
                </tr>
              </thead>
              <tbody>
                {projet.avancementComposantes.map((comp) => (
                  <tr key={comp.id} className="even:bg-neutral-50">
                    <td className={cn(CLASSE_CELLULE, "font-mono font-semibold")}>
                      {comp.code || ABSENT}
                    </td>
                    <td className={cn(CLASSE_CELLULE, "font-semibold")}>
                      {comp.libelle || ABSENT}
                    </td>
                    <td className={CLASSE_CELLULE}>{comp.titulaire || ABSENT}</td>
                    <td className={cn(CLASSE_CELLULE, "font-semibold tabular-nums")}>
                      {formaterPourcentage(comp.avancement)}
                    </td>
                    <td className={cn(CLASSE_CELLULE, "tabular-nums")}>
                      {voitMontants
                        ? comp.montant === null
                          ? ABSENT
                          : formaterMontant(comp.montant, { avecDevise: false })
                        : MONTANT_MASQUE}
                    </td>
                    <td className={CLASSE_CELLULE}>
                      {comp.statutLibelle || comp.statut || ABSENT}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : lots.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.numero")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.lot")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.mode")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.bordereau")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.avancement")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.budget")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("lots.statut")}</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => {
                  const statut = statutLot(lot, maintenant);
                  const av = lot.avancement ?? avancementLot(lot);
                  const variante = statut === "SANS_ACTIVITE" ? "neutre" : BADGE_STATUT[statut];
                  return (
                    <tr key={lot.id} className="even:bg-neutral-50">
                      <td className={cn(CLASSE_CELLULE, "font-mono font-semibold")}>{lot.code}</td>
                      <td className={cn(CLASSE_CELLULE, "font-semibold")}>{lot.nom}</td>
                      <td className={CLASSE_CELLULE}>{lot.modeExecutionLibelle}</td>
                      <td className={CLASSE_CELLULE}>
                        {tProjets(`tiroirCreation.typeBordereau.${lot.typeBordereau}`)}
                      </td>
                      <td className={cn(CLASSE_CELLULE, "font-semibold tabular-nums")}>
                        {formaterPourcentage(av)}
                      </td>
                      <td className={cn(CLASSE_CELLULE, "tabular-nums")}>
                        {voitMontants
                          ? lot.budget === null
                            ? ABSENT
                            : formaterMontant(lot.budget, { avecDevise: false })
                          : MONTANT_MASQUE}
                      </td>
                      <td className={CLASSE_CELLULE}>
                        <Badge variante={variante}>
                          {statut === "SANS_ACTIVITE"
                            ? t("lots.sansActivite")
                            : tProjets(`lotsActivites.statutActivite.${statut}`)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 rounded-md border border-solid border-neutral-200 p-3 text-xs text-neutral-500">
            {t("lots.vide")}
          </p>
        )}
      </section>

      {/* Tableau des avenants avec leurs ordres de service */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between bg-secondary-800 px-3 py-1.5 text-neutral-0">
          <h3 className="m-0 text-xs font-bold tracking-wider text-neutral-0 uppercase">
            {t("sections.avenants")}
          </h3>
          <span className="text-[11px] font-medium text-neutral-100">
            {t("avenants.resume", { nombre: avenants.length })}
          </span>
        </div>
        {avenants.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("avenants.numero")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("avenants.date")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("avenants.objet")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("avenants.impactBudget")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("avenants.impactDelai")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("avenants.statut")}</th>
                  <th className={CLASSE_CELLULE_ENTETE}>{t("avenants.ordreService")}</th>
                </tr>
              </thead>
              <tbody>
                {avenants.map((av) => {
                  const prolongation = formaterDureeCalendaire({
                    annees: av.anneesAccordees,
                    mois: av.moisAccordes,
                    jours: av.joursAccordes,
                  });
                  const portee =
                    av.porteSur === "PROJET"
                      ? t("avenants.projetEntier")
                      : av.cases.map((c) => c.libelle).join(", ");
                  return (
                    <tr key={av.id} className="even:bg-neutral-50">
                      <td className={cn(CLASSE_CELLULE, "font-mono font-semibold whitespace-nowrap")}>
                        {av.document ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void telechargerDocAvenant(av)}
                              title={tApercu("telechargerAvenant")}
                              className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-mono text-xs font-semibold text-primary-600 hover:underline print:hidden"
                            >
                              <FileSignature className="size-3.5 shrink-0" aria-hidden="true" />
                              <span>{av.numero}</span>
                            </button>
                            <span className="hidden print:inline">{av.numero}</span>
                          </>
                        ) : (
                          av.numero
                        )}
                      </td>
                      <td className={cn(CLASSE_CELLULE, "whitespace-nowrap tabular-nums")}>
                        {formaterDate(av.dateSignature)}
                      </td>
                      <td className={CLASSE_CELLULE}>{av.objet || ABSENT}</td>
                      <td className={cn(CLASSE_CELLULE, "font-semibold whitespace-nowrap tabular-nums")}>
                        {!voitMontants
                          ? MONTANT_MASQUE
                          : av.montant !== null
                            ? tApercu("cumulAvenantsBudget", {
                                montant: formaterMontant(av.montant),
                              })
                            : ABSENT}
                      </td>
                      <td className={cn(CLASSE_CELLULE, "whitespace-nowrap")}>
                        {prolongation !== ABSENT
                          ? tApercu("cumulAvenantsDelai", { duree: prolongation })
                          : ABSENT}
                      </td>
                      <td className={CLASSE_CELLULE}>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variante={av.document && av.ordreService ? "succes" : "avertissement"}>
                            {av.document ? t("avenants.signe") : t("avenants.enregistre")}
                          </Badge>
                          <span className="text-[11px] text-neutral-600">{portee}</span>
                        </div>
                      </td>
                      <td className={CLASSE_CELLULE}>
                        {av.ordreService ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void telechargerOsAvenant(av)}
                              title={tApercu("telechargerOs")}
                              className="inline-flex max-w-44 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left text-xs font-medium text-primary-600 hover:underline print:hidden"
                            >
                              <FileDown className="size-3.5 shrink-0" aria-hidden="true" />
                              <span className="truncate">{av.ordreService.nom}</span>
                            </button>
                            <span className="hidden print:inline">{av.ordreService.nom}</span>
                          </>
                        ) : (
                          ABSENT
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 rounded-md border border-solid border-neutral-200 p-3 text-xs text-neutral-500">
            {t("avenants.vide")}
          </p>
        )}
      </section>

      {/* Points de vigilance */}
      <section className="flex flex-col gap-2">
        <h3 className={CLASSE_SECTION_A4}>{t("sections.risques")}</h3>
        <div className="rounded-md border border-solid border-neutral-200 p-3">
          {pointsVigilance.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {pointsVigilance.map((pt, idx) => (
                <li
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 text-xs",
                    pt.niveau === 1 && "pl-5 text-neutral-700",
                    pt.niveau !== 1 && "font-semibold",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-2 shrink-0 rounded-full",
                      pt.ton === "erreur" ? "bg-erreur" : "bg-avertissement",
                    )}
                    aria-hidden="true"
                  />
                  <span>{pt.texte}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs text-neutral-600">{t("vigilance.vide")}</p>
          )}
        </div>
      </section>

      {/* Note libre du chef de projet */}
      <section className={cn("flex flex-col gap-2", !texteNote && "print:hidden")}>
        <h3 className="bg-primary-600 px-3 py-1.5 text-xs font-bold tracking-wider text-neutral-0 uppercase">
          {t("sections.note")}
        </h3>
        <div className="rounded-md border border-l-4 border-solid border-neutral-200 border-l-primary-600 bg-primary-50/40 p-3">
          <div className="mb-1 text-[11px] font-bold text-primary-700">
            {projet.chefProjet
              ? t("note.auteur", {
                  nom: nomOuAbsent(projet.chefProjet),
                  date: formaterDate(maintenant),
                })
              : t("note.auteurSansNom", { date: formaterDate(maintenant) })}
          </div>
          {texteNote ? (
            <p className="m-0 whitespace-pre-wrap text-xs leading-relaxed text-neutral-800">
              {texteNote}
            </p>
          ) : (
            <p className="m-0 text-xs italic text-neutral-500">{tApercu("noteVideApercu")}</p>
          )}
        </div>
      </section>

      {/* Signatures */}
      <section className="flex flex-col gap-2">
        <h3 className={CLASSE_SECTION_A4}>{t("sections.signatures")}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:grid-cols-3">
          {[
            {
              role: t("signatures.chefProjet"),
              nom: projet.chefProjet ? nomOuAbsent(projet.chefProjet) : ABSENT,
            },
            {
              role: t("signatures.directeurGeneral"),
              nom: ABSENT,
            },
            {
              role: t("signatures.directeurFinancier"),
              nom: financier ? nomOuAbsent(financier) : ABSENT,
            },
          ].map((sig) => (
            <div
              key={sig.role}
              className="flex flex-col items-center justify-between gap-6 rounded-md border border-solid border-neutral-200 p-3 text-center"
            >
              <span className="text-[11px] font-semibold text-neutral-600">{sig.role}</span>
              <span className="text-[11px] italic text-neutral-400">
                {t("signatures.signature")}
              </span>
              <span className="w-full border-0 border-t border-solid border-neutral-300 pt-1.5 text-xs font-bold text-secondary-800">
                {sig.nom}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Pied de page institutionnel */}
      <footer className="flex flex-col gap-1 border-0 border-t border-solid border-neutral-200 pt-3 text-[11px] text-neutral-500">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{documents ? emetteur : pied}</span>
          <span>{t("dateGeneration", { date: genereLe })}</span>
        </div>
        {mentionsPied.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
            {mentionsPied.map((ligne, idx) => (
              <span key={idx}>{ligne}</span>
            ))}
          </div>
        )}
      </footer>
    </article>
  );
}

function PaireCleValeur({
  libelle,
  valeur,
  large = false,
}: {
  libelle: string;
  valeur: ReactNode;
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 border-0 border-b border-solid border-neutral-100 pb-1 text-xs",
        large && "sm:col-span-2 print:col-span-2",
      )}
    >
      <span className="shrink-0 text-neutral-500">{libelle}</span>
      <span className="text-right font-semibold text-neutral-900">{valeur}</span>
    </div>
  );
}

function LigneKpi({
  libelle,
  valeur,
  className,
}: {
  libelle: string;
  valeur: string;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-neutral-500">{libelle}</span>
      <span className={cn("text-right font-semibold tabular-nums text-neutral-900", className)}>
        {valeur}
      </span>
    </div>
  );
}

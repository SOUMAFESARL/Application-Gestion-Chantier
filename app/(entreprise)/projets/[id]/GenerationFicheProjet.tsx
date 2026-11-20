"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleX, Download, LoaderCircle, Printer, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { indicateursJournalProjet } from "@/features/chantier";
import { lireJournal } from "@/features/chantier/adaptateur";
import { CLE_JOURNAL } from "@/features/chantier/cles";
import { lireEntreprise } from "@/features/configuration/api";
import { lireArbre } from "@/features/decoupage/adaptateur";
import { cleArbre } from "@/features/decoupage/cles";
import type { CaseArbre } from "@/features/decoupage/types";
import { lireDocumentsOuNull } from "@/features/documents/adaptateur";
import { useIdentitePlateforme } from "@/features/plateforme/hooks";
import { listerEquipes, listerLots } from "@/features/projets/adaptateur";
import { cleEquipes, cleLots } from "@/features/projets/cles";
import { REFERENTIEL_TYPES_PROJET, useReferentiel } from "@/features/projets/referentiels";
import type { Activite, Lot, Projet, StatutDeclare } from "@/features/projets/types";
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

function collecterFeuilles(noeud: CaseArbre): CaseArbre[] {
  if (noeud.estFeuille || noeud.enfants.length === 0) {
    return [noeud];
  }
  return noeud.enfants.flatMap(collecterFeuilles);
}

function statutDeclareDeCase(noeud: CaseArbre): StatutDeclare {
  if (noeud.cloture || (noeud.avancement !== null && noeud.avancement >= 100)) return "TERMINE";
  if (noeud.suspendu) return "BLOQUE";
  if (noeud.commence || (noeud.avancement !== null && noeud.avancement > 0)) return "EN_COURS";
  return "NON_DEMARRE";
}

function lotsDepuisArbre(projetId: string, cases: CaseArbre[]): Lot[] {
  return cases.map((racine, idx) => {
    const codeLot = racine.code || racine.numero || `L-${String(idx + 1).padStart(2, "0")}`;
    const feuilles = collecterFeuilles(racine);
    const activites: Activite[] = feuilles.map((f, fIdx) => ({
      id: f.id,
      lotId: racine.id,
      code: f.code || f.numero || `${codeLot}.${String(fIdx + 1).padStart(2, "0")}`,
      libelle: f.libelle,
      quantitePrevue: f.quantitePrevue,
      unite: null,
      budget: f.montant,
      dateDebutPrevue: f.dateDebutPrevue,
      dateFinPrevue: f.dateFinPrevue,
      avancement: f.avancement ?? 0,
      quantiteRealisee: f.quantiteRealisee,
      surCheminCritique: false,
      dependanceId: null,
      responsableId: null,
      equipe:
        f.equipes.length > 0
          ? { id: f.equipes[0].equipeId, nom: f.equipes[0].nom, effectif: 0 }
          : null,
      statut: statutDeclareDeCase(f),
    }));

    return {
      id: racine.id,
      projetId,
      code: codeLot,
      nom: racine.libelle,
      modeExecution: racine.modeExecutionEffectif || racine.modeExecution || "REGIE",
      modeExecutionLibelle: racine.modeExecutionEffectif || racine.modeExecution || "—",
      typeBordereau:
        racine.typeBordereauEffectif === "PRIX_UNITAIRE" ? "PRIX_UNITAIRE" : "FORFAIT_GLOBAL",
      budget: racine.montant,
      dateDebut: racine.dateDebutPrevue,
      dateFin: racine.dateFinPrevue,
      statut: statutDeclareDeCase(racine),
      avancement: racine.avancement,
      avancementTemporel: racine.avancementTemporel,
      deltaRetard: racine.ecart,
      activites,
    };
  });
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
  const [noteModifiee, setNoteModifiee] = useState<string | null>(null);
  const noteSaisie = noteModifiee ?? projet?.informationsComplementaires?.note_cp ?? "";

  const generation = useMutation({
    mutationFn: async ({
      cible,
      note,
    }: {
      cible: Projet;
      note: string;
    }): Promise<ApercuPdf> => {
      const maintenant = new Date();
      const [lotsApi, arbre, equipes, journal, entreprise, documents] = await Promise.all([
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
      generation.mutate({ cible: projet, note: noteSaisie });
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
            <div className="flex items-end gap-2 rounded-md border border-solid border-neutral-200 bg-neutral-50 p-2.5">
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="pdf-note-cp" className="text-xs font-semibold text-neutral-700">
                  {t("generation.champNote")}
                </Label>
                <Textarea
                  id="pdf-note-cp"
                  rows={2}
                  value={noteSaisie}
                  placeholder={t("generation.champNotePlaceholder")}
                  onChange={(e) => setNoteModifiee(e.target.value)}
                  className="bg-white text-xs"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={generer}>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {t("generation.actualiserApercu")}
              </Button>
            </div>
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

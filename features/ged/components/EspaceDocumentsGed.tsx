"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Eye,
  FolderClock,
  Lock,
  RotateCw,
  Share2,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Badge, Bouton, Carte, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDroits, useProjetsVisibles } from "@/features/habilitations";
import { ErreurApi } from "@/lib/api";
import {
  ABSENT,
  formaterDate,
  formaterDateHeure,
  formaterTailleFichier,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  declencherTelechargementBlob,
  listerDocumentsGed,
  modifierDocumentGed,
  telechargerDocumentGed,
} from "../adaptateur";
import { CLE_TOUTES_LISTES_DOCUMENTS_GED, cleDetailDocumentGed, cleListeDocumentsGed } from "../cles";
import {
  CRITERES_DOCUMENTS_GED_VIDES,
  ORIGINES_GED,
  categoriesDeposablesGed,
  categoriesVisiblesGed,
  compterParCategorieGed,
  criteresGedActifs,
  estApiGedIndisponible,
  extraireExtensionFichier,
  filtrerDocumentsGed,
  motifRefusSuppressionDocument,
  peutEpinglerDocument,
  peutPartagerDocument,
  peutSupprimerDocument,
  peutTelechargerGed,
} from "../regles";
import type {
  CategorieDocumentGed,
  CriteresDocumentsGed,
  DocumentGed,
  OrigineDocumentGed,
} from "../types";
import { ModaleDepotDocument } from "./ModaleDepotDocument";
import { ModaleNouvelleVersion } from "./ModaleNouvelleVersion";
import { ModalePartageExterne } from "./ModalePartageExterne";
import { ModaleSuppressionDocument } from "./ModaleSuppressionDocument";
import { TiroirDetailDocument, type OngletDetailGed } from "./TiroirDetailDocument";

const colonne = aideColonnes<DocumentGed>();

interface Props {
  /**
   * Lorsqu'il est renseigné (`/projets/[id]/documents`), l'écran se pré-filtre
   * sur ce chantier et masque l'en-tête global, le sélecteur de projet et la
   * colonne Projet (déjà portés par `CadreFicheProjet`).
   */
  projetIdFixe?: string;
}

/**
 * Espace principal de la Gestion Documentaire (GED / F6 — tâches 3.5, 3.7, 3.10, 3.12).
 *
 * Utilisé aussi bien en vue globale multi-projets (`/documents`) que dans
 * l'onglet d'une fiche projet (`/projets/[id]/documents`).
 */
export function EspaceDocumentsGed({ projetIdFixe }: Props) {
  const t = useTranslations("ged");
  const clientRequetes = useQueryClient();
  const { droits, connus } = useDroits();
  const requeteProjets = useProjetsVisibles();

  const [criteres, setCriteres] = useState<CriteresDocumentsGed>(() => ({
    ...CRITERES_DOCUMENTS_GED_VIDES,
    projetId: projetIdFixe ?? "",
  }));

  const [modaleDepotOuverte, setModaleDepotOuverte] = useState(false);
  const [detailEtat, setDetailEtat] = useState<{
    document: DocumentGed;
    onglet: OngletDetailGed;
  } | null>(null);
  const [docNouvelleVersion, setDocNouvelleVersion] = useState<DocumentGed | null>(null);
  const [docPartage, setDocPartage] = useState<DocumentGed | null>(null);
  const [docSuppression, setDocSuppression] = useState<DocumentGed | null>(null);
  const [telechargementDocId, setTelechargementDocId] = useState<string | null>(null);
  const [epingleDocId, setEpingleDocId] = useState<string | null>(null);

  const categoriesVisibles = useMemo(() => categoriesVisiblesGed(droits), [droits]);
  const categoriesDeposables = useMemo(() => categoriesDeposablesGed(droits), [droits]);
  const autoriseTelecharger = peutTelechargerGed(droits);
  const projets = useMemo(() => requeteProjets.data ?? [], [requeteProjets.data]);

  const requeteDocuments = useQuery({
    queryKey: cleListeDocumentsGed(projetIdFixe),
    queryFn: ({ signal }) =>
      listerDocumentsGed(projetIdFixe ? { projetId: projetIdFixe } : undefined, signal),
    enabled: connus && categoriesVisibles.length > 0,
  });

  const documentsAccessibles = useMemo(() => {
    const bruts = requeteDocuments.data ?? [];
    const ensembleVisibles = new Set(categoriesVisibles);
    return bruts.filter((doc) => ensembleVisibles.has(doc.categorie));
  }, [requeteDocuments.data, categoriesVisibles]);

  const documentsDansPerimetreProjet = useMemo(() => {
    const cibleProjet = projetIdFixe || criteres.projetId;
    if (!cibleProjet) return documentsAccessibles;
    return documentsAccessibles.filter((doc) => doc.projetId === cibleProjet);
  }, [documentsAccessibles, projetIdFixe, criteres.projetId]);

  const compteursCategories = useMemo(
    () => compterParCategorieGed(documentsDansPerimetreProjet),
    [documentsDansPerimetreProjet],
  );

  const criteresEffectifs = useMemo<CriteresDocumentsGed>(
    () => ({
      ...criteres,
      projetId: projetIdFixe ?? criteres.projetId,
    }),
    [criteres, projetIdFixe],
  );

  const documentsFiltres = useMemo(
    () => filtrerDocumentsGed(documentsAccessibles, criteresEffectifs),
    [documentsAccessibles, criteresEffectifs],
  );

  const totalReferences = useMemo(
    () => documentsDansPerimetreProjet.filter((doc) => doc.estReference).length,
    [documentsDansPerimetreProjet],
  );

  const totalAutomatiques = useMemo(
    () => documentsDansPerimetreProjet.filter((doc) => doc.estAutomatique).length,
    [documentsDansPerimetreProjet],
  );

  const mutationReference = useMutation({
    mutationFn: (doc: DocumentGed) =>
      modifierDocumentGed(doc.id, { estReference: !doc.estReference }),
    onMutate: (doc) => {
      setEpingleDocId(doc.id);
    },
    onSuccess: (docMaj) => {
      void clientRequetes.invalidateQueries({ queryKey: CLE_TOUTES_LISTES_DOCUMENTS_GED });
      void clientRequetes.invalidateQueries({ queryKey: cleDetailDocumentGed(docMaj.id) });
      setDetailEtat((courant) =>
        courant && courant.document.id === docMaj.id
          ? { ...courant, document: { ...courant.document, ...docMaj } }
          : courant,
      );
      toast.success(
        docMaj.estReference
          ? t("actions.referenceEpinglee", { nom: docMaj.nom })
          : t("actions.referenceRetiree", { nom: docMaj.nom }),
      );
    },
    onError: (erreur) => {
      toast.error(erreur instanceof ErreurApi ? erreur.message : t("erreurs.referenceEchouee"));
    },
    onSettled: () => {
      setEpingleDocId(null);
    },
  });

  const basculerReference = useCallback(
    (doc: DocumentGed) => {
      mutationReference.mutate(doc);
    },
    [mutationReference],
  );

  const telechargerDirect = useCallback(
    async (doc: DocumentGed) => {
      if (!autoriseTelecharger) return;
      setTelechargementDocId(doc.id);
      try {
        const blob = await telechargerDocumentGed(doc.id);
        const nomFichier = doc.versionActive?.nomFichier || `${doc.nom}.pdf`;
        declencherTelechargementBlob(blob, nomFichier);
        toast.success(t("actions.telechargementLance", { nom: nomFichier }));
      } catch (erreur) {
        toast.error(
          erreur instanceof ErreurApi ? erreur.message : t("erreurs.telechargementEchoue"),
        );
      } finally {
        setTelechargementDocId(null);
      }
    },
    [autoriseTelecharger, t],
  );

  const ouvrirDetail = useCallback((doc: DocumentGed, onglet: OngletDetailGed = "metadonnees") => {
    setDetailEtat({ document: doc, onglet });
  }, []);

  const colonnes = useMemo(() => {
    const liste = [
      colonne.display({
        id: "document",
        header: () => t("colonnes.document"),
        cell: ({ row }) => {
          const doc = row.original;
          const peutStar = peutEpinglerDocument(droits, doc);
          const sousElements = [doc.description, doc.versionActive?.nomFichier]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="flex min-w-[230px] items-start gap-2.5">
              {peutStar ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={epingleDocId === doc.id}
                      onClick={() => basculerReference(doc)}
                      aria-label={
                        doc.estReference
                          ? t("actions.retirerReference")
                          : t("actions.epinglerReference")
                      }
                      aria-pressed={doc.estReference}
                      className={cn(
                        "mt-0.5 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0 transition-colors",
                        doc.estReference
                          ? "text-avertissement hover:bg-avertissement-fond"
                          : "text-neutral-300 hover:bg-avertissement-fond hover:text-avertissement",
                      )}
                    >
                      <Star
                        size={16}
                        className={cn(doc.estReference && "fill-current")}
                        aria-hidden="true"
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {doc.estReference
                      ? t("actions.retirerReference")
                      : t("actions.epinglerReference")}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center",
                    doc.estReference ? "text-avertissement" : "text-neutral-300",
                  )}
                  aria-hidden="true"
                >
                  <Star size={16} className={cn(doc.estReference && "fill-current")} />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => ouvrirDetail(doc, "metadonnees")}
                  className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-semibold text-neutral-900 transition-colors hover:text-primary-600 hover:underline"
                >
                  {doc.nom}
                </button>
                {sousElements && (
                  <p className="m-0 mt-0.5 line-clamp-1 text-xs text-neutral-500">
                    {sousElements}
                  </p>
                )}
              </div>
            </div>
          );
        },
      }),
      colonne.display({
        id: "categorie",
        header: () => t("colonnes.categorie"),
        cell: ({ row }) => (
          <Badge variante="neutre">{t(`categories.${row.original.categorie}`)}</Badge>
        ),
      }),
    ];

    if (!projetIdFixe) {
      liste.push(
        colonne.display({
          id: "projet",
          header: () => t("colonnes.projet"),
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-neutral-800">
                {row.original.projetNom || ABSENT}
              </span>
              {row.original.projetReference && (
                <span className="text-xs text-neutral-500">{row.original.projetReference}</span>
              )}
            </div>
          ),
        }),
      );
    }

    liste.push(
      colonne.display({
        id: "origine",
        header: () => t("colonnes.origine"),
        cell: ({ row }) => {
          const doc = row.original;
          return (
            <Badge
              variante={doc.estAutomatique ? "information" : "neutre"}
              icone={doc.estAutomatique ? <Lock size={12} aria-hidden="true" /> : undefined}
            >
              {t(`origines.${doc.origine}`)}
            </Badge>
          );
        },
      }),
      colonne.display({
        id: "version",
        header: () => t("colonnes.version"),
        cell: ({ row }) => {
          const doc = row.original;
          const ver = doc.versionActive;
          const ext = extraireExtensionFichier(ver?.nomFichier);
          const metaTaille = ver
            ? ext
              ? `${ext} · ${formaterTailleFichier(ver.taille)}`
              : formaterTailleFichier(ver.taille)
            : ABSENT;

          return (
            <div className="flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={() => ouvrirDetail(doc, "versions")}
                title={t("actions.voirVersions")}
                className="cursor-pointer border-0 bg-transparent p-0"
              >
                <Badge variante="secondaire">{ver?.numero ?? `v${doc.nombreVersions || 1}`}</Badge>
              </button>
              <span className="text-xs text-neutral-500 tabular-nums whitespace-nowrap">
                {metaTaille}
              </span>
            </div>
          );
        },
      }),
      colonne.display({
        id: "dateAuteur",
        header: () => t("colonnes.dateAuteur"),
        cell: ({ row }) => {
          const doc = row.original;
          const date = doc.versionActive?.creeLe || doc.modifieLe || doc.creeLe;
          const auteur =
            doc.versionActive?.auteur?.nomComplet || doc.createur?.nomComplet || ABSENT;
          return (
            <div className="flex flex-col whitespace-nowrap">
              <span className="text-sm text-neutral-800 tabular-nums">{formaterDate(date)}</span>
              <span className="text-xs text-neutral-500">{auteur}</span>
            </div>
          );
        },
      }),
      colonne.display({
        id: "actions",
        header: () => t("colonnes.actions"),
        meta: { classe: BORD_DROIT_TABLEAU },
        cell: ({ row }) => {
          const doc = row.original;
          const autoriseSuppr = peutSupprimerDocument(droits, doc);
          const motifRefus = motifRefusSuppressionDocument(droits, doc);
          const autorisePartage = peutPartagerDocument(droits, doc);

          return (
            <div className="inline-flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("actions.consulterDetail", { nom: doc.nom })}
                    onClick={() => ouvrirDetail(doc, "metadonnees")}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("actions.detailEtVersions")}</TooltipContent>
              </Tooltip>

              {autoriseTelecharger && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={telechargementDocId === doc.id}
                      aria-label={t("actions.telechargerDocument", { nom: doc.nom })}
                      onClick={() => void telechargerDirect(doc)}
                    >
                      <Download className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("actions.telecharger")}</TooltipContent>
                </Tooltip>
              )}

              {autorisePartage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("actions.partagerDocument", { nom: doc.nom })}
                      onClick={() => setDocPartage(doc)}
                    >
                      <Share2 className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("actions.partager")}</TooltipContent>
                </Tooltip>
              )}

              {autoriseSuppr ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-erreur hover:bg-erreur-fond hover:text-erreur"
                      aria-label={t("actions.supprimerDocument", { nom: doc.nom })}
                      onClick={() => setDocSuppression(doc)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("actions.supprimer")}</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled
                        aria-label={
                          motifRefus === "automatique"
                            ? t("suppression.verrouAutoInfobulle")
                            : t("suppression.verrouRoleInfobulle")
                        }
                      >
                        {motifRefus === "automatique" ? (
                          <Lock className="size-4 text-neutral-400" aria-hidden="true" />
                        ) : (
                          <Trash2 className="size-4 text-neutral-300" aria-hidden="true" />
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {motifRefus === "automatique"
                      ? t("suppression.verrouAutoInfobulle")
                      : t("suppression.verrouRoleInfobulle")}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      }),
    );

    return liste;
  }, [
    autoriseTelecharger,
    basculerReference,
    droits,
    epingleDocId,
    ouvrirDetail,
    projetIdFixe,
    t,
    telechargementDocId,
    telechargerDirect,
  ]);

  const configurationExport = useMemo<ExportTableau<DocumentGed>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: "documents-ged",
      colonnes: [
        { entete: t("export.nom"), valeur: (d) => d.nom },
        { entete: t("export.categorie"), valeur: (d) => t(`categories.${d.categorie}`) },
        ...(!projetIdFixe
          ? [
              { entete: t("export.projet"), valeur: (d: DocumentGed) => d.projetNom },
              {
                entete: t("export.referenceProjet"),
                valeur: (d: DocumentGed) => d.projetReference,
              },
            ]
          : []),
        { entete: t("export.origine"), valeur: (d) => t(`origines.${d.origine}`) },
        { entete: t("export.version"), valeur: (d) => d.versionActive?.numero ?? "" },
        { entete: t("export.fichier"), valeur: (d) => d.versionActive?.nomFichier ?? "" },
        {
          entete: t("export.taille"),
          valeur: (d) => (d.versionActive ? formaterTailleFichier(d.versionActive.taille) : ""),
        },
        {
          entete: t("export.reference"),
          valeur: (d) => (d.estReference ? t("export.oui") : t("export.non")),
        },
        {
          entete: t("export.misAJourLe"),
          valeur: (d) => formaterDateHeure(d.versionActive?.creeLe || d.modifieLe),
        },
        {
          entete: t("export.auteur"),
          valeur: (d) => d.versionActive?.auteur?.nomComplet || d.createur?.nomComplet || "",
        },
        { entete: t("export.sha256"), valeur: (d) => d.versionActive?.hashSha256 ?? "" },
      ],
    }),
    [projetIdFixe, t],
  );

  const optionsProjets = useMemo(
    () =>
      projets.map((projet) => ({
        valeur: projet.id,
        libelle: projet.reference ? `${projet.nom} (${projet.reference})` : projet.nom,
      })),
    [projets],
  );

  const optionsOrigines = useMemo(
    () =>
      ORIGINES_GED.map((origine) => ({
        valeur: origine,
        libelle: t(`origines.${origine}`),
      })),
    [t],
  );

  const filtresActifs = criteresGedActifs(criteresEffectifs, projetIdFixe);

  function reinitialiserFiltres() {
    setCriteres((courant) => ({
      ...CRITERES_DOCUMENTS_GED_VIDES,
      categorie: courant.categorie,
      projetId: projetIdFixe ?? "",
    }));
  }

  if (!connus) {
    return <EtatChargement message={t("chargement")} />;
  }

  if (categoriesVisibles.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {!projetIdFixe && <EnTetePage titre={t("titre")} />}
        <Carte>
          <EtatVide
            icone={<Lock size={36} strokeWidth={1.5} />}
            titre={t("accesRefuse.titre")}
            description={t("accesRefuse.description")}
          />
        </Carte>
      </div>
    );
  }

  const cleCriteres = [
    criteresEffectifs.projetId,
    criteresEffectifs.categorie,
    criteresEffectifs.origine,
    criteresEffectifs.referencesUniquement ? "1" : "0",
    criteresEffectifs.dateDebut,
    criteresEffectifs.dateFin,
    criteresEffectifs.recherche,
  ].join("|");

  return (
    <div className="flex flex-col gap-5">
      {!projetIdFixe && (
        <EnTetePage
          titre={t("titre")}
          description={t("resume", {
            total: documentsDansPerimetreProjet.length,
            references: totalReferences,
            automatiques: totalAutomatiques,
          })}
        />
      )}

      {/* Onglets des 6 catégories BTP (+ Toutes), filtrés par `ged.voir_<categorie>` */}
      <nav
        aria-label={t("navigationCategories")}
        className="flex gap-1 overflow-x-auto border-0 border-b border-solid border-neutral-200"
      >
        <button
          type="button"
          onClick={() => setCriteres((c) => ({ ...c, categorie: "" }))}
          aria-current={criteres.categorie === "" ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 border-solid bg-transparent px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
            criteres.categorie === ""
              ? "border-primary text-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-800",
          )}
        >
          <span>{t("onglets.toutes")}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs tabular-nums",
              criteres.categorie === ""
                ? "bg-primary-100 text-primary-800"
                : "bg-neutral-100 text-neutral-600",
            )}
          >
            {documentsDansPerimetreProjet.length}
          </span>
        </button>

        {categoriesVisibles.map((cat) => {
          const actif = criteres.categorie === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCriteres((c) => ({ ...c, categorie: cat }))}
              aria-current={actif ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 border-solid bg-transparent px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                actif
                  ? "border-primary text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-800",
              )}
            >
              <span>{t(`categories.${cat}`)}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs tabular-nums",
                  actif
                    ? "bg-primary-100 text-primary-800"
                    : "bg-neutral-100 text-neutral-600",
                )}
              >
                {compteursCategories[cat]}
              </span>
            </button>
          );
        })}
      </nav>

      {requeteDocuments.isPending ? (
        <Carte>
          <EtatChargement message={t("chargement")} />
        </Carte>
      ) : requeteDocuments.isError ? (
        <Carte>
          {estApiGedIndisponible(requeteDocuments.error) ? (
            <EtatVide
              icone={<FolderClock size={40} strokeWidth={1.5} />}
              titre={t("apiIndisponible.titre")}
              description={t("apiIndisponible.description")}
              action={
                <Bouton
                  variante="primaire"
                  taille="sm"
                  iconeGauche={<RotateCw size={16} aria-hidden="true" />}
                  onClick={() => void requeteDocuments.refetch()}
                >
                  {t("actions.reessayer")}
                </Bouton>
              }
            />
          ) : (
            <EtatErreur
              message={
                requeteDocuments.error instanceof ErreurApi
                  ? requeteDocuments.error.message
                  : t("erreurs.chargementListe")
              }
              reference={
                requeteDocuments.error instanceof ErreurApi
                  ? requeteDocuments.error.traceId
                  : null
              }
              onReessayer={() => void requeteDocuments.refetch()}
            />
          )}
        </Carte>
      ) : (
        <TableauListe
          colonnes={colonnes}
          donnees={documentsFiltres}
          cleLigne={(doc) => doc.id}
          cleCriteres={cleCriteres}
          messageVide={filtresActifs ? t("vide.aucunResultat") : t("vide.aucunDocument")}
          exporter={configurationExport}
          filtresActifs={filtresActifs}
          onReinitialiser={reinitialiserFiltres}
          outils={
            <>
              <RechercheTableau
                valeur={criteres.recherche}
                onChangement={(recherche) => setCriteres((c) => ({ ...c, recherche }))}
                libelle={t("filtres.rechercheLibelle")}
                placeholder={t("filtres.recherchePlaceholder")}
              />

              {!projetIdFixe && optionsProjets.length > 0 && (
                <FiltreTableau
                  valeur={criteres.projetId}
                  onChangement={(projetId) => setCriteres((c) => ({ ...c, projetId }))}
                  libelle={t("filtres.projetLibelle")}
                  libelleTous={t("filtres.tousProjets")}
                  options={optionsProjets}
                />
              )}

              <FiltreTableau<OrigineDocumentGed>
                valeur={criteres.origine}
                onChangement={(origine) => setCriteres((c) => ({ ...c, origine }))}
                libelle={t("filtres.origineLibelle")}
                libelleTous={t("filtres.toutesOrigines")}
                options={optionsOrigines}
              />

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex items-center">
                  <SelecteurDate
                    valeur={criteres.dateDebut}
                    onChange={(dateDebut) => setCriteres((c) => ({ ...c, dateDebut }))}
                    placeholder={t("filtres.dateDebut")}
                    auPlusTard={criteres.dateFin || undefined}
                    aria-label={t("filtres.dateDebut")}
                    className="h-[var(--button-height-sm)] w-auto min-w-36 px-3 text-sm"
                  />
                  {criteres.dateDebut && (
                    <button
                      type="button"
                      onClick={() => setCriteres((c) => ({ ...c, dateDebut: "" }))}
                      aria-label={t("filtres.effacerDateDebut")}
                      className="ml-1 inline-flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <SelecteurDate
                    valeur={criteres.dateFin}
                    onChange={(dateFin) => setCriteres((c) => ({ ...c, dateFin }))}
                    placeholder={t("filtres.dateFin")}
                    auPlusTot={criteres.dateDebut || undefined}
                    aria-label={t("filtres.dateFin")}
                    className="h-[var(--button-height-sm)] w-auto min-w-36 px-3 text-sm"
                  />
                  {criteres.dateFin && (
                    <button
                      type="button"
                      onClick={() => setCriteres((c) => ({ ...c, dateFin: "" }))}
                      aria-label={t("filtres.effacerDateFin")}
                      className="ml-1 inline-flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                aria-pressed={criteres.referencesUniquement}
                onClick={() =>
                  setCriteres((c) => ({ ...c, referencesUniquement: !c.referencesUniquement }))
                }
                className={cn(
                  "inline-flex h-[var(--button-height-sm)] cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
                  criteres.referencesUniquement
                    ? "border-avertissement/50 bg-avertissement-fond text-avertissement"
                    : "border-input bg-card text-neutral-700 hover:bg-neutral-50",
                )}
              >
                <Star
                  size={15}
                  className={cn(criteres.referencesUniquement && "fill-current")}
                  aria-hidden="true"
                />
                <span>{t("filtres.referencesUniquement")}</span>
              </button>
            </>
          }
          actions={
            categoriesDeposables.length > 0 ? (
              <Bouton
                variante="primaire"
                taille="sm"
                iconeGauche={<Upload size={16} aria-hidden="true" />}
                onClick={() => setModaleDepotOuverte(true)}
              >
                {t("actions.deposer")}
              </Bouton>
            ) : undefined
          }
        />
      )}

      {modaleDepotOuverte && (
        <ModaleDepotDocument
          ouverte={modaleDepotOuverte}
          onFermer={() => setModaleDepotOuverte(false)}
          projets={projets}
          projetIdFixe={projetIdFixe}
          projetIdDefaut={criteres.projetId || undefined}
          categoriesDeposables={categoriesDeposables}
          categorieDefaut={(criteres.categorie || undefined) as CategorieDocumentGed | undefined}
        />
      )}

      {detailEtat && (
        <TiroirDetailDocument
          key={`${detailEtat.document.id}-${detailEtat.onglet}`}
          ouverte={Boolean(detailEtat)}
          document={detailEtat.document}
          ongletInitial={detailEtat.onglet}
          onFermer={() => setDetailEtat(null)}
          onDemanderNouvelleVersion={(doc) => setDocNouvelleVersion(doc)}
          onDemanderPartage={(doc) => setDocPartage(doc)}
          onDemanderSuppression={(doc) => setDocSuppression(doc)}
          onBasculerReference={basculerReference}
          basculeReferenceEnCours={epingleDocId === detailEtat.document.id}
        />
      )}

      {docNouvelleVersion && (
        <ModaleNouvelleVersion
          key={docNouvelleVersion.id}
          ouverte={Boolean(docNouvelleVersion)}
          document={docNouvelleVersion}
          onFermer={() => setDocNouvelleVersion(null)}
        />
      )}

      {docPartage && (
        <ModalePartageExterne
          key={docPartage.id}
          ouverte={Boolean(docPartage)}
          document={docPartage}
          onFermer={() => setDocPartage(null)}
        />
      )}

      {docSuppression && (
        <ModaleSuppressionDocument
          key={docSuppression.id}
          ouverte={Boolean(docSuppression)}
          document={docSuppression}
          onFermer={() => setDocSuppression(null)}
          onSupprime={(idSupprime) => {
            setDetailEtat((courant) => (courant?.document.id === idSupprime ? null : courant));
          }}
        />
      )}
    </div>
  );
}

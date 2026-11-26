"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  History,
  Lock,
  RefreshCw,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Alerte, Badge, Bouton, EtatChargement, EtatVide } from "@/components/ui";
import type { VarianteBadge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDroits } from "@/features/habilitations";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterDateHeure, formaterTailleFichier } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  declencherTelechargementBlob,
  lireDocumentGed,
  listerHistoriqueDocumentGed,
  listerVersionsDocumentGed,
  telechargerDocumentGed,
  telechargerVersionDocumentGed,
} from "../adaptateur";
import {
  cleDetailDocumentGed,
  cleHistoriqueDocumentGed,
  cleVersionsDocumentGed,
} from "../cles";
import {
  estApiGedIndisponible,
  extraireExtensionFichier,
  formaterEmpreinteCourte,
  lienSourceDocument,
  peutAjouterVersionDocument,
  peutEpinglerDocument,
  peutPartagerDocument,
  peutSupprimerDocument,
  peutTelechargerGed,
  peutVoirHistoriqueDocument,
} from "../regles";
import type { ActionAuditGed, DocumentGed, VersionDocumentGed } from "../types";

export type OngletDetailGed = "metadonnees" | "versions" | "journal";

const ASCENSEUR_FIN =
  "[scrollbar-width:thin] [scrollbar-color:var(--color-neutral-300)_transparent]";

function varianteAudit(action: ActionAuditGed): VarianteBadge {
  switch (action) {
    case "SUPPRESSION":
    case "REVOCATION_PARTAGE":
      return "erreur";
    case "DEPOT":
    case "NOUVELLE_VERSION":
      return "succes";
    case "PARTAGE":
    case "EPINGLAGE":
      return "avertissement";
    case "TELECHARGEMENT":
      return "primaire";
    default:
      return "information";
  }
}

function iconeAudit(action: ActionAuditGed) {
  switch (action) {
    case "SUPPRESSION":
      return <Trash2 className="size-3.5" aria-hidden="true" />;
    case "DEPOT":
      return <Upload className="size-3.5" aria-hidden="true" />;
    case "NOUVELLE_VERSION":
      return <RefreshCw className="size-3.5" aria-hidden="true" />;
    case "PARTAGE":
    case "REVOCATION_PARTAGE":
      return <Share2 className="size-3.5" aria-hidden="true" />;
    case "EPINGLAGE":
      return <Star className="size-3.5" aria-hidden="true" />;
    case "TELECHARGEMENT":
      return <Download className="size-3.5" aria-hidden="true" />;
    default:
      return <Eye className="size-3.5" aria-hidden="true" />;
  }
}

interface Props {
  ouverte: boolean;
  document: DocumentGed | null;
  ongletInitial?: OngletDetailGed;
  onFermer: () => void;
  onDemanderNouvelleVersion: (document: DocumentGed) => void;
  onDemanderPartage: (document: DocumentGed) => void;
  onDemanderSuppression: (document: DocumentGed) => void;
  onBasculerReference: (document: DocumentGed) => void;
  basculeReferenceEnCours?: boolean;
}

/**
 * Tiroir latéral de consultation d'un document GED (tâches 3.5, 3.7, 3.10) :
 * 1. Métadonnées & Version active (SHA-256 complète, lien F1/F2/F9, actions rapides) ;
 * 2. Historique des versions (`vN`…`v1`) avec téléchargement par version ;
 * 3. Journal chronologique des consultations, partages et suppressions.
 */
export function TiroirDetailDocument({
  ouverte,
  document,
  ongletInitial = "metadonnees",
  onFermer,
  onDemanderNouvelleVersion,
  onDemanderPartage,
  onDemanderSuppression,
  onBasculerReference,
  basculeReferenceEnCours = false,
}: Props) {
  const t = useTranslations("ged");
  const { droits } = useDroits();

  const [ongletActif, setOngletActif] = useState<OngletDetailGed>(ongletInitial);
  const [telechargementId, setTelechargementId] = useState<string | null>(null);
  const [hashCopie, setHashCopie] = useState<string | null>(null);

  const documentId = document?.id ?? "";

  const requeteDetail = useQuery({
    queryKey: cleDetailDocumentGed(documentId),
    queryFn: ({ signal }) => lireDocumentGed(documentId, signal),
    enabled: ouverte && Boolean(documentId),
  });

  const docCourant = requeteDetail.data ?? document;
  const autoriseJournal = docCourant ? peutVoirHistoriqueDocument(droits, docCourant) : false;
  const ongletEffectif: OngletDetailGed =
    ongletActif === "journal" && !autoriseJournal ? "metadonnees" : ongletActif;

  const requeteVersions = useQuery({
    queryKey: cleVersionsDocumentGed(documentId),
    queryFn: ({ signal }) => listerVersionsDocumentGed(documentId, signal),
    enabled:
      ouverte &&
      Boolean(documentId) &&
      ongletEffectif === "versions" &&
      (!requeteDetail.data?.versions || requeteDetail.data.versions.length === 0),
  });

  const requeteHistorique = useQuery({
    queryKey: cleHistoriqueDocumentGed(documentId),
    queryFn: ({ signal }) => listerHistoriqueDocumentGed(documentId, signal),
    enabled: ouverte && Boolean(documentId) && autoriseJournal && ongletEffectif === "journal",
  });

  if (!docCourant) return null;

  const versionActive = docCourant.versionActive;
  const versions: VersionDocumentGed[] =
    requeteDetail.data?.versions && requeteDetail.data.versions.length > 0
      ? requeteDetail.data.versions
      : requeteVersions.data && requeteVersions.data.length > 0
        ? requeteVersions.data
        : versionActive
          ? [versionActive]
          : [];

  const autoriseTelecharger = peutTelechargerGed(droits);
  const autoriseNouvelleVersion = peutAjouterVersionDocument(droits, docCourant);
  const autorisePartager = peutPartagerDocument(droits, docCourant);
  const autoriseEpingler = peutEpinglerDocument(droits, docCourant);
  const autoriseSupprimer = peutSupprimerDocument(droits, docCourant);
  const lienSource = lienSourceDocument(docCourant);

  async function copierHash(valeur: string) {
    if (!valeur) return;
    try {
      await navigator.clipboard.writeText(valeur);
      setHashCopie(valeur);
      toast.success(t("detail.hashCopie"));
      window.setTimeout(() => {
        setHashCopie((courant) => (courant === valeur ? null : courant));
      }, 2000);
    } catch {
      toast.error(t("partage.erreurCopie"));
    }
  }

  async function telechargerActive() {
    if (!docCourant || !autoriseTelecharger) return;
    setTelechargementId("active");
    try {
      const blob = await telechargerDocumentGed(docCourant.id);
      const nomFichier = versionActive?.nomFichier || `${docCourant.nom}.pdf`;
      declencherTelechargementBlob(blob, nomFichier);
      toast.success(t("actions.telechargementLance", { nom: nomFichier }));
    } catch (erreur) {
      toast.error(erreur instanceof ErreurApi ? erreur.message : t("erreurs.telechargementEchoue"));
    } finally {
      setTelechargementId(null);
    }
  }

  async function telechargerVersion(version: VersionDocumentGed) {
    if (!docCourant || !autoriseTelecharger) return;
    setTelechargementId(version.id);
    try {
      const blob = await telechargerVersionDocumentGed(docCourant.id, version.id);
      const nomFichier = version.nomFichier || `${docCourant.nom}_${version.numero}.pdf`;
      declencherTelechargementBlob(blob, nomFichier);
      toast.success(t("actions.telechargementLance", { nom: nomFichier }));
    } catch (erreur) {
      toast.error(erreur instanceof ErreurApi ? erreur.message : t("erreurs.telechargementEchoue"));
    } finally {
      setTelechargementId(null);
    }
  }

  const onglets: { id: OngletDetailGed; libelle: string; compteur?: number }[] = [
    { id: "metadonnees", libelle: t("detail.onglets.metadonnees") },
    {
      id: "versions",
      libelle: t("detail.onglets.versions"),
      compteur: Math.max(docCourant.nombreVersions, versions.length),
    },
    ...(autoriseJournal
      ? [
          {
            id: "journal" as const,
            libelle: t("detail.onglets.journal"),
            compteur: requeteHistorique.data?.length,
          },
        ]
      : []),
  ];

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[620px]">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variante="neutre">{t(`categories.${docCourant.categorie}`)}</Badge>
            <Badge
              variante={docCourant.estAutomatique ? "information" : "neutre"}
              icone={docCourant.estAutomatique ? <Lock size={12} aria-hidden="true" /> : undefined}
            >
              {t(`origines.${docCourant.origine}`)}
            </Badge>
            {docCourant.estReference && (
              <Badge
                variante="avertissement"
                icone={<Star size={12} className="fill-current" aria-hidden="true" />}
              >
                {t("detail.badgeReference")}
              </Badge>
            )}
          </div>
          <SheetTitle className="mt-1 text-lg font-semibold text-neutral-900">
            {docCourant.nom}
          </SheetTitle>
          <SheetDescription>
            {docCourant.projetNom
              ? docCourant.projetReference
                ? `${docCourant.projetNom} (${docCourant.projetReference})`
                : docCourant.projetNom
              : t(`categories.${docCourant.categorie}`)}
          </SheetDescription>
        </SheetHeader>

        <nav
          aria-label={t("detail.navigationOnglets")}
          className="flex gap-1 overflow-x-auto border-0 border-b border-solid border-neutral-200 px-6"
        >
          {onglets.map((onglet) => {
            const actif = ongletEffectif === onglet.id;
            return (
              <button
                key={onglet.id}
                type="button"
                onClick={() => setOngletActif(onglet.id)}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-0 border-b-2 border-solid bg-transparent px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                  actif
                    ? "border-primary text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-800",
                )}
              >
                <span>{onglet.libelle}</span>
                {onglet.compteur !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                      actif
                        ? "bg-primary-100 text-primary-800"
                        : "bg-neutral-100 text-neutral-600",
                    )}
                  >
                    {onglet.compteur}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className={cn("flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5", ASCENSEUR_FIN)}>
          {ongletEffectif === "metadonnees" && (
            <>
              {docCourant.estAutomatique && (
                <Alerte
                  type="information"
                  titre={t("detail.bandeauAutoTitre", {
                    origine: t(`origines.${docCourant.origine}`),
                  })}
                  action={
                    lienSource ? (
                      <Button variant="outline" size="xs" asChild>
                        <Link href={lienSource} onClick={onFermer}>
                          <span>{t(`detail.lienSource.${docCourant.origine}`)}</span>
                          <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    ) : undefined
                  }
                >
                  {t("detail.bandeauAutoDescription")}
                </Alerte>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {autoriseTelecharger && versionActive && (
                  <Bouton
                    variante="primaire"
                    taille="sm"
                    enCours={telechargementId === "active"}
                    iconeGauche={<Download size={16} aria-hidden="true" />}
                    onClick={() => void telechargerActive()}
                  >
                    {t("detail.telechargerVersion", { version: versionActive.numero })}
                  </Bouton>
                )}

                {autoriseNouvelleVersion && (
                  <Bouton
                    variante="secondaire"
                    taille="sm"
                    iconeGauche={<RefreshCw size={16} aria-hidden="true" />}
                    onClick={() => onDemanderNouvelleVersion(docCourant)}
                  >
                    {t("actions.nouvelleVersion")}
                  </Bouton>
                )}

                {autorisePartager && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDemanderPartage(docCourant)}
                  >
                    <Share2 className="size-4" aria-hidden="true" />
                    {t("actions.partager")}
                  </Button>
                )}

                {autoriseEpingler && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={basculeReferenceEnCours}
                    onClick={() => onBasculerReference(docCourant)}
                  >
                    <Star
                      className={cn(
                        "size-4",
                        docCourant.estReference && "fill-avertissement text-avertissement",
                      )}
                      aria-hidden="true"
                    />
                    {docCourant.estReference
                      ? t("actions.retirerReference")
                      : t("actions.epinglerReference")}
                  </Button>
                )}

                {autoriseSupprimer && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-erreur hover:bg-erreur-fond hover:text-erreur"
                    onClick={() => onDemanderSuppression(docCourant)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t("actions.supprimer")}
                  </Button>
                )}
              </div>

              <dl className="m-0 grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-neutral-500">{t("detail.champs.categorie")}</dt>
                  <dd className="m-0 mt-1 text-sm font-medium text-neutral-900">
                    {t(`categories.${docCourant.categorie}`)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-neutral-500">{t("detail.champs.versionActive")}</dt>
                  <dd className="m-0 mt-1 flex items-center gap-2 text-sm font-medium text-neutral-900">
                    <Badge variante="secondaire">{versionActive?.numero ?? ABSENT}</Badge>
                    <span className="text-xs text-neutral-500">
                      {t("detail.totalVersions", { count: docCourant.nombreVersions })}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-neutral-500">{t("detail.champs.nomFichier")}</dt>
                  <dd className="m-0 mt-1 break-all text-sm font-medium text-neutral-900">
                    {versionActive?.nomFichier || ABSENT}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-neutral-500">{t("detail.champs.tailleEtFormat")}</dt>
                  <dd className="m-0 mt-1 text-sm text-neutral-800 tabular-nums">
                    {versionActive
                      ? `${formaterTailleFichier(versionActive.taille)}${
                          extraireExtensionFichier(versionActive.nomFichier)
                            ? ` · ${extraireExtensionFichier(versionActive.nomFichier)}`
                            : ""
                        }`
                      : ABSENT}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-neutral-500">{t("detail.champs.mimeType")}</dt>
                  <dd className="m-0 mt-1 font-mono text-xs text-neutral-700">
                    {versionActive?.mimeType || ABSENT}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-neutral-500">{t("detail.champs.auteurEtDate")}</dt>
                  <dd className="m-0 mt-1 text-sm text-neutral-800">
                    <div>{versionActive?.auteur?.nomComplet || docCourant.createur?.nomComplet || ABSENT}</div>
                    <div className="text-xs text-neutral-500 tabular-nums">
                      {formaterDateHeure(versionActive?.creeLe || docCourant.modifieLe)}
                    </div>
                  </dd>
                </div>

                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-neutral-500">{t("detail.champs.description")}</dt>
                  <dd className="m-0 mt-1 text-sm text-neutral-800">
                    {docCourant.description || versionActive?.commentaire || ABSENT}
                  </dd>
                </div>

                {versionActive?.commentaire && docCourant.description && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-neutral-500">
                      {t("detail.champs.noteVersionActive")}
                    </dt>
                    <dd className="m-0 mt-1 text-sm text-neutral-800">{versionActive.commentaire}</dd>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                    <ShieldCheck className="size-3.5 text-succes" aria-hidden="true" />
                    <span>{t("detail.champs.empreinteSha256")}</span>
                  </dt>
                  <dd className="m-0 mt-1.5 flex items-start gap-2 rounded border border-neutral-200 bg-card px-2.5 py-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-xs text-neutral-700">
                      {versionActive?.hashSha256 || ABSENT}
                    </code>
                    {versionActive?.hashSha256 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t("detail.copierHash")}
                        onClick={() => void copierHash(versionActive.hashSha256)}
                      >
                        {hashCopie === versionActive.hashSha256 ? (
                          <Check className="size-3.5 text-succes" aria-hidden="true" />
                        ) : (
                          <Copy className="size-3.5" aria-hidden="true" />
                        )}
                      </Button>
                    )}
                  </dd>
                </div>
              </dl>
            </>
          )}

          {ongletEffectif === "versions" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-sm text-neutral-600">
                  {t("detail.versionsDescription")}
                </p>
                {autoriseNouvelleVersion && (
                  <Bouton
                    variante="primaire"
                    taille="sm"
                    iconeGauche={<RefreshCw size={16} aria-hidden="true" />}
                    onClick={() => onDemanderNouvelleVersion(docCourant)}
                  >
                    {t("actions.nouvelleVersion")}
                  </Bouton>
                )}
              </div>

              {requeteDetail.isPending && versions.length === 0 ? (
                <EtatChargement />
              ) : requeteVersions.isPending && versions.length === 0 ? (
                <EtatChargement />
              ) : versions.length === 0 ? (
                <EtatVide
                  icone={<FileText size={28} strokeWidth={1.5} />}
                  titre={t("detail.aucuneVersion")}
                />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {versions.map((version, index) => {
                    const estActive =
                      version.estActive ||
                      (versionActive ? version.id === versionActive.id : index === 0);

                    return (
                      <li
                        key={version.id}
                        className={cn(
                          "flex flex-col gap-2.5 rounded-lg border p-3.5",
                          estActive
                            ? "border-primary-200 bg-primary-50/40"
                            : "border-neutral-200 bg-card",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variante="secondaire">{version.numero}</Badge>
                            {estActive && (
                              <Badge variante="succes">{t("detail.badgeActive")}</Badge>
                            )}
                            <span className="text-xs text-neutral-500 tabular-nums">
                              {formaterDateHeure(version.creeLe)}
                            </span>
                          </div>

                          {autoriseTelecharger && (
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              disabled={telechargementId === version.id}
                              onClick={() => void telechargerVersion(version)}
                            >
                              <Download className="size-3.5" aria-hidden="true" />
                              {t("actions.telecharger")}
                            </Button>
                          )}
                        </div>

                        {version.commentaire && (
                          <p className="m-0 text-sm text-neutral-800">{version.commentaire}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                          <span className="font-medium text-neutral-700">
                            {version.auteur?.nomComplet || ABSENT}
                          </span>
                          <span className="truncate">{version.nomFichier}</span>
                          <span className="tabular-nums">
                            {formaterTailleFichier(version.taille)}
                          </span>
                          {version.hashSha256 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => void copierHash(version.hashSha256)}
                                  className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-mono text-xs text-neutral-600 hover:text-primary-600"
                                >
                                  <span>{formaterEmpreinteCourte(version.hashSha256, 10)}</span>
                                  {hashCopie === version.hashSha256 ? (
                                    <Check className="size-3 text-succes" aria-hidden="true" />
                                  ) : (
                                    <Copy className="size-3" aria-hidden="true" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{version.hashSha256}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {autoriseJournal && ongletEffectif === "journal" && (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-sm text-neutral-600">{t("detail.journalDescription")}</p>

              {requeteHistorique.isPending ? (
                <EtatChargement />
              ) : requeteHistorique.isError ? (
                <Alerte type="information">
                  {estApiGedIndisponible(requeteHistorique.error)
                    ? t("detail.journalIndisponible")
                    : t("erreurs.chargementJournal")}
                </Alerte>
              ) : (requeteHistorique.data?.length ?? 0) === 0 ? (
                <EtatVide
                  icone={<History size={28} strokeWidth={1.5} />}
                  titre={t("detail.journalVideTitre")}
                  description={t("detail.journalVideDescription")}
                />
              ) : (
                <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {(requeteHistorique.data ?? []).map((ev) => (
                    <li
                      key={ev.id}
                      className="flex flex-col gap-1.5 rounded-md border border-neutral-200 bg-card p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variante={varianteAudit(ev.action)} icone={iconeAudit(ev.action)}>
                          {ev.actionLibelle || ev.action}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-500 tabular-nums">
                          <Clock className="size-3" aria-hidden="true" />
                          {formaterDateHeure(ev.creeLe)}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-neutral-900">
                        {ev.utilisateur?.nomComplet || ABSENT}
                      </div>
                      {ev.details && (
                        <p className="m-0 text-xs text-neutral-600">{ev.details}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-neutral-200 px-6 py-4">
          <div className="flex justify-end">
            <Bouton variante="secondaire" taille="sm" onClick={onFermer}>
              {t("actions.fermer")}
            </Bouton>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Check,
  Clock,
  ClockAlert,
  Copy,
  Download,
  FileText,
  FileX2,
  FolderKanban,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { MarqueCCD } from "@/components/layout/MarqueCCD";
import { Alerte, Badge, Bouton, Carte, EtatChargement, EtatErreur } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterDateHeure, formaterTailleFichier } from "@/lib/format";

import {
  declencherTelechargementBlob,
  lireDocumentPartagePublic,
  telechargerDocumentPartagePublic,
} from "../adaptateur";
import { clePartagePublicGed } from "../cles";
import { extraireExtensionFichier, partageEstExpire } from "../regles";

interface Props {
  jeton: string;
}

/**
 * Écran public de consultation et téléchargement d'un document partagé (`/partage/[jeton]`).
 *
 * Accessible sans authentification (client anonyme `apiPlateforme`). Gère
 * distinctement les liens expirés/révoqués (`410`), introuvables (`404`) et
 * les pannes réseau.
 */
export function PageDocumentPartage({ jeton }: Props) {
  const t = useTranslations("ged");
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [hashCopie, setHashCopie] = useState(false);

  const requete = useQuery({
    queryKey: clePartagePublicGed(jeton),
    queryFn: ({ signal }) => lireDocumentPartagePublic(jeton, signal),
    retry: false,
  });

  const erreurApi = requete.error instanceof ErreurApi ? requete.error : null;
  const estExpireServeur =
    erreurApi !== null &&
    (erreurApi.statut === 410 ||
      erreurApi.code === "partage_expire" ||
      erreurApi.code === "jeton_expire" ||
      erreurApi.code === "jeton_revoque");
  const estIntrouvable =
    erreurApi !== null && (erreurApi.statut === 404 || erreurApi.code === "introuvable");

  const donnees = requete.data;
  const estExpireClient = donnees
    ? partageEstExpire({ expireLe: donnees.expireLe, revoque: false })
    : false;

  async function telecharger() {
    if (!donnees) return;
    setTelechargementEnCours(true);
    try {
      const blob = await telechargerDocumentPartagePublic(jeton);
      const nomFichier = donnees.document.nomFichier || `${donnees.document.nom}.pdf`;
      declencherTelechargementBlob(blob, nomFichier);
      toast.success(t("actions.telechargementLance", { nom: nomFichier }));
    } catch (erreur) {
      if (erreur instanceof ErreurApi && (erreur.statut === 410 || erreur.code === "partage_expire")) {
        toast.error(t("partagePublic.expireTitre"));
        void requete.refetch();
        return;
      }
      toast.error(erreur instanceof ErreurApi ? erreur.message : t("erreurs.telechargementEchoue"));
    } finally {
      setTelechargementEnCours(false);
    }
  }

  async function copierHash(hash: string) {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setHashCopie(true);
      toast.success(t("detail.hashCopie"));
      window.setTimeout(() => setHashCopie(false), 2000);
    } catch {
      toast.error(t("partage.erreurCopie"));
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-0 border-b border-solid border-neutral-200 bg-neutral-0 px-4 py-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <MarqueCCD taille={34} />
          {donnees?.entrepriseNom && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              <Building2 className="size-3.5 text-neutral-500" aria-hidden="true" />
              <span className="max-w-48 truncate">{donnees.entrepriseNom}</span>
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8 sm:px-8">
        {requete.isPending ? (
          <Carte>
            <EtatChargement message={t("partagePublic.chargement")} />
          </Carte>
        ) : estExpireServeur || estExpireClient ? (
          <Carte className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-avertissement-fond text-avertissement">
              <ClockAlert className="size-7" aria-hidden="true" />
            </span>
            <h1 className="m-0 text-xl font-bold text-neutral-900">
              {t("partagePublic.expireTitre")}
            </h1>
            <p className="m-0 max-w-[46ch] text-sm text-neutral-600">
              {t("partagePublic.expireDescription")}
            </p>
          </Carte>
        ) : estIntrouvable ? (
          <Carte className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-erreur-fond text-erreur">
              <FileX2 className="size-7" aria-hidden="true" />
            </span>
            <h1 className="m-0 text-xl font-bold text-neutral-900">
              {t("partagePublic.introuvableTitre")}
            </h1>
            <p className="m-0 max-w-[46ch] text-sm text-neutral-600">
              {t("partagePublic.introuvableDescription")}
            </p>
          </Carte>
        ) : requete.isError || !donnees ? (
          <Carte>
            <EtatErreur
              message={erreurApi?.message ?? t("partagePublic.erreurGenerique")}
              reference={erreurApi?.traceId ?? null}
              onReessayer={() => void requete.refetch()}
            />
          </Carte>
        ) : (
          <div className="flex flex-col gap-5">
            <Carte className="flex flex-col gap-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-0 border-b border-solid border-neutral-200 pb-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variante="neutre">
                      {t(`categories.${donnees.document.categorie}`)}
                    </Badge>
                    <Badge variante="secondaire">{donnees.document.version}</Badge>
                  </div>
                  <h1 className="m-0 mt-2 text-h3 font-bold text-neutral-900">
                    {donnees.document.nom}
                  </h1>
                  {donnees.projetNom && (
                    <p className="m-0 mt-1.5 inline-flex items-center gap-1.5 text-sm text-neutral-600">
                      <FolderKanban className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                      <span>
                        {donnees.projetReference
                          ? `${donnees.projetNom} (${donnees.projetReference})`
                          : donnees.projetNom}
                      </span>
                    </p>
                  )}
                </div>

                <Bouton
                  variante="primaire"
                  taille="md"
                  enCours={telechargementEnCours}
                  iconeGauche={<Download size={18} aria-hidden="true" />}
                  onClick={() => void telecharger()}
                >
                  {t("partagePublic.telecharger")}
                </Bouton>
              </div>

              {(donnees.destinataire || donnees.note) && (
                <Alerte
                  type="information"
                  titre={
                    donnees.destinataire
                      ? t("partagePublic.destinataireTitre", { destinataire: donnees.destinataire })
                      : t("partagePublic.noteTitre")
                  }
                >
                  {donnees.note || t("partagePublic.accesTemporaire")}
                </Alerte>
              )}

              {donnees.document.description && (
                <p className="m-0 text-sm leading-relaxed text-neutral-700">
                  {donnees.document.description}
                </p>
              )}

              <dl className="m-0 grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    {t("partagePublic.champs.entreprise")}
                  </dt>
                  <dd className="m-0 mt-1 text-sm font-medium text-neutral-900">
                    {donnees.entrepriseNom || ABSENT}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    {t("partagePublic.champs.fichier")}
                  </dt>
                  <dd className="m-0 mt-1 flex items-center gap-1.5 break-all text-sm font-medium text-neutral-900">
                    <FileText className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                    <span>{donnees.document.nomFichier || ABSENT}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    {t("partagePublic.champs.tailleFormat")}
                  </dt>
                  <dd className="m-0 mt-1 text-sm text-neutral-800 tabular-nums">
                    {formaterTailleFichier(donnees.document.taille)}
                    {extraireExtensionFichier(donnees.document.nomFichier)
                      ? ` · ${extraireExtensionFichier(donnees.document.nomFichier)}`
                      : ""}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    {t("partagePublic.champs.deposeLe")}
                  </dt>
                  <dd className="m-0 mt-1 text-sm text-neutral-800 tabular-nums">
                    {formaterDateHeure(donnees.document.deposeLe)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    {t("partagePublic.champs.mimeType")}
                  </dt>
                  <dd className="m-0 mt-1 font-mono text-xs text-neutral-700">
                    {donnees.document.mimeType || ABSENT}
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-1 text-xs font-medium text-neutral-500">
                    <Clock className="size-3.5 text-avertissement" aria-hidden="true" />
                    <span>{t("partagePublic.champs.expireLe")}</span>
                  </dt>
                  <dd className="m-0 mt-1 text-sm font-medium text-neutral-900 tabular-nums">
                    {formaterDateHeure(donnees.expireLe)}
                  </dd>
                </div>

                <div className="sm:col-span-2">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                    <ShieldCheck className="size-3.5 text-succes" aria-hidden="true" />
                    <span>{t("detail.champs.empreinteSha256")}</span>
                  </dt>
                  <dd className="m-0 mt-1.5 flex items-start gap-2 rounded border border-neutral-200 bg-card px-2.5 py-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-xs text-neutral-700">
                      {donnees.document.hashSha256 || ABSENT}
                    </code>
                    {donnees.document.hashSha256 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t("detail.copierHash")}
                        onClick={() => void copierHash(donnees.document.hashSha256)}
                      >
                        {hashCopie ? (
                          <Check className="size-3.5 text-succes" aria-hidden="true" />
                        ) : (
                          <Copy className="size-3.5" aria-hidden="true" />
                        )}
                      </Button>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-col items-center justify-between gap-3 border-0 border-t border-solid border-neutral-200 pt-4 sm:flex-row">
                <p className="m-0 text-xs text-neutral-500">{t("partagePublic.mentionSecurite")}</p>
                <Bouton
                  variante="primaire"
                  taille="sm"
                  enCours={telechargementEnCours}
                  iconeGauche={<Download size={16} aria-hidden="true" />}
                  onClick={() => void telecharger()}
                >
                  {t("partagePublic.telecharger")}
                </Bouton>
              </div>
            </Carte>
          </div>
        )}
      </main>
    </div>
  );
}

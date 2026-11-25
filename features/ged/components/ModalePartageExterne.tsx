"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Copy, ExternalLink, Link2, Share2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Alerte, Badge, Bouton, Champ, EtatChargement, EtatVide, Modale } from "@/components/ui";
import type { VarianteBadge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErreurApi } from "@/lib/api";
import { formaterDateHeure } from "@/lib/format";

import {
  creerPartageDocumentGed,
  listerPartagesDocumentGed,
  revoquerPartageDocumentGed,
} from "../adaptateur";
import { cleHistoriqueDocumentGed, clePartagesDocumentGed } from "../cles";
import {
  DUREE_PARTAGE_HEURES,
  estApiGedIndisponible,
  statutLienPartage,
  urlCompletePartage,
} from "../regles";
import type { DocumentGed, LienPartageGed, StatutLienPartageGed } from "../types";
import {
  LONGUEUR_MAX_DESTINATAIRE_PARTAGE,
  LONGUEUR_MAX_NOTE_PARTAGE,
  schemaPartageExterne,
} from "../validations";

const VARIANTE_STATUT: Record<StatutLienPartageGed, VarianteBadge> = {
  actif: "succes",
  expire: "neutre",
  revoque: "erreur",
};

interface Props {
  ouverte: boolean;
  document: DocumentGed | null;
  onFermer: () => void;
}

/**
 * Modale de partage externe temporaire (72 h) d'un document GED.
 *
 * Permet de générer un lien public sans compte, de le copier en un clic, de
 * consulter les liens existants (statut, expiration, consultations) et de les
 * révoquer immédiatement.
 */
export function ModalePartageExterne({ ouverte, document, onFermer }: Props) {
  const t = useTranslations("ged");
  const clientRequetes = useQueryClient();

  const [destinataire, setDestinataire] = useState("");
  const [note, setNote] = useState("");
  const [erreursChamps, setErreursChamps] = useState<Record<string, string>>({});
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);
  const [dernierLienCree, setDernierLienCree] = useState<LienPartageGed | null>(null);
  const [copieId, setCopieId] = useState<string | null>(null);
  const [revocationEnCoursId, setRevocationEnCoursId] = useState<string | null>(null);

  const documentId = document?.id ?? "";

  const requetePartages = useQuery({
    queryKey: clePartagesDocumentGed(documentId),
    queryFn: ({ signal }) => listerPartagesDocumentGed(documentId, signal),
    enabled: ouverte && Boolean(documentId),
  });

  const mutationCreation = useMutation({
    mutationFn: (saisie: { destinataire: string; note: string }) =>
      creerPartageDocumentGed(documentId, saisie),
    onSuccess: (lienCree) => {
      setDernierLienCree(lienCree);
      setDestinataire("");
      setNote("");
      setErreurCreation(null);
      void clientRequetes.invalidateQueries({ queryKey: clePartagesDocumentGed(documentId) });
      void clientRequetes.invalidateQueries({ queryKey: cleHistoriqueDocumentGed(documentId) });
      toast.success(t("partage.succesCreation"));
    },
    onError: (erreur) => {
      if (erreur instanceof ErreurApi) {
        setErreurCreation(erreur.message);
        return;
      }
      setErreurCreation(t("erreurs.partageEchoue"));
    },
  });

  const mutationRevocation = useMutation({
    mutationFn: (partageId: string) => revoquerPartageDocumentGed(partageId),
    onMutate: (partageId) => {
      setRevocationEnCoursId(partageId);
    },
    onSuccess: (_data, partageId) => {
      if (dernierLienCree?.id === partageId) {
        setDernierLienCree(null);
      }
      void clientRequetes.invalidateQueries({ queryKey: clePartagesDocumentGed(documentId) });
      void clientRequetes.invalidateQueries({ queryKey: cleHistoriqueDocumentGed(documentId) });
      toast.success(t("partage.succesRevocation"));
    },
    onError: (erreur) => {
      toast.error(erreur instanceof ErreurApi ? erreur.message : t("erreurs.revocationEchouee"));
    },
    onSettled: () => {
      setRevocationEnCoursId(null);
    },
  });

  if (!document) return null;

  const origineNavigateur = typeof window !== "undefined" ? window.location.origin : "";

  async function copierUrl(partage: LienPartageGed) {
    const url = urlCompletePartage(partage.urlPublique, origineNavigateur);
    try {
      await navigator.clipboard.writeText(url);
      setCopieId(partage.id);
      toast.success(t("partage.lienCopie"));
      window.setTimeout(() => {
        setCopieId((courant) => (courant === partage.id ? null : courant));
      }, 2500);
    } catch {
      toast.error(t("partage.erreurCopie"));
    }
  }

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreurCreation(null);

    const schema = schemaPartageExterne({
      destinataireTropLong: t("validation.champTropLong", {
        max: LONGUEUR_MAX_DESTINATAIRE_PARTAGE,
      }),
      noteTropLongue: t("validation.champTropLong", { max: LONGUEUR_MAX_NOTE_PARTAGE }),
    });

    const analyse = schema.safeParse({ destinataire, note });
    if (!analyse.success) {
      const erreurs: Record<string, string> = {};
      for (const issue of analyse.error.issues) {
        const cle = String(issue.path[0] ?? "");
        if (cle && !erreurs[cle]) erreurs[cle] = issue.message;
      }
      setErreursChamps(erreurs);
      return;
    }

    setErreursChamps({});
    mutationCreation.mutate(analyse.data);
  }

  const partages = requetePartages.data ?? [];

  return (
    <Modale
      ouverte={ouverte}
      titre={t("partage.titre")}
      taille="large"
      libelleFermeture={t("actions.fermer")}
      onFermer={onFermer}
      actions={
        <Bouton variante="secondaire" taille="sm" onClick={onFermer}>
          {t("actions.fermer")}
        </Bouton>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
          <p className="m-0 truncate text-sm font-semibold text-neutral-900">{document.nom}</p>
          <p className="m-0 mt-0.5 flex items-center gap-1.5 text-xs text-neutral-600">
            <Clock className="size-3.5 shrink-0 text-information" aria-hidden="true" />
            <span>{t("partage.infoDuree", { heures: DUREE_PARTAGE_HEURES })}</span>
          </p>
        </div>

        {dernierLienCree && (
          <Alerte type="succes" titre={t("partage.lienGenereTitre")}>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded border border-succes/30 bg-card px-2.5 py-1.5">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-800">
                  {urlCompletePartage(dernierLienCree.urlPublique, origineNavigateur)}
                </code>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => void copierUrl(dernierLienCree)}
                >
                  {copieId === dernierLienCree.id ? (
                    <>
                      <Check className="size-3.5 text-succes" aria-hidden="true" />
                      {t("partage.copie")}
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" />
                      {t("partage.copier")}
                    </>
                  )}
                </Button>
              </div>
              <p className="m-0 text-xs text-neutral-600">
                {t("partage.expireLe", { date: formaterDateHeure(dernierLienCree.expireLe) })}
              </p>
            </div>
          </Alerte>
        )}

        <form
          onSubmit={soumettre}
          noValidate
          className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4"
        >
          <h3 className="m-0 text-sm font-semibold text-neutral-900">
            {t("partage.sectionNouveau")}
          </h3>

          {erreurCreation && <Alerte type="erreur">{erreurCreation}</Alerte>}

          <Champ
            libelle={t("partage.champDestinataire")}
            taille="md"
            value={destinataire}
            onChange={(e) => setDestinataire(e.target.value)}
            placeholder={t("partage.placeholderDestinataire")}
            erreur={erreursChamps.destinataire}
            disabled={mutationCreation.isPending}
            className="mb-0"
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ged-partage-note">{t("partage.champNote")}</Label>
            <Textarea
              id="ged-partage-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("partage.placeholderNote")}
              disabled={mutationCreation.isPending}
              aria-invalid={Boolean(erreursChamps.note)}
            />
            {erreursChamps.note && (
              <p className="m-0 text-xs font-medium text-erreur">{erreursChamps.note}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Bouton
              type="submit"
              variante="primaire"
              taille="sm"
              enCours={mutationCreation.isPending}
              iconeGauche={<Share2 size={16} aria-hidden="true" />}
            >
              {t("partage.generer", { heures: DUREE_PARTAGE_HEURES })}
            </Bouton>
          </div>
        </form>

        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-sm font-semibold text-neutral-900">
            {t("partage.sectionExistants", { count: partages.length })}
          </h3>

          {requetePartages.isPending ? (
            <EtatChargement />
          ) : requetePartages.isError ? (
            <Alerte type="information">
              {estApiGedIndisponible(requetePartages.error)
                ? t("partage.indisponible")
                : t("erreurs.chargementPartages")}
            </Alerte>
          ) : partages.length === 0 ? (
            <EtatVide
              icone={<Link2 size={28} strokeWidth={1.5} />}
              titre={t("partage.aucunLienTitre")}
              description={t("partage.aucunLienDescription")}
            />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {partages.map((lien) => {
                const statut = statutLienPartage(lien);
                const estActif = statut === "actif";
                const urlAbsolue = urlCompletePartage(lien.urlPublique, origineNavigateur);

                return (
                  <li
                    key={lien.id}
                    className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-card p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variante={VARIANTE_STATUT[statut]}>
                            {t(`partage.statuts.${statut}`)}
                          </Badge>
                          {lien.destinataire && (
                            <span className="text-sm font-semibold text-neutral-900">
                              {lien.destinataire}
                            </span>
                          )}
                        </div>
                        {lien.note && (
                          <p className="m-0 mt-1 text-xs text-neutral-600">{lien.note}</p>
                        )}
                      </div>

                      {estActif && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => void copierUrl(lien)}
                          >
                            {copieId === lien.id ? (
                              <>
                                <Check className="size-3.5 text-succes" aria-hidden="true" />
                                {t("partage.copie")}
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5" aria-hidden="true" />
                                {t("partage.copier")}
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            asChild
                          >
                            <a
                              href={urlAbsolue}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={t("partage.ouvrirLien")}
                            >
                              <ExternalLink className="size-3.5" aria-hidden="true" />
                            </a>
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="text-erreur hover:bg-erreur-fond hover:text-erreur"
                            disabled={revocationEnCoursId === lien.id}
                            onClick={() => mutationRevocation.mutate(lien.id)}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            {t("partage.revoquer")}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                      <span>
                        {t("partage.expireLe", { date: formaterDateHeure(lien.expireLe) })}
                      </span>
                      <span>
                        {t("partage.consultations", { count: lien.consultations })}
                      </span>
                      {lien.creePar?.nomComplet && (
                        <span>{t("partage.creePar", { auteur: lien.creePar.nomComplet })}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Modale>
  );
}

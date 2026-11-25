"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Alerte, Bouton, Modale } from "@/components/ui";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErreurApi } from "@/lib/api";

import { supprimerDocumentGed } from "../adaptateur";
import { CLE_TOUTES_LISTES_DOCUMENTS_GED, cleDetailDocumentGed } from "../cles";
import type { DocumentGed } from "../types";
import { LONGUEUR_MAX_MOTIF_SUPPRESSION, schemaSuppressionDocument } from "../validations";

interface Props {
  ouverte: boolean;
  document: DocumentGed | null;
  onFermer: () => void;
  onSupprime?: (documentId: string) => void;
}

/**
 * Modale de confirmation de suppression d'un document GED manuel.
 *
 * Bloque explicitement toute tentative sur un document archivé automatiquement
 * (`estAutomatique=true`) et permet de consigner un motif dans le journal d'audit.
 */
export function ModaleSuppressionDocument({ ouverte, document, onFermer, onSupprime }: Props) {
  const t = useTranslations("ged");
  const clientRequetes = useQueryClient();

  const [motif, setMotif] = useState("");
  const [erreurMotif, setErreurMotif] = useState<string | null>(null);
  const [erreurApi, setErreurApi] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (motifSaisi: string) => {
      if (!document) throw new Error("document");
      await supprimerDocumentGed(document.id, motifSaisi);
      return document.id;
    },
    onSuccess: (documentId) => {
      void clientRequetes.invalidateQueries({ queryKey: CLE_TOUTES_LISTES_DOCUMENTS_GED });
      clientRequetes.removeQueries({ queryKey: cleDetailDocumentGed(documentId) });
      if (document) {
        toast.success(t("suppression.succes", { nom: document.nom }));
      }
      onSupprime?.(documentId);
      onFermer();
    },
    onError: (erreur) => {
      if (erreur instanceof ErreurApi) {
        if (erreur.code === "document_automatique_non_supprimable") {
          setErreurApi(t("suppression.automatiqueDescription"));
          return;
        }
        setErreurApi(erreur.message);
        return;
      }
      setErreurApi(t("erreurs.suppressionEchouee"));
    },
  });

  if (!document) return null;

  const estBloqueAutomatique = document.estAutomatique;
  const idFormulaire = "formulaire-suppression-document-ged";

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (estBloqueAutomatique) return;

    setErreurApi(null);
    const schema = schemaSuppressionDocument({
      motifTropLong: t("validation.champTropLong", { max: LONGUEUR_MAX_MOTIF_SUPPRESSION }),
    });
    const analyse = schema.safeParse({ motif });
    if (!analyse.success) {
      setErreurMotif(analyse.error.issues[0]?.message ?? null);
      return;
    }

    setErreurMotif(null);
    mutation.mutate(analyse.data.motif);
  }

  return (
    <Modale
      ouverte={ouverte}
      titre={t("suppression.titre")}
      libelleFermeture={t("actions.fermer")}
      onFermer={mutation.isPending ? undefined : onFermer}
      actions={
        <>
          <Bouton
            variante="ghost"
            taille="sm"
            onClick={onFermer}
            disabled={mutation.isPending}
          >
            {t("actions.annuler")}
          </Bouton>
          {!estBloqueAutomatique && (
            <Bouton
              type="submit"
              form={idFormulaire}
              variante="danger"
              taille="sm"
              enCours={mutation.isPending}
              iconeGauche={<Trash2 size={16} aria-hidden="true" />}
            >
              {t("suppression.confirmer")}
            </Bouton>
          )}
        </>
      }
    >
      {estBloqueAutomatique ? (
        <Alerte type="avertissement" titre={t("suppression.automatiqueTitre")}>
          <span className="inline-flex items-start gap-2">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t("suppression.automatiqueDescription")}</span>
          </span>
        </Alerte>
      ) : (
        <form id={idFormulaire} onSubmit={soumettre} noValidate className="flex flex-col gap-4">
          {erreurApi && <Alerte type="erreur">{erreurApi}</Alerte>}

          <p className="m-0 text-sm text-neutral-700">
            {t.rich("suppression.confirmation", {
              nom: document.nom,
              versions: document.nombreVersions,
              fort: (morceaux) => (
                <strong className="font-semibold text-neutral-900">{morceaux}</strong>
              ),
            })}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ged-suppression-motif">{t("suppression.champMotif")}</Label>
            <Textarea
              id="ged-suppression-motif"
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                if (erreurMotif) setErreurMotif(null);
              }}
              placeholder={t("suppression.placeholderMotif")}
              disabled={mutation.isPending}
              aria-invalid={Boolean(erreurMotif)}
            />
            {erreurMotif && <p className="m-0 text-xs font-medium text-erreur">{erreurMotif}</p>}
          </div>
        </form>
      )}
    </Modale>
  );
}

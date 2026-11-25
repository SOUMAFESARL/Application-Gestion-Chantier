"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Alerte, Badge, Bouton, Modale } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ZoneDepotFichiers } from "@/components/ui/zone-depot-fichiers";
import { ErreurApi } from "@/lib/api";

import { ajouterVersionDocumentGed } from "../adaptateur";
import {
  CLE_TOUTES_LISTES_DOCUMENTS_GED,
  cleDetailDocumentGed,
  cleHistoriqueDocumentGed,
  cleVersionsDocumentGed,
} from "../cles";
import { ACCEPT_FICHIERS_GED, validerFichierGed } from "../regles";
import type { DocumentGed, VersionDocumentGed } from "../types";
import { LONGUEUR_MAX_COMMENTAIRE_VERSION, schemaNouvelleVersion } from "../validations";

interface Props {
  ouverte: boolean;
  document: DocumentGed | null;
  onFermer: () => void;
  onSucces?: (version: VersionDocumentGed) => void;
}

/**
 * Modale de publication d'une nouvelle version (`vN+1`) d'un document manuel.
 *
 * La note de révision est strictement obligatoire : toute validation vide est
 * bloquée avant l'envoi sur `POST /api/v1/ged/documents/{id}/versions/`.
 */
export function ModaleNouvelleVersion({ ouverte, document, onFermer, onSucces }: Props) {
  const t = useTranslations("ged");
  const clientRequetes = useQueryClient();

  const [fichiers, setFichiers] = useState<File[]>([]);
  const [commentaire, setCommentaire] = useState("");
  const [estReference, setEstReference] = useState(() => document?.estReference ?? false);
  const [erreursChamps, setErreursChamps] = useState<Record<string, string>>({});
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (saisie: { fichier: File; commentaire: string; estReference: boolean }) => {
      if (!document) throw new Error("document");
      return ajouterVersionDocumentGed(document.id, saisie);
    },
    onSuccess: (versionCreee) => {
      if (document) {
        void clientRequetes.invalidateQueries({ queryKey: CLE_TOUTES_LISTES_DOCUMENTS_GED });
        void clientRequetes.invalidateQueries({ queryKey: cleDetailDocumentGed(document.id) });
        void clientRequetes.invalidateQueries({ queryKey: cleVersionsDocumentGed(document.id) });
        void clientRequetes.invalidateQueries({ queryKey: cleHistoriqueDocumentGed(document.id) });
        toast.success(
          t("nouvelleVersion.succes", {
            version: versionCreee.numero,
            nom: document.nom,
          }),
        );
      }
      onSucces?.(versionCreee);
      onFermer();
    },
    onError: (erreur) => {
      if (erreur instanceof ErreurApi) {
        if (Object.keys(erreur.erreursParChamp).length > 0) {
          setErreursChamps(erreur.erreursParChamp);
        }
        setErreurGlobale(erreur.message);
        return;
      }
      setErreurGlobale(t("erreurs.versionEchouee"));
    },
  });

  if (!document) return null;

  const numeroCourant = document.versionActive?.numeroVersion ?? document.nombreVersions;
  const prochainNumero = `v${numeroCourant + 1}`;
  const idFormulaire = "formulaire-nouvelle-version-ged";

  function refuserFichier(fichier: File): string | null {
    const code = validerFichierGed(fichier);
    if (!code) return null;
    return t(`validation.fichier.${code}`);
  }

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreurGlobale(null);

    const schema = schemaNouvelleVersion({
      commentaireRequis: t("validation.noteRevisionRequise"),
      commentaireTropLong: t("validation.champTropLong", {
        max: LONGUEUR_MAX_COMMENTAIRE_VERSION,
      }),
    });

    const analyse = schema.safeParse({ commentaire, estReference });
    const nouvellesErreurs: Record<string, string> = {};

    if (!analyse.success) {
      for (const issue of analyse.error.issues) {
        const cle = String(issue.path[0] ?? "");
        if (cle && !nouvellesErreurs[cle]) {
          nouvellesErreurs[cle] = issue.message;
        }
      }
    }

    const fichier = fichiers[0];
    if (!fichier) {
      nouvellesErreurs.fichier = t("validation.fichierRequis");
    } else {
      const erreurFichier = validerFichierGed(fichier);
      if (erreurFichier) {
        nouvellesErreurs.fichier = t(`validation.fichier.${erreurFichier}`);
      }
    }

    if (Object.keys(nouvellesErreurs).length > 0 || !analyse.success || !fichier) {
      setErreursChamps(nouvellesErreurs);
      return;
    }

    setErreursChamps({});
    mutation.mutate({
      fichier,
      commentaire: analyse.data.commentaire,
      estReference: analyse.data.estReference,
    });
  }

  return (
    <Modale
      ouverte={ouverte}
      titre={t("nouvelleVersion.titre")}
      taille="large"
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
          <Bouton
            type="submit"
            form={idFormulaire}
            variante="primaire"
            taille="sm"
            enCours={mutation.isPending}
            iconeGauche={<RefreshCw size={16} aria-hidden="true" />}
          >
            {t("nouvelleVersion.soumettre", { version: prochainNumero })}
          </Bouton>
        </>
      }
    >
      <form id={idFormulaire} onSubmit={soumettre} noValidate className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="m-0 truncate text-sm font-semibold text-neutral-900">{document.nom}</p>
            <p className="m-0 text-xs text-neutral-500">
              {t("nouvelleVersion.sousTitre", {
                courante: document.versionActive?.numero ?? `v${numeroCourant}`,
                suivante: prochainNumero,
              })}
            </p>
          </div>
          <Badge variante="secondaire">{prochainNumero}</Badge>
        </div>

        {erreurGlobale && <Alerte type="erreur">{erreurGlobale}</Alerte>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ged-version-fichier">
            {t("nouvelleVersion.champFichier")}
            <span className="ml-0.5 text-erreur" aria-hidden="true">
              *
            </span>
          </Label>
          <ZoneDepotFichiers
            id="ged-version-fichier"
            fichiers={fichiers}
            onChange={(suivants) => {
              setFichiers(suivants);
              if (erreursChamps.fichier) {
                setErreursChamps((p) => ({ ...p, fichier: "" }));
              }
            }}
            multiple={false}
            accept={ACCEPT_FICHIERS_GED}
            refuser={refuserFichier}
            consigne={t("depot.consigneFichier")}
            disabled={mutation.isPending}
            aria-invalid={Boolean(erreursChamps.fichier)}
          />
          {erreursChamps.fichier && (
            <p className="m-0 text-xs font-medium text-erreur">{erreursChamps.fichier}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ged-version-commentaire">
            {t("nouvelleVersion.champCommentaire")}
            <span className="ml-0.5 text-erreur" aria-hidden="true">
              *
            </span>
          </Label>
          <Textarea
            id="ged-version-commentaire"
            required
            value={commentaire}
            onChange={(e) => {
              setCommentaire(e.target.value);
              if (erreursChamps.commentaire) {
                setErreursChamps((p) => ({ ...p, commentaire: "" }));
              }
            }}
            placeholder={t("nouvelleVersion.placeholderCommentaire")}
            disabled={mutation.isPending}
            aria-invalid={Boolean(erreursChamps.commentaire)}
          />
          {erreursChamps.commentaire ? (
            <p className="m-0 text-xs font-medium text-erreur">{erreursChamps.commentaire}</p>
          ) : (
            <p className="m-0 text-xs text-neutral-500">{t("nouvelleVersion.aideCommentaire")}</p>
          )}
        </div>

        <label
          htmlFor="ged-version-reference"
          className="flex cursor-pointer items-start gap-2.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 select-none"
        >
          <Checkbox
            id="ged-version-reference"
            checked={estReference}
            onCheckedChange={(coche) => setEstReference(coche === true)}
            disabled={mutation.isPending}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900">
              <Star className="size-4 text-avertissement" aria-hidden="true" />
              {t("nouvelleVersion.champReference")}
            </span>
            <span className="text-xs text-neutral-500">{t("depot.aideReference")}</span>
          </span>
        </label>
      </form>
    </Modale>
  );
}

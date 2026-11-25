"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Alerte, Bouton, Champ, Modale } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ZoneDepotFichiers } from "@/components/ui/zone-depot-fichiers";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";

import { deposerDocumentGed } from "../adaptateur";
import { CLE_TOUTES_LISTES_DOCUMENTS_GED } from "../cles";
import {
  ACCEPT_FICHIERS_GED,
  nomDocumentDepuisFichier,
  validerFichierGed,
} from "../regles";
import type { CategorieDocumentGed, DocumentGed } from "../types";
import {
  LONGUEUR_MAX_COMMENTAIRE_VERSION,
  LONGUEUR_MAX_DESCRIPTION_DOCUMENT,
  LONGUEUR_MAX_NOM_DOCUMENT,
  schemaDepotDocument,
} from "../validations";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  projets: Projet[];
  projetIdFixe?: string;
  projetIdDefaut?: string;
  categoriesDeposables: CategorieDocumentGed[];
  categorieDefaut?: CategorieDocumentGed;
  onSucces?: (document: DocumentGed) => void;
}

/**
 * Modale de dépôt d'un nouveau document GED (version initiale v1).
 *
 * Vérifie localement les contraintes F6 (formats PDF/JPG/PNG/DOCX/XLSX, 50 Mo max)
 * avant l'envoi `multipart/form-data` sur `POST /api/v1/ged/documents/`.
 */
export function ModaleDepotDocument({
  ouverte,
  onFermer,
  projets,
  projetIdFixe,
  projetIdDefaut,
  categoriesDeposables,
  categorieDefaut,
  onSucces,
}: Props) {
  const t = useTranslations("ged");
  const clientRequetes = useQueryClient();

  const projetInitial =
    projetIdFixe ??
    (projetIdDefaut && projets.some((p) => p.id === projetIdDefaut)
      ? projetIdDefaut
      : (projets[0]?.id ?? ""));

  const categorieInitiale: CategorieDocumentGed | "" =
    categorieDefaut && categoriesDeposables.includes(categorieDefaut)
      ? categorieDefaut
      : (categoriesDeposables[0] ?? "");

  const [projetId, setProjetId] = useState(projetInitial);
  const [categorie, setCategorie] = useState<CategorieDocumentGed | "">(categorieInitiale);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [estReference, setEstReference] = useState(false);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [erreursChamps, setErreursChamps] = useState<Record<string, string>>({});
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: deposerDocumentGed,
    onSuccess: (documentCree) => {
      void clientRequetes.invalidateQueries({ queryKey: CLE_TOUTES_LISTES_DOCUMENTS_GED });
      toast.success(t("depot.succes", { nom: documentCree.nom }));
      onSucces?.(documentCree);
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
      setErreurGlobale(t("erreurs.depotEchoue"));
    },
  });

  function gererSelectionFichiers(nouveaux: File[]) {
    setFichiers(nouveaux);
    setErreursChamps((precedent) => {
      if (!precedent.fichier) return precedent;
      const suivant = { ...precedent };
      delete suivant.fichier;
      return suivant;
    });
    const premier = nouveaux[0];
    if (premier && !nom.trim()) {
      setNom(nomDocumentDepuisFichier(premier.name));
    }
  }

  function refuserFichier(fichier: File): string | null {
    const code = validerFichierGed(fichier);
    if (!code) return null;
    return t(`validation.fichier.${code}`);
  }

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreurGlobale(null);

    const schema = schemaDepotDocument({
      projetRequis: t("validation.projetRequis"),
      categorieRequise: t("validation.categorieRequise"),
      nomRequis: t("validation.nomRequis"),
      nomTropLong: t("validation.champTropLong", { max: LONGUEUR_MAX_NOM_DOCUMENT }),
      descriptionTropLongue: t("validation.champTropLong", {
        max: LONGUEUR_MAX_DESCRIPTION_DOCUMENT,
      }),
      commentaireTropLong: t("validation.champTropLong", {
        max: LONGUEUR_MAX_COMMENTAIRE_VERSION,
      }),
    });

    const analyse = schema.safeParse({
      projetId,
      categorie,
      nom,
      description,
      commentaire,
      estReference,
    });

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
      projetId: analyse.data.projetId,
      categorie: analyse.data.categorie,
      nom: analyse.data.nom,
      description: analyse.data.description,
      commentaire: analyse.data.commentaire,
      estReference: analyse.data.estReference,
      fichier,
    });
  }

  const idFormulaire = "formulaire-depot-document-ged";

  return (
    <Modale
      ouverte={ouverte}
      titre={t("depot.titre")}
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
            iconeGauche={<Upload size={16} aria-hidden="true" />}
          >
            {t("depot.soumettre")}
          </Bouton>
        </>
      }
    >
      <form id={idFormulaire} onSubmit={soumettre} noValidate className="flex flex-col gap-4">
        {erreurGlobale && <Alerte type="erreur">{erreurGlobale}</Alerte>}

        {!projetIdFixe && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ged-depot-projet">
              {t("depot.champProjet")}
              <span className="ml-0.5 text-erreur" aria-hidden="true">
                *
              </span>
            </Label>
            <Select
              value={projetId}
              onValueChange={(valeur) => {
                setProjetId(valeur);
                setErreursChamps((p) => ({ ...p, projetId: "" }));
              }}
              disabled={mutation.isPending}
            >
              <SelectTrigger
                id="ged-depot-projet"
                className="w-full bg-card"
                aria-invalid={Boolean(erreursChamps.projetId)}
              >
                <SelectValue placeholder={t("depot.placeholderProjet")} />
              </SelectTrigger>
              <SelectContent className="z-110">
                {projets.map((projet) => (
                  <SelectItem key={projet.id} value={projet.id}>
                    {projet.nom} ({projet.reference})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erreursChamps.projetId && (
              <p className="m-0 text-xs font-medium text-erreur">{erreursChamps.projetId}</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ged-depot-categorie">
            {t("depot.champCategorie")}
            <span className="ml-0.5 text-erreur" aria-hidden="true">
              *
            </span>
          </Label>
          <Select
            value={categorie}
            onValueChange={(valeur) => {
              setCategorie(valeur as CategorieDocumentGed);
              setErreursChamps((p) => ({ ...p, categorie: "" }));
            }}
            disabled={mutation.isPending}
          >
            <SelectTrigger
              id="ged-depot-categorie"
              className="w-full bg-card"
              aria-invalid={Boolean(erreursChamps.categorie)}
            >
              <SelectValue placeholder={t("depot.placeholderCategorie")} />
            </SelectTrigger>
            <SelectContent className="z-110">
              {categoriesDeposables.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {t(`categories.${cat}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {erreursChamps.categorie && (
            <p className="m-0 text-xs font-medium text-erreur">{erreursChamps.categorie}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ged-depot-fichier">
            {t("depot.champFichier")}
            <span className="ml-0.5 text-erreur" aria-hidden="true">
              *
            </span>
          </Label>
          <ZoneDepotFichiers
            id="ged-depot-fichier"
            fichiers={fichiers}
            onChange={gererSelectionFichiers}
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

        <Champ
          libelle={t("depot.champNom")}
          taille="md"
          required
          value={nom}
          onChange={(e) => {
            setNom(e.target.value);
            if (erreursChamps.nom) setErreursChamps((p) => ({ ...p, nom: "" }));
          }}
          placeholder={t("depot.placeholderNom")}
          erreur={erreursChamps.nom}
          disabled={mutation.isPending}
          className="mb-0"
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ged-depot-description">{t("depot.champDescription")}</Label>
          <Textarea
            id="ged-depot-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("depot.placeholderDescription")}
            disabled={mutation.isPending}
            aria-invalid={Boolean(erreursChamps.description)}
          />
          {erreursChamps.description && (
            <p className="m-0 text-xs font-medium text-erreur">{erreursChamps.description}</p>
          )}
        </div>

        <Champ
          libelle={t("depot.champCommentaire")}
          taille="md"
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder={t("depot.placeholderCommentaire")}
          erreur={erreursChamps.commentaire}
          disabled={mutation.isPending}
          className="mb-0"
        />

        <label
          htmlFor="ged-depot-reference"
          className="flex cursor-pointer items-start gap-2.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 select-none"
        >
          <Checkbox
            id="ged-depot-reference"
            checked={estReference}
            onCheckedChange={(coche) => setEstReference(coche === true)}
            disabled={mutation.isPending}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900">
              <Star className="size-4 text-avertissement" aria-hidden="true" />
              {t("depot.champReference")}
            </span>
            <span className="text-xs text-neutral-500">{t("depot.aideReference")}</span>
          </span>
        </label>
      </form>
    </Modale>
  );
}

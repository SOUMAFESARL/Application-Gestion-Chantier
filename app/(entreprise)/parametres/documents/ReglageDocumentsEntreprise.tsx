"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Alerte, Bouton, Carte, EtatChargement, EtatErreur } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lireEntreprise } from "@/features/configuration/api";
import type { DonneesEntreprise } from "@/features/configuration/api";
import {
  PERMISSION_GERER_DOCUMENTS,
  reglagesIdentiques,
  resoudreLignes,
  TEXTE_LIBRE_ENTETE_MAX,
  TEXTE_LIBRE_PIED_MAX,
  valeursMentions,
} from "@/features/documents";
import type { DocumentsResolus, ReglageDocuments } from "@/features/documents";
import { lireDocuments, modifierDocuments } from "@/features/documents/adaptateur";
import { CLE_DOCUMENTS, CLE_ENTREPRISE_APERCU } from "@/features/documents/cles";
import { useDroits } from "@/features/habilitations";
import { ErreurApi } from "@/lib/api";

import { ChoixMentions } from "./ChoixMentions";

/**
 * Réglage de l'en-tête et du pied des documents PDF — écran de paramètres.
 *
 * **Tout le monde consulte, seuls les comptes qui ont `administration.documents_gerer`
 * modifient** (DG et AD). Sans ce droit, les contrôles sont désactivés : ce n'est pas une
 * barrière, le serveur refuse (403) à qui n'a pas le code.
 *
 * Le réglage est celui de l'entreprise, relu du serveur à chaque visite.
 */
export function ReglageDocumentsEntreprise() {
  const t = useTranslations("reglageDocuments");
  const { peutCode } = useDroits();
  const peutGerer = peutCode(PERMISSION_GERER_DOCUMENTS);

  const documents = useQuery({
    queryKey: CLE_DOCUMENTS,
    queryFn: ({ signal }) => lireDocuments(signal),
  });
  // L'aperçu d'un brouillon a besoin des valeurs de l'entreprise ; sans elles, il se replie sur
  // les lignes du serveur, qui ne valent que pour le réglage enregistré.
  const entreprise = useQuery({
    queryKey: CLE_ENTREPRISE_APERCU,
    queryFn: () => lireEntreprise(),
  });

  return (
    <div className="flex flex-col">
      <EnTetePage className="mb-5" titre={t("titre")} description={t("description")} />

      {!peutGerer && <Alerte type="information">{t("lectureSeule")}</Alerte>}

      {documents.isPending && <EtatChargement message={t("chargement")} />}

      {documents.isError && (
        <EtatErreur
          message={documents.error instanceof ErreurApi ? documents.error.message : undefined}
          onReessayer={() => void documents.refetch()}
        />
      )}

      {documents.data && (
        <FormulaireDocuments
          enregistres={documents.data}
          entreprise={entreprise.data ?? null}
          peutGerer={peutGerer}
        />
      )}
    </div>
  );
}

interface PropsFormulaire {
  enregistres: DocumentsResolus;
  entreprise: DonneesEntreprise | null;
  peutGerer: boolean;
}

function FormulaireDocuments({ enregistres, entreprise, peutGerer }: PropsFormulaire) {
  const t = useTranslations("reglageDocuments");
  const cache = useQueryClient();
  const idBase = useId();

  // Le brouillon n'existe que pendant la modification : sans lui, on lit le réglage du serveur.
  const [brouillon, setBrouillon] = useState<ReglageDocuments | null>(null);
  const affiche = brouillon ?? enregistres.reglage;
  const modifie = brouillon !== null && !reglagesIdentiques(brouillon, enregistres.reglage);

  const enregistrement = useMutation({
    mutationFn: (reglage: ReglageDocuments) => modifierDocuments(reglage),
    onSuccess: (resultat) => {
      setBrouillon(null);
      cache.setQueryData(CLE_DOCUMENTS, resultat);
      void cache.invalidateQueries({ queryKey: CLE_DOCUMENTS });
      toast.success(t("actions.succes"));
    },
    onError: (cause) => {
      toast.error(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
    },
  });

  function changer(partiel: Partial<ReglageDocuments>) {
    setBrouillon({ ...affiche, ...partiel });
  }

  const lectureSeule = !peutGerer || enregistrement.isPending;

  return (
    <div className="flex flex-col gap-5">
      <Carte titre={t("entete.titre")}>
        <p className="mb-4 text-sm text-neutral-600">{t("entete.aide")}</p>

        <div className="mb-5 flex items-start gap-2">
          <Checkbox
            id={`${idBase}-logo`}
            className="mt-0.5 bg-card"
            checked={affiche.afficherLogo}
            disabled={lectureSeule}
            onCheckedChange={(coche) => changer({ afficherLogo: coche === true })}
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${idBase}-logo`}>{t("logo.libelle")}</Label>
            <span className="text-xs text-neutral-600">{t("logo.aide")}</span>
          </div>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-neutral-800">{t("mentions.titre")}</h3>
        <ChoixMentions
          choisies={affiche.mentionsEntete}
          lectureSeule={lectureSeule}
          onChange={(mentionsEntete) => changer({ mentionsEntete })}
        />

        <TexteLibre
          id={`${idBase}-texte-entete`}
          valeur={affiche.texteLibreEntete}
          max={TEXTE_LIBRE_ENTETE_MAX}
          aide={t("texteLibre.aideEntete")}
          lectureSeule={lectureSeule}
          onChange={(texteLibreEntete) => changer({ texteLibreEntete })}
        />
      </Carte>

      <Carte titre={t("pied.titre")}>
        <p className="mb-4 text-sm text-neutral-600">{t("pied.aide")}</p>

        <h3 className="mb-2 text-sm font-semibold text-neutral-800">{t("mentions.titre")}</h3>
        <ChoixMentions
          choisies={affiche.mentionsPied}
          lectureSeule={lectureSeule}
          onChange={(mentionsPied) => changer({ mentionsPied })}
        />

        <TexteLibre
          id={`${idBase}-texte-pied`}
          valeur={affiche.texteLibrePied}
          max={TEXTE_LIBRE_PIED_MAX}
          aide={t("texteLibre.aidePied")}
          lectureSeule={lectureSeule}
          onChange={(texteLibrePied) => changer({ texteLibrePied })}
        />
      </Carte>

      <Apercu reglage={affiche} enregistres={enregistres} entreprise={entreprise} />

      {peutGerer && (
        <div className="flex justify-end gap-3">
          {modifie && (
            <Bouton
              variante="ghost"
              taille="sm"
              disabled={enregistrement.isPending}
              onClick={() => setBrouillon(null)}
            >
              {t("actions.annuler")}
            </Bouton>
          )}
          <Bouton
            variante="primaire"
            taille="sm"
            disabled={!modifie}
            enCours={enregistrement.isPending}
            onClick={() => enregistrement.mutate(affiche)}
          >
            {enregistrement.isPending ? t("actions.enCours") : t("actions.enregistrer")}
          </Bouton>
        </div>
      )}
    </div>
  );
}

interface PropsTexteLibre {
  id: string;
  valeur: string;
  max: number;
  aide: string;
  lectureSeule: boolean;
  onChange: (valeur: string) => void;
}

function TexteLibre({ id, valeur, max, aide, lectureSeule, onChange }: PropsTexteLibre) {
  const t = useTranslations("reglageDocuments");
  return (
    <div className="mt-5 flex flex-col gap-1">
      <Label htmlFor={id}>{t("texteLibre.libelle")}</Label>
      <Input
        id={id}
        value={valeur}
        maxLength={max}
        disabled={lectureSeule}
        onChange={(evenement) => onChange(evenement.target.value)}
      />
      <div className="flex justify-between gap-3 text-xs text-neutral-600">
        <span>{aide}</span>
        <span className="shrink-0">{t("texteLibre.compteur", { n: valeur.length, max })}</span>
      </div>
    </div>
  );
}

interface PropsApercu {
  reglage: ReglageDocuments;
  enregistres: DocumentsResolus;
  entreprise: DonneesEntreprise | null;
}

/**
 * L'aperçu de l'en-tête et du pied avec les valeurs de l'entreprise. Il suit le brouillon dès
 * que l'entreprise est lue ; sinon il montre les lignes que le serveur a résolues.
 */
function Apercu({ reglage, enregistres, entreprise }: PropsApercu) {
  const t = useTranslations("reglageDocuments");

  const valeurs = entreprise
    ? valeursMentions(entreprise, {
        rccm: t("libellesMentions.rccm"),
        nif: t("libellesMentions.nif"),
        telephone: t("libellesMentions.telephone"),
        email: t("libellesMentions.email"),
        siteWeb: t("libellesMentions.siteWeb"),
      })
    : null;

  const lignesEntete = valeurs
    ? resoudreLignes(reglage.mentionsEntete, valeurs, reglage.texteLibreEntete)
    : enregistres.entete.lignes;
  const lignesPied = valeurs
    ? resoudreLignes(reglage.mentionsPied, valeurs, reglage.texteLibrePied)
    : enregistres.pied.lignes;

  const urlLogo = entreprise ? (entreprise.logo_original ?? entreprise.logo ?? null) : enregistres.entete.logoUrl;
  const nom = entreprise?.nom_commercial || entreprise?.raison_sociale || "";

  return (
    <Carte titre={t("apercu.titre")}>
      <p className="mb-4 text-sm text-neutral-600">{t("apercu.aide")}</p>

      <div className="flex flex-col gap-4 sm:flex-row">
        <section className="flex-1 rounded-md border border-neutral-200 bg-neutral-0 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-neutral-500">
            {t("apercu.entete")}
          </h3>
          <div className="mb-2 flex h-12 items-center">
            {reglage.afficherLogo && urlLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlLogo} alt={t("apercu.logoAlt")} className="max-h-12 max-w-40 object-contain" />
            ) : (
              <span className="rounded-md bg-primary-500 px-3 py-2 text-xs font-bold text-neutral-0">
                {nom}
              </span>
            )}
          </div>
          <Lignes lignes={lignesEntete} />
        </section>

        <section className="flex-1 rounded-md border border-neutral-200 bg-neutral-0 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-neutral-500">{t("apercu.pied")}</h3>
          <Lignes lignes={lignesPied} centre />
        </section>
      </div>
    </Carte>
  );
}

function Lignes({ lignes, centre = false }: { lignes: string[]; centre?: boolean }) {
  const t = useTranslations("reglageDocuments");
  if (lignes.length === 0) return <p className="text-xs text-neutral-500">{t("apercu.vide")}</p>;
  return (
    <ul className={centre ? "flex flex-col gap-0.5 text-center" : "flex flex-col gap-0.5"}>
      {lignes.map((ligne, rang) => (
        <li key={`${rang}-${ligne}`} className="text-xs text-neutral-700">
          {ligne}
        </li>
      ))}
    </ul>
  );
}

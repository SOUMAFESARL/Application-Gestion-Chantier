"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  FileUp,
  Layers,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Alerte, Badge, Bouton, Champ, EtatChargement, EtatErreur, EtatVide, Modale } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS, useDroits } from "@/features/habilitations";
import { REFERENTIEL_TYPES_PROJET, useReferentiel } from "@/features/projets/referentiels";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

import {
  creerModele,
  importerFichierModele,
  lireModele,
  listerListes,
  listerModeles,
  modifierModele,
  personnaliserModele,
  supprimerModele,
  telechargerModeleExcelDecoupage,
} from "../adaptateur";
import { CLE_LISTES, cleModeles } from "../cles";
import { trouverListeDuNiveau } from "../regles";
import type {
  DetailModele,
  ListeValeurs,
  NiveauGabarit,
  OrigineReference,
  ResumeModele,
} from "../types";

const SANS_LISTE = "aucune";
const MAX_NIVEAUX = 5;

function cleModele(m: { origine: OrigineReference; id: string }): string {
  return `${m.origine}:${m.id}`;
}

function telechargerBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

function niveauxInitiaux(libelles: [string, string, string]): NiveauGabarit[] {
  return [
    { libelle: libelles[0], liste: null, alerter: false },
    { libelle: libelles[1], liste: null, alerter: true },
    { libelle: libelles[2], liste: null, alerter: false },
  ];
}

function normaliserLignesModele(lignesBrutes: string[][], nbNiveaux: number): string[][] {
  if (lignesBrutes.length === 0) {
    return [Array.from({ length: nbNiveaux }, () => "")];
  }
  return lignesBrutes.map((l) => {
    const copie = l.slice(0, nbNiveaux);
    while (copie.length < nbNiveaux) copie.push("");
    return copie;
  });
}

/**
 * Gestion des modèles de découpage côté Entreprise (`/parametres/listes`).
 *
 * Permet de consulter les modèles de la plateforme, de les personnaliser en un clic, ou de créer
 * et modifier les modèles propres à l'entreprise (niveaux, listes de valeurs associées, types de
 * projet, lignes types et import/export Excel).
 */
export function GestionModelesDecoupage() {
  const t = useTranslations("decoupage.modeles");
  const { peutCode } = useDroits();
  const peutGerer = peutCode(PERMISSIONS.MODELES_GERER);

  const requeteModeles = useQuery({
    queryKey: cleModeles(null),
    queryFn: ({ signal }) => listerModeles(null, signal),
  });
  const requeteListes = useQuery({
    queryKey: CLE_LISTES,
    queryFn: ({ signal }) => listerListes(signal),
  });
  const { entrees: typesProjet } = useReferentiel(REFERENTIEL_TYPES_PROJET);

  const modeles = useMemo(() => requeteModeles.data ?? [], [requeteModeles.data]);
  const listes = useMemo(() => requeteListes.data ?? [], [requeteListes.data]);

  const [selection, setSelection] = useState<{ origine: OrigineReference; id: string } | null>(null);
  const [enCreation, setEnCreation] = useState(false);
  const [compteurCreation, setCompteurCreation] = useState(0);

  const selectionEffective = useMemo(() => {
    if (enCreation) return null;
    if (selection && modeles.some((m) => m.origine === selection.origine && m.id === selection.id)) {
      return selection;
    }
    return modeles[0] ? { origine: modeles[0].origine, id: modeles[0].id } : null;
  }, [enCreation, selection, modeles]);

  const requeteDetail = useQuery({
    queryKey: [
      "decoupage",
      "modele",
      selectionEffective?.origine ?? "",
      selectionEffective?.id ?? "",
    ],
    queryFn: ({ signal }) =>
      lireModele(selectionEffective!.origine, selectionEffective!.id, signal),
    enabled: selectionEffective !== null,
  });

  function messageErreur(cause: unknown): string {
    return cause instanceof ErreurApi && cause.message ? cause.message : t("erreur");
  }

  const telechargementExemple = useMutation({
    mutationFn: async () => {
      const blob = await telechargerModeleExcelDecoupage();
      telechargerBlob(blob, "modele-decoupage-projet.xlsx");
    },
    onError: (cause) => toast.error(messageErreur(cause)),
  });

  function demarrerCreation() {
    setCompteurCreation((c) => c + 1);
    setEnCreation(true);
  }

  function choisirModeleCatalogue(m: ResumeModele) {
    setEnCreation(false);
    setSelection({ origine: m.origine, id: m.id });
  }

  const detailActif = enCreation ? null : requeteDetail.data ?? null;
  const cleFormulaire = enCreation
    ? `nouveau-${compteurCreation}`
    : detailActif
      ? `${detailActif.origine}:${detailActif.id}:${detailActif.nom}:${detailActif.nombreLignes}:${detailActif.niveaux.length}`
      : "vide";

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{t("titre")}</h2>
          <p className="text-sm text-neutral-600">{t("description")}</p>
        </div>
        {peutGerer && (
          <div className="flex flex-wrap items-center gap-2">
            <Bouton
              variante="secondaire"
              taille="sm"
              iconeGauche={<Download size={16} />}
              enCours={telechargementExemple.isPending}
              disabled={telechargementExemple.isPending}
              onClick={() => telechargementExemple.mutate()}
            >
              {t("telechargerModeleExcel")}
            </Bouton>
            <Bouton taille="sm" iconeGauche={<Plus size={16} />} onClick={demarrerCreation}>
              {t("nouveauModele")}
            </Bouton>
          </div>
        )}
      </div>

      {requeteModeles.isPending ? (
        <EtatChargement />
      ) : requeteModeles.isError ? (
        <EtatErreur onReessayer={() => void requeteModeles.refetch()} />
      ) : modeles.length === 0 && !enCreation ? (
        <EtatVide titre={t("aucunModele")} description={t("aucunModeleDescription")} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Colonne gauche : catalogue des modèles */}
          <div className="flex flex-col gap-2 lg:col-span-4">
            <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              {t("catalogueModeles", { n: modeles.length })}
            </span>
            <ul className="flex max-h-[36rem] flex-col gap-1.5 overflow-y-auto pr-1">
              {modeles.map((m) => {
                const cle = cleModele(m);
                const actif =
                  !enCreation &&
                  selectionEffective?.origine === m.origine &&
                  selectionEffective?.id === m.id;
                return (
                  <li key={cle}>
                    <button
                      type="button"
                      onClick={() => choisirModeleCatalogue(m)}
                      className={cn(
                        "flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                        actif
                          ? "border-primary-600 bg-primary-50/50"
                          : "border-neutral-200 bg-neutral-0 hover:bg-neutral-50",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-neutral-900">
                          {m.nomAffiche}
                        </span>
                        <Badge
                          variante={
                            m.origine === "PLATEFORME"
                              ? "neutre"
                              : m.originePlateformeId
                                ? "primaire"
                                : "information"
                          }
                        >
                          {m.origine === "PLATEFORME"
                            ? t("badgePlateforme")
                            : m.originePlateformeId
                              ? t("badgePersonnalise")
                              : t("badgeEntreprise")}
                        </Badge>
                      </div>
                      {m.originalModifie && (
                        <Badge variante="avertissement">{t("badgeOriginalModifie")}</Badge>
                      )}
                      {m.niveaux.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-xs font-medium text-neutral-700">
                          {m.niveaux.map((niv, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1">
                              {idx > 0 && (
                                <ArrowRight
                                  className="size-3 shrink-0 text-neutral-400"
                                  aria-hidden="true"
                                />
                              )}
                              <span>{niv}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <span className="text-xs text-neutral-500">
                        {t("resumeLignes", { n: m.nombreLignes })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Colonne droite : détail / éditeur */}
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4 lg:col-span-8">
            {!enCreation && requeteDetail.isPending ? (
              <EtatChargement />
            ) : !enCreation && requeteDetail.isError ? (
              <EtatErreur onReessayer={() => void requeteDetail.refetch()} />
            ) : enCreation || detailActif ? (
              <FormulaireModeleEntreprise
                key={cleFormulaire}
                enCreation={enCreation}
                detail={detailActif}
                listes={listes}
                typesProjet={typesProjet}
                peutGerer={peutGerer}
                peutAnnulerCreation={modeles.length > 0}
                onAnnulerCreation={() => setEnCreation(false)}
                onSelectionnerModele={(cible) => {
                  setEnCreation(false);
                  setSelection(cible);
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function FormulaireModeleEntreprise({
  enCreation,
  detail,
  listes,
  typesProjet,
  peutGerer,
  peutAnnulerCreation,
  onAnnulerCreation,
  onSelectionnerModele,
}: {
  enCreation: boolean;
  detail: DetailModele | null;
  listes: ListeValeurs[];
  typesProjet: { code: string; libelle: string }[];
  peutGerer: boolean;
  peutAnnulerCreation: boolean;
  onAnnulerCreation: () => void;
  onSelectionnerModele: (cible: { origine: OrigineReference; id: string } | null) => void;
}) {
  const t = useTranslations("decoupage.modeles");
  const cache = useQueryClient();
  const champFichierRef = useRef<HTMLInputElement | null>(null);

  const libellesDefaut = useMemo<[string, string, string]>(
    () => [t("niveauDefaut1"), t("niveauDefaut2"), t("niveauDefaut3")],
    [t],
  );

  const [nom, setNom] = useState(() => (detail ? detail.nom : ""));
  const [description, setDescription] = useState(() => (detail ? detail.description : ""));
  const [typesChoisis, setTypesChoisis] = useState<string[]>(() =>
    detail ? detail.typesProjet : [],
  );
  const [parDefautPour, setParDefautPour] = useState<string[]>(() =>
    detail ? detail.parDefautPour : [],
  );
  const [niveaux, setNiveaux] = useState<NiveauGabarit[]>(() =>
    detail && detail.niveaux.length > 0 ? detail.niveaux : niveauxInitiaux(libellesDefaut),
  );
  const [lignes, setLignes] = useState<string[][]>(() => {
    const nb = detail && detail.niveaux.length > 0 ? detail.niveaux.length : 3;
    return normaliserLignesModele(detail ? detail.lignes : [], nb);
  });
  const [aSupprimer, setASupprimer] = useState<DetailModele | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const estModifiable = enCreation || (peutGerer && Boolean(detail?.modifiable));

  function messageErreur(cause: unknown): string {
    return cause instanceof ErreurApi && cause.message ? cause.message : t("erreur");
  }

  const enregistrement = useMutation({
    mutationFn: async () => {
      const lignesPropres = lignes
        .map((l) => l.map((c) => c.trim()))
        .filter((l) => l.some((c) => c !== ""));
      const charge = {
        nom,
        description,
        typesProjet: typesChoisis,
        parDefautPour: parDefautPour.filter((code) => typesChoisis.includes(code)),
        niveaux,
        lignes: lignesPropres,
      };
      if (enCreation) {
        return creerModele(charge);
      }
      if (!detail) throw new Error("NO_DETAIL");
      return modifierModele(detail.origine, detail.id, charge);
    },
    onSuccess: (enregistre) => {
      setErreur(null);
      toast.success(enCreation ? t("succesCreation") : t("succesModification"));
      void cache.invalidateQueries({ queryKey: ["decoupage", "modeles"] });
      void cache.invalidateQueries({
        queryKey: ["decoupage", "modele", enregistre.origine, enregistre.id],
      });
      void cache.invalidateQueries({ queryKey: ["projets"] });
      onSelectionnerModele({ origine: enregistre.origine, id: enregistre.id });
    },
    onError: (cause) => setErreur(messageErreur(cause)),
  });

  const personnalisation = useMutation({
    mutationFn: (idPlateforme: string) => personnaliserModele(idPlateforme),
    onSuccess: (copie) => {
      setErreur(null);
      toast.success(t("succesPersonnalisation"));
      void cache.invalidateQueries({ queryKey: ["decoupage", "modeles"] });
      void cache.invalidateQueries({ queryKey: ["projets"] });
      onSelectionnerModele({ origine: copie.origine, id: copie.id });
    },
    onError: (cause) => setErreur(messageErreur(cause)),
  });

  const suppression = useMutation({
    mutationFn: (cible: DetailModele) => supprimerModele(cible.origine, cible.id),
    onSuccess: () => {
      setASupprimer(null);
      toast.success(t("succesSuppression"));
      void cache.invalidateQueries({ queryKey: ["decoupage", "modeles"] });
      void cache.invalidateQueries({ queryKey: ["projets"] });
      onSelectionnerModele(null);
    },
    onError: (cause) => {
      setASupprimer(null);
      toast.error(messageErreur(cause));
    },
  });

  const importExcel = useMutation({
    mutationFn: (fichier: File) => importerFichierModele(fichier),
    onSuccess: (importe) => {
      const niv = importe.niveaux.length > 0 ? importe.niveaux : niveaux;
      setNiveaux(niv);
      setLignes(normaliserLignesModele(importe.lignes, niv.length));
      setErreur(null);
      toast.success(t("succesImportExcel", { lignes: importe.lignes.length }));
    },
    onError: (cause) => setErreur(messageErreur(cause)),
  });

  function basculerTypeProjet(code: string, coche: boolean) {
    setTypesChoisis((courant) => (coche ? [...courant, code] : courant.filter((c) => c !== code)));
    if (!coche) {
      setParDefautPour((courant) => courant.filter((c) => c !== code));
    }
  }

  function basculerDefautType(code: string, coche: boolean) {
    if (coche && !typesChoisis.includes(code)) {
      setTypesChoisis((courant) => [...courant, code]);
    }
    setParDefautPour((courant) => (coche ? [...courant, code] : courant.filter((c) => c !== code)));
  }

  function modifierNiveau(index: number, partiel: Partial<NiveauGabarit>) {
    setNiveaux((courant) =>
      courant.map((n, i) => {
        if (i === index) return { ...n, ...partiel };
        if (partiel.alerter) return { ...n, alerter: false };
        return n;
      }),
    );
  }

  function ajouterColonneNiveau() {
    if (niveaux.length >= MAX_NIVEAUX) return;
    setNiveaux((courant) => [...courant, { libelle: "", liste: null, alerter: false }]);
    setLignes((courant) => courant.map((l) => [...l, ""]));
  }

  function retirerColonneNiveau(index: number) {
    if (niveaux.length <= 1) return;
    setNiveaux((courant) => courant.filter((_, i) => i !== index));
    setLignes((courant) => courant.map((l) => l.filter((_, i) => i !== index)));
  }

  function deplacerColonneNiveau(index: number, direction: -1 | 1) {
    const cible = index + direction;
    if (cible < 0 || cible >= niveaux.length) return;
    setNiveaux((courant) => {
      const copie = [...courant];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
    setLignes((courant) =>
      courant.map((l) => {
        const copie = [...l];
        [copie[index], copie[cible]] = [copie[cible], copie[index]];
        return copie;
      }),
    );
  }

  function modifierCelluleLigne(indexLigne: number, indexCol: number, valeur: string) {
    setLignes((courant) =>
      courant.map((l, r) => (r === indexLigne ? l.map((c, col) => (col === indexCol ? valeur : c)) : l)),
    );
  }

  function ajouterLigneVide() {
    setLignes((courant) => [...courant, Array.from({ length: niveaux.length }, () => "")]);
  }

  function retirerLigneIndex(indexLigne: number) {
    setLignes((courant) => {
      const reste = courant.filter((_, r) => r !== indexLigne);
      return reste.length > 0 ? reste : [Array.from({ length: niveaux.length }, () => "")];
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="size-4 text-primary-700" aria-hidden="true" />
            <h3 className="text-base font-semibold text-neutral-900">
              {enCreation ? t("titreCreation") : detail?.nomAffiche}
            </h3>
            {!enCreation && detail && (
              <Badge
                variante={
                  detail.origine === "PLATEFORME"
                    ? "neutre"
                    : detail.originePlateformeId
                      ? "primaire"
                      : "information"
                }
              >
                {detail.origine === "PLATEFORME"
                  ? t("badgePlateforme")
                  : detail.originePlateformeId
                    ? t("badgePersonnalise")
                    : t("badgeEntreprise")}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            {enCreation
              ? t("aideCreation")
              : detail?.origine === "PLATEFORME"
                ? t("aideModelePlateforme")
                : t("aideModeleEntreprise")}
          </p>
        </div>

        {!enCreation && detail?.origine === "PLATEFORME" && peutGerer && (
          <Bouton
            taille="sm"
            iconeGauche={<Copy size={15} />}
            enCours={personnalisation.isPending}
            disabled={personnalisation.isPending}
            onClick={() => personnalisation.mutate(detail.id)}
          >
            {t("personnaliser")}
          </Bouton>
        )}

        {!enCreation && detail?.modifiable && peutGerer && (
          <Bouton
            variante="ghost"
            taille="sm"
            className="text-erreur"
            iconeGauche={<Trash2 size={15} />}
            onClick={() => setASupprimer(detail)}
          >
            {t("supprimer")}
          </Bouton>
        )}
      </div>

      {detail?.originalModifie && (
        <Alerte type="avertissement">{t("alerteOriginalModifie")}</Alerte>
      )}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {/* Identité du modèle */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ
          libelle={t("champNom")}
          placeholder={t("placeholderNom")}
          value={nom}
          maxLength={150}
          disabled={!estModifiable || enregistrement.isPending}
          onChange={(e) => setNom(e.target.value)}
        />
        <Champ
          libelle={t("champDescription")}
          placeholder={t("placeholderDescription")}
          value={description}
          maxLength={300}
          disabled={!estModifiable || enregistrement.isPending}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Types de projet associés et par défaut */}
      {typesProjet.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-3">
          <span className="text-xs font-semibold text-neutral-800">{t("typesProjetTitre")}</span>
          <p className="text-xs text-neutral-500">{t("typesProjetAide")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {typesProjet.map((tp) => {
              const associe = typesChoisis.includes(tp.code);
              const defaut = parDefautPour.includes(tp.code);
              return (
                <div
                  key={tp.code}
                  className="flex items-center justify-between gap-2 rounded-md border border-neutral-100 px-2.5 py-1.5 text-xs"
                >
                  <label className="flex items-center gap-2 font-medium text-neutral-800">
                    <Checkbox
                      checked={associe}
                      disabled={!estModifiable || enregistrement.isPending}
                      onCheckedChange={(v) => basculerTypeProjet(tp.code, v === true)}
                    />
                    <span className="truncate">{tp.libelle}</span>
                  </label>
                  {associe && (
                    <label className="flex items-center gap-1.5 text-neutral-600">
                      <Checkbox
                        checked={defaut}
                        disabled={!estModifiable || enregistrement.isPending}
                        onCheckedChange={(v) => basculerDefautType(tp.code, v === true)}
                      />
                      <span>{t("parDefautCourt")}</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Niveaux du modèle */}
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-neutral-900">{t("niveauxTitre")}</h4>
            <p className="text-xs text-neutral-500">{t("niveauxAide")}</p>
          </div>
          {estModifiable && (
            <Bouton
              variante="secondaire"
              taille="sm"
              iconeGauche={<Plus size={15} />}
              disabled={niveaux.length >= MAX_NIVEAUX || enregistrement.isPending}
              onClick={ajouterColonneNiveau}
            >
              {t("ajouterNiveau")}
            </Bouton>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {niveaux.map((niv, index) => {
            const valeurSelect = niv.liste
              ? `${niv.liste.origine}:${niv.liste.id}`
              : SANS_LISTE;
            return (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-neutral-600">
                    {t("niveauRang", { rang: index + 1 })}
                  </span>
                  {estModifiable && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => deplacerColonneNiveau(index, -1)}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30"
                        aria-label={t("deplacerGauche")}
                      >
                        <ArrowLeft size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={index === niveaux.length - 1}
                        onClick={() => deplacerColonneNiveau(index, 1)}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30"
                        aria-label={t("deplacerDroite")}
                      >
                        <ArrowRight size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={niveaux.length <= 1}
                        onClick={() => retirerColonneNiveau(index)}
                        className="rounded p-1 text-neutral-500 hover:bg-erreur/10 hover:text-erreur disabled:opacity-30"
                        aria-label={t("retirerNiveau")}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <Input
                  value={niv.libelle}
                  maxLength={60}
                  placeholder={t("placeholderNiveau")}
                  disabled={!estModifiable || enregistrement.isPending}
                  onChange={(e) => modifierNiveau(index, { libelle: e.target.value })}
                />

                <Select
                  value={valeurSelect}
                  disabled={!estModifiable || enregistrement.isPending}
                  onValueChange={(val) => {
                    if (val === SANS_LISTE) {
                      modifierNiveau(index, { liste: null });
                      return;
                    }
                    const [orig, id] = val.split(":");
                    const trouvee = listes.find((l) => l.origine === orig && l.id === id);
                    modifierNiveau(index, {
                      liste: trouvee
                        ? {
                            origine: trouvee.origine,
                            id: trouvee.id,
                            libelle: trouvee.libelle,
                          }
                        : null,
                    });
                  }}
                >
                  <SelectTrigger className="w-full bg-neutral-0 text-xs">
                    <SelectValue placeholder={t("sansListe")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SANS_LISTE}>{t("sansListe")}</SelectItem>
                    {listes.map((l) => (
                      <SelectItem key={`${l.origine}:${l.id}`} value={`${l.origine}:${l.id}`}>
                        {l.libelle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <label className="flex items-center gap-2 text-xs text-neutral-700">
                  <Checkbox
                    checked={niv.alerter}
                    disabled={!estModifiable || enregistrement.isPending}
                    onCheckedChange={(v) => modifierNiveau(index, { alerter: v === true })}
                  />
                  <span>{t("alerterNiveau")}</span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lignes types du modèle */}
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-neutral-900">
              {t("lignesTitre", { n: lignes.length })}
            </h4>
            <p className="text-xs text-neutral-500">{t("lignesAide")}</p>
          </div>
          {estModifiable && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={champFichierRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) importExcel.mutate(f);
                }}
              />
              <Bouton
                variante="secondaire"
                taille="sm"
                iconeGauche={<FileUp size={15} />}
                enCours={importExcel.isPending}
                disabled={importExcel.isPending || enregistrement.isPending}
                onClick={() => champFichierRef.current?.click()}
              >
                {t("importerExcel")}
              </Bouton>
              <Bouton
                variante="secondaire"
                taille="sm"
                iconeGauche={<Plus size={15} />}
                disabled={enregistrement.isPending}
                onClick={ajouterLigneVide}
              >
                {t("ajouterLigne")}
              </Bouton>
            </div>
          )}
        </div>

        <div className="max-h-80 overflow-auto rounded-lg border border-neutral-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-neutral-100 text-neutral-700">
              <tr>
                <th className="w-10 px-2 py-2 text-center font-semibold" />
                {niveaux.map((niv, idx) => (
                  <th key={idx} className="min-w-44 px-2 py-2 font-semibold">
                    {niv.libelle || t("niveauRang", { rang: idx + 1 })}
                  </th>
                ))}
                {estModifiable && <th className="w-10 px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lignes.map((ligne, r) => (
                <tr key={r} className="hover:bg-neutral-50/60">
                  <td className="px-2 py-1.5 text-center text-neutral-500">{r + 1}</td>
                  {niveaux.map((niv, col) => (
                    <td key={col} className="px-1.5 py-1">
                      <CelluleModeleNiveau
                        valeur={ligne[col] ?? ""}
                        niveau={niv}
                        listes={listes}
                        desactive={!estModifiable || enregistrement.isPending}
                        onChange={(val) => modifierCelluleLigne(r, col, val)}
                      />
                    </td>
                  ))}
                  {estModifiable && (
                    <td className="px-1.5 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => retirerLigneIndex(r)}
                        className="rounded p-1 text-neutral-400 hover:bg-erreur/10 hover:text-erreur"
                        aria-label={t("retirerLigne")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {estModifiable && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {enCreation && peutAnnulerCreation && (
            <Bouton
              variante="ghost"
              disabled={enregistrement.isPending}
              onClick={onAnnulerCreation}
            >
              {t("annuler")}
            </Bouton>
          )}
          <Bouton
            iconeGauche={<Save size={16} />}
            enCours={enregistrement.isPending}
            disabled={!nom.trim() || niveaux.length === 0 || enregistrement.isPending}
            onClick={() => enregistrement.mutate()}
          >
            {enCreation ? t("creerModele") : t("enregistrerModele")}
          </Bouton>
        </div>
      )}

      {/* Modale de suppression d'un modèle */}
      <Modale
        ouverte={aSupprimer !== null}
        titre={t("titreSuppression")}
        onFermer={suppression.isPending ? undefined : () => setASupprimer(null)}
        actions={
          <>
            <Bouton
              variante="ghost"
              onClick={() => setASupprimer(null)}
              disabled={suppression.isPending}
            >
              {t("annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              enCours={suppression.isPending}
              disabled={suppression.isPending}
              onClick={() => aSupprimer && suppression.mutate(aSupprimer)}
            >
              {t("supprimer")}
            </Bouton>
          </>
        }
      >
        <p>{t("confirmationSuppression", { nom: aSupprimer?.nomAffiche ?? "" })}</p>
      </Modale>
    </>
  );
}

function CelluleModeleNiveau({
  valeur,
  niveau,
  listes,
  desactive,
  onChange,
}: {
  valeur: string;
  niveau: NiveauGabarit;
  listes: ListeValeurs[];
  desactive: boolean;
  onChange: (valeur: string) => void;
}) {
  const t = useTranslations("decoupage.tableau");
  const liste = useMemo(
    () => trouverListeDuNiveau(listes, niveau.liste),
    [listes, niveau.liste],
  );

  const options = useMemo<OptionCombobox[]>(() => {
    if (!liste) return [];
    const opts: OptionCombobox[] = [];
    if (valeur.trim()) {
      opts.push({ valeur: "", libelle: t("viderCellule") });
    }
    for (const v of liste.valeurs) {
      opts.push({
        valeur: v.libelle,
        libelle: v.libelle,
        groupe: v.groupe || undefined,
      });
    }
    return opts;
  }, [liste, valeur, t]);

  if (liste && !desactive) {
    return (
      <Combobox
        options={options}
        valeur={valeur}
        onChange={onChange}
        placeholder={niveau.libelle || t("sansUnite")}
        placeholderRecherche={t("rechercherValeur")}
        aucunResultat={t("aucuneValeur")}
        libelleSaisieLibre={(saisie) => t("utiliserValeurLibre", { saisie })}
        disabled={desactive}
        className="h-8 min-w-40 px-2 text-xs font-normal"
      />
    );
  }

  return (
    <Input
      value={valeur}
      maxLength={200}
      disabled={desactive}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 min-w-40 text-xs"
    />
  );
}

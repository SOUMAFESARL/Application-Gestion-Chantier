"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
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
import {
  peutParametrerPlateforme,
  type DetailModeleDecoupagePlateforme,
  type EntreeReferentielPlateforme,
  type ListeDecoupagePlateforme,
  type NiveauModelePlateforme,
  type ResumeModeleDecoupagePlateforme,
} from "@/features/administration";
import {
  creerModeleDecoupagePlateforme,
  importerFichierModelePlateforme,
  lireModeleDecoupagePlateforme,
  listerListesDecoupagePlateforme,
  listerModelesDecoupagePlateforme,
  listerReferentielPlateforme,
  modifierModeleDecoupagePlateforme,
  supprimerModeleDecoupagePlateforme,
  telechargerModeleExcelDecoupagePlateforme,
} from "@/features/administration/adaptateur";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";

const SANS_LISTE = "aucune";
const MAX_NIVEAUX = 10;

function telechargerBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

function niveauxInitiaux(libelles: [string, string, string]): NiveauModelePlateforme[] {
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
 * Gestion des modèles de découpage de la plateforme (`/admin/parametres/referentiels`).
 *
 * Les modèles actifs créés ou mis à jour ici sont immédiatement proposés à toutes les entreprises
 * clientes (sans copie). Lorsqu'un modèle est mis à jour, sa version augmente et les entreprises
 * ayant personnalisé ce modèle sont informées qu'une nouvelle version existe.
 */
export function GestionModelesDecoupagePlateforme() {
  const t = useTranslations("administration.parametres.modelesDecoupage");
  const profil = useAdministrateur();
  const peutAgir = peutParametrerPlateforme(profil);

  const requeteModeles = useQuery({
    queryKey: CLES_ADMINISTRATION.modelesDecoupage(),
    queryFn: ({ signal }) => listerModelesDecoupagePlateforme(signal),
  });
  const requeteListes = useQuery({
    queryKey: CLES_ADMINISTRATION.listesDecoupage(),
    queryFn: ({ signal }) => listerListesDecoupagePlateforme(signal),
  });
  const requeteTypesProjet = useQuery({
    queryKey: CLES_ADMINISTRATION.referentiels("types-projet"),
    queryFn: ({ signal }) => listerReferentielPlateforme("types-projet", signal),
  });

  const modeles = useMemo(() => requeteModeles.data ?? [], [requeteModeles.data]);
  const listes = useMemo(() => requeteListes.data ?? [], [requeteListes.data]);
  const typesProjet = useMemo(() => requeteTypesProjet.data ?? [], [requeteTypesProjet.data]);

  const [idSelectionne, setIdSelectionne] = useState<string | null>(null);
  const [enCreation, setEnCreation] = useState(false);
  const [compteurCreation, setCompteurCreation] = useState(0);

  const idEffectif = useMemo(() => {
    if (enCreation) return null;
    if (idSelectionne && modeles.some((m) => m.id === idSelectionne)) {
      return idSelectionne;
    }
    return modeles[0]?.id ?? null;
  }, [enCreation, idSelectionne, modeles]);

  const requeteDetail = useQuery({
    queryKey: CLES_ADMINISTRATION.modeleDecoupage(idEffectif ?? ""),
    queryFn: ({ signal }) => lireModeleDecoupagePlateforme(idEffectif!, signal),
    enabled: idEffectif !== null,
  });

  function messageErreur(cause: unknown): string {
    return cause instanceof ErreurApi && cause.message ? cause.message : t("erreur");
  }

  const telechargementExemple = useMutation({
    mutationFn: async () => {
      const blob = await telechargerModeleExcelDecoupagePlateforme();
      telechargerBlob(blob, "modele-decoupage-plateforme.xlsx");
    },
    onError: (cause) => toast.error(messageErreur(cause)),
  });

  function demarrerCreation() {
    setCompteurCreation((c) => c + 1);
    setEnCreation(true);
  }

  function choisirModeleCatalogue(m: ResumeModeleDecoupagePlateforme) {
    setEnCreation(false);
    setIdSelectionne(m.id);
  }

  const detailActif = enCreation ? null : requeteDetail.data ?? null;
  const cleFormulaire = enCreation
    ? `nouveau-${compteurCreation}`
    : detailActif
      ? `${detailActif.id}:v${detailActif.version}:${detailActif.estActif}:${detailActif.nombreLignes}`
      : "vide";

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{t("titre")}</h2>
          <p className="text-sm text-neutral-600">{t("description")}</p>
        </div>
        {peutAgir && (
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
          {/* Colonne gauche : catalogue des modèles plateforme */}
          <div className="flex flex-col gap-2 lg:col-span-4">
            <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              {t("catalogueModeles", { n: modeles.length })}
            </span>
            <ul className="flex max-h-[36rem] flex-col gap-1.5 overflow-y-auto pr-1">
              {modeles.map((m) => {
                const actif = !enCreation && idEffectif === m.id;
                return (
                  <li key={m.id}>
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
                          {m.nom}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge variante="neutre">{t("badgeVersion", { v: m.version })}</Badge>
                          <Badge variante={m.estActif ? "succes" : "neutre"}>
                            {m.estActif ? t("badgeActif") : t("badgeInactif")}
                          </Badge>
                        </div>
                      </div>
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

          {/* Colonne droite : détail / éditeur du modèle plateforme */}
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4 lg:col-span-8">
            {!enCreation && requeteDetail.isPending ? (
              <EtatChargement />
            ) : !enCreation && requeteDetail.isError ? (
              <EtatErreur onReessayer={() => void requeteDetail.refetch()} />
            ) : enCreation || detailActif ? (
              <FormulaireModelePlateforme
                key={cleFormulaire}
                enCreation={enCreation}
                detail={detailActif}
                listes={listes}
                typesProjet={typesProjet}
                peutAgir={peutAgir}
                peutAnnulerCreation={modeles.length > 0}
                onAnnulerCreation={() => setEnCreation(false)}
                onSelectionnerModele={(id) => {
                  setEnCreation(false);
                  setIdSelectionne(id);
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function FormulaireModelePlateforme({
  enCreation,
  detail,
  listes,
  typesProjet,
  peutAgir,
  peutAnnulerCreation,
  onAnnulerCreation,
  onSelectionnerModele,
}: {
  enCreation: boolean;
  detail: DetailModeleDecoupagePlateforme | null;
  listes: ListeDecoupagePlateforme[];
  typesProjet: EntreeReferentielPlateforme[];
  peutAgir: boolean;
  peutAnnulerCreation: boolean;
  onAnnulerCreation: () => void;
  onSelectionnerModele: (id: string | null) => void;
}) {
  const t = useTranslations("administration.parametres.modelesDecoupage");
  const cache = useQueryClient();
  const champFichierRef = useRef<HTMLInputElement | null>(null);

  const libellesDefaut = useMemo<[string, string, string]>(
    () => [t("niveauDefaut1"), t("niveauDefaut2"), t("niveauDefaut3")],
    [t],
  );

  const [nom, setNom] = useState(() => (detail ? detail.nom : ""));
  const [description, setDescription] = useState(() => (detail ? detail.description : ""));
  const [estActif, setEstActif] = useState(() => (detail ? detail.estActif : true));
  const [typesChoisis, setTypesChoisis] = useState<string[]>(() =>
    detail ? detail.typesProjet : [],
  );
  const [parDefautPour, setParDefautPour] = useState<string[]>(() =>
    detail ? detail.parDefautPour : [],
  );
  const [niveaux, setNiveaux] = useState<NiveauModelePlateforme[]>(() =>
    detail && detail.niveaux.length > 0 ? detail.niveaux : niveauxInitiaux(libellesDefaut),
  );
  const [lignes, setLignes] = useState<string[][]>(() => {
    const nb = detail && detail.niveaux.length > 0 ? detail.niveaux.length : 3;
    return normaliserLignesModele(detail ? detail.lignes : [], nb);
  });
  const [aSupprimer, setASupprimer] = useState<DetailModeleDecoupagePlateforme | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

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
        estActif,
        typesProjet: typesChoisis,
        parDefautPour: parDefautPour.filter((code) => typesChoisis.includes(code)),
        niveaux,
        lignes: lignesPropres,
      };
      if (enCreation) {
        return creerModeleDecoupagePlateforme(charge);
      }
      if (!detail) throw new Error("NO_DETAIL");
      return modifierModeleDecoupagePlateforme(detail.id, charge);
    },
    onSuccess: (enregistre) => {
      setErreur(null);
      toast.success(
        enCreation ? t("succesCreation") : t("succesModification", { v: enregistre.version }),
      );
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.modelesDecoupage() });
      void cache.invalidateQueries({
        queryKey: CLES_ADMINISTRATION.modeleDecoupage(enregistre.id),
      });
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.listesDecoupage() });
      onSelectionnerModele(enregistre.id);
    },
    onError: (cause) => setErreur(messageErreur(cause)),
  });

  const suppression = useMutation({
    mutationFn: (cible: DetailModeleDecoupagePlateforme) =>
      supprimerModeleDecoupagePlateforme(cible.id),
    onSuccess: () => {
      setASupprimer(null);
      toast.success(t("succesSuppression"));
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.modelesDecoupage() });
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.listesDecoupage() });
      onSelectionnerModele(null);
    },
    onError: (cause) => {
      setASupprimer(null);
      toast.error(messageErreur(cause));
    },
  });

  const importExcel = useMutation({
    mutationFn: (fichier: File) => importerFichierModelePlateforme(fichier),
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

  function modifierNiveau(index: number, partiel: Partial<NiveauModelePlateforme>) {
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
              {enCreation ? t("titreCreation") : detail?.nom}
            </h3>
            {!enCreation && detail && (
              <>
                <Badge variante="neutre">{t("badgeVersion", { v: detail.version })}</Badge>
                <Badge variante={detail.estActif ? "succes" : "neutre"}>
                  {detail.estActif ? t("badgeActif") : t("badgeInactif")}
                </Badge>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            {enCreation ? t("aideCreation") : t("aideModification")}
          </p>
        </div>

        {!enCreation && detail && peutAgir && (
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

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {/* Identité et disponibilité du modèle */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ
          libelle={t("champNom")}
          placeholder={t("placeholderNom")}
          value={nom}
          maxLength={150}
          disabled={!peutAgir || enregistrement.isPending}
          onChange={(e) => setNom(e.target.value)}
        />
        <Champ
          libelle={t("champDescription")}
          placeholder={t("placeholderDescription")}
          value={description}
          maxLength={300}
          disabled={!peutAgir || enregistrement.isPending}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-2 text-xs font-medium text-neutral-800">
        <Checkbox
          checked={estActif}
          disabled={!peutAgir || enregistrement.isPending}
          onCheckedChange={(v) => setEstActif(v === true)}
        />
        <span>{t("champEstActif")}</span>
      </label>

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
                      disabled={!peutAgir || enregistrement.isPending}
                      onCheckedChange={(v) => basculerTypeProjet(tp.code, v === true)}
                    />
                    <span className="truncate">{tp.libelle}</span>
                  </label>
                  {associe && (
                    <label className="flex items-center gap-1.5 text-neutral-600">
                      <Checkbox
                        checked={defaut}
                        disabled={!peutAgir || enregistrement.isPending}
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
          {peutAgir && (
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
            const valeurSelect = niv.liste ? niv.liste.id : SANS_LISTE;
            return (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-neutral-600">
                    {t("niveauRang", { rang: index + 1 })}
                  </span>
                  {peutAgir && (
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
                  disabled={!peutAgir || enregistrement.isPending}
                  onChange={(e) => modifierNiveau(index, { libelle: e.target.value })}
                />

                <Select
                  value={valeurSelect}
                  disabled={!peutAgir || enregistrement.isPending}
                  onValueChange={(val) => {
                    if (val === SANS_LISTE) {
                      modifierNiveau(index, { liste: null });
                      return;
                    }
                    const trouvee = listes.find((l) => l.id === val);
                    modifierNiveau(index, {
                      liste: trouvee ? { id: trouvee.id, libelle: trouvee.libelle } : null,
                    });
                  }}
                >
                  <SelectTrigger className="w-full bg-neutral-0 text-xs">
                    <SelectValue placeholder={t("sansListe")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SANS_LISTE}>{t("sansListe")}</SelectItem>
                    {listes.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.libelle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <label className="flex items-center gap-2 text-xs text-neutral-700">
                  <Checkbox
                    checked={niv.alerter}
                    disabled={!peutAgir || enregistrement.isPending}
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
          {peutAgir && (
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
                {peutAgir && <th className="w-10 px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lignes.map((ligne, r) => (
                <tr key={r} className="hover:bg-neutral-50/60">
                  <td className="px-2 py-1.5 text-center text-neutral-500">{r + 1}</td>
                  {niveaux.map((niv, col) => (
                    <td key={col} className="px-1.5 py-1">
                      <CelluleModelePlateforme
                        valeur={ligne[col] ?? ""}
                        niveau={niv}
                        listes={listes}
                        desactive={!peutAgir || enregistrement.isPending}
                        onChange={(val) => modifierCelluleLigne(r, col, val)}
                      />
                    </td>
                  ))}
                  {peutAgir && (
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

      {peutAgir && (
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

      {/* Modale de suppression d'un modèle plateforme */}
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
        <p>{t("confirmationSuppression", { nom: aSupprimer?.nom ?? "" })}</p>
      </Modale>
    </>
  );
}

function CelluleModelePlateforme({
  valeur,
  niveau,
  listes,
  desactive,
  onChange,
}: {
  valeur: string;
  niveau: NiveauModelePlateforme;
  listes: ListeDecoupagePlateforme[];
  desactive: boolean;
  onChange: (valeur: string) => void;
}) {
  const t = useTranslations("administration.parametres.modelesDecoupage");
  const liste = useMemo(
    () => (niveau.liste ? listes.find((l) => l.id === niveau.liste?.id) ?? null : null),
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
        placeholder={niveau.libelle || t("sansValeur")}
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

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Copy, Download, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EditeurModeleDecoupage } from "@/components/metier/EditeurModeleDecoupage";
import { Alerte, Badge, Bouton, EtatChargement, EtatErreur, EtatVide, Modale } from "@/components/ui";
import { Input } from "@/components/ui/input";
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
import { CLE_LISTES, cleDetailModele, cleModeles } from "../cles";
import {
  creerDonneesInitialesModele,
  telechargerBlob,
  type DonneesFormulaireModele,
  type LibellesEditeurModele,
} from "../editeurModele";
import {
  CRITERES_MODELES_ENTREPRISE_VIDES,
  filtrerModelesEntreprise,
} from "../regles";
import type {
  CriteresModelesEntreprise,
  DetailModele,
  FiltreOrigineModele,
  ListeValeurs,
  OrigineReference,
  ResumeModele,
} from "../types";

function cleModele(m: { origine: OrigineReference; id: string }): string {
  return `${m.origine}:${m.id}`;
}

const FILTRES_ORIGINE: {
  valeur: FiltreOrigineModele;
  cle: "filtreOrigineTous" | "filtreOriginePlateforme" | "filtreOrigineEntreprise";
}[] = [
  { valeur: "", cle: "filtreOrigineTous" },
  { valeur: "PLATEFORME", cle: "filtreOriginePlateforme" },
  { valeur: "ENTREPRISE", cle: "filtreOrigineEntreprise" },
];

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

  const [criteres, setCriteres] = useState<CriteresModelesEntreprise>(
    CRITERES_MODELES_ENTREPRISE_VIDES,
  );
  const modelesFiltres = useMemo(
    () => filtrerModelesEntreprise(modeles, criteres),
    [modeles, criteres],
  );

  const [selection, setSelection] = useState<{ origine: OrigineReference; id: string } | null>(null);
  const [enCreation, setEnCreation] = useState(false);
  const [compteurCreation, setCompteurCreation] = useState(0);

  const selectionEffective = useMemo(() => {
    if (enCreation) return null;
    if (
      selection &&
      modelesFiltres.some((m) => m.origine === selection.origine && m.id === selection.id)
    ) {
      return selection;
    }
    if (
      selection &&
      modeles.some((m) => m.origine === selection.origine && m.id === selection.id)
    ) {
      return selection;
    }
    const premier = modelesFiltres[0] ?? modeles[0];
    return premier ? { origine: premier.origine, id: premier.id } : null;
  }, [enCreation, selection, modelesFiltres, modeles]);

  const requeteDetail = useQuery({
    queryKey: cleDetailModele(
      selectionEffective?.origine ?? "",
      selectionEffective?.id ?? "",
    ),
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
      ? `${detailActif.origine}:${detailActif.id}:${detailActif.nom}:${detailActif.niveaux.length}:${detailActif.lignes.length}`
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
          <div className="flex flex-col gap-2.5 lg:col-span-4">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <Input
                value={criteres.recherche}
                placeholder={t("rechercherModelePlaceholder")}
                aria-label={t("rechercherModele")}
                className="pl-9 text-xs"
                onChange={(e) =>
                  setCriteres((courant) => ({ ...courant, recherche: e.target.value }))
                }
              />
            </div>

            <div
              role="group"
              aria-label={t("filtreOrigine")}
              className="flex flex-wrap items-center gap-1"
            >
              {FILTRES_ORIGINE.map(({ valeur, cle }) => {
                const actif = criteres.origine === valeur;
                return (
                  <button
                    key={cle}
                    type="button"
                    onClick={() => setCriteres((courant) => ({ ...courant, origine: valeur }))}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      actif
                        ? "border-primary-600 bg-primary-600 text-neutral-0"
                        : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100",
                    )}
                  >
                    {t(cle)}
                  </button>
                );
              })}
            </div>

            <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              {t("catalogueModeles", { n: modelesFiltres.length })}
            </span>

            {modelesFiltres.length === 0 ? (
              <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center text-xs text-neutral-500">
                {t("aucunModeleFiltre")}
              </p>
            ) : (
              <ul className="flex max-h-[34rem] flex-col gap-1.5 overflow-y-auto pr-1">
                {modelesFiltres.map((m) => {
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
                                : m.estPersonnalise
                                  ? "primaire"
                                  : "information"
                            }
                          >
                            {m.origine === "PLATEFORME"
                              ? t("badgePlateforme")
                              : m.estPersonnalise
                                ? t("badgePersonnalise")
                                : t("badgeEntreprise")}
                          </Badge>
                        </div>
                        {m.originalModifie && (
                          <Badge variante="avertissement">{t("badgeOriginalModifie")}</Badge>
                        )}
                        {m.originalSupprime && (
                          <Badge variante="neutre">{t("badgeOriginalSupprime")}</Badge>
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
            )}
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
                onTelechargerExemple={() => telechargementExemple.mutate()}
                telechargementEnCours={telechargementExemple.isPending}
                onSelectionnerModele={(cible) => {
                  setEnCreation(false);
                  if (cible) {
                    setCriteres((courant) =>
                      courant.origine && courant.origine !== cible.origine
                        ? { ...courant, origine: "" }
                        : courant,
                    );
                  }
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
  onTelechargerExemple,
  telechargementEnCours,
  onSelectionnerModele,
}: {
  enCreation: boolean;
  detail: DetailModele | null;
  listes: ListeValeurs[];
  typesProjet: { code: string; libelle: string }[];
  peutGerer: boolean;
  peutAnnulerCreation: boolean;
  onAnnulerCreation: () => void;
  onTelechargerExemple: () => void;
  telechargementEnCours: boolean;
  onSelectionnerModele: (cible: { origine: OrigineReference; id: string } | null) => void;
}) {
  const t = useTranslations("decoupage.modeles");
  const cache = useQueryClient();

  const [aSupprimer, setASupprimer] = useState<DetailModele | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const estModifiable = enCreation || (peutGerer && Boolean(detail?.modifiable));

  const libellesDefaut = useMemo<[string, string, string]>(
    () => [t("niveauDefaut1"), t("niveauDefaut2"), t("niveauDefaut3")],
    [t],
  );

  const valeursInitiales = useMemo(
    () => creerDonneesInitialesModele(detail, libellesDefaut),
    [detail, libellesDefaut],
  );

  function messageErreur(cause: unknown): string {
    return cause instanceof ErreurApi && cause.message ? cause.message : t("erreur");
  }

  const enregistrement = useMutation({
    mutationFn: async (donnees: DonneesFormulaireModele) => {
      const charge = {
        nom: donnees.nom,
        description: donnees.description,
        typesProjet: donnees.typesProjet,
        parDefautPour: donnees.parDefautPour,
        niveaux: donnees.niveaux.map((niv) => ({
          libelle: niv.libelle,
          alerter: niv.alerter,
          liste: niv.liste
            ? {
                origine: niv.liste.origine ?? "PLATEFORME",
                id: niv.liste.id,
                libelle: niv.liste.libelle,
              }
            : null,
        })),
        lignes: donnees.lignes,
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
        queryKey: cleDetailModele(enregistre.origine, enregistre.id),
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
      setErreur(null);
      toast.success(t("succesImportExcel", { lignes: importe.lignes.length }));
    },
    onError: (cause) => setErreur(messageErreur(cause)),
  });

  const libellesEditeur = useMemo<LibellesEditeurModele>(
    () => ({
      champNom: t("champNom"),
      placeholderNom: t("placeholderNom"),
      champDescription: t("champDescription"),
      placeholderDescription: t("placeholderDescription"),
      typesProjetTitre: t("typesProjetTitre"),
      typesProjetAide: t("typesProjetAide"),
      parDefautCourt: t("parDefautCourt"),
      niveauxTitre: t("niveauxTitre"),
      niveauxAide: t("niveauxAide"),
      ajouterNiveau: t("ajouterNiveau"),
      niveauRang: (rang) => t("niveauRang", { rang }),
      deplacerGauche: t("deplacerGauche"),
      deplacerDroite: t("deplacerDroite"),
      retirerNiveau: t("retirerNiveau"),
      placeholderNiveau: t("placeholderNiveau"),
      sansListe: t("sansListe"),
      alerterNiveau: t("alerterNiveau"),
      lignesTitre: (n) => t("lignesTitre", { n }),
      lignesAide: t("lignesAide"),
      telechargerModeleExcel: t("telechargerModeleExcel"),
      importerExcel: t("importerExcel"),
      ajouterLigne: t("ajouterLigne"),
      retirerLigne: t("retirerLigne"),
      viderCellule: t("viderCellule"),
      sansValeur: t("sansValeur"),
      rechercherValeur: t("rechercherValeur"),
      aucuneValeur: t("aucuneValeur"),
      utiliserValeurLibre: (saisie) => t("utiliserValeurLibre", { saisie }),
      annuler: t("annuler"),
      enregistrer: enCreation ? t("creerModele") : t("enregistrerModele"),
    }),
    [t, enCreation],
  );

  return (
    <>
      <EditeurModeleDecoupage
        titre={enCreation ? t("titreCreation") : (detail?.nomAffiche ?? "")}
        sousTitre={
          enCreation
            ? t("aideCreation")
            : detail?.origine === "PLATEFORME"
              ? t("aideModelePlateforme")
              : t("aideModeleEntreprise")
        }
        badges={
          !enCreation && detail ? (
            <Badge
              variante={
                detail.origine === "PLATEFORME"
                  ? "neutre"
                  : detail.estPersonnalise
                    ? "primaire"
                    : "information"
              }
            >
              {detail.origine === "PLATEFORME"
                ? t("badgePlateforme")
                : detail.estPersonnalise
                  ? t("badgePersonnalise")
                  : t("badgeEntreprise")}
            </Badge>
          ) : undefined
        }
        actionsEnTete={
          !enCreation && detail && peutGerer ? (
            <>
              {detail.origine === "PLATEFORME" && (
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
              {detail.modifiable && (
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
            </>
          ) : undefined
        }
        slotAlertes={
          !enCreation && detail ? (
            <>
              {detail.origine === "PLATEFORME" && (
                <Alerte type="information">{t("bandeauModelePlateforme")}</Alerte>
              )}
              {detail.originalModifie && (
                <Alerte type="avertissement">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{t("alerteOriginalModifie")}</span>
                    {detail.originePlateformeId && (
                      <Bouton
                        variante="secondaire"
                        taille="sm"
                        iconeGauche={<ExternalLink size={14} />}
                        onClick={() =>
                          onSelectionnerModele({
                            origine: "PLATEFORME",
                            id: detail.originePlateformeId!,
                          })
                        }
                      >
                        {t("voirOriginal")}
                      </Bouton>
                    )}
                  </div>
                </Alerte>
              )}
              {detail.originalSupprime && (
                <Alerte type="information">{t("alerteOriginalSupprime")}</Alerte>
              )}
            </>
          ) : undefined
        }
        erreur={erreur}
        valeursInitiales={valeursInitiales}
        listes={listes}
        typesProjet={typesProjet}
        peutEcrire={estModifiable}
        enregistrementEnCours={enregistrement.isPending}
        onEnregistrer={(donnees) => enregistrement.mutate(donnees)}
        peutAnnuler={enCreation && peutAnnulerCreation}
        onAnnuler={onAnnulerCreation}
        onTelechargerExemple={onTelechargerExemple}
        telechargementEnCours={telechargementEnCours}
        onImporterFichier={(fichier) => importExcel.mutateAsync(fichier)}
        importEnCours={importExcel.isPending}
        libelles={libellesEditeur}
      />

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

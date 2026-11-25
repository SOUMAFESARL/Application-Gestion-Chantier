"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Diamond,
  FileCode2,
  ListTree,
  LoaderCircle,
  Lock,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ZoneDepotFichiers } from "@/components/ui/zone-depot-fichiers";
import { cleDecoupage } from "@/features/decoupage/cles";
import { CLE_LISTE_PROJETS, cleProjet } from "@/features/projets/cles";
import { ErreurApi } from "@/lib/api";
import {
  ABSENT,
  formaterDate,
  formaterMontant,
  formaterPourcentage,
  formaterQuantite,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { analyserImportMsProject, importerMsProject } from "../adaptateur";
import { clePlanningGantt } from "../cles";
import {
  aBaselineDifferente,
  aplatirTachesMsProject,
  calculerCoutFcfaCentimes,
  convertirAnalyseMsProjectEnPlanning,
  formaterEtiquetteDependance,
  tauxConversionInitialMsProject,
  validerFichierMsProject,
} from "../regles";
import type {
  AnalyseMsProject,
  EtatImportMsProject,
  ResultatImportMsProject,
} from "../types";
import { DiagrammeGantt } from "./DiagrammeGantt";

type OngletApercu = "LISTE" | "GANTT";

const FORMAT_XML_ACCEPTE = ".xml,application/xml,text/xml";

export interface PropsModaleImportMsProject {
  projetId: string;
  nomProjet: string;
  etatImport: EtatImportMsProject;
  ouverte: boolean;
  onFermer: () => void;
  onSuccesImport?: (resultat: ResultatImportMsProject) => void;
}

function messageErreurImport(erreur: unknown, repli: string): string {
  if (erreur instanceof ErreurApi) {
    const champs = Object.values(erreur.erreursParChamp);
    if (erreur.code === "validation" && champs.length > 0) return champs.join(" ");
    return erreur.message || repli;
  }
  return repli;
}

/**
 * Modale en 2 étapes d'import d'un planning Microsoft Project (`.xml`) :
 * 1. Sélection du fichier `.xml` (ou état verrouillé si le projet a démarré) ;
 * 2. Aperçu interactif (statistiques, avertissements, liste structurée + aperçu Gantt)
 *    avec confirmation explicite en cas de remplacement du découpage existant.
 */
export function ModaleImportMsProject({
  projetId,
  nomProjet,
  etatImport,
  ouverte,
  onFermer,
  onSuccesImport,
}: PropsModaleImportMsProject) {
  return (
    <Dialog open={ouverte} onOpenChange={(visible) => !visible && onFermer()}>
      {ouverte && (
        <ContenuModaleImportMsProject
          key={projetId}
          projetId={projetId}
          nomProjet={nomProjet}
          etatImport={etatImport}
          onFermer={onFermer}
          onSuccesImport={onSuccesImport}
        />
      )}
    </Dialog>
  );
}

function ContenuModaleImportMsProject({
  projetId,
  nomProjet,
  etatImport,
  onFermer,
  onSuccesImport,
}: Omit<PropsModaleImportMsProject, "ouverte">) {
  const t = useTranslations("planning.importMsProject");
  const clientRequetes = useQueryClient();

  const [fichiers, setFichiers] = useState<File[]>([]);
  const [analyse, setAnalyse] = useState<AnalyseMsProject | null>(null);
  const [onglet, setOnglet] = useState<OngletApercu>("LISTE");
  const [confirmerRemplacement, setConfirmerRemplacement] = useState(false);
  const [importerMontants, setImporterMontants] = useState(false);
  const [tauxConversionSaisi, setTauxConversionSaisi] = useState("1");
  const [montantsDejaFcfa, setMontantsDejaFcfa] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const fichierSelectionne = fichiers[0] ?? null;
  const etatEffectif = analyse?.etatImport ?? etatImport;

  const tauxInitial = useMemo(
    () => (analyse ? tauxConversionInitialMsProject(analyse.projetXml) : 1),
    [analyse],
  );

  const deviseEstXof = (analyse?.projetXml.deviseCode ?? "XOF") === "XOF";
  const afficherMontants = Boolean(
    analyse && etatEffectif.peutVoirMontants && analyse.statistiques.tachesChiffrees > 0,
  );

  const tauxParse = Number(tauxConversionSaisi.replace(",", "."));
  const tauxValide = Number.isFinite(tauxParse) && tauxParse > 0 ? tauxParse : null;
  const tauxEffectif = deviseEstXof || montantsDejaFcfa ? 1 : tauxValide;

  const coutTotalCentimes = useMemo(() => {
    if (!analyse || !afficherMontants) return null;
    return calculerCoutFcfaCentimes(
      analyse.projetXml.coutTotalBrut,
      analyse.projetXml.coutTotalFcfa,
      tauxEffectif,
      tauxInitial,
    );
  }, [analyse, afficherMontants, tauxEffectif, tauxInitial]);

  const mutationAnalyser = useMutation({
    mutationFn: (fichier: File) => analyserImportMsProject(projetId, fichier),
    onSuccess: (resultat) => {
      setAnalyse(resultat);
      setConfirmerRemplacement(false);
      setOnglet("LISTE");
      setErreur(null);
      const tauxDefaut = tauxConversionInitialMsProject(resultat.projetXml);
      setTauxConversionSaisi(String(tauxDefaut));
      setMontantsDejaFcfa(resultat.projetXml.deviseCode === "XOF");
      setImporterMontants(
        resultat.etatImport.peutChiffrer && resultat.statistiques.tachesChiffrees > 0,
      );
    },
    onError: (err) => {
      setErreur(messageErreurImport(err, t("erreurs.analyseEchouee")));
    },
  });

  const mutationImporter = useMutation({
    mutationFn: () => {
      if (!fichierSelectionne) {
        throw new Error(t("erreurs.fichierManquant"));
      }
      const activerMontants = afficherMontants && etatEffectif.peutChiffrer && importerMontants;
      return importerMsProject(projetId, fichierSelectionne, {
        confirmerRemplacement,
        importerMontants: activerMontants,
        tauxConversion: activerMontants && tauxEffectif !== null ? tauxEffectif : undefined,
      });
    },
    onSuccess: async (resultat) => {
      clientRequetes.setQueryData(clePlanningGantt(projetId), resultat.planning);
      await Promise.all([
        clientRequetes.invalidateQueries({ queryKey: clePlanningGantt(projetId) }),
        clientRequetes.invalidateQueries({ queryKey: cleDecoupage(projetId) }),
        clientRequetes.invalidateQueries({ queryKey: cleProjet(projetId) }),
        clientRequetes.invalidateQueries({ queryKey: CLE_LISTE_PROJETS }),
      ]);
      toast.success(
        t("succesImport", {
          elements: resultat.elementsCrees,
          dependances: resultat.dependancesCreees,
        }),
      );
      onSuccesImport?.(resultat);
      onFermer();
    },
    onError: (err) => {
      setErreur(messageErreurImport(err, t("erreurs.importEchoue")));
    },
  });

  const enCours = mutationAnalyser.isPending || mutationImporter.isPending;

  const lignesApercu = useMemo(
    () => (analyse ? aplatirTachesMsProject(analyse.taches) : []),
    [analyse],
  );

  const planningApercu = useMemo(
    () => (analyse ? convertirAnalyseMsProjectEnPlanning(analyse) : null),
    [analyse],
  );

  const refuserFichier = (fichier: File): string | null => {
    const code = validerFichierMsProject(fichier);
    if (code === "extension") return t("erreurs.extensionInvalide");
    if (code === "taille") return t("erreurs.tailleDepassee");
    return null;
  };

  const etapeApercu = analyse !== null;
  const tauxRequisValide =
    !afficherMontants || !etatEffectif.peutChiffrer || !importerMontants || tauxEffectif !== null;
  const peutValiderImport =
    etapeApercu &&
    etatEffectif.autorise &&
    (!etatEffectif.remplacementRequis || confirmerRemplacement) &&
    tauxRequisValide &&
    !mutationImporter.isPending;

  return (
    <DialogContent
      className={cn(
        "flex max-h-[92vh] flex-col gap-4 overflow-hidden",
        etapeApercu ? "sm:max-w-[1120px]" : "sm:max-w-[600px]",
      )}
      showCloseButton={!enCours}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileCode2 className="size-5 text-primary-600" aria-hidden="true" />
          <span>{etapeApercu ? t("titreApercu") : t("titre")}</span>
        </DialogTitle>
        <DialogDescription>
          {etapeApercu
            ? t("descriptionApercu", { fichier: fichierSelectionne?.name ?? nomProjet })
            : t("description", { projet: nomProjet })}
        </DialogDescription>
      </DialogHeader>

      {/* Contenu défilant */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {/* État verrouillé si le projet a déjà démarré */}
        {!etatEffectif.autorise && (
          <Alert variant="erreur">
            <Lock className="size-4" aria-hidden="true" />
            <AlertTitle>{t("verrouille.titre")}</AlertTitle>
            <AlertDescription>
              {etatEffectif.motifBlocage ?? t("verrouille.descriptionDefaut")}
            </AlertDescription>
          </Alert>
        )}

        {/* ÉTAPE 1 : Sélection du fichier XML */}
        {!etapeApercu && (
          <>
            {etatEffectif.autorise && etatEffectif.remplacementRequis && (
              <Alert variant="avertissement">
                <AlertTriangle className="size-4" aria-hidden="true" />
                <AlertTitle>{t("remplacement.alerteTitre")}</AlertTitle>
                <AlertDescription>{t("remplacement.alerteDescription")}</AlertDescription>
              </Alert>
            )}

            <ZoneDepotFichiers
              fichiers={fichiers}
              onChange={(nouveaux) => {
                setFichiers(nouveaux);
                setErreur(null);
              }}
              accept={FORMAT_XML_ACCEPTE}
              multiple={false}
              refuser={refuserFichier}
              consigne={t("consigneDepot")}
              disabled={!etatEffectif.autorise || enCours}
            />

            <div className="rounded-lg border border-solid border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
              <p className="m-0 font-semibold text-neutral-800">{t("aideExport.titre")}</p>
              <p className="m-0 mt-1">{t("aideExport.description")}</p>
            </div>
          </>
        )}

        {/* ÉTAPE 2 : Aperçu interactif avant import */}
        {etapeApercu && analyse && planningApercu && (
          <>
            {/* Métadonnées XML, baseline, total FCFA & niveaux */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-solid border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-neutral-900">
                  {analyse.projetXml.titre || nomProjet}
                </span>
                <span className="text-neutral-600 tabular-nums">
                  {t("apercu.periodeXml", {
                    debut: formaterDate(analyse.projetXml.dateDebut),
                    fin: formaterDate(analyse.projetXml.dateFin),
                  })}
                </span>
                {(analyse.projetXml.dateDebutBaseline || analyse.projetXml.dateFinBaseline) && (
                  <span className="text-neutral-500 tabular-nums">
                    {t("apercu.baselineXml", {
                      debut: formaterDate(analyse.projetXml.dateDebutBaseline),
                      fin: formaterDate(analyse.projetXml.dateFinBaseline),
                    })}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {afficherMontants && (
                  <div className="flex flex-col items-end gap-0.5 rounded-md border border-solid border-primary-200 bg-neutral-0 px-3 py-1.5">
                    <span className="text-[11px] text-neutral-500">{t("montants.totalConverti")}</span>
                    <span className="text-sm font-bold text-neutral-900 tabular-nums">
                      {coutTotalCentimes !== null ? formaterMontant(coutTotalCentimes) : ABSENT}
                    </span>
                    {!deviseEstXof &&
                      tauxEffectif !== 1 &&
                      analyse.projetXml.coutTotalBrut !== null && (
                        <span className="text-[11px] text-neutral-500 tabular-nums">
                          {t("montants.totalBrut", {
                            montant: formaterQuantite(analyse.projetXml.coutTotalBrut),
                            devise: analyse.projetXml.deviseSymbole || analyse.projetXml.deviseCode,
                          })}
                        </span>
                      )}
                  </div>
                )}

                {analyse.niveaux.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-neutral-500">{t("apercu.niveaux")}</span>
                    {analyse.niveaux.map((niv) => (
                      <Badge key={niv.ordre} variante="neutre">
                        {niv.libelle}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Statistiques clés */}
            <div
              className={cn(
                "grid grid-cols-2 gap-3",
                analyse.statistiques.inactives > 0
                  ? "sm:grid-cols-3 lg:grid-cols-6"
                  : "sm:grid-cols-5",
              )}
            >
              <CarteStatistique
                libelle={t("statistiques.totalTaches")}
                valeur={analyse.statistiques.totalTaches}
              />
              <CarteStatistique
                libelle={t("statistiques.feuilles")}
                valeur={analyse.statistiques.feuilles}
              />
              <CarteStatistique
                libelle={t("statistiques.jalons")}
                valeur={analyse.statistiques.jalons}
              />
              {analyse.statistiques.inactives > 0 && (
                <CarteStatistique
                  libelle={t("statistiques.inactives")}
                  valeur={analyse.statistiques.inactives}
                />
              )}
              <CarteStatistique
                libelle={t("statistiques.dependancesRetenues")}
                valeur={analyse.statistiques.dependancesRetenues}
                ton="succes"
              />
              <CarteStatistique
                libelle={t("statistiques.dependancesIgnorees")}
                valeur={analyse.statistiques.dependancesIgnorees}
                ton={analyse.statistiques.dependancesIgnorees > 0 ? "avertissement" : "neutre"}
              />
            </div>

            {/* Encart montants & conversion de devise */}
            {afficherMontants && (
              <div className="flex flex-col gap-3 rounded-lg border border-solid border-primary-200 bg-primary-50/40 p-3.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-neutral-900">
                    <Banknote className="size-4 text-primary-600" aria-hidden="true" />
                    <span>
                      {t("montants.titre", { nombre: analyse.statistiques.tachesChiffrees })}
                    </span>
                  </div>
                  {!deviseEstXof && (
                    <Badge variante="information">
                      {t("montants.deviseDetectee", {
                        code: analyse.projetXml.deviseCode,
                        symbole: analyse.projetXml.deviseSymbole,
                      })}
                    </Badge>
                  )}
                </div>

                {!deviseEstXof && (
                  <div className="flex flex-wrap items-end gap-4 rounded-md border border-solid border-neutral-200 bg-neutral-0 p-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-neutral-700">
                        {t("montants.tauxConversion", { code: analyse.projetXml.deviseCode })}
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={tauxConversionSaisi}
                        disabled={montantsDejaFcfa || enCours}
                        onChange={(evenement) => {
                          setTauxConversionSaisi(evenement.target.value);
                          setMontantsDejaFcfa(false);
                        }}
                        aria-label={t("montants.tauxConversion", {
                          code: analyse.projetXml.deviseCode,
                        })}
                        className="h-8 w-40 bg-neutral-0 text-xs tabular-nums"
                      />
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 pb-1 text-xs font-medium text-neutral-800">
                      <Checkbox
                        checked={montantsDejaFcfa}
                        disabled={enCours}
                        onCheckedChange={(coche) => {
                          const actif = coche === true;
                          setMontantsDejaFcfa(actif);
                          setTauxConversionSaisi(actif ? "1" : String(tauxInitial));
                        }}
                      />
                      <span>{t("montants.dejaEnFcfa")}</span>
                    </label>

                    {tauxEffectif === null && (
                      <span className="w-full text-[11px] font-medium text-erreur">
                        {t("montants.tauxInvalide")}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label
                    className={cn(
                      "flex items-start gap-2.5 text-xs",
                      etatEffectif.peutChiffrer
                        ? "cursor-pointer text-neutral-900"
                        : "cursor-not-allowed text-neutral-500",
                    )}
                  >
                    <Checkbox
                      checked={importerMontants}
                      disabled={!etatEffectif.peutChiffrer || enCours}
                      onCheckedChange={(v) => setImporterMontants(v === true)}
                      className="mt-0.5"
                    />
                    <span className="leading-relaxed font-medium">
                      {t("montants.importerCheckbox")}
                    </span>
                  </label>
                  {!etatEffectif.peutChiffrer && (
                    <p className="m-0 pl-6 text-[11px] text-neutral-500">
                      {t("montants.permissionChiffrerRequise")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Avertissements de l'analyse */}
            {analyse.avertissements.length > 0 && (
              <Alert variant="avertissement">
                <AlertTriangle className="size-4" aria-hidden="true" />
                <AlertTitle>
                  {t("avertissements.titre", { nombre: analyse.avertissements.length })}
                </AlertTitle>
                <AlertDescription className="w-full">
                  <ul className="m-0 mt-1 max-h-28 list-disc overflow-y-auto pl-4 text-xs">
                    {analyse.avertissements.map((avert, idx) => (
                      <li key={`${avert.code}-${idx}`}>{avert.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Bascule Liste structurée / Graphe Gantt */}
            <div
              role="tablist"
              aria-label={t("onglets.aria")}
              className="flex gap-1 border-0 border-b border-solid border-neutral-200"
            >
              <button
                type="button"
                role="tab"
                aria-selected={onglet === "LISTE"}
                onClick={() => setOnglet("LISTE")}
                className={cn(
                  "-mb-px inline-flex cursor-pointer items-center gap-1.5 border-0 border-b-2 border-solid bg-transparent px-4 py-2 text-sm font-medium transition-colors",
                  onglet === "LISTE"
                    ? "border-primary text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-800",
                )}
              >
                <ListTree className="size-4" aria-hidden="true" />
                <span>{t("onglets.liste")}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={onglet === "GANTT"}
                onClick={() => setOnglet("GANTT")}
                className={cn(
                  "-mb-px inline-flex cursor-pointer items-center gap-1.5 border-0 border-b-2 border-solid bg-transparent px-4 py-2 text-sm font-medium transition-colors",
                  onglet === "GANTT"
                    ? "border-primary text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-800",
                )}
              >
                <BarChart3 className="size-4" aria-hidden="true" />
                <span>{t("onglets.gantt")}</span>
              </button>
            </div>

            {/* Panneau Liste structurée */}
            {onglet === "LISTE" && (
              <div className="flex flex-col gap-4">
                <div className="max-h-72 overflow-auto rounded-lg border border-solid border-neutral-200">
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 bg-neutral-50 text-neutral-700">
                      <tr className="border-0 border-b border-solid border-neutral-200">
                        <th className="px-3 py-2 text-left font-semibold">{t("liste.numero")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("liste.tache")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("liste.niveau")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("liste.debut")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("liste.fin")}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t("liste.duree")}</th>
                        {afficherMontants && (
                          <th className="px-3 py-2 text-right font-semibold">
                            {t("liste.montantFcfa")}
                          </th>
                        )}
                        <th className="px-3 py-2 text-right font-semibold">{t("liste.avancementXml")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignesApercu.map(({ tache, profondeur }) => {
                        const inactive = !tache.estActif;
                        const aBaseline = Boolean(tache.debutBaseline || tache.finBaseline);
                        const baselineDiff = aBaselineDifferente(tache);
                        const centimesLigne = afficherMontants
                          ? calculerCoutFcfaCentimes(
                              tache.coutBrut,
                              tache.coutFcfa,
                              tauxEffectif,
                              tauxInitial,
                            )
                          : null;

                        return (
                          <tr
                            key={tache.uid}
                            className={cn(
                              "border-0 border-b border-solid border-neutral-100 last:border-b-0 hover:bg-neutral-50",
                              inactive && "bg-neutral-50/80 text-neutral-400 opacity-75",
                            )}
                          >
                            <td className="px-3 py-2 font-mono text-neutral-500">
                              {tache.numero ?? ABSENT}
                            </td>
                            <td className="px-3 py-2">
                              <div
                                className="flex flex-wrap items-center gap-1.5"
                                style={{ paddingLeft: Math.min(profondeur, 6) * 14 }}
                              >
                                {tache.estJalon && (
                                  <Diamond
                                    className="size-3 shrink-0 fill-avertissement text-avertissement"
                                    aria-hidden="true"
                                  />
                                )}
                                <span
                                  className={cn(
                                    !tache.estFeuille
                                      ? "font-semibold text-neutral-900"
                                      : "text-neutral-800",
                                    inactive && "font-normal text-neutral-500 line-through",
                                  )}
                                >
                                  {tache.libelle}
                                </span>
                                {inactive && (
                                  <Badge variante="neutre">{t("liste.badgeDesactivee")}</Badge>
                                )}
                                {aBaseline && (
                                  <Badge variante="neutre">{t("liste.badgeBaseline")}</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-neutral-600">{tache.niveau ?? ABSENT}</td>
                            <td className="px-3 py-2 text-neutral-600 tabular-nums">
                              <div>{formaterDate(tache.debut)}</div>
                              {baselineDiff && tache.debutBaseline && (
                                <div className="text-[10px] text-neutral-400">
                                  {t("liste.baselineDate", {
                                    date: formaterDate(tache.debutBaseline),
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-neutral-600 tabular-nums">
                              <div>{formaterDate(tache.fin)}</div>
                              {baselineDiff && tache.finBaseline && (
                                <div className="text-[10px] text-neutral-400">
                                  {t("liste.baselineDate", {
                                    date: formaterDate(tache.finBaseline),
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-neutral-600 tabular-nums">
                              {tache.dureeHeures !== null
                                ? t("liste.heures", { heures: tache.dureeHeures })
                                : ABSENT}
                            </td>
                            {afficherMontants && (
                              <td
                                className={cn(
                                  "px-3 py-2 text-right whitespace-nowrap text-neutral-700 tabular-nums",
                                  inactive && "text-neutral-400 line-through",
                                )}
                              >
                                {centimesLigne !== null
                                  ? formaterMontant(centimesLigne, { avecDevise: false })
                                  : ABSENT}
                              </td>
                            )}
                            <td className="px-3 py-2 text-right text-neutral-600 tabular-nums">
                              {formaterPourcentage(tache.pourcentageXml)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Liste des dépendances FS détectées */}
                {analyse.dependances.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h4 className="m-0 text-xs font-semibold text-neutral-700">
                      {t("liste.dependancesTitre", { nombre: analyse.dependances.length })}
                    </h4>
                    <div className="max-h-40 overflow-auto rounded-lg border border-solid border-neutral-200">
                      <ul className="m-0 divide-y divide-neutral-100 p-0 text-xs">
                        {analyse.dependances.map((dep, idx) => (
                          <li
                            key={`${dep.predecesseurUid}-${dep.successeurUid}-${idx}`}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <span className="flex min-w-0 items-center gap-2 text-neutral-800">
                              <span className="truncate font-medium">{dep.predecesseurLibelle}</span>
                              <ArrowRight className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                              <span className="truncate font-medium">{dep.successeurLibelle}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              <Badge variante="neutre">
                                {formaterEtiquetteDependance(dep.type, dep.decalageJours)}
                              </Badge>
                              {dep.respectee === true && (
                                <Badge
                                  variante="succes"
                                  icone={<CheckCircle2 className="size-3" aria-hidden="true" />}
                                >
                                  {t("liste.lienRespecte")}
                                </Badge>
                              )}
                              {dep.respectee === false && (
                                <Badge
                                  variante="erreur"
                                  icone={<AlertTriangle className="size-3" aria-hidden="true" />}
                                >
                                  {t("liste.lienNonRespecte")}
                                </Badge>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Panneau Graphe Gantt prévisualisé */}
            {onglet === "GANTT" && (
              <DiagrammeGantt
                planning={planningApercu}
                nomProjet={analyse.projetXml.titre ?? nomProjet}
                lectureSeule
                masquerExport
                taille="compact"
              />
            )}

            {/* Case de confirmation obligatoire si remplacement */}
            {etatEffectif.autorise && etatEffectif.remplacementRequis && (
              <div className="rounded-lg border border-solid border-avertissement/30 bg-avertissement-fond p-3">
                <label className="flex cursor-pointer items-start gap-2.5 text-xs text-neutral-900">
                  <Checkbox
                    checked={confirmerRemplacement}
                    onCheckedChange={(v) => setConfirmerRemplacement(v === true)}
                    className="mt-0.5"
                  />
                  <span className="leading-relaxed font-medium">
                    {t("remplacement.confirmationLibelle")}
                  </span>
                </label>
              </div>
            )}
          </>
        )}

        {erreur && (
          <Alert variant="erreur">
            <CircleAlert className="size-4" aria-hidden="true" />
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Pied de modale */}
      <DialogFooter className="flex-row items-center justify-between gap-2 border-0 border-t border-solid border-neutral-200 pt-3 max-sm:flex-col-reverse">
        <div>
          {etapeApercu && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={enCours}
              onClick={() => {
                setAnalyse(null);
                setConfirmerRemplacement(false);
                setImporterMontants(false);
                setTauxConversionSaisi("1");
                setMontantsDejaFcfa(false);
                setErreur(null);
              }}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>{t("actions.changerFichier")}</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("actions.annuler")}
          </Button>

          {!etapeApercu ? (
            <Button
              type="button"
              disabled={!etatEffectif.autorise || !fichierSelectionne || mutationAnalyser.isPending}
              aria-busy={mutationAnalyser.isPending}
              onClick={() => fichierSelectionne && mutationAnalyser.mutate(fichierSelectionne)}
            >
              {mutationAnalyser.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              <span>{t("actions.analyser")}</span>
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!peutValiderImport}
              aria-busy={mutationImporter.isPending}
              onClick={() => mutationImporter.mutate()}
            >
              {mutationImporter.isPending && (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              )}
              <span>{t("actions.importer")}</span>
            </Button>
          )}
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

function CarteStatistique({
  libelle,
  valeur,
  ton = "neutre",
}: {
  libelle: string;
  valeur: number;
  ton?: "neutre" | "succes" | "avertissement";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border border-solid px-3 py-2",
        ton === "succes"
          ? "border-succes/20 bg-succes-fond"
          : ton === "avertissement"
            ? "border-avertissement/20 bg-avertissement-fond"
            : "border-neutral-200 bg-neutral-50",
      )}
    >
      <span className="text-[11px] font-medium text-neutral-600">{libelle}</span>
      <span className="text-lg font-bold text-neutral-900 tabular-nums">{valeur}</span>
    </div>
  );
}

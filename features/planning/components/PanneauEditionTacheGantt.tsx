"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Diamond,
  Link2,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge, type VarianteBadge } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { planifierCase, prolongationsRequises } from "@/features/decoupage/adaptateur";
import { cleDecoupage } from "@/features/decoupage/cles";
import type { Prolongation } from "@/features/decoupage/types";
import { PERMISSIONS, useDroits } from "@/features/habilitations";
import { listerMotifsReport } from "@/features/projets/adaptateur";
import { CLE_LISTE_PROJETS, CLE_MOTIFS_REPORT, cleProjet } from "@/features/projets/cles";
import { projetModifiable } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import { JUSTIFICATION_MIN } from "@/features/projets/validations";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterDate, formaterPourcentage } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  ajouterDependanceElement,
  lireDependancesElement,
  reprogrammerTacheGantt,
  successeursADecalerRequis,
  supprimerDependance,
  type SuccesseurADecaler,
} from "../adaptateur";
import { cleDependancesElement, clePlanningGantt } from "../cles";
import {
  candidatsPredecesseurs,
  datesEffectivesCase,
  estCaseEnRetard,
  estCaseJalon,
} from "../regles";
import type { CasePlanning } from "../types";

export interface PropsPanneauEditionTacheGantt {
  projet: Projet;
  cible: CasePlanning | null;
  toutesFeuilles: readonly CasePlanning[];
  onFermer: () => void;
}

function messageErreurApi(erreur: unknown, repli: string): string {
  if (erreur instanceof ErreurApi) {
    const parChamp = Object.values(erreur.erreursParChamp);
    if (erreur.code === "validation" && parChamp.length > 0) return parChamp.join(" ");
    return erreur.message || repli;
  }
  return repli;
}

function tonStatutCase(statut: string, enRetard: boolean): VarianteBadge {
  if (enRetard || statut === "EN_RETARD") return "erreur";
  if (statut === "TERMINE" || statut === "CLOTURE") return "succes";
  if (statut === "EN_COURS") return "information";
  if (statut === "SUSPENDU" || statut === "BLOQUE") return "avertissement";
  return "neutre";
}

/**
 * Tiroir latéral d'édition d'une tâche depuis le diagramme de Gantt :
 * - Planification initiale (`POST /elements/{id}/planifier/`) ou reprogrammation RG-11
 *   (`POST /elements/{id}/reprogrammer/`) avec gestion des prolongations parentes et du
 *   décalage des successeurs ;
 * - Gestion des prédécesseurs Fin → Début (`GET/POST /elements/{id}/dependances/`,
 *   `DELETE /dependances/{id}/`).
 */
export function PanneauEditionTacheGantt({
  projet,
  cible,
  toutesFeuilles,
  onFermer,
}: PropsPanneauEditionTacheGantt) {
  return (
    <Sheet open={cible !== null} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {cible && (
          <ContenuPanneauTache
            key={cible.id}
            projet={projet}
            cible={cible}
            toutesFeuilles={toutesFeuilles}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ContenuPanneauTache({
  projet,
  cible,
  toutesFeuilles,
}: {
  projet: Projet;
  cible: CasePlanning;
  toutesFeuilles: readonly CasePlanning[];
}) {
  const t = useTranslations("planning");
  const clientRequetes = useQueryClient();
  const { peutSurProjet } = useDroits();

  const peutPlanifier =
    cible.acces === "COMPLET" &&
    projetModifiable(projet) &&
    peutSurProjet(PERMISSIONS.PLANIFIER, projet);

  const dates = datesEffectivesCase(cible);
  const estDejaPlanifiee = Boolean(cible.debutPrevu && cible.finPrevue);
  const estJalon = estCaseJalon(cible);
  const enRetard = estCaseEnRetard(cible);

  // État du formulaire dates (planification ou reprogrammation)
  const [dateDebut, setDateDebut] = useState(cible.debutPrevu ?? dates.debut ?? "");
  const [dateFin, setDateFin] = useState(cible.finPrevue ?? dates.fin ?? "");
  const [motifId, setMotifId] = useState("");
  const [justification, setJustification] = useState("");
  const [prolongations, setProlongations] = useState<Prolongation[] | null>(null);
  const [successeursDecalage, setSuccesseursDecalage] = useState<SuccesseurADecaler[] | null>(null);
  const [successeursConfirmes, setSuccesseursConfirmes] = useState<Set<string>>(() => new Set());
  const [erreurDates, setErreurDates] = useState<string | null>(null);

  // État du bloc dépendances
  const [predecesseurChoisi, setPredecesseurChoisi] = useState("");
  const [erreurDependance, setErreurDependance] = useState<string | null>(null);

  const besoinMotifs = estDejaPlanifiee || prolongations !== null;
  const requeteMotifs = useQuery({
    queryKey: CLE_MOTIFS_REPORT,
    queryFn: ({ signal }) => listerMotifsReport(signal),
    enabled: peutPlanifier && besoinMotifs,
  });

  const requeteDependances = useQuery({
    queryKey: cleDependancesElement(cible.id),
    queryFn: ({ signal }) => lireDependancesElement(cible.id, signal),
    enabled: cible.estFeuille && cible.acces === "COMPLET",
  });

  const invaliderCaches = async () => {
    await Promise.all([
      clientRequetes.invalidateQueries({ queryKey: clePlanningGantt(projet.id) }),
      clientRequetes.invalidateQueries({ queryKey: cleDecoupage(projet.id) }),
      clientRequetes.invalidateQueries({ queryKey: cleProjet(projet.id) }),
      clientRequetes.invalidateQueries({ queryKey: cleDependancesElement(cible.id) }),
      clientRequetes.invalidateQueries({ queryKey: CLE_LISTE_PROJETS }),
    ]);
  };

  const mutationPlanifier = useMutation({
    mutationFn: (prolonger: boolean) =>
      planifierCase(cible.id, {
        dateDebutPrevue: dateDebut || null,
        dateFinPrevue: dateFin || null,
        prolonger,
        motifId: prolonger ? motifId : null,
        justification: prolonger ? justification.trim() : undefined,
      }),
    onSuccess: async () => {
      toast.success(t("tiroir.planificationSucces", { libelle: cible.libelle }));
      setProlongations(null);
      setErreurDates(null);
      await invaliderCaches();
    },
    onError: (erreur) => {
      const aProlonger = prolongationsRequises(erreur);
      if (aProlonger) {
        setProlongations(aProlonger);
        setErreurDates(null);
        return;
      }
      setErreurDates(messageErreurApi(erreur, t("tiroir.erreurDates")));
    },
  });

  const mutationReprogrammer = useMutation({
    mutationFn: () =>
      reprogrammerTacheGantt(cible.id, {
        dateDebutPrevue: dateDebut || null,
        dateFinPrevue: dateFin,
        motifId,
        justification: justification.trim(),
        prolonger: prolongations !== null,
        decalerSuccesseurs:
          successeursDecalage !== null ? Array.from(successeursConfirmes) : undefined,
      }),
    onSuccess: async (resultat) => {
      toast.success(t("tiroir.reprogrammationSucces", { libelle: cible.libelle }));
      if (resultat.alerteDg) {
        toast.info(t("tiroir.alerteDg"));
      }
      setProlongations(null);
      setSuccesseursDecalage(null);
      setSuccesseursConfirmes(new Set());
      setMotifId("");
      setJustification("");
      setErreurDates(null);
      await invaliderCaches();
    },
    onError: (erreur) => {
      const aProlonger = prolongationsRequises(erreur);
      if (aProlonger) {
        setProlongations(aProlonger);
        setErreurDates(null);
        return;
      }
      const aDecaler = successeursADecalerRequis(erreur);
      if (aDecaler) {
        setSuccesseursDecalage(aDecaler);
        setSuccesseursConfirmes(new Set(aDecaler.map((s) => s.id)));
        setErreurDates(null);
        return;
      }
      setErreurDates(messageErreurApi(erreur, t("tiroir.erreurDates")));
    },
  });

  const mutationAjouterDependance = useMutation({
    mutationFn: (predecesseurId: string) => ajouterDependanceElement(cible.id, predecesseurId),
    onSuccess: async () => {
      toast.success(t("tiroir.dependanceAjoutee"));
      setPredecesseurChoisi("");
      setErreurDependance(null);
      await invaliderCaches();
    },
    onError: (erreur) => {
      setErreurDependance(messageErreurApi(erreur, t("tiroir.erreurDependance")));
    },
  });

  const mutationSupprimerDependance = useMutation({
    mutationFn: (dependanceId: string) => supprimerDependance(dependanceId),
    onSuccess: async () => {
      toast.success(t("tiroir.dependanceSupprimee"));
      setErreurDependance(null);
      await invaliderCaches();
    },
    onError: (erreur) => {
      setErreurDependance(messageErreurApi(erreur, t("tiroir.erreurDependance")));
    },
  });

  const predecesseurs = useMemo(
    () => requeteDependances.data?.predecesseurs ?? [],
    [requeteDependances.data],
  );
  const successeurs = useMemo(
    () => requeteDependances.data?.successeurs ?? [],
    [requeteDependances.data],
  );

  const candidats = useMemo(() => {
    const dejaLies = new Set(predecesseurs.map((p) => p.id));
    return candidatsPredecesseurs(toutesFeuilles, cible.id, dejaLies);
  }, [toutesFeuilles, cible.id, predecesseurs]);

  const longueurJustification = justification.trim().length;
  const enCoursDates = mutationPlanifier.isPending || mutationReprogrammer.isPending;

  function soumettreDates() {
    setErreurDates(null);
    if (!dateDebut && !dateFin) {
      setErreurDates(t("tiroir.erreurDatesRequises"));
      return;
    }
    if (dateDebut && dateFin && dateFin < dateDebut) {
      setErreurDates(t("tiroir.erreurOrdreDates"));
      return;
    }

    if (!estDejaPlanifiee) {
      const prolonger = prolongations !== null;
      if (prolonger) {
        if (!motifId) {
          setErreurDates(t("tiroir.erreurMotifRequis"));
          return;
        }
        if (longueurJustification < JUSTIFICATION_MIN) {
          setErreurDates(t("tiroir.erreurJustificationCourte", { min: JUSTIFICATION_MIN }));
          return;
        }
      }
      mutationPlanifier.mutate(prolonger);
      return;
    }

    // Reprogrammation RG-11
    if (!dateFin) {
      setErreurDates(t("tiroir.erreurDateFinRequise"));
      return;
    }
    if (!motifId) {
      setErreurDates(t("tiroir.erreurMotifRequis"));
      return;
    }
    if (longueurJustification < JUSTIFICATION_MIN) {
      setErreurDates(t("tiroir.erreurJustificationCourte", { min: JUSTIFICATION_MIN }));
      return;
    }
    mutationReprogrammer.mutate();
  }

  function basculerSuccesseur(id: string, coche: boolean) {
    setSuccesseursConfirmes((precedent) => {
      const suivant = new Set(precedent);
      if (coche) suivant.add(id);
      else suivant.delete(id);
      return suivant;
    });
  }

  return (
    <>
      <SheetHeader className="border-0 border-b border-solid border-neutral-200 py-5 pr-14 pl-6">
        <SheetTitle className="flex flex-wrap items-center gap-2 text-lg text-neutral-900">
          {cible.numero && <span className="font-mono text-sm text-neutral-500">{cible.numero}</span>}
          <span>{cible.libelle}</span>
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          {cible.niveau && <Badge variante="neutre">{cible.niveau}</Badge>}
          {estJalon && (
            <Badge
              variante="avertissement"
              icone={<Diamond className="size-3" aria-hidden="true" />}
            >
              {t("tiroir.badgeJalon")}
            </Badge>
          )}
          <Badge variante={tonStatutCase(cible.statut, enRetard)}>
            {t.has(`statuts.${cible.statut}`) ? t(`statuts.${cible.statut}`) : cible.statut}
          </Badge>
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 px-6 py-5">
        {/* Synthèse rapide */}
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-solid border-neutral-200 bg-neutral-50 p-3 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-neutral-500">{t("tiroir.avancementPhysique")}</span>
            <span className="text-sm font-semibold text-neutral-900 tabular-nums">
              {formaterPourcentage(cible.avancement)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-neutral-500">{t("tiroir.avancementTemporel")}</span>
            <span className="text-sm font-semibold text-neutral-900 tabular-nums">
              {formaterPourcentage(cible.avancementTemporel)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-neutral-500">{t("tiroir.baseline")}</span>
            <span className="font-medium text-neutral-700 tabular-nums">
              {cible.debutBaseline && cible.finBaseline
                ? t("infobulle.intervalle", {
                    debut: formaterDate(cible.debutBaseline),
                    fin: formaterDate(cible.finBaseline),
                  })
                : ABSENT}
            </span>
          </div>
        </div>

        {!peutPlanifier && (
          <Alert variant="information">
            <CircleAlert className="size-4" aria-hidden="true" />
            <AlertDescription>{t("tiroir.lectureSeuleInfo")}</AlertDescription>
          </Alert>
        )}

        {/* Section 1 : Planification / Reprogrammation des dates */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            {estDejaPlanifiee ? (
              <CalendarClock className="size-4 text-primary-600" aria-hidden="true" />
            ) : (
              <Calendar className="size-4 text-primary-600" aria-hidden="true" />
            )}
            <h3 className="text-sm font-semibold text-neutral-900">
              {estDejaPlanifiee ? t("tiroir.sectionReprogrammer") : t("tiroir.sectionPlanifier")}
            </h3>
          </div>

          <form
            className="flex flex-col gap-3.5"
            noValidate
            onSubmit={(evenement) => {
              evenement.preventDefault();
              soumettreDates();
            }}
          >
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-700">
                  {t("tiroir.dateDebut")}
                </label>
                <SelecteurDate
                  valeur={dateDebut}
                  onChange={(valeur) => {
                    setDateDebut(valeur);
                    setProlongations(null);
                    setSuccesseursDecalage(null);
                  }}
                  auPlusTard={dateFin || undefined}
                  placeholder={t("tiroir.choisirDate")}
                  disabled={!peutPlanifier || enCoursDates}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-700">
                  {t("tiroir.dateFin")}
                </label>
                <SelecteurDate
                  valeur={dateFin}
                  onChange={(valeur) => {
                    setDateFin(valeur);
                    setProlongations(null);
                    setSuccesseursDecalage(null);
                  }}
                  auPlusTot={dateDebut || undefined}
                  placeholder={t("tiroir.choisirDate")}
                  disabled={!peutPlanifier || enCoursDates}
                />
              </div>
            </div>

            {/* Alerte prolongations parentes */}
            {prolongations && (
              <Alert variant="avertissement">
                <AlertTriangle className="size-4" aria-hidden="true" />
                <AlertDescription>
                  <p className="m-0 font-medium">{t("tiroir.prolongationRequise")}</p>
                  <ul className="m-0 mt-1.5 list-disc pl-4 text-xs">
                    {prolongations.map((item) => (
                      <li key={`${item.type}-${item.id}`}>
                        {t("tiroir.ligneProlongation", {
                          libelle: item.libelle,
                          debutAvant: formaterDate(item.dateDebutAvant),
                          finAvant: formaterDate(item.dateFinAvant),
                          debutApres: formaterDate(item.dateDebutApres),
                          finApres: formaterDate(item.dateFinApres),
                        })}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Alerte décalage des successeurs FS */}
            {successeursDecalage && (
              <Alert variant="avertissement">
                <AlertTriangle className="size-4" aria-hidden="true" />
                <AlertDescription className="w-full">
                  <p className="m-0 font-medium">{t("tiroir.decalageRequis")}</p>
                  <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-xs">
                    {successeursDecalage.map((succ) => (
                      <li key={succ.id} className="flex items-start gap-2">
                        <Checkbox
                          checked={successeursConfirmes.has(succ.id)}
                          onCheckedChange={(v) => basculerSuccesseur(succ.id, v === true)}
                        />
                        <span className="leading-snug">
                          <span className="font-medium text-neutral-900">{succ.libelle}</span>{" "}
                          {t("tiroir.ligneDecalage", {
                            debutAvant: formaterDate(succ.dateDebutAvant),
                            debutApres: formaterDate(succ.dateDebutApres),
                            jours: succ.jours,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Champs RG-11 (reprogrammation ou confirmation de prolongation) */}
            {peutPlanifier && besoinMotifs && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-neutral-700">
                    {t("tiroir.motifReport")}
                  </label>
                  <Select
                    value={motifId || undefined}
                    onValueChange={setMotifId}
                    disabled={enCoursDates || requeteMotifs.isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("tiroir.motifPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(requeteMotifs.data ?? []).map((motif) => (
                        <SelectItem key={motif.id} value={motif.id}>
                          {motif.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-neutral-700">
                      {t("tiroir.justification")}
                    </label>
                    <span
                      className={cn(
                        "tabular-nums",
                        longueurJustification >= JUSTIFICATION_MIN
                          ? "text-neutral-500"
                          : "font-medium text-avertissement",
                      )}
                    >
                      {t("tiroir.compteurJustification", {
                        actuel: longueurJustification,
                        min: JUSTIFICATION_MIN,
                      })}
                    </span>
                  </div>
                  <Textarea
                    value={justification}
                    onChange={(evenement) => setJustification(evenement.target.value)}
                    rows={3}
                    placeholder={t("tiroir.justificationPlaceholder")}
                    disabled={enCoursDates}
                  />
                </div>
              </>
            )}

            {erreurDates && (
              <Alert variant="erreur">
                <CircleAlert className="size-4" aria-hidden="true" />
                <AlertDescription>{erreurDates}</AlertDescription>
              </Alert>
            )}

            {peutPlanifier && (
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={enCoursDates} aria-busy={enCoursDates}>
                  {enCoursDates && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                  {prolongations || successeursDecalage
                    ? t("tiroir.confirmerReport")
                    : estDejaPlanifiee
                      ? t("tiroir.actionReprogrammer")
                      : t("tiroir.actionPlanifier")}
                </Button>
              </div>
            )}
          </form>
        </section>

        <Separator />

        {/* Section 2 : Dépendances Fin → Début */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-primary-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-neutral-900">
              {t("tiroir.sectionDependances")}
            </h3>
          </div>

          {!cible.estFeuille ? (
            <p className="m-0 text-xs text-neutral-500">{t("tiroir.dependancesParentInfo")}</p>
          ) : requeteDependances.isPending ? (
            <div className="flex items-center gap-2 py-2 text-xs text-neutral-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              <span>{t("tiroir.chargementDependances")}</span>
            </div>
          ) : (
            <>
              {/* Liste des prédécesseurs */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-neutral-600">
                  {t("tiroir.predecesseursTitre")}
                </span>

                {predecesseurs.length === 0 ? (
                  <p className="m-0 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
                    {t("tiroir.aucunPredecesseur")}
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {predecesseurs.map((lien) => (
                      <li
                        key={lien.lienId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-solid border-neutral-200 bg-neutral-0 px-3 py-2 text-xs"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate font-medium text-neutral-900">
                            {lien.visible && lien.libelle
                              ? lien.libelle
                              : t("tiroir.tacheHorsPerimetre")}
                          </span>
                          <span className="text-neutral-500 tabular-nums">
                            {t("tiroir.finPredecesseur", {
                              date: formaterDate(lien.dateFinPrevue),
                            })}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {lien.respectee === true && (
                            <Badge
                              variante="succes"
                              icone={<CheckCircle2 className="size-3" aria-hidden="true" />}
                            >
                              {t("tiroir.lienRespecte")}
                            </Badge>
                          )}
                          {lien.respectee === false && (
                            <Badge
                              variante="erreur"
                              icone={<AlertTriangle className="size-3" aria-hidden="true" />}
                            >
                              {t("tiroir.lienNonRespecte")}
                            </Badge>
                          )}
                          {peutPlanifier && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => mutationSupprimerDependance.mutate(lien.lienId)}
                              disabled={mutationSupprimerDependance.isPending}
                              aria-label={t("tiroir.supprimerDependance")}
                              className="text-neutral-500 hover:bg-erreur-fond hover:text-erreur"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Ajout d'un prédécesseur FS */}
              {peutPlanifier && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-neutral-700">
                    {t("tiroir.ajouterPredecesseur")}
                  </label>
                  <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
                    <Select
                      value={predecesseurChoisi || undefined}
                      onValueChange={setPredecesseurChoisi}
                      disabled={mutationAjouterDependance.isPending || candidats.length === 0}
                    >
                      <SelectTrigger className="min-w-0 flex-1">
                        <SelectValue
                          placeholder={
                            candidats.length > 0
                              ? t("tiroir.choisirPredecesseur")
                              : t("tiroir.aucunCandidat")
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {candidats.map((candidat) => (
                          <SelectItem key={candidat.id} value={candidat.id}>
                            {candidat.numero ? `${candidat.numero} ` : ""}
                            {candidat.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!predecesseurChoisi || mutationAjouterDependance.isPending}
                      onClick={() =>
                        predecesseurChoisi && mutationAjouterDependance.mutate(predecesseurChoisi)
                      }
                      className="shrink-0"
                    >
                      {mutationAjouterDependance.isPending ? (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Plus className="size-4" aria-hidden="true" />
                      )}
                      <span>{t("tiroir.actionAjouterLien")}</span>
                    </Button>
                  </div>
                </div>
              )}

              {erreurDependance && (
                <Alert variant="erreur">
                  <CircleAlert className="size-4" aria-hidden="true" />
                  <AlertDescription>{erreurDependance}</AlertDescription>
                </Alert>
              )}

              {/* Liste informative des successeurs */}
              {successeurs.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-xs font-medium text-neutral-600">
                    {t("tiroir.successeursTitre")}
                  </span>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {successeurs.map((lien) => (
                      <li
                        key={lien.lienId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-solid border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-700"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <ArrowRight className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                          <span className="truncate font-medium">
                            {lien.visible && lien.libelle
                              ? lien.libelle
                              : t("tiroir.tacheHorsPerimetre")}
                          </span>
                        </span>
                        <span className="shrink-0 text-neutral-500 tabular-nums">
                          {formaterDate(lien.dateDebutPrevue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CircleAlert, CloudOff, CloudUpload, LoaderCircle, NotebookPen, Save, Send, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  activitesSuivies,
  alertesImmediates,
  cleAlerte,
  INTERVALLE_SAUVEGARDE_MS,
  resumeSaisie,
  sectionsActives,
} from "@/features/chantier";
import type { LotJournal, PreparationSaisie, ResumeSaisie } from "@/features/chantier";
import { enregistrerBrouillon, envoyerAlerte, soumettreRapport } from "@/features/chantier/adaptateur";
import { effacerCopieLocale, ecrireCopieLocale, lireCopieLocale } from "@/features/chantier/brouillonLocal";
import { CLE_JOURNAL, cleRapportsProjet } from "@/features/chantier/cles";
import { schemaRapport, valeursDepuis, versSaisie, type ValeursRapport } from "@/features/chantier/validations";
import type { MeteoProjet, ModeExecutionLot } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";
import { useDefile, useResteEnBas } from "@/hooks/use-defilement";
import { cn } from "@/lib/utils";

import { ModaleSoumission } from "./ModaleSoumission";
import { CarteSection, Signal } from "./elementsSaisie";
import { SectionContexte, SectionNote, SectionPrevisions } from "./SectionsContexte";
import {
  SectionBlocage,
  SectionEvenements,
  SectionPhotos,
  SectionPiecesJointes,
  type EtatAlerte,
} from "./SectionsEvenements";
import { SectionBesoins, SectionEquipements, SectionLivraisons, SectionMateriaux } from "./SectionsRessources";
import { SectionAvancement, SectionEffectifs, SectionPresenceSousTraitant, SectionProduction } from "./SectionsTerrain";

/**
 * Les étapes de l'écran : les six rubriques du cahier « Journal de chantier
 * intelligent » §2, dans son ordre, entre la journée (horaires, arrêt, météo)
 * et la synthèse du chef de chantier. Toutes les rubriques s'affichent, quel
 * que soit le chantier : ce que les modes de ses lots ne suivent pas y est dit,
 * pas escamoté.
 */
type CleSection = "journee" | "travaux" | "rh" | "materiels" | "materiaux" | "evenements" | "photos" | "synthese";

const ORDRE_SECTIONS: CleSection[] = [
  "journee",
  "travaux",
  "rh",
  "materiels",
  "materiaux",
  "evenements",
  "photos",
  "synthese",
];

const ORDRE_JOURNEE_ARRET: CleSection[] = ["journee"];

/** Les étapes numérotées : les rubriques du cahier, et elles seules. */
const RUBRIQUES: CleSection[] = ["travaux", "rh", "materiels", "materiaux", "evenements", "photos"];

/** Les champs du formulaire que porte chaque étape — pour pointer une erreur. */
const CHAMPS_DE_SECTION: Record<CleSection, (keyof ValeursRapport)[]> = {
  journee: ["date", "heureDebut", "heureFin", "arret", "motifArret", "precisionArret", "meteo"],
  travaux: ["lotsTravailles", "activites", "production"],
  rh: ["effectifs", "presenceSousTraitant"],
  materiels: ["equipements"],
  materiaux: ["livraisons", "materiaux", "besoins"],
  evenements: ["incidents", "blocage"],
  photos: ["photos", "piecesJointes"],
  synthese: ["note", "previsions"],
};

function sectionsEnErreur(erreurs: FieldErrors<ValeursRapport>): Set<CleSection> {
  const enErreur = new Set<CleSection>();
  for (const [section, champs] of Object.entries(CHAMPS_DE_SECTION) as [CleSection, (keyof ValeursRapport)[]][]) {
    if (champs.some((champ) => erreurs[champ])) enErreur.add(section);
  }
  return enErreur;
}

/* ------------------------------------------------------------------ *
 * L'état du réseau — le chantier en région le perd souvent.
 * ------------------------------------------------------------------ */

function abonnementReseau(rappel: () => void) {
  window.addEventListener("online", rappel);
  window.addEventListener("offline", rappel);
  return () => {
    window.removeEventListener("online", rappel);
    window.removeEventListener("offline", rappel);
  };
}

function useEnLigne(): boolean {
  return useSyncExternalStore(
    abonnementReseau,
    () => navigator.onLine,
    () => true,
  );
}

type EtatSauvegarde =
  | { type: "AJOUR"; le: string | null }
  | { type: "MODIFIE" }
  | { type: "EN_COURS" }
  | { type: "ECHEC" };

/** Les codes des lots d'un mode, pour dire à quels lots une section s'applique. */
function lotsDuMode(lots: LotJournal[], mode: ModeExecutionLot): string {
  return lots
    .filter((lot) => lot.modeExecution === mode)
    .map((lot) => lot.code)
    .join(" · ");
}

/**
 * Le formulaire du rapport journalier d'un chantier pour un jour — tous ses
 * lots en cours réunis.
 *
 * Trois filets, du plus proche au plus lointain :
 * 1. chaque frappe est recopiée sur le téléphone (`brouillonLocal`) — une
 *    coupure ou un onglet fermé ne coûtent rien ;
 * 2. toutes les 30 secondes, le brouillon part au serveur s'il a changé
 *    (SFD §6.1), silencieusement ;
 * 3. la soumission exige tout ce que les sections du chantier rendent
 *    obligatoire, puis passe par une confirmation avec résumé (SFD §6.2).
 *
 * Un blocage bloquant ou un incident grave **n'attendent pas la soumission** :
 * l'alerte part au CT et au CP dès qu'on les choisit (RG-F2-11).
 */
export function FormulaireRapport({
  preparation,
  date,
  releve,
  entete,
  titre,
}: {
  preparation: PreparationSaisie;
  date: string;
  releve: MeteoProjet | null;
  /** L'en-tête de l'écran (chantier, jour) — il reste au-dessus du formulaire. */
  entete: React.ReactNode;
  /** Le chantier et le jour : collés en haut avec les étapes sur grand écran. */
  titre: React.ReactNode;
}) {
  const t = useTranslations("journal.saisie");
  const format = useFormatter();
  const router = useRouter();
  const cache = useQueryClient();
  const enLigne = useEnLigne();
  const { projet } = preparation;

  /*
   * Le point de départ : le brouillon du serveur, sauf si le téléphone en
   * garde une copie plus récente — saisie hors ligne, ou fermée avant les
   * 30 secondes. Lu une fois : la clé de l'écran remonte le formulaire à
   * chaque changement de chantier ou de jour.
   */
  const [depart] = useState(() => {
    const serveur = valeursDepuis(preparation, date);
    const copie = lireCopieLocale(projet.id, date);
    const plusRecente = copie && (!preparation.rapport || copie.modifieLe > preparation.rapport.enregistreLe);
    // Une copie gardée avant l'arrivée d'un champ ne le porte pas : le serveur le complète.
    return { valeurs: plusRecente ? { ...serveur, ...copie.valeurs } : serveur, restauree: !!plusRecente };
  });

  const schema = useMemo(() => schemaRapport(preparation), [preparation]);
  const formulaire = useForm<ValeursRapport>({
    resolver: zodResolver(schema),
    defaultValues: depart.valeurs,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { control, getValues, formState, subscribe } = formulaire;

  const rapportId = useRef<string | null>(preparation.rapport?.id ?? null);
  const modifie = useRef(depart.restauree);
  const [sauvegarde, setSauvegarde] = useState<EtatSauvegarde>(
    depart.restauree ? { type: "MODIFIE" } : { type: "AJOUR", le: preparation.rapport?.enregistreLe ?? null },
  );

  /* -------- La copie locale, à chaque frappe (avec un léger amorti). -------- */
  useEffect(() => {
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const desabonner = subscribe({
      formState: { values: true },
      callback: () => {
        modifie.current = true;
        setSauvegarde((etat) => (etat.type === "EN_COURS" ? etat : { type: "MODIFIE" }));
        clearTimeout(minuterie);
        minuterie = setTimeout(() => ecrireCopieLocale(projet.id, date, getValues()), 600);
      },
    });
    return () => {
      clearTimeout(minuterie);
      desabonner();
    };
  }, [subscribe, getValues, projet.id, date]);

  /* -------- L'enregistrement du brouillon. -------- */
  const enregistrement = useMutation({
    mutationFn: () => enregistrerBrouillon(rapportId.current, versSaisie(getValues(), preparation)),
    onMutate: () => {
      modifie.current = false;
      setSauvegarde({ type: "EN_COURS" });
    },
    onSuccess: (rapport) => {
      rapportId.current = rapport.id;
      setSauvegarde(modifie.current ? { type: "MODIFIE" } : { type: "AJOUR", le: rapport.enregistreLe });
      void cache.invalidateQueries({ queryKey: cleRapportsProjet(projet.id) });
    },
    onError: () => {
      modifie.current = true;
      setSauvegarde({ type: "ECHEC" });
    },
  });
  const { mutateAsync: enregistrerAsync, isPending: enregistrementEnCours } = enregistrement;

  const enregistrerManuellement = async () => {
    if (!enLigne) {
      ecrireCopieLocale(projet.id, date, getValues());
      toast.info(t("horsLigneConserve"));
      return;
    }
    try {
      await enregistrerAsync();
      toast.success(t("brouillonEnregistre"));
    } catch (err) {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurGenerique"));
    }
  };

  // Le rythme de 30 secondes : rien ne part si rien n'a changé, ni hors ligne.
  useEffect(() => {
    const minuterie = setInterval(() => {
      if (!modifie.current || enregistrementEnCours || !navigator.onLine) return;
      enregistrerAsync().catch(() => undefined);
    }, INTERVALLE_SAUVEGARDE_MS);
    return () => clearInterval(minuterie);
  }, [enregistrerAsync, enregistrementEnCours]);

  /* -------- Les alertes immédiates (RG-F2-11). -------- */
  const [alertes, setAlertes] = useState<Record<string, EtatAlerte>>(() =>
    Object.fromEntries((preparation.rapport?.alertesEnvoyees ?? []).map((cle) => [cle, "ENVOYEE" as const])),
  );
  // Le miroir de `alertes` que lisent les envois en cours, sans attendre un rendu.
  const etatsAlertes = useRef(alertes);
  const noterAlertes = useCallback((etats: Record<string, EtatAlerte>) => {
    etatsAlertes.current = { ...etatsAlertes.current, ...etats };
    setAlertes(etatsAlertes.current);
  }, []);

  /**
   * Envoie les alertes que la saisie appelle et qui ne sont pas encore
   * parties. Appelé à chaque modification et au retour du réseau — jamais
   * depuis le rendu : une alerte est un geste, pas un état.
   */
  const declencherAlertes = useCallback(async () => {
    if (!navigator.onLine) return;
    const aEnvoyer = alertesImmediates(versSaisie(getValues(), preparation)).filter((alerte) => {
      const etat = etatsAlertes.current[cleAlerte(alerte)];
      return etat !== "ENVOYEE" && etat !== "EN_COURS";
    });
    if (aEnvoyer.length === 0) return;
    noterAlertes(Object.fromEntries(aEnvoyer.map((alerte) => [cleAlerte(alerte), "EN_COURS" as const])));
    for (const alerte of aEnvoyer) {
      try {
        // L'alerte se rattache au rapport : il faut qu'il existe côté serveur.
        if (!rapportId.current) await enregistrerAsync();
        const id = rapportId.current;
        if (!id) throw new Error("rapport_absent");
        await envoyerAlerte(id, alerte);
        noterAlertes({ [cleAlerte(alerte)]: "ENVOYEE" });
        toast.warning(alerte.type === "BLOCAGE_BLOQUANT" ? t("alertes.blocageEnvoye") : t("alertes.incidentEnvoye"));
      } catch {
        noterAlertes({ [cleAlerte(alerte)]: "ECHEC" });
        toast.error(t("alertes.echecEnvoi"));
      }
    }
  }, [enregistrerAsync, getValues, preparation, noterAlertes, t]);

  const declencheur = useRef(declencherAlertes);
  useEffect(() => {
    declencheur.current = declencherAlertes;
  }, [declencherAlertes]);

  useEffect(() => {
    const desabonner = subscribe({
      name: ["blocage.niveau", "incidents"],
      formState: { values: true },
      callback: () => void declencheur.current(),
    });
    const auRetourDuReseau = () => void declencheur.current();
    window.addEventListener("online", auRetourDuReseau);
    return () => {
      desabonner();
      window.removeEventListener("online", auRetourDuReseau);
    };
  }, [subscribe]);

  /* -------- La soumission. -------- */
  const [resume, setResume] = useState<ResumeSaisie | null>(null);
  const soumission = useMutation({
    mutationFn: () => soumettreRapport(rapportId.current, versSaisie(getValues(), preparation)),
    onSuccess: ({ id, reference }) => {
      effacerCopieLocale(projet.id, date);
      modifie.current = false;
      void cache.invalidateQueries({ queryKey: CLE_JOURNAL });
      void cache.invalidateQueries({ queryKey: cleRapportsProjet(projet.id) });
      toast.success(t("soumission.succes", { reference }));
      router.push(`/rapports/${id}`);
    },
    onError: (err) => {
      setResume(null);
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurGenerique"));
    },
  });

  const demanderSoumission = formulaire.handleSubmit(
    (valeurs) => setResume(resumeSaisie(versSaisie(valeurs, preparation), preparation)),
    (erreurs) => {
      const premiere = ORDRE_SECTIONS.find((section) => sectionsEnErreur(erreurs).has(section));
      toast.error(t("aCorriger", { n: sectionsEnErreur(erreurs).size }));
      if (premiere) document.getElementById(`section-${premiere}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  );

  /* -------- Les blocs à afficher dans chaque rubrique. -------- */
  const arret = useWatch({ control, name: "arret" });
  const sections = sectionsActives(preparation.sections, arret);
  // Une journée d'arrêt se réduit à la journée : les autres étapes disparaissent.
  const ordre = arret ? ORDRE_JOURNEE_ARRET : ORDRE_SECTIONS;
  const numero = (cle: CleSection) => (RUBRIQUES.includes(cle) ? RUBRIQUES.indexOf(cle) + 1 : undefined);
  const rubrique = (cle: Exclude<CleSection, "journee">) => ({
    id: `section-${cle}`,
    numero: numero(cle),
    titre: t(`rubriques.${cle}`),
    description: t(`contenuRubriques.${cle}`),
  });
  const enErreur = sectionsEnErreur(formState.errors);
  const activitesAvancement = activitesSuivies(preparation, "AVANCEMENT");
  const activitesProduction = activitesSuivies(preparation, "PRODUCTION");

  const active = useSectionVisible(ordre);
  const defile = useDefile();
  const resteEnBas = useResteEnBas();

  const allerA = useCallback((cle: CleSection) => {
    document.getElementById(`section-${cle}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <Form {...formulaire}>
      <form
        noValidate
        onSubmit={(evenement) => {
          evenement.preventDefault();
          void demanderSoumission();
        }}
        className="flex flex-col gap-4"
      >
        {entete}

        {/*
          Sur grand écran, le chantier et les étapes restent collés ensemble
          sous la barre de l'application ; sur téléphone, seules les étapes
          le restent — l'écran est trop court pour les deux. `contents` : sans boîte
          propre, le conteneur laisse les étapes coller au formulaire entier.
        */}
        <div
          data-barre-collante
          className={cn(
            "contents lg:sticky lg:flex lg:flex-col lg:gap-3 lg:top-16 lg:z-30 lg:-mx-6 lg:border-b lg:border-neutral-200 lg:bg-background/95 lg:px-6 lg:pt-3 lg:backdrop-blur lg:transition-shadow",
            defile && "lg:shadow-collant",
          )}
        >
          {titre}
          <nav
            aria-label={t("navigation")}
            className={cn(
              "sticky top-16 z-30 -mx-2 overflow-x-auto border-b border-neutral-200 bg-background/95 px-2 py-1.5 backdrop-blur transition-shadow [scrollbar-width:thin] [scrollbar-color:var(--color-neutral-200)_transparent] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:shadow-none lg:backdrop-blur-none",
              defile && "shadow-collant",
            )}
          >
            <ol className="m-0 flex w-max list-none gap-1.5 p-0">
              {ordre.map((cle) => {
                const courante = cle === active;
                return (
                  <li key={cle} data-etape={cle}>
                    <button
                      type="button"
                      onClick={() => allerA(cle)}
                      aria-current={courante ? "step" : undefined}
                      className={cn(
                        "flex min-h-7 cursor-pointer items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1 text-xs font-normal whitespace-nowrap transition-colors",
                        enErreur.has(cle)
                          ? "border-erreur bg-erreur-fond text-erreur"
                          : courante
                            ? "border-primary-300 bg-primary-50 text-primary-800"
                            : "border-neutral-200 bg-card text-neutral-600 hover:border-primary-300",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full text-xs tabular-nums transition-colors",
                          courante ? "bg-primary-600 font-semibold text-white" : "bg-neutral-100 text-neutral-500",
                        )}
                      >
                        {numero(cle) ??
                          (cle === "journee" ? (
                            <CalendarDays className="size-3" aria-hidden="true" />
                          ) : (
                            <NotebookPen className="size-3" aria-hidden="true" />
                          ))}
                      </span>
                      {t(`navigationRubriques.${cle}`)}
                      {enErreur.has(cle) && <CircleAlert className="size-3.5" aria-label={t("sectionEnErreur")} />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        {preparation.rapport?.statut === "REJETE" && preparation.rapport.commentaireRejet && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-erreur bg-erreur-fond p-4 text-sm text-erreur">
            <Undo2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{t("rejet.titre")}</span>
              <span className="text-neutral-800">{preparation.rapport.commentaireRejet}</span>
            </div>
          </div>
        )}


        <SectionContexte releve={releve} />

        {!arret && (
          <>
            <CarteSection {...rubrique("travaux")}>
              {sections.includes("AVANCEMENT") && (
                <SectionAvancement activites={activitesAvancement} lots={preparation.lots} />
              )}
              {sections.includes("PRODUCTION") && (
                <SectionProduction
                  complement={lotsDuMode(preparation.lots, "SOUS_TRAITANCE_INFORMELLE")}
                  activites={activitesProduction}
                  lots={preparation.lots}
                />
              )}
            </CarteSection>

            <CarteSection {...rubrique("rh")}>
              {sections.includes("EFFECTIFS") && (
                <SectionEffectifs />
              )}
              {sections.includes("PRESENCE_SOUS_TRAITANT") && (
                <SectionPresenceSousTraitant />
              )}
              {!sections.includes("EFFECTIFS") && !sections.includes("PRESENCE_SOUS_TRAITANT") && (
                <Signal ton="information">{t("sansObjet.rh")}</Signal>
              )}
            </CarteSection>

            <CarteSection {...rubrique("materiels")}>
              {sections.includes("EQUIPEMENTS") ? (
                <SectionEquipements />
              ) : (
                <Signal ton="information">{t("sansObjet.materiels")}</Signal>
              )}
            </CarteSection>

            <CarteSection {...rubrique("materiaux")}>
              {sections.includes("LIVRAISONS") && <SectionLivraisons />}
              {sections.includes("MATERIAUX") && <SectionMateriaux materiaux={preparation.materiaux} />}
              <SectionBesoins />
            </CarteSection>

            <CarteSection {...rubrique("evenements")}>
              <SectionEvenements alertes={alertes} />
              <SectionBlocage alerte={alertes.BLOCAGE} />
            </CarteSection>

            <CarteSection {...rubrique("photos")}>
              <SectionPhotos />
              <SectionPiecesJointes />
            </CarteSection>

            <CarteSection {...rubrique("synthese")}>
              <SectionNote />
              <SectionPrevisions />
            </CarteSection>
          </>
        )}

        {/* La barre d'actions : collée en bas de l'écran, à portée de pouce. */}
        <div
          className={cn(
            "sticky bottom-0 z-30 -mx-2 border-t border-neutral-200 bg-card/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-shadow sm:-mx-6 sm:px-6",
            resteEnBas && "shadow-collant-haut",
          )}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <EtatEnregistrement etat={sauvegarde} enLigne={enLigne} format={format} />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void enregistrerManuellement()}
                disabled={enregistrementEnCours || soumission.isPending}
              >
                {enregistrementEnCours ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                {t("enregistrer")}
              </Button>
              <Button type="submit" size="lg" disabled={soumission.isPending || !enLigne}>
                <Send aria-hidden="true" />
                {t("soumettre")}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <ModaleSoumission
        resume={resume}
        chantier={projet.nom}
        jour={format.dateTime(new Date(`${date}T00:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
        ouverte={resume !== null}
        enCours={soumission.isPending}
        onFermer={() => setResume(null)}
        onConfirmer={() => soumission.mutate()}
      />
    </Form>
  );
}

/**
 * La section que le chef de chantier est en train de lire : la dernière dont
 * le haut a passé la barre des étapes. Suivie au défilement, elle allume son
 * numéro dans la barre — et la fait glisser à vue sur un téléphone.
 */
function useSectionVisible(ordre: CleSection[]): CleSection | null {
  const [active, setActive] = useState<CleSection | null>(ordre[0] ?? null);
  const cleOrdre = ordre.join("|");

  useEffect(() => {
    const cles = cleOrdre.split("|") as CleSection[];
    let image = 0;
    const mesurer = () => {
      cancelAnimationFrame(image);
      image = requestAnimationFrame(() => {
        // Sous l'en-tête et la barre des étapes, collés en haut.
        const repere = window.innerHeight * 0.3;
        let courante = cles[0] ?? null;
        for (const cle of cles) {
          const section = document.getElementById(`section-${cle}`);
          if (section && section.getBoundingClientRect().top <= repere) courante = cle;
        }
        // Au bas de la page, la dernière section n'atteint jamais le repère.
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) courante = cles.at(-1) ?? courante;
        setActive(courante);
      });
    };
    mesurer();
    window.addEventListener("scroll", mesurer, { passive: true });
    window.addEventListener("resize", mesurer);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener("scroll", mesurer);
      window.removeEventListener("resize", mesurer);
    };
  }, [cleOrdre]);

  useEffect(() => {
    if (!active) return;
    document
      .querySelector(`nav [data-etape="${active}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return active;
}

function EtatEnregistrement({
  etat,
  enLigne,
  format,
}: {
  etat: EtatSauvegarde;
  enLigne: boolean;
  format: ReturnType<typeof useFormatter>;
}) {
  const t = useTranslations("journal.saisie.etat");
  if (!enLigne) {
    return (
      <p className="m-0 flex items-center gap-2 text-sm font-medium text-avertissement">
        <CloudOff className="size-4 shrink-0" aria-hidden="true" />
        {t("horsLigne")}
      </p>
    );
  }
  const contenu = {
    AJOUR: { icone: <CloudUpload className="size-4 shrink-0 text-succes" aria-hidden="true" />, texte: "" },
    MODIFIE: { icone: <CloudUpload className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />, texte: t("modifie") },
    EN_COURS: { icone: <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />, texte: t("enCours") },
    ECHEC: { icone: <CircleAlert className="size-4 shrink-0 text-erreur" aria-hidden="true" />, texte: t("echec") },
  }[etat.type];
  const texte =
    etat.type === "AJOUR"
      ? etat.le
        ? t("ajour", { heure: format.dateTime(new Date(etat.le), { hour: "2-digit", minute: "2-digit" }) })
        : t("jamais")
      : contenu.texte;
  return (
    <p role="status" aria-live="polite" className="m-0 flex items-center gap-2 text-sm text-neutral-600">
      {contenu.icone}
      {texte}
    </p>
  );
}

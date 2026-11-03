"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CircleAlert,
  CloudOff,
  CloudUpload,
  LoaderCircle,
  NotebookPen,
  Save,
  Send,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { lireProfilLocal } from "@/features/auth/api";
import {
  alertesImmediates,
  cleAlerte,
  INTERVALLE_SAUVEGARDE_MS,
  resumeSaisie,
  sectionsActives,
} from "@/features/chantier";
import type { PreparationSaisie, ResumeSaisie } from "@/features/chantier";
import { enregistrerBrouillon, envoyerAlerte, soumettreRapport } from "@/features/chantier/adaptateur";
import { ecrireCopieLocale, effacerCopieLocale, lireCopieLocale } from "@/features/chantier/brouillonLocal";
import { CLE_JOURNAL, cleRapportsProjet } from "@/features/chantier/cles";
import { schemaRapport, valeursDepuis, versSaisie, type ValeursRapport } from "@/features/chantier/validations";
import { useDefile, useResteEnBas } from "@/hooks/use-defilement";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

import { CarteSection, Signal } from "./elementsSaisie";
import { ModaleSoumission } from "./ModaleSoumission";
import { SectionEquipes } from "./SectionEquipes";
import { SectionContexte, SectionNote, SectionPrevisions } from "./SectionsContexte";
import {
  SectionBlocages,
  SectionEvenements,
  SectionPhotos,
  SectionPiecesJointes,
  type EtatAlerte,
} from "./SectionsEvenements";
import {
  SectionBesoins,
  SectionEquipements,
  SectionLivraisons,
  SectionMateriaux,
} from "./SectionsRessources";
import { SectionAvancement } from "./SectionsTerrain";

type CleSection =
  | "journee"
  | "travaux"
  | "rh"
  | "materiels"
  | "materiaux"
  | "evenements"
  | "photos"
  | "synthese";

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

/**
 * En journée d'arrêt complet, seuls les travaux et le pointage des équipes sont écartés ;
 * les matériels, livraisons, événements, blocages, photos et prévisions restent ouverts.
 */
const ORDRE_JOURNEE_ARRET: CleSection[] = [
  "journee",
  "materiels",
  "materiaux",
  "evenements",
  "photos",
  "synthese",
];

const RUBRIQUES: CleSection[] = ["travaux", "rh", "materiels", "materiaux", "evenements", "photos"];

const CHAMPS_DE_SECTION: Record<CleSection, (keyof ValeursRapport)[]> = {
  journee: ["date", "heureDebut", "heureFin", "arret", "motifArret", "precisionArret", "meteo"],
  travaux: ["lotsTravailles", "activites"],
  rh: ["equipes"],
  materiels: ["equipements"],
  materiaux: ["livraisons", "materiaux", "besoins"],
  evenements: ["incidents", "blocages"],
  photos: ["photos", "piecesJointes"],
  synthese: ["noteRedacteur", "previsions"],
};

function sectionsEnErreur(erreurs: FieldErrors<ValeursRapport>): Set<CleSection> {
  const enErreur = new Set<CleSection>();
  for (const [section, champs] of Object.entries(CHAMPS_DE_SECTION) as [
    CleSection,
    (keyof ValeursRapport)[],
  ][]) {
    if (champs.some((champ) => erreurs[champ])) enErreur.add(section);
  }
  return enErreur;
}

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

export function FormulaireRapport({
  preparation,
  date,
  entete,
  titre,
}: {
  preparation: PreparationSaisie;
  date: string;
  entete: React.ReactNode;
  titre: React.ReactNode;
}) {
  const t = useTranslations("journal.saisie");
  const format = useFormatter();
  const router = useRouter();
  const cache = useQueryClient();
  const enLigne = useEnLigne();
  const { projet } = preparation;
  const utilisateurId = lireProfilLocal()?.id ?? null;

  const [depart] = useState(() => {
    const serveur = valeursDepuis(preparation, date);
    const copie = lireCopieLocale(projet.id, date, utilisateurId);
    const plusRecente =
      copie && (!preparation.rapport || copie.modifieLe > preparation.rapport.enregistreLe);
    return {
      valeurs: plusRecente ? { ...serveur, ...copie.valeurs } : serveur,
      restauree: !!plusRecente,
    };
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
    depart.restauree
      ? { type: "MODIFIE" }
      : { type: "AJOUR", le: preparation.rapport?.enregistreLe ?? null },
  );

  useEffect(() => {
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const desabonner = subscribe({
      formState: { values: true },
      callback: () => {
        modifie.current = true;
        setSauvegarde((etat) => (etat.type === "EN_COURS" ? etat : { type: "MODIFIE" }));
        clearTimeout(minuterie);
        minuterie = setTimeout(
          () => ecrireCopieLocale(projet.id, date, getValues(), utilisateurId),
          600,
        );
      },
    });
    return () => {
      clearTimeout(minuterie);
      desabonner();
    };
  }, [subscribe, getValues, projet.id, date, utilisateurId]);

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
      ecrireCopieLocale(projet.id, date, getValues(), utilisateurId);
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

  useEffect(() => {
    const minuterie = setInterval(() => {
      if (!modifie.current || enregistrementEnCours || !navigator.onLine) return;
      enregistrerAsync().catch(() => undefined);
    }, INTERVALLE_SAUVEGARDE_MS);
    return () => clearInterval(minuterie);
  }, [enregistrerAsync, enregistrementEnCours]);

  const [alertes, setAlertes] = useState<Record<string, EtatAlerte>>(() =>
    Object.fromEntries(
      (preparation.rapport?.alertesEnvoyees ?? []).map((cle) => [cle, "ENVOYEE" as const]),
    ),
  );
  const etatsAlertes = useRef(alertes);
  const noterAlertes = useCallback((etats: Record<string, EtatAlerte>) => {
    etatsAlertes.current = { ...etatsAlertes.current, ...etats };
    setAlertes(etatsAlertes.current);
  }, []);

  const declencherAlertes = useCallback(async () => {
    if (!navigator.onLine) return;
    const aEnvoyer = alertesImmediates(versSaisie(getValues(), preparation)).filter((alerte) => {
      const etat = etatsAlertes.current[cleAlerte(alerte)];
      return etat !== "ENVOYEE" && etat !== "EN_COURS";
    });
    if (aEnvoyer.length === 0) return;
    noterAlertes(
      Object.fromEntries(aEnvoyer.map((alerte) => [cleAlerte(alerte), "EN_COURS" as const])),
    );
    for (const alerte of aEnvoyer) {
      try {
        if (!rapportId.current) await enregistrerAsync();
        const id = rapportId.current;
        if (!id) throw new Error("rapport_absent");
        await envoyerAlerte(id, alerte);
        noterAlertes({ [cleAlerte(alerte)]: "ENVOYEE" });
        toast.warning(
          alerte.type === "BLOCAGE_BLOQUANT"
            ? t("alertes.blocageEnvoye")
            : alerte.type === "EQUIPEMENT_PANNE"
              ? t("alertes.panneEnvoyee")
              : t("alertes.incidentEnvoye"),
        );
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
      name: ["blocages", "incidents", "equipements"],
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

  const [resume, setResume] = useState<ResumeSaisie | null>(null);
  const soumission = useMutation({
    mutationFn: () => soumettreRapport(rapportId.current, versSaisie(getValues(), preparation)),
    onSuccess: ({ id, reference }) => {
      effacerCopieLocale(projet.id, date, utilisateurId);
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
      if (premiere) {
        document
          .getElementById(`section-${premiere}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
  );

  const arret = useWatch({ control, name: "arret" });
  const sections = sectionsActives(preparation.sections, arret);
  const ordre = arret ? ORDRE_JOURNEE_ARRET : ORDRE_SECTIONS;
  const numero = (cle: CleSection) =>
    RUBRIQUES.includes(cle) ? RUBRIQUES.indexOf(cle) + 1 : undefined;
  const rubrique = (cle: Exclude<CleSection, "journee">) => ({
    id: `section-${cle}`,
    numero: numero(cle),
    titre: t(`rubriques.${cle}`),
    description: t(`contenuRubriques.${cle}`),
  });
  const enErreur = sectionsEnErreur(formState.errors);

  const active = useSectionVisible(ordre);
  const defile = useDefile();
  const resteEnBas = useResteEnBas();

  const allerA = useCallback((cle: CleSection) => {
    document.getElementById(`section-${cle}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <Form {...formulaire} preRempli={!depart.restauree}>
      <form
        noValidate
        onSubmit={(evenement) => {
          evenement.preventDefault();
          void demanderSoumission();
        }}
        className="flex flex-col gap-4"
      >
        {entete}

        <div
          data-barre-collante
          className={cn(
            "contents lg:sticky lg:top-16 lg:z-30 lg:-mx-6 lg:flex lg:flex-col lg:gap-3 lg:border-b lg:border-neutral-200 lg:bg-background/95 lg:px-6 lg:pt-3 lg:backdrop-blur lg:transition-shadow",
            defile && "lg:shadow-collant",
          )}
        >
          {titre}
          <nav
            aria-label={t("navigation")}
            className={cn(
              "sticky top-16 z-30 -mx-2 overflow-x-auto border-b border-neutral-200 bg-background/95 px-2 py-1.5 backdrop-blur transition-shadow [scrollbar-color:var(--color-neutral-200)_transparent] [scrollbar-width:thin] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:shadow-none lg:backdrop-blur-none",
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
                          courante
                            ? "bg-primary-600 font-semibold text-white"
                            : "bg-neutral-100 text-neutral-500",
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
                      {enErreur.has(cle) && (
                        <CircleAlert className="size-3.5" aria-label={t("sectionEnErreur")} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        {preparation.rapport?.statut === "REJETE" && preparation.rapport.commentaireRejet && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-erreur bg-erreur-fond p-4 text-sm text-erreur"
          >
            <Undo2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{t("rejet.titre")}</span>
              <span className="text-neutral-800">{preparation.rapport.commentaireRejet}</span>
            </div>
          </div>
        )}

        <SectionContexte meteoSuggeree={preparation.meteoSuggeree} />

        {!arret && (
          <>
            <CarteSection {...rubrique("travaux")}>
              {sections.includes("AVANCEMENT") ? (
                <SectionAvancement
                  activites={preparation.activites}
                  lots={preparation.lots}
                  equipes={preparation.equipes}
                />
              ) : (
                <Signal ton="information">{t("avancement.aucuneActivite")}</Signal>
              )}
            </CarteSection>

            <CarteSection {...rubrique("rh")}>
              {sections.includes("EQUIPES") ? (
                <SectionEquipes equipes={preparation.equipes} />
              ) : (
                <Signal ton="information">{t("sansObjet.rh")}</Signal>
              )}
            </CarteSection>
          </>
        )}

        <CarteSection {...rubrique("materiels")}>
          {sections.includes("EQUIPEMENTS") ? (
            <SectionEquipements alertes={alertes} />
          ) : (
            <Signal ton="information">{t("sansObjet.materiels")}</Signal>
          )}
        </CarteSection>

        <CarteSection {...rubrique("materiaux")}>
          {sections.includes("LIVRAISONS") && <SectionLivraisons materiaux={preparation.materiaux} />}
          {sections.includes("MATERIAUX") && <SectionMateriaux materiaux={preparation.materiaux} />}
          <SectionBesoins materiaux={preparation.materiaux} />
        </CarteSection>

        <CarteSection {...rubrique("evenements")}>
          <SectionEvenements alertes={alertes} />
          <SectionBlocages
            blocagesOuverts={preparation.blocagesOuverts}
            activites={preparation.activites}
            lots={preparation.lots}
            alertes={alertes}
          />
        </CarteSection>

        <CarteSection {...rubrique("photos")}>
          <SectionPhotos activites={preparation.activites} lots={preparation.lots} />
          <SectionPiecesJointes />
        </CarteSection>

        <CarteSection {...rubrique("synthese")}>
          <SectionNote arret={arret} />
          <SectionPrevisions
            previsionsVeille={preparation.previsionsVeille}
            activites={preparation.activites}
            equipes={preparation.equipes}
          />
        </CarteSection>

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
                {enregistrementEnCours ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Save aria-hidden="true" />
                )}
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
        jour={format.dateTime(new Date(`${date}T00:00:00Z`), {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })}
        ouverte={resume !== null}
        enCours={soumission.isPending}
        onFermer={() => setResume(null)}
        onConfirmer={() => soumission.mutate()}
      />
    </Form>
  );
}

function useSectionVisible(ordre: CleSection[]): CleSection | null {
  const [active, setActive] = useState<CleSection | null>(ordre[0] ?? null);
  const cleOrdre = ordre.join("|");

  useEffect(() => {
    const cles = cleOrdre.split("|") as CleSection[];
    let image = 0;
    const mesurer = () => {
      cancelAnimationFrame(image);
      image = requestAnimationFrame(() => {
        const repere = window.innerHeight * 0.3;
        let courante = cles[0] ?? null;
        for (const cle of cles) {
          const section = document.getElementById(`section-${cle}`);
          if (section && section.getBoundingClientRect().top <= repere) courante = cle;
        }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
          courante = cles.at(-1) ?? courante;
        }
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
    MODIFIE: {
      icone: <CloudUpload className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />,
      texte: t("modifie"),
    },
    EN_COURS: {
      icone: <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />,
      texte: t("enCours"),
    },
    ECHEC: {
      icone: <CircleAlert className="size-4 shrink-0 text-erreur" aria-hidden="true" />,
      texte: t("echec"),
    },
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

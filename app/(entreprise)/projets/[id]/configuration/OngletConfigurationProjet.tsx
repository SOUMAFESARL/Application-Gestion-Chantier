"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  FileDown,
  FolderTree,
  Landmark,
  LoaderCircle,
  Plus,
  Printer,
  Save,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ReactNode } from "react";

import { ComboboxVille } from "@/components/metier/ComboboxVille";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import { Textarea } from "@/components/ui/textarea";
import { ZoneDepotFichiers } from "@/components/ui/zone-depot-fichiers";
import { paysEntreprise } from "@/features/configuration/api";
import { lireArbre } from "@/features/decoupage/adaptateur";
import { useDroits } from "@/features/habilitations";
import {
  lireProjet,
  modifierProjet,
  telechargerContratProjet,
  telechargerOrdreServiceProjet,
} from "@/features/projets/adaptateur";
import { cleProjet } from "@/features/projets/cles";
import { ComboboxTypeProjet } from "@/features/projets/components/ComboboxTypeProjet";
import {
  FORMAT_CONTRAT,
  NATURES_PROJET,
  NOMBRE_MAX_CONTRATS,
  TAILLE_MAX_CONTRAT,
  datesVerrouillees,
  projetModifiable,
  refusContrat,
} from "@/features/projets/regles";
import type {
  BailleurProjet,
  DifficulteProjet,
  EtapeAvenirProjet,
  EtudeProjet,
  InformationsComplementairesProjet,
  IntervenantExterneProjet,
  LotComplementaireProjet,
  NatureProjet,
  Projet,
  RecommandationProjet,
} from "@/features/projets/types";
import { ComboboxTiers } from "@/features/tiers/components/ComboboxTiers";
import type { ErreurApi } from "@/lib/api";
import { formaterTailleFichier } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useGenerationFicheProjet } from "../GenerationFicheProjet";

type IdRubrique = "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "s7" | "s8" | "s9";

const RUBRIQUES: readonly IdRubrique[] = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"];

const CLES_SECTEURS = [
  "batiment",
  "infrastructures",
  "education",
  "sante",
  "hydraulique",
  "energie",
  "industrie",
  "autre",
] as const;

const CLES_PHASES = ["identification", "passation", "execution", "reception", "cloture"] as const;
const CLES_DEVISES = ["fcfa", "eur", "usd"] as const;
const CLES_REGIMES = ["ttc", "ht_exonere", "tva_suspendue"] as const;
const CLES_MODES_FIN = ["budget_etat", "conjoint", "ext_pret", "ext_don", "ppp"] as const;
const CLES_SOURCES_FIN = ["fonds_propres", "credit_bancaire", "mixte", "vefa"] as const;
const CLES_STATUTS_FIN = ["acquis", "partiel", "en_negociation"] as const;
const CLES_CONTRACTUALISATIONS = [
  "entreprise_generale",
  "lots_separes",
  "conception_realisation",
  "regie",
] as const;
const CLES_DISPONIBILITES = ["disponible", "partielle", "en_acquisition", "litige"] as const;
const CLES_DELIMITATIONS = ["borne", "en_cours", "non_borne"] as const;
const CLES_PERMIS_STATUTS = ["obtenu", "instruction", "non_depose", "non_applicable"] as const;
const CLES_STATUTS_ETUDE = ["validee", "en_cours", "a_lancer"] as const;
const CLES_STATUTS_LOT = ["en_cours", "non_demarre", "en_retard", "termine", "bloque"] as const;
const CLES_GRAVITES = ["critique", "majeure", "moderee"] as const;
const CLES_STATUTS_DIFFICULTE = ["ouvert", "en_traitement", "resolu"] as const;

const CHAMP_SELECT =
  "flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

interface EtatFormulaire {
  nom: string;
  natureProjet: NatureProjet;
  typeProjet: string;
  ville: string;
  quartier: string;
  maitreOuvrage: string;
  maitreOeuvre: string;
  description: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  dateDebutReelle: string;
  dateFinReelle: string;
  infos: InformationsComplementairesProjet;
  objectifsTexte: string;
  impactsTexte: string;
}

function etatInitialDepuisProjet(projet: Projet): EtatFormulaire {
  const infos = projet.informationsComplementaires ?? {};
  return {
    nom: projet.nom,
    natureProjet: projet.natureProjet ?? "PRIVE",
    typeProjet: projet.typeProjet ?? "",
    ville: projet.ville,
    quartier: projet.quartier ?? "",
    maitreOuvrage: projet.client.raisonSociale,
    maitreOeuvre: projet.maitreOeuvre ?? "",
    description: projet.description ?? "",
    dateDebutPrevue: projet.dateDebutPrevue ?? "",
    dateFinPrevue: projet.dateFinPrevue ?? "",
    dateDebutReelle: projet.dateDebutReelle ?? "",
    dateFinReelle: projet.dateFinReelle ?? "",
    infos: {
      ...infos,
      devise: infos.devise || "FCFA",
      coordonnateur: infos.coordonnateur ?? { nom: "", tel: "", email: "" },
      bailleurs: infos.bailleurs ?? [],
      etudes: infos.etudes ?? [],
      lots: infos.lots ?? [],
      difficultes: infos.difficultes ?? [],
      recos: infos.recos ?? [],
      intervenants: infos.intervenants ?? [],
      etapes: infos.etapes ?? [],
    },
    objectifsTexte: (infos.objectifs ?? []).join("\n"),
    impactsTexte: (infos.impacts ?? []).join("\n"),
  };
}

function estRempli(valeur: unknown): boolean {
  if (valeur === null || valeur === undefined) return false;
  if (typeof valeur === "string") return valeur.trim().length > 0;
  if (Array.isArray(valeur)) return valeur.length > 0;
  return true;
}

function CarteRubrique({
  id,
  numero,
  titre,
  sousTitre,
  compteur,
  complet,
  children,
}: {
  id: IdRubrique;
  numero: number;
  titre: string;
  sousTitre: string;
  compteur: string;
  complet: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={`rubrique-${id}`}
      className="scroll-mt-36 rounded-lg border border-solid border-neutral-200 bg-white shadow-xs"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-neutral-200 bg-neutral-50/70 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-xs font-bold text-white">
            {numero}
          </span>
          <div>
            <h2 className="m-0 text-sm font-bold text-neutral-900">{titre}</h2>
            <p className="m-0 text-xs text-neutral-500">{sousTitre}</p>
          </div>
        </div>
        <Badge variante={complet ? "succes" : "neutre"}>{compteur}</Badge>
      </header>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}

function ChampSelect({
  id,
  label,
  valeur,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  valeur: string;
  options: { cle: string; libelle: string }[];
  placeholder: string;
  disabled?: boolean;
  onChange: (valeur: string) => void;
}) {
  const valeurHorsListe =
    valeur && !options.some((opt) => opt.libelle === valeur || opt.cle === valeur);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-neutral-700">
        {label}
      </Label>
      <select
        id={id}
        value={valeur}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={CHAMP_SELECT}
      >
        <option value="">{placeholder}</option>
        {valeurHorsListe && <option value={valeur}>{valeur}</option>}
        {options.map((opt) => (
          <option key={opt.cle} value={opt.libelle}>
            {opt.libelle}
          </option>
        ))}
      </select>
    </div>
  );
}

export function OngletConfigurationProjet({ projetId }: { projetId: string }) {
  const requete = useQuery({
    queryKey: cleProjet(projetId),
    queryFn: () => lireProjet(projetId),
  });

  if (!requete.data) return null;
  return <FormulaireConfigurationProjet key={requete.data.id} projet={requete.data} />;
}

function FormulaireConfigurationProjet({ projet }: { projet: Projet }) {
  const t = useTranslations("ficheProjet.configuration");
  const tCreation = useTranslations("projets.tiroirCreation");
  const clientRequetes = useQueryClient();
  const { peutSurProjet, voitMontants } = useDroits();

  const [etat, setEtat] = useState<EtatFormulaire>(() => etatInitialDepuisProjet(projet));
  const [rubriqueActive, setRubriqueActive] = useState<IdRubrique>("s1");
  const [nouveauxContrats, setNouveauxContrats] = useState<File[]>([]);
  const [nouvelOs, setNouvelOs] = useState<File[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [importEnCours, setImportEnCours] = useState(false);
  const [pays, setPays] = useState("");

  useEffect(() => {
    let vivant = true;
    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const projetApercu = useMemo<Projet>(() => {
    const objectifs = etat.objectifsTexte
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const impacts = etat.impactsTexte
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return {
      ...projet,
      nom: etat.nom,
      natureProjet: etat.natureProjet,
      typeProjet: etat.typeProjet || projet.typeProjet,
      ville: etat.ville,
      quartier: etat.quartier,
      client: { ...projet.client, raisonSociale: etat.maitreOuvrage },
      maitreOeuvre: etat.maitreOeuvre || null,
      description: etat.description,
      dateDebutPrevue: etat.dateDebutPrevue || projet.dateDebutPrevue,
      dateFinPrevue: etat.dateFinPrevue || projet.dateFinPrevue,
      dateDebutReelle: etat.dateDebutReelle || null,
      dateFinReelle: etat.dateFinReelle || null,
      informationsComplementaires: {
        ...etat.infos,
        objectifs,
        impacts,
      },
    };
  }, [projet, etat]);

  const fichePdf = useGenerationFicheProjet(projetApercu);

  const compteurs = useMemo(() => {
    const pub = etat.natureProjet === "PUBLIC";
    const i = etat.infos;
    const listes: Record<IdRubrique, unknown[]> = {
      s1: pub
        ? [
            etat.nom,
            etat.typeProjet,
            etat.ville,
            etat.maitreOuvrage,
            i.tutelle,
            i.delegue,
            i.agence,
            i.secteur,
            i.phase,
            etat.description,
          ]
        : [
            etat.nom,
            etat.typeProjet,
            etat.ville,
            etat.maitreOuvrage,
            etat.maitreOeuvre,
            i.secteur,
            i.phase,
            etat.description,
          ],
      s2: pub
        ? [i.capacite_projet, i.superficie_ha, i.surface_batie, i.perimetre, etat.impactsTexte]
        : [i.surface_batie, i.terrain_m2, i.niveaux, i.usage, i.perimetre],
      s3: [
        etat.dateDebutPrevue,
        etat.dateFinPrevue,
        i.date_situation,
        i.cout || projet.budgetInitial,
        i.devise,
      ],
      s4: pub
        ? [i.mode_fin, i.statut_fin, i.etat_effectif, i.etat_decaissement, i.bailleurs]
        : [i.source_fin, i.statut_fin, i.etablissement, i.contractualisation],
      s5: pub
        ? [i.disponibilite, i.delimitation, i.purge_total, i.etudes]
        : [i.disponibilite, i.titre_foncier, i.permis_statut, i.etudes],
      s6: [i.taux_saisi || projet.avancementReel, i.etat_narratif, i.lots],
      s7: [i.difficultes, i.recos],
      s8: pub
        ? [i.coordonnateur?.nom, projet.chefProjet, i.intervenants]
        : [projet.chefProjet, i.intervenants],
      s9: [i.etapes, i.note_cp],
    };

    const parRubrique = {} as Record<IdRubrique, { remplis: number; total: number }>;
    let totalRemplis = 0;
    let totalChamps = 0;

    for (const id of RUBRIQUES) {
      const champs = listes[id];
      const remplis = champs.filter(estRempli).length;
      parRubrique[id] = { remplis, total: champs.length };
      totalRemplis += remplis;
      totalChamps += champs.length;
    }

    return {
      parRubrique,
      pct: totalChamps > 0 ? Math.round((totalRemplis / totalChamps) * 100) : 0,
    };
  }, [etat, projet]);

  const peutModifier = peutSurProjet("projets.ecrire", projet) && projetModifiable(projet);
  const estPublic = etat.natureProjet === "PUBLIC";
  const verrouDates = datesVerrouillees({
    debut: projet.dateDebutPrevue,
    fin: projet.dateFinPrevue,
  });

  function majChamp<K extends keyof EtatFormulaire>(cle: K, valeur: EtatFormulaire[K]) {
    setEtat((prev) => ({ ...prev, [cle]: valeur }));
  }

  function majInfo<K extends keyof InformationsComplementairesProjet>(
    cle: K,
    valeur: InformationsComplementairesProjet[K],
  ) {
    setEtat((prev) => ({
      ...prev,
      infos: {
        ...prev.infos,
        [cle]: valeur,
      },
    }));
  }

  function motifRefusContrat(fichier: File): string | null {
    switch (refusContrat(fichier)) {
      case "FORMAT":
        return tCreation("refusContratFormat");
      case "TAILLE":
        return tCreation("refusContratTaille", {
          taille: formaterTailleFichier(TAILLE_MAX_CONTRAT),
        });
      default:
        return null;
    }
  }

  async function importerLotsDepuisDecoupage() {
    if (!projet) return;
    setImportEnCours(true);
    try {
      const arbre = await lireArbre(projet.id);
      const racines = arbre.cases;
      if (racines.length === 0) {
        toast.info(t("importDecoupageSucces", { nombre: 0 }));
        return;
      }
      const lignes: LotComplementaireProjet[] = racines.map((el, idx) => ({
        code: el.code || el.numero || `L-${String(idx + 1).padStart(2, "0")}`,
        nom: el.libelle,
        montant: el.montant !== null ? String(Math.round(el.montant / 100)) : "",
        avancement: el.avancement !== null ? String(Math.round(el.avancement)) : "0",
        statut:
          el.avancement !== null && el.avancement >= 100
            ? t("options.statutsLot.termine")
            : el.avancement !== null && el.avancement > 0
              ? t("options.statutsLot.en_cours")
              : t("options.statutsLot.non_demarre"),
        prestataire: "",
      }));
      majInfo("lots", lignes);
      toast.success(t("importDecoupageSucces", { nombre: lignes.length }));
    } catch (err) {
      const cause = err as ErreurApi;
      toast.error(cause.message || t("erreurEnregistrement"));
    } finally {
      setImportEnCours(false);
    }
  }

  async function enregistrer() {
    if (!projet || !etat || !peutModifier) return;
    setEnCours(true);
    try {
      const objectifs = etat.objectifsTexte
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const impacts = etat.impactsTexte
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const projetMaj = await modifierProjet(projet.id, {
        ...(projet.peutRenommer ? { nom: etat.nom } : {}),
        natureProjet: etat.natureProjet,
        typeProjet: etat.typeProjet || (projet.typeProjet ?? undefined),
        ville: etat.ville,
        quartier: etat.quartier,
        maitreOuvrage: etat.maitreOuvrage,
        maitreOeuvre: etat.maitreOeuvre,
        description: etat.description,
        ...(!verrouDates.debut && etat.dateDebutPrevue
          ? { dateDebutPrevue: etat.dateDebutPrevue }
          : {}),
        ...(!verrouDates.fin && etat.dateFinPrevue ? { dateFinPrevue: etat.dateFinPrevue } : {}),
        dateDebutReelle: etat.dateDebutReelle || null,
        dateFinReelle: etat.dateFinReelle || null,
        informationsComplementaires: {
          ...etat.infos,
          objectifs,
          impacts,
        },
        contrats: nouveauxContrats.length > 0 ? nouveauxContrats : undefined,
        ordreService: nouvelOs[0] ?? undefined,
      });

      clientRequetes.setQueryData(cleProjet(projet.id), projetMaj);
      void clientRequetes.invalidateQueries({ queryKey: ["projets", "liste"] });
      setNouveauxContrats([]);
      setNouvelOs([]);
      toast.success(t("succesEnregistrement"));
    } catch (err) {
      const cause = err as ErreurApi;
      toast.error(cause.message || t("erreurEnregistrement"));
    } finally {
      setEnCours(false);
    }
  }

  const bailleurs = etat.infos.bailleurs ?? [];
  const etudes = etat.infos.etudes ?? [];
  const lots = etat.infos.lots ?? [];
  const difficultes = etat.infos.difficultes ?? [];
  const recos = etat.infos.recos ?? [];
  const intervenants = etat.infos.intervenants ?? [];
  const etapes = etat.infos.etapes ?? [];
  const coordonnateur = etat.infos.coordonnateur ?? { nom: "", tel: "", email: "" };

  return (
    <div className="flex flex-col gap-6">
      {/* Barre supérieure : bascule Public/Privé, jauge de complétion et boutons d'action */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-solid border-neutral-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div
            role="radiogroup"
            aria-label={t("champs.natureProjet")}
            className="inline-flex rounded-lg border border-solid border-neutral-200 bg-neutral-100 p-1"
          >
            {NATURES_PROJET.map((nature) => {
              const actif = etat.natureProjet === nature;
              return (
                <button
                  key={nature}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  disabled={!peutModifier || enCours}
                  onClick={() => majChamp("natureProjet", nature)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-md border-0 px-3.5 py-1.5 text-xs font-bold transition-colors",
                    actif
                      ? "bg-neutral-900 text-white shadow-xs"
                      : "bg-transparent text-neutral-600 hover:text-neutral-900",
                  )}
                >
                  {nature === "PUBLIC" ? (
                    <Landmark className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Building2 className="size-3.5" aria-hidden="true" />
                  )}
                  {tCreation(`natureProjet.${nature}`)}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="h-2 w-28 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${compteurs.pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-neutral-700 tabular-nums">
              {t("completion", { pct: compteurs.pct })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fichePdf.generer}
            disabled={fichePdf.enCours}
          >
            {fichePdf.enCours ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Printer className="size-4" aria-hidden="true" />
            )}
            {t("apercuPdf")}
          </Button>
          {peutModifier && (
            <Button
              type="button"
              size="sm"
              onClick={() => void enregistrer()}
              disabled={enCours}
            >
              {enCours ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {enCours ? t("enregistrementEnCours") : t("enregistrer")}
            </Button>
          )}
        </div>
      </div>

      {/* Corps en 2 colonnes : sommaire latéral des 9 rubriques + panneaux de saisie */}
      <div className="grid grid-cols-[260px_1fr] items-start gap-6 max-lg:grid-cols-1">
        <aside className="sticky top-28 flex flex-col gap-3 rounded-lg border border-solid border-neutral-200 bg-white p-3.5 shadow-xs max-lg:static">
          <span className="px-2 text-xs font-bold tracking-wider text-neutral-500 uppercase">
            {t("rubriquesTitre")}
          </span>
          <nav className="flex flex-col gap-1" aria-label={t("rubriquesTitre")}>
            {RUBRIQUES.map((id) => {
              const stat = compteurs.parRubrique[id] ?? { remplis: 0, total: 0 };
              const complet = stat.total > 0 && stat.remplis === stat.total;
              const actif = rubriqueActive === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setRubriqueActive(id);
                    document
                      .getElementById(`rubrique-${id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-md border-0 px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                    actif
                      ? "bg-primary-50 text-primary-700"
                      : "bg-transparent text-neutral-700 hover:bg-neutral-100",
                  )}
                >
                  <span className="truncate">{t(`rubriques.${id}.titre`)}</span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                      complet
                        ? "bg-succes-leger text-succes"
                        : "bg-neutral-100 text-neutral-600",
                    )}
                  >
                    {complet && <CheckCircle2 className="size-3" aria-hidden="true" />}
                    {t("compteurRubrique", stat)}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-1 rounded-md border border-solid border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">
            <div className="mb-1 flex items-center gap-1.5 font-bold text-neutral-800">
              <Badge variante={estPublic ? "secondaire" : "primaire"}>
                {estPublic ? t("badgePublic") : t("badgePrive")}
              </Badge>
              <span>{t("legendeTitre")}</span>
            </div>
            <p className="m-0">{estPublic ? t("legendePublic") : t("legendePrive")}</p>
          </div>
        </aside>

        <div className="flex flex-col gap-6">
          {/* 1. IDENTIFICATION DU PROJET */}
          <CarteRubrique
            id="s1"
            numero={1}
            titre={t("rubriques.s1.titre")}
            sousTitre={t("rubriques.s1.sousTitre")}
            compteur={t("compteurRubrique", compteurs.parRubrique.s1)}
            complet={
              compteurs.parRubrique.s1.remplis === compteurs.parRubrique.s1.total
            }
          >
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-nom" className="text-xs font-semibold text-neutral-700">
                  {t("champs.nom")}
                </Label>
                <Input
                  id="cfg-nom"
                  value={etat.nom}
                  onChange={(e) => majChamp("nom", e.target.value)}
                  disabled={!peutModifier || !projet.peutRenommer || enCours}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-ref" className="text-xs font-semibold text-neutral-700">
                  {t("champs.reference")}
                </Label>
                <Input
                  id="cfg-ref"
                  value={projet.reference}
                  readOnly
                  className="bg-neutral-100 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-neutral-700">
                  {t("champs.typeProjet")}
                </Label>
                <ComboboxTypeProjet
                  valeur={etat.typeProjet}
                  onChange={(val) => majChamp("typeProjet", val)}
                  disabled={!peutModifier || enCours}
                />
              </div>

              <ChampSelect
                id="cfg-secteur"
                label={t("champs.secteur")}
                valeur={etat.infos.secteur ?? ""}
                placeholder={t("selectionner")}
                disabled={!peutModifier || enCours}
                options={CLES_SECTEURS.map((cle) => ({
                  cle,
                  libelle: t(`options.secteurs.${cle}`),
                }))}
                onChange={(val) => majInfo("secteur", val)}
              />

              <ChampSelect
                id="cfg-phase"
                label={t("champs.phase")}
                valeur={etat.infos.phase ?? ""}
                placeholder={t("selectionner")}
                disabled={!peutModifier || enCours}
                options={CLES_PHASES.map((cle) => ({
                  cle,
                  libelle: t(`options.phases.${cle}`),
                }))}
                onChange={(val) => majInfo("phase", val)}
              />

              {estPublic && (
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-num-fiche"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.numeroFiche")}
                  </Label>
                  <Input
                    id="cfg-num-fiche"
                    value={etat.infos.numero_fiche ?? ""}
                    placeholder={t("champs.numeroFichePlaceholder")}
                    onChange={(e) => majInfo("numero_fiche", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>
              )}

              {estPublic && (
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-region"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.region")}
                  </Label>
                  <Input
                    id="cfg-region"
                    value={etat.infos.region ?? ""}
                    placeholder={t("champs.regionPlaceholder")}
                    onChange={(e) => majInfo("region", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-neutral-700">
                  {t("champs.ville")}
                </Label>
                <ComboboxVille
                  pays={pays}
                  valeur={etat.ville}
                  onChange={(val) => majChamp("ville", val)}
                  disabled={!peutModifier || enCours}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-quartier" className="text-xs font-semibold text-neutral-700">
                  {t("champs.quartier")}
                </Label>
                <Input
                  id="cfg-quartier"
                  value={etat.quartier}
                  placeholder={t("champs.quartierPlaceholder")}
                  onChange={(e) => majChamp("quartier", e.target.value)}
                  disabled={!peutModifier || enCours}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-neutral-700">
                  {t("champs.maitreOuvrage")}
                </Label>
                <ComboboxTiers
                  role="CLIENT_MOA"
                  paysDefaut={pays}
                  valeur={etat.maitreOuvrage}
                  onChange={(val) => majChamp("maitreOuvrage", val)}
                  disabled={!peutModifier || enCours}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-contact" className="text-xs font-semibold text-neutral-700">
                  {t("champs.contact")}
                </Label>
                <Input
                  id="cfg-contact"
                  value={etat.infos.contact ?? ""}
                  placeholder={t("champs.contactPlaceholder")}
                  onChange={(e) => majInfo("contact", e.target.value)}
                  disabled={!peutModifier || enCours}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-neutral-700">
                  {t("champs.maitreOeuvre")}
                </Label>
                <ComboboxTiers
                  role="MAITRE_OEUVRE"
                  paysDefaut={pays}
                  valeur={etat.maitreOeuvre}
                  onChange={(val) => majChamp("maitreOeuvre", val)}
                  disabled={!peutModifier || enCours}
                />
              </div>

              {estPublic && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="cfg-tutelle"
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {t("champs.tutelle")}
                    </Label>
                    <Input
                      id="cfg-tutelle"
                      value={etat.infos.tutelle ?? ""}
                      placeholder={t("champs.tutellePlaceholder")}
                      onChange={(e) => majInfo("tutelle", e.target.value)}
                      disabled={!peutModifier || enCours}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="cfg-delegue"
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {t("champs.delegue")}
                    </Label>
                    <Input
                      id="cfg-delegue"
                      value={etat.infos.delegue ?? ""}
                      placeholder={t("champs.deleguePlaceholder")}
                      onChange={(e) => majInfo("delegue", e.target.value)}
                      disabled={!peutModifier || enCours}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="cfg-agence"
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {t("champs.agence")}
                    </Label>
                    <Input
                      id="cfg-agence"
                      value={etat.infos.agence ?? ""}
                      placeholder={t("champs.agencePlaceholder")}
                      onChange={(e) => majInfo("agence", e.target.value)}
                      disabled={!peutModifier || enCours}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="cfg-operateur"
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {t("champs.operateur")}
                    </Label>
                    <Input
                      id="cfg-operateur"
                      value={etat.infos.operateur ?? ""}
                      placeholder={t("champs.operateurPlaceholder")}
                      onChange={(e) => majInfo("operateur", e.target.value)}
                      disabled={!peutModifier || enCours}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-desc" className="text-xs font-semibold text-neutral-700">
                {t("champs.description")}
              </Label>
              <Textarea
                id="cfg-desc"
                rows={3}
                value={etat.description}
                onChange={(e) => majChamp("description", e.target.value)}
                disabled={!peutModifier || enCours}
              />
            </div>

            {estPublic && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-interet" className="text-xs font-semibold text-neutral-700">
                  {t("champs.interet")}
                </Label>
                <Textarea
                  id="cfg-interet"
                  rows={2}
                  value={etat.infos.interet ?? ""}
                  placeholder={t("champs.interetPlaceholder")}
                  onChange={(e) => majInfo("interet", e.target.value)}
                  disabled={!peutModifier || enCours}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-objectifs" className="text-xs font-semibold text-neutral-700">
                {t("champs.objectifs")}
              </Label>
              <Textarea
                id="cfg-objectifs"
                rows={3}
                value={etat.objectifsTexte}
                placeholder={t("champs.objectifsPlaceholder")}
                onChange={(e) => majChamp("objectifsTexte", e.target.value)}
                disabled={!peutModifier || enCours}
              />
            </div>
          </CarteRubrique>

          {/* 2. PROGRAMME ET CARACTÉRISTIQUES */}
          <CarteRubrique
            id="s2"
            numero={2}
            titre={t("rubriques.s2.titre")}
            sousTitre={t("rubriques.s2.sousTitre")}
            compteur={t("compteurRubrique", compteurs.parRubrique.s2)}
            complet={
              compteurs.parRubrique.s2.remplis === compteurs.parRubrique.s2.total
            }
          >
            {estPublic ? (
              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-unite-cap"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.uniteCapacite")}
                  </Label>
                  <Input
                    id="cfg-unite-cap"
                    value={etat.infos.unite_capacite ?? ""}
                    placeholder={t("champs.uniteCapacitePlaceholder")}
                    onChange={(e) => majInfo("unite_capacite", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-cap-projet"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.capaciteProjet")}
                  </Label>
                  <Input
                    id="cfg-cap-projet"
                    value={etat.infos.capacite_projet ?? ""}
                    placeholder={t("champs.capaciteProjetPlaceholder")}
                    onChange={(e) => majInfo("capacite_projet", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-cap-terme"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.capaciteTerme")}
                  </Label>
                  <Input
                    id="cfg-cap-terme"
                    value={etat.infos.capacite_terme ?? ""}
                    placeholder={t("champs.capaciteTermePlaceholder")}
                    onChange={(e) => majInfo("capacite_terme", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-lits" className="text-xs font-semibold text-neutral-700">
                    {t("champs.lits")}
                  </Label>
                  <Input
                    id="cfg-lits"
                    value={etat.infos.lits ?? ""}
                    placeholder={t("champs.litsPlaceholder")}
                    onChange={(e) => majInfo("lits", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-sup-ha" className="text-xs font-semibold text-neutral-700">
                    {t("champs.superficieHa")}
                  </Label>
                  <Input
                    id="cfg-sup-ha"
                    value={etat.infos.superficie_ha ?? ""}
                    placeholder={t("champs.superficieHaPlaceholder")}
                    onChange={(e) => majInfo("superficie_ha", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-surf-batie"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.surfaceBatie")}
                  </Label>
                  <Input
                    id="cfg-surf-batie"
                    value={etat.infos.surface_batie ?? ""}
                    placeholder={t("champs.surfaceBatiePlaceholder")}
                    onChange={(e) => majInfo("surface_batie", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-surf-batie-prive"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.surfaceBatie")}
                  </Label>
                  <Input
                    id="cfg-surf-batie-prive"
                    value={etat.infos.surface_batie ?? ""}
                    placeholder={t("champs.surfaceBatiePlaceholder")}
                    onChange={(e) => majInfo("surface_batie", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-terrain-m2"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.terrainM2")}
                  </Label>
                  <Input
                    id="cfg-terrain-m2"
                    value={etat.infos.terrain_m2 ?? ""}
                    placeholder={t("champs.terrainM2Placeholder")}
                    onChange={(e) => majInfo("terrain_m2", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-niveaux" className="text-xs font-semibold text-neutral-700">
                    {t("champs.niveaux")}
                  </Label>
                  <Input
                    id="cfg-niveaux"
                    value={etat.infos.niveaux ?? ""}
                    placeholder={t("champs.niveauxPlaceholder")}
                    onChange={(e) => majInfo("niveaux", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-usage" className="text-xs font-semibold text-neutral-700">
                    {t("champs.usage")}
                  </Label>
                  <Input
                    id="cfg-usage"
                    value={etat.infos.usage ?? ""}
                    placeholder={t("champs.usagePlaceholder")}
                    onChange={(e) => majInfo("usage", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-perimetre" className="text-xs font-semibold text-neutral-700">
                {t("champs.perimetre")}
              </Label>
              <Textarea
                id="cfg-perimetre"
                rows={2}
                value={etat.infos.perimetre ?? ""}
                placeholder={t("champs.perimetrePlaceholder")}
                onChange={(e) => majInfo("perimetre", e.target.value)}
                disabled={!peutModifier || enCours}
              />
            </div>

            {estPublic && (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="cfg-offre-formation"
                  className="text-xs font-semibold text-neutral-700"
                >
                  {t("champs.offreFormation")}
                </Label>
                <Textarea
                  id="cfg-offre-formation"
                  rows={2}
                  value={etat.infos.offre_formation ?? ""}
                  placeholder={t("champs.offreFormationPlaceholder")}
                  onChange={(e) => majInfo("offre_formation", e.target.value)}
                  disabled={!peutModifier || enCours}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-impacts" className="text-xs font-semibold text-neutral-700">
                {t("champs.impacts")}
              </Label>
              <Textarea
                id="cfg-impacts"
                rows={3}
                value={etat.impactsTexte}
                placeholder={t("champs.impactsPlaceholder")}
                onChange={(e) => majChamp("impactsTexte", e.target.value)}
                disabled={!peutModifier || enCours}
              />
            </div>
          </CarteRubrique>

          {/* 3. CALENDRIER, BUDGET ET PIÈCES */}
          <CarteRubrique
            id="s3"
            numero={3}
            titre={t("rubriques.s3.titre")}
            sousTitre={t("rubriques.s3.sousTitre")}
            compteur={t("compteurRubrique", compteurs.parRubrique.s3)}
            complet={
              compteurs.parRubrique.s3.remplis === compteurs.parRubrique.s3.total
            }
          >
            <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-neutral-700">
                  {t("champs.dateSituation")}
                </Label>
                <SelecteurDate
                  valeur={etat.infos.date_situation ?? ""}
                  onChange={(val) => majInfo("date_situation", val)}
                  placeholder={tCreation("champDateChoisir")}
                  disabled={!peutModifier || enCours}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-neutral-700">
                  {t("champs.dateDebutPrevue")}
                </Label>
                <SelecteurDate
                  valeur={etat.dateDebutPrevue}
                  onChange={(val) => majChamp("dateDebutPrevue", val)}
                  placeholder={tCreation("champDateChoisir")}
                  disabled={!peutModifier || enCours || verrouDates.debut}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-neutral-700">
                  {t("champs.dateFinPrevue")}
                </Label>
                <SelecteurDate
                  valeur={etat.dateFinPrevue}
                  onChange={(val) => majChamp("dateFinPrevue", val)}
                  placeholder={tCreation("champDateChoisir")}
                  disabled={!peutModifier || enCours || verrouDates.fin}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-neutral-700">
                  {t("champs.dateDebutReelle")}
                </Label>
                <SelecteurDate
                  valeur={etat.dateDebutReelle}
                  onChange={(val) => majChamp("dateDebutReelle", val)}
                  placeholder={tCreation("champDateChoisir")}
                  disabled={!peutModifier || enCours}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-neutral-700">
                  {t("champs.dateFinReelle")}
                </Label>
                <SelecteurDate
                  valeur={etat.dateFinReelle}
                  onChange={(val) => majChamp("dateFinReelle", val)}
                  placeholder={tCreation("champDateChoisir")}
                  disabled={!peutModifier || enCours}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="cfg-duree-contrat"
                  className="text-xs font-semibold text-neutral-700"
                >
                  {t("champs.dureeContrat")}
                </Label>
                <Input
                  id="cfg-duree-contrat"
                  value={etat.infos.duree_contrat ?? ""}
                  placeholder={t("champs.dureeContratPlaceholder")}
                  onChange={(e) => majInfo("duree_contrat", e.target.value)}
                  disabled={!peutModifier || enCours}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cfg-reprog" className="text-xs font-semibold text-neutral-700">
                {t("champs.reprogrammation")}
              </Label>
              <Input
                id="cfg-reprog"
                value={etat.infos.reprogrammation ?? ""}
                placeholder={t("champs.reprogrammationPlaceholder")}
                onChange={(e) => majInfo("reprogrammation", e.target.value)}
                disabled={!peutModifier || enCours}
              />
            </div>

            {voitMontants && (
              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-cout" className="text-xs font-semibold text-neutral-700">
                    {t("champs.cout")}
                  </Label>
                  <Input
                    id="cfg-cout"
                    value={etat.infos.cout ?? ""}
                    placeholder={t("champs.coutPlaceholder")}
                    onChange={(e) => majInfo("cout", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <ChampSelect
                  id="cfg-devise"
                  label={t("champs.devise")}
                  valeur={etat.infos.devise ?? "FCFA"}
                  placeholder={t("selectionner")}
                  disabled={!peutModifier || enCours}
                  options={CLES_DEVISES.map((cle) => ({
                    cle,
                    libelle: t(`options.devises.${cle}`),
                  }))}
                  onChange={(val) => majInfo("devise", val || "FCFA")}
                />

                {etat.infos.devise && etat.infos.devise !== "FCFA" && (
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="cfg-taux-change"
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {t("champs.tauxChange")}
                    </Label>
                    <Input
                      id="cfg-taux-change"
                      value={etat.infos.taux_change ?? ""}
                      placeholder={t("champs.tauxChangePlaceholder")}
                      onChange={(e) => majInfo("taux_change", e.target.value)}
                      disabled={!peutModifier || enCours}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-budget-contractuel"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.budgetContractuel")}
                  </Label>
                  <Input
                    id="cfg-budget-contractuel"
                    value={etat.infos.budget_contractuel ?? ""}
                    placeholder={t("champs.budgetContractuelPlaceholder")}
                    onChange={(e) => majInfo("budget_contractuel", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                {estPublic && (
                  <ChampSelect
                    id="cfg-regime"
                    label={t("champs.regime")}
                    valeur={etat.infos.regime ?? ""}
                    placeholder={t("selectionner")}
                    disabled={!peutModifier || enCours}
                    options={CLES_REGIMES.map((cle) => ({
                      cle,
                      libelle: t(`options.regimes.${cle}`),
                    }))}
                    onChange={(val) => majInfo("regime", val)}
                  />
                )}
              </div>
            )}

            {/* Ordre de service de démarrage & Contrats */}
            <div className="grid grid-cols-2 gap-4 border-0 border-t border-solid border-neutral-200 pt-4 max-sm:grid-cols-1">
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-neutral-700">
                  {tCreation("sectionOrdreService")}
                </Label>
                {projet.ordreService && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-solid border-neutral-200 bg-neutral-50 px-3 py-2">
                    <span className="truncate text-xs font-medium text-neutral-800">
                      {projet.ordreService.nom}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={async () => {
                        try {
                          const blob = await telechargerOrdreServiceProjet(projet.id);
                          const lien = document.createElement("a");
                          lien.href = URL.createObjectURL(blob);
                          lien.download =
                            projet.ordreService?.nom || `ordre-service-${projet.reference}`;
                          lien.click();
                          URL.revokeObjectURL(lien.href);
                        } catch (err) {
                          const cause = err as ErreurApi;
                          toast.error(cause.message || t("erreurEnregistrement"));
                        }
                      }}
                    >
                      <FileDown className="size-3.5" aria-hidden="true" />
                      {tCreation("telechargerOrdreService")}
                    </Button>
                  </div>
                )}
                {peutModifier && (
                  <ZoneDepotFichiers
                    fichiers={nouvelOs}
                    onChange={setNouvelOs}
                    name="ordre_service_config"
                    accept={FORMAT_CONTRAT}
                    maximum={1}
                    refuser={motifRefusContrat}
                    consigne={tCreation("consigneOrdreService", {
                      taille: formaterTailleFichier(TAILLE_MAX_CONTRAT),
                    })}
                    disabled={enCours}
                  />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-neutral-700">
                  {tCreation("sectionContrat")}
                </Label>
                {projet.contrats.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {projet.contrats.map((contrat) => (
                      <div
                        key={contrat.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-solid border-neutral-200 bg-neutral-50 px-3 py-1.5"
                      >
                        <span className="truncate text-xs font-medium text-neutral-800">
                          {contrat.nom}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={async () => {
                            try {
                              const blob = await telechargerContratProjet(projet.id, contrat.id);
                              const lien = document.createElement("a");
                              lien.href = URL.createObjectURL(blob);
                              lien.download = contrat.nom || `contrat-${projet.reference}`;
                              lien.click();
                              URL.revokeObjectURL(lien.href);
                            } catch (err) {
                              const cause = err as ErreurApi;
                              toast.error(cause.message || t("erreurEnregistrement"));
                            }
                          }}
                        >
                          <FileDown className="size-3.5" aria-hidden="true" />
                          {tCreation("telechargerOrdreService")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {peutModifier && (
                  <ZoneDepotFichiers
                    fichiers={nouveauxContrats}
                    onChange={setNouveauxContrats}
                    name="contrats_config"
                    accept={FORMAT_CONTRAT}
                    multiple
                    maximum={NOMBRE_MAX_CONTRATS}
                    refuser={motifRefusContrat}
                    consigne={tCreation("consigneContrats", {
                      taille: formaterTailleFichier(TAILLE_MAX_CONTRAT),
                      max: NOMBRE_MAX_CONTRATS,
                    })}
                    disabled={enCours}
                  />
                )}
              </div>
            </div>
          </CarteRubrique>

          {/* 4. FINANCEMENT */}
          <CarteRubrique
            id="s4"
            numero={4}
            titre={t("rubriques.s4.titre")}
            sousTitre={t("rubriques.s4.sousTitre")}
            compteur={t("compteurRubrique", compteurs.parRubrique.s4)}
            complet={
              compteurs.parRubrique.s4.remplis === compteurs.parRubrique.s4.total
            }
          >
            {estPublic ? (
              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <ChampSelect
                  id="cfg-mode-fin"
                  label={t("champs.modeFin")}
                  valeur={etat.infos.mode_fin ?? ""}
                  placeholder={t("selectionner")}
                  disabled={!peutModifier || enCours}
                  options={CLES_MODES_FIN.map((cle) => ({
                    cle,
                    libelle: t(`options.modesFin.${cle}`),
                  }))}
                  onChange={(val) => majInfo("mode_fin", val)}
                />

                <ChampSelect
                  id="cfg-statut-fin"
                  label={t("champs.statutFin")}
                  valeur={etat.infos.statut_fin ?? ""}
                  placeholder={t("selectionner")}
                  disabled={!peutModifier || enCours}
                  options={CLES_STATUTS_FIN.map((cle) => ({
                    cle,
                    libelle: t(`options.statutsFin.${cle}`),
                  }))}
                  onChange={(val) => majInfo("statut_fin", val)}
                />

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-etat-imp"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.etatImputation")}
                  </Label>
                  <Input
                    id="cfg-etat-imp"
                    value={etat.infos.etat_imputation ?? ""}
                    placeholder={t("champs.etatImputationPlaceholder")}
                    onChange={(e) => majInfo("etat_imputation", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-etat-eff"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.etatEffectif")}
                  </Label>
                  <Input
                    id="cfg-etat-eff"
                    value={etat.infos.etat_effectif ?? ""}
                    placeholder={t("champs.etatEffectifPlaceholder")}
                    onChange={(e) => majInfo("etat_effectif", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-etat-dec"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.etatDecaissement")}
                  </Label>
                  <Input
                    id="cfg-etat-dec"
                    value={etat.infos.etat_decaissement ?? ""}
                    placeholder={t("champs.etatDecaissementPlaceholder")}
                    onChange={(e) => majInfo("etat_decaissement", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-proc" className="text-xs font-semibold text-neutral-700">
                    {t("champs.procedure")}
                  </Label>
                  <Input
                    id="cfg-proc"
                    value={etat.infos.procedure ?? ""}
                    placeholder={t("champs.procedurePlaceholder")}
                    onChange={(e) => majInfo("procedure", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="col-span-full flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-texte-app"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.texteApplicable")}
                  </Label>
                  <Input
                    id="cfg-texte-app"
                    value={etat.infos.texte_applicable ?? ""}
                    placeholder={t("champs.texteApplicablePlaceholder")}
                    onChange={(e) => majInfo("texte_applicable", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="col-span-full flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-hist-fin"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.historique")}
                  </Label>
                  <Textarea
                    id="cfg-hist-fin"
                    rows={2}
                    value={etat.infos.historique ?? ""}
                    placeholder={t("champs.historiquePlaceholder")}
                    onChange={(e) => majInfo("historique", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <ChampSelect
                  id="cfg-source-fin"
                  label={t("champs.sourceFin")}
                  valeur={etat.infos.source_fin ?? ""}
                  placeholder={t("selectionner")}
                  disabled={!peutModifier || enCours}
                  options={CLES_SOURCES_FIN.map((cle) => ({
                    cle,
                    libelle: t(`options.sourcesFin.${cle}`),
                  }))}
                  onChange={(val) => majInfo("source_fin", val)}
                />

                <ChampSelect
                  id="cfg-statut-fin-prive"
                  label={t("champs.statutFin")}
                  valeur={etat.infos.statut_fin ?? ""}
                  placeholder={t("selectionner")}
                  disabled={!peutModifier || enCours}
                  options={CLES_STATUTS_FIN.map((cle) => ({
                    cle,
                    libelle: t(`options.statutsFin.${cle}`),
                  }))}
                  onChange={(val) => majInfo("statut_fin", val)}
                />

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cfg-etab" className="text-xs font-semibold text-neutral-700">
                    {t("champs.etablissement")}
                  </Label>
                  <Input
                    id="cfg-etab"
                    value={etat.infos.etablissement ?? ""}
                    placeholder={t("champs.etablissementPlaceholder")}
                    onChange={(e) => majInfo("etablissement", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <ChampSelect
                  id="cfg-contract"
                  label={t("champs.contractualisation")}
                  valeur={etat.infos.contractualisation ?? ""}
                  placeholder={t("selectionner")}
                  disabled={!peutModifier || enCours}
                  options={CLES_CONTRACTUALISATIONS.map((cle) => ({
                    cle,
                    libelle: t(`options.contractualisations.${cle}`),
                  }))}
                  onChange={(val) => majInfo("contractualisation", val)}
                />

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-etat-eff-prive"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.etatEffectif")}
                  </Label>
                  <Input
                    id="cfg-etat-eff-prive"
                    value={etat.infos.etat_effectif ?? ""}
                    placeholder={t("champs.etatEffectifPlaceholder")}
                    onChange={(e) => majInfo("etat_effectif", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-etat-dec-prive"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.etatDecaissement")}
                  </Label>
                  <Input
                    id="cfg-etat-dec-prive"
                    value={etat.infos.etat_decaissement ?? ""}
                    placeholder={t("champs.etatDecaissementPlaceholder")}
                    onChange={(e) => majInfo("etat_decaissement", e.target.value)}
                    disabled={!peutModifier || enCours}
                  />
                </div>
              </div>
            )}

            {/* Tableau Bailleurs / Conventions de financement */}
            <div className="flex flex-col gap-2 border-0 border-t border-solid border-neutral-200 pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-800">
                  {t("tableaux.bailleurs.titre")}
                </span>
                {peutModifier && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      majInfo("bailleurs", [
                        ...bailleurs,
                        {
                          org: "",
                          type: "",
                          signature: "",
                          limite: "",
                          effectif: "",
                          decaisse: "",
                        },
                      ])
                    }
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t("ajouterLigne")}
                  </Button>
                )}
              </div>
              {bailleurs.length === 0 ? (
                <p className="m-0 rounded-md border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-500">
                  {t("aucuneLigne")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-0 border-b border-solid border-neutral-200 bg-neutral-50 text-left font-semibold text-neutral-700">
                        <th className="p-2">{t("tableaux.bailleurs.org")}</th>
                        <th className="p-2">{t("tableaux.bailleurs.type")}</th>
                        <th className="p-2">{t("tableaux.bailleurs.signature")}</th>
                        <th className="p-2">{t("tableaux.bailleurs.limite")}</th>
                        <th className="p-2">{t("tableaux.bailleurs.effectif")}</th>
                        <th className="p-2">{t("tableaux.bailleurs.decaisse")}</th>
                        {peutModifier && <th className="w-10 p-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {bailleurs.map((ligne, idx) => {
                        const majLigne = (cle: keyof BailleurProjet, val: string) => {
                          const copie = [...bailleurs];
                          copie[idx] = { ...copie[idx], [cle]: val };
                          majInfo("bailleurs", copie);
                        };
                        return (
                          <tr
                            key={idx}
                            className="border-0 border-b border-solid border-neutral-100 last:border-b-0"
                          >
                            <td className="p-1.5">
                              <Input
                                value={ligne.org}
                                onChange={(e) => majLigne("org", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.type}
                                onChange={(e) => majLigne("type", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                type="date"
                                value={ligne.signature}
                                onChange={(e) => majLigne("signature", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                type="date"
                                value={ligne.limite}
                                onChange={(e) => majLigne("limite", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.effectif}
                                onChange={(e) => majLigne("effectif", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.decaisse}
                                onChange={(e) => majLigne("decaisse", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            {peutModifier && (
                              <td className="p-1.5 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("supprimerLigne")}
                                  onClick={() =>
                                    majInfo(
                                      "bailleurs",
                                      bailleurs.filter((_, i) => i !== idx),
                                    )
                                  }
                                >
                                  <Trash2 className="size-3.5 text-erreur" aria-hidden="true" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CarteRubrique>

          {/* 5. FONCIER, AUTORISATIONS ET ÉTUDES */}
          <CarteRubrique
            id="s5"
            numero={5}
            titre={t("rubriques.s5.titre")}
            sousTitre={t("rubriques.s5.sousTitre")}
            compteur={t("compteurRubrique", compteurs.parRubrique.s5)}
            complet={
              compteurs.parRubrique.s5.remplis === compteurs.parRubrique.s5.total
            }
          >
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <ChampSelect
                id="cfg-dispo"
                label={t("champs.disponibilite")}
                valeur={etat.infos.disponibilite ?? ""}
                placeholder={t("selectionner")}
                disabled={!peutModifier || enCours}
                options={CLES_DISPONIBILITES.map((cle) => ({
                  cle,
                  libelle: t(`options.disponibilites.${cle}`),
                }))}
                onChange={(val) => majInfo("disponibilite", val)}
              />

              <ChampSelect
                id="cfg-delim"
                label={t("champs.delimitation")}
                valeur={etat.infos.delimitation ?? ""}
                placeholder={t("selectionner")}
                disabled={!peutModifier || enCours}
                options={CLES_DELIMITATIONS.map((cle) => ({
                  cle,
                  libelle: t(`options.delimitations.${cle}`),
                }))}
                onChange={(val) => majInfo("delimitation", val)}
              />

              {estPublic ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="cfg-purge-tot"
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {t("champs.purgeTotal")}
                    </Label>
                    <Input
                      id="cfg-purge-tot"
                      value={etat.infos.purge_total ?? ""}
                      placeholder={t("champs.purgeTotalPlaceholder")}
                      onChange={(e) => majInfo("purge_total", e.target.value)}
                      disabled={!peutModifier || enCours}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="cfg-purge-eng"
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {t("champs.purgeEngage")}
                    </Label>
                    <Input
                      id="cfg-purge-eng"
                      value={etat.infos.purge_engage ?? ""}
                      placeholder={t("champs.purgeEngagePlaceholder")}
                      onChange={(e) => majInfo("purge_engage", e.target.value)}
                      disabled={!peutModifier || enCours}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="cfg-purge-paye"
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {t("champs.purgePaye")}
                    </Label>
                    <Input
                      id="cfg-purge-paye"
                      value={etat.infos.purge_paye ?? ""}
                      placeholder={t("champs.purgePayePlaceholder")}
                      onChange={(e) => majInfo("purge_paye", e.target.value)}
                      disabled={!peutModifier || enCours}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cfg-tf" className="text-xs font-semibold text-neutral-700">
                      {t("champs.titreFoncier")}
                    </Label>
                    <Input
                      id="cfg-tf"
                      value={etat.infos.titre_foncier ?? ""}
                      placeholder={t("champs.titreFoncierPlaceholder")}
                      onChange={(e) => majInfo("titre_foncier", e.target.value)}
                      disabled={!peutModifier || enCours}
                    />
                  </div>

                  <ChampSelect
                    id="cfg-permis-statut"
                    label={t("champs.permisStatut")}
                    valeur={etat.infos.permis_statut ?? ""}
                    placeholder={t("selectionner")}
                    disabled={!peutModifier || enCours}
                    options={CLES_PERMIS_STATUTS.map((cle) => ({
                      cle,
                      libelle: t(`options.permisStatuts.${cle}`),
                    }))}
                    onChange={(val) => majInfo("permis_statut", val)}
                  />

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="cfg-permis-num"
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {t("champs.permisNum")}
                    </Label>
                    <Input
                      id="cfg-permis-num"
                      value={etat.infos.permis_num ?? ""}
                      placeholder={t("champs.permisNumPlaceholder")}
                      onChange={(e) => majInfo("permis_num", e.target.value)}
                      disabled={!peutModifier || enCours}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Tableau Études */}
            <div className="flex flex-col gap-2 border-0 border-t border-solid border-neutral-200 pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-800">
                  {t("tableaux.etudes.titre")}
                </span>
                {peutModifier && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      majInfo("etudes", [
                        ...etudes,
                        {
                          nom: "",
                          statut: t("options.statutsEtude.en_cours"),
                          avancement: "",
                          prestataire: "",
                          montant: "",
                        },
                      ])
                    }
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t("ajouterLigne")}
                  </Button>
                )}
              </div>
              {etudes.length === 0 ? (
                <p className="m-0 rounded-md border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-500">
                  {t("aucuneLigne")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-0 border-b border-solid border-neutral-200 bg-neutral-50 text-left font-semibold text-neutral-700">
                        <th className="p-2">{t("tableaux.etudes.nom")}</th>
                        <th className="p-2">{t("tableaux.etudes.statut")}</th>
                        <th className="p-2">{t("tableaux.etudes.avancement")}</th>
                        <th className="p-2">{t("tableaux.etudes.prestataire")}</th>
                        <th className="p-2">{t("tableaux.etudes.montant")}</th>
                        {peutModifier && <th className="w-10 p-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {etudes.map((ligne, idx) => {
                        const majLigne = (cle: keyof EtudeProjet, val: string) => {
                          const copie = [...etudes];
                          copie[idx] = { ...copie[idx], [cle]: val };
                          majInfo("etudes", copie);
                        };
                        return (
                          <tr
                            key={idx}
                            className="border-0 border-b border-solid border-neutral-100 last:border-b-0"
                          >
                            <td className="p-1.5">
                              <Input
                                value={ligne.nom}
                                onChange={(e) => majLigne("nom", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <select
                                value={ligne.statut}
                                onChange={(e) => majLigne("statut", e.target.value)}
                                disabled={!peutModifier}
                                className={cn(CHAMP_SELECT, "h-8 py-1 text-xs")}
                              >
                                {CLES_STATUTS_ETUDE.map((cle) => (
                                  <option key={cle} value={t(`options.statutsEtude.${cle}`)}>
                                    {t(`options.statutsEtude.${cle}`)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.avancement}
                                onChange={(e) => majLigne("avancement", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.prestataire}
                                onChange={(e) => majLigne("prestataire", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.montant}
                                onChange={(e) => majLigne("montant", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            {peutModifier && (
                              <td className="p-1.5 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("supprimerLigne")}
                                  onClick={() =>
                                    majInfo(
                                      "etudes",
                                      etudes.filter((_, i) => i !== idx),
                                    )
                                  }
                                >
                                  <Trash2 className="size-3.5 text-erreur" aria-hidden="true" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CarteRubrique>

          {/* 6. AVANCEMENT GLOBAL */}
          <CarteRubrique
            id="s6"
            numero={6}
            titre={t("rubriques.s6.titre")}
            sousTitre={t("rubriques.s6.sousTitre")}
            compteur={t("compteurRubrique", compteurs.parRubrique.s6)}
            complet={
              compteurs.parRubrique.s6.remplis === compteurs.parRubrique.s6.total
            }
          >
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-taux" className="text-xs font-semibold text-neutral-700">
                  {t("champs.tauxSaisi")}
                </Label>
                <Input
                  id="cfg-taux"
                  value={etat.infos.taux_saisi ?? ""}
                  placeholder={String(projet.avancementReel)}
                  onChange={(e) => majInfo("taux_saisi", e.target.value)}
                  disabled={!peutModifier || enCours}
                />
                <span className="text-[11px] text-neutral-500">
                  {t("champs.tauxSaisiAide", { valeur: projet.avancementReel })}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="cfg-etat-narratif"
                className="text-xs font-semibold text-neutral-700"
              >
                {t("champs.etatNarratif")}
              </Label>
              <Textarea
                id="cfg-etat-narratif"
                rows={3}
                value={etat.infos.etat_narratif ?? ""}
                placeholder={t("champs.etatNarratifPlaceholder")}
                onChange={(e) => majInfo("etat_narratif", e.target.value)}
                disabled={!peutModifier || enCours}
              />
            </div>

            {/* Tableau Lots / Composantes */}
            <div className="flex flex-col gap-2 border-0 border-t border-solid border-neutral-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-800">
                  {t("tableaux.lots.titre")}
                </span>
                {peutModifier && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={importEnCours}
                      onClick={() => void importerLotsDepuisDecoupage()}
                    >
                      {importEnCours ? (
                        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <FolderTree className="size-3.5" aria-hidden="true" />
                      )}
                      {t("importerDecoupage")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        majInfo("lots", [
                          ...lots,
                          {
                            code: `L-${String(lots.length + 1).padStart(2, "0")}`,
                            nom: "",
                            montant: "",
                            avancement: "0",
                            statut: t("options.statutsLot.en_cours"),
                            prestataire: "",
                          },
                        ])
                      }
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      {t("ajouterLigne")}
                    </Button>
                  </div>
                )}
              </div>
              {lots.length === 0 ? (
                <p className="m-0 rounded-md border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-500">
                  {t("aucuneLigne")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-0 border-b border-solid border-neutral-200 bg-neutral-50 text-left font-semibold text-neutral-700">
                        <th className="w-24 p-2">{t("tableaux.lots.code")}</th>
                        <th className="p-2">{t("tableaux.lots.nom")}</th>
                        <th className="p-2">{t("tableaux.lots.montant")}</th>
                        <th className="w-28 p-2">{t("tableaux.lots.avancement")}</th>
                        <th className="p-2">{t("tableaux.lots.statut")}</th>
                        <th className="p-2">{t("tableaux.lots.prestataire")}</th>
                        {peutModifier && <th className="w-10 p-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {lots.map((ligne, idx) => {
                        const majLigne = (cle: keyof LotComplementaireProjet, val: string) => {
                          const copie = [...lots];
                          copie[idx] = { ...copie[idx], [cle]: val };
                          majInfo("lots", copie);
                        };
                        return (
                          <tr
                            key={idx}
                            className="border-0 border-b border-solid border-neutral-100 last:border-b-0"
                          >
                            <td className="p-1.5">
                              <Input
                                value={ligne.code}
                                onChange={(e) => majLigne("code", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 font-mono text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.nom}
                                onChange={(e) => majLigne("nom", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.montant}
                                onChange={(e) => majLigne("montant", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.avancement}
                                onChange={(e) => majLigne("avancement", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <select
                                value={ligne.statut}
                                onChange={(e) => majLigne("statut", e.target.value)}
                                disabled={!peutModifier}
                                className={cn(CHAMP_SELECT, "h-8 py-1 text-xs")}
                              >
                                {CLES_STATUTS_LOT.map((cle) => (
                                  <option key={cle} value={t(`options.statutsLot.${cle}`)}>
                                    {t(`options.statutsLot.${cle}`)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.prestataire}
                                onChange={(e) => majLigne("prestataire", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            {peutModifier && (
                              <td className="p-1.5 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("supprimerLigne")}
                                  onClick={() =>
                                    majInfo(
                                      "lots",
                                      lots.filter((_, i) => i !== idx),
                                    )
                                  }
                                >
                                  <Trash2 className="size-3.5 text-erreur" aria-hidden="true" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CarteRubrique>

          {/* 7. RISQUES, BLOCAGES ET RECOMMANDATIONS */}
          <CarteRubrique
            id="s7"
            numero={7}
            titre={t("rubriques.s7.titre")}
            sousTitre={t("rubriques.s7.sousTitre")}
            compteur={t("compteurRubrique", compteurs.parRubrique.s7)}
            complet={
              compteurs.parRubrique.s7.remplis === compteurs.parRubrique.s7.total
            }
          >
            {/* Tableau Difficultés */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-800">
                  {t("tableaux.difficultes.titre")}
                </span>
                {peutModifier && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      majInfo("difficultes", [
                        ...difficultes,
                        {
                          desc: "",
                          gravite: t("options.gravites.majeure"),
                          date: "",
                          statut: t("options.statutsDifficulte.ouvert"),
                        },
                      ])
                    }
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t("ajouterLigne")}
                  </Button>
                )}
              </div>
              {difficultes.length === 0 ? (
                <p className="m-0 rounded-md border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-500">
                  {t("aucuneLigne")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-0 border-b border-solid border-neutral-200 bg-neutral-50 text-left font-semibold text-neutral-700">
                        <th className="p-2">{t("tableaux.difficultes.desc")}</th>
                        <th className="w-44 p-2">{t("tableaux.difficultes.gravite")}</th>
                        <th className="w-36 p-2">{t("tableaux.difficultes.date")}</th>
                        <th className="w-44 p-2">{t("tableaux.difficultes.statut")}</th>
                        {peutModifier && <th className="w-10 p-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {difficultes.map((ligne, idx) => {
                        const majLigne = (cle: keyof DifficulteProjet, val: string) => {
                          const copie = [...difficultes];
                          copie[idx] = { ...copie[idx], [cle]: val };
                          majInfo("difficultes", copie);
                        };
                        return (
                          <tr
                            key={idx}
                            className="border-0 border-b border-solid border-neutral-100 last:border-b-0"
                          >
                            <td className="p-1.5">
                              <Input
                                value={ligne.desc}
                                onChange={(e) => majLigne("desc", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <select
                                value={ligne.gravite}
                                onChange={(e) => majLigne("gravite", e.target.value)}
                                disabled={!peutModifier}
                                className={cn(CHAMP_SELECT, "h-8 py-1 text-xs")}
                              >
                                {CLES_GRAVITES.map((cle) => (
                                  <option key={cle} value={t(`options.gravites.${cle}`)}>
                                    {t(`options.gravites.${cle}`)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-1.5">
                              <Input
                                type="date"
                                value={ligne.date}
                                onChange={(e) => majLigne("date", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <select
                                value={ligne.statut}
                                onChange={(e) => majLigne("statut", e.target.value)}
                                disabled={!peutModifier}
                                className={cn(CHAMP_SELECT, "h-8 py-1 text-xs")}
                              >
                                {CLES_STATUTS_DIFFICULTE.map((cle) => (
                                  <option key={cle} value={t(`options.statutsDifficulte.${cle}`)}>
                                    {t(`options.statutsDifficulte.${cle}`)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            {peutModifier && (
                              <td className="p-1.5 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("supprimerLigne")}
                                  onClick={() =>
                                    majInfo(
                                      "difficultes",
                                      difficultes.filter((_, i) => i !== idx),
                                    )
                                  }
                                >
                                  <Trash2 className="size-3.5 text-erreur" aria-hidden="true" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tableau Recommandations */}
            <div className="flex flex-col gap-2 border-0 border-t border-solid border-neutral-200 pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-800">
                  {t("tableaux.recos.titre")}
                </span>
                {peutModifier && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      majInfo("recos", [...recos, { texte: "", dest: "", echeance: "" }])
                    }
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t("ajouterLigne")}
                  </Button>
                )}
              </div>
              {recos.length === 0 ? (
                <p className="m-0 rounded-md border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-500">
                  {t("aucuneLigne")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-0 border-b border-solid border-neutral-200 bg-neutral-50 text-left font-semibold text-neutral-700">
                        <th className="p-2">{t("tableaux.recos.texte")}</th>
                        <th className="w-56 p-2">{t("tableaux.recos.dest")}</th>
                        <th className="w-36 p-2">{t("tableaux.recos.echeance")}</th>
                        {peutModifier && <th className="w-10 p-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {recos.map((ligne, idx) => {
                        const majLigne = (cle: keyof RecommandationProjet, val: string) => {
                          const copie = [...recos];
                          copie[idx] = { ...copie[idx], [cle]: val };
                          majInfo("recos", copie);
                        };
                        return (
                          <tr
                            key={idx}
                            className="border-0 border-b border-solid border-neutral-100 last:border-b-0"
                          >
                            <td className="p-1.5">
                              <Input
                                value={ligne.texte}
                                onChange={(e) => majLigne("texte", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.dest}
                                onChange={(e) => majLigne("dest", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                type="date"
                                value={ligne.echeance}
                                onChange={(e) => majLigne("echeance", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            {peutModifier && (
                              <td className="p-1.5 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("supprimerLigne")}
                                  onClick={() =>
                                    majInfo(
                                      "recos",
                                      recos.filter((_, i) => i !== idx),
                                    )
                                  }
                                >
                                  <Trash2 className="size-3.5 text-erreur" aria-hidden="true" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CarteRubrique>

          {/* 8. ÉQUIPE ET INTERVENANTS */}
          <CarteRubrique
            id="s8"
            numero={8}
            titre={t("rubriques.s8.titre")}
            sousTitre={t("rubriques.s8.sousTitre")}
            compteur={t("compteurRubrique", compteurs.parRubrique.s8)}
            complet={
              compteurs.parRubrique.s8.remplis === compteurs.parRubrique.s8.total
            }
          >
            {estPublic && (
              <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-coord-nom"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.coordNom")}
                  </Label>
                  <Input
                    id="cfg-coord-nom"
                    value={coordonnateur.nom}
                    placeholder={t("champs.coordNomPlaceholder")}
                    onChange={(e) =>
                      majInfo("coordonnateur", { ...coordonnateur, nom: e.target.value })
                    }
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-coord-tel"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.coordTel")}
                  </Label>
                  <Input
                    id="cfg-coord-tel"
                    value={coordonnateur.tel}
                    placeholder={t("champs.coordTelPlaceholder")}
                    onChange={(e) =>
                      majInfo("coordonnateur", { ...coordonnateur, tel: e.target.value })
                    }
                    disabled={!peutModifier || enCours}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="cfg-coord-email"
                    className="text-xs font-semibold text-neutral-700"
                  >
                    {t("champs.coordEmail")}
                  </Label>
                  <Input
                    id="cfg-coord-email"
                    value={coordonnateur.email}
                    placeholder={t("champs.coordEmailPlaceholder")}
                    onChange={(e) =>
                      majInfo("coordonnateur", { ...coordonnateur, email: e.target.value })
                    }
                    disabled={!peutModifier || enCours}
                  />
                </div>
              </div>
            )}

            {/* Tableau Intervenants externes */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-800">
                  {t("tableaux.intervenants.titre")}
                </span>
                {peutModifier && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      majInfo("intervenants", [
                        ...intervenants,
                        { role: "", org: "", lot: "" },
                      ])
                    }
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t("ajouterLigne")}
                  </Button>
                )}
              </div>
              {intervenants.length === 0 ? (
                <p className="m-0 rounded-md border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-500">
                  {t("aucuneLigne")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-0 border-b border-solid border-neutral-200 bg-neutral-50 text-left font-semibold text-neutral-700">
                        <th className="p-2">{t("tableaux.intervenants.role")}</th>
                        <th className="p-2">{t("tableaux.intervenants.org")}</th>
                        <th className="p-2">{t("tableaux.intervenants.lot")}</th>
                        {peutModifier && <th className="w-10 p-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {intervenants.map((ligne, idx) => {
                        const majLigne = (
                          cle: keyof IntervenantExterneProjet,
                          val: string,
                        ) => {
                          const copie = [...intervenants];
                          copie[idx] = { ...copie[idx], [cle]: val };
                          majInfo("intervenants", copie);
                        };
                        return (
                          <tr
                            key={idx}
                            className="border-0 border-b border-solid border-neutral-100 last:border-b-0"
                          >
                            <td className="p-1.5">
                              <Input
                                value={ligne.role}
                                onChange={(e) => majLigne("role", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.org}
                                onChange={(e) => majLigne("org", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.lot}
                                onChange={(e) => majLigne("lot", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            {peutModifier && (
                              <td className="p-1.5 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("supprimerLigne")}
                                  onClick={() =>
                                    majInfo(
                                      "intervenants",
                                      intervenants.filter((_, i) => i !== idx),
                                    )
                                  }
                                >
                                  <Trash2 className="size-3.5 text-erreur" aria-hidden="true" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CarteRubrique>

          {/* 9. PROCHAINES ÉTAPES ET NOTE DU CHEF DE PROJET */}
          <CarteRubrique
            id="s9"
            numero={9}
            titre={t("rubriques.s9.titre")}
            sousTitre={t("rubriques.s9.sousTitre")}
            compteur={t("compteurRubrique", compteurs.parRubrique.s9)}
            complet={
              compteurs.parRubrique.s9.remplis === compteurs.parRubrique.s9.total
            }
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-800">
                  {t("tableaux.etapes.titre")}
                </span>
                {peutModifier && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      majInfo("etapes", [
                        ...etapes,
                        { etape: "", echeance: "", resp: "" },
                      ])
                    }
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t("ajouterLigne")}
                  </Button>
                )}
              </div>
              {etapes.length === 0 ? (
                <p className="m-0 rounded-md border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-500">
                  {t("aucuneLigne")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-solid border-neutral-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-0 border-b border-solid border-neutral-200 bg-neutral-50 text-left font-semibold text-neutral-700">
                        <th className="p-2">{t("tableaux.etapes.etape")}</th>
                        <th className="w-40 p-2">{t("tableaux.etapes.echeance")}</th>
                        <th className="w-56 p-2">{t("tableaux.etapes.resp")}</th>
                        {peutModifier && <th className="w-10 p-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {etapes.map((ligne, idx) => {
                        const majLigne = (cle: keyof EtapeAvenirProjet, val: string) => {
                          const copie = [...etapes];
                          copie[idx] = { ...copie[idx], [cle]: val };
                          majInfo("etapes", copie);
                        };
                        return (
                          <tr
                            key={idx}
                            className="border-0 border-b border-solid border-neutral-100 last:border-b-0"
                          >
                            <td className="p-1.5">
                              <Input
                                value={ligne.etape}
                                onChange={(e) => majLigne("etape", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                type="date"
                                value={ligne.echeance}
                                onChange={(e) => majLigne("echeance", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <Input
                                value={ligne.resp}
                                onChange={(e) => majLigne("resp", e.target.value)}
                                disabled={!peutModifier}
                                className="h-8 text-xs"
                              />
                            </td>
                            {peutModifier && (
                              <td className="p-1.5 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("supprimerLigne")}
                                  onClick={() =>
                                    majInfo(
                                      "etapes",
                                      etapes.filter((_, i) => i !== idx),
                                    )
                                  }
                                >
                                  <Trash2 className="size-3.5 text-erreur" aria-hidden="true" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 border-0 border-t border-solid border-neutral-200 pt-4">
              <Label htmlFor="cfg-note-cp" className="text-xs font-semibold text-neutral-700">
                {t("champs.noteCp")}
              </Label>
              <Textarea
                id="cfg-note-cp"
                rows={3}
                value={etat.infos.note_cp ?? ""}
                placeholder={t("champs.noteCpPlaceholder")}
                onChange={(e) => majInfo("note_cp", e.target.value)}
                disabled={!peutModifier || enCours}
              />
            </div>
          </CarteRubrique>
        </div>
      </div>

      {fichePdf.indicateur}
    </div>
  );
}

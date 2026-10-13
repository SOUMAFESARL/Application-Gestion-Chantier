"use client";

import { ArrowRight, FileBarChart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Bouton } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import {
  moisRecents,
  numeroSemaine,
  periodeClose,
  periodeValide,
  semainesRecentes,
} from "@/features/chantier";
import type { Journal, Periode, TypePeriode } from "@/features/chantier";
import { formaterJourMoisNumerique } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BLOC, BLOC_CORPS, BLOC_ENTETE, BLOC_SOUS_TITRE, BLOC_TITRE } from "./classes";

const TYPES: TypePeriode[] = ["HEBDOMADAIRE", "MENSUELLE", "PERSONNALISEE"];
const NOMBRE_SEMAINES = 8;
const NOMBRE_MOIS = 3;

/** Le lien d'une synthèse : tout ce qui la décrit tient dans l'adresse, qui se partage. */
export function lienSynthese(projetId: string, periode: Periode): string {
  const parametres = new URLSearchParams({
    projet: projetId,
    type: periode.type,
    debut: periode.debut,
    fin: periode.fin,
  });
  return `/rapports/synthese?${parametres.toString()}`;
}

/**
 * L'onglet « Synthèses périodiques » — le bouton « Rapport périodique » de la
 * maquette, et son sélecteur de période.
 *
 * Trois niveaux, comme l'a fixé le client : la semaine (S39), le mois, ou une
 * période libre. La synthèse n'est pas saisie : elle s'agrège à la demande
 * des rapports journaliers du chantier, et se signe CT → CP.
 */
export function SynthesesPeriodiques({ journal }: { journal: Journal }) {
  const t = useTranslations("journal.syntheses");
  const format = useFormatter();
  const router = useRouter();

  const chantiers = useMemo(() => {
    const connus = new Map<string, { id: string; nom: string; reference: string }>();
    for (const entree of journal.entrees) {
      connus.set(entree.chantier.projetId, {
        id: entree.chantier.projetId,
        nom: entree.chantier.projetNom,
        reference: entree.chantier.projetReference,
      });
    }
    return [...connus.values()].sort((a, b) => a.nom.localeCompare(b.nom));
  }, [journal]);

  const semaines = useMemo(() => semainesRecentes(journal.aujourdhui, NOMBRE_SEMAINES), [journal.aujourdhui]);
  const mois = useMemo(() => moisRecents(journal.aujourdhui, NOMBRE_MOIS), [journal.aujourdhui]);
  // La semaine proposée d'office est la dernière close : c'est celle qu'on synthétise.
  const semaineClose = semaines.findIndex((semaine) => periodeClose(semaine, journal.aujourdhui));

  const [projetId, setProjetId] = useState(chantiers[0]?.id ?? "");
  const [type, setType] = useState<TypePeriode>("HEBDOMADAIRE");
  const [rangSemaine, setRangSemaine] = useState(String(Math.max(0, semaineClose)));
  const [rangMois, setRangMois] = useState("0");
  const [debut, setDebut] = useState(semaines[Math.max(0, semaineClose)]?.debut ?? "");
  const [fin, setFin] = useState(semaines[Math.max(0, semaineClose)]?.fin ?? "");

  const libelleSemaine = (periode: Periode) =>
    t("semaine", {
      numero: numeroSemaine(periode.debut),
      debut: formaterJourMoisNumerique(periode.debut),
      fin: formaterJourMoisNumerique(periode.fin),
    });
  const libelleMois = (periode: Periode) =>
    format.dateTime(new Date(`${periode.debut}T00:00:00Z`), { month: "long", year: "numeric", timeZone: "UTC" });

  const periode: Periode | null =
    type === "HEBDOMADAIRE"
      ? (semaines[Number(rangSemaine)] ?? null)
      : type === "MENSUELLE"
        ? (mois[Number(rangMois)] ?? null)
        : periodeValide(debut, fin, journal.aujourdhui)
          ? { type, debut, fin }
          : null;

  const derniereSemaine = semaines[Math.max(0, semaineClose)];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <section className={cn(BLOC, "lg:col-span-3")} aria-labelledby="titre-generer">
        <header className={BLOC_ENTETE}>
          <div>
            <h2 id="titre-generer" className={cn(BLOC_TITRE, "m-0")}>
              {t("genererTitre")}
            </h2>
            <p className={cn(BLOC_SOUS_TITRE, "m-0")}>{t("genererSousTitre")}</p>
          </div>
        </header>

        <form
          className={cn(BLOC_CORPS, "flex flex-col gap-4 pt-4")}
          onSubmit={(evenement) => {
            evenement.preventDefault();
            if (projetId && periode) router.push(lienSynthese(projetId, periode));
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="synthese-chantier" className="text-sm font-medium text-neutral-700">
              {t("chantier")}
            </label>
            <Select value={projetId} onValueChange={setProjetId}>
              <SelectTrigger id="synthese-chantier" className="h-[var(--input-height-md)] w-full bg-card">
                <SelectValue placeholder={t("chantierPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {chantiers.map((chantier) => (
                  <SelectItem key={chantier.id} value={chantier.id}>
                    {chantier.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 p-0 text-sm font-medium text-neutral-700">{t("typePeriode")}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TYPES.map((candidat) => (
                <label
                  key={candidat}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 transition-colors",
                    type === candidat
                      ? "border-primary-500 bg-primary-50"
                      : "border-neutral-200 bg-neutral-0 hover:border-neutral-300",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <input
                      type="radio"
                      name="type-periode"
                      value={candidat}
                      checked={type === candidat}
                      onChange={() => setType(candidat)}
                      className="m-0 accent-primary-500"
                    />
                    {t(`type.${candidat}`)}
                  </span>
                  <span className="text-xs text-neutral-500">{t(`typeAide.${candidat}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {type === "HEBDOMADAIRE" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="synthese-semaine" className="text-sm font-medium text-neutral-700">
                {t("semaineChoix")}
              </label>
              <Select value={rangSemaine} onValueChange={setRangSemaine}>
                <SelectTrigger id="synthese-semaine" className="h-[var(--input-height-md)] w-full bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {semaines.map((semaine, rang) => (
                    <SelectItem key={semaine.debut} value={String(rang)}>
                      {libelleSemaine(semaine)}
                      {!periodeClose(semaine, journal.aujourdhui) && t("suffixeEnCours")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "MENSUELLE" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="synthese-mois" className="text-sm font-medium text-neutral-700">
                {t("moisChoix")}
              </label>
              <Select value={rangMois} onValueChange={setRangMois}>
                <SelectTrigger id="synthese-mois" className="h-[var(--input-height-md)] w-full bg-card capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mois.map((periodeMois, rang) => (
                    <SelectItem key={periodeMois.debut} value={String(rang)} className="capitalize">
                      {libelleMois(periodeMois)}
                      {!periodeClose(periodeMois, journal.aujourdhui) && t("suffixeEnCours")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "PERSONNALISEE" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-neutral-700">{t("du")}</span>
                <SelecteurDate
                  valeur={debut}
                  onChange={setDebut}
                  placeholder={t("datePlaceholder")}
                  auPlusTard={journal.aujourdhui}
                  aria-label={t("du")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-neutral-700">{t("au")}</span>
                <SelecteurDate
                  valeur={fin}
                  onChange={setFin}
                  placeholder={t("datePlaceholder")}
                  auPlusTot={debut || undefined}
                  aria-label={t("au")}
                />
              </div>
              {!periode && debut && fin && (
                <p role="alert" className="m-0 text-xs text-erreur sm:col-span-2">
                  {t("periodeInvalide")}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Bouton
              type="submit"
              variante="primaire"
              iconeGauche={<FileBarChart className="size-4" aria-hidden="true" />}
              disabled={!projetId || !periode}
            >
              {t("generer")}
            </Bouton>
          </div>
        </form>
      </section>

      <section className={cn(BLOC, "lg:col-span-2")} aria-labelledby="titre-raccourcis">
        <header className={BLOC_ENTETE}>
          <div>
            <h2 id="titre-raccourcis" className={cn(BLOC_TITRE, "m-0")}>
              {t("raccourcisTitre")}
            </h2>
            <p className={cn(BLOC_SOUS_TITRE, "m-0")}>
              {derniereSemaine ? libelleSemaine(derniereSemaine) : null}
            </p>
          </div>
        </header>
        <ul className={cn(BLOC_CORPS, "m-0 flex list-none flex-col")}>
          {derniereSemaine &&
            chantiers.map((chantier) => (
              <li key={chantier.id} className="border-b border-neutral-100 last:border-b-0">
                <Link
                  href={lienSynthese(chantier.id, derniereSemaine)}
                  className="flex items-center justify-between gap-3 py-3 text-inherit no-underline hover:text-primary-600"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-neutral-900">{chantier.nom}</span>
                    <span className="text-xs text-neutral-500">
                      {t("raccourci", { numero: numeroSemaine(derniereSemaine.debut), reference: chantier.reference })}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import { Badge, Bouton, EtatVide, Pagination } from "@/components/ui";
import { MenuExport } from "@/components/ui/export-tableau";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { FiltreTableau, RechercheTableau, TAILLE_DE_PAGE_LISTE } from "@/components/ui/tableau-liste";
import {
  activitesDuProjet,
  avancementPondere,
  budgetLot,
  filtrerLots,
  largeurJauge,
  paginerLots,
  periodeLot,
  statutActivite,
  statutsActivitesPresents,
} from "@/features/projets/regles";
import type { Activite, Lot, StatutActivite } from "@/features/projets/types";
import {
  ABSENT,
  formaterDate,
  formaterJourMoisNumerique,
  formaterMontantCourt,
  formaterQuantite,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { BADGE_STATUT, BLOC, CERCLE_PISTE, CERCLE_REMPLI } from "./classes";

interface Props {
  lots: Lot[];
  recherche: string;
  onRecherche: (recherche: string) => void;
  statut: StatutActivite | "";
  onStatut: (statut: StatutActivite | "") => void;
  activiteChoisieId: string | null;
  onChoisirActivite: (id: string) => void;
  onAjouterLot: () => void;
  onAjouterActivite: (lotId?: string) => void;
}

const CELLULE = "border-0 border-b border-solid border-neutral-100 px-2.5 py-2.5 align-middle";
const ENTETE =
  "border-0 border-b border-solid border-neutral-200 bg-neutral-50 px-2.5 py-2.5 text-left text-xs font-semibold tracking-wider whitespace-nowrap text-neutral-600 uppercase";

/**
 * L'arbre du chantier : un lot par ligne de regroupement, ses activités
 * dessous.
 *
 * **Ce n'est pas un `TableauListe`** (règle 9) : celui-ci pagine des lignes
 * indépendantes, avec une case à cocher chacune. Ici, on ne sélectionne pas
 * plusieurs lignes — on en choisit une pour son détail — et la pagination
 * (dix lignes, comme les listes) répète l'en-tête d'un lot coupé entre deux
 * pages (`paginerLots`) : aucune activité ne s'y lit sans son lot. D'où la
 * primitive `table` nue, mais la barre d'outils et la pagination communes.
 *
 * La recherche et le statut gardent chaque activité sous son lot
 * (`filtrerLots`) ; les lots se replient un par un, et tous se redéplient
 * pendant un filtre — un résultat caché dans un lot replié serait perdu.
 */
export function StructureLots({
  lots,
  recherche,
  onRecherche,
  statut,
  onStatut,
  activiteChoisieId,
  onChoisirActivite,
  onAjouterLot,
  onAjouterActivite,
}: Props) {
  const t = useTranslations("projets.lotsActivites");
  const [replies, setReplies] = useState<Set<string>>(() => new Set());

  const [page, setPage] = useState(0);

  const lotsFiltres = useMemo(() => filtrerLots(lots, recherche, statut), [lots, recherche, statut]);
  const filtreActif = recherche.trim() !== "" || statut !== "";
  const statutsPresents = useMemo(() => statutsActivitesPresents(lots), [lots]);

  const pages = useMemo(
    () =>
      paginerLots(lotsFiltres, (lotId) => !filtreActif && replies.has(lotId), TAILLE_DE_PAGE_LISTE),
    [lotsFiltres, filtreActif, replies],
  );
  // Un lot replié ou un filtre peut raccourcir la liste sous la page lue.
  const pageCourante = Math.min(page, Math.max(pages.length - 1, 0));
  const troncons = pages[pageCourante] ?? [];

  function rechercher(valeur: string) {
    setPage(0);
    onRecherche(valeur);
  }

  function filtrerStatut(valeur: StatutActivite | "") {
    setPage(0);
    onStatut(valeur);
  }

  function basculer(lotId: string) {
    setReplies((anciens) => {
      const suivants = new Set(anciens);
      if (suivants.has(lotId)) suivants.delete(lotId);
      else suivants.add(lotId);
      return suivants;
    });
  }

  function surToucheLigne(evenement: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (evenement.key === "Enter" || evenement.key === " ") {
      evenement.preventDefault();
      onChoisirActivite(id);
    }
  }

  /**
   * L'export aplatit l'arbre : une ligne par activité, son lot en première
   * colonne — un tableur ne sait pas replier. Il suit la recherche et le
   * statut, pas les lots repliés : replier range l'écran, ça ne filtre rien.
   */
  const lotsParId = useMemo(() => new Map(lots.map((lot) => [lot.id, lot])), [lots]);
  const activitesExport = useMemo(() => activitesDuProjet(lotsFiltres), [lotsFiltres]);
  const exporter = useMemo<ExportTableau<Activite>>(
    () => ({
      titre: t("titre"),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        {
          entete: t("export.lot"),
          valeur: (activite) => {
            const lot = lotsParId.get(activite.lotId);
            return lot ? t("libelleLot", { code: lot.code, nom: lot.nom }) : null;
          },
        },
        { entete: t("export.code"), valeur: (activite) => activite.code },
        { entete: t("export.activite"), valeur: (activite) => activite.libelle },
        { entete: t("export.quantite"), valeur: (activite) => activite.quantitePrevue },
        {
          entete: t("export.unite"),
          valeur: (activite) => (activite.unite ? t(`unites.${activite.unite}`) : null),
        },
        { entete: t("export.debut"), valeur: (activite) => formaterDate(activite.dateDebutPrevue) },
        { entete: t("export.fin"), valeur: (activite) => formaterDate(activite.dateFinPrevue) },
        {
          entete: t("colonnes.budget"),
          valeur: (activite) =>
            activite.budget === null ? null : Math.round(activite.budget / 100),
        },
        { entete: t("export.avancement"), valeur: (activite) => activite.avancement },
        {
          entete: t("colonnes.statut"),
          valeur: (activite) => t(`statutActivite.${statutActivite(activite)}`),
        },
        { entete: t("panneau.equipe"), valeur: (activite) => activite.equipe?.nom },
        {
          entete: t("export.critique"),
          valeur: (activite) => (activite.surCheminCritique ? t("export.oui") : t("export.non")),
        },
      ],
    }),
    [t, lotsParId],
  );

  const boutonLot = (
    <Bouton
      variante="secondaire"
      taille="sm"
      aria-label={t("actionLotLibelle")}
      iconeGauche={<Plus size={16} aria-hidden="true" />}
      onClick={onAjouterLot}
    >
      {t("actionLot")}
    </Bouton>
  );

  if (lots.length === 0) {
    return (
      <div className={BLOC}>
        <EtatVide titre={t("aucunLotTitre")} description={t("aucunLot")} action={boutonLot} />
      </div>
    );
  }

  return (
    <div className={cn(BLOC, "min-w-0 overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <RechercheTableau
          valeur={recherche}
          onChangement={rechercher}
          libelle={t("recherche")}
          placeholder={t("recherchePlaceholder")}
        />
        <FiltreTableau
          valeur={statut}
          onChangement={filtrerStatut}
          libelle={t("filtreStatut")}
          libelleTous={t("tousStatuts")}
          options={statutsPresents.map((valeur) => ({
            valeur,
            libelle: t(`statutActivite.${valeur}`),
          }))}
        />
        <span className="flex-1 max-sm:hidden" />
        <MenuExport exporter={exporter} lignes={activitesExport} compact />
        {boutonLot}
        <Bouton
          variante="primaire"
          taille="sm"
          aria-label={t("actionActiviteLibelle")}
          iconeGauche={<Plus size={16} aria-hidden="true" />}
          onClick={() => onAjouterActivite()}
        >
          {t("actionActivite")}
        </Bouton>
      </div>

      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={ENTETE}>
                {t("colonnes.lotActivite")}
              </th>
              <th scope="col" className={cn(ENTETE, "text-right")}>
                {t("colonnes.quantite")}
              </th>
              <th scope="col" className={ENTETE}>
                {t("colonnes.dates")}
              </th>
              <th scope="col" className={cn(ENTETE, "text-right")}>
                {t("colonnes.budget")}
              </th>
              <th scope="col" className={ENTETE}>
                {t("colonnes.avancement")}
              </th>
              <th scope="col" className={ENTETE}>
                {t("colonnes.statut")}
              </th>
            </tr>
          </thead>
          <tbody>
            {lotsFiltres.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-neutral-500">
                  {t("aucunResultat")}
                </td>
              </tr>
            )}

            {troncons.map(({ lot, activites }) => {
              const replie = !filtreActif && replies.has(lot.id);
              const periode = periodeLot(lot);
              const avancement = avancementPondere(lot.activites);
              return (
                <Fragment key={lot.id}>
                  <tr className="bg-neutral-50">
                    <td
                      className={cn(
                        CELLULE,
                        "border-l-4 border-l-primary font-semibold text-neutral-900",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => basculer(lot.id)}
                        aria-expanded={!replie}
                        aria-label={replie ? t("deplier", { nom: lot.nom }) : t("replier", { nom: lot.nom })}
                        className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left font-semibold text-neutral-900"
                      >
                        {replie ? (
                          <ChevronRight size={16} aria-hidden="true" className="text-neutral-500" />
                        ) : (
                          <ChevronDown size={16} aria-hidden="true" className="text-neutral-500" />
                        )}
                        <span className="font-mono text-xs text-neutral-500">{lot.code}</span>
                        <span>{lot.nom}</span>
                        <span className="font-normal text-neutral-500">
                          {t("nombreActivites", { nombre: lot.activites.length })}
                        </span>
                      </button>
                    </td>
                    <td className={CELLULE} />
                    <td className={cn(CELLULE, "whitespace-nowrap text-neutral-500")}>
                      <Periode debut={periode.debut} fin={periode.fin} />
                    </td>
                    <td className={cn(CELLULE, "text-right font-semibold whitespace-nowrap tabular-nums text-neutral-900")}>
                      {formaterMontantCourt(budgetLot(lot), { avecDevise: false })}
                    </td>
                    <td className={CELLULE}>
                      <Avancement valeur={avancement} />
                    </td>
                    <td className={CELLULE} />
                  </tr>

                  {!replie && lot.activites.length === 0 && (
                    <tr>
                      <td colSpan={6} className={cn(CELLULE, "pl-10 text-neutral-500")}>
                        {t("lotSansActivite")}{" "}
                        <button
                          type="button"
                          onClick={() => onAjouterActivite(lot.id)}
                          className="cursor-pointer border-0 bg-transparent p-0 font-medium text-primary-600 underline-offset-2 hover:underline"
                        >
                          {t("ajouterDansLot")}
                        </button>
                      </td>
                    </tr>
                  )}

                  {!replie &&
                    activites.map((activite) => (
                      <LigneActivite
                        key={activite.id}
                        activite={activite}
                        choisie={activite.id === activiteChoisieId}
                        onChoisir={() => onChoisirActivite(activite.id)}
                        onTouche={(evenement) => surToucheLigne(evenement, activite.id)}
                      />
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages.length > 1 && (
        <div className="border-0 border-t border-solid border-neutral-200 px-4 py-3">
          <Pagination
            pageIndex={pageCourante}
            nombrePages={pages.length}
            peutPagePrecedente={pageCourante > 0}
            peutPageSuivante={pageCourante < pages.length - 1}
            allerPremierePage={() => setPage(0)}
            allerPagePrecedente={() => setPage(pageCourante - 1)}
            allerPageSuivante={() => setPage(pageCourante + 1)}
            allerDernierePage={() => setPage(pages.length - 1)}
          />
        </div>
      )}
    </div>
  );
}

function LigneActivite({
  activite,
  choisie,
  onChoisir,
  onTouche,
}: {
  activite: Activite;
  choisie: boolean;
  onChoisir: () => void;
  onTouche: (evenement: KeyboardEvent<HTMLTableRowElement>) => void;
}) {
  const t = useTranslations("projets.lotsActivites");
  const statut = statutActivite(activite);

  return (
    <tr
      tabIndex={0}
      aria-current={choisie ? "true" : undefined}
      onClick={onChoisir}
      onKeyDown={onTouche}
      className={cn(
        "cursor-pointer outline-none transition-colors focus-visible:bg-primary-50",
        choisie ? "bg-primary-50" : "hover:bg-neutral-50",
      )}
    >
      <td className={cn(CELLULE, "pl-10")}>
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-neutral-500">{activite.code}</span>
          <span className="text-neutral-900">{activite.libelle}</span>
          {activite.surCheminCritique && (
            <span title={t("critiqueTitre")}>
              <Badge variante="avertissement">{t("critique")}</Badge>
            </span>
          )}
        </span>
      </td>
      <td className={cn(CELLULE, "text-right whitespace-nowrap tabular-nums text-neutral-800")}>
        <Quantite activite={activite} />
      </td>
      <td className={cn(CELLULE, "whitespace-nowrap text-neutral-700")}>
        <Periode debut={activite.dateDebutPrevue} fin={activite.dateFinPrevue} />
      </td>
      <td className={cn(CELLULE, "text-right whitespace-nowrap tabular-nums text-neutral-800")}>
        {formaterMontantCourt(activite.budget, { avecDevise: false })}
      </td>
      <td className={CELLULE}>
        <Avancement valeur={activite.avancement} />
      </td>
      <td className={CELLULE}>
        <Badge variante={BADGE_STATUT[statut]}>{t(`statutActivite.${statut}`)}</Badge>
      </td>
    </tr>
  );
}

/** « 220 ml », ou un tiret pour une activité suivie sans quantité. */
export function Quantite({ activite }: { activite: Activite }) {
  const t = useTranslations("projets.lotsActivites");
  if (activite.quantitePrevue === null || activite.unite === null) return <>{ABSENT}</>;
  return (
    <>
      {t("quantiteAvecUnite", {
        quantite: formaterQuantite(activite.quantitePrevue),
        unite: t(`unites.${activite.unite}`),
      })}
    </>
  );
}

/** « 01/07 → 15/07 » */
export function Periode({ debut, fin }: { debut: string | null; fin: string | null }) {
  const t = useTranslations("projets.lotsActivites");
  if (!debut && !fin) return <>{ABSENT}</>;
  return (
    <>
      {t("periode", {
        debut: formaterJourMoisNumerique(debut),
        fin: formaterJourMoisNumerique(fin),
      })}
    </>
  );
}

/** Le rayon de l'anneau dans un repère de 24 × 24, trait compris. */
const RAYON_CERCLE = 10;
const CIRCONFERENCE = 2 * Math.PI * RAYON_CERCLE;

/** Un anneau qui se remplit dans le sens horaire, le pourcentage à côté. */
function Avancement({ valeur }: { valeur: number }) {
  const t = useTranslations("projets.lotsActivites");
  const rempli = (largeurJauge(valeur) / 100) * CIRCONFERENCE;
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 24 24" className="size-7 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="12" cy="12" r={RAYON_CERCLE} fill="none" strokeWidth="3" className={CERCLE_PISTE} />
        <circle
          cx="12"
          cy="12"
          r={RAYON_CERCLE}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${rempli} ${CIRCONFERENCE}`}
          className={CERCLE_REMPLI}
        />
      </svg>
      <span className="text-xs whitespace-nowrap tabular-nums text-neutral-700">
        {t("pourcentage", { valeur })}
      </span>
    </span>
  );
}

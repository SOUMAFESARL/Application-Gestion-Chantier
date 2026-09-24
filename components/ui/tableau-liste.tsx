"use client";

import type { RowData } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Bouton } from "./Bouton";
import { Carte } from "./Carte";
import { DataTable } from "./data-table";
import type { ColonneDonnees } from "./data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/**
 * Le tableau de liste de la plateforme — un seul gabarit, dans les deux
 * espaces.
 *
 * Il est né de la liste des chantiers (`app/(app)/projets/ListeProjets.tsx`),
 * qui en est la référence visuelle : une carte collée au tableau, une barre
 * d'outils (recherche, filtres, remise à zéro), une case à cocher par ligne et
 * une pagination de dix lignes. Chaque liste recopiait ce montage à la main,
 * et chacune finissait par avoir sa largeur de recherche, sa hauteur de
 * champ, ses filtres en boutons ou en listes : **un tableau de liste passe
 * désormais par ici**, dans l'espace entreprise comme dans le back-office.
 *
 * Ce qui reste à l'écran : ses colonnes, et ses critères. Le filtrage lui-même
 * n'est pas ici — il vit dans le `regles.ts` du domaine, comme
 * `filtrerProjets`.
 *
 * Il ne remplace ni `Tableau` (colonnes figées, tableau de bord pleine
 * largeur sans pagination) ni le `DataTable` nu des blocs courts d'une carte
 * (les cinq derniers abonnements) : ceux-là ne sont pas des listes à parcourir.
 */

/** Dix lignes : la hauteur d'un écran de bureau sans défilement du tableau. */
export const TAILLE_DE_PAGE_LISTE = 10;

/**
 * La carte colle le tableau à ses bords : les colonnes extrêmes portent la
 * gouttière — resserrée sous 640 px, comme celle de la page. La gauche revient
 * à la case à cocher, posée ici ; la droite à la dernière colonne de l'écran,
 * qui la pose dans son `meta.classe`.
 */
export const BORD_GAUCHE_TABLEAU = "pl-4 sm:pl-6";
export const BORD_DROIT_TABLEAU = "pr-4 text-right sm:pr-6";

/**
 * Radix réserve la valeur vide au placeholder : « aucun filtre » a donc
 * besoin d'une valeur à lui, traduite en `""` à l'aller comme au retour.
 */
const TOUS = "__tous__";

interface PropsTableauListe<T extends RowData> {
  colonnes: ColonneDonnees<T>[];
  /** Les lignes **déjà filtrées** par le domaine. */
  donnees: T[];
  cleLigne: (ligne: T, index: number) => string;
  messageVide: string;
  /** Les contrôles de la barre : `RechercheTableau`, puis les `FiltreTableau`. */
  outils?: ReactNode;
  /**
   * Remet les critères à zéro. Le bouton « Tout afficher » n'apparaît que si
   * `filtresActifs` : un filtre actif explique un tableau presque vide, et
   * c'est la sortie de secours de qui ne comprend pas pourquoi sa ligne a
   * disparu.
   */
  onReinitialiser?: () => void;
  filtresActifs?: boolean;
  /**
   * Une empreinte des critères. Elle sert de `key` au tableau : quand le
   * filtre change, la pagination revient à la première page — sans quoi un
   * filtre qui ramène trois lignes alors qu'on lisait la page 3 affiche un
   * tableau vide.
   */
  cleCriteres?: string;
  tailleDePage?: number;
}

export function TableauListe<T extends RowData>({
  colonnes,
  donnees,
  cleLigne,
  messageVide,
  outils,
  onReinitialiser,
  filtresActifs = false,
  cleCriteres,
  tailleDePage = TAILLE_DE_PAGE_LISTE,
}: PropsTableauListe<T>) {
  const t = useTranslations("dataTable");

  return (
    // `p-0` aux deux ruptures : le tableau va d'un bord à l'autre de la carte.
    <Carte className="overflow-hidden p-0 md:p-0">
      {outils && (
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-3 sm:px-6 sm:py-4">
          {outils}
          {onReinitialiser && filtresActifs && (
            <Bouton variante="ghost" taille="sm" onClick={onReinitialiser}>
              {t("reinitialiserFiltres")}
            </Bouton>
          )}
        </div>
      )}

      <DataTable
        key={cleCriteres}
        colonnes={colonnes}
        donnees={donnees}
        cleLigne={cleLigne}
        messageVide={messageVide}
        selectionnable
        classeSelection={BORD_GAUCHE_TABLEAU}
        tailleDePage={tailleDePage}
        className="[&_td]:py-3"
      />
    </Carte>
  );
}

interface PropsRechercheTableau {
  valeur: string;
  onChangement: (valeur: string) => void;
  /** Le nom accessible du champ — le placeholder n'en tient pas lieu. */
  libelle: string;
  placeholder: string;
}

/**
 * La recherche de la barre d'outils.
 *
 * Elle ne s'étire pas (`flex-1`) : une barre de 600 px pour une référence de
 * douze caractères repoussait les filtres contre le bord droit de la carte.
 * Elle prend la ligne sous 640 px, une largeur fixe au-delà.
 */
export function RechercheTableau({
  valeur,
  onChangement,
  libelle,
  placeholder,
}: PropsRechercheTableau) {
  return (
    <div className="relative flex w-full items-center sm:w-60">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 text-neutral-500"
        aria-hidden="true"
      />
      <input
        type="search"
        className={cn(
          "h-[var(--button-height-sm)] w-full rounded-md border border-neutral-300 bg-neutral-0",
          "pr-3 pl-9 text-sm text-neutral-800 placeholder:text-neutral-500",
          "focus:border-primary-500 focus:shadow-[var(--shadow-focus)] focus:outline-none",
        )}
        placeholder={placeholder}
        aria-label={libelle}
        value={valeur}
        onChange={(evenement) => onChangement(evenement.target.value)}
      />
    </div>
  );
}

export interface OptionFiltre<V extends string> {
  valeur: V;
  libelle: string;
}

interface PropsFiltreTableau<V extends string> {
  /** `""` : aucun filtre. */
  valeur: V | "";
  onChangement: (valeur: V | "") => void;
  /** Le nom accessible de la liste (« Filtrer par statut »). */
  libelle: string;
  /** La première entrée, qui retire le filtre (« Tous les statuts »). */
  libelleTous: string;
  /**
   * Ne proposer que ce que la liste contient réellement : une valeur
   * qu'aucune ligne ne porte ne donnerait qu'un tableau vide.
   */
  options: OptionFiltre<V>[];
}

/**
 * Un filtre de la barre d'outils.
 *
 * `Select` de shadcn plutôt que le `<select>` natif : la liste native est
 * dessinée par le système, donc ni la charte ni la largeur du champ ne
 * l'atteignent — sur Android elle s'ouvre en plein écran, et le chevron y est
 * celui du navigateur. Et un `Select` plutôt que des boutons-bascules : ceux-ci
 * ne tiennent plus sur une ligne passé trois valeurs.
 */
export function FiltreTableau<V extends string>({
  valeur,
  onChangement,
  libelle,
  libelleTous,
  options,
}: PropsFiltreTableau<V>) {
  return (
    <Select
      value={valeur || TOUS}
      onValueChange={(choisie) => onChangement(choisie === TOUS ? "" : (choisie as V))}
    >
      <SelectTrigger
        size="sm"
        aria-label={libelle}
        className="min-w-0 flex-1 sm:min-w-44 sm:flex-none"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TOUS}>{libelleTous}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.valeur} value={option.valeur}>
            {option.libelle}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

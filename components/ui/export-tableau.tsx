"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useTranslations } from "next-intl";

import { telechargerCsv, versCsv } from "@/lib/export/csv";
import { telechargerPdf } from "@/lib/export/pdf";
import { ABSENT, formaterDate } from "@/lib/format";

import { Bouton } from "./Bouton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

/**
 * L'export d'un tableau en CSV et en PDF — **tout tableau du produit en a
 * un**. `TableauListe` l'exige (`exporter` n'y est pas facultatif) ; un
 * tableau qui ne passe pas par lui pose `MenuExport` dans sa barre d'outils.
 *
 * L'écran ne décrit que ses colonnes : l'intitulé, et la valeur d'une ligne.
 * Le reste — le nom daté du fichier, le sous-titre du PDF, les deux formats —
 * est le même partout, et vit ici.
 */

/** Une valeur de cellule. `null` sort vide. */
export type ValeurExport = string | number | null | undefined;

export interface ColonneExport<T> {
  entete: string;
  /**
   * La valeur **brute** plutôt que celle de l'écran : un montant en francs
   * entiers et non « 10,5M », une date complète, un libellé plutôt qu'un
   * badge. Un fichier se retrie et se recalcule ; un arrondi d'affichage s'y
   * cumule.
   */
  valeur: (ligne: T) => ValeurExport;
}

export interface ExportTableau<T> {
  /** Le titre du PDF : « Liste des projets ». */
  titre: string;
  /** La base du nom de fichier, sans date ni extension : `projets`. */
  nomFichier: string;
  colonnes: ColonneExport<T>[];
}

/**
 * Une cellule vide plutôt qu'un tiret : une cellule vide se trie et se somme
 * dans un tableur, « — » non. `ABSENT` est rattrapé ici, pour les colonnes qui
 * réutilisent un formateur d'affichage.
 */
function cellule(valeur: ValeurExport): string | number {
  if (valeur === null || valeur === undefined || valeur === ABSENT) return "";
  return valeur;
}

interface Props<T> {
  exporter: ExportTableau<T>;
  /**
   * Les lignes **filtrées**, toutes pages confondues : ce que l'utilisateur a
   * sous les yeux après sa recherche, pas seulement la page courante.
   */
  lignes: T[];
  /**
   * Réduit à son icône à toutes les largeurs : pour une barre déjà pleine,
   * où le libellé ferait passer le bouton d'ajout à la ligne. Le nom reste
   * porté par `aria-label` et l'infobulle.
   */
  compact?: boolean;
}

export function MenuExport<T>({ exporter, lignes, compact = false }: Props<T>) {
  const t = useTranslations("dataTable.export");

  function preparer() {
    const aujourdhui = new Date();
    return {
      entetes: exporter.colonnes.map((colonne) => colonne.entete),
      valeurs: lignes.map((ligne) => exporter.colonnes.map((colonne) => cellule(colonne.valeur(ligne)))),
      nomFichier: t("nomFichier", {
        base: exporter.nomFichier,
        date: aujourdhui.toISOString().slice(0, 10),
      }),
      date: formaterDate(aujourdhui),
    };
  }

  function exporterCsv() {
    const { entetes, valeurs, nomFichier } = preparer();
    telechargerCsv(versCsv([entetes, ...valeurs]), `${nomFichier}.csv`);
  }

  function exporterPdf() {
    const { entetes, valeurs, nomFichier, date } = preparer();
    void telechargerPdf({
      titre: exporter.titre,
      sousTitre: t("sousTitrePdf", { date, nombre: valeurs.length }),
      entetes,
      lignes: valeurs,
      nomFichier: `${nomFichier}.pdf`,
    });
  }

  // Réduit à son icône sous 640 px, comme les autres actions compactes.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Bouton
          variante="secondaire"
          taille="sm"
          aria-label={t("action")}
          title={compact ? t("action") : undefined}
          disabled={lignes.length === 0}
          iconeGauche={<Download size={16} aria-hidden="true" />}
          iconeDroite={
            compact ? undefined : (
              <ChevronDown size={16} aria-hidden="true" className="max-sm:hidden" />
            )
          }
          className={compact ? "gap-0 px-3" : "max-sm:gap-0 max-sm:px-3"}
        >
          {!compact && <span className="max-sm:hidden">{t("action")}</span>}
        </Bouton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={exporterCsv}>
          <FileSpreadsheet className="size-4" aria-hidden="true" />
          {t("csv")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={exporterPdf}>
          <FileText className="size-4" aria-hidden="true" />
          {t("pdf")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

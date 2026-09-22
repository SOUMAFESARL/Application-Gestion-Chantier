"use client";

import {
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import { Checkbox } from "./checkbox";
import { Pagination } from "./pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

/**
 * Data table shadcn — le tableau piloté par une définition de colonnes
 * (TanStack Table v9), posé sur les primitives `table.tsx`.
 *
 * **Volontairement sans barre de recherche ni tri.** Les fonctionnalités de
 * TanStack v9 se déclarent une par une (`tableFeatures`) : n'enregistrer ni
 * `rowSortingFeature` ni le filtrage n'est pas un oubli de câblage, c'est ce
 * qui garantit qu'aucun en-tête ne devient cliquable et qu'aucun état de tri
 * n'existe. Un tableau de cinq lignes déjà classées par le domaine n'a rien à
 * trier ; l'API v8 (`useReactTable` + `getCoreRowModel()`) ne s'applique plus
 * ici.
 *
 * **Il ne remplace pas `Tableau`** (colonnes figées, défilement horizontal,
 * états vides des grandes listes) : il sert les tableaux courts posés dans une
 * carte, là où `table.tsx` seul obligeait à réécrire l'entête à la main.
 */

/** Le typage de `meta` est porté par la table elle-même, pas par une fusion globale. */
export interface MetaColonne {
  /** Classes posées sur l'en-tête *et* les cellules : alignement, gouttière. */
  classe?: string;
}

export const FONCTIONNALITES_TABLEAU = tableFeatures({
  columnMeta: {} as MetaColonne,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
});

export type ColonneDonnees<T extends RowData> = ColumnDef<typeof FONCTIONNALITES_TABLEAU, T>;

/**
 * Le constructeur de colonnes typées d'un domaine.
 *
 * S'appelle au niveau module (`const colonne = aideColonnes<Client>()`), les
 * définitions étant ensuite mémorisées dans le composant — elles capturent
 * `t()`, donc elles dépendent de la langue.
 */
export function aideColonnes<T extends RowData>() {
  return createColumnHelper<typeof FONCTIONNALITES_TABLEAU, T>();
}

interface Props<T extends RowData> {
  colonnes: ColonneDonnees<T>[];
  donnees: T[];
  /** Sans elle, l'index de ligne fait office d'identifiant. */
  cleLigne?: (ligne: T, index: number) => string;
  /** Affiché à la place du corps quand il n'y a rien à montrer. */
  messageVide: string;
  className?: string;
  /** Nombre de lignes par page. Sans elle, le tableau reste sans pagination. */
  tailleDePage?: number;
  /** Ajoute une colonne de case à cocher en tête, pour une sélection multiple. */
  selectionnable?: boolean;
  /** Classes de la colonne de sélection injectée — la gouttière de bord lui revient désormais. */
  classeSelection?: string;
}

export function DataTable<T extends RowData>({
  colonnes,
  donnees,
  cleLigne,
  messageVide,
  className,
  tailleDePage,
  selectionnable,
  classeSelection,
}: Props<T>) {
  const t = useTranslations("dataTable");

  const colonnesEffectives = useMemo(() => {
    if (!selectionnable) return colonnes;

    const colonneSelection: ColonneDonnees<T> = {
      id: "selection",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(valeur) => table.toggleAllPageRowsSelected(valeur === true)}
          aria-label={t("selectionnerTout")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(valeur) => row.toggleSelected(valeur === true)}
          aria-label={t("selectionnerLigne")}
        />
      ),
      meta: { classe: cn("w-10 pr-0", classeSelection) },
    };

    return [colonneSelection, ...colonnes];
  }, [colonnes, selectionnable, classeSelection, t]);

  const table = useTable(
    {
      features: FONCTIONNALITES_TABLEAU,
      columns: colonnesEffectives,
      data: donnees,
      getRowId: cleLigne,
      enableRowSelection: selectionnable,
      initialState: tailleDePage ? { pagination: { pageIndex: 0, pageSize: tailleDePage } } : undefined,
    },
    (state) => ({ pagination: state.pagination, rowSelection: state.rowSelection }),
  );

  const lignes = tailleDePage ? table.getPaginatedRowModel().rows : table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      <Table className={className}>
        <TableHeader>
          {table.getHeaderGroups().map((groupe) => (
            <TableRow key={groupe.id} className="hover:bg-transparent">
              {groupe.headers.map((entete) => (
                <TableHead
                  key={entete.id}
                  className={cn(entete.column.columnDef.meta?.classe)}
                >
                  {entete.isPlaceholder ? null : <table.FlexRender header={entete} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {lignes.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={table.getAllLeafColumns().length}
                className="py-6 text-center text-sm text-neutral-600"
              >
                {messageVide}
              </TableCell>
            </TableRow>
          ) : (
            lignes.map((ligne) => (
              <TableRow key={ligne.id}>
                {ligne.getAllCells().map((cellule) => (
                  <TableCell
                    key={cellule.id}
                    className={cn(cellule.column.columnDef.meta?.classe)}
                  >
                    <table.FlexRender cell={cellule} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {tailleDePage && (
        <Pagination
          pageIndex={table.state.pagination.pageIndex}
          nombrePages={table.getPageCount()}
          peutPagePrecedente={table.getCanPreviousPage()}
          peutPageSuivante={table.getCanNextPage()}
          allerPremierePage={table.firstPage}
          allerPagePrecedente={table.previousPage}
          allerPageSuivante={table.nextPage}
          allerDernierePage={table.lastPage}
        />
      )}
    </div>
  );
}

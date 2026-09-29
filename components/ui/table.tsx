import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Primitive `table` de shadcn.
 *
 * **Elle ne remplace pas `Tableau`** (`components/ui/Tableau.tsx`), qui porte
 * les colonnes figées, le défilement horizontal et les états vides dont les
 * listes du produit ont besoin. Celle-ci est l'autre besoin : un tableau court
 * posé dans une carte, où la mise en page vient de l'écran. Les prendre l'un
 * pour l'autre coûterait à chaque fois une configuration de colonnes pour
 * cinq lignes.
 *
 * Un écart au fichier généré : le preflight de Tailwind étant coupé
 * (`app/globals.css`), `border-collapse` et l'alignement des cellules sont
 * posés explicitement — sans quoi le navigateur garde ses valeurs par défaut.
 *
 * La barre de défilement horizontale est fine et claire, comme celle de la
 * barre latérale : deux propriétés standard, pas de `::-webkit-scrollbar`.
 */

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto [scrollbar-width:thin] [scrollbar-color:var(--color-neutral-200)_transparent]"
    >
      <table
        data-slot="table"
        className={cn("w-full border-collapse caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:border-border", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-border bg-muted/50 font-medium", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border transition-colors hover:bg-primary-50/60 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 whitespace-nowrap px-3 text-left align-middle text-xs font-semibold text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("whitespace-nowrap px-3 py-3 align-middle", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};

"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Pagination icon-only — commune à `Tableau` et `DataTable`.
 *
 * Volontairement sans numéros de page cliquables : à la différence d'une
 * pagination de moteur de recherche, aucun des tableaux du produit n'a besoin
 * qu'on saute directement à la page 7 — seuls les bords (première/dernière) et
 * le pas à pas (précédente/suivante) ont un usage réel ici.
 */
interface Props {
  /** Page courante, base 0. */
  pageIndex: number;
  nombrePages: number;
  peutPagePrecedente: boolean;
  peutPageSuivante: boolean;
  allerPremierePage: () => void;
  allerPagePrecedente: () => void;
  allerPageSuivante: () => void;
  allerDernierePage: () => void;
  className?: string;
}

const BOUTON_ICONE = [
  "inline-flex size-[var(--button-height-sm)] shrink-0 cursor-pointer appearance-none items-center justify-center",
  "rounded-[var(--button-radius)] border border-neutral-200 bg-transparent text-neutral-700",
  "transition-colors not-disabled:hover:bg-neutral-100 not-disabled:hover:text-neutral-900",
  "disabled:cursor-not-allowed disabled:text-neutral-300",
].join(" ");

function BoutonPage({
  icone,
  libelle,
  ...reste
}: { icone: ReactNode; libelle: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={BOUTON_ICONE} aria-label={libelle} title={libelle} {...reste}>
      {icone}
    </button>
  );
}

/** Rien à paginer sur une seule page : le composant ne se rend pas. */
export function Pagination({
  pageIndex,
  nombrePages,
  peutPagePrecedente,
  peutPageSuivante,
  allerPremierePage,
  allerPagePrecedente,
  allerPageSuivante,
  allerDernierePage,
  className,
}: Props) {
  const t = useTranslations("pagination");

  if (nombrePages <= 1) return null;

  return (
    <nav
      aria-label={t("pageActuelle", { page: pageIndex + 1, total: nombrePages })}
      className={cn("flex items-center justify-between gap-4", className)}
    >
      <p className="text-sm text-neutral-600">
        {t("pageActuelle", { page: pageIndex + 1, total: nombrePages })}
      </p>
      <div className="flex items-center gap-1.5">
        <BoutonPage
          icone={<ChevronsLeft size={16} aria-hidden="true" />}
          libelle={t("premierePage")}
          onClick={allerPremierePage}
          disabled={!peutPagePrecedente}
        />
        <BoutonPage
          icone={<ChevronLeft size={16} aria-hidden="true" />}
          libelle={t("pagePrecedente")}
          onClick={allerPagePrecedente}
          disabled={!peutPagePrecedente}
        />
        <BoutonPage
          icone={<ChevronRight size={16} aria-hidden="true" />}
          libelle={t("pageSuivante")}
          onClick={allerPageSuivante}
          disabled={!peutPageSuivante}
        />
        <BoutonPage
          icone={<ChevronsRight size={16} aria-hidden="true" />}
          libelle={t("dernierePage")}
          onClick={allerDernierePage}
          disabled={!peutPageSuivante}
        />
      </div>
    </nav>
  );
}

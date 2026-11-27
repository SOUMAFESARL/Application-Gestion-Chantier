"use client";

import { FolderKanban, HardHat, Layers, ListChecks, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { EnTeteParametrage } from "../EnTeteParametrage";

const ONGLETS: {
  href: string;
  cle:
    | "ongletListes"
    | "ongletModeles"
    | "ongletModesExecution"
    | "ongletTypesProjet"
    | "ongletFonctionsEquipe";
  icone: typeof Layers;
}[] = [
  { href: "/admin/parametres/referentiels/listes", cle: "ongletListes", icone: ListChecks },
  { href: "/admin/parametres/referentiels/modeles", cle: "ongletModeles", icone: Layers },
  {
    href: "/admin/parametres/referentiels/modes-execution",
    cle: "ongletModesExecution",
    icone: Wrench,
  },
  {
    href: "/admin/parametres/referentiels/types-projet",
    cle: "ongletTypesProjet",
    icone: FolderKanban,
  },
  {
    href: "/admin/parametres/referentiels/fonctions-equipe",
    cle: "ongletFonctionsEquipe",
    icone: HardHat,
  },
];

export function NavigationReferentielsPlateforme() {
  const t = useTranslations("administration.parametres.referentiels");
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-4">
      <EnTeteParametrage section="referentiels" />
      <nav
        aria-label={t("titre")}
        className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200 pb-3"
      >
        {ONGLETS.map(({ href, cle, icone: Icone }) => {
          const actif = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={actif ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                actif
                  ? "bg-primary-600 text-neutral-0 shadow-xs"
                  : "bg-neutral-100/70 text-neutral-700 hover:bg-neutral-200/70 hover:text-neutral-900",
              )}
            >
              <Icone className="size-4 shrink-0" aria-hidden="true" />
              <span>{t(cle)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

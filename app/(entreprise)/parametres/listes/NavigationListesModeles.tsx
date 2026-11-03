"use client";

import { FolderKanban, Layers, ListChecks, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { cn } from "@/lib/utils";

const ONGLETS_LISTES_MODELES = [
  {
    href: "/parametres/listes",
    cleNavigation: "listesValeurs",
    icone: ListChecks,
  },
  {
    href: "/parametres/listes/modeles",
    cleNavigation: "listesModeles",
    icone: Layers,
  },
  {
    href: "/parametres/listes/modes-execution",
    cleNavigation: "listesModesExecution",
    icone: Wrench,
  },
  {
    href: "/parametres/listes/types-projet",
    cleNavigation: "listesTypesProjet",
    icone: FolderKanban,
  },
] as const;

export function NavigationListesModeles({
  titre,
  description,
}: {
  titre: string;
  description: string;
}) {
  const pathname = usePathname();
  const tNav = useTranslations("tableauDeBord.navigation");

  const actifHref =
    ONGLETS_LISTES_MODELES.find(
      ({ href }) => href !== "/parametres/listes" && pathname.startsWith(href),
    )?.href ?? "/parametres/listes";

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage titre={titre} description={description} />
      <nav
        aria-label={tNav("listes")}
        className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200 pb-3"
      >
        {ONGLETS_LISTES_MODELES.map(({ href, cleNavigation, icone: Icone }) => {
          const actif = actifHref === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                actif
                  ? "bg-primary-600 text-neutral-0 shadow-xs"
                  : "bg-neutral-100/70 text-neutral-700 hover:bg-neutral-200/70 hover:text-neutral-900",
              )}
            >
              <Icone className="size-4 shrink-0" aria-hidden="true" />
              <span>{tNav(cleNavigation)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

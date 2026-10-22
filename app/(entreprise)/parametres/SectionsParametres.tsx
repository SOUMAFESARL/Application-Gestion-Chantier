"use client";

import { Building2, CalendarDays, ChevronRight, ListChecks, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { EtatVide } from "@/components/ui";
import { routeAutorisee, useDroits } from "@/features/habilitations";

/**
 * Les sections de l'espace Paramètres. Le titre vient de la navigation (les mêmes
 * clés que la barre latérale), la phrase d'explication de `pageParametres`.
 */
const SECTIONS: readonly { href: string; cle: string; icone: LucideIcon }[] = [
  { href: "/parametres/collaborateurs", cle: "collaborateurs", icone: Users },
  { href: "/parametres/roles", cle: "roles", icone: ShieldCheck },
  { href: "/parametres/listes", cle: "listes", icone: ListChecks },
  { href: "/parametres/calendrier", cle: "calendrier", icone: CalendarDays },
  { href: "/parametres/configuration", cle: "configuration", icone: Building2 },
];

/** Un accès par section que le compte peut ouvrir : une entrée fermée n'est pas proposée. */
export function SectionsParametres() {
  const t = useTranslations("pageParametres");
  const tNavigation = useTranslations("tableauDeBord.navigation");
  const { droits } = useDroits();

  const ouvertes = SECTIONS.filter((section) => routeAutorisee(droits, section.href));

  if (ouvertes.length === 0) return <EtatVide titre={t("aucune")} />;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ouvertes.map(({ href, cle, icone: Icone }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex h-full items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-5 shadow-sm transition-colors hover:border-primary-500 focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Icone className="size-5" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-base font-semibold text-neutral-900">{tNavigation(cle)}</span>
              <span className="text-sm text-neutral-600">{t(`descriptions.${cle}`)}</span>
            </span>
            <ChevronRight className="mt-1 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { ONGLETS_PROJET, ongletDuChemin, type OngletProjet } from "@/features/projets/regles";
import { cn } from "@/lib/utils";

/**
 * Les onglets de la fiche projet, **portés par l'URL** (décision P5) : chaque onglet est une
 * page (`/projets/[id]`, `/decoupage`, `/avancement`, `/equipes`, `/avenants`). Un lien se
 * partage, se rouvre et revient avec le bouton « Précédent » — ce qu'un état local perdait.
 *
 * Même dessin que les onglets des écrans de chantier (`EnteteChantier`), en liens. La barre
 * défile horizontalement sur téléphone plutôt que de passer sur deux lignes.
 */
export function OngletsProjet({ projetId }: { projetId: string }) {
  const t = useTranslations("ficheProjet.onglets");
  const actif = ongletDuChemin(usePathname());

  return (
    <nav
      aria-label={t("libelle")}
      className="flex gap-1 overflow-x-auto border-0 border-b border-solid border-neutral-200"
    >
      {ONGLETS_PROJET.map((onglet: OngletProjet) => (
        <Link
          key={onglet}
          href={onglet === "synthese" ? `/projets/${projetId}` : `/projets/${projetId}/${onglet}`}
          aria-current={actif === onglet ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-0 border-b-2 border-solid px-4 py-2.5 text-sm font-medium whitespace-nowrap no-underline transition-colors",
            actif === onglet
              ? "border-primary text-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-800",
          )}
        >
          {t(onglet)}
        </Link>
      ))}
    </nav>
  );
}

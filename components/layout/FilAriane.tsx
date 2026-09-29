"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { lireProjet } from "@/features/projets/adaptateur";
import { cleProjet } from "@/features/projets/cles";

/**
 * Fil d'Ariane de la topbar — modèle demandé : flèche de retour, puis
 * seulement les deux derniers niveaux (« page n-1 / page n »), pas la chaîne
 * complète depuis la racine. Sur `/tableau-de-bord` lui-même, il n'y a pas
 * de « n-1 » : la flèche disparaît et seul le libellé courant reste.
 *
 * Les libellés viennent de `tableauDeBord.navigation.*` — les mêmes clés
 * que la sidebar (`LayoutApp`), pour ne pas nommer deux fois le même écran.
 * Un projet (`/projets/[id]`) se nomme par son nom, lu dans le même cache
 * React Query que sa fiche — pas de seconde requête. Tout autre segment sans
 * clé connue se replie sur une version lisible du segment brut.
 */
const CARTE_SEGMENTS: Record<string, string> = {
  "/tableau-de-bord": "accueil",
  "/abonnement": "abonnement",
  "/abonnement/tarifs": "tarifs",
  "/abonnement/historique": "historique",
  "/projets": "projets",
  "/projets/lots-activites": "projetsLots",
  "/projets/equipe-affectations": "projetsEquipe",
  "/rapports": "chantier",
  "/rapports/synthese": "chantierSynthese",
  "/planning": "planning",
  "/finance": "finance",
  "/achats": "achats",
  "/stocks": "stocks",
  "/rh": "rh",
  "/equipements": "equipements",
  "/qhse": "qhse",
  "/contrats": "contrats",
  "/documents": "documents",
  "/tiers": "tiers",
  "/notifications": "notifications",
  "/parametres": "parametres",
  "/parametres/collaborateurs": "collaborateurs",
  "/parametres/roles": "roles",
  "/parametres/configuration": "configuration",
};

/** L'identifiant du projet de `/projets/[id]/…`, s'il y en a un. */
function projetDuChemin(segments: string[]): string | undefined {
  if (segments[0] !== "projets" || !segments[1]) return undefined;
  return CARTE_SEGMENTS[`/projets/${segments[1]}`] ? undefined : segments[1];
}

function humaniser(segment: string): string {
  const propre = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();
  return propre.charAt(0).toUpperCase() + propre.slice(1);
}

export function FilAriane() {
  const pathname = usePathname();
  const t = useTranslations("tableauDeBord.navigation");

  const segments = pathname.split("/").filter(Boolean);
  const projetId = projetDuChemin(segments);
  const projet = useQuery({
    queryKey: cleProjet(projetId ?? ""),
    queryFn: () => lireProjet(projetId ?? ""),
    enabled: projetId !== undefined,
  });

  function libelle(chemin: string, segmentBrut: string): ReactNode {
    if (projetId !== undefined && chemin === `/projets/${projetId}`) {
      if (projet.data) return projet.data.nom;
      return projet.isError ? humaniser(segmentBrut) : <Skeleton className="h-4 w-32" />;
    }
    // Un rapport journalier (`/rapports/[id]`) se nomme par son type, pas par son identifiant.
    const cle = CARTE_SEGMENTS[chemin] ?? (/^\/rapports\/(rap|abs)-/.test(chemin) ? "chantierRapport" : undefined);
    return cle ? t(cle) : humaniser(segmentBrut);
  }

  const cheminCourant = "/" + segments.join("/");
  const courant = { chemin: cheminCourant, texte: libelle(cheminCourant, segments[segments.length - 1] ?? "") };

  // Racine (`/tableau-de-bord`) : rien à mettre en « n-1 ».
  if (segments.length <= 1 && cheminCourant === "/tableau-de-bord") {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="block max-w-xs truncate">{courant.texte}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const cheminParent =
    segments.length > 1 ? "/" + segments.slice(0, -1).join("/") : "/tableau-de-bord";
  const parent = {
    chemin: cheminParent,
    texte: libelle(cheminParent, segments[segments.length - 2] ?? "tableau-de-bord"),
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="icon-sm" className="shrink-0" asChild>
        <Link href={parent.chemin} aria-label={t("retour")}>
          <ArrowLeft />
        </Link>
      </Button>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={parent.chemin} className="block max-w-xs truncate">{parent.texte}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="block max-w-xs truncate">{courant.texte}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

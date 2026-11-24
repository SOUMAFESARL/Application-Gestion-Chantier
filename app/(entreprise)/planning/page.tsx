"use client";

import { CalendarRange, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjetsVisibles } from "@/features/habilitations";
import { EspacePlanningProjet } from "@/features/planning/components/EspacePlanningProjet";

/**
 * Écran transverse « Planning » de l'entreprise : sélectionne un chantier visible
 * par le compte connecté et affiche son diagramme de Gantt interactif.
 */
export default function PlanningPage() {
  const t = useTranslations("planning");
  const requeteProjets = useProjetsVisibles();
  const [projetChoisiId, setProjetChoisiId] = useState<string>("");

  const projets = useMemo(() => requeteProjets.data ?? [], [requeteProjets.data]);

  const projetActif = useMemo(() => {
    if (projets.length === 0) return null;
    if (projetChoisiId) {
      const trouve = projets.find((item) => item.id === projetChoisiId);
      if (trouve) return trouve;
    }
    return projets[0];
  }, [projets, projetChoisiId]);

  return (
    <div className="flex w-full flex-col gap-6">
      <EnTetePage
        titre={t("page.titre")}
        description={t("page.description")}
        actions={
          projetActif ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/projets/${projetActif.id}/planning`}>
                <span>{t("page.ouvrirDansFiche")}</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          ) : undefined
        }
      />

      {requeteProjets.isPending ? (
        <EtatChargement message={t("chargement")} />
      ) : requeteProjets.isError ? (
        <EtatErreur
          message={t("erreurChargement")}
          onReessayer={() => void requeteProjets.refetch()}
        />
      ) : projets.length === 0 || !projetActif ? (
        <div className="rounded-xl border border-solid border-neutral-200 bg-neutral-0 p-6 shadow-sm">
          <EtatVide
            icone={<CalendarRange className="size-10 text-neutral-400" strokeWidth={1.5} aria-hidden="true" />}
            titre={t("page.aucunProjetTitre")}
            description={t("page.aucunProjetDescription")}
            action={
              <Button asChild size="sm">
                <Link href="/projets">{t("page.allerProjets")}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-solid border-neutral-200 bg-neutral-0 px-4 py-3 shadow-xs">
            <label htmlFor="selecteur-projet-planning" className="shrink-0 text-sm font-medium text-neutral-700">
              {t("page.selecteurProjet")}
            </label>
            <Select value={projetActif.id} onValueChange={setProjetChoisiId}>
              <SelectTrigger
                id="selecteur-projet-planning"
                className="h-[var(--input-height-md)] w-80 max-w-full bg-card max-sm:w-full"
              >
                <SelectValue placeholder={t("page.selecteurPlaceholder")} />
              </SelectTrigger>
              <SelectContent align="start">
                {projets.map((projet) => (
                  <SelectItem key={projet.id} value={projet.id}>
                    {projet.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <EspacePlanningProjet projet={projetActif} afficherLienDecoupage />
        </>
      )}
    </div>
  );
}

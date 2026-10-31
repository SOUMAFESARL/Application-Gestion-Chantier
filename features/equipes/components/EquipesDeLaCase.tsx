"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cleDecoupage } from "@/features/decoupage/cles";
import type { EquipeCase } from "@/features/decoupage/types";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";

import { affecterEquipeCase, listerEquipesProjet, retirerAffectationEquipe } from "../adaptateur";
import { cleEquipesProjet } from "../cles";

/**
 * Les équipes d'une case, dans son tiroir (décision P12) : celles qui y sont posées, ou dont elle
 * hérite d'une case parente — la plus précise l'emporte —, et le geste pour y en poser une.
 */
export function EquipesDeLaCase({
  projet,
  caseId,
  equipes,
  heriteesDe,
}: {
  projet: Projet;
  caseId: string;
  equipes: EquipeCase[];
  /** La case d'où viennent les équipes affichées, quand elles sont héritées. */
  heriteesDe: string | null;
}) {
  const t = useTranslations("equipes.case");
  const { peutSurProjet } = useDroits();
  const permis = peutSurProjet(PERMISSIONS.GERER_EQUIPES, projet);
  const client = useQueryClient();
  const [choisie, setChoisie] = useState("");
  const toutes = useQuery({
    queryKey: cleEquipesProjet(projet.id),
    queryFn: ({ signal }) => listerEquipesProjet(projet.id, signal),
  });

  async function actualiser() {
    await client.invalidateQueries({ queryKey: cleDecoupage(projet.id) });
    await client.invalidateQueries({ queryKey: cleEquipesProjet(projet.id) });
  }

  const message = (e: unknown) => (e instanceof ErreurApi && e.message ? e.message : t("erreur"));
  const affectation = useMutation({
    mutationFn: () => affecterEquipeCase(projet.id, choisie, caseId),
    onSuccess: async (avertissements) => {
      for (const avertissement of avertissements) toast.warning(avertissement.message);
      setChoisie("");
      await actualiser();
    },
    onError: (e) => toast.error(message(e)),
  });
  const retrait = useMutation({
    mutationFn: (affectationId: string) => retirerAffectationEquipe(projet.id, affectationId),
    onSuccess: actualiser,
    onError: (e) => toast.error(message(e)),
  });

  const directes = heriteesDe === null;
  const proposees = (toutes.data ?? []).filter(
    (equipe) => equipe.estActive && !(directes && equipes.some((e) => e.equipeId === equipe.id)),
  );

  return (
    <div className="flex flex-col gap-2">
      {equipes.length === 0 ? (
        <span className="text-neutral-500">{t("aucune")}</span>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {equipes.map((equipe) => (
            <li key={equipe.affectationId} className="inline-flex items-center gap-1 rounded-md bg-neutral-100 py-0.5 pr-1 pl-2 text-sm">
              {equipe.nom}
              {directes && permis && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("retirer", { equipe: equipe.nom })}
                  onClick={() => retrait.mutate(equipe.affectationId)}
                  disabled={retrait.isPending}
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!directes && equipes.length > 0 && <span className="text-xs text-neutral-500">{t("heritees")}</span>}
      <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
        <Select value={choisie} onValueChange={setChoisie} disabled={!permis}>
          <SelectTrigger className="w-56" size="sm" aria-label={t("choisir")}>
            <SelectValue placeholder={t("choisir")} />
          </SelectTrigger>
          <SelectContent>
            {proposees.map((equipe) => (
              <SelectItem key={equipe.id} value={equipe.id}>
                {equipe.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <BoutonPermis
          size="sm"
          variant="outline"
          permis={permis}
          permission={PERMISSIONS.GERER_EQUIPES}
          onClick={() => affectation.mutate()}
          disabled={!choisie || affectation.isPending}
        >
          {affectation.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}
          {t("poser")}
        </BoutonPermis>
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";

import { EtatChargement, EtatErreur } from "@/components/ui";
import { OngletEquipes } from "@/features/equipes/components/OngletEquipes";
import { lireProjet } from "@/features/projets/adaptateur";
import { cleProjet } from "@/features/projets/cles";

/** L'onglet Équipes, sur le projet lu par le cadre de la fiche (même cache). */
export function OngletEquipesProjet({ projetId, equipeId = null }: { projetId: string; equipeId?: string | null }) {
  const requete = useQuery({ queryKey: cleProjet(projetId), queryFn: () => lireProjet(projetId) });
  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;
  return <OngletEquipes projet={requete.data} equipeOuverte={equipeId} />;
}

"use client";

import { useQuery } from "@tanstack/react-query";

import { EtatChargement, EtatErreur } from "@/components/ui";
import { OngletAvancement } from "@/features/decoupage/components/OngletAvancement";
import { lireProjet } from "@/features/projets/adaptateur";
import { cleProjet } from "@/features/projets/cles";

/** L'onglet Avancement, sur le projet lu par le cadre de la fiche (même cache). */
export function OngletAvancementProjet({ projetId }: { projetId: string }) {
  const requete = useQuery({ queryKey: cleProjet(projetId), queryFn: () => lireProjet(projetId) });
  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;
  return <OngletAvancement projet={requete.data} />;
}

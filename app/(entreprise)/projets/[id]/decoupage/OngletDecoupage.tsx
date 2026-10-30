"use client";

import { useQuery } from "@tanstack/react-query";

import { EtatChargement, EtatErreur } from "@/components/ui";
import { TableauDemarrage } from "@/features/decoupage/components/TableauDemarrage";
import { VueArbre } from "@/features/decoupage/components/VueArbre";
import { lireProjet } from "@/features/projets/adaptateur";
import { cleProjet } from "@/features/projets/cles";

/**
 * L'onglet Découpage : le tableau de démarrage tant que l'arbre n'existe pas (`decoupageCree`),
 * puis la vue en arbre. Appliquer le tableau relit le projet, et l'onglet bascule de lui-même.
 */
export function OngletDecoupage({ projetId }: { projetId: string }) {
  const requete = useQuery({
    queryKey: cleProjet(projetId),
    queryFn: () => lireProjet(projetId),
  });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  const projet = requete.data;
  if (!projet.decoupageCree) return <TableauDemarrage projet={projet} />;
  return <VueArbre projet={projet} />;
}

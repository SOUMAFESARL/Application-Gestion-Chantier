import { OngletPlanningProjet } from "@/features/planning/components/EspacePlanningProjet";

/**
 * Onglet « Planning » (diagramme de Gantt & import MS Project) de la fiche projet.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OngletPlanningProjet projetId={id} />;
}

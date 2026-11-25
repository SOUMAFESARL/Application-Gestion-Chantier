import { EspaceDocumentsGed } from "@/features/ged/components/EspaceDocumentsGed";

/**
 * Onglet « Documents » (GED / F6) de la fiche projet (`/projets/[id]/documents`).
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EspaceDocumentsGed projetIdFixe={id} />;
}

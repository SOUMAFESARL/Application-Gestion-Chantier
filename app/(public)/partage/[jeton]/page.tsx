import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageDocumentPartage } from "@/features/ged/components/PageDocumentPartage";

/**
 * Écran public de consultation d'un document partagé (`/partage/[jeton]`, sans compte).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ged.partagePublic.meta");
  return { title: t("titre") };
}

export default async function Page({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return <PageDocumentPartage jeton={jeton} />;
}

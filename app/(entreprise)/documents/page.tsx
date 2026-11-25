import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EspaceDocumentsGed } from "@/features/ged/components/EspaceDocumentsGed";

/**
 * Écran global « Documents » (`/documents`) — GED multi-projets (F6).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ged.meta");
  return { title: t("titre") };
}

export default function Page() {
  return <EspaceDocumentsGed />;
}

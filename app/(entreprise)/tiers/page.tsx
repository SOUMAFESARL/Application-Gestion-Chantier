import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ListeTiers } from "./ListeTiers";

/**
 * Page de gestion des parties prenantes et tiers (`/tiers`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tiers.meta");
  return { title: t("titre") };
}

export default function TiersPage() {
  return <ListeTiers />;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FicheClient } from "./FicheClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreClients") };
}

/**
 * `params` est une promesse depuis Next 16 — elle s'attend, elle ne se lit
 * plus directement.
 */
export default async function PageFicheClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FicheClient id={id} />;
}

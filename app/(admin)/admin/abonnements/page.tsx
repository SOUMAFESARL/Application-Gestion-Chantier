import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ListeAbonnements } from "./ListeAbonnements";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titre") };
}

export default function PageAbonnements() {
  return <ListeAbonnements />;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GestionListesDecoupagePlateforme } from "../GestionListesDecoupagePlateforme";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreReferentielsListes") };
}

export default function PageListesDecoupagePlateforme() {
  return <GestionListesDecoupagePlateforme />;
}

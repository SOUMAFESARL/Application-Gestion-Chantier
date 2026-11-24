import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GestionModelesDecoupagePlateforme } from "../GestionModelesDecoupagePlateforme";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreReferentielsModeles") };
}

export default function PageModelesDecoupagePlateforme() {
  return <GestionModelesDecoupagePlateforme />;
}

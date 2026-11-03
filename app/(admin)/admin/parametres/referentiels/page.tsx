import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EcranReferentielsPlateforme } from "./EcranReferentielsPlateforme";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreReferentiels") };
}

export default function PageReferentiels() {
  return <EcranReferentielsPlateforme />;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { JournalPlateforme } from "./JournalPlateforme";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.journal");
  return { title: t("meta.titre") };
}

export default function PageJournal() {
  return <JournalPlateforme />;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EcranProfil } from "./EcranProfil";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreProfil") };
}

export default function PageProfil() {
  return <EcranProfil />;
}

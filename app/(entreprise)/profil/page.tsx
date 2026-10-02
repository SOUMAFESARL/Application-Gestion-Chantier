import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EcranProfil } from "./EcranProfil";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profil");
  return { title: t("metaTitre") };
}

export default function PageProfil() {
  return <EcranProfil />;
}

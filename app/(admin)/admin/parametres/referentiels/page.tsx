import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreReferentiels") };
}

export default function PageReferentiels() {
  redirect("/admin/parametres/referentiels/listes");
}

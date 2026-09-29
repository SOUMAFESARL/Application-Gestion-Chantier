import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EnTeteParametrage } from "../EnTeteParametrage";
import { ListeComptes } from "./ListeComptes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreComptes") };
}

export default function PageComptes() {
  return (
    <div className="flex flex-col gap-5">
      <EnTeteParametrage section="comptes" />
      <ListeComptes />
    </div>
  );
}

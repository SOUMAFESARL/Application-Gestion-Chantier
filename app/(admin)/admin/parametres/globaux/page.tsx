import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EnTeteParametrage } from "../EnTeteParametrage";
import { EcranIdentite } from "./EcranIdentite";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreIdentite") };
}

export default function PageIdentite() {
  return (
    <div className="flex flex-col gap-5">
      <EnTeteParametrage section="identite" />
      <EcranIdentite />
    </div>
  );
}

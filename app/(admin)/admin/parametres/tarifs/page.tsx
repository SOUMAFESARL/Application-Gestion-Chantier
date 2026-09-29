import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EnTeteParametrage } from "../EnTeteParametrage";
import { EcranTarifs } from "./EcranTarifs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreTarifs") };
}

export default function PageTarifs() {
  return (
    <div className="flex flex-col gap-5">
      <EnTeteParametrage section="tarifs" />
      <EcranTarifs />
    </div>
  );
}

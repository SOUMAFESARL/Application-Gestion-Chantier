import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EnTeteParametrage } from "../EnTeteParametrage";
import { EcranMessagerie } from "./EcranMessagerie";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreMessagerie") };
}

export default function PageMessagerie() {
  return (
    <div className="flex flex-col gap-5">
      <EnTeteParametrage section="messagerie" />
      <EcranMessagerie />
    </div>
  );
}

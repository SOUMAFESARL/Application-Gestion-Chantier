import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EnTeteParametrage } from "../EnTeteParametrage";
import { ListeModules } from "./ListeModules";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreModules") };
}

export default function PageModules() {
  return (
    <div className="flex flex-col gap-5">
      {/* L'en-tête reste collé sous la barre du haut : le catalogue est long, et
          sa phrase dit ce que règlent les accès qu'on fait défiler. */}
      <div className="flex flex-col gap-5 bg-background md:sticky md:top-16 md:z-30 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 md:pb-4">
        <EnTeteParametrage section="modules" />
      </div>
      <ListeModules />
    </div>
  );
}

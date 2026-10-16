import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CATEGORIES_REFERENTIEL_PLATEFORME } from "@/features/administration";

import { EnTeteParametrage } from "../EnTeteParametrage";
import { ListeReferentiel } from "./ListeReferentiel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreReferentiels") };
}

export default function PageReferentiels() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 bg-background md:sticky md:top-16 md:z-30 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 md:pb-4">
        <EnTeteParametrage section="referentiels" />
      </div>
      {CATEGORIES_REFERENTIEL_PLATEFORME.map((categorie) => (
        <ListeReferentiel key={categorie} categorie={categorie} />
      ))}
    </div>
  );
}

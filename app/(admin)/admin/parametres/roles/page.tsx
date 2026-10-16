import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EnTeteParametrage } from "../EnTeteParametrage";
import { ListeRolesSysteme } from "./ListeRolesSysteme";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreRolesSysteme") };
}

export default function PageRolesSysteme() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 bg-background md:sticky md:top-16 md:z-30 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 md:pb-4">
        <EnTeteParametrage section="rolesSysteme" />
      </div>
      <ListeRolesSysteme />
    </div>
  );
}

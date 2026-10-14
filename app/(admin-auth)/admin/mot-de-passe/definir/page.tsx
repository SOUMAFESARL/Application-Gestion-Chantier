import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EcranDefinition } from "@/app/(auth)/mot-de-passe/definir/EcranDefinition";
import { Card, CardContent } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("motDePasseDefinir");
  return { title: t("titre"), description: t("metaDescription") };
}

/**
 * `/admin/mot-de-passe/definir` — la cible du lien que le serveur envoie à un
 * agent de la plateforme qui a oublié son mot de passe
 * (`/admin/mot-de-passe/definir#jeton=…`).
 *
 * Même écran que celui des entreprises, branché sur les routes `/admins/…` :
 * les deux espaces ont deux tables de comptes, donc deux jetons qui ne se
 * mélangent pas. Même cadre que `/admin/mot-de-passe/oublie`.
 */
export default function PageDefinitionAdmin() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-neutral-50 px-4 py-10 sm:py-12">
      <main className="w-full max-w-md">
        <Card className="overflow-hidden py-0 shadow-md">
          <CardContent className="px-6 py-8 sm:px-8">
            <EcranDefinition espace="administration" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

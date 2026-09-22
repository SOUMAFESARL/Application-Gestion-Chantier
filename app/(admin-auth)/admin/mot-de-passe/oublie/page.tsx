import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";

import { FormulaireOubliAdmin } from "./FormulaireOubliAdmin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreMotDePasseOublie") };
}

/**
 * `/admin/mot-de-passe/oublie`.
 *
 * La sortie de secours de `/admin/connexion` : ce back-office n'a ni
 * inscription ni compte de service, un agent qui a perdu son mot de passe n'a
 * que ce chemin.
 *
 * **Un ecran distinct de celui des entreprises**, et pas un alias vers
 * `/mot-de-passe/oublie` : les deux espaces ont deux tables de comptes. Poser
 * une adresse d'administrateur sur l'endpoint du tenant aurait produit le
 * meme `202` silencieux que n'importe quelle adresse inconnue — un echec que
 * rien, a l'ecran, n'aurait distingue d'un succes.
 *
 * Le titre change avec l'etat du formulaire (saisie, lien envoye, echec) : il
 * est donc rendu par le composant client, pas ici.
 */
export default function PageOubliAdmin() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-neutral-50 px-4 py-10 sm:py-12">
      <main className="w-full max-w-md">
        <Card className="overflow-hidden py-0 shadow-md">
          <CardContent className="px-6 py-8 sm:px-8">
            <FormulaireOubliAdmin />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

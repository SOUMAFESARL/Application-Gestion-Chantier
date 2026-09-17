import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Suspense } from "react";

import { CadreAuthDouble } from "@/components/layout/CadreAuthDouble";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

import { FormulaireConnexion } from "./FormulaireConnexion";

/**
 * Écran « Connexion ».
 *
 * Motif d'interface : authentification, en deux panneaux — la marque sur la
 * photo de chantier à gauche, le formulaire à droite.
 *
 * Sept états, tous atteignables : saisie, chargement, succès, identifiants
 * invalides (avec le compteur de tentatives), compte bloqué, trop de requêtes,
 * erreur réseau, erreur inattendue et session expirée.
 *
 * Le titre et l'accroche sont rendus **ici**, côté serveur : ce sont les deux
 * seules choses que la page a à dire avant que le JavaScript n'arrive, et le
 * `h1` d'un écran ne doit pas attendre l'hydratation pour exister. La ligne
 * « pas de compte » du pied de carte suit la même règle — c'est un lien
 * statique vers l'inscription, il n'a aucune raison de dépendre du client.
 *
 * Le formulaire, lui, est un composant client séparé : il lit
 * `?session=expiree` avec `useSearchParams`, ce qui empêcherait le rendu
 * statique de la page entière s'il n'était pas isolé derrière une frontière
 * Suspense.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("connexion");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  const t = useTranslations("connexion");

  return (
    <CadreAuthDouble>
      {/*
        La carte est posée sur le fond de la page : elle donne au formulaire
        un bord franc, ce que la colonne nue ne faisait pas. Le pied est
        séparé d'un filet — la création de compte n'est pas une étape de la
        connexion, c'est l'autre porte.
      */}
      <Card className="gap-0 overflow-hidden py-0 shadow-md">
        <CardHeader className="gap-1.5 px-6 pt-8 pb-6 text-center sm:px-8">
          {/*
            Le titre reste un `h1` : `CardTitle` rend un `div`, et le seul
            titre de cet écran ne peut pas être un `div`. La carte n'apporte
            ici qu'un cadre, elle n'a pas à décider du niveau de titre.
          */}
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-neutral-900 sm:text-3xl">
            {t("titre")}
          </h1>
          <p className="text-base leading-relaxed text-neutral-600">
            {t("accroche")}
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-8 sm:px-8">
          <Suspense
            fallback={<div className="h-96" aria-hidden="true" />}
          >
            <FormulaireConnexion />
          </Suspense>
        </CardContent>

        {/*
          Une seule phrase, lien compris : sur un écran de 390 px, deux
          éléments flex côte à côte coupaient la question de son point
          d'interrogation. Du texte qui coule se replie proprement.
        */}
        <CardFooter className="justify-center border-t border-border bg-neutral-50 px-6 py-5 sm:px-8">
          <p className="text-center text-sm text-neutral-600">
            {t("pasDeCompte")}{" "}
            <Link
              href="/inscription"
              className="font-semibold whitespace-nowrap text-primary-600 hover:text-primary-700 hover:underline"
            >
              {t("creerCompte")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </CadreAuthDouble>
  );
}

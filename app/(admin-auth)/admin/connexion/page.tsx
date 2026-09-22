import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

import { FormulaireConnexionAdmin } from "./FormulaireConnexionAdmin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titreConnexion") };
}

/**
 * `/admin/connexion`.
 *
 * Cet ecran vit dans le groupe `(admin-auth)`, et non `(admin)` : il ne doit
 * pas porter la coquille du back-office, qui suppose une session ouverte et
 * irait la chercher en boucle. C'est la meme separation que `(auth)` et
 * `(app)` cote entreprise.
 *
 * **Le titre dit « Connexion », pas « Administration de la plateforme ».**
 * L'espace, c'est le badge qui le nomme : un titre et un sous-titre qui
 * repetaient tous deux la meme chose occupaient le haut de la carte sans
 * rien apprendre. Le badge tient sur une ligne et porte l'information qui
 * compte — les comptes clients n'entrent pas ici.
 *
 * Il n'y a **plus de `BandeauSimulation`** : retire a la demande du
 * proprietaire du produit, ici comme sur la coquille du back-office.
 *
 * Le titre est rendu **ici**, cote serveur, comme sur l'ecran de connexion
 * client : le `h1` d'une page ne doit pas attendre l'hydratation. Le
 * formulaire, lui, lit `?session=expiree` avec `useSearchParams` — isole
 * derriere une frontiere Suspense, il n'empeche pas le rendu statique du
 * reste de la page.
 */
export default function PageConnexionAdmin() {
  const t = useTranslations("administration.connexion");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-neutral-50 px-4 py-10 sm:py-12">
      {/*
        `max-w-md` sur mobile comme sur grand ecran : ce formulaire a deux
        champs, l'elargir ne ferait qu'allonger la course de l'oeil. Le
        gouttiere de 16 px vient du `px-4` du conteneur, la carte n'a donc
        besoin d'aucune largeur minimale.
      */}
      <main className="w-full max-w-md">
        <Card className="gap-0 overflow-hidden py-0 shadow-md">
          <CardHeader className="gap-3 border-b border-border bg-neutral-100 px-6 pt-8 pb-6 text-center sm:px-8">
            {/*
              `CardTitle` rend un `div` : le seul titre de l'ecran ne peut pas
              en etre un. La carte apporte le cadre, pas le niveau de titre.
            */}
            <h1 className="text-xl leading-tight font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {t("titre")}
            </h1>
            <div className="flex justify-center">
              <Badge variante="primaire">{t("badge")}</Badge>
            </div>
          </CardHeader>

          <CardContent className="px-6 py-8 sm:px-8">
            <Suspense fallback={<div className="h-80" aria-hidden="true" />}>
              <FormulaireConnexionAdmin />
            </Suspense>
          </CardContent>

          {/*
            L'autre porte, reduite au lien seul : la phrase qui l'introduisait
            (« Vous cherchez l'espace de votre entreprise ? ») redisait ce que
            le badge annonce deja en haut de la carte.
          */}
          <CardFooter className="justify-center border-t border-border bg-neutral-100 px-6 py-5 sm:px-8">
            <Link
              href="/connexion"
              className="text-center text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline"
            >
              {t("retourLien")}
            </Link>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

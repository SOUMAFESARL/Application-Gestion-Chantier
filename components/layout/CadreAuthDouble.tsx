import { useTranslations } from "next-intl";
import Image from "next/image";
import type { ReactNode } from "react";

import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { LogoCCD } from "./MarqueCCD";

/**
 * Le cadre à deux panneaux des écrans hors application — maquette de refonte.
 *
 * À gauche, la marque sur une photo de chantier ; à droite, le formulaire.
 * C'est le premier écran migré sur Tailwind (plan de refonte, lot 7) : il
 * n'ouvre aucun `*.module.css`, et `CarteAuth` reste en place pour les quatre
 * écrans d'authentification qui n'ont pas encore été repris.
 *
 * **Sous 1024 px, le panneau disparaît** et l'écran ne montre que le
 * formulaire. Sur un téléphone, une photo plein écran repousse les champs
 * sous la ligne de flottaison : on demande alors de faire défiler avant de
 * pouvoir taper quoi que ce soit, pour une image décorative.
 *
 * **Une seule marque exposée à la fois.** Le panneau est masqué par
 * `display: none`, ce qui le retire aussi de l'arbre d'accessibilité ; la
 * marque compacte qui le remplace porte le `lg:hidden` inverse. Un lecteur
 * d'écran n'annonce donc jamais l'identité deux fois, quelle que soit la
 * largeur.
 */
export function CadreAuthDouble({
  children,
  panneau,
}: {
  children: ReactNode;
  /** Remplace le panneau photo par défaut — voir `PanneauMarqueDegrade`. */
  panneau?: ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {panneau ?? <PanneauMarque />}

      {/*
        Fond blanc, comme avant la refonte : `neutral-50` est le fond de page
        d'origine des écrans d'authentification (voir `docs/recette/avant/`).
        La carte, elle, est en `neutral-0` — c'est ce demi-ton d'écart, plus
        la bordure, qui la détache, sans poser de gris sur l'écran.
      */}
      <main className="flex items-center justify-center bg-neutral-50 px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="w-full max-w-[26rem]">
          <MarqueCompacte />
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * La marque au-dessus du formulaire, sous 1024 px seulement.
 *
 * Le panneau de gauche ne se replie pas en bandeau : il s'efface. Restait à
 * dire de quel produit est cet écran de connexion — une page qui demande un
 * mot de passe sans se nommer est une page qu'on n'a aucune raison de croire.
 */
function MarqueCompacte() {
  const t = useTranslations("marque");

  return (
    <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
      <LogoCCD taille={44} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-lg font-bold tracking-tight text-neutral-900">
          {t("nom")}
        </span>
        <span className="text-sm font-medium text-neutral-500">
          {t("accroche")}
        </span>
      </span>
    </div>
  );
}

/**
 * Le panneau de marque : la photo, le signe, le nom, la promesse.
 *
 * La photo est **décorative** — son `alt` est vide, et volontairement. Elle ne
 * porte aucune information que le texte posé dessus ne donne déjà ; la décrire
 * ferait lire un chantier à qui vient se connecter.
 *
 * Le voile sombre n'est pas un effet de style : c'est lui qui garantit le
 * contraste du texte blanc sur une photo dont la luminosité varie d'un angle à
 * l'autre (charte §8.4). Le flou sert la même cause — il efface les détails
 * contrastés qui traverseraient le voile.
 *
 * Voile et flou ont été **allégés** (0,85 → 0,75 d'opacité, 3 px → 1 px de
 * flou) : le chantier se voit, ce qui était le but de la photo. Ils ne sont
 * pas supprimés pour autant — sans eux, le texte blanc passerait sur les
 * zones claires de l'image. Toucher à ces deux valeurs, c'est toucher au
 * contraste : la borne basse est ce qui tient encore le texte, pas un goût.
 */
function PanneauMarque() {
  const t = useTranslations("marque");

  return (
    <aside className="relative isolate hidden flex-col items-center justify-center overflow-hidden px-6 py-12 text-center lg:flex lg:px-12 lg:py-16">
      <Image
        src="/images/chantier.png"
        alt=""
        fill
        priority
        quality={72}
        /* Le panneau n'existe qu'au-delà de 1024 px, et il y occupe la
           moitié de la fenêtre : jamais plus de 50vw, jamais 100. */
        sizes="50vw"
        /* `scale-105` compense le flou : sans agrandissement, l'estompage
           laisse voir les bords transparents de l'image. Le flou est passé de
           3 px à 1 px — à 3 px la photo n'était plus qu'une texture, on ne
           reconnaissait plus un chantier. */
        className="-z-20 scale-105 object-cover blur-[1px]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-br from-neutral-900/75 via-neutral-900/58 to-primary-900/78"
      />

      <LogoCCD taille={64} />

      <p className="mt-5 text-3xl font-bold tracking-tight text-neutral-0 lg:text-4xl">
        {t("nom")}
      </p>
      <p className="mt-1 text-sm font-medium tracking-[0.12em] text-neutral-0/70 uppercase lg:text-base">
        {t("accroche")}
      </p>

      <span
        aria-hidden="true"
        className="my-6 block h-px w-16 bg-neutral-0/30 lg:my-8"
      />

      <p className="max-w-sm text-base leading-relaxed text-balance text-neutral-0/90 lg:max-w-md lg:text-lg">
        {t("promesse")}
      </p>
    </aside>
  );
}

/**
 * Variante sans photo, en dégradé de la couleur de marque.
 *
 * Réservée aux écrans dont le message du panneau dépend d'un état connu
 * seulement côté client — l'activation, par exemple, ne connaît le nom de
 * l'entreprise qu'après avoir vérifié le jeton, qui voyage en fragment d'URL
 * (`#jeton=…`) et n'est donc jamais lisible pendant le rendu serveur. Le
 * contenu variable est alors passé en `children` par l'écran lui-même,
 * plutôt que fixé ici comme le fait `PanneauMarque`.
 */
export function PanneauMarqueDegrade({ children }: { children: ReactNode }) {
  const t = useTranslations("marque");

  return (
    <aside className="relative isolate hidden flex-col items-center justify-center overflow-hidden bg-linear-to-br from-primary-500 via-primary-400 to-primary-700 px-6 py-12 text-center lg:flex lg:px-12 lg:py-16">
      <LogoCCD taille={64} />

      <p className="mt-5 text-3xl font-bold tracking-tight text-neutral-0 lg:text-4xl">
        {t("nom")}
      </p>
      <p className="mt-1 text-sm font-medium tracking-[0.12em] text-neutral-0/70 uppercase lg:text-base">
        {t("accroche")}
      </p>

      <span
        aria-hidden="true"
        className="my-6 block h-px w-16 bg-neutral-0/30 lg:my-8"
      />

      <div className="max-w-sm text-base leading-relaxed text-balance text-neutral-0/90 lg:max-w-md lg:text-lg">
        {children}
      </div>
    </aside>
  );
}

/**
 * Bloc centré des écrans de confirmation posés dans une `Card` du cadre
 * double (activation d'entreprise, invitation d'un collaborateur).
 * La pastille porte l'icône ; le texte reste lisible seul (charte §8.4).
 */
export function BlocEtatAuth({
  ton = "primaire",
  icone,
  titre,
  children,
}: {
  ton?: "primaire" | "succes" | "avertissement";
  icone: ReactNode;
  titre: ReactNode;
  children: ReactNode;
}) {
  return (
    <CardContent className="flex flex-col items-center gap-1.5 px-6 py-10 text-center sm:px-8">
      <span
        aria-hidden="true"
        className={cn(
          "mb-3 flex size-14 items-center justify-center rounded-full",
          ton === "succes" && "bg-succes-fond text-succes",
          ton === "avertissement" && "bg-avertissement-fond text-avertissement",
          ton === "primaire" && "bg-primary-50 text-primary-500",
        )}
      >
        {icone}
      </span>
      <h1 className="text-2xl leading-tight font-bold tracking-tight text-neutral-900">
        {titre}
      </h1>
      <div className="mt-1 flex w-full flex-col items-center gap-4 text-base leading-relaxed text-neutral-600">
        {children}
      </div>
    </CardContent>
  );
}

/**
 * Le bandeau de titre des formulaires dont le titre change avec l'état
 * interne (inscription, mot de passe oublié) : un `CardHeader` ne convient
 * pas là, son contenu est fixé une fois pour toutes par la page, pas par le
 * composant client qui gère les états. Le filet reprend le langage déjà posé
 * pour le pied de ces mêmes écrans (« Déjà un compte ? ») — le titre n'est pas
 * un champ du formulaire, il ne doit pas s'y fondre.
 *
 * La bande est en `neutral-100`, comme l'en-tête et le pied de la carte de
 * connexion : les deux extrémités de la carte reculent d'un ton, le blanc
 * ne reste que sur la zone de saisie.
 *
 * Bleed jusqu'aux bords de la carte : suppose un parent `CardContent` en
 * `px-6 py-8 sm:px-8`, comme les écrans qui l'utilisent.
 */
export function EnTeteFormulaireAuth({
  icone,
  iconeTon = "primaire",
  titre,
  description,
}: {
  icone?: ReactNode;
  iconeTon?: "primaire" | "avertissement";
  titre: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="-mx-6 -mt-8 mb-6 border-b border-border bg-neutral-100 px-6 pt-8 pb-6 text-center sm:-mx-8 sm:px-8">
      {icone && (
        <span
          aria-hidden="true"
          className={cn(
            "mb-4 inline-flex size-14 items-center justify-center rounded-full",
            iconeTon === "avertissement"
              ? "bg-avertissement-fond text-avertissement"
              : "bg-primary-50 text-primary-500",
          )}
        >
          {icone}
        </span>
      )}
      <h1 className="text-xl leading-tight font-bold tracking-tight text-neutral-900 sm:text-2xl">
        {titre}
      </h1>
      {description && (
        <p className="mt-1.5 text-base leading-relaxed text-neutral-600">
          {description}
        </p>
      )}
    </div>
  );
}

import { useTranslations } from "next-intl";
import Image from "next/image";
import type { ReactNode } from "react";

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
export function CadreAuthDouble({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <PanneauMarque />

      <main className="flex items-center justify-center bg-neutral-100 px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
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

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { MarqueCCD } from "./MarqueCCD";

/**
 * Le cadre commun aux écrans hors application — maquettes M1, M2, M3, M6, M8.
 *
 * Connexion, inscription, activation et réinitialisation partagent exactement
 * la même carte : marque en tête, contenu, mention de confidentialité en pied.
 * Elle était écrite une fois dans l'écran de connexion ; à partir du deuxième
 * écran, la recopier garantissait que les quatre divergeraient — c'est le
 * moment où l'extraction se justifie, pas avant (guide frontend §4).
 *
 * **Une seule structure pour les deux cadres de la maquette.** Sur téléphone,
 * la marque coiffe un écran blanc à plat ; au-delà de 1024 px elle devient une
 * barre qui surmonte un fond neutre, où la carte se détache. Le DOM ne change
 * pas — seul l'habillage change, dans la feuille de style.
 *
 * C'est ce qui évite de rendre la marque **deux fois** pour la « déplacer » :
 * deux bannières, dont une masquée en CSS, sont deux bannières pour un lecteur
 * d'écran.
 */
export function CarteAuth({ children }: { children: ReactNode }) {
  const t = useTranslations("marque");

  return (
    // La rupture est a 1024 px : le Socle §7.2 y place l'« interface web
    // complete ». En dessous, la carte reste a plat — un cadre flottant sur un
    // telephone vole de la place utile.
    <div className="flex min-h-screen flex-col bg-neutral-0 lg:bg-neutral-50">
      <header className="flex flex-none items-center gap-3 px-4 pt-12 lg:h-16 lg:border-b lg:border-neutral-200 lg:bg-neutral-0 lg:px-8 lg:pt-0">
        <MarqueCCD taille={32} />
      </header>

      <main className="flex flex-1 flex-col px-4 pt-6 pb-4 lg:items-center lg:justify-center lg:p-8">
        {/* 40 px de rembourrage sur ecran large : la maquette sort de la
            grille de 8, on la reconstruit. */}
        <div className="flex w-full flex-1 flex-col lg:max-w-[440px] lg:flex-none lg:rounded-lg lg:border lg:border-neutral-200 lg:bg-neutral-0 lg:p-10 lg:shadow-md">
          {children}

          {/* Sur telephone le pied se colle au bas de l'ecran ; dans la carte
              detachee il suit le contenu. La maquette ecrivait 11 px : le
              Socle §7.3 l'interdit — 14 px sur mobile, 13 px sur web, jamais
              en dessous. */}
          <footer className="mt-auto pt-6 text-center text-sm leading-normal text-neutral-400 lg:mt-8 lg:pt-0 lg:text-[0.8125rem]">
            {t("pied")}
            <br />
            {t("confidentiel")}
          </footer>
        </div>
      </main>
    </div>
  );
}

/**
 * Titre principal de l'écran. Un seul `h1` par page.
 *
 * Il descend d'un cran dans la carte detachee — 32 px a plat, 28 px sur ecran
 * large (maquette M1 desktop). C'est l'inverse de `.text-h1` de la charte, qui
 * grandit avec la fenetre : les deux tailles sont donc ecrites ici.
 */
export function TitreAuth({ children }: { children: ReactNode }) {
  return (
    <h1 className="mb-2 text-[2rem] leading-[1.2] font-bold text-neutral-900 lg:text-[1.75rem]">
      {children}
    </h1>
  );
}

/** Phrase d'accroche sous le titre. */
export function AccrocheAuth({ children }: { children: ReactNode }) {
  return (
    <p className="mb-6 text-base leading-normal text-neutral-600 [&_strong]:font-semibold [&_strong]:text-neutral-800">
      {children}
    </p>
  );
}

const TONS_PASTILLE = {
  primaire: "bg-primary-50 text-primary-500",
  succes: "bg-succes-fond text-succes",
  avertissement: "bg-avertissement-fond text-avertissement",
} as const;

/**
 * Bloc centré des écrans de confirmation — M8 écrans 2, 4 et 6.
 * La pastille porte l'icône ; le texte reste lisible seul (charte §8.4).
 */
export function BlocCentre({
  pastille,
  ton = "primaire",
  children,
}: {
  pastille: ReactNode;
  ton?: "primaire" | "succes" | "avertissement";
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={cn(
          "mb-6 flex size-16 shrink-0 items-center justify-center rounded-full",
          TONS_PASTILLE[ton],
        )}
        aria-hidden="true"
      >
        {pastille}
      </span>
      {children}
    </div>
  );
}

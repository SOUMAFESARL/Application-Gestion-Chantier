import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { COULEUR_PRIMAIRE_DEFAUT } from "@/styles/couleurs";

import { Providers } from "./providers";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: {
      default: t("titre"),
      template: t("gabaritTitre"),
    },
    description: t("description"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // `themeColor` est un `<meta>` : il lui faut la valeur en clair, `var(…)` n'y
  // est pas résolu. C'est la seule raison pour laquelle cette couleur existe
  // hors de `tokens.css` — voir `styles/couleurs.ts`, qui dit aussi ce qui
  // reste à faire pour le white-label.
  themeColor: COULEUR_PRIMAIRE_DEFAUT,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `lang` vient de la configuration, jamais d'une constante : c'est ce que
  // lisent les lecteurs d'écran et les correcteurs orthographiques, et c'est
  // le premier endroit qui mentirait le jour où une seconde langue arrive.
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

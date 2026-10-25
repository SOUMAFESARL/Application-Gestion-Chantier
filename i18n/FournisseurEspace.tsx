import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import espaces from "./espaces.json";

export type Espace = keyof typeof espaces;

type Messages = Awaited<ReturnType<typeof getMessages>>;

/**
 * Les messages d'un espace, et eux seuls.
 *
 * Sans `messages`, `NextIntlClientProvider` sérialise **tout** le catalogue dans
 * le HTML : 260 Ko bruts sur chaque page, jusque sur l'écran de connexion. La
 * liste des sections de chaque espace est calculée depuis le code par
 * `scripts/espaces-i18n.mjs` — ne pas la retoucher à la main : relancer le
 * script, que la CI vérifie avant le build.
 *
 * Un fournisseur imbriqué **remplace** les messages de son parent au lieu de
 * s'y ajouter : chaque espace reçoit donc tout ce qu'il lit, y compris les
 * sections du layout racine.
 */
export function messagesDe(espace: Espace, messages: Messages): Messages {
  return Object.fromEntries(
    espaces[espace].filter((section) => section in messages).map((section) => [section, messages[section]]),
  );
}

export async function FournisseurEspace({
  espace,
  children,
}: Readonly<{ espace: Espace; children: ReactNode }>) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messagesDe(espace, messages)}>{children}</NextIntlClientProvider>;
}

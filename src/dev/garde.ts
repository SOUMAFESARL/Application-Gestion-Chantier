/**
 * La garde commune aux outils de test — OUTILS DE DÉVELOPPEMENT, jamais livrés.
 *
 * **Deux verrous, et ils sont indépendants.**
 *
 *   1. `NEXT_PUBLIC_OUTILS_TEST=1` dans `.env.local` — fichier non versionné,
 *      absent de `.env.example`. Un dépôt cloné ne l'a pas ;
 *   2. un nom d'hôte local. La production est `*.ccd-digital.ci`.
 *
 * **Ce n'est délibérément pas `NODE_ENV`.** Le frontend tourne ici sous
 * `next start`, donc en `NODE_ENV=production` **sur la machine de
 * développement** : s'y fier aurait rendu ces outils invisibles chez celui qui
 * en a besoin, tout en donnant l'illusion d'une protection. Pour ce produit,
 * « production » se lit sur le nom d'hôte.
 */

import { useSyncExternalStore } from "react";

/** Premier verrou : une variable qui n'existe que dans un `.env.local`. */
export const OUTILS_TEST_ACTIFS = process.env.NEXT_PUBLIC_OUTILS_TEST === "1";

/** Second verrou : les hôtes de développement. */
function hoteLocal(hote: string): boolean {
  return hote === "localhost" || hote === "127.0.0.1" || hote.endsWith(".localhost");
}

/**
 * Le nom d'hôte n'existe pas au rendu serveur. `useSyncExternalStore` est la
 * forme prévue pour une valeur qui diffère entre serveur et client : il rend
 * l'instantané serveur — `false` — puis celui du client, sans écart
 * d'hydratation et sans `setState` dans un effet, que `react-hooks` refuse.
 *
 * L'hôte ne change jamais sans rechargement : il n'y a rien à écouter, et
 * l'abonnement se désabonne de rien.
 */
const NE_CHANGE_JAMAIS = () => () => {};
const surClient = () => hoteLocal(window.location.hostname);
const surServeur = () => false;

/** `true` seulement si les **deux** verrous sont ouverts. */
export function useOutilsTest(): boolean {
  const local = useSyncExternalStore(NE_CHANGE_JAMAIS, surClient, surServeur);
  return OUTILS_TEST_ACTIFS && local;
}

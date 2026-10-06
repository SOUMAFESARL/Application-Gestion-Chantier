/**
 * La garde commune aux outils de test — OUTILS DE DÉVELOPPEMENT, jamais livrés
 * en production.
 *
 * **Un seul verrou : le build de production.** Le déploiement
 * (`.github/workflows/deploy-cpanel.yml`) — et lui seul — pose
 * `NEXT_PUBLIC_ENVIRONNEMENT=production`. Partout ailleurs (poste de dev,
 * machine ou serveur qui clone le dépôt), les outils sont visibles, sans
 * `.env.local` à recopier ni nom d'hôte `localhost` exigé.
 *
 * Ils peuvent l'être parce qu'aucun ne contourne le serveur : « Voir en tant
 * que… » ne change que l'affichage (les appels partent avec le jeton du DG,
 * Django tranche les droits), et la route de réinitialisation de `ResetTest`
 * n'existe que sur un Django de développement.
 *
 * **Ce n'est délibérément pas `NODE_ENV`.** Le frontend tourne aussi sous
 * `next start`, donc en `NODE_ENV=production`, sur les machines de
 * développement : s'y fier cacherait les outils à ceux qui en ont besoin.
 */

import { useSyncExternalStore } from "react";

const BUILD_PRODUCTION = process.env.NEXT_PUBLIC_ENVIRONNEMENT === "production";

/**
 * Rendu serveur à `false`, puis `true` côté client : `useSyncExternalStore`
 * est la forme prévue pour une valeur qui diffère entre serveur et client,
 * sans écart d'hydratation ni `setState` dans un effet.
 */
const NE_CHANGE_JAMAIS = () => () => {};
const surClient = () => true;
const surServeur = () => false;

/** `true` partout, sauf dans le build de production. */
export function useOutilsTest(): boolean {
  const client = useSyncExternalStore(NE_CHANGE_JAMAIS, surClient, surServeur);
  return client && !BUILD_PRODUCTION;
}

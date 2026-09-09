/**
 * Conservation des jetons.
 *
 * Choix retenu :
 *   · le jeton **d'accès** vit en mémoire — il disparaît à la fermeture de
 *     l'onglet et n'est jamais lisible par un script tiers via le stockage ;
 *   · le jeton **de renouvellement** est en `localStorage`, pour qu'un
 *     rechargement de page ne déconnecte pas l'utilisateur.
 *
 * Ce compromis est assumé et documenté : `localStorage` reste accessible à
 * une injection de script. Le durcissement consiste à déplacer le jeton de
 * renouvellement dans un cookie `httpOnly` + `SameSite=Strict`, ce qui exige
 * une évolution côté backend (pose du cookie à la connexion). À trancher
 * avant la mise en production — voir la stratégie de sécurité.
 */

const CLE_RENOUVELLEMENT = "ccd.jeton_renouvellement";

let jetonAcces: string | null = null;

export function lireJetonAcces(): string | null {
  return jetonAcces;
}

export function ecrireJetonAcces(jeton: string | null): void {
  jetonAcces = jeton;
}

export function lireJetonRenouvellement(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CLE_RENOUVELLEMENT);
}

export function ecrireJetonRenouvellement(jeton: string | null): void {
  if (typeof window === "undefined") return;
  if (jeton) {
    window.localStorage.setItem(CLE_RENOUVELLEMENT, jeton);
  } else {
    window.localStorage.removeItem(CLE_RENOUVELLEMENT);
  }
}

export function effacerJetons(): void {
  jetonAcces = null;
  ecrireJetonRenouvellement(null);
}

export function sessionOuverte(): boolean {
  return Boolean(jetonAcces ?? lireJetonRenouvellement());
}

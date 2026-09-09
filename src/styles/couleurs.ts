/**
 * Les couleurs que le CSS ne peut pas fournir.
 *
 * **La règle reste celle du guide frontend §3 : `tokens.css` déclare les
 * jetons, et rien d'autre ne les déclare.** Ce fichier n'est pas une seconde
 * palette — il n'existe que pour les rares valeurs qu'un `<meta>` doit porter
 * en clair, là où `var(--color-primary-500)` n'a aucun sens.
 *
 * Aujourd'hui il n'y en a qu'une : `themeColor`, qui teinte la barre du
 * navigateur sur mobile.
 *
 * *Pourquoi elle est ici plutôt qu'en dur dans `layout.tsx` : elle y était, et
 * personne ne pouvait le voir. Le `lint` ne lit que le JSX, la charte n'est pas
 * mesurée, et une couleur recopiée dans un fichier que l'on n'ouvre jamais ne
 * diverge pas bruyamment — elle diverge silencieusement.*
 */

/**
 * Terre cuite, la primaire **par défaut** — jumelle de `--color-primary-500`
 * dans `tokens.css`. Les deux se modifient ensemble ; c'est la seule paire du
 * projet dans ce cas, et c'est pour cela qu'elle est commentée des deux côtés.
 *
 * **Ce que ce fichier ne corrige pas.** Chaque entreprise cliente choisit sa
 * teinte parmi six (charte §10), injectée à l'exécution. Un client qui n'a pas
 * pris le terre cuite obtient donc encore la mauvaise couleur de barre de
 * navigateur. La corriger demande une source côté serveur — la personnalisation
 * du tenant — qui n'existe pas encore : le jour où elle existera, c'est
 * `generateViewport()` qui la lira, et cette constante redeviendra ce que son
 * nom dit, un simple défaut.
 */
export const COULEUR_PRIMAIRE_DEFAUT = "#D4652A";

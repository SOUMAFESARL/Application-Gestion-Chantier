import { createTranslator } from "next-intl";

import messages from "../../messages/fr.json";
import { LANGUE_PAR_DEFAUT } from "./langue";

/**
 * Traduire **hors d'un composant React**.
 *
 * `useTranslations` réclame un composant, `getTranslations` un contexte de
 * requête serveur. Restait un angle mort : la couche HTTP. `client.ts` et
 * `erreurs.ts` produisent deux phrases que l'utilisateur lit — « connexion
 * indisponible » et le message de dernier recours quand le serveur n'en donne
 * aucun — et elles étaient écrites en dur, hors de portée du garde-fou du
 * Socle §1.1, qui ne lit que le JSX.
 *
 * **Ce n'est pas une porte de sortie.** Un composant a `useTranslations` ; ce
 * module est réservé à ce qui n'est pas un composant. Le catalogue est importé
 * statiquement, exactement comme dans `i18n/request.ts` et pour la même raison
 * — une seule langue, et Turbopack qui refuse les chemins construits à
 * l'exécution.
 */
export const texte = createTranslator({
  locale: LANGUE_PAR_DEFAUT,
  messages,
});

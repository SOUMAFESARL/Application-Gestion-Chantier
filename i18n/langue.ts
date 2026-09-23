import { fr } from "react-day-picker/locale";

/**
 * La langue de l'application, dans un module que **tout le monde peut lire**.
 *
 * Elle vivait dans `request.ts`, à côté de `getRequestConfig` — donc dans un
 * module réservé au serveur. Un module client qui a besoin de la langue ne
 * pouvait pas l'y prendre sans embarquer `next-intl/server` avec elle.
 */
export const LANGUE_PAR_DEFAUT = "fr";

/**
 * La locale des dates, pour le calendrier et `date-fns`.
 *
 * C'est la locale `date-fns` enrichie par `react-day-picker` de ses libellés
 * d'accessibilité (« mois suivant »…) : un seul objet sert à dessiner le
 * calendrier et à formater la date choisie. Elle suit `LANGUE_PAR_DEFAUT` —
 * une seconde langue se branchera ici, pas dans les composants.
 */
export const LOCALE_CALENDRIER = fr;

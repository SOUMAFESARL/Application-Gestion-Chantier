/**
 * La langue de l'application, dans un module que **tout le monde peut lire**.
 *
 * Elle vivait dans `request.ts`, à côté de `getRequestConfig` — donc dans un
 * module réservé au serveur. Un module client qui a besoin de la langue ne
 * pouvait pas l'y prendre sans embarquer `next-intl/server` avec elle.
 */
export const LANGUE_PAR_DEFAUT = "fr";

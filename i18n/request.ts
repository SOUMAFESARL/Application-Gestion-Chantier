import { getRequestConfig } from "next-intl/server";

import messages from "../messages/fr.json";
import { LANGUE_PAR_DEFAUT } from "./langue";

/**
 * Configuration de la langue, par requête.
 *
 * **V1 : le français, et lui seul.** Ce n'est pas une étape reportée — le
 * Socle Commun §1.1 impose l'architecture d'internationalisation dès le MVP,
 * pour que l'anglais s'ajoute en V2 **sans modifier une ligne de code
 * fonctionnel**. Ce fichier est cette architecture ; il ne fait rien d'autre
 * aujourd'hui que désigner `fr`.
 *
 * Le jour où une seconde langue arrive, la langue se lira ici — préférence de
 * l'utilisateur en base (`utilisateur.langue`), puis `Accept-Language`, puis
 * `fr` par défaut. Aucun composant ne changera.
 */
/** Réexportée pour ne pas casser les imports existants — sa source est `./langue`. */
export { LANGUE_PAR_DEFAUT };

/**
 * Le catalogue est importé **statiquement**, et non par `import()` à gabarit
 * comme le montre `docs/GUIDE_4` : Turbopack refuse de résoudre un chemin
 * construit à l'exécution — « Can't resolve '../messages/fr.json' », alors
 * que le fichier est là. Avec une seule langue, l'import dynamique n'apportait
 * de toute façon rien : il n'y a rien à choisir.
 *
 * Il redeviendra dynamique le jour où une seconde langue arrive, avec le
 * segment de route qui la porte.
 */
export default getRequestConfig(async () => ({
  locale: LANGUE_PAR_DEFAUT,
  messages,
}));

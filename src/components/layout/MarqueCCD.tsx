/**
 * La marque CCD Digital — **un seul rendu, pour toute l'application**.
 *
 * Il en existait quatre versions divergentes : un carré CSS portant la lettre
 * « C » d'une police système dans la barre d'application, le même carré à une
 * autre taille dans le cadre d'authentification, une icône `ph-buildings` dans
 * la maquette M12, et le vrai tracé vectoriel dans `public/icon.svg` — que
 * seuls l'onglet du navigateur et l'écran d'accueil voyaient. La lettre d'une
 * police n'est pas un logo : elle change avec la police disponible.
 *
 * **Le tracé est ici, pas dans une balise `img`.** Une image ne se recolore
 * pas. La pastille reprend `--color-primary-500`, que le white-label réécrit
 * sur `documentElement` — c'est le comportement voulu, il est conservé tel
 * quel.
 *
 * Source du tracé : `public/icon.svg`. Les deux doivent rester identiques ;
 * l'icône d'onglet et l'en-tête montrent le même signe.
 */

import { useTranslations } from "next-intl";

import styles from "./MarqueCCD.module.css";

/** Le signe seul, sans texte. `taille` est en pixels. */
export function LogoCCD({ taille = 36 }: { taille?: number }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={styles.logo}
    >
      <rect width="512" height="512" rx="114" fill="var(--color-primary-500, #D4652A)" />
      <g transform="translate(141.65, 394.0) scale(0.180392, -0.180392) translate(-93.92, 20.00)">
        <path d="M785.6998901367188 -20Q587.68017578125 -20 431.16046142578125 70.07009887695312Q274.6407470703125 160.14019775390625 184.28094482421875 331.1002197265625Q93.921142578125 502.06024169921875 93.921142578125 744Q93.921142578125 987.479736328125 185.09091186523438 1158.7097473144531Q276.26068115234375 1329.9397583007812 433.0503845214844 1419.9698791503906Q589.840087890625 1510 785.6998901367188 1510Q912.7393188476562 1510 1022.4189453125 1474.5700988769531Q1132.0985717773438 1439.1401977539062 1216.9583740234375 1371.0503845214844Q1301.8181762695312 1302.9605712890625 1356.1281433105469 1204.6308898925781Q1410.4381103515625 1106.3012084960938 1427.1982421875 980.5016479492188H1118.403076171875Q1107.8028564453125 1041.84228515625 1079.5624389648438 1089.5827026367188Q1051.322021484375 1137.3231201171875 1008.5115051269531 1170.8433837890625Q965.7009887695312 1204.3636474609375 910.8504943847656 1221.6637573242188Q856 1238.9638671875 792.1796264648438 1238.9638671875Q675.9989013671875 1238.9638671875 588.2480773925781 1180.9534606933594Q500.49725341796875 1122.9430541992188 452.07666015625 1012.502197265625Q403.65606689453125 902.0613403320312 403.65606689453125 744Q403.65606689453125 583.1588134765625 452.8466491699219 472.9879455566406Q502.0372314453125 362.81707763671875 589.2480773925781 306.9266052246094Q676.4589233398438 251.0361328125 791.0996704101562 251.0361328125Q854.9200439453125 251.0361328125 909.5005493164062 268.5662536621094Q964.0810546875 286.09637451171875 1007.4315490722656 319.3866271972656Q1050.7820434570312 352.6768798828125 1079.5624389648438 400.6473083496094Q1108.3428344726562 448.61773681640625 1119.4830322265625 509.49835205078125H1428.2781982421875Q1415.7579345703125 405.7579345703125 1366.5777587890625 310.89813232421875Q1317.3975830078125 216.038330078125 1234.9676818847656 141.23876953125Q1152.5377807617188 66.439208984375 1039.6182861328125 23.2196044921875Q926.6987915039062 -20 785.6998901367188 -20Z" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

/**
 * Le signe, le nom et l'accroche.
 *
 * L'accroche est **« Gestion de Chantier BTP »**, partout. La barre
 * d'application en affichait une autre — « Gestion de chantier » — lue dans un
 * second espace de noms i18n : deux clés, deux textes, une seule marque.
 */
export function MarqueCCD({
  taille = 36,
  compacteSurMobile = false,
  className = "",
}: {
  taille?: number;
  /**
   * Sur téléphone, ne garder que le signe.
   *
   * La barre d'application y masquait l'identité du **client** et gardait
   * celle de l'éditeur en toutes lettres — l'arbitrage inverse de celui qui
   * sert la personne sur un chantier. Les deux tiennent maintenant : CCD se
   * réduit à son carré, le logo du client reste.
   */
  compacteSurMobile?: boolean;
  className?: string;
}) {
  const t = useTranslations("marque");

  return (
    <span className={`${styles.marque} ${className}`}>
      <LogoCCD taille={taille} />
      <span className={`${styles.texte} ${compacteSurMobile ? styles.texteCompact : ""}`}>
        <span className={styles.nom}>{t("nom")}</span>
        <span className={styles.accroche}>{t("accroche")}</span>
      </span>
    </span>
  );
}

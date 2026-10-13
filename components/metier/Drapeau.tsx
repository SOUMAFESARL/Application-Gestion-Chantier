/**
 * Les drapeaux des pays de l'inscription.
 *
 * Les neuf pays de M8 sont **dessinés dans le code**, ci-dessous. Les autres
 * pays d'Afrique viennent de `country-flag-icons` : des SVG embarqués dans le
 * bundle, donc la même garantie hors réseau — et dessiner à la main 45
 * drapeaux d'armoiries (Mozambique, Eswatini…) n'aurait rien gagné.
 * L'import nommé garde l'arbre élagué : seuls ces drapeaux-là sont livrés.
 *
 * Pour les neuf premiers, trois solutions existaient, deux ont été écartées :
 *
 * * **l'emoji drapeau** (`🇨🇮`) — Windows ne le rend pas : il affiche « CI » en
 *   deux lettres. C'est la machine de bureau du client, pas un cas de bord ;
 * * **une image distante** (bibliothèque de drapeaux sur CDN) — une requête
 *   réseau par champ, et un chantier travaille sans réseau ;
 * * **du SVG en dur**, ci-dessous : aucune requête, net à toutes les tailles,
 *   et neuf pays tiennent en un fichier.
 *
 * Ce sont des drapeaux **simplifiés** : bandes, étoiles, proportions 3:2. Les
 * armoiries et devises ne sont pas reproduites — à 20 px de large, elles ne
 * sont qu'une tache, et ce n'est pas ce qui aide à reconnaître un pays dans une
 * liste déroulante.
 *
 * Ils sont **décoratifs** : `aria-hidden`, et le nom du pays est toujours écrit
 * à côté. Un drapeau seul ne dit rien à un lecteur d'écran, et n'est pas non
 * plus lisible pour tout le monde.
 */

import {
  AO,
  BI,
  BW,
  CD,
  CF,
  CG,
  CV,
  DJ,
  DZ,
  EG,
  ER,
  ET,
  GH,
  GM,
  GQ,
  GW,
  KE,
  KM,
  LR,
  LS,
  LY,
  MA,
  MG,
  MR,
  MU,
  MW,
  MZ,
  NA,
  NE,
  NG,
  RW,
  SC,
  SD,
  SL,
  SO,
  SS,
  ST,
  SZ,
  TD,
  TN,
  TZ,
  UG,
  ZA,
  ZM,
  ZW,
} from "country-flag-icons/react/3x2";

/** Les drapeaux de la bibliothèque, par code ISO. */
const BIBLIOTHEQUE: Record<string, typeof DZ> = {
  AO, BI, BW, CD, CF, CG, CV, DJ, DZ, EG, ER, ET, GH, GM, GQ, GW, KE, KM, LR, LS, LY, MA, MG, MR, MU, MW, MZ, NA, NE, NG, RW, SC, SD, SL, SO, SS, ST, SZ, TD, TN, TZ, UG, ZA, ZM, ZW,
};

const ETOILE =
  "M0,-1 L0.2245,-0.309 L0.9511,-0.309 L0.3633,0.118 " +
  "L0.5878,0.809 L0,0.382 L-0.5878,0.809 L-0.3633,0.118 " +
  "L-0.9511,-0.309 L-0.2245,-0.309 Z";

/** Une étoile à cinq branches, centrée et mise à l'échelle. */
function Etoile({ x, y, rayon, couleur }: { x: number; y: number; rayon: number; couleur: string }) {
  return (
    <path d={ETOILE} fill={couleur} transform={`translate(${x} ${y}) scale(${rayon})`} />
  );
}

/** Trois bandes verticales — le drapeau le plus courant de la région. */
function Verticales({ couleurs }: { couleurs: [string, string, string] }) {
  return (
    <>
      <rect width="1" height="2" x="0" fill={couleurs[0]} />
      <rect width="1" height="2" x="1" fill={couleurs[1]} />
      <rect width="1" height="2" x="2" fill={couleurs[2]} />
    </>
  );
}

/** Trois bandes horizontales. */
function Horizontales({ couleurs }: { couleurs: [string, string, string] }) {
  return (
    <>
      <rect width="3" height="0.6667" y="0" fill={couleurs[0]} />
      <rect width="3" height="0.6667" y="0.6667" fill={couleurs[1]} />
      <rect width="3" height="0.6666" y="1.3333" fill={couleurs[2]} />
    </>
  );
}

const DESSINS: Record<string, () => React.ReactElement> = {
  CI: () => <Verticales couleurs={["#F77F00", "#FFFFFF", "#009E60"]} />,

  SN: () => (
    <>
      <Verticales couleurs={["#00853F", "#FDEF42", "#E31B23"]} />
      <Etoile x={1.5} y={1} rayon={0.42} couleur="#00853F" />
    </>
  ),

  CM: () => (
    <>
      <Verticales couleurs={["#007A5E", "#CE1126", "#FCD116"]} />
      <Etoile x={1.5} y={1} rayon={0.42} couleur="#FCD116" />
    </>
  ),

  BF: () => (
    <>
      <rect width="3" height="1" y="0" fill="#EF2B2D" />
      <rect width="3" height="1" y="1" fill="#009E49" />
      <Etoile x={1.5} y={1} rayon={0.42} couleur="#FCD116" />
    </>
  ),

  ML: () => <Verticales couleurs={["#14B53A", "#FCD116", "#CE1126"]} />,

  TG: () => (
    <>
      <rect width="3" height="2" fill="#FFCE00" />
      <rect width="3" height="0.4" y="0" fill="#006A4E" />
      <rect width="3" height="0.4" y="0.8" fill="#006A4E" />
      <rect width="3" height="0.4" y="1.6" fill="#006A4E" />
      <rect width="1.2" height="1.2" fill="#D21034" />
      <Etoile x={0.6} y={0.6} rayon={0.4} couleur="#FFFFFF" />
    </>
  ),

  BJ: () => (
    <>
      <rect width="3" height="1" y="0" fill="#FCD116" />
      <rect width="3" height="1" y="1" fill="#E8112D" />
      <rect width="1.2" height="2" fill="#008751" />
    </>
  ),

  GN: () => <Verticales couleurs={["#CE1126", "#FCD116", "#009460"]} />,

  GA: () => <Horizontales couleurs={["#009E60", "#FCD116", "#3A75C4"]} />,
};

interface Props {
  /** Code ISO à deux lettres. Un code inconnu ne rend rien. */
  code: string;
  /** Largeur en pixels ; la hauteur suit les proportions 3:2. */
  largeur?: number;
  className?: string;
}

export function Drapeau({ code, largeur = 20, className }: Props) {
  const iso = (code || "").trim().toUpperCase();
  const dessin = DESSINS[iso];
  const Importe = BIBLIOTHEQUE[iso];
  if (!dessin && !Importe) return null;

  return (
    <svg
      viewBox="0 0 3 2"
      width={largeur}
      height={(largeur * 2) / 3}
      className={className}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {dessin ? (
        dessin()
      ) : (
        // Imbriqué dans le même cadre 3:2 pour hériter du liseré ci-dessous.
        <Importe width="3" height="2" preserveAspectRatio="none" />
      )}
      {/* Un liseré sombre : sans lui, la bande blanche du drapeau ivoirien
          disparaît dans le fond blanc du champ. */}
      <rect width="3" height="2" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.06" />
    </svg>
  );
}

import { LogoCCD } from "./MarqueCCD";

/**
 * Le logo paramétré de la plateforme, ou le signe CCD à défaut.
 *
 * Une `img` et non `next/image` : le logo est une URL du serveur (ou une
 * `data:` URL sous simulation), de dimensions inconnues, dont l'optimiseur
 * de Next n'aurait rien à tirer.
 */
export function LogoPlateforme({ logo, taille = 28 }: { logo: string | null | undefined; taille?: number }) {
  if (!logo) return <LogoCCD taille={taille} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      width={taille}
      height={taille}
      className="block shrink-0 rounded-md object-contain"
    />
  );
}

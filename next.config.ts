import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Produit un serveur Node.js autonome, adapté au déploiement cPanel.
  output: "standalone",
  // Renvoie la console du navigateur dans le terminal de `next dev` : c'est
  // ce qui y fait apparaître les lignes `[api] GET …` de `lib/api/client.ts`,
  // les appels partant du navigateur et non du serveur.
  logging: {
    browserToTerminal: true,
  },
  images: {
    // 72 : qualité utilisée par PanneauMarque (CadreAuthDouble) pour la
    // photo de fond ; 75 est la valeur par défaut de Next.js.
    qualities: [72, 75],
  },
  // **Les pages ne restent qu'une minute dans le cache de l'hébergeur.** Next
  // envoie `s-maxage=31536000` sur les pages prérendues : le Varnish de LWS les
  // gardait donc un an, et servait l'ancienne version après chaque déploiement
  // (constaté le 25/10/2026 : `/connexion` en cache depuis 75 min, avant le
  // déploiement qui l'avait divisée par huit). Une minute garde l'essentiel du
  // gain, puisque Varnish répond sans réveiller Node, et une version reste en
  // retard deux minutes au plus, `stale-while-revalidate` compris.
  //
  // `/_next/` est exclu : ses fichiers portent une empreinte dans leur nom, et
  // Next les sert de toute façon en `immutable`. `/api/` aussi : `/api/sante`
  // ne doit jamais être mise en cache, elle fixe son propre `no-store`.
  async headers() {
    return [
      {
        source: "/((?!_next/|api/).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=60",
          },
        ],
      },
    ];
  },
  // L'écran des collaborateurs a quitté `/parametres/utilisateurs` : les
  // favoris et les liens déjà envoyés doivent continuer d'y mener.
  async redirects() {
    return [
      {
        source: "/parametres/utilisateurs",
        destination: "/parametres/collaborateurs",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Produit un serveur Node.js autonome, adapté au déploiement cPanel.
  output: "standalone",
  images: {
    // 72 : qualité utilisée par PanneauMarque (CadreAuthDouble) pour la
    // photo de fond ; 75 est la valeur par défaut de Next.js.
    qualities: [72, 75],
  },
};

export default withNextIntl(nextConfig);

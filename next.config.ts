import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Produit un serveur Node.js autonome, adapté au déploiement cPanel.
  output: "standalone",
};

export default withNextIntl(nextConfig);

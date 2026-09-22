/**
 * Tailwind v4 n'a plus de fichier de configuration JavaScript : le thème se
 * déclare en CSS, dans `app/globals.css` (`@theme inline`). Ce fichier est
 * donc le seul branchement restant — le greffon PostCSS.
 */
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;

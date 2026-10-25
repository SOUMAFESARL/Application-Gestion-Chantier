#!/usr/bin/env node
/**
 * Les sections du catalogue (`messages/fr.json`) dont chaque espace a besoin.
 *
 * Sans découpage, `NextIntlClientProvider` sérialisait **les 39 sections** dans
 * le HTML de chaque page — 260 Ko bruts, 66 Ko compressés, jusque sur l'écran de
 * connexion (mesuré en production le 25/10/2026). Chaque espace ne reçoit plus
 * que les siennes ; cette liste dit lesquelles.
 *
 * Elle est **calculée**, pas tenue à la main : un oubli afficherait la clé brute
 * à l'écran, et ni ESLint ni le typage ne le verraient. Le script part des pages
 * et layouts de chaque espace, suit les imports, et relève les espaces de noms
 * de `useTranslations("…")` et `getTranslations("…")` dans chaque fichier atteint.
 *
 *   node scripts/espaces-i18n.mjs            écrit i18n/espaces.json
 *   node scripts/espaces-i18n.mjs --verifier échoue si i18n/espaces.json est périmé
 *
 * `--verifier` tourne en CI avant le build.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(RACINE, "app");
const SORTIE = join(RACINE, "i18n", "espaces.json");
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs"];
const FICHIERS_DE_ROUTE = /^(page|layout|template|loading|error|not-found|default)\.(tsx|ts|jsx|js)$/;

/**
 * Chaque espace a son propre `NextIntlClientProvider`. `racine` couvre ce que le
 * layout racine enveloppe sans autre provider : il doit rester **petit**, car un
 * provider imbriqué remplace les messages de son parent au lieu de s'y ajouter
 * (`use-intl`, `IntlProvider`) — ses sections voyagent donc aussi sur les pages
 * des autres espaces.
 */
const ESPACES = {
  racine: (chemin) =>
    !/^\((entreprise|admin|admin-auth|public)\)/.test(chemin) && !chemin.startsWith("design-system"),
  entreprise: (chemin) => chemin.startsWith("(entreprise)"),
  administration: (chemin) => chemin.startsWith("(admin)"),
  administrationConnexion: (chemin) => chemin.startsWith("(admin-auth)"),
  public: (chemin) => chemin.startsWith("(public)"),
  designSystem: (chemin) => chemin.startsWith("design-system"),
};

function parcourir(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? parcourir(chemin) : [chemin];
  });
}

function resoudre(depuis, specifiant) {
  let base;
  if (specifiant.startsWith("@/")) base = join(RACINE, specifiant.slice(2));
  else if (specifiant.startsWith(".")) base = resolve(dirname(depuis), specifiant);
  else return null; // paquet npm : hors du catalogue
  const candidats = [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => join(base, "index" + e))];
  return candidats.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

const IMPORTS = /(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;
const ESPACES_DE_NOMS = /(?:useTranslations|getTranslations)\(\s*(?:\{[^}]*namespace:\s*)?["'`]([A-Za-z0-9_]+)/g;
const SANS_ESPACE_DE_NOMS = /(?:useTranslations|getTranslations)\(\s*\)/;

const lecture = new Map();
function analyser(fichier) {
  if (!lecture.has(fichier)) {
    const source = readFileSync(fichier, "utf8");
    const imports = [...source.matchAll(IMPORTS)]
      .map((m) => resoudre(fichier, m[1] ?? m[2] ?? m[3]))
      .filter(Boolean);
    const sections = new Set([...source.matchAll(ESPACES_DE_NOMS)].map((m) => m[1]));
    if (SANS_ESPACE_DE_NOMS.test(source)) {
      throw new Error(
        `${relative(RACINE, fichier)} : useTranslations() sans espace de noms — impossible de savoir ` +
          "quelles sections il lit. Nommer l'espace de noms.",
      );
    }
    lecture.set(fichier, { imports, sections });
  }
  return lecture.get(fichier);
}

function sectionsAtteintes(entrees) {
  const vus = new Set();
  const sections = new Set();
  const pile = [...entrees];
  while (pile.length) {
    const fichier = pile.pop();
    if (vus.has(fichier)) continue;
    vus.add(fichier);
    const { imports, sections: locales } = analyser(fichier);
    locales.forEach((s) => sections.add(s));
    pile.push(...imports);
  }
  return sections;
}

const catalogue = JSON.parse(readFileSync(join(RACINE, "messages", "fr.json"), "utf8"));
const routes = parcourir(APP).filter((f) => FICHIERS_DE_ROUTE.test(f.split(/[\\/]/).pop()));
const layoutRacine = join(APP, "layout.tsx");

const resultat = {};
for (const [espace, appartient] of Object.entries(ESPACES)) {
  const entrees = routes.filter((f) => f !== layoutRacine && appartient(relative(APP, f).replaceAll("\\", "/")));
  // Le layout racine (Providers, SurveillantSession, Toaster) s'affiche dans tous les espaces.
  const sections = sectionsAtteintes([layoutRacine, ...entrees]);
  const inconnues = [...sections].filter((s) => !(s in catalogue));
  if (inconnues.length) {
    throw new Error(`Espace ${espace} : sections absentes de messages/fr.json : ${inconnues.join(", ")}`);
  }
  resultat[espace] = [...sections].sort();
}

const contenu = JSON.stringify(resultat, null, 2) + "\n";
if (process.argv.includes("--verifier")) {
  const actuel = existsSync(SORTIE) ? readFileSync(SORTIE, "utf8").replace(/\r\n/g, "\n") : "";
  if (actuel !== contenu) {
    console.error("i18n/espaces.json est périmé : lancer `node scripts/espaces-i18n.mjs` et commiter le résultat.");
    process.exit(1);
  }
  console.log("i18n/espaces.json est à jour.");
} else {
  writeFileSync(SORTIE, contenu);
  for (const [espace, sections] of Object.entries(resultat)) {
    const poids = sections.reduce((total, s) => total + JSON.stringify(catalogue[s]).length, 0);
    console.log(`${espace.padEnd(15)} ${String(sections.length).padStart(2)} sections  ${Math.round(poids / 1024)} Ko`);
  }
}

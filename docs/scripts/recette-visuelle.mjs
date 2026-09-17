/**
 * Recette visuelle — capture des ecrans de reference.
 *
 * C'est le seul etalon dont dispose la refonte : il n'y a pas de test (O6), et
 * le critere de reussite du lot 1 est litteralement « rien n'a change a
 * l'ecran ». Une comparaison a l'oeil, deux semaines plus tard, ne vaut rien ;
 * une capture rejouable, oui.
 *
 * Usage :
 *   npm run recette:capture                      -> docs/recette/avant/
 *   npm run recette:capture -- --dossier=apres   -> docs/recette/apres/
 *   npm run recette:capture -- --ecran=connexion (filtre, sous-chaine)
 *
 * Prealables :
 *   1. le frontend tourne sur --base (par defaut http://demo.localhost:3000) ;
 *   2. l'API du tenant `demo` repond sur le meme hote, port 8000 — c'est le
 *      sous-domaine qui designe le tenant (voir lib/api/client.ts), donc on
 *      passe par `demo.localhost` et jamais par `localhost` tout court ;
 *   3. NEXT_PUBLIC_API_SIMULE=1 pour les ecrans d'onboarding.
 *
 * Comparer deux jeux :
 *   les PNG sont versionnes ; `git diff --stat docs/recette/` suffit a voir
 *   quels ecrans ont bouge, et l'apercu d'image de l'interface Git a montrer
 *   en quoi.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

// --- Parametres --------------------------------------------------------------

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [cle, ...reste] = a.slice(2).split("=");
      return [cle, reste.length ? reste.join("=") : "1"];
    }),
);

const BASE = (args.base ?? "http://demo.localhost:3000").replace(/\/$/, "");
const DOSSIER = args.dossier ?? "avant";
const FILTRE = args.ecran ?? null;
const RACINE = path.resolve("docs", "recette", DOSSIER);

const IDENTIFIANTS = {
  email: args.email ?? "admin@demo.ci",
  motDePasse: args.motdepasse ?? "Demo1234!",
};

/**
 * Les trois largeurs de la charte. La plus etroite compte autant que les
 * autres : l'application est consultee sur un chantier, pas sur un bureau.
 */
const LARGEURS = [
  { nom: "1440", viewport: { width: 1440, height: 900 } },
  { nom: "768", viewport: { width: 768, height: 1024 } },
  { nom: "390", viewport: { width: 390, height: 844 } },
];

/**
 * Un jeton syntaxiquement plausible mais invalide : les ecrans a lien
 * (activation, invitation, definition de mot de passe) affichent leur
 * formulaire nominal tant qu'ils n'ont pas soumis. C'est cet etat-la qu'on
 * veut en reference, pas l'ecran « lien absent ».
 */
const JETON_FACTICE = "recette-visuelle-jeton-non-valide";

// --- Catalogue des ecrans ----------------------------------------------------

/**
 * `session` : l'ecran exige une session ouverte.
 * `prepare` : pilotage supplementaire avant la capture (assistant a etapes).
 */
const ECRANS = [
  { nom: "01-connexion", url: "/connexion" },
  { nom: "02-inscription", url: "/inscription" },
  { nom: "03-mot-de-passe-oublie", url: "/mot-de-passe/oublie" },
  { nom: "04-mot-de-passe-definir", url: `/mot-de-passe/definir#jeton=${JETON_FACTICE}` },
  { nom: "05-activation", url: `/activation#jeton=${JETON_FACTICE}` },
  { nom: "06-invitation", url: `/invitation#jeton=${JETON_FACTICE}` },
  { nom: "07-not-found", url: "/cette-route-n-existe-pas" },
  { nom: "08-design-system", url: "/design-system" },
  { nom: "09-configuration-1-entreprise", url: "/configuration", session: true },
  {
    nom: "10-configuration-2-projet",
    url: "/configuration",
    session: true,
    prepare: (page) => avancerConfiguration(page, 1),
  },
  {
    nom: "11-configuration-3-equipe",
    url: "/configuration",
    session: true,
    prepare: (page) => avancerConfiguration(page, 2),
  },
  {
    nom: "12-configuration-4-confirmation",
    url: "/configuration",
    session: true,
    prepare: (page) => avancerConfiguration(page, 3),
  },
  { nom: "13-tableau-de-bord", url: "/tableau-de-bord", session: true },
  { nom: "14-projets", url: "/projets", session: true },
  { nom: "15-projet-detail", url: "/projets", session: true, prepare: ouvrirPremierProjet },
  { nom: "16-parametres-roles", url: "/parametres/roles", session: true },
  { nom: "17-parametres-utilisateurs", url: "/parametres/utilisateurs", session: true },
];

// --- Pilotage ----------------------------------------------------------------

/**
 * L'attente ne peut pas etre un `networkidle` seul : 18 ecrans chargent leurs
 * donnees dans un `useEffect` (A6), donc le reseau redevient actif apres
 * l'hydratation. On attend la fin du reseau, puis on laisse retomber les
 * animations — sans quoi deux captures du meme ecran different.
 */
async function stabiliser(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function seConnecter(page) {
  await page.goto(`${BASE}/connexion`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/adresse email/i).fill(IDENTIFIANTS.email);
  await page.getByLabel(/^mot de passe/i).fill(IDENTIFIANTS.motDePasse);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 20000 });
  await stabiliser(page);
}

/**
 * Avance l'assistant de configuration de `n` etapes.
 *
 * L'etape « entreprise » n'a pas de bouton « passer » — elle doit etre
 * remplie. Les deux suivantes en ont un. Sous `NEXT_PUBLIC_API_SIMULE=1`,
 * l'etat vit en memoire du module : un rechargement remet l'assistant a zero,
 * ce qui rend la sequence reproductible.
 */
async function avancerConfiguration(page, n) {
  for (let rang = 0; rang < n; rang += 1) {
    if (rang === 0) {
      await remplirEtapeEntreprise(page);
    } else {
      const passer = page.getByRole("button", { name: /passer/i }).first();
      await passer.click();
    }
    await stabiliser(page);
  }
}

async function remplirEtapeEntreprise(page) {
  await page.getByLabel(/nom de l/i).fill("Entreprise de recette");
  await page.getByLabel(/adresse compl/i).fill("Zone industrielle, Treichville");
  await page.getByLabel(/^ville/i).fill("Abidjan");
  await page.keyboard.press("Enter").catch(() => {});
  await page.getByLabel(/rccm/i).fill("CI-ABJ-2024-B-00000");
  await page.getByLabel(/nif/i).fill("0000000A");
  await page.getByLabel(/t.l.phone/i).fill("0700000000");
  await page.getByLabel(/email de contact/i).fill("contact@recette.ci");
  await page.getByRole("button", { name: /continuer/i }).click();
}

async function ouvrirPremierProjet(page) {
  const lien = page.locator('a[href^="/projets/"]').first();
  await lien.waitFor({ timeout: 10000 });
  await lien.click();
  await page.waitForURL(/\/projets\/[^/]+$/, { timeout: 15000 });
  await stabiliser(page);
}

// --- Boucle principale -------------------------------------------------------

async function main() {
  const echecs = [];
  const navigateur = await chromium.launch();

  for (const largeur of LARGEURS) {
    const dossier = path.join(RACINE, largeur.nom);
    await mkdir(dossier, { recursive: true });

    const contexte = await navigateur.newContext({
      viewport: largeur.viewport,
      deviceScaleFactor: 1,
      locale: "fr-FR",
      timezoneId: "Africa/Abidjan",
      // Fige l'animation pour que deux captures du meme ecran soient egales.
      reducedMotion: "reduce",
    });
    const page = await contexte.newPage();

    let sessionOuverte = false;

    for (const ecran of ECRANS) {
      if (FILTRE && !ecran.nom.includes(FILTRE)) continue;

      const cible = path.join(dossier, `${ecran.nom}.png`);
      try {
        if (ecran.session && !sessionOuverte) {
          await seConnecter(page);
          sessionOuverte = true;
        }
        if (!ecran.session && sessionOuverte) {
          await contexte.clearCookies();
          await page.goto(`${BASE}/connexion`, { waitUntil: "domcontentloaded" });
          await page.evaluate(() => window.localStorage.clear());
          sessionOuverte = false;
        }

        await page.goto(`${BASE}${ecran.url}`, { waitUntil: "domcontentloaded" });
        await stabiliser(page);
        if (ecran.prepare) await ecran.prepare(page);

        await page.screenshot({ path: cible, fullPage: true });
        console.log(`  ok   ${largeur.nom}/${ecran.nom}.png`);
      } catch (erreur) {
        // Un echec ne doit jamais produire une capture silencieusement fausse :
        // on le nomme, et l'ecran reste a capturer a la main.
        echecs.push(`${largeur.nom}/${ecran.nom} : ${erreur.message.split("\n")[0]}`);
        console.log(`  ECHEC ${largeur.nom}/${ecran.nom} — ${erreur.message.split("\n")[0]}`);
      }
    }

    await contexte.close();
  }

  await navigateur.close();

  const rapport = [
    `# Recette visuelle — ${DOSSIER}`,
    "",
    `Base : ${BASE}`,
    `Date : ${new Date().toISOString()}`,
    `Largeurs : ${LARGEURS.map((l) => l.nom).join(", ")}`,
    // Une passe filtree ne reprend qu'une partie du catalogue : sans cette
    // mention, son rapport se lirait comme celui d'une passe complete et
    // effacerait la trace des ecrans restes non captures.
    ...(FILTRE ? [`Passe partielle : seuls les ecrans contenant « ${FILTRE} »`] : []),
    "",
    echecs.length
      ? "## Ecrans non captures automatiquement"
      : FILTRE
        ? "## Tous les ecrans du filtre ont ete captures"
        : "## Tous les ecrans ont ete captures",
    "",
    ...echecs.map((e) => `- ${e}`),
    "",
  ].join("\n");
  await writeFile(path.join(RACINE, "RAPPORT.md"), rapport, "utf8");

  console.log(`\n${echecs.length} echec(s). Rapport : docs/recette/${DOSSIER}/RAPPORT.md`);
  process.exitCode = 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

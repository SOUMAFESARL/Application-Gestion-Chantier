import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import i18next from "eslint-plugin-i18next";

/**
 * Socle Commun §1.1 — aucun texte affiché à l'utilisateur n'est écrit dans le
 * code. La règle était inscrite dans `CLAUDE.md` et dans le guide frontend, et
 * ne reposait que sur la discipline : au moment où ce garde-fou est posé, le
 * dépôt comptait **173 chaînes en dur dans 39 fichiers**, et le compte montait
 * à chaque écran livré.
 *
 * `mode: "jsx-only"` couvre le texte JSX **et** les attributs — `libelle`,
 * `placeholder`, `titre`, `aria-label`. C'est là que vit la quasi-totalité du
 * texte affiché. Le mode `all` y ajouterait les chemins d'API, les noms de
 * classes et les clés d'objets : le bruit ferait ignorer les avertissements,
 * et un garde-fou qu'on ignore ne garde rien.
 *
 * **En erreur**, parce que le compte est à zéro. La règle a été posée en
 * avertissement le temps de résorber les 303 chaînes — un `lint` rouge d'un
 * coup ne se lit plus, et un garde-fou qu'on ignore ne garde rien. La dette
 * étant soldée, il n'y a plus de raison de tolérer la suivante : une chaîne
 * en dur casse désormais le `lint`, et c'est tout l'intérêt.
 */
const ATTRIBUTS_TECHNIQUES = [
  // Exclusions par défaut du greffon, reprises parce que les redéclarer
  // remplace la liste au lieu de l'étendre.
  "className",
  "styleName",
  "style",
  "type",
  "key",
  "id",
  "width",
  "height",
  // Propres au projet : des valeurs d'énumération, pas des phrases.
  "variante",
  "taille",
  "motif",
  // Les mêmes, côté shadcn : les primitives générées parlent anglais, et leurs
  // props sont des noms de variantes (« icon-sm », « outline »).
  "variant",
  "size",
  // `data-slot` est le crochet de style des primitives shadcn — un sélecteur.
  "data-slot",
  // `sizes` de next/image : une liste de media queries, pas une phrase.
  "sizes",
  "name",
  "autoComplete",
  "href",
  "src",
  "rel",
  "target",
  "htmlFor",
  "as",
  "role",
  "inputMode",
  "pattern",
  "accept",
  "weight",
  "spellCheck",
  "autoCapitalize",
  "enterKeyHint",
  // Les `aria-*` qui portent un état, pas une phrase. `aria-label` est
  // volontairement absent de cette liste : il est lu à voix haute.
  "aria-hidden",
  "aria-live",
  "aria-pressed",
  "aria-modal",
  "aria-current",
  "aria-labelledby",
  "aria-describedby",
];

/**
 * Ce qui n'est pas une phrase.
 *
 * Ces deux listes remplacent celles du greffon au lieu de les étendre : les
 * valeurs par défaut sont donc reprises ici, sans quoi elles disparaîtraient
 * et le bruit reviendrait par une autre porte.
 */
const CALLEES_TECHNIQUES = [
  // Défauts du greffon.
  "i18n(ext)?",
  "t",
  "require",
  "addEventListener",
  "removeEventListener",
  "postMessage",
  "getElementById",
  "dispatch",
  "commit",
  "includes",
  "indexOf",
  "endsWith",
  "startsWith",
  // `t.rich` rend un morceau de JSX, `t.raw` une chaîne brute : ce sont des
  // traductions, pas des littéraux à traduire.
  "t\\.(rich|raw|markup|has)",
  // Navigation : l'argument est une route, pas une phrase.
  "push",
  "replace",
  "prefetch",
];

const MOTS_NON_TRADUISIBLES = [
  // Défauts du greffon : ponctuation seule, et constantes en capitales.
  "[0-9!-/:-@[-`{-~]+",
  "[A-Z_-]+",
  // Une route — « /tableau-de-bord », « /projets/[id] ».
  "^/[\\w\\-/[\\]]*$",
  // Un masque de saisie — des puces, pas des mots.
  "^[•\\s]+$",
  // Un identifiant : discriminant d'état, code d'énumération, clé d'objet.
  // Un libellé français commence par une majuscule ou contient une espace ;
  // un mot seul tout en minuscules n'est pas du texte affiché.
  "^[a-z][a-zA-Z0-9_]*$",
];

/**
 * Les lettres accentuées du français, plus l'apostrophe typographique.
 *
 * Le test d'une phrase française, réduit à ce qui ne peut pas être technique.
 */
const LETTRES_ACCENTUEES = "àâäæçèéêëîïôöùûüœÀÂÇÈÉÊÎÔÙ’";

/**
 * Interdire la **forme statique** de la métadonnée — troisième angle mort.
 *
 * Il vivait dans son propre bloc de configuration, pour `app/**` ; la
 * règle du quatrième angle mort, déclarée plus largement et plus bas,
 * **remplaçait** ce bloc au lieu de s'y ajouter : ESLint fusionne par règle,
 * pas par sélecteur. Les deux sont donc désormais dans la même déclaration.
 */
const SELECTEUR_METADONNEES = {
  selector:
    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name="metadata"]',
  message:
    "Métadonnées en dur — Socle Commun §1.1. Utiliser `generateMetadata()` avec `getTranslations`.",
};

/**
 * Les trois signatures d'une phrase française.
 *
 * L'accent seul ne suffisait pas : *« La ville est requise. »* n'en porte
 * aucun, et c'était l'un des messages de validation écrits en dur. Il fallait
 * donc reconnaître aussi **la phrase ponctuée** et **le libellé en capitales
 * initiales** — les deux formes que prennent un message d'erreur et une
 * entrée de tableau de libellés.
 *
 * *Les trois tests ont été mesurés sur le dépôt avant d'être adoptés : hors
 * des fichiers de données listés plus bas, ils ne signalent rien. Pas une
 * valeur CSS, pas un sélecteur, pas un code d'énumération. Un garde-fou qui
 * crie à tort est un garde-fou qu'on désactive.*
 */
const SIGNATURES_PHRASE = [
  // Une lettre accentuée, ou l'apostrophe typographique. Aucun code technique
  // n'en porte : une route, une classe CSS, une clé s'écrivent en ASCII.
  `[${LETTRES_ACCENTUEES}]`,
  // Une phrase : commence par une lettre, contient une espace, finit sur une
  // ponctuation forte. C'est la forme de tous les messages de validation.
  /^[A-Za-z].*\s.*[.!?]$/.source,
  // Un libellé : un premier mot capitalisé, puis d'autres mots. C'est la forme
  // d'une entrée de tableau de libellés — « Conducteur de Travaux ».
  /^[A-Z][a-z]+(\s[A-Za-z0-9À-ÿ'’()\-]+)+$/.source,
];

const MESSAGE_TEXTE_EN_DUR =
  'Texte français en dur — Socle Commun §1.1. Passer par t("…") dans un composant, ' +
  "ou par `texte()` de `@/i18n/horsReact` en dehors.";

/**
 * Les dossiers de code applicatif, depuis que `src/` a disparu et que
 * l'application vit à la racine du dépôt.
 *
 * Ils sont nommés un par un plutôt que par un glob racine : à la racine, un
 * glob attraperait aussi les fichiers de configuration (`next.config.ts`) et
 * les scripts de `docs/`, dont les littéraux ne sont pas du texte d'interface.
 */
const DOSSIERS_SOURCE =
  "{app,components,dev,features,hooks,i18n,lib,styles,types}/**/*.{ts,tsx}";

/** Le message du garde-fou de couche d'acces aux donnees — lot 4. */
const MESSAGE_COUCHE_DONNEES =
  "Appel HTTP depuis un ecran : passer par features/<domaine>/adaptateur.ts.";

/**
 * Un identifiant `snake_case` importe dans un ecran, c'est une charge utile de
 * serveur qui a franchi la couche domaine. Les types du domaine s'ecrivent en
 * francais et en camelCase ; le `snake_case` ne vit que dans l'adaptateur.
 */
const SELECTEUR_IMPORT_SNAKE_CASE = {
  selector: "ImportSpecifier[imported.name=/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/]",
  message: "Identifiant HTTP importe dans un ecran : passer par la couche domaine.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": { exclude: ATTRIBUTS_TECHNIQUES },
          callees: { exclude: CALLEES_TECHNIQUES },
          words: { exclude: MOTS_NON_TRADUISIBLES },
          message: 'Texte en dur — Socle Commun §1.1. Passer par t("…").',
        },
      ],
    },
  },
  {
    /**
     * **Le quatrième angle mort.** `mode: "jsx-only"` ne voit que le JSX. Il
     * ne voit donc pas une phrase construite en JavaScript — et c'est là que
     * vivait la moitié du texte affiché de l'application :
     *
     * * `trouvees.ville = "La ville est requise."` — tous les messages de
     *   validation des quatre formulaires du produit ;
     * * `setErreurLogo("Le logo dépasse 2 Mo.")`, `alert("Erreur lors…")` ;
     * * `MODULES_CCD`, `ROLES_OPTIONS`, `PALETTE_OFFICIELLE`, `MOIS` — quatre
     *   tableaux de libellés, soit le premier angle mort que le guide
     *   frontend §1 nommait déjà sans que rien ne le surveille ;
     * * les deux phrases de la couche HTTP, hors de tout composant.
     *
     * *L'en-tête de ce fichier annonçait « la dette étant soldée ». Elle ne
     * l'était que pour ce que la règle regardait : **122 chaînes** restaient,
     * dans 15 fichiers, et le compte remontait à chaque écran livré. Le seul
     * garde-fou qui tient est celui qui ne dépend pas de la forme du code.*
     *
     * On interdit donc **le caractère accentué dans un littéral**, quelle que
     * soit sa place. Aucun code technique n'en porte : une route, un code
     * d'énumération, une clé d'objet, une classe CSS s'écrivent en ASCII. Une
     * phrase française, non — ce qui rend le test aussi simple que fiable.
     *
     * Les fichiers listés plus bas en sont exemptés : ils portent des
     * **données**, pas des libellés d'interface.
     */
    files: [DOSSIERS_SOURCE],
    rules: {
      "no-restricted-syntax": [
        "error",
        SELECTEUR_METADONNEES,
        ...SIGNATURES_PHRASE.flatMap((motif) => [
          { selector: `Literal[value=/${motif}/]`, message: MESSAGE_TEXTE_EN_DUR },
          { selector: `TemplateElement[value.raw=/${motif}/]`, message: MESSAGE_TEXTE_EN_DUR },
        ]),
      ],
    },
  },
  {
    /**
     * **La couche d'acces aux donnees ne se contourne pas.**
     *
     * Un ecran qui appelle `api.lire("/tiers/")` est un ecran a rouvrir le
     * jour ou la route change, et il n'existe alors plus aucun endroit ou
     * lire les appels d'un domaine. C'est exactement ce que faisait
     * `ModalCreationProjet`, et ce que cette regle empeche de refaire.
     *
     * Seuls `features/<domaine>/adaptateur.ts` (et les `api.ts` qui restent a
     * renommer) parlent au client HTTP. Un ecran importe l'adaptateur, jamais
     * le client. `ErreurApi`, les jetons et les evenements de session restent
     * accessibles : ce sont des types et des outils, pas des appels.
     */
    files: ["app/**/*.ts", "app/**/*.tsx", "components/**/*.ts", "components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/api",
              importNames: ["api", "apiAdministration", "apiPlateforme", "appeler"],
              message: MESSAGE_COUCHE_DONNEES,
            },
            {
              name: "@/lib/api/client",
              importNames: ["api", "apiAdministration", "apiPlateforme", "appeler"],
              message: MESSAGE_COUCHE_DONNEES,
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        SELECTEUR_METADONNEES,
        SELECTEUR_IMPORT_SNAKE_CASE,
        ...SIGNATURES_PHRASE.flatMap((motif) => [
          { selector: `Literal[value=/${motif}/]`, message: MESSAGE_TEXTE_EN_DUR },
          { selector: `TemplateElement[value.raw=/${motif}/]`, message: MESSAGE_TEXTE_EN_DUR },
        ]),
      ],
    },
  },
  {
    /**
     * Ce qui porte des **données** et non des libellés.
     *
     * Chaque exemption est un fichier, jamais un dossier, et chacune a sa
     * raison : une exemption qu'on ne peut pas justifier en une ligne est une
     * exemption de trop.
     */
    files: [
      // Référentiels : les villes des neuf pays d'inscription et les
      // indicatifs téléphoniques. Des noms propres et des codes, qui ne se
      // traduisent jamais — `villes.ts` est en outre **généré** par
      // « manage.py generer_referentiel_villes ».
      "features/referentiels/villes.ts",
      "features/referentiels/telephone.ts",
      // Couche de simulation : elle imite les messages du serveur pour que les
      // écrans se relisent sans API. Rien n'en sort en production.
      "lib/api/simulation.ts",
      // Meme role pour le back-office de la plateforme, dont aucun endpoint
      // n'existe encore : le module rejoue les messages du serveur.
      "lib/api/simulationAdministration.ts",
      "features/auth/api.ts",
      "features/configuration/api.ts",
      // Le tableau de bord DG de démonstration, en attendant sa route :
      // noms de fournisseurs, d'articles et d'échéances de chantier.
      "features/tableauDeBord/simulationTableauDeBord.ts",
      // Le portefeuille de chantiers de démonstration, en attendant
      // « GET /projets/ » : des noms de chantiers, de clients et de personnes.
      "features/projets/simulationProjets.ts",
      // La matrice de rôles de démonstration, en attendant « GET /roles/ » :
      // des libellés et descriptions de rôles, et les messages du serveur.
      "features/roles/simulationRoles.ts",
      // L'équipe de démonstration, en attendant « GET /collaborateurs/ ».
      "features/invitations/simulationCollaborateurs.ts",
      // Rejoue les endpoints d'invitation, en attendant qu'ils existent.
      "features/invitations/simulationInvitations.ts",
      // `[id]` ne s'écrit pas tel quel : pour le filtre de fichiers, les
      // crochets d'une route dynamique sont une classe de caractères — ils y
      // désignent « i ou d ». Un seul niveau de segment suffit à la désigner.
      "app/(app)/projets/*/page.tsx",
      // Le catalogue lui-même, et la langue.
      "i18n/**",
    ],
    // Le garde-fou des métadonnées reste, lui : ces fichiers portent des
    // données, ce qui ne les autorise pas à écrire un titre de page en dur.
    rules: { "no-restricted-syntax": ["error", SELECTEUR_METADONNEES] },
  },
  {
    // La page de démonstration du design system montre les composants, pas
    // un écran du produit : ses libellés sont des noms de variantes.
    files: ["app/design-system/**"],
    rules: {
      "i18next/no-literal-string": "off",
      "no-restricted-syntax": ["error", SELECTEUR_METADONNEES],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".kilo/**",
  ]),
]);

export default eslintConfig;

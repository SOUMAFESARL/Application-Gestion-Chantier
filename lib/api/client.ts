/**
 * Client d'API — une fine couche autour de `fetch`.
 *
 * Ce que ce module prend en charge, pour que 19 écrans n'aient pas à le
 * refaire chacun de leur côté :
 *   · l'adresse de base, dépendante du sous-domaine du client ;
 *   · l'en-tête `Authorization` ;
 *   · le **renouvellement du jeton sur 401**, avec une seule tentative en
 *     vol — sinon dix requêtes simultanées déclenchent dix renouvellements
 *     concurrents et se déconnectent mutuellement ;
 *   · la lecture du format d'erreur unique (conventions §5) ;
 *   · la panne réseau, distinguée d'une erreur applicative.
 *
 * Axios n'est pas utilisé : Next.js instrumente `fetch` pour son cache, et
 * en sortir coûterait plus que ça ne rapporte.
 */

import { depuisReponse, ErreurApi } from "./erreurs";
import { texte } from "@/i18n/horsReact";
import {
  ecrireJetonAcces,
  ecrireJetonRenouvellement,
  effacerJetons,
  expirationJetonAcces,
  lireJetonAcces,
  lireJetonRenouvellement,
  surChangementJetons,
} from "./jetons";
import type { EspaceSession } from "./jetons";

const PREFIXE = "/api/v1";

/** La connexion du back-office : un 401 y est un refus d'identifiants, pas un jeton périmé. */
const CHEMIN_CONNEXION_ADMIN = "/admins/connexion/";

/**
 * Surcharge explicite de l'adresse de l'API — **à n'employer qu'en dernier
 * recours.**
 *
 * Elle **épingle le frontend sur un seul tenant**. C'est ce qu'elle faisait en
 * développement, et le défaut qui en découlait est instructif : après son
 * inscription, un nouveau client suivait `url_connexion` jusqu'à
 * `<son-slug>.localhost:3000` — et l'écran de connexion interrogeait l'API de
 * `demo`, où son compte n'existe pas. *Mêmes identifiants : `401` chez demo,
 * `200` chez lui.* Le compte existait ; il était demandé au mauvais client.
 */
const SURCHARGE = process.env.NEXT_PUBLIC_API_URL;

/**
 * Port de l'API, quand il diffère de celui du frontend.
 *
 * **C'est toute la difficulté du développement local** : le frontend écoute sur
 * `3000` et l'API sur `8000`, si bien que l'hôte du navigateur ne suffit pas à
 * désigner l'API. En production les deux partagent l'hôte **et** le port ;
 * cette variable est alors absente et rien ne s'y substitue.
 */
const PORT_API = process.env.NEXT_PUBLIC_API_PORT;

/**
 * Le domaine de la plateforme — `localhost` en développement,
 * `ccd-digital.ci` en production. Pendant du `DOMAINE_PRINCIPAL` de Django.
 *
 * Il est **déclaré** plutôt que déduit du nom d'hôte : retirer « le premier
 * label » marcherait sur `sotra.ccd-digital.ci` et échouerait sur
 * `sotra.localhost`, qui n'en a que deux. Une heuristique qui dépend du nombre
 * de points est une heuristique qui casse au premier changement de domaine.
 */
const DOMAINE_PLATEFORME = process.env.NEXT_PUBLIC_DOMAINE_PRINCIPAL ?? "localhost";

/**
 * L'adresse de base, déduite du sous-domaine du client.
 *
 * Le sous-domaine **est** l'identité du tenant : c'est lui que
 * `TenantMainMiddleware` lit pour résoudre le schéma. Le même build sert donc
 * toutes les entreprises — `sotra.ccd-digital.ci` appelle
 * `sotra.ccd-digital.ci`, et en développement `sotra.localhost:3000` appelle
 * `sotra.localhost:8000`.
 */
function baseApi(): string {
  if (SURCHARGE) return SURCHARGE;
  // Rendu serveur : pas de `window`. Le schéma public est la seule cible sûre.
  if (typeof window === "undefined") return "http://localhost:8000";

  const { protocol, hostname, host } = window.location;
  return PORT_API ? `${protocol}//${hostname}:${PORT_API}` : `${protocol}//${host}`;
}

type Methode = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * Émis quand le renouvellement du jeton échoue — la session est finie.
 *
 * Le client ne redirige pas lui-même : router depuis une couche HTTP la
 * rendrait inutilisable hors navigateur (rendu serveur, tests, mobile).
 * Il signale, et l'application décide — voir `SurveillantSession`.
 */
export const EVENEMENT_SESSION_EXPIREE = "ccd:session-expiree";

/**
 * Le meme signal, pour la session de l'administrateur de plateforme.
 *
 * **Deux noms d'evenement plutot qu'un seul porteur d'un `detail`** : un
 * auditeur qui oublie de lire le `detail` reagit aux deux espaces, et le
 * defaut est silencieux — l'administrateur se ferait renvoyer vers
 * `/connexion`, l'ecran de connexion des entreprises, parce qu'une requete
 * d'un autre onglet a echoue. Un nom distinct rend l'oubli impossible.
 */
export const EVENEMENT_SESSION_ADMIN_EXPIREE = "ccd:session-admin-expiree";

const EVENEMENTS_EXPIRATION: Record<EspaceSession, string> = {
  entreprise: EVENEMENT_SESSION_EXPIREE,
  administration: EVENEMENT_SESSION_ADMIN_EXPIREE,
};

function signalerSessionExpiree(espace: EspaceSession): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENEMENTS_EXPIRATION[espace]));
  }
}

interface Options {
  /**
   * Adresse de base explicite. Sert aux endpoints du **domaine plateforme** —
   * l'inscription, la facturation — qui ne vivent pas sur le sous-domaine
   * d'un client : au moment de s'inscrire, on n'en a pas encore.
   */
  base?: string;
  methode?: Methode;
  corps?: unknown;
  /** Paramètres de requête. Les valeurs nulles sont ignorées. */
  parametres?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** Interdit le renouvellement — utilisé par le renouvellement lui-même. */
  sansRenouvellement?: boolean;
  /**
   * L'espace dont on présente les jetons. `entreprise` par défaut : c'est le
   * cas de tous les appels métier, et le seul défaut qui ne surprend personne.
   */
  espace?: EspaceSession;
}

// --------------------------------------------------------------------------
// Renouvellement : une seule tentative en vol, les autres l'attendent.
// --------------------------------------------------------------------------
const renouvellementsEnCours = new Map<EspaceSession, Promise<boolean>>();

/**
 * Ou renouveler, selon l'espace.
 *
 * L'administration ne peut pas passer par `baseApi()` : celle-ci vise le
 * sous-domaine d'un client, et le compte d'administration n'appartient a
 * aucun client. Presenter son jeton de renouvellement au `/auth/token/refresh/`
 * d'un tenant aurait produit un `401` — donc une deconnexion — pour une
 * raison qui n'a rien a voir avec la validite du jeton.
 */
function urlRenouvellement(espace: EspaceSession): string {
  return espace === "administration"
    ? `${basePlateforme()}${PREFIXE}/admins/token/refresh/`
    : `${baseApi()}${PREFIXE}/auth/token/refresh/`;
}

async function renouvelerJeton(espace: EspaceSession): Promise<boolean> {
  const jetonRenouvellement = lireJetonRenouvellement(espace);
  if (!jetonRenouvellement) {
    signalerSessionExpiree(espace);
    return false;
  }

  let reponse: Response;
  try {
    reponse = await fetch(urlRenouvellement(espace), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: jetonRenouvellement }),
    });
  } catch {
    // **Une panne reseau n'est pas une fin de session.** Sur un chantier, la
    // connexion tombe regulierement ; effacer les jetons parce qu'un appel
    // n'est pas parti deconnecterait l'utilisateur pour une coupure de trente
    // secondes. On echoue sans rien detruire, et la tentative suivante — le
    // minuteur, le retour de l'onglet ou le retour du reseau — reussira.
    return false;
  }

  // Seul un refus explicite du serveur met fin a la session. Un `500` ou un
  // `502` accuse la passerelle, pas le jeton : le conserver laisse sa chance
  // au renouvellement suivant.
  if (reponse.status === 401 || reponse.status === 403 || reponse.status === 400) {
    effacerJetons(espace);
    signalerSessionExpiree(espace);
    return false;
  }

  if (!reponse.ok) {
    return false;
  }

  // Le serveur **pivote** le jeton de renouvellement à chaque appel : celui
  // qui vient de servir est révoqué (T-008 §4). Ne conserver que `access`
  // rejouerait indéfiniment un jeton mort — la session tomberait au premier
  // renouvellement suivant, soit trente minutes après la connexion.
  const donnees = (await reponse.json()) as { access: string; refresh?: string };
  ecrireJetonAcces(donnees.access, espace);
  if (donnees.refresh) {
    ecrireJetonRenouvellement(donnees.refresh, espace);
  }
  return true;
}

/**
 * Un renouvellement en vol **par espace**, et non un pour les deux.
 *
 * La mutualisation protege de dix renouvellements concurrents sur une meme
 * session ; elle n'a aucun sens entre deux sessions distinctes, ou elle
 * ferait attendre l'une le resultat de l'autre — et lui rendrait un `true`
 * qui ne parle pas de son jeton.
 */
export function renouvellementPartage(
  espace: EspaceSession = "entreprise",
): Promise<boolean> {
  let enCours = renouvellementsEnCours.get(espace);
  if (!enCours) {
    enCours = renouvelerJeton(espace).finally(() => {
      renouvellementsEnCours.delete(espace);
    });
    renouvellementsEnCours.set(espace, enCours);
  }
  return enCours;
}

// --------------------------------------------------------------------------
// Renouvellement proactif : la session dure tant que le serveur l'accepte.
// --------------------------------------------------------------------------

/**
 * Marge prise sur l'echeance du jeton d'acces.
 *
 * Renouveler une minute avant l'expiration plutot qu'apres supprime la seule
 * fenetre ou une requete part avec un jeton mort — celle qui produisait le
 * `401`, le renouvellement en catastrophe, et l'ecran de connexion quand ce
 * renouvellement-la tombait en meme temps que trois autres.
 */
const MARGE_RENOUVELLEMENT_MS = 60 * 1000;

/** Repli quand l'echeance du jeton est illisible : on repasse dans 5 minutes. */
const PERIODE_PAR_DEFAUT_MS = 5 * 60 * 1000;

/** Une minuterie par espace : leurs jetons n'expirent pas ensemble. */
const minuteries = new Map<EspaceSession, number>();

function annulerMinuterie(espace: EspaceSession): void {
  const minuterie = minuteries.get(espace);
  if (minuterie !== undefined) {
    window.clearTimeout(minuterie);
    minuteries.delete(espace);
  }
}

function armerMinuterie(espace: EspaceSession): void {
  if (typeof window === "undefined") return;
  annulerMinuterie(espace);
  if (!lireJetonRenouvellement(espace)) return;

  const echeance = expirationJetonAcces(espace);
  const delai =
    echeance === null
      ? PERIODE_PAR_DEFAUT_MS
      : Math.max(0, echeance - Date.now() - MARGE_RENOUVELLEMENT_MS);

  minuteries.set(
    espace,
    window.setTimeout(() => {
      minuteries.delete(espace);
      void renouvellementPartage(espace).then((succes) => {
        // Un echec non fatal — reseau coupe, passerelle en vrac — laisse les
        // jetons en place : on retente, sans rien casser.
        if (!succes && lireJetonRenouvellement(espace)) {
          minuteries.set(
            espace,
            window.setTimeout(() => armerMinuterie(espace), PERIODE_PAR_DEFAUT_MS),
          );
        }
      });
    }, delai),
  );
}

/**
 * Maintient la session ouverte aussi longtemps que le serveur l'accepte.
 *
 * Renouvelle le jeton d'acces avant son echeance, et rattrape le retard au
 * retour de l'onglet ou du reseau : une machine mise en veille voit ses
 * minuteurs suspendus, et c'est exactement le cas ou l'utilisateur revient
 * devant un jeton perime.
 */
export function demarrerRenouvellementAuto(
  espace: EspaceSession = "entreprise",
): () => void {
  if (typeof window === "undefined") return () => {};

  const rattraper = () => {
    if (!lireJetonRenouvellement(espace)) return;
    const echeance = expirationJetonAcces(espace);
    if (echeance === null || echeance - Date.now() <= MARGE_RENOUVELLEMENT_MS) {
      void renouvellementPartage(espace);
      return;
    }
    armerMinuterie(espace);
  };

  const surReveil = () => {
    if (document.visibilityState === "visible") rattraper();
  };

  // Le planificateur d'un espace ignore les mouvements de l'autre : sans ce
  // filtre, une connexion a l'administration rearmerait la minuterie de
  // l'entreprise sur l'echeance d'un jeton qui n'est pas le sien.
  const desabonner = surChangementJetons((espaceModifie) => {
    if (espaceModifie === espace) armerMinuterie(espace);
  });
  window.addEventListener("visibilitychange", surReveil);
  window.addEventListener("focus", rattraper);
  window.addEventListener("online", rattraper);

  rattraper();

  return () => {
    desabonner();
    annulerMinuterie(espace);
    window.removeEventListener("visibilitychange", surReveil);
    window.removeEventListener("focus", rattraper);
    window.removeEventListener("online", rattraper);
  };
}

// --------------------------------------------------------------------------

function construireUrl(chemin: string, parametres?: Options["parametres"], base?: string): string {
  const url = new URL(`${PREFIXE}${chemin}`, base ?? baseApi());
  if (parametres) {
    for (const [cle, valeur] of Object.entries(parametres)) {
      if (valeur !== null && valeur !== undefined && valeur !== "") {
        url.searchParams.set(cle, String(valeur));
      }
    }
  }
  return url.toString();
}

/**
 * Journal des appels, en développement seulement.
 *
 * Les requêtes partent du navigateur : elles n'apparaissent dans le terminal
 * de `next dev` que parce que `logging.browserToTerminal` y renvoie la console
 * (`next.config.ts`). En production, rien n'est écrit.
 */
const JOURNALISER = process.env.NODE_ENV === "development";

function journaliser(methode: Methode, url: string, statut: number | string, debut: number): void {
  if (!JOURNALISER) return;
  const duree = Math.round(performance.now() - debut);
  console.info(`[api] ${methode} ${url} -> ${statut} (${duree} ms)`);
}

async function executer(chemin: string, options: Options): Promise<Response> {
  const { methode = "GET", corps, parametres, signal, base, espace = "entreprise" } = options;

  const estFormData = typeof FormData !== "undefined" && corps instanceof FormData;
  const entetes: Record<string, string> = { Accept: "application/json" };
  if (corps !== undefined && !estFormData) entetes["Content-Type"] = "application/json";

  const jeton = lireJetonAcces(espace);
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;

  const url = construireUrl(chemin, parametres, base);
  const debut = performance.now();
  try {
    const reponse = await fetch(url, {
      method: methode,
      headers: entetes,
      body: corps === undefined ? undefined : estFormData ? corps : JSON.stringify(corps),
      signal,
    });
    journaliser(methode, url, reponse.status, debut);
    return reponse;
  } catch (cause) {
    journaliser(methode, url, "echec reseau", debut);
    throw cause;
  }
}

/**
 * Appelle l'API et renvoie le corps désérialisé.
 * Lève une `ErreurApi` sur tout statut d'échec.
 */
export async function appeler<T>(chemin: string, options: Options = {}): Promise<T> {
  let reponse: Response;

  try {
    reponse = await executer(chemin, options);
  } catch (cause) {
    // `fetch` ne rejette que sur une panne réseau ou une annulation.
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ErreurApi("reseau_indisponible", texte("erreurs.reseauIndisponible"), 0);
  }

  // 401 : le jeton d'accès a expiré. On renouvelle une fois, puis on rejoue.
  // Sauf sur la connexion du back-office, où un 401 veut dire « identifiants
  // invalides » : renouveler y rejouerait un mot de passe refusé avec le
  // jeton d'une session précédente.
  if (
    reponse.status === 401 &&
    !options.sansRenouvellement &&
    chemin !== CHEMIN_CONNEXION_ADMIN
  ) {
    const renouvele = await renouvellementPartage(options.espace ?? "entreprise");
    if (renouvele) {
      reponse = await executer(chemin, { ...options, sansRenouvellement: true });
    }
  }

  if (!reponse.ok) {
    const erreur = await depuisReponse(reponse);
    // Un 401 qui survit au renouvellement **n'emporte plus la session a lui
    // seul**. C'est `renouvelerJeton` qui tranche, et lui seul : il est le
    // seul a savoir si le serveur a refuse le jeton de renouvellement ou si
    // l'appel n'est simplement pas parti. Un endpoint qui repond `401` pour
    // une raison qui lui est propre ne deconnecte donc plus personne tant
    // qu'il reste un jeton de renouvellement valide.
    const espace = options.espace ?? "entreprise";
    if (
      erreur.statut === 401 &&
      !chemin.startsWith("/auth/") &&
      chemin !== CHEMIN_CONNEXION_ADMIN &&
      !lireJetonRenouvellement(espace)
    ) {
      effacerJetons(espace);
      signalerSessionExpiree(espace);
    }
    throw erreur;
  }

  if (reponse.status === 204) return undefined as T;
  return (await reponse.json()) as T;
}

/**
 * L'adresse du **domaine plateforme** — schéma `public`.
 *
 * L'inscription, la facturation et l'administration de la plateforme y vivent.
 * Elles ne peuvent pas passer par `baseApi()` : celle-ci vise le sous-domaine
 * d'un client, et une entreprise qui s'inscrit n'en a pas encore.
 *
 * En développement, `localhost:8000` ; en production, le domaine principal.
 */
export function basePlateforme(): string {
  const surcharge = process.env.NEXT_PUBLIC_API_PLATEFORME;
  if (surcharge) return surcharge;
  if (SURCHARGE) return SURCHARGE;
  if (typeof window === "undefined") return "http://localhost:8000";

  const { protocol } = window.location;
  return PORT_API
    ? `${protocol}//${DOMAINE_PLATEFORME}:${PORT_API}`
    : `${protocol}//${DOMAINE_PLATEFORME}`;
}

export const api = {
  lire: <T>(chemin: string, parametres?: Options["parametres"], signal?: AbortSignal) =>
    appeler<T>(chemin, { methode: "GET", parametres, signal }),

  creer: <T>(chemin: string, corps: unknown) =>
    appeler<T>(chemin, { methode: "POST", corps }),

  modifier: <T>(chemin: string, corps: unknown) =>
    appeler<T>(chemin, { methode: "PATCH", corps }),

  supprimer: (chemin: string) => appeler<void>(chemin, { methode: "DELETE" }),
};

/**
 * Le même client, braqué sur le domaine plateforme.
 *
 * Un second objet plutôt qu'un paramètre à chaque appel : l'oubli du paramètre
 * enverrait la requête au sous-domaine d'un client, où la route n'existe pas —
 * et un `404` sur `/inscription/` n'accuse pas la bonne cause.
 */
export const apiPlateforme = {
  lire: <T>(chemin: string, parametres?: Options["parametres"], signal?: AbortSignal) =>
    appeler<T>(chemin, { methode: "GET", parametres, signal, base: basePlateforme() }),

  creer: <T>(chemin: string, corps: unknown) =>
    appeler<T>(chemin, { methode: "POST", corps, base: basePlateforme() }),
};

/**
 * Le client du **back-office de la plateforme** — troisieme objet, et non un
 * parametre de plus sur `apiPlateforme`.
 *
 * Il se distingue de `apiPlateforme` sur deux points, et les deux comptent :
 *
 * · **Il presente les jetons de l'espace `administration`.** `apiPlateforme`
 *   sert l'inscription, qui est **anonyme** : lui faire porter un jeton
 *   d'administrateur enverrait une identite privilegiee a un endpoint public,
 *   sans raison et sans que personne ne s'en apercoive.
 * · **Il ne prefixe rien de plus que `/api/v1`** : les routes du back-office
 *   vivent sous `/admins/`, et l'adaptateur l'ecrit (`"/admins/clients/"`).
 *
 * Il expose les quatre verbes, la ou `apiPlateforme` n'en a que deux : un
 * back-office suspend un client, corrige un abonnement, revoque un acces.
 */
export const apiAdministration = {
  lire: <T>(chemin: string, parametres?: Options["parametres"], signal?: AbortSignal) =>
    appeler<T>(chemin, {
      methode: "GET",
      parametres,
      signal,
      base: basePlateforme(),
      espace: "administration",
    }),

  creer: <T>(chemin: string, corps: unknown) =>
    appeler<T>(chemin, {
      methode: "POST",
      corps,
      base: basePlateforme(),
      espace: "administration",
    }),

  modifier: <T>(chemin: string, corps: unknown) =>
    appeler<T>(chemin, {
      methode: "PATCH",
      corps,
      base: basePlateforme(),
      espace: "administration",
    }),

  supprimer: (chemin: string) =>
    appeler<void>(chemin, {
      methode: "DELETE",
      base: basePlateforme(),
      espace: "administration",
    }),
};

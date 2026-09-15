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
  lireJetonAcces,
  lireJetonRenouvellement,
} from "./jetons";

const PREFIXE = "/api/v1";

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

function signalerSessionExpiree(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
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
}

// --------------------------------------------------------------------------
// Renouvellement : une seule tentative en vol, les autres l'attendent.
// --------------------------------------------------------------------------
let renouvellementEnCours: Promise<boolean> | null = null;

async function renouvelerJeton(): Promise<boolean> {
  const jetonRenouvellement = lireJetonRenouvellement();
  if (!jetonRenouvellement) return false;

  const reponse = await fetch(`${baseApi()}${PREFIXE}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: jetonRenouvellement }),
  });

  if (!reponse.ok) {
    effacerJetons();
    signalerSessionExpiree();
    return false;
  }

  // Le serveur **pivote** le jeton de renouvellement à chaque appel : celui
  // qui vient de servir est révoqué (T-008 §4). Ne conserver que `access`
  // rejouerait indéfiniment un jeton mort — la session tomberait au premier
  // renouvellement suivant, soit trente minutes après la connexion.
  const donnees = (await reponse.json()) as { access: string; refresh?: string };
  ecrireJetonAcces(donnees.access);
  if (donnees.refresh) {
    ecrireJetonRenouvellement(donnees.refresh);
  }
  return true;
}

export function renouvellementPartage(): Promise<boolean> {
  renouvellementEnCours ??= renouvelerJeton().finally(() => {
    renouvellementEnCours = null;
  });
  return renouvellementEnCours;
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

async function executer(chemin: string, options: Options): Promise<Response> {
  const { methode = "GET", corps, parametres, signal, base } = options;

  const estFormData = typeof FormData !== "undefined" && corps instanceof FormData;
  const entetes: Record<string, string> = { Accept: "application/json" };
  if (corps !== undefined && !estFormData) entetes["Content-Type"] = "application/json";

  const jeton = lireJetonAcces();
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;

  return fetch(construireUrl(chemin, parametres, base), {
    method: methode,
    headers: entetes,
    body: corps === undefined ? undefined : estFormData ? corps : JSON.stringify(corps),
    signal,
  });
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
  if (reponse.status === 401 && !options.sansRenouvellement) {
    const renouvele = await renouvellementPartage();
    if (renouvele) {
      reponse = await executer(chemin, { ...options, sansRenouvellement: true });
    }
  }

  if (!reponse.ok) {
    const erreur = await depuisReponse(reponse);
    // Un 401 qui survit au renouvellement : le jeton n'est plus récupérable.
    // Sauf sur la connexion elle-même, où 401 signifie « mauvais mot de
    // passe » et n'a rien à voir avec une session finie.
    if (erreur.statut === 401 && !chemin.startsWith("/auth/token")) {
      effacerJetons();
      signalerSessionExpiree();
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

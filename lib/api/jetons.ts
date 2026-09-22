/**
 * Conservation des jetons, **pour deux espaces distincts**.
 *
 * Le produit a deux espaces : celui d'une entreprise cliente, sur son
 * sous-domaine, et celui de l'administrateur de la plateforme, sur le domaine
 * principal. Les comptes vivent dans **deux tables separees** cote Django :
 * ce ne sont pas deux roles d'un meme utilisateur, ce sont deux identites qui
 * ne se recouvrent jamais.
 *
 * D'ou deux jeux de cles, et non un seul. Partager `ccd.jeton_acces` entre
 * les deux aurait produit exactement le defaut que la separation cherche a
 * eviter : se connecter a l'administration aurait ecrase la session de
 * l'entreprise ouverte dans l'onglet voisin, et le renouvellement automatique
 * aurait presente le jeton de l'une a l'endpoint de l'autre.
 *
 * **Les deux jetons sont persistes dans `localStorage`.** Le jeton d'acces y
 * a rejoint le jeton de renouvellement pour une raison tres concrete : garde
 * en memoire seule, il disparaissait a chaque rechargement de page, si bien
 * que les quatre appels du layout partaient sans en-tete `Authorization`,
 * recevaient quatre `401` simultanes et faisaient dependre la survie de la
 * session d'un unique renouvellement joue au pire moment. Une seule de ces
 * courses perdue, et l'utilisateur relisait « session expiree » alors qu'il
 * venait d'appuyer sur F5.
 *
 * Le compromis est assume : `localStorage` reste lisible par une injection de
 * script, mais le jeton de renouvellement y etait deja — le durcissement reel
 * est le cookie `httpOnly` pose par Django (decision A4 du plan de refonte),
 * pas le maintien du jeton d'acces en memoire, qui ne protegeait rien que le
 * jeton de renouvellement voisin n'exposait deja.
 */

/**
 * L'espace auquel une session appartient.
 *
 * `entreprise` est la valeur par defaut partout : les quelque cent appels
 * existants n'ont pas a la nommer, et c'est aussi le bon defaut pour tout
 * code qui ne se pose pas la question — l'administration, elle, est toujours
 * explicite.
 */
export type EspaceSession = "entreprise" | "administration";

const CLES: Record<EspaceSession, { acces: string; renouvellement: string }> = {
  entreprise: {
    acces: "ccd.jeton_acces",
    renouvellement: "ccd.jeton_renouvellement",
  },
  administration: {
    acces: "ccd.admin.jeton_acces",
    renouvellement: "ccd.admin.jeton_renouvellement",
  },
};

/** Le jeton d'acces en cache, par espace. `undefined` = jamais lu. */
const cacheAcces = new Map<EspaceSession, string | null>();

/** Abonnes prevenus a chaque ecriture — les planificateurs de renouvellement. */
const auditeurs = new Set<(espace: EspaceSession) => void>();

function notifier(espace: EspaceSession): void {
  auditeurs.forEach((auditeur) => auditeur(espace));
}

/**
 * Prevenu a chaque changement de jeton : connexion, renouvellement, purge.
 *
 * C'est ce qui permet au planificateur de renouvellement automatique de se
 * rearmer sans que la connexion ni le client HTTP aient a le connaitre.
 * L'espace concerne est passe a l'auditeur : celui de l'administration n'a
 * rien a rearmer quand c'est la session d'une entreprise qui bouge.
 */
export function surChangementJetons(
  auditeur: (espace: EspaceSession) => void,
): () => void {
  auditeurs.add(auditeur);
  return () => {
    auditeurs.delete(auditeur);
  };
}

export function lireJetonAcces(espace: EspaceSession = "entreprise"): string | null {
  if (!cacheAcces.has(espace)) {
    if (typeof window === "undefined") return null;
    try {
      cacheAcces.set(espace, window.localStorage.getItem(CLES[espace].acces));
    } catch {
      cacheAcces.set(espace, null);
    }
  }
  return cacheAcces.get(espace) ?? null;
}

export function ecrireJetonAcces(
  jeton: string | null,
  espace: EspaceSession = "entreprise",
): void {
  cacheAcces.set(espace, jeton);
  if (typeof window !== "undefined") {
    try {
      if (jeton) {
        window.localStorage.setItem(CLES[espace].acces, jeton);
      } else {
        window.localStorage.removeItem(CLES[espace].acces);
      }
    } catch {
      // Tolerance : navigation privee, quota, stockage bloque.
    }
  }
  notifier(espace);
}

export function lireJetonRenouvellement(
  espace: EspaceSession = "entreprise",
): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CLES[espace].renouvellement);
  } catch {
    return null;
  }
}

export function ecrireJetonRenouvellement(
  jeton: string | null,
  espace: EspaceSession = "entreprise",
): void {
  if (typeof window === "undefined") return;
  try {
    if (jeton) {
      window.localStorage.setItem(CLES[espace].renouvellement, jeton);
    } else {
      window.localStorage.removeItem(CLES[espace].renouvellement);
    }
  } catch {
    // Tolerance.
  }
  notifier(espace);
}

/**
 * Efface les jetons d'**un seul** espace.
 *
 * Se deconnecter de l'administration ne ferme pas la session d'entreprise
 * ouverte a cote, et reciproquement : ce sont deux comptes differents, et
 * rien ne justifie que l'un emporte l'autre.
 */
export function effacerJetons(espace: EspaceSession = "entreprise"): void {
  ecrireJetonAcces(null, espace);
  ecrireJetonRenouvellement(null, espace);
}

export function sessionOuverte(espace: EspaceSession = "entreprise"): boolean {
  return Boolean(lireJetonAcces(espace) ?? lireJetonRenouvellement(espace));
}

/**
 * L'echeance du jeton d'acces, lue dans sa charge utile JWT.
 *
 * Elle sert au renouvellement **proactif** : renouveler avant l'expiration
 * plutot que de la subir sur un `401` evite la seule fenetre ou une requete
 * peut echouer. `null` quand le jeton est absent ou illisible — l'appelant
 * renouvelle alors immediatement, ce qui est le comportement prudent.
 */
export function expirationJetonAcces(
  espace: EspaceSession = "entreprise",
): number | null {
  const jeton = lireJetonAcces(espace);
  if (!jeton) return null;

  const charge = jeton.split(".")[1];
  if (!charge) return null;

  try {
    const base64 = charge.replace(/-/g, "+").replace(/_/g, "/");
    const donnees = JSON.parse(atob(base64)) as { exp?: number };
    return typeof donnees.exp === "number" ? donnees.exp * 1000 : null;
  } catch {
    return null;
  }
}

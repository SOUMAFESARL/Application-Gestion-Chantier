/**
 * De quoi former la clé de brouillon : le schéma et l'utilisateur.
 *
 * `lib/auth/` ne fournit pas encore de contexte de session (guide frontend
 * §14, prévu au Sprint 1). En attendant, les deux valeurs se lisent là où
 * elles sont déjà : le schéma dans le sous-domaine — c'est lui qui détermine
 * le client, décision A5 des conventions —, l'utilisateur dans le jeton de
 * renouvellement.
 *
 * **Le claim `user_id` n'autorise rien ici.** Il ne sert qu'à séparer deux
 * brouillons sur un poste partagé : le serveur reste seul juge des droits, et
 * un jeton falsifié ne donnerait accès qu'à son propre brouillon.
 */

const CLE_RENOUVELLEMENT = "ccd.jeton_renouvellement";

/** Le schéma PostgreSQL actif (lu du jeton JWT ou du sous-domaine). */
export function schemaCourant(): string {
  if (typeof window === "undefined") return "public";
  try {
    const jeton = window.localStorage.getItem(CLE_RENOUVELLEMENT);
    if (jeton) {
      const charge = JSON.parse(atob(jeton.split(".")[1])) as { schema?: string };
      if (charge.schema) return charge.schema;
    }
  } catch {
    // Ignorer si jeton manquant ou illisible
  }
  const [premier, ...reste] = window.location.hostname.split(".");
  return reste.length > 0 ? premier : "public";
}

/** L'identifiant de l'utilisateur connecté, ou `anonyme` s'il n'y en a pas. */
export function utilisateurCourant(): string {
  if (typeof window === "undefined") return "anonyme";
  try {
    const jeton = window.localStorage.getItem(CLE_RENOUVELLEMENT);
    if (!jeton) return "anonyme";
    const charge = JSON.parse(atob(jeton.split(".")[1])) as { user_id?: string };
    return charge.user_id ?? "anonyme";
  } catch {
    // Jeton absent, tronqué ou illisible : le brouillon reste local à l'onglet
    // de toute façon, et une clé approximative ne fait courir aucun risque.
    return "anonyme";
  }
}

/**
 * Ce qui reste de la session cote navigateur : la reprise du travail en cours.
 *
 * **Les deux horloges ont ete retirees.** Il y en avait une d'inactivite
 * (30 min, alertes a 15 et 5 min) et un plafond absolu de 8 h, non
 * prolongeable ; elles decidaient a elles seules de renvoyer l'utilisateur
 * vers la connexion, jetons encore valides, en affichant « session expiree ».
 * C'est une politique de securite que le **serveur** doit tenir s'il la veut,
 * parce qu'il est le seul a pouvoir la faire respecter : un compteur tenu dans
 * `localStorage` se remet a zero en vidant le stockage, il ne protegeait donc
 * personne tout en deconnectant tout le monde. La session dure desormais aussi
 * longtemps que le serveur accepte de renouveler le jeton — voir
 * `demarrerRenouvellementAuto` dans `lib/api/client.ts`.
 *
 * Reste ici la sauvegarde des formulaires ouverts et la route de retour, qui
 * n'ont jamais eu de rapport avec l'expiration : elles servent des qu'une
 * session finit, quelle qu'en soit la cause — y compris un mot de passe change
 * sur un autre poste.
 */

const CLE_RETOUR = "ccd.session.retour";
const PREFIXE_BROUILLON = "ccd.brouillon";

/**
 * Enregistre la route courante et la saisie en cours avant de rendre la main.
 *
 * Les mots de passe et les champs tagues `data-sans-sauvegarde` sont exclus :
 * ce qui est sauvegarde ici survit a la deconnexion, dans un stockage que le
 * navigateur relira sans rien demander.
 */
export function sauvegarderBrouillons(): void {
  if (typeof window === "undefined") return;

  try {
    const routeCourante = window.location.pathname + window.location.search;
    window.sessionStorage.setItem(CLE_RETOUR, routeCourante);

    const formulaires = document.querySelectorAll("form");
    const donneesFormulaire: Record<string, string> = {};

    formulaires.forEach((form) => {
      const elements = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input, textarea, select"
      );
      elements.forEach((el) => {
        if (el.type === "password" || el.hasAttribute("data-sans-sauvegarde")) return;
        const cle = el.name || el.id;
        if (cle && el.value) {
          donneesFormulaire[cle] = el.value;
        }
      });
    });

    if (Object.keys(donneesFormulaire).length > 0) {
      const cleBrouillon = `${PREFIXE_BROUILLON}.${window.location.pathname}`;
      window.sessionStorage.setItem(cleBrouillon, JSON.stringify(donneesFormulaire));
    }
  } catch {
    // Tolerance : ne jamais bloquer sur une exception de stockage.
  }
}

export function restaurerBrouillon(route: string): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const contenu = window.sessionStorage.getItem(`${PREFIXE_BROUILLON}.${route}`);
    return contenu ? JSON.parse(contenu) : null;
  } catch {
    return null;
  }
}

export function purgerBrouillon(route: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${PREFIXE_BROUILLON}.${route}`);
  } catch {
    // Ignorer.
  }
}

export function lireRouteRetour(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(CLE_RETOUR);
  } catch {
    return null;
  }
}

export function purgerRouteRetour(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CLE_RETOUR);
  } catch {
    // Ignorer.
  }
}

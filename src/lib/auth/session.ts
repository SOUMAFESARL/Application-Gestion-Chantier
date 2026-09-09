/**
 * Gestionnaire de session web — DEV-3.1 & DEV-3.3.
 *
 * Spécifié dans `session_web_CCD_Digital.md` (T-010).
 *
 * Tient deux horloges indépendantes :
 *   1. Horloge d'inactivité (30 min max, alertes à 15 min et 5 min) — prolongeable.
 *   2. Horloge de session (8 h de plafond absolu) — non prolongeable.
 *
 * Écoute les actions utilisateur réelles (pointerdown, keydown, touchstart),
 * synchronise les onglets via BroadcastChannel, déclenche le renouvellement
 * proactif du jeton et sauvegarde les formulaires ouverts dans sessionStorage.
 */

import { useEffect, useState } from "react";
import { renouvellementPartage, sessionOuverte } from "@/lib/api";

export type EtatSession =
  | "active"
  | "avertissement"
  | "urgence"
  | "fin_proche"
  | "expiree"
  | "fin_de_session";

export interface Session {
  etat: EtatSession;
  /** Secondes avant la fin, selon l'horloge la plus proche. */
  secondesRestantes: number;
  /** Horloge qui gouverne l'échéance. */
  horloge: "inactivite" | "plafond";
  /** Vrai seulement si l'inactivité gouverne (le plafond 8 h ne se repousse pas). */
  prolongeable: boolean;
}

// ---------------------------------------------------------------------------
// Constantes temporelles (en millisecondes)
// ---------------------------------------------------------------------------
export const DUREE_INACTIVITE_MS = 30 * 60 * 1000; // 30 minutes
export const SEUIL_AVERTISSEMENT_MS = 15 * 60 * 1000; // 15 minutes restantes
export const SEUIL_URGENCE_MS = 5 * 60 * 1000; // 5 minutes restantes
export const PLAFOND_SESSION_MS = 8 * 60 * 60 * 1000; // 8 heures
export const SEUIL_PLAFOND_AVERTISSEMENT_MS = 15 * 60 * 1000; // 15 min avant les 8 h

const AMORTISSEMENT_LOCAL_MS = 1000; // 1 seconde
const AMORTISSEMENT_DIFFUSION_MS = 5000; // 5 secondes

const CLE_DERNIERE_ACTIVITE = "ccd.session.derniere_activite";
const CLE_DEBUT_SESSION = "ccd.session.debut";
const CLE_RETOUR = "ccd.session.retour";
const PREFIXE_BROUILLON = "ccd.brouillon";

type MessageCanal =
  | { type: "activite"; timestamp: number }
  | { type: "renouvele" }
  | { type: "expiree" }
  | { type: "deconnexion" };

// ---------------------------------------------------------------------------
// État singleton en mémoire du navigateur
// ---------------------------------------------------------------------------
let canal: BroadcastChannel | null = null;
let derniereActiviteLocale = Date.now();
let derniereDiffusionActivite = 0;
const auditeurs = new Set<(session: Session) => void>();

function initStockage(): void {
  if (typeof window === "undefined") return;
  const maintenant = Date.now();

  const debutStocke = window.sessionStorage.getItem(CLE_DEBUT_SESSION);
  if (!debutStocke) {
    window.sessionStorage.setItem(CLE_DEBUT_SESSION, String(maintenant));
  }

  const activiteStockee = window.localStorage.getItem(CLE_DERNIERE_ACTIVITE);
  if (!activiteStockee) {
    window.localStorage.setItem(CLE_DERNIERE_ACTIVITE, String(maintenant));
    derniereActiviteLocale = maintenant;
  } else {
    derniereActiviteLocale = Number(activiteStockee) || maintenant;
  }
}

function lireDebutSession(): number {
  if (typeof window === "undefined") return Date.now();
  const debut = window.sessionStorage.getItem(CLE_DEBUT_SESSION);
  return debut ? Number(debut) : Date.now();
}

function lireDerniereActivite(): number {
  if (typeof window === "undefined") return derniereActiviteLocale;
  const val = window.localStorage.getItem(CLE_DERNIERE_ACTIVITE);
  return val ? Math.max(Number(val), derniereActiviteLocale) : derniereActiviteLocale;
}

export function reinitialiserHorlogeActivite(): void {
  if (typeof window === "undefined") return;
  const maintenant = Date.now();
  derniereActiviteLocale = maintenant;
  window.localStorage.setItem(CLE_DERNIERE_ACTIVITE, String(maintenant));
  window.sessionStorage.setItem(CLE_DEBUT_SESSION, String(maintenant));
  notifierAuditeurs();
}

// ---------------------------------------------------------------------------
// Sauvegarde et restauration des brouillons de formulaire (DEV-3.4)
// ---------------------------------------------------------------------------
export function sauvegarderBrouillons(): void {
  if (typeof window === "undefined") return;

  // Enregistre la route courante pour y revenir après reconnexion
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
        // Exclusions strictes : pas de mots de passe ni de champs tagués data-sans-sauvegarde
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
    // Tolérance : ne jamais bloquer sur une exception de stockage
  }
}

export function restaurerBrouillon(route: string): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const cleBrouillon = `${PREFIXE_BROUILLON}.${route}`;
    const contenu = window.sessionStorage.getItem(cleBrouillon);
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
    // Ignorer
  }
}

export function lireRouteRetour(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(CLE_RETOUR);
}

export function purgerRouteRetour(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CLE_RETOUR);
}

// ---------------------------------------------------------------------------
// Calcul de l'état de session
// ---------------------------------------------------------------------------
export function calculerSession(): Session {
  if (typeof window === "undefined" || !sessionOuverte()) {
    return {
      etat: "active",
      secondesRestantes: Math.floor(DUREE_INACTIVITE_MS / 1000),
      horloge: "inactivite",
      prolongeable: true,
    };
  }

  const maintenant = Date.now();
  const debut = lireDebutSession();
  const derniereActivite = lireDerniereActivite();

  const msRestantesInactivite = Math.max(0, derniereActivite + DUREE_INACTIVITE_MS - maintenant);
  const msRestantesPlafond = Math.max(0, debut + PLAFOND_SESSION_MS - maintenant);

  // Le plafond gagne s'il arrive avant l'inactivité
  if (msRestantesPlafond <= 0) {
    return {
      etat: "fin_de_session",
      secondesRestantes: 0,
      horloge: "plafond",
      prolongeable: false,
    };
  }

  if (msRestantesInactivite <= 0) {
    return {
      etat: "expiree",
      secondesRestantes: 0,
      horloge: "inactivite",
      prolongeable: false,
    };
  }

  if (msRestantesPlafond <= msRestantesInactivite) {
    const etat: EtatSession =
      msRestantesPlafond <= SEUIL_PLAFOND_AVERTISSEMENT_MS ? "fin_proche" : "active";
    return {
      etat,
      secondesRestantes: Math.ceil(msRestantesPlafond / 1000),
      horloge: "plafond",
      prolongeable: false,
    };
  }

  let etat: EtatSession = "active";
  if (msRestantesInactivite <= SEUIL_URGENCE_MS) {
    etat = "urgence";
  } else if (msRestantesInactivite <= SEUIL_AVERTISSEMENT_MS) {
    etat = "avertissement";
  }

  return {
    etat,
    secondesRestantes: Math.ceil(msRestantesInactivite / 1000),
    horloge: "inactivite",
    prolongeable: true,
  };
}

function notifierAuditeurs(): void {
  const session = calculerSession();
  auditeurs.forEach((auditeur) => auditeur(session));
}

// ---------------------------------------------------------------------------
// Actions de session
// ---------------------------------------------------------------------------
export function signalerActivite(): void {
  if (typeof window === "undefined" || !sessionOuverte()) return;

  const maintenant = Date.now();
  if (maintenant - derniereActiviteLocale < AMORTISSEMENT_LOCAL_MS) {
    return;
  }

  derniereActiviteLocale = maintenant;
  window.localStorage.setItem(CLE_DERNIERE_ACTIVITE, String(maintenant));

  // Diffusion amortie aux autres onglets
  if (maintenant - derniereDiffusionActivite >= AMORTISSEMENT_DIFFUSION_MS) {
    derniereDiffusionActivite = maintenant;
    diffuser({ type: "activite", timestamp: maintenant });
  }

  notifierAuditeurs();
}

export async function prolonger(): Promise<boolean> {
  const session = calculerSession();
  if (!session.prolongeable) {
    return false;
  }

  const succes = await renouvellementPartage();
  if (succes) {
    const maintenant = Date.now();
    derniereActiviteLocale = maintenant;
    window.localStorage.setItem(CLE_DERNIERE_ACTIVITE, String(maintenant));
    diffuser({ type: "renouvele" });
    notifierAuditeurs();
    return true;
  }
  return false;
}

function diffuser(message: MessageCanal): void {
  if (!canal) return;
  try {
    canal.postMessage(message);
  } catch {
    // Tolérance
  }
}

// ---------------------------------------------------------------------------
// Initialisation globale
// ---------------------------------------------------------------------------
let estInitialise = false;

export function initialiserSession(): () => void {
  if (typeof window === "undefined" || estInitialise) {
    return () => { };
  }
  estInitialise = true;
  initStockage();

  if ("BroadcastChannel" in window) {
    canal = new BroadcastChannel("ccd.session");
    canal.onmessage = (event: MessageEvent<MessageCanal>) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "activite") {
        derniereActiviteLocale = Math.max(derniereActiviteLocale, msg.timestamp);
        notifierAuditeurs();
      } else if (msg.type === "renouvele") {
        derniereActiviteLocale = Date.now();
        notifierAuditeurs();
      } else if (msg.type === "expiree" || msg.type === "deconnexion") {
        notifierAuditeurs();
      }
    };
  }

  // Écouteurs d'activité réelle
  const surActivite = () => signalerActivite();
  window.addEventListener("pointerdown", surActivite, { passive: true });
  window.addEventListener("keydown", surActivite, { passive: true });
  window.addEventListener("touchstart", surActivite, { passive: true });

  // Recalcul immédiat en cas de réveil de veille ou d'onglet
  const surVisibilite = () => {
    if (document.visibilityState === "visible") {
      notifierAuditeurs();
    }
  };
  window.addEventListener("visibilitychange", surVisibilite);
  window.addEventListener("focus", surVisibilite);

  // Minuteur de vérification régulier (toutes les secondes pour la jauge)
  const intervalle = window.setInterval(() => {
    notifierAuditeurs();
  }, 1000);

  return () => {
    window.clearInterval(intervalle);
    window.removeEventListener("pointerdown", surActivite);
    window.removeEventListener("keydown", surActivite);
    window.removeEventListener("touchstart", surActivite);
    window.removeEventListener("visibilitychange", surVisibilite);
    window.removeEventListener("focus", surVisibilite);
    if (canal) {
      canal.close();
      canal = null;
    }
    estInitialise = false;
  };
}

// ---------------------------------------------------------------------------
// Hook React useSession
// ---------------------------------------------------------------------------
export function useSession(): Session {
  const [session, setSession] = useState<Session>(() => calculerSession());

  useEffect(() => {
    const nettoyeur = initialiserSession();

    const auditeur = (nouvelleSession: Session) => {
      setSession(nouvelleSession);
    };

    auditeurs.add(auditeur);

    return () => {
      auditeurs.delete(auditeur);
      if (auditeurs.size === 0) {
        nettoyeur();
      }
    };
  }, []);

  return session;
}

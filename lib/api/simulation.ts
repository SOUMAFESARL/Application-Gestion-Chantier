/**
 * Serveur simulé du parcours d'inscription et d'onboarding.
 *
 * **Pourquoi ce module existe.** Les endpoints de T-021, T-024 et T-025 sont
 * spécifiés et chiffrés (DEV-8, DEV-9, DEV-11, DEV-12) mais pas encore écrits :
 * l'API n'expose aujourd'hui que `/auth/token/`, `/auth/token/refresh/` et
 * `/referentiels/enumerations/`. Sans ce module, les écrans se construiraient
 * sans jamais pouvoir être parcourus — donc sans jamais être vérifiés.
 *
 * **Ce qu'il n'est pas.** Il ne remplace pas le serveur et ne dispense d'aucun
 * développement : il rejoue les **contrats** des spécifications, réponses
 * d'erreur comprises. Le jour où les endpoints existent, `NEXT_PUBLIC_API_SIMULE`
 * passe à `0` et **aucun écran ne change**.
 *
 * **Il ne se cache pas.** Guide frontend §8 : « Un écran non branché sur de
 * vraies données porte un bandeau visible. Aucun jeu de données d'exemple ne
 * doit pouvoir passer pour réel en démonstration devant un prospect. » C'est le
 * rôle de `BandeauSimulation`, qui lit le même drapeau.
 */

import { ErreurApi } from "./erreurs";

/**
 * **Ce drapeau couvre deux domaines** : l'abonnement (T-025) et le
 * **back-office de la plateforme** (`/administration/*`), dont les endpoints
 * ne sont pas écrits.
 *
 * L'inscription, le mot de passe et la configuration de l'entreprise en sont
 * **sortis** — leurs endpoints existent et le client les appelle. Un drapeau
 * unique pour plusieurs domaines a coûté un bandeau menteur sur plusieurs
 * écrans : le jour où l'un d'eux cesse d'être simulé, c'est ici qu'il faut
 * regarder, et sur les écrans qui portent le bandeau.
 *
 * *Le back-office est le cas le plus net des trois : **rien** de
 * `/administration/*` n'existe côté Django aujourd'hui. L'espace entier est
 * rejoué ici, connexion comprise.*
 */
export const SIMULATION_ACTIVE = process.env.NEXT_PUBLIC_API_SIMULE === "1";

const CLE_ETAT = "ccd.simulation.onboarding";

/** Latence simulée — de quoi voir passer l'état de chargement, charte §8.3. */
const LATENCE = 600;

// ---------------------------------------------------------------------------
// L'état, conservé le temps de l'onglet
// ---------------------------------------------------------------------------
interface EtatSimule {
  demandes: Record<
    string,
    {
      id: string;
      raison_sociale: string;
      pays: string;
      email: string;
      jeton: string;
      slug: string;
      statut: "EN_ATTENTE" | "PROVISIONNEMENT" | "PRET";
      activee_le: number | null;
    }
  >;
  /** Adresses déjà titulaires d'un espace — pour la branche §2.4 de T-021. */
  comptes: string[];
}

const INITIAL: EtatSimule = { demandes: {}, comptes: ["deja@sotra-btp.ci"] };

function lireEtat(): EtatSimule {
  if (typeof window === "undefined") return { ...INITIAL };
  try {
    const brut = window.sessionStorage.getItem(CLE_ETAT);
    return brut ? (JSON.parse(brut) as EtatSimule) : { ...INITIAL };
  } catch {
    return { ...INITIAL };
  }
}

function ecrireEtat(etat: EtatSimule): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_ETAT, JSON.stringify(etat));
  } catch {
    // Navigation privée saturée : la simulation perd sa mémoire, sans plus.
  }
}

/**
 * Exportees pour `simulationAdministration.ts`, qui rejoue le meme contrat.
 * Elles restent internes a la couche de simulation : rien d'autre ne les
 * importe, et rien d'autre ne le doit.
 */
export function attendre<T>(valeur: T, delai = LATENCE): Promise<T> {
  return new Promise((resoudre) => setTimeout(() => resoudre(valeur), delai));
}

export function refuser(
  code: string,
  message: string,
  statut: number,
  details: Record<string, string[]> = {},
): never {
  throw new ErreurApi(code, message, statut, details, "SIM-0000000000");
}

// ---------------------------------------------------------------------------
// Dérivation du slug — la vraie règle, T-020 §2.2
// ---------------------------------------------------------------------------
/**
 * Reproduit `deriver_slug` du serveur. **Liste blanche `[a-z0-9]`**, jamais
 * liste noire : c'est ce qui neutralise l'injection du piège P-1, où le
 * validateur de django-tenants accepte `a"; DROP SCHEMA public CASCADE; --`.
 *
 * Côté client ce n'est qu'un aperçu — le serveur reste seul juge (R-60).
 */
export function deriverSlug(raisonSociale: string): string {
  return raisonSociale
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("_")
    .slice(0, 40)
    .replace(/^_+|_+$/g, "");
}

// ---------------------------------------------------------------------------
// Les endpoints de T-021
// ---------------------------------------------------------------------------
export const simulation = {
  /** `POST /inscription/` — §2.3 : `202`, toujours, quelle que soit la branche. */
  async deposerInscription(corps: {
    id: string;
    raison_sociale: string;
    pays: string;
    email: string;
    cgu_acceptees: boolean;
  }) {
    const slug = deriverSlug(corps.raison_sociale);
    if (!slug) {
      refuser("validation", "Certains champs sont invalides.", 400, {
        raison_sociale: [
          "Ce nom ne permet pas de créer une adresse. Proposez une variante en lettres latines.",
        ],
      });
    }

    const etat = lireEtat();
    const email = corps.email.trim().toLowerCase();

    // La réponse est identique que l'adresse existe ou non — R-80. Ce qui
    // change, c'est l'email envoyé, que la simulation se contente de journaliser.
    if (!etat.comptes.includes(email)) {
      etat.demandes[corps.id] = {
        id: corps.id,
        raison_sociale: corps.raison_sociale,
        pays: corps.pays,
        email,
        jeton: `sim-${corps.id}`,
        slug,
        statut: "EN_ATTENTE",
        activee_le: null,
      };
      ecrireEtat(etat);
    }

    return attendre({
      id: corps.id,
      statut: "EN_ATTENTE" as const,
      email,
      expire_dans: 172800,
    });
  },

  /** `POST /inscription/renvoyer/` — `202` même sur un identifiant inconnu. */
  async renvoyerEmail() {
    return attendre({ statut: "EN_ATTENTE" as const });
  },

  /** `POST /inscription/verifier/` — ne consomme pas le jeton (R-83). */
  async verifierJeton(corps: { jeton: string }) {
    const etat = lireEtat();
    const demande = Object.values(etat.demandes).find((d) => d.jeton === corps.jeton);
    if (!demande || demande.statut !== "EN_ATTENTE") {
      refuser("jeton_expire", "Ce lien n’est plus valable.", 410);
    }
    return attendre({
      raison_sociale: demande.raison_sociale,
      email: demande.email,
      pays: demande.pays,
      expire_dans: 154800,
    });
  },

  /** `POST /inscription/activer/` — `202` + identifiant de suivi. */
  async activer(corps: { jeton: string; nom: string; prenom: string; mot_de_passe: string }) {
    const etat = lireEtat();
    const demande = Object.values(etat.demandes).find((d) => d.jeton === corps.jeton);
    if (!demande) {
      refuser("jeton_expire", "Ce lien n’est plus valable.", 410);
    }
    if (demande.statut === "PRET") {
      refuser("inscription_deja_activee", "Cet espace est déjà actif. Connectez-vous.", 409);
    }

    demande.statut = "PROVISIONNEMENT";
    demande.activee_le = Date.now();
    ecrireEtat(etat);

    return attendre({ suivi: demande.id, statut: "PROVISIONNEMENT" as const });
  },

  /** `GET /inscription/etat/{suivi}/` — §7.1 : `200` même sur un échec. */
  async etatProvisionnement(suivi: string) {
    const etat = lireEtat();
    const demande = etat.demandes[suivi];
    if (!demande) {
      refuser("introuvable", "La ressource demandée est introuvable.", 404);
    }

    // Le provisionnement réel prend des secondes : migrations d'un schéma
    // complet (T-020 §3.2). On en simule quatre.
    const ecoule = Date.now() - (demande.activee_le ?? Date.now());
    if (ecoule < 4000) {
      return attendre({ statut: "PROVISIONNEMENT" as const }, 200);
    }

    demande.statut = "PRET";
    ecrireEtat(etat);
    return attendre(
      {
        statut: "PRET" as const,
        url_connexion: "/connexion",
      },
      200,
    );
  },
};

// ---------------------------------------------------------------------------
// Les endpoints de T-025 — essai gratuit
// ---------------------------------------------------------------------------
const CLE_ESSAI = "ccd.simulation.essai";

export interface AbonnementSimule {
  statut: "ESSAI" | "ACTIF" | "SUSPENDU";
  plan: string;
  /** Date de fin d'essai, `YYYY-MM-DD` — MLD §4.4, sans heure. */
  fin_essai: string;
}

function debutEssai(): AbonnementSimule {
  const fin = new Date();
  fin.setDate(fin.getDate() + 14);
  return { statut: "ESSAI", plan: "MAITRE_OEUVRE", fin_essai: fin.toISOString().slice(0, 10) };
}

export const simulationAbonnement = {
  async lire(): Promise<AbonnementSimule> {
    if (typeof window === "undefined") return debutEssai();
    try {
      const brut = window.sessionStorage.getItem(CLE_ESSAI);
      if (brut) return JSON.parse(brut) as AbonnementSimule;
    } catch {
      // On repart d'un essai neuf.
    }
    const neuf = debutEssai();
    try {
      window.sessionStorage.setItem(CLE_ESSAI, JSON.stringify(neuf));
    } catch {
      // Sans mémoire, le compteur repart de 14 à chaque page.
    }
    return neuf;
  },

  /** Réglage de démonstration : place l'échéance à J-n pour voir les seuils. */
  async regler(joursRestants: number): Promise<void> {
    const fin = new Date();
    fin.setDate(fin.getDate() + joursRestants);
    const etat: AbonnementSimule = {
      statut: joursRestants < 0 ? "SUSPENDU" : "ESSAI",
      plan: "MAITRE_OEUVRE",
      fin_essai: fin.toISOString().slice(0, 10),
    };
    try {
      window.sessionStorage.setItem(CLE_ESSAI, JSON.stringify(etat));
    } catch {
      // sans effet
    }
  },
};

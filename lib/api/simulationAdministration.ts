/**
 * Serveur simulé du **back-office de la plateforme** — `/administration/*`.
 *
 * **Rien de ce domaine n'existe côté Django aujourd'hui.** Contrairement au
 * configurateur, où seules les saisies sont simulées, ici l'espace entier
 * l'est : la connexion, le profil, les clients, les abonnements et les
 * indicateurs. Ce module rejoue les contrats qu'on attend du serveur,
 * réponses d'erreur comprises, pour que les écrans du back-office soient
 * parcourables — donc vérifiables — avant que l'API n'existe.
 *
 * Les charges utiles sont en `snake_case`, comme celles du vrai serveur. Sans
 * cela, `features/administration/adaptateur.ts` n'aurait rien à traduire, et
 * la bascule vers les vrais endpoints changerait les écrans — exactement ce
 * que `NEXT_PUBLIC_API_SIMULE` promet d'éviter.
 *
 * Il ne se cache pas : les écrans qu'il alimente portent `BandeauSimulation`.
 */

import { PLANS_DISPONIBLES } from "@/features/abonnement/types";

import { attendre, refuser } from "./simulation";

/**
 * Versionnée : un onglet ouvert avant le passage au catalogue Bâtisseur /
 * Maître d'Œuvre / Promoteur garde en mémoire des clients sur des plans qui
 * n'existent plus, et leur libellé ne se traduirait pas.
 */
const CLE_ADMIN = "ccd.simulation.administration.v2";

/**
 * Le compte de démonstration du back-office.
 *
 * **Exporté, et c'est le but** : l'écran de connexion le pré-remplit tant que
 * `NEXT_PUBLIC_API_SIMULE` vaut `1`. Le seul serveur qui accepte ces
 * identifiants est celui de ce fichier — le jour où `/administration/auth/`
 * existera pour de vrai, le drapeau retombera et le formulaire s'ouvrira
 * vide, sans qu'une ligne de l'écran ne change.
 */
export const ADMIN_DEMO = {
  email: "admin@ccd-digital.ci",
  motDePasse: "Admin1234!",
};

export interface ChargeAbonnementClient {
  statut: "ESSAI" | "ACTIF" | "IMPAYE" | "SUSPENDU" | "RESILIE";
  plan_code: "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR";
  reference_transaction: string;
  montant_mensuel_centimes: number;
  date_debut: string;
  date_fin: string;
  fin_essai: string | null;
  renouvellement_auto: boolean;
}

export interface ChargeClientPlateforme {
  id: string;
  raison_sociale: string;
  nom_commercial: string;
  slug: string;
  pays: string;
  ville: string;
  email_contact: string;
  telephone_contact: string;
  statut: "EN_ATTENTE" | "ACTIF" | "SUSPENDU" | "RESILIE";
  cree_le: string;
  active_le: string | null;
  nb_utilisateurs: number;
  nb_projets: number;
  abonnement: ChargeAbonnementClient;
}

export interface ChargeAdministrateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: "SUPERVISEUR" | "SUPPORT";
}

export interface ChargePointEvolution {
  date: string;
  renouveles: number;
  non_renouveles: number;
}

export type CleIndicateurCharge =
  | "nb_clients"
  | "nb_clients_actifs"
  | "nb_clients_en_essai"
  | "nb_clients_impayes"
  | "revenu_mensuel_centimes";

export interface ChargeTendanceIndicateur {
  cle: CleIndicateurCharge;
  /** Du plus ancien au plus récent ; le dernier point est la valeur du jour. */
  points: number[];
  variation_pourcent: number;
}

function jour(decalage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return d.toISOString().slice(0, 10);
}

/**
 * Le jeu de démonstration.
 *
 * Il est construit pour que **chaque état du back-office soit atteignable** :
 * un abonnement qui court, un essai qui finit dans deux jours, un impayé, un
 * client suspendu, une inscription jamais activée. Un jeu où tout va bien ne
 * montrerait aucun des écrans qui comptent.
 */
function clientsInitiaux(): ChargeClientPlateforme[] {
  return [
    {
      id: "cli-001",
      raison_sociale: "SOTRA BTP",
      nom_commercial: "Sotra BTP",
      slug: "sotra_btp",
      pays: "CI",
      ville: "Abidjan",
      email_contact: "direction@sotra-btp.ci",
      telephone_contact: "+2250707010203",
      statut: "ACTIF",
      cree_le: jour(-420),
      active_le: jour(-419),
      nb_utilisateurs: 38,
      nb_projets: 12,
      abonnement: {
        statut: "ACTIF",
        plan_code: "PROMOTEUR",
        reference_transaction: "TXN-2025-10042",
        montant_mensuel_centimes: 18_900_000,
        date_debut: jour(-419),
        date_fin: jour(311),
        fin_essai: null,
        renouvellement_auto: true,
      },
    },
    {
      id: "cli-002",
      raison_sociale: "ENTREPRISE KOUASSI ET FILS",
      nom_commercial: "Kouassi et Fils",
      slug: "kouassi_et_fils",
      pays: "CI",
      ville: "Bouake",
      email_contact: "contact@kouassi-btp.ci",
      telephone_contact: "+2250505040506",
      statut: "ACTIF",
      cree_le: jour(-12),
      active_le: jour(-12),
      nb_utilisateurs: 6,
      nb_projets: 2,
      abonnement: {
        statut: "ESSAI",
        plan_code: "MAITRE_OEUVRE",
        reference_transaction: "TXN-2026-00871",
        montant_mensuel_centimes: 7_900_000,
        date_debut: jour(-12),
        date_fin: jour(2),
        fin_essai: jour(2),
        renouvellement_auto: false,
      },
    },
    {
      id: "cli-003",
      raison_sociale: "GENIE CIVIL DU SAHEL",
      nom_commercial: "GC Sahel",
      slug: "genie_civil_du_sahel",
      pays: "BF",
      ville: "Ouagadougou",
      email_contact: "admin@gcsahel.bf",
      telephone_contact: "+22670010203",
      statut: "ACTIF",
      cree_le: jour(-200),
      active_le: jour(-199),
      nb_utilisateurs: 21,
      nb_projets: 7,
      abonnement: {
        statut: "IMPAYE",
        plan_code: "MAITRE_OEUVRE",
        reference_transaction: "TXN-2025-09456",
        montant_mensuel_centimes: 7_900_000,
        date_debut: jour(-199),
        date_fin: jour(-9),
        fin_essai: null,
        renouvellement_auto: true,
      },
    },
    {
      id: "cli-004",
      raison_sociale: "BATIR ENSEMBLE SARL",
      nom_commercial: "Batir Ensemble",
      slug: "batir_ensemble",
      pays: "SN",
      ville: "Dakar",
      email_contact: "gerance@batir-ensemble.sn",
      telephone_contact: "+221770102030",
      statut: "SUSPENDU",
      cree_le: jour(-330),
      active_le: jour(-330),
      nb_utilisateurs: 14,
      nb_projets: 4,
      abonnement: {
        statut: "SUSPENDU",
        plan_code: "BATISSEUR",
        reference_transaction: "TXN-2025-08213",
        montant_mensuel_centimes: 2_900_000,
        date_debut: jour(-330),
        date_fin: jour(-45),
        fin_essai: null,
        renouvellement_auto: false,
      },
    },
    {
      id: "cli-005",
      raison_sociale: "NOUVELLE CONSTRUCTION DU GOLFE",
      nom_commercial: "NC Golfe",
      slug: "nc_golfe",
      pays: "TG",
      ville: "Lome",
      email_contact: "info@ncgolfe.tg",
      telephone_contact: "+22890010203",
      statut: "EN_ATTENTE",
      cree_le: jour(-3),
      active_le: null,
      nb_utilisateurs: 0,
      nb_projets: 0,
      abonnement: {
        statut: "ESSAI",
        plan_code: "BATISSEUR",
        reference_transaction: "TXN-2026-00919",
        montant_mensuel_centimes: 2_900_000,
        date_debut: jour(-3),
        date_fin: jour(11),
        fin_essai: jour(11),
        renouvellement_auto: false,
      },
    },
  ];
}

/**
 * L'historique des renouvellements, jour par jour sur trois mois.
 *
 * **Il ne se déduit pas de la liste des clients**, et c'est pour cela qu'il a
 * son propre endpoint : cinq entreprises portent chacune un seul abonnement,
 * dont on ne connaît que l'échéance en cours. Un historique se lit dans le
 * journal des facturations, côté serveur — le calculer ici depuis la liste
 * aurait produit un graphique plat, donc un écran qu'on ne peut pas juger.
 *
 * La série est **déterministe** : la valeur d'un jour tient à sa date, jamais
 * à l'instant du rendu. Un `Math.random()` aurait redessiné la courbe à chaque
 * changement de fenêtre, et l'écran aurait menti sur ce qu'un vrai serveur
 * fait — renvoyer deux fois la même chose.
 *
 * Le creux du week-end est volontaire : c'est la forme qu'a une facturation
 * réelle, et c'est ce qui permet de voir tout de suite si l'axe des dates est
 * juste.
 */
const HISTORIQUE_JOURS = 90;

function pseudoAleatoire(graine: number): number {
  const valeur = Math.sin(graine) * 10_000;
  return valeur - Math.floor(valeur);
}

function evolutionInitiale(): ChargePointEvolution[] {
  const points: ChargePointEvolution[] = [];

  for (let decalage = HISTORIQUE_JOURS - 1; decalage >= 0; decalage -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - decalage);

    const finDeSemaine = date.getDay() === 0 || date.getDay() === 6;
    const creux = finDeSemaine ? 0.3 : 1;
    const graine = Math.floor(date.getTime() / 86_400_000);

    points.push({
      date: date.toISOString().slice(0, 10),
      renouveles: Math.round((5 + pseudoAleatoire(graine) * 9) * creux),
      non_renouveles: Math.round((0.5 + pseudoAleatoire(graine * 7) * 3) * creux),
    });
  }

  return points;
}

/**
 * L'historique mensuel de chaque indicateur de tête.
 *
 * **Le dernier point est toujours la valeur affichée par la tuile**, et c'est
 * la seule contrainte qui compte : une mini-courbe qui se termine ailleurs que
 * sur le chiffre écrit à côté d'elle se voit immédiatement, et décrédibilise
 * les deux. Les mois précédents sont remontés à partir de ce point, jamais
 * l'inverse.
 *
 * Comme la série des renouvellements, elle est **déterministe** : deux lectures
 * de suite donnent la même courbe, comme le ferait un vrai serveur.
 */
const MOIS_HISTORIQUE = 8;

function serieMensuelle(valeurCourante: number, graine: number): number[] {
  if (valeurCourante <= 0) return new Array(MOIS_HISTORIQUE).fill(0);

  const points = [valeurCourante];
  let valeur = valeurCourante;

  for (let rang = 1; rang < MOIS_HISTORIQUE; rang += 1) {
    const facteur = 0.72 + pseudoAleatoire(graine + rang) * 0.56;
    let precedent = Math.max(0, Math.round(valeur / facteur));

    // Sur un parc de cinq clients, un facteur multiplicatif s'arrondit sur
    // lui-meme : la courbe serait plate la ou le chiffre bouge vraiment d'une
    // unite. En dessous de cinq, on bouge donc d'un entier, pas d'un ratio.
    if (precedent === valeur && valeur <= 4) {
      const monte = pseudoAleatoire(graine * 3 + rang) > 0.5;
      precedent = Math.max(0, valeur + (monte ? 1 : -1));
    }

    valeur = precedent;
    points.unshift(valeur);
  }

  return points;
}

function variationPourcent(points: number[]): number {
  const dernier = points[points.length - 1] ?? 0;
  const precedent = points[points.length - 2] ?? 0;
  if (precedent === 0) return dernier === 0 ? 0 : 100;
  return Math.round(((dernier - precedent) / precedent) * 100);
}

function tendancesIndicateurs(
  clients: ChargeClientPlateforme[],
): ChargeTendanceIndicateur[] {
  const valeurs: Record<CleIndicateurCharge, number> = {
    nb_clients: clients.length,
    nb_clients_actifs: clients.filter((client) => client.statut === "ACTIF").length,
    nb_clients_en_essai: clients.filter((client) => client.abonnement.statut === "ESSAI")
      .length,
    nb_clients_impayes: clients.filter((client) => client.abonnement.statut === "IMPAYE")
      .length,
    revenu_mensuel_centimes: clients
      .filter((client) => client.abonnement.statut === "ACTIF")
      .reduce((total, client) => total + client.abonnement.montant_mensuel_centimes, 0),
  };

  return (Object.keys(valeurs) as CleIndicateurCharge[]).map((cle, rang) => {
    const points = serieMensuelle(valeurs[cle], (rang + 1) * 11);
    return { cle, points, variation_pourcent: variationPourcent(points) };
  });
}

function ecrireClients(clients: ChargeClientPlateforme[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_ADMIN, JSON.stringify(clients));
  } catch {
    // Sans mémoire, une suspension ne survit pas au changement d'écran.
  }
}

function lireClients(): ChargeClientPlateforme[] {
  if (typeof window === "undefined") return clientsInitiaux();
  try {
    const brut = window.sessionStorage.getItem(CLE_ADMIN);
    if (brut) return JSON.parse(brut) as ChargeClientPlateforme[];
  } catch {
    // On repart du jeu initial.
  }
  const neuf = clientsInitiaux();
  ecrireClients(neuf);
  return neuf;
}

/**
 * Un jeton qui **ressemble** à un JWT, pour que le renouvellement proactif ait
 * une échéance à lire.
 *
 * Il n'est pas signé et n'ouvre rien : son seul consommateur est
 * `expirationJetonAcces()`, qui lit `exp` dans la charge utile. Sans `exp`, le
 * planificateur retomberait sur son repli de cinq minutes, et le comportement
 * simulé s'écarterait de celui qu'on aura en vrai.
 */
function jetonSimule(dureeSecondes: number): string {
  const encoder = (valeur: object) =>
    btoa(JSON.stringify(valeur))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  return [
    encoder({ alg: "none", typ: "JWT" }),
    encoder({
      user_id: "adm-001",
      type_compte: "PLATEFORME",
      exp: Math.floor(Date.now() / 1000) + dureeSecondes,
    }),
    "simulation",
  ].join(".");
}

const ADMINISTRATEUR_DEMO: ChargeAdministrateur = {
  id: "adm-001",
  email: ADMIN_DEMO.email,
  nom: "MARTIAL",
  prenom: "Seka",
  role: "SUPERVISEUR",
};

/**
 * Le tarif mensuel de chaque plan, **lu dans le catalogue de vente** de
 * l'espace entreprise : un changement de plan au back-office facture le prix
 * affiché sur la page de tarifs, jamais une grille parallèle.
 */
const TARIFS_MENSUELS: Record<string, number> = Object.fromEntries(
  PLANS_DISPONIBLES.map((plan) => [plan.code, plan.prix_mensuel_centimes]),
);

export const simulationAdministration = {
  /** `POST /administration/auth/token/` */
  async seConnecter(corps: { email: string; mot_de_passe: string }) {
    if (
      corps.email.trim().toLowerCase() !== ADMIN_DEMO.email ||
      corps.mot_de_passe !== ADMIN_DEMO.motDePasse
    ) {
      // Réponse indistincte, comme côté tenant (contrat §6.1) : le back-office
      // n'a pas plus de raison de dire quelles adresses existent.
      await attendre(null, 400);
      refuser("identifiants_invalides", "Identifiants invalides.", 401);
    }

    return attendre(
      {
        access: jetonSimule(15 * 60),
        refresh: jetonSimule(8 * 60 * 60),
        administrateur: ADMINISTRATEUR_DEMO,
      },
      500,
    );
  },

  /**
   * `POST /administration/auth/mot-de-passe/oublie/`
   *
   * **`202` quelle que soit l'adresse**, comme côté entreprise : répondre
   * « adresse inconnue » dirait quelles adresses ouvrent ce back-office, à
   * qui le demande. La simulation rejoue ce silence — sans quoi l'écran
   * serait écrit contre un contrat plus bavard que le vrai.
   */
  async demanderReinitialisation(corps: { email: string }): Promise<void> {
    void corps;
    await attendre(null, 600);
  },

  /** `GET /administration/moi/` */
  async moi(): Promise<ChargeAdministrateur> {
    return attendre(ADMINISTRATEUR_DEMO, 200);
  },

  /** `GET /administration/clients/` */
  async listerClients(): Promise<ChargeClientPlateforme[]> {
    return attendre(lireClients(), 400);
  },

  /** `GET /administration/indicateurs/evolution/` */
  async evolutionAbonnements(): Promise<ChargePointEvolution[]> {
    return attendre(evolutionInitiale(), 450);
  },

  /** `GET /administration/indicateurs/tendances/` */
  async tendancesIndicateurs(): Promise<ChargeTendanceIndicateur[]> {
    return attendre(tendancesIndicateurs(lireClients()), 350);
  },

  /** `GET /administration/clients/{id}/` */
  async lireClient(id: string): Promise<ChargeClientPlateforme> {
    const trouve = lireClients().find((client) => client.id === id);
    if (!trouve) refuser("introuvable", "Client introuvable.", 404);
    return attendre(trouve, 300);
  },

  /** `POST /administration/clients/{id}/suspendre/` */
  async suspendreClient(id: string, motif: string): Promise<ChargeClientPlateforme> {
    const clients = lireClients();
    const client = clients.find((c) => c.id === id);
    if (!client) refuser("introuvable", "Client introuvable.", 404);

    if (client.statut === "SUSPENDU") {
      refuser("conflit", "Ce client est déjà suspendu.", 409);
    }
    if (client.statut === "RESILIE") {
      refuser("regle_metier", "Un client résilié ne peut pas être suspendu.", 422);
    }

    client.statut = "SUSPENDU";
    client.abonnement.statut = "SUSPENDU";
    client.abonnement.renouvellement_auto = false;
    ecrireClients(clients);

    // `motif` n'est pas relu ici : côté serveur il part au journal d'audit,
    // que ce module ne simule pas. Il est exigé quand même, pour que l'écran
    // soit écrit contre le contrat définitif et non contre la simulation.
    void motif;

    return attendre(client, 500);
  },

  /** `POST /administration/clients/{id}/reactiver/` */
  async reactiverClient(id: string): Promise<ChargeClientPlateforme> {
    const clients = lireClients();
    const client = clients.find((c) => c.id === id);
    if (!client) refuser("introuvable", "Client introuvable.", 404);

    if (client.statut !== "SUSPENDU") {
      refuser("conflit", "Ce client n'est pas suspendu.", 409);
    }

    client.statut = "ACTIF";
    client.abonnement.statut = "ACTIF";
    ecrireClients(clients);

    return attendre(client, 500);
  },

  /** `PATCH /administration/clients/{id}/abonnement/` */
  async changerPlan(id: string, planCode: string): Promise<ChargeClientPlateforme> {
    const clients = lireClients();
    const client = clients.find((c) => c.id === id);
    if (!client) refuser("introuvable", "Client introuvable.", 404);

    const montant = TARIFS_MENSUELS[planCode];
    if (montant === undefined) {
      refuser("validation", "Plan inconnu.", 422, { plan_code: ["Plan inconnu."] });
    }

    client.abonnement.plan_code = planCode as ChargeAbonnementClient["plan_code"];
    client.abonnement.montant_mensuel_centimes = montant;
    ecrireClients(clients);

    return attendre(client, 500);
  },
};

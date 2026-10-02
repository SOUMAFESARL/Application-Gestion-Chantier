/**
 * Serveur simulé du **back-office de la plateforme** — `/administration/*`.
 *
 * **Rien de ce domaine n'existe côté Django aujourd'hui.** Contrairement au
 * configurateur, où seules les saisies sont simulées, ici l'espace entier
 * l'est : les clients, les abonnements et les indicateurs. La connexion et
 * la déconnexion, elles, sont branchées sur `/api/v1/admins/` et ne passent
 * plus par ce module. Ce module rejoue les contrats qu'on attend du serveur,
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
  statut: "EN_ATTENTE" | "ESSAI" | "ACTIF" | "SUSPENDU" | "RESILIE";
  cree_le: string;
  active_le: string | null;
  nb_utilisateurs: number;
  nb_projets: number;
  abonnement: ChargeAbonnementClient;
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

/* ------------------------------------------------------------------ *
 * Comptes des agents de la plateforme
 * ------------------------------------------------------------------ */

export interface ChargeCompteAdministrateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  role: "SUPERVISEUR" | "SUPPORT";
  statut: "ACTIF" | "SUSPENDU";
  cree_le: string;
  derniere_connexion: string | null;
}

const CLE_COMPTES = "ccd.simulation.administration.comptes.v1";

/**
 * Trois agents de démonstration : un second superviseur, un support actif et
 * un support suspendu — de quoi voir chaque action de la liste. L'agent
 * connecté s'y ajoute à la première lecture (voir `listerComptes`).
 */
function comptesInitiaux(): ChargeCompteAdministrateur[] {
  return [
    {
      id: "adm-101",
      email: "a.kone@ccd-digital.ci",
      nom: "Koné",
      prenom: "Aminata",
      telephone: "+2250707112233",
      role: "SUPERVISEUR",
      statut: "ACTIF",
      cree_le: jour(-380),
      derniere_connexion: jour(-1),
    },
    {
      id: "adm-102",
      email: "s.yao@ccd-digital.ci",
      nom: "Yao",
      prenom: "Serge",
      telephone: "",
      role: "SUPPORT",
      statut: "ACTIF",
      cree_le: jour(-150),
      derniere_connexion: jour(-4),
    },
    {
      id: "adm-103",
      email: "m.diallo@ccd-digital.ci",
      nom: "Diallo",
      prenom: "Mariam",
      telephone: "+2250505998877",
      role: "SUPPORT",
      statut: "SUSPENDU",
      cree_le: jour(-260),
      derniere_connexion: jour(-60),
    },
  ];
}

function lireComptes(): ChargeCompteAdministrateur[] {
  if (typeof window === "undefined") return comptesInitiaux();
  try {
    const brut = window.sessionStorage.getItem(CLE_COMPTES);
    if (brut) return JSON.parse(brut) as ChargeCompteAdministrateur[];
  } catch {
    // On repart du jeu initial.
  }
  return comptesInitiaux();
}

function ecrireComptes(comptes: ChargeCompteAdministrateur[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_COMPTES, JSON.stringify(comptes));
  } catch {
    // Sans mémoire, une création ne survit pas au changement d'écran.
  }
}

function emailPris(comptes: ChargeCompteAdministrateur[], email: string, sauf?: string): boolean {
  const cible = email.trim().toLowerCase();
  return comptes.some((compte) => compte.id !== sauf && compte.email.toLowerCase() === cible);
}

/* ------------------------------------------------------------------ *
 * Catalogue des modules
 * ------------------------------------------------------------------ */

export interface ChargeModulePlateforme {
  id: string;
  code: string;
  libelle: string;
  description: string;
  acces_par_defaut: string[];
  statut: "ACTIF" | "INACTIF";
  cree_le: string;
}

/** v2 : les modules portent désormais un accès par défaut. */
const CLE_MODULES = "ccd.simulation.administration.modules.v2";

/**
 * Les douze modules du produit (`MODULES_CCD`), mêmes codes, mêmes libellés
 * que ceux que l'espace entreprise affiche — plus un module inactif, pour
 * voir la réactivation.
 */
function modulesInitiaux(): ChargeModulePlateforme[] {
  const socle: [string, string, string][] = [
    ["projets", "Projets", "Fiches projets, lots et activités"],
    ["chantier", "Suivi Chantier", "Rapports journaliers, avancement et pointages"],
    ["finance", "Finance", "Bons de paiement, situations et dépenses"],
    ["achats", "Achats", "Demandes d’achat et bons de commande"],
    ["stocks", "Stocks", "Entrées, sorties et inventaires chantier"],
    ["rh", "Ressources Humaines", "Pointage des ouvriers et main d’œuvre"],
    ["equipements", "Matériel", "Engins, maintenance et affectations"],
    ["qhse", "QHSE", "Incidents sécurité et non-conformités"],
    ["contrats", "Contrats", "Sous-traitance et avenants"],
    ["tiers", "Parties Prenantes", "Clients, fournisseurs et bureaux de contrôle"],
    ["ged", "Documents (GED)", "Plans, PV et classeurs documentaires"],
    ["pilotage", "Pilotage BI", "Indicateurs de performance et tableaux de bord"],
  ];
  return [
    ...socle.map(([code, libelle, description], rang) => ({
      id: `mod-${rang + 1}`,
      code,
      libelle,
      description,
      acces_par_defaut: ["lecture"],
      statut: "ACTIF" as const,
      cree_le: jour(-420),
    })),
    {
      id: "mod-13",
      code: "planning",
      libelle: "Planning",
      description: "Diagramme de Gantt et jalons des chantiers",
      acces_par_defaut: [],
      statut: "INACTIF",
      cree_le: jour(-40),
    },
  ];
}

function lireModules(): ChargeModulePlateforme[] {
  if (typeof window === "undefined") return modulesInitiaux();
  try {
    const brut = window.sessionStorage.getItem(CLE_MODULES);
    if (brut) return JSON.parse(brut) as ChargeModulePlateforme[];
  } catch {
    // On repart du jeu initial.
  }
  return modulesInitiaux();
}

function ecrireModules(modules: ChargeModulePlateforme[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_MODULES, JSON.stringify(modules));
  } catch {
    // Sans mémoire, une création ne survit pas au changement d'écran.
  }
}

/** Le code que le serveur dériverait du libellé : minuscules, sans accent, `_` pour séparateur. */
function codeDepuisLibelle(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function libellePris(modules: ChargeModulePlateforme[], libelle: string, sauf?: string): boolean {
  const cible = libelle.trim().toLowerCase();
  return modules.some((m) => m.id !== sauf && m.libelle.toLowerCase() === cible);
}

function refuserLibellePris(): never {
  return refuser("conflit", "Un module porte déjà ce libellé.", 409, {
    libelle: ["Un module porte déjà ce libellé."],
  });
}

/* ------------------------------------------------------------------ *
 * Paramètres de la plateforme — tarifs et identité
 * ------------------------------------------------------------------ */

export interface ChargeAvantagePlan {
  libelle: string;
  inclus: boolean;
}

export interface ChargeTarifPlan {
  plan_code: "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR";
  libelle: string;
  prix_mensuel_centimes: number;
  prix_annuel_centimes: number;
  remise_annuelle_pourcent: number;
  limite_chantiers: number | null;
  limite_utilisateurs: number | null;
  limite_stockage_go: number;
  avantages: ChargeAvantagePlan[];
}

/** Les noms commerciaux de départ — ceux du catalogue, que le back-office renomme à sa guise. */
const LIBELLES_INITIAUX: Record<ChargeTarifPlan["plan_code"], string> = {
  BATISSEUR: "Bâtisseur",
  MAITRE_OEUVRE: "Maître d'Œuvre",
  PROMOTEUR: "Promoteur",
};

/**
 * Les avantages de départ de chaque plan — ceux que la page de tarifs
 * affichait quand ils étaient encore écrits dans le code. Le back-office les
 * réécrit ensuite à sa guise.
 */
const AVANTAGES_INITIAUX: Record<ChargeTarifPlan["plan_code"], ChargeAvantagePlan[]> = {
  BATISSEUR: [
    { libelle: "Journal de chantier quotidien", inclus: true },
    { libelle: "Suivi météo connectée", inclus: true },
    { libelle: "Suivi présences ouvriers", inclus: true },
    { libelle: "Export PDF rapports de base", inclus: true },
    { libelle: "Support standard par email (24h)", inclus: true },
    { libelle: "Suivi d'avancement & photos géolocalisées", inclus: false },
    { libelle: "Gestion budgétaire & bons de paiement", inclus: false },
    { libelle: "Gestion des stocks & achats", inclus: false },
    { libelle: "Assistant IA illimité (analyse risques, résumés auto)", inclus: false },
  ],
  MAITRE_OEUVRE: [
    { libelle: "Suivi d'avancement & photos géolocalisées", inclus: true },
    { libelle: "Gestion budgétaire & bons de paiement", inclus: true },
    { libelle: "Gestion des stocks & achats", inclus: true },
    { libelle: "Alertes automatiques de quotas & dépassements", inclus: true },
    { libelle: "Rapports QHSE et sécurité", inclus: true },
    { libelle: "Support prioritaire sous 2h (WhatsApp & Téléphone)", inclus: true },
    { libelle: "Assistant IA illimité (analyse risques, résumés auto)", inclus: false },
    { libelle: "Multi-filiales & gestion consolidée", inclus: false },
    { libelle: "Personnalisation marque blanche (logo, charte client)", inclus: false },
  ],
  PROMOTEUR: [
    { libelle: "Assistant IA illimité (analyse risques, résumés auto)", inclus: true },
    { libelle: "Multi-filiales & gestion consolidée", inclus: true },
    { libelle: "Personnalisation marque blanche (logo, charte client)", inclus: true },
    { libelle: "Rapprochement bancaire & exports comptables", inclus: true },
    { libelle: "Intégrations API & webhooks", inclus: true },
    { libelle: "Sauvegardes quotidiennes externalisées", inclus: true },
    { libelle: "Chargé de compte dédié + formation sur site", inclus: true },
  ],
};

export interface ChargeIdentitePlateforme {
  nom: string;
  logo_url: string | null;
}

interface ParametresPlateforme {
  tarifs: ChargeTarifPlan[];
  identite: ChargeIdentitePlateforme;
}

/**
 * **`localStorage`, et non `sessionStorage`** comme le reste de ce module :
 * ces paramètres sont lus par l'espace entreprise, qu'on ouvre souvent dans un
 * autre onglet. En local, les deux espaces partagent cette mémoire tant qu'ils
 * sont servis par la même origine ; sur deux origines (`localhost` et
 * `demo.localhost`), chacun garde la sienne — c'est la limite de la
 * simulation, pas du contrat : le vrai serveur n'a qu'une base.
 */
const CLE_PARAMETRES = "ccd.simulation.plateforme.parametres.v1";

/** La remise qu'un couple de prix consent déjà — pour les tarifs écrits avant qu'elle ne se saisisse. */
function remiseDeduite(mensuelCentimes: number, annuelCentimes: number): number {
  const douzeMois = mensuelCentimes * 12;
  if (douzeMois === 0) return 0;
  return Math.max(0, Math.round(((douzeMois - annuelCentimes) / douzeMois) * 100));
}

function parametresInitiaux(): ParametresPlateforme {
  return {
    tarifs: PLANS_DISPONIBLES.map((plan) => ({
      plan_code: plan.code,
      libelle: LIBELLES_INITIAUX[plan.code],
      prix_mensuel_centimes: plan.prix_mensuel_centimes,
      prix_annuel_centimes: plan.prix_annuel_centimes,
      remise_annuelle_pourcent: remiseDeduite(plan.prix_mensuel_centimes, plan.prix_annuel_centimes),
      limite_chantiers: plan.limite_chantiers,
      limite_utilisateurs: plan.limite_utilisateurs,
      limite_stockage_go: plan.limite_stockage_go,
      avantages: AVANTAGES_INITIAUX[plan.code],
    })),
    identite: { nom: "CCD Digital", logo_url: null },
  };
}

function lireParametres(): ParametresPlateforme {
  if (typeof window === "undefined") return parametresInitiaux();
  try {
    const brut = window.localStorage.getItem(CLE_PARAMETRES);
    if (brut) {
      const parametres = JSON.parse(brut) as ParametresPlateforme;
      // Écrits avant que remise, quotas et avantages ne se paramètrent : on
      // garde les prix saisis et on complète avec les valeurs de départ.
      parametres.tarifs = parametres.tarifs.map((tarif) => {
        const catalogue = PLANS_DISPONIBLES.find((plan) => plan.code === tarif.plan_code);
        return {
          ...tarif,
          libelle: tarif.libelle ?? LIBELLES_INITIAUX[tarif.plan_code],
          remise_annuelle_pourcent:
            tarif.remise_annuelle_pourcent ??
            remiseDeduite(tarif.prix_mensuel_centimes, tarif.prix_annuel_centimes),
          limite_chantiers:
            tarif.limite_chantiers === undefined
              ? (catalogue?.limite_chantiers ?? null)
              : tarif.limite_chantiers,
          limite_utilisateurs:
            tarif.limite_utilisateurs === undefined
              ? (catalogue?.limite_utilisateurs ?? null)
              : tarif.limite_utilisateurs,
          limite_stockage_go: tarif.limite_stockage_go ?? catalogue?.limite_stockage_go ?? 0,
          avantages: tarif.avantages ?? AVANTAGES_INITIAUX[tarif.plan_code],
        };
      });
      return parametres;
    }
  } catch {
    // On repart des valeurs du catalogue.
  }
  return parametresInitiaux();
}

function ecrireParametres(parametres: ParametresPlateforme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_PARAMETRES, JSON.stringify(parametres));
  } catch {
    // Quota dépassé : le plus souvent un logo trop lourd, déjà refusé en amont.
  }
}

/**
 * Le tarif mensuel d'un plan, **lu dans les tarifs paramétrés** : un
 * changement de plan au back-office facture le prix affiché sur la page de
 * tarifs de l'espace entreprise, jamais une grille parallèle.
 */
function tarifMensuel(planCode: string): number | undefined {
  return lireParametres().tarifs.find((tarif) => tarif.plan_code === planCode)
    ?.prix_mensuel_centimes;
}

/**
 * Les paramètres publics de la plateforme, lus sans jeton par l'espace
 * entreprise — `GET /plateforme/tarifs/` et `GET /plateforme/identite/`.
 *
 * Séparés de `simulationAdministration` parce qu'ils n'en ont pas le droit
 * d'accès : la page de tarifs d'un client ne présente aucun jeton
 * d'administration.
 */
export const simulationParametresPublics = {
  async lireTarifs(): Promise<ChargeTarifPlan[]> {
    return attendre(lireParametres().tarifs, 300);
  },

  async lireIdentite(): Promise<ChargeIdentitePlateforme> {
    return attendre(lireParametres().identite, 200);
  },

  /** Lecture synchrone, pour la souscription simulée qui facture le prix affiché. */
  tarifsCourants(): ChargeTarifPlan[] {
    return lireParametres().tarifs;
  },
};

export const simulationAdministration = {
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

    const montant = tarifMensuel(planCode);
    if (montant === undefined) {
      refuser("validation", "Plan inconnu.", 422, { plan_code: ["Plan inconnu."] });
    }

    client.abonnement.plan_code = planCode as ChargeAbonnementClient["plan_code"];
    client.abonnement.montant_mensuel_centimes = montant;
    ecrireClients(clients);

    return attendre(client, 500);
  },
  /**
   * `GET /admins/comptes/`
   *
   * L'agent connecté est ajouté à la liste s'il n'y figure pas : il vient du
   * vrai serveur (la connexion est réelle), dont la simulation ignore les
   * identifiants. Sans cela, la liste des comptes ne contiendrait pas celui
   * de la personne qui la regarde.
   */
  async listerComptes(
    moi: ChargeCompteAdministrateur | null,
  ): Promise<ChargeCompteAdministrateur[]> {
    const comptes = lireComptes();
    if (moi && !comptes.some((compte) => compte.id === moi.id)) {
      comptes.unshift(moi);
    }
    ecrireComptes(comptes);
    return attendre(comptes, 400);
  },

  /** `POST /admins/comptes/` */
  async creerCompte(corps: {
    prenom: string;
    nom: string;
    email: string;
    role: "SUPERVISEUR" | "SUPPORT";
  }): Promise<ChargeCompteAdministrateur> {
    const comptes = lireComptes();
    if (emailPris(comptes, corps.email)) {
      refuser("conflit", "Un compte existe déjà pour cette adresse.", 409, {
        email: ["Un compte existe déjà pour cette adresse."],
      });
    }

    const compte: ChargeCompteAdministrateur = {
      id: `adm-${Date.now()}`,
      email: corps.email,
      nom: corps.nom,
      prenom: corps.prenom,
      telephone: "",
      role: corps.role,
      statut: "ACTIF",
      cree_le: new Date().toISOString(),
      derniere_connexion: null,
    };
    comptes.push(compte);
    ecrireComptes(comptes);
    return attendre(compte, 500);
  },

  /** `POST /admins/comptes/{id}/suspendre/` */
  async suspendreCompte(
    id: string,
    demandeur: string | null,
  ): Promise<ChargeCompteAdministrateur> {
    const comptes = lireComptes();
    const compte = comptes.find((c) => c.id === id);
    if (!compte) refuser("introuvable", "Compte introuvable.", 404);
    if (compte.id === demandeur) {
      refuser("regle_metier", "Vous ne pouvez pas suspendre votre propre compte.", 422);
    }
    if (compte.statut === "SUSPENDU") refuser("conflit", "Ce compte est déjà suspendu.", 409);

    compte.statut = "SUSPENDU";
    ecrireComptes(comptes);
    return attendre(compte, 500);
  },

  /** `POST /admins/comptes/{id}/reactiver/` */
  async reactiverCompte(id: string): Promise<ChargeCompteAdministrateur> {
    const comptes = lireComptes();
    const compte = comptes.find((c) => c.id === id);
    if (!compte) refuser("introuvable", "Compte introuvable.", 404);
    if (compte.statut !== "SUSPENDU") refuser("conflit", "Ce compte n'est pas suspendu.", 409);

    compte.statut = "ACTIF";
    ecrireComptes(comptes);
    return attendre(compte, 500);
  },

  /** `GET /admins/modules/` — inactifs compris. */
  async listerModules(): Promise<ChargeModulePlateforme[]> {
    const modules = lireModules();
    ecrireModules(modules);
    return attendre(modules, 400);
  },

  /** `POST /admins/modules/` — le code est dérivé du libellé, puis figé. */
  async creerModule(corps: {
    libelle: string;
    description: string;
    acces_par_defaut: string[];
  }): Promise<ChargeModulePlateforme> {
    const modules = lireModules();
    const code = codeDepuisLibelle(corps.libelle);
    if (libellePris(modules, corps.libelle) || modules.some((m) => m.code === code)) {
      refuserLibellePris();
    }

    const cible: ChargeModulePlateforme = {
      id: `mod-${Date.now()}`,
      code,
      libelle: corps.libelle,
      description: corps.description,
      acces_par_defaut: corps.acces_par_defaut,
      statut: "ACTIF",
      cree_le: new Date().toISOString(),
    };
    modules.push(cible);
    ecrireModules(modules);
    return attendre(cible, 500);
  },

  /** `PATCH /admins/modules/{id}/` — le code ne suit pas le libellé. */
  async modifierModule(
    id: string,
    corps: { libelle: string; description: string; acces_par_defaut: string[] },
  ): Promise<ChargeModulePlateforme> {
    const modules = lireModules();
    const cible = modules.find((m) => m.id === id);
    if (!cible) refuser("introuvable", "Module introuvable.", 404);
    if (libellePris(modules, corps.libelle, id)) refuserLibellePris();

    Object.assign(cible, corps);
    ecrireModules(modules);
    return attendre(cible, 500);
  },

  /** `POST /admins/modules/{id}/desactiver/` */
  async desactiverModule(id: string): Promise<ChargeModulePlateforme> {
    const modules = lireModules();
    const cible = modules.find((m) => m.id === id);
    if (!cible) refuser("introuvable", "Module introuvable.", 404);
    if (cible.statut === "INACTIF") refuser("conflit", "Ce module est déjà désactivé.", 409);

    cible.statut = "INACTIF";
    ecrireModules(modules);
    return attendre(cible, 500);
  },

  /** `POST /admins/modules/{id}/reactiver/` */
  async reactiverModule(id: string): Promise<ChargeModulePlateforme> {
    const modules = lireModules();
    const cible = modules.find((m) => m.id === id);
    if (!cible) refuser("introuvable", "Module introuvable.", 404);
    if (cible.statut === "ACTIF") refuser("conflit", "Ce module est déjà actif.", 409);

    cible.statut = "ACTIF";
    ecrireModules(modules);
    return attendre(cible, 500);
  },

  /** `PATCH /admins/moi/` */
  async modifierProfil(
    id: string,
    corps: { prenom: string; nom: string; email: string; telephone: string },
  ): Promise<{ prenom: string; nom: string; email: string; telephone: string }> {
    const comptes = lireComptes();
    if (emailPris(comptes, corps.email, id)) {
      refuser("conflit", "Un autre compte utilise déjà cette adresse.", 409, {
        email: ["Un autre compte utilise déjà cette adresse."],
      });
    }

    const compte = comptes.find((c) => c.id === id);
    if (compte) {
      Object.assign(compte, corps);
      ecrireComptes(comptes);
    }
    return attendre(corps, 500);
  },

  /**
   * `PATCH /admins/moi/photo/` — la photo arrive déjà lue en `data:` URL.
   *
   * Rien à garder ici : le profil de l'agent connecté vit dans le cache local
   * de l'adaptateur, qui l'y réécrit.
   */
  async modifierPhoto(photo: string | null): Promise<{ photo_url: string | null }> {
    return attendre({ photo_url: photo }, 500);
  },

  /**
   * `POST /admins/moi/mot-de-passe/`
   *
   * La simulation ne connaît pas le vrai mot de passe (la connexion est
   * réelle) : elle ne peut pas vérifier l'ancien. Elle rejoue le seul refus
   * qu'elle sait décider, et celui qu'on veut voir à l'écran — un nouveau mot
   * de passe trop court.
   */
  async changerMotDePasse(corps: {
    ancien_mot_de_passe: string;
    nouveau_mot_de_passe: string;
  }): Promise<void> {
    if (corps.nouveau_mot_de_passe.length < 8) {
      refuser("validation", "Le mot de passe est trop court.", 400, {
        nouveau_mot_de_passe: ["Ce mot de passe doit contenir au moins 8 caractères."],
      });
    }
    await attendre(null, 600);
  },

  /** `PUT /admins/parametres/tarifs/` */
  async modifierTarifs(tarifs: ChargeTarifPlan[]): Promise<ChargeTarifPlan[]> {
    const parametres = lireParametres();
    parametres.tarifs = tarifs;
    ecrireParametres(parametres);
    return attendre(tarifs, 500);
  },

  /** `PATCH /admins/parametres/identite/` — le logo arrive déjà lu en `data:` URL. */
  async modifierIdentite(identite: ChargeIdentitePlateforme): Promise<ChargeIdentitePlateforme> {
    const parametres = lireParametres();
    parametres.identite = identite;
    ecrireParametres(parametres);
    return attendre(identite, 500);
  },
};

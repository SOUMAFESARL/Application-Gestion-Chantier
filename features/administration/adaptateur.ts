/**
 * L'accès aux données du domaine Administration — couche 4.
 *
 * **C'est le seul fichier du domaine qui sait que le serveur existe**, et le
 * seul qui connaisse la forme de ce qu'il envoie. Écrans et règles manipulent
 * les types de `types.ts` et ignorent qu'il y a eu une requête.
 *
 * Il appelle `apiAdministration`, jamais `api` : le back-office vit sur le
 * domaine principal, dans le schéma `public`, et présente les jetons de
 * l'espace `administration`. Passer par `api` viserait le sous-domaine d'un
 * client — où aucune de ces routes n'existe, et où le `404` obtenu n'aurait
 * pas accusé la bonne cause.
 *
 * **Tout ce domaine est simulé aujourd'hui** (`NEXT_PUBLIC_API_SIMULE=1`) :
 * aucun endpoint `/administration/*` n'est écrit côté Django. Les appels
 * réels sont néanmoins présents, à leur place définitive — c'est ce qui rend
 * la bascule du drapeau sans effet sur les écrans.
 *
 * Les charges utiles (`Charge*`) sont **privées** : elles décrivent un
 * transport, et les exporter rouvrirait la brèche que cette couche ferme.
 */

import {
  apiAdministration,
  ecrireJetonAcces,
  ecrireJetonRenouvellement,
  effacerJetons,
  ErreurApi,
  lireJetonRenouvellement,
} from "@/lib/api";
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";
import { ADMIN_DEMO, simulationAdministration } from "@/lib/api/simulationAdministration";
import { texte } from "@/i18n/horsReact";

import { indicateurs } from "./regles";
import type {
  AbonnementClient,
  CleIndicateur,
  ClientPlateforme,
  CodePlan,
  ContenuJetonAdmin,
  IndicateursPlateforme,
  PointEvolutionAbonnements,
  ProfilAdministrateur,
  RoleAdministrateur,
  StatutAbonnement,
  StatutClient,
  TendanceIndicateur,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur — la seule zone en `snake_case`.
 * ------------------------------------------------------------------ */

interface ChargeAdministrateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: RoleAdministrateur;
}

interface ChargeAbonnement {
  statut: StatutAbonnement;
  plan_code: CodePlan;
  reference_transaction: string;
  montant_mensuel_centimes: number;
  date_debut: string;
  date_fin: string;
  fin_essai: string | null;
  renouvellement_auto: boolean;
}

interface ChargeClient {
  id: string;
  raison_sociale: string;
  nom_commercial: string;
  slug: string;
  pays: string;
  ville: string;
  email_contact: string;
  telephone_contact: string;
  statut: StatutClient;
  cree_le: string;
  active_le: string | null;
  nb_utilisateurs: number;
  nb_projets: number;
  abonnement: ChargeAbonnement;
}

interface ChargeUtilisateurSuperAdmin {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role_global?: string;
  role_libelle?: string;
  is_superuser?: boolean;
  is_staff?: boolean;
  langue?: string;
  schema?: string;
  role?: RoleAdministrateur;
}

interface ChargeConnexion {
  access: string;
  refresh: string;
  expire_dans?: number;
  utilisateur?: ChargeUtilisateurSuperAdmin;
  administrateur?: ChargeAdministrateur;
}

interface ChargeIndicateurs {
  nb_clients: number;
  nb_clients_actifs: number;
  nb_clients_en_essai: number;
  nb_clients_impayes: number;
  revenu_mensuel_centimes: number;
}

interface ChargePointEvolution {
  date: string;
  renouveles: number;
  non_renouveles: number;
}

type CleIndicateurCharge =
  | "nb_clients"
  | "nb_clients_actifs"
  | "nb_clients_en_essai"
  | "nb_clients_impayes"
  | "revenu_mensuel_centimes";

interface ChargeTendance {
  cle: CleIndicateurCharge;
  points: number[];
  variation_pourcent: number;
}

interface ChargeContenuJetonAdmin {
  email: string;
  motif: string;
  expire_dans: number;
  url_connexion: string;
}

/**
 * Le nom serveur d'un indicateur, vers son nom de domaine.
 *
 * C'est la seule chose qui relie `nb_clients_impayes` à `impayes` : la table
 * vit ici, dans la couche qui traduit, et nulle part ailleurs. Un écran ne
 * connaît que la clé de gauche des deux — celle en français.
 */
const CLES_INDICATEURS: Record<CleIndicateurCharge, CleIndicateur> = {
  nb_clients: "nbClients",
  nb_clients_actifs: "clientsActifs",
  nb_clients_en_essai: "enEssai",
  nb_clients_impayes: "impayes",
  revenu_mensuel_centimes: "revenuMensuel",
};

/* ------------------------------------------------------------------ *
 * Traduction
 * ------------------------------------------------------------------ */

function versProfil(
  charge: ChargeAdministrateur | ChargeUtilisateurSuperAdmin,
): ProfilAdministrateur {
  const nomComplet = `${charge.prenom} ${charge.nom}`.trim();
  const role: RoleAdministrateur =
    "role" in charge && charge.role ? charge.role : "SUPERVISEUR";
  return {
    id: charge.id,
    email: charge.email,
    nom: charge.nom,
    prenom: charge.prenom,
    nomComplet: nomComplet || charge.email,
    role,
  };
}

function versAbonnement(charge: ChargeAbonnement): AbonnementClient {
  return {
    statut: charge.statut,
    plan: charge.plan_code,
    referenceTransaction: charge.reference_transaction,
    montantMensuelCentimes: charge.montant_mensuel_centimes,
    dateDebut: new Date(charge.date_debut),
    dateFin: new Date(charge.date_fin),
    finEssai: charge.fin_essai ? new Date(charge.fin_essai) : null,
    renouvellementAuto: charge.renouvellement_auto,
  };
}

function versClient(charge: ChargeClient): ClientPlateforme {
  return {
    id: charge.id,
    raisonSociale: charge.raison_sociale,
    nomCommercial: charge.nom_commercial || charge.raison_sociale,
    slug: charge.slug,
    pays: charge.pays,
    ville: charge.ville,
    emailContact: charge.email_contact,
    telephoneContact: charge.telephone_contact,
    statut: charge.statut,
    creeLe: new Date(charge.cree_le),
    activeLe: charge.active_le ? new Date(charge.active_le) : null,
    nbUtilisateurs: charge.nb_utilisateurs,
    nbProjets: charge.nb_projets,
    abonnement: versAbonnement(charge.abonnement),
  };
}

function versContenuJetonAdmin(charge: ChargeContenuJetonAdmin): ContenuJetonAdmin {
  return {
    email: charge.email,
    motif: charge.motif,
    expireDans: charge.expire_dans,
    urlConnexion: charge.url_connexion,
  };
}

/* ------------------------------------------------------------------ *
 * Session du back-office
 * ------------------------------------------------------------------ */

const CLE_PROFIL = "ccd.profil_administrateur";

/**
 * Le profil gardé en local, pour que l'en-tête ait un nom à afficher au
 * premier rendu plutôt qu'un squelette à chaque navigation.
 *
 * **Il n'autorise rien.** Ce n'est qu'un cache d'affichage : le serveur reste
 * seul juge, et un profil falsifié dans `localStorage` ne donnerait accès à
 * aucune donnée — chaque requête repart avec le jeton, que Django vérifie.
 */
export function lireProfilLocal(): ProfilAdministrateur | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(CLE_PROFIL);
    return brut ? (JSON.parse(brut) as ProfilAdministrateur) : null;
  } catch {
    return null;
  }
}

export function ecrireProfilLocal(profil: ProfilAdministrateur | null): void {
  if (typeof window === "undefined") return;
  try {
    if (profil) {
      window.localStorage.setItem(CLE_PROFIL, JSON.stringify(profil));
    } else {
      window.localStorage.removeItem(CLE_PROFIL);
    }
  } catch {
    // Tolerance : navigation privee, quota, stockage bloque.
  }
}

/**
 * Ouvre la session du back-office.
 *
 * Les jetons sont écrits dans l'espace `administration` : se connecter ici
 * **ne touche pas** à la session d'entreprise ouverte dans l'onglet voisin.
 */
export async function seConnecter(identifiants: {
  email: string;
  motDePasse: string;
}): Promise<ProfilAdministrateur> {
  const corps = {
    email: identifiants.email,
    mot_de_passe: identifiants.motDePasse,
    origine: "WEB",
  };

  const reponse: ChargeConnexion = SIMULATION_ACTIVE
    ? await simulationAdministration.seConnecter(corps)
    : await apiAdministration.creer<ChargeConnexion>("/admins/connexion/", corps);

  ecrireJetonAcces(reponse.access, "administration");
  ecrireJetonRenouvellement(reponse.refresh, "administration");

  const cible = reponse.utilisateur ?? reponse.administrateur;
  if (!cible) {
    throw new ErreurApi("reponse_invalide", texte("administration.erreurs.action"), 500);
  }

  const profil = versProfil(cible);
  ecrireProfilLocal(profil);
  return profil;
}

/**
 * Les identifiants à pré-remplir dans le formulaire de connexion, ou `null`.
 *
 * **`null` dès que la simulation est coupée**, et c'est toute la garantie :
 * ces identifiants n'existent que dans `simulationAdministration.ts`, jamais
 * dans une base. Un back-office branché sur le vrai serveur n'a donc rien à
 * pré-remplir — l'écran n'a pas de variante à écrire pour ce cas, il lit un
 * `null`.
 *
 * L'écran passe par cette constante plutôt que par le module de simulation :
 * `app/**` n'importe pas `@/lib/api` directement (arbitrage A1), et le
 * domaine reste le seul à savoir d'où viennent ses données.
 */
export const IDENTIFIANTS_DEMO: { email: string; motDePasse: string } | null =
  SIMULATION_ACTIVE ? ADMIN_DEMO : null;

/**
 * Demande un lien de réinitialisation du mot de passe d'administration.
 *
 * `apiAdministration` **sans jeton utile** : l'appel part sur un espace dont
 * la session est justement inaccessible. C'est la raison pour laquelle la
 * réponse ne dit rien de l'adresse — voir `simulationAdministration`.
 */
export async function demanderReinitialisation(email: string): Promise<void> {
  const corps = { email };

  if (SIMULATION_ACTIVE) {
    await simulationAdministration.demanderReinitialisation(corps);
    return;
  }

  await apiAdministration.creer<void>("/admins/mot-de-passe/demande/", corps);
}

/**
 * Vérifie la validité d'un jeton de réinitialisation Super Admin sans le consommer.
 */
export async function verifierJetonReinitialisationAdmin(
  jeton: string,
): Promise<ContenuJetonAdmin> {
  if (SIMULATION_ACTIVE) {
    const charge = await simulationAdministration.verifierJetonReinitialisation(jeton);
    return versContenuJetonAdmin(charge);
  }

  const charge = await apiAdministration.creer<ChargeContenuJetonAdmin>(
    "/admins/mot-de-passe/verifier/",
    { jeton },
  );
  return versContenuJetonAdmin(charge);
}

/**
 * Réinitialise le mot de passe d'un Super Administrateur avec son jeton validé.
 */
export async function reinitialiserMotDePasseAdmin(
  jeton: string,
  motDePasse: string,
): Promise<void> {
  const corps = {
    jeton,
    mot_de_passe: motDePasse,
  };

  if (SIMULATION_ACTIVE) {
    await simulationAdministration.reinitialiserMotDePasse(corps);
    return;
  }

  await apiAdministration.creer<void>("/admins/mot-de-passe/reinitialiser/", corps);
}

/** Déconnexion volontaire — révoque le jeton côté serveur, puis efface. */
export async function seDeconnecter(): Promise<void> {
  const refresh = lireJetonRenouvellement("administration");
  if (refresh && !SIMULATION_ACTIVE) {
    try {
      await apiAdministration.creer<void>("/admins/deconnexion/", { refresh });
    } catch {
      // Tolerance reseau : la session doit disparaitre en local quoi qu'il arrive.
    }
  }
  effacerJetons("administration");
  ecrireProfilLocal(null);
}

/**
 * Qui est connecté.
 *
 * **Cette fonction échoue quand le serveur refuse**, et c'est délibéré. Son
 * équivalent côté entreprise fabriquait un profil de directeur général en dur
 * lorsque l'appel ratait : une panne réseau accordait une identité. Ici, un
 * échec est un échec — le cache local sert de repli d'affichage, et s'il est
 * vide l'écran renvoie à la connexion.
 */
export async function obtenirProfil(): Promise<ProfilAdministrateur> {
  try {
    if (SIMULATION_ACTIVE) {
      const charge = await simulationAdministration.moi();
      const profil = versProfil(charge);
      ecrireProfilLocal(profil);
      return profil;
    }

    const charge = await apiAdministration.lire<ChargeUtilisateurSuperAdmin>("/utilisateurs/moi/");
    const profil = versProfil(charge);
    ecrireProfilLocal(profil);
    return profil;
  } catch (cause) {
    // Le repli **se souvient**, il n'invente pas : c'est un profil que le
    // serveur a deja renvoye. Sans lui, l'erreur remonte.
    const local = lireProfilLocal();
    if (local) return local;
    throw cause;
  }
}

/* ------------------------------------------------------------------ *
 * Clients
 * ------------------------------------------------------------------ */

export async function listerClients(signal?: AbortSignal): Promise<ClientPlateforme[]> {
  const charges: ChargeClient[] = SIMULATION_ACTIVE
    ? await simulationAdministration.listerClients()
    : await apiAdministration.lire<ChargeClient[]>("/admins/clients/", undefined, signal);

  return charges.map(versClient);
}

export async function lireClient(id: string): Promise<ClientPlateforme> {
  const charge: ChargeClient = SIMULATION_ACTIVE
    ? await simulationAdministration.lireClient(id)
    : await apiAdministration.lire<ChargeClient>(`/admins/clients/${id}/`);

  return versClient(charge);
}

export async function suspendreClient(
  id: string,
  motif: string,
): Promise<ClientPlateforme> {
  const charge: ChargeClient = SIMULATION_ACTIVE
    ? await simulationAdministration.suspendreClient(id, motif)
    : await apiAdministration.creer<ChargeClient>(`/admins/clients/${id}/suspendre/`, { motif });

  return versClient(charge);
}

export async function reactiverClient(id: string): Promise<ClientPlateforme> {
  const charge: ChargeClient = SIMULATION_ACTIVE
    ? await simulationAdministration.reactiverClient(id)
    : await apiAdministration.creer<ChargeClient>(`/admins/clients/${id}/reactiver/`, {});

  return versClient(charge);
}

export async function changerPlan(id: string, plan: CodePlan): Promise<ClientPlateforme> {
  const charge: ChargeClient = SIMULATION_ACTIVE
    ? await simulationAdministration.changerPlan(id, plan)
    : await apiAdministration.modifier<ChargeClient>(`/admins/clients/${id}/abonnement/`, {
        plan_code: plan,
      });

  return versClient(charge);
}

/* ------------------------------------------------------------------ *
 * Indicateurs
 * ------------------------------------------------------------------ */

/**
 * Le résumé chiffré du tableau de bord.
 *
 * **Le calcul appartient au serveur**, et l'endpoint existe dans le contrat
 * pour cette raison : additionner côté client suppose d'avoir téléchargé tous
 * les clients, ce qui tient à cinq et plus à cinq mille. La branche simulée
 * calcule depuis la liste faute de mieux — c'est la seule différence de
 * comportement entre les deux modes de ce domaine, et elle disparaît avec le
 * drapeau.
 */
export async function lireIndicateurs(): Promise<IndicateursPlateforme> {
  if (SIMULATION_ACTIVE) {
    return indicateurs(await listerClients());
  }

  const charge = await apiAdministration.lire<ChargeIndicateurs>("/admins/indicateurs/");
  return {
    nbClients: charge.nb_clients,
    nbClientsActifs: charge.nb_clients_actifs,
    nbClientsEnEssai: charge.nb_clients_en_essai,
    nbClientsImpayes: charge.nb_clients_impayes,
    revenuMensuelCentimes: charge.revenu_mensuel_centimes,
  };
}

/**
 * L'historique des renouvellements, jour par jour.
 *
 * **Il ne se calcule pas depuis la liste des clients**, contrairement aux
 * indicateurs : un client ne porte que son échéance en cours, pas les
 * facturations passées. C'est la raison d'être de cet endpoint — et la raison
 * pour laquelle la branche simulée fabrique une série au lieu de la déduire.
 *
 * Le serveur renvoie la série complète (trois mois) : les fenêtres de 30 et 7
 * jours se découpent côté écran (`fenetreEvolution`), sans nouvel aller-retour
 * — changer de fenêtre est un geste qu'on répète, pas une navigation.
 */
export async function lireEvolutionAbonnements(
  signal?: AbortSignal,
): Promise<PointEvolutionAbonnements[]> {
  const charges: ChargePointEvolution[] = SIMULATION_ACTIVE
    ? await simulationAdministration.evolutionAbonnements()
    : await apiAdministration.lire<ChargePointEvolution[]>(
        "/admins/indicateurs/evolution/",
        undefined,
        signal,
      );

  return charges.map((charge) => ({
    date: new Date(charge.date),
    renouveles: charge.renouveles,
    nonRenouveles: charge.non_renouveles,
  }));
}

/**
 * La tendance de chaque indicateur de tête — la mini-courbe des tuiles.
 *
 * Endpoint séparé de `/indicateurs/`, et non un champ de plus dans sa réponse :
 * les tuiles s'affichent dès que les chiffres sont là, sans attendre huit mois
 * d'historique. Une courbe qui arrive une seconde après son chiffre ne gêne
 * personne ; un chiffre qui attend sa courbe, si.
 */
export async function lireTendancesIndicateurs(
  signal?: AbortSignal,
): Promise<TendanceIndicateur[]> {
  const charges: ChargeTendance[] = SIMULATION_ACTIVE
    ? await simulationAdministration.tendancesIndicateurs()
    : await apiAdministration.lire<ChargeTendance[]>(
        "/admins/indicateurs/tendances/",
        undefined,
        signal,
      );

  return charges.map((charge) => ({
    cle: CLES_INDICATEURS[charge.cle],
    points: charge.points,
    variationPourcent: charge.variation_pourcent,
  }));
}

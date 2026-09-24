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
 * **La session et la lecture des clients sont réelles** : connexion,
 * déconnexion, liste et fiche client appellent `/api/v1/admins/`, quel que soit
 * `NEXT_PUBLIC_API_SIMULE`. **Le reste du domaine est encore simulé**
 * (actions sur un client, abonnements, indicateurs) : ces
 * endpoints ne sont pas écrits côté Django. Leurs appels réels sont néanmoins
 * présents, à leur place définitive — c'est ce qui rend la bascule du drapeau
 * sans effet sur les écrans.
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
import { simulationAdministration } from "@/lib/api/simulationAdministration";
import { texte } from "@/i18n/horsReact";

import { indicateurs } from "./regles";
import type {
  AbonnementClient,
  CleIndicateur,
  ClientPlateforme,
  CodePlan,
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

/** L'utilisateur renvoyé par `POST /admins/connexion/`. */
interface ChargeUtilisateurSuperAdmin {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  /** `AD` pour un administrateur de la plateforme. */
  role_global: string;
  role_libelle: string;
  is_superuser: boolean;
  is_staff: boolean;
  langue: string;
  schema: string;
}

interface ChargeConnexion {
  access: string;
  refresh: string;
  expire_dans: number;
  utilisateur: ChargeUtilisateurSuperAdmin;
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

/**
 * Le rôle de back-office porté par un compte.
 *
 * Seul `AD` (administrateur, super-utilisateur) ouvre la supervision. Tout
 * autre rôle global retombe sur `SUPPORT`, le moins privilégié des deux :
 * un code que ce frontend ne connaît pas encore n'accorde pas plus de droits
 * qu'il n'en faut — et le serveur reste seul juge de toute façon.
 */
function versRole(charge: ChargeUtilisateurSuperAdmin): RoleAdministrateur {
  return charge.role_global === "AD" ? "SUPERVISEUR" : "SUPPORT";
}

function versProfil(charge: ChargeUtilisateurSuperAdmin): ProfilAdministrateur {
  const nomComplet = `${charge.prenom} ${charge.nom}`.trim();
  return {
    id: charge.id,
    email: charge.email,
    nom: charge.nom,
    prenom: charge.prenom,
    nomComplet: nomComplet || charge.email,
    role: versRole(charge),
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

  const reponse = await apiAdministration.creer<ChargeConnexion>("/admins/connexion/", corps);

  // Vérifié **avant** d'écrire les jetons : une réponse sans utilisateur ne
  // doit pas laisser derrière elle une session sans profil.
  if (!reponse.access || !reponse.refresh || !reponse.utilisateur) {
    throw new ErreurApi("reponse_invalide", texte("administration.erreurs.action"), 500);
  }

  ecrireJetonAcces(reponse.access, "administration");
  ecrireJetonRenouvellement(reponse.refresh, "administration");

  const profil = versProfil(reponse.utilisateur);
  ecrireProfilLocal(profil);
  return profil;
}

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

  await apiAdministration.creer<void>("/auth/mot-de-passe/oublie/", corps);
}

/** Déconnexion volontaire — révoque le jeton côté serveur, puis efface. */
export async function seDeconnecter(): Promise<void> {
  const refresh = lireJetonRenouvellement("administration");
  if (refresh) {
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
 * **Aucune route « moi » n'existe encore côté Django** pour un administrateur
 * de la plateforme (`/utilisateurs/moi/` n'est pas livrée) : le profil est
 * celui que `/admins/connexion/` a renvoyé, gardé en local. Le jour où la
 * route arrive, c'est ici qu'on l'appelle — les écrans ne changent pas.
 *
 * **Cette fonction échoue quand il n'y a pas de profil**, et c'est délibéré.
 * Son équivalent côté entreprise fabriquait un profil de directeur général en
 * dur lorsque l'appel ratait : une panne réseau accordait une identité. Ici,
 * le repli **se souvient**, il n'invente pas — sans profil reçu du serveur,
 * l'écran renvoie à la connexion.
 */
export async function obtenirProfil(): Promise<ProfilAdministrateur> {
  const local = lireProfilLocal();
  if (local) return local;
  throw new ErreurApi("non_authentifie", texte("administration.erreurs.action"), 401);
}

/* ------------------------------------------------------------------ *
 * Clients
 * ------------------------------------------------------------------ */

/**
 * Les entreprises clientes de la plateforme — `GET /admins/clients/`.
 *
 * **Réel, quel que soit `NEXT_PUBLIC_API_SIMULE`**, comme la session : la
 * route est livrée. Le serveur renvoie un tableau nu, non paginé.
 */
export async function listerClients(signal?: AbortSignal): Promise<ClientPlateforme[]> {
  const charges = await apiAdministration.lire<ChargeClient[]>(
    "/admins/clients/",
    undefined,
    signal,
  );

  return charges.map(versClient);
}

/**
 * Une entreprise cliente — `GET /admins/clients/<id>/`.
 *
 * Réelle elle aussi, et forcément en même temps que la liste : les
 * identifiants de la liste sont ceux du serveur, qu'une simulation ne
 * connaîtrait pas — la fiche ouverte depuis la liste tomberait sur un `404`.
 */
export async function lireClient(id: string): Promise<ClientPlateforme> {
  const charge = await apiAdministration.lire<ChargeClient>(`/admins/clients/${id}/`);

  return versClient(charge);
}

export async function suspendreClient(
  id: string,
  motif: string,
): Promise<ClientPlateforme> {
  const charge: ChargeClient = SIMULATION_ACTIVE
    ? await simulationAdministration.suspendreClient(id, motif)
    : await apiAdministration.creer<ChargeClient>(`/clients/${id}/suspendre/`, { motif });

  return versClient(charge);
}

export async function reactiverClient(id: string): Promise<ClientPlateforme> {
  const charge: ChargeClient = SIMULATION_ACTIVE
    ? await simulationAdministration.reactiverClient(id)
    : await apiAdministration.creer<ChargeClient>(`/clients/${id}/reactiver/`, {});

  return versClient(charge);
}

export async function changerPlan(id: string, plan: CodePlan): Promise<ClientPlateforme> {
  const charge: ChargeClient = SIMULATION_ACTIVE
    ? await simulationAdministration.changerPlan(id, plan)
    : await apiAdministration.modifier<ChargeClient>(`/clients/${id}/abonnement/`, {
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

  const charge = await apiAdministration.lire<ChargeIndicateurs>("/indicateurs/");
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
        "/indicateurs/evolution/",
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
        "/indicateurs/tendances/",
        undefined,
        signal,
      );

  return charges.map((charge) => ({
    cle: CLES_INDICATEURS[charge.cle],
    points: charge.points,
    variationPourcent: charge.variation_pourcent,
  }));
}

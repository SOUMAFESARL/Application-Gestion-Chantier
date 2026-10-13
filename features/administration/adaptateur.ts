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
import { accesNormalises } from "@/features/roles/regles";
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";
import {
  simulationAdministration,
  simulationParametresPublics,
} from "@/lib/api/simulationAdministration";
import { texte } from "@/i18n/horsReact";

import { indicateurs } from "./regles";
import type {
  AbonnementClient,
  CleIndicateur,
  ClientPlateforme,
  CodePlan,
  CompteAdministrateur,
  DemandeChangementMotDePasse,
  DemandeCreationAdministrateur,
  DemandeModificationProfil,
  DemandeModule,
  IndicateursPlateforme,
  ModulePlateforme,
  PointEvolutionAbonnements,
  ProfilAdministrateur,
  RoleAdministrateur,
  StatutAbonnement,
  StatutClient,
  StatutCompteAdministrateur,
  StatutModule,
  TarifPlan,
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
  /** Absent de la réponse de connexion ; présent dans celle de `PATCH /admins/moi/`. */
  telephone?: string;
  photo_url?: string | null;
}

interface ChargeCompteAdministrateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  role: RoleAdministrateur;
  statut: StatutCompteAdministrateur;
  cree_le: string;
  derniere_connexion: string | null;
}

interface ChargeModule {
  id: string;
  code: string;
  libelle: string;
  description: string;
  acces_par_defaut: string[];
  statut: StatutModule;
  cree_le: string;
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
    telephone: charge.telephone ?? "",
    photo: charge.photo_url ?? null,
    role: versRole(charge),
  };
}

function versCompte(charge: ChargeCompteAdministrateur): CompteAdministrateur {
  const nomComplet = `${charge.prenom} ${charge.nom}`.trim();
  return {
    id: charge.id,
    email: charge.email,
    nom: charge.nom,
    prenom: charge.prenom,
    nomComplet: nomComplet || charge.email,
    telephone: charge.telephone,
    role: charge.role,
    statut: charge.statut,
    creeLe: new Date(charge.cree_le),
    derniereConnexion: charge.derniere_connexion ? new Date(charge.derniere_connexion) : null,
  };
}

function versModule(charge: ChargeModule): ModulePlateforme {
  return {
    id: charge.id,
    code: charge.code,
    libelle: charge.libelle,
    description: charge.description,
    // Un accès que le front ne connaît pas ne s'accorde pas par défaut.
    accesParDefaut: accesNormalises(charge.acces_par_defaut),
    statut: charge.statut,
    creeLe: new Date(charge.cree_le),
  };
}

function corpsModule(demande: DemandeModule) {
  return {
    libelle: demande.libelle,
    description: demande.description,
    acces_par_defaut: demande.accesParDefaut,
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
    if (!brut) return null;
    // Un profil gardé avant l'arrivée du téléphone n'en porte pas : on le
    // complète plutôt que de laisser un `undefined` traverser les écrans.
    return {
      telephone: "",
      photo: null,
      ...(JSON.parse(brut) as Partial<ProfilAdministrateur>),
    } as ProfilAdministrateur;
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

/**
 * Modifie le profil de l'agent connecté — `PATCH /admins/moi/`.
 *
 * Le profil gardé en local est réécrit avec la réponse : c'est lui que
 * l'en-tête affiche, et un nom corrigé qui ne s'y verrait qu'après une
 * reconnexion donnerait l'impression que l'enregistrement a échoué.
 */
export async function modifierProfil(
  demande: DemandeModificationProfil,
): Promise<ProfilAdministrateur> {
  const actuel = lireProfilLocal();
  if (!actuel) {
    throw new ErreurApi("non_authentifie", texte("administration.erreurs.action"), 401);
  }

  const corps = {
    prenom: demande.prenom,
    nom: demande.nom,
    email: demande.email,
    telephone: demande.telephone,
  };

  let profil: ProfilAdministrateur;
  if (SIMULATION_ACTIVE) {
    const reponse = await simulationAdministration.modifierProfil(actuel.id, corps);
    const nomComplet = `${reponse.prenom} ${reponse.nom}`.trim();
    profil = { ...actuel, ...reponse, nomComplet: nomComplet || reponse.email };
  } else {
    profil = versProfil(
      await apiAdministration.modifier<ChargeUtilisateurSuperAdmin>("/admins/moi/", corps),
    );
  }

  ecrireProfilLocal(profil);
  return profil;
}

/**
 * Remplace ou retire la photo de profil — `PATCH /admins/moi/photo/`, en
 * `multipart`.
 *
 * `null` retire la photo : l'avatar retombe sur les initiales. Séparé de
 * `modifierProfil` parce que c'est un geste à part — on change sa photo sans
 * toucher au formulaire, et l'envoi d'un fichier ne passe pas par du JSON.
 */
export async function modifierPhotoProfil(
  fichier: File | null,
): Promise<ProfilAdministrateur> {
  const actuel = lireProfilLocal();
  if (!actuel) {
    throw new ErreurApi("non_authentifie", texte("administration.erreurs.action"), 401);
  }

  let profil: ProfilAdministrateur;
  if (SIMULATION_ACTIVE) {
    const photo = fichier ? await lireEnDataUrl(fichier) : null;
    await simulationAdministration.modifierPhoto(photo);
    profil = { ...actuel, photo };
  } else {
    const formulaire = new FormData();
    if (fichier) formulaire.append("photo", fichier);
    else formulaire.append("retirer_photo", "true");
    profil = versProfil(
      await apiAdministration.modifier<ChargeUtilisateurSuperAdmin>(
        "/admins/moi/photo/",
        formulaire,
      ),
    );
  }

  ecrireProfilLocal(profil);
  return profil;
}

/**
 * Change le mot de passe de l'agent connecté —
 * `POST /admins/moi/mot-de-passe/`.
 *
 * Un ancien mot de passe erroné revient en `400` sur le champ
 * `ancien_mot_de_passe` : l'erreur est renommée vers `actuel`, le nom du champ
 * de l'écran, pour qu'elle s'affiche sous la bonne saisie.
 */
export async function changerMotDePasse(demande: DemandeChangementMotDePasse): Promise<void> {
  const corps = {
    ancien_mot_de_passe: demande.actuel,
    nouveau_mot_de_passe: demande.nouveau,
  };

  try {
    if (SIMULATION_ACTIVE) {
      await simulationAdministration.changerMotDePasse(corps);
    } else {
      await apiAdministration.creer<void>("/admins/moi/mot-de-passe/", corps);
    }
  } catch (cause) {
    if (cause instanceof ErreurApi) {
      const { ancien_mot_de_passe: ancien, nouveau_mot_de_passe: nouveau } = cause.details;
      if (ancien || nouveau) {
        const details: Record<string, string[] | string> = {};
        if (ancien) details.actuel = ancien;
        if (nouveau) details.nouveau = nouveau;
        throw new ErreurApi(cause.code, cause.message, cause.statut, details, cause.traceId);
      }
    }
    throw cause;
  }
}

/* ------------------------------------------------------------------ *
 * Comptes des agents
 * ------------------------------------------------------------------ */

/** Le profil connecté, sous la forme d'un compte — pour la simulation seulement. */
function compteDuProfil(profil: ProfilAdministrateur | null): ChargeCompteAdministrateur | null {
  if (!profil) return null;
  return {
    id: profil.id,
    email: profil.email,
    nom: profil.nom,
    prenom: profil.prenom,
    telephone: profil.telephone,
    role: profil.role,
    statut: "ACTIF",
    cree_le: new Date().toISOString(),
    derniere_connexion: new Date().toISOString(),
  };
}

/** `GET /admins/comptes/` — les agents de la plateforme, suspendus compris. */
export async function listerAdministrateurs(
  signal?: AbortSignal,
): Promise<CompteAdministrateur[]> {
  const charges: ChargeCompteAdministrateur[] = SIMULATION_ACTIVE
    ? await simulationAdministration.listerComptes(compteDuProfil(lireProfilLocal()))
    : await apiAdministration.lire<ChargeCompteAdministrateur[]>(
        "/admins/comptes/",
        undefined,
        signal,
      );

  return charges.map(versCompte);
}

/**
 * `POST /admins/comptes/` — le serveur envoie l'invitation, l'agent choisit
 * son mot de passe.
 */
export async function creerAdministrateur(
  demande: DemandeCreationAdministrateur,
): Promise<CompteAdministrateur> {
  const corps = {
    prenom: demande.prenom,
    nom: demande.nom,
    email: demande.email,
    role: demande.role,
  };

  const charge: ChargeCompteAdministrateur = SIMULATION_ACTIVE
    ? await simulationAdministration.creerCompte(corps)
    : await apiAdministration.creer<ChargeCompteAdministrateur>("/admins/comptes/", corps);

  return versCompte(charge);
}

export async function suspendreAdministrateur(id: string): Promise<CompteAdministrateur> {
  const charge: ChargeCompteAdministrateur = SIMULATION_ACTIVE
    ? await simulationAdministration.suspendreCompte(id, lireProfilLocal()?.id ?? null)
    : await apiAdministration.creer<ChargeCompteAdministrateur>(
        `/admins/comptes/${id}/suspendre/`,
        {},
      );

  return versCompte(charge);
}

export async function reactiverAdministrateur(id: string): Promise<CompteAdministrateur> {
  const charge: ChargeCompteAdministrateur = SIMULATION_ACTIVE
    ? await simulationAdministration.reactiverCompte(id)
    : await apiAdministration.creer<ChargeCompteAdministrateur>(
        `/admins/comptes/${id}/reactiver/`,
        {},
      );

  return versCompte(charge);
}

/* ------------------------------------------------------------------ *
 * Catalogue des modules
 * ------------------------------------------------------------------ */

/** `GET /admins/modules/` — le catalogue, modules inactifs compris. */
export async function listerModules(signal?: AbortSignal): Promise<ModulePlateforme[]> {
  const charges: ChargeModule[] = SIMULATION_ACTIVE
    ? await simulationAdministration.listerModules()
    : await apiAdministration.lire<ChargeModule[]>("/admins/modules/", undefined, signal);

  return charges.map(versModule);
}

/** `POST /admins/modules/` — le serveur dérive le code du libellé. */
export async function creerModule(demande: DemandeModule): Promise<ModulePlateforme> {
  const corps = corpsModule(demande);

  const charge: ChargeModule = SIMULATION_ACTIVE
    ? await simulationAdministration.creerModule(corps)
    : await apiAdministration.creer<ChargeModule>("/admins/modules/", corps);

  return versModule(charge);
}

/** `PATCH /admins/modules/{id}/` — libellé, description, accès par défaut ; le code reste. */
export async function modifierModule(
  id: string,
  demande: DemandeModule,
): Promise<ModulePlateforme> {
  const corps = corpsModule(demande);

  const charge: ChargeModule = SIMULATION_ACTIVE
    ? await simulationAdministration.modifierModule(id, corps)
    : await apiAdministration.modifier<ChargeModule>(`/admins/modules/${id}/`, corps);

  return versModule(charge);
}

export async function desactiverModule(id: string): Promise<ModulePlateforme> {
  const charge: ChargeModule = SIMULATION_ACTIVE
    ? await simulationAdministration.desactiverModule(id)
    : await apiAdministration.creer<ChargeModule>(`/admins/modules/${id}/desactiver/`, {});

  return versModule(charge);
}

export async function reactiverModule(id: string): Promise<ModulePlateforme> {
  const charge: ChargeModule = SIMULATION_ACTIVE
    ? await simulationAdministration.reactiverModule(id)
    : await apiAdministration.creer<ChargeModule>(`/admins/modules/${id}/reactiver/`, {});

  return versModule(charge);
}

/* ------------------------------------------------------------------ *
 * Paramètres de la plateforme
 * ------------------------------------------------------------------ *
 * Seules les **écritures** vivent ici. La lecture est publique et appartient
 * à `features/plateforme/adaptateur.ts`, que l'espace entreprise appelle
 * aussi : le back-office relit donc exactement ce que les clients verront.
 */

/** `PUT /admins/parametres/tarifs/` — tous les plans d'un coup : prix, remise, quotas, avantages. */
export async function modifierTarifs(tarifs: TarifPlan[]): Promise<void> {
  const corps = tarifs.map((tarif) => ({
    plan_code: tarif.code,
    libelle: tarif.libelle,
    prix_mensuel_centimes: tarif.prixMensuelCentimes,
    prix_annuel_centimes: tarif.prixAnnuelCentimes,
    remise_annuelle_pourcent: tarif.remiseAnnuellePourcent,
    limite_chantiers: tarif.limiteChantiers,
    limite_utilisateurs: tarif.limiteUtilisateurs,
    limite_stockage_go: tarif.limiteStockageGo,
    avantages: tarif.avantages.map((avantage) => ({
      libelle: avantage.libelle,
      inclus: avantage.inclus,
    })),
  }));

  if (SIMULATION_ACTIVE) {
    await simulationAdministration.modifierTarifs(corps);
    return;
  }

  await apiAdministration.modifier<void>("/admins/parametres/tarifs/", { tarifs: corps });
}

/** Lit un fichier en `data:` URL — la simulation n'a pas de stockage de fichiers. */
function lireEnDataUrl(fichier: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result));
    lecteur.onerror = () => rejeter(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}

/**
 * `PATCH /admins/parametres/identite/` — en `multipart`, pour le logo.
 *
 * Trois cas pour le logo : un nouveau fichier le remplace, `retirerLogo`
 * revient au signe CCD, et ni l'un ni l'autre le laisse tel quel.
 */
export async function modifierIdentite(demande: {
  nom: string;
  logo: File | null;
  retirerLogo: boolean;
}): Promise<void> {
  if (SIMULATION_ACTIVE) {
    const actuelle = await simulationParametresPublics.lireIdentite();
    const logo = demande.logo
      ? await lireEnDataUrl(demande.logo)
      : demande.retirerLogo
        ? null
        : actuelle.logo_url;
    await simulationAdministration.modifierIdentite({ nom: demande.nom, logo_url: logo });
    return;
  }

  const formulaire = new FormData();
  formulaire.append("nom", demande.nom);
  if (demande.logo) formulaire.append("logo", demande.logo);
  if (demande.retirerLogo) formulaire.append("retirer_logo", "true");

  await apiAdministration.modifier<void>("/admins/parametres/identite/", formulaire);
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

/**
 * Repousse ou avance l'échéance de l'abonnement d'un client —
 * `PATCH /admins/clients/<id>/`.
 *
 * **Réel, quel que soit `NEXT_PUBLIC_API_SIMULE`**, comme la fiche qu'il
 * modifie : un identifiant de la liste n'existe pas dans la simulation.
 *
 * Pendant un essai, `fin_essai` suit `date_fin` : le serveur renvoie les deux
 * égales, et ne repousser que l'une laisserait l'essai expiré.
 *
 * La réponse n'est pas relue : l'écran recharge la liste, seule source sûre
 * tant que le contrat de retour du `PATCH` n'est pas figé.
 */
export async function modifierFinAbonnement(
  id: string,
  dateFin: string,
  enEssai: boolean,
): Promise<void> {
  await apiAdministration.modifier<unknown>(`/admins/clients/${id}/`, {
    abonnement: enEssai ? { date_fin: dateFin, fin_essai: dateFin } : { date_fin: dateFin },
  });
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

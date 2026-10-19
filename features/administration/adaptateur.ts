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
 * **Tout le domaine est réel** depuis le lot 2 (14/10/2026) : chaque
 * fonction appelle `/api/v1/admins/…`, quel que soit `NEXT_PUBLIC_API_SIMULE`.
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
import { texte } from "@/i18n/horsReact";

import { PLAFOND_JOURNAL } from "./regles";
import type {
  AbonnementClient,
  CleIndicateur,
  ClientPlateforme,
  CodePlan,
  CompteAdministrateur,
  DemandeChangementMotDePasse,
  DemandeCreationAdministrateur,
  DemandeMessagerie,
  DemandeModificationProfil,
  DemandeModule,
  EntreeJournalPlateforme,
  FiltresJournalPlateforme,
  IndicateursPlateforme,
  ModuleClient,
  ModulePlateforme,
  PageJournalPlateforme,
  PermissionDuModule,
  PointEvolutionAbonnements,
  ProfilAdministrateur,
  ReglageMessagerie,
  ResultatDiagnosticMessagerie,
  RoleAdministrateur,
  StatutAbonnement,
  StatutClient,
  StatutCompteAdministrateur,
  StatutModule,
  TarifPlan,
  TendanceIndicateur,
  DemandePermission,
  PermissionPlateforme,
  ApercuSuppression,
  ResultatSuppression,
  DemandeRoleSysteme,
  PorteeRoleSysteme,
  RoleSysteme,
  CategorieReferentielPlateforme,
  EntreeReferentielPlateforme,
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

interface ChargeModuleClient {
  id: string;
  code: string;
  libelle: string;
  actif: boolean;
  desactivable?: boolean;
}

interface ChargeDirigeantClient {
  nom: string;
  email: string;
}

interface ChargeTelephoneClient {
  libelle: string;
  libelle_affiche: string;
  nom?: string;
  numero: string;
  principal: boolean;
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
  telephones?: ChargeTelephoneClient[];
  statut: StatutClient;
  cree_le: string;
  active_le: string | null;
  nb_utilisateurs: number;
  nb_projets: number;
  abonnement: ChargeAbonnement;
  modules?: ChargeModuleClient[];
  dirigeant?: ChargeDirigeantClient | null;
}

interface ChargeReglageEffectif {
  source: ReglageMessagerie["effectif"]["source"];
  hote: string;
  port: number;
  chiffrement: ReglageMessagerie["effectif"]["chiffrement"];
  identifiant: string;
  expediteur: string;
}

interface ChargeMessagerie {
  saisi: {
    hote: string;
    port: number;
    chiffrement: ReglageMessagerie["saisi"]["chiffrement"];
    identifiant: string;
    expediteur: string;
    mot_de_passe_defini: boolean;
    modifie_le: string | null;
  };
  effectif: ChargeReglageEffectif;
  frontend_url: string;
  frontend_url_locale: boolean;
}

interface ChargeDiagnosticMessagerie {
  succes: boolean;
  etape: "connexion" | "envoi" | null;
  erreur: string | null;
  conseil: string | null;
  sonde: ResultatDiagnosticMessagerie["sonde"];
  alternatives: ResultatDiagnosticMessagerie["alternatives"];
  nom_ehlo?: string | null;
  reglage: ChargeReglageEffectif;
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
  /** Le rôle de back-office réel : `is_superuser` côté Django. */
  role?: RoleAdministrateur;
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

interface ChargePermissionDuModule {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  ordre?: number;
}

interface ChargeModule {
  id: string;
  code: string;
  libelle: string;
  description: string;
  ordre?: number;
  icone?: string;
  permissions?: ChargePermissionDuModule[];
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

interface ChargeDirigeantApercu {
  nom: string;
  email: string;
  prenom?: string;
}

interface ChargeApercuSuppression {
  slug: string;
  raison_sociale: string;
  protegee: boolean;
  suppression_activee: boolean;
  suspendue: boolean;
  motif_longueur_min: number;
  sauvegarde_conservee_jours: number;
  nb_utilisateurs: number;
  nb_projets: number;
  nb_paiements: number;
  adresses: string[];
  dirigeants: ChargeDirigeantApercu[];
}


/* ------------------------------------------------------------------ *
 * Traduction
 * ------------------------------------------------------------------ */

/**
 * Le rôle de back-office porté par un compte.
 *
 * Lu dans `role`, que le serveur dérive de `is_superuser`. **Pas dans `role_global`** :
 * tous les agents de la plateforme y portent `AD`, superviseurs comme support. Sans `role`
 * (réponse ancienne), `is_superuser` tranche ; sans l'un ni l'autre, `SUPPORT` — le moins
 * privilégié. Le serveur reste seul juge de toute façon.
 */
function versRole(charge: ChargeUtilisateurSuperAdmin): RoleAdministrateur {
  if (charge.role === "SUPERVISEUR" || charge.role === "SUPPORT") return charge.role;
  return charge.is_superuser ? "SUPERVISEUR" : "SUPPORT";
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

function versPermissionDuModule(charge: ChargePermissionDuModule): PermissionDuModule {
  return {
    id: charge.id,
    code: charge.code,
    libelle: charge.libelle,
    description: charge.description ?? "",
    ordre: charge.ordre ?? 0,
  };
}

function versModule(charge: ChargeModule): ModulePlateforme {
  const permissions = (charge.permissions ?? [])
    .map(versPermissionDuModule)
    .sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code));

  return {
    id: charge.id,
    code: charge.code,
    libelle: charge.libelle,
    description: charge.description,
    ordre: charge.ordre ?? 0,
    icone: charge.icone ?? "box",
    permissions,
    statut: charge.statut,
    creeLe: new Date(charge.cree_le),
  };
}

function corpsModule(demande: DemandeModule) {
  return {
    libelle: demande.libelle,
    description: demande.description,
    ordre: demande.ordre,
    icone: demande.icone,
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

function versModuleClient(charge: ChargeModuleClient): ModuleClient {
  return {
    id: charge.id,
    code: charge.code,
    libelle: charge.libelle,
    actif: charge.actif,
    // Absent d'une réponse ancienne : on le tient pour retirable, le serveur reste juge.
    desactivable: charge.desactivable ?? true,
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
    telephones: (charge.telephones || []).map((t) => ({
      libelle: t.libelle,
      libelleAffiche: t.libelle_affiche,
      nom: t.nom ?? "",
      numero: t.numero,
      principal: Boolean(t.principal),
    })),
    statut: charge.statut,
    creeLe: new Date(charge.cree_le),
    activeLe: charge.active_le ? new Date(charge.active_le) : null,
    nbUtilisateurs: charge.nb_utilisateurs,
    nbProjets: charge.nb_projets,
    abonnement: versAbonnement(charge.abonnement),
    modules: (charge.modules || []).map(versModuleClient),
    dirigeant: charge.dirigeant ? { nom: charge.dirigeant.nom, email: charge.dirigeant.email } : null,
  };
}

function versMessagerie(charge: ChargeMessagerie): ReglageMessagerie {
  return {
    saisi: {
      hote: charge.saisi.hote,
      port: charge.saisi.port,
      chiffrement: charge.saisi.chiffrement,
      identifiant: charge.saisi.identifiant,
      expediteur: charge.saisi.expediteur,
      motDePasseDefini: charge.saisi.mot_de_passe_defini,
      modifieLe: charge.saisi.modifie_le ? new Date(charge.saisi.modifie_le) : null,
    },
    effectif: charge.effectif,
    frontendUrl: charge.frontend_url,
    frontendUrlLocale: charge.frontend_url_locale,
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
 * Demande un lien de réinitialisation du mot de passe d'administration —
 * `POST /admins/mot-de-passe/demande/`.
 *
 * `apiAdministration` **sans jeton utile** : l'appel part sur un espace dont
 * la session est justement inaccessible. Le serveur répond `202` que
 * l'adresse soit celle d'un agent ou non : l'écran ne doit rien en déduire.
 * Le lien envoyé mène à `/admin/mot-de-passe/definir#jeton=…`.
 */
export async function demanderReinitialisation(email: string): Promise<void> {
  const corps = { email };
  await apiAdministration.creer<void>("/admins/mot-de-passe/demande/", corps);
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
 * Le profil de l'agent connecté — `GET /admins/moi/`.
 *
 * Le serveur d'abord : c'est lui qui sait si un agent est passé de SUPPORT à SUPERVISEUR
 * (ou l'inverse) depuis sa connexion. Le profil gardé en local est réécrit avec la réponse.
 *
 * **Sur une panne réseau seulement**, on retombe sur le profil gardé — il se souvient, il
 * n'invente pas. Un refus du serveur (401, 403) remonte tel quel : c'est
 * `SurveillantSessionAdmin` qui renvoie vers la connexion.
 */
export async function obtenirProfil(): Promise<ProfilAdministrateur> {
  try {
    const profil = versProfil(
      await apiAdministration.lire<ChargeUtilisateurSuperAdmin>("/admins/moi/"),
    );
    ecrireProfilLocal(profil);
    return profil;
  } catch (cause) {
    const local = lireProfilLocal();
    if (cause instanceof ErreurApi && cause.code === "reseau_indisponible" && local) return local;
    throw cause;
  }
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

  const profil = versProfil(
    await apiAdministration.modifier<ChargeUtilisateurSuperAdmin>("/admins/moi/", corps),
  );

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

  const formulaire = new FormData();
  if (fichier) formulaire.append("photo", fichier);
  else formulaire.append("retirer_photo", "true");
  const profil = versProfil(
    await apiAdministration.modifier<ChargeUtilisateurSuperAdmin>(
      "/admins/moi/photo/",
      formulaire,
    ),
  );

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
    await apiAdministration.creer<void>("/admins/moi/mot-de-passe/", corps);
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
/** `GET /admins/comptes/` — les agents de la plateforme, suspendus compris. */
export async function listerAdministrateurs(
  signal?: AbortSignal,
): Promise<CompteAdministrateur[]> {
  const charges = await apiAdministration.lire<ChargeCompteAdministrateur[]>(
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

  const charge = await apiAdministration.creer<ChargeCompteAdministrateur>("/admins/comptes/", corps);

  return versCompte(charge);
}

export async function suspendreAdministrateur(id: string): Promise<CompteAdministrateur> {
  const charge = await apiAdministration.creer<ChargeCompteAdministrateur>(
    `/admins/comptes/${id}/suspendre/`,
    {},
  );

  return versCompte(charge);
}

export async function reactiverAdministrateur(id: string): Promise<CompteAdministrateur> {
  const charge = await apiAdministration.creer<ChargeCompteAdministrateur>(
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
  const charges = await apiAdministration.lire<ChargeModule[]>("/admins/modules/", undefined, signal);

  return charges.map(versModule);
}

/** `POST /admins/modules/` — le serveur dérive le code du libellé. */
export async function creerModule(demande: DemandeModule): Promise<ModulePlateforme> {
  const corps = corpsModule(demande);

  const charge = await apiAdministration.creer<ChargeModule>("/admins/modules/", corps);

  return versModule(charge);
}

/** `PATCH /admins/modules/{id}/` — libellé, description, ordre, icône ; le code reste. */
export async function modifierModule(
  id: string,
  demande: DemandeModule,
): Promise<ModulePlateforme> {
  const corps = corpsModule(demande);

  const charge = await apiAdministration.modifier<ChargeModule>(`/admins/modules/${id}/`, corps);

  return versModule(charge);
}

/**
 * `PATCH /admins/modules/{id}/permissions/` — la liste **complète** des codes rattachés.
 * Retirer un code le retire de tous les rôles de toutes les entreprises ; en ajouter un ne
 * l'accorde à personne (B2).
 */
export async function rattacherPermissionsModule(
  id: string,
  codes: string[],
): Promise<ModulePlateforme> {
  const charge = await apiAdministration.modifier<ChargeModule>(
    `/admins/modules/${id}/permissions/`,
    { permissions: codes },
  );

  return versModule(charge);
}

export async function desactiverModule(id: string): Promise<ModulePlateforme> {
  const charge = await apiAdministration.creer<ChargeModule>(`/admins/modules/${id}/desactiver/`, {});

  return versModule(charge);
}

export async function reactiverModule(id: string): Promise<ModulePlateforme> {
  const charge = await apiAdministration.creer<ChargeModule>(`/admins/modules/${id}/reactiver/`, {});

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

  await apiAdministration.modifier<void>("/admins/parametres/tarifs/", { tarifs: corps });
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
 * Repousse ou avance l'échéance de l'abonnement d'un client — `PATCH /admins/clients/<id>/`.
 *
 * Seule `date_fin` part : pendant un essai, c'est le serveur qui aligne `fin_essai`. Le motif
 * est obligatoire et journalisé côté plateforme. La réponse est la fiche à jour.
 */
export async function modifierFinAbonnement(
  id: string,
  dateFin: string,
  motif: string,
): Promise<ClientPlateforme> {
  const charge = await apiAdministration.modifier<ChargeClient>(`/admins/clients/${id}/`, {
    abonnement: { date_fin: dateFin },
    motif,
  });
  return versClient(charge);
}

export async function suspendreClient(
  id: string,
  motif: string,
): Promise<ClientPlateforme> {
  const charge = await apiAdministration.creer<ChargeClient>(
    `/admins/clients/${id}/suspendre/`,
    { motif },
  );

  return versClient(charge);
}

export async function reactiverClient(id: string): Promise<ClientPlateforme> {
  const charge = await apiAdministration.creer<ChargeClient>(
    `/admins/clients/${id}/reactiver/`,
    {},
  );

  return versClient(charge);
}

export async function changerPlan(id: string, plan: CodePlan): Promise<ClientPlateforme> {
  const charge = await apiAdministration.modifier<ChargeClient>(
    `/admins/clients/${id}/abonnement/`,
    { plan_code: plan },
  );

  return versClient(charge);
}

/**
 * Active ou retire un module pour un client —
 * `POST /admins/clients/<id>/modules/<module>/activer|desactiver/`.
 *
 * Retirer coupe l'accès sans rien effacer : les données du module restent, et reviennent
 * telles quelles à la réactivation. La réponse est la fiche à jour.
 */
export async function basculerModuleClient(
  clientId: string,
  moduleId: string,
  actif: boolean,
): Promise<ClientPlateforme> {
  const charge = await apiAdministration.creer<ChargeClient>(
    `/admins/clients/${clientId}/modules/${moduleId}/${actif ? "activer" : "desactiver"}/`,
    {},
  );
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
 * les clients, ce qui tient à cinq et plus à cinq mille.
 */
export async function lireIndicateurs(): Promise<IndicateursPlateforme> {
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
 * Le serveur renvoie la série complète (trois mois) : les fenêtres de 30 et 7
 * jours se découpent côté écran (`fenetreEvolution`), sans nouvel aller-retour
 * — changer de fenêtre est un geste qu'on répète, pas une navigation.
 */
export async function lireEvolutionAbonnements(
  signal?: AbortSignal,
): Promise<PointEvolutionAbonnements[]> {
  const charges = await apiAdministration.lire<ChargePointEvolution[]>(
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
 * Endpoint séparé de `/admins/indicateurs/`, et non un champ de plus dans sa réponse :
 * les tuiles s'affichent dès que les chiffres sont là, sans attendre huit mois
 * d'historique. Une courbe qui arrive une seconde après son chiffre ne gêne
 * personne ; un chiffre qui attend sa courbe, si.
 */
export async function lireTendancesIndicateurs(
  signal?: AbortSignal,
): Promise<TendanceIndicateur[]> {
  const charges = await apiAdministration.lire<ChargeTendance[]>(
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

/* ------------------------------------------------------------------ *
 * Messagerie : le serveur SMTP par lequel partent tous les e-mails
 * ------------------------------------------------------------------ */

/** `GET /admins/parametres/messagerie/` — le réglage saisi et celui qui sert réellement. */
export async function lireMessagerie(): Promise<ReglageMessagerie> {
  return versMessagerie(
    await apiAdministration.lire<ChargeMessagerie>("/admins/parametres/messagerie/"),
  );
}

/** `PATCH /admins/parametres/messagerie/` — superviseur. Un mot de passe vide conserve l'actuel. */
export async function enregistrerMessagerie(
  demande: DemandeMessagerie,
): Promise<ReglageMessagerie> {
  return versMessagerie(
    await apiAdministration.modifier<ChargeMessagerie>("/admins/parametres/messagerie/", {
      hote: demande.hote,
      port: demande.port,
      chiffrement: demande.chiffrement,
      identifiant: demande.identifiant,
      mot_de_passe: demande.motDePasse,
      expediteur: demande.expediteur,
    }),
  );
}

/** `DELETE /admins/parametres/messagerie/` — retombe sur le réglage du serveur (`.env`). */
export async function reinitialiserMessagerie(): Promise<ReglageMessagerie> {
  await apiAdministration.supprimer("/admins/parametres/messagerie/");
  return lireMessagerie();
}

/**
 * `POST /admins/parametres/messagerie/tester/` — envoie un message et dit **où** ça casse.
 * Une panne d'envoi n'est pas une erreur HTTP : elle revient dans le résultat, avec son conseil.
 */
export async function testerMessagerie(
  destinataire: string,
): Promise<ResultatDiagnosticMessagerie> {
  const charge = await apiAdministration.creer<ChargeDiagnosticMessagerie>(
    "/admins/parametres/messagerie/tester/",
    { destinataire },
  );
  return {
    succes: charge.succes,
    etape: charge.etape,
    erreur: charge.erreur,
    conseil: charge.conseil,
    sonde: charge.sonde ?? null,
    alternatives: charge.alternatives ?? [],
    nomEhlo: charge.nom_ehlo ?? null,
    reglage: charge.reglage,
  };
}

interface ChargeEntreeJournal {
  id: number;
  utilisateur_id: string | null;
  utilisateur_nom: string;
  entreprise_id: string | null;
  entreprise_nom: string;
  action: string;
  detail: Record<string, unknown> | null;
  adresse_ip: string | null;
  appareil: string;
  horodatage: string;
}

interface ChargePageJournal {
  total: number;
  page: number;
  nombre_pages: number;
  suivant: string | null;
  precedent: string | null;
  resultats: ChargeEntreeJournal[];
}

const TAILLE_PAGE_JOURNAL = 100;

function versEntreeJournal(charge: ChargeEntreeJournal): EntreeJournalPlateforme {
  return {
    id: charge.id,
    agentId: charge.utilisateur_id,
    agent: charge.utilisateur_nom,
    entrepriseId: charge.entreprise_id,
    entreprise: charge.entreprise_nom,
    action: charge.action,
    detail: charge.detail ?? {},
    adresseIp: charge.adresse_ip,
    appareil: charge.appareil,
    horodatage: new Date(charge.horodatage),
  };
}

/**
 * Le journal de la plateforme pour une sélection — `GET /admins/journal-plateforme/`.
 *
 * Toutes les pages, par 100, jusqu'au plafond : l'écran pagine et exporte côté client, et un
 * export qui ne porterait que sur la page affichée mentirait sur ce qu'il contient.
 */
export async function listerJournalPlateforme(
  filtres: FiltresJournalPlateforme,
  signal?: AbortSignal,
): Promise<PageJournalPlateforme> {
  const parametres: Record<string, string | number> = {
    du: filtres.du,
    au: filtres.au,
    ...(filtres.agentId ? { utilisateur_id: filtres.agentId } : {}),
    ...(filtres.entrepriseId ? { entreprise_id: filtres.entrepriseId } : {}),
    ...(filtres.action ? { action: filtres.action } : {}),
    taille_page: TAILLE_PAGE_JOURNAL,
  };

  const toutesEntrees: EntreeJournalPlateforme[] = [];
  let pageCourante = 1;
  let total = 0;
  let nombrePages = 1;

  while (pageCourante <= nombrePages && toutesEntrees.length < PLAFOND_JOURNAL) {
    const charge = await apiAdministration.lire<ChargePageJournal>(
      "/admins/journal-plateforme/",
      { ...parametres, page: pageCourante },
      signal,
    );
    total = charge.total;
    nombrePages = charge.nombre_pages;

    for (const item of charge.resultats) {
      toutesEntrees.push(versEntreeJournal(item));
      if (toutesEntrees.length >= PLAFOND_JOURNAL) break;
    }

    if (!charge.suivant || charge.resultats.length === 0) break;
    pageCourante++;
  }

  return {
    entrees: toutesEntrees.slice(0, PLAFOND_JOURNAL),
    total,
    tronque: total > PLAFOND_JOURNAL,
  };
}

/** Les codes d'action présents au journal — `GET /admins/journal-plateforme/actions/`. */
export async function listerActionsJournal(signal?: AbortSignal): Promise<string[]> {
  const charge = await apiAdministration.lire<{ actions: string[] }>(
    "/admins/journal-plateforme/actions/",
    undefined,
    signal,
  );
  return charge.actions;
}

/* ------------------------------------------------------------------ *
 * Catalogue des permissions
 * ------------------------------------------------------------------ */

interface ChargeModulePermission {
  id: string;
  code: string;
  libelle: string;
  icone?: string;
}

interface ChargePermission {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  ordre?: number;
  est_actif: boolean;
  modules?: ChargeModulePermission[];
  modules_codes?: string[];
}

function versPermission(charge: ChargePermission): PermissionPlateforme {
  return {
    id: charge.id,
    code: charge.code,
    libelle: charge.libelle,
    description: charge.description ?? "",
    ordre: charge.ordre ?? 0,
    actif: charge.est_actif,
    modules: (charge.modules ?? []).map((m) => ({
      id: m.id,
      code: m.code,
      libelle: m.libelle,
    })),
  };
}

/**
 * Le catalogue des permissions.
 *
 * Le catalogue vient du REGISTRE du serveur : on n'invente pas de permission, on
 * rétablit une permission du registre, on change ses modules ou on la retire de
 * toutes les entreprises.
 */
export async function listerPermissions(
  signal?: AbortSignal,
): Promise<PermissionPlateforme[]> {
  const charges = await apiAdministration.lire<ChargePermission[]>(
    "/admins/permissions/",
    undefined,
    signal,
  );
  return charges.map(versPermission);
}

export async function creerPermission(
  demande: DemandePermission,
): Promise<PermissionPlateforme> {
  const charge = await apiAdministration.creer<ChargePermission>(
    "/admins/permissions/",
    {
      code: demande.code,
      libelle: demande.libelle,
      description: demande.description,
      modules: demande.modules,
    },
  );
  return versPermission(charge);
}

export async function modifierPermission(
  id: string,
  demande: { libelle: string; description: string },
): Promise<PermissionPlateforme> {
  const charge = await apiAdministration.modifier<ChargePermission>(
    `/admins/permissions/${id}/`,
    demande,
  );
  return versPermission(charge);
}

export async function basculerPermission(
  id: string,
  actif: boolean,
): Promise<PermissionPlateforme> {
  const charge = await apiAdministration.modifier<ChargePermission>(
    `/admins/permissions/${id}/`,
    { est_actif: actif },
  );
  return versPermission(charge);
}

export async function rattacherPermission(
  id: string,
  modules: string[],
): Promise<PermissionPlateforme> {
  const charge = await apiAdministration.creer<ChargePermission>(
    `/admins/permissions/${id}/modules/`,
    { modules },
  );
  return versPermission(charge);
}

export async function supprimerPermission(
  id: string,
  code = "",
): Promise<string> {
  await apiAdministration.supprimer(`/admins/permissions/${id}/`);
  return code;
}

/**
 * Ce que la suppression définitive d'une entreprise emporterait —
 * `GET /admins/clients/<id>/suppression/apercu/`. Réservé au superviseur.
 */
export async function lireApercuSuppression(id: string): Promise<ApercuSuppression> {
  const charge = await apiAdministration.lire<ChargeApercuSuppression>(
    `/admins/clients/${id}/suppression/apercu/`,
  );
  return {
    slug: charge.slug,
    raisonSociale: charge.raison_sociale,
    protegee: charge.protegee,
    suppressionActivee: charge.suppression_activee,
    suspendue: charge.suspendue,
    motifLongueurMin: charge.motif_longueur_min,
    sauvegardeConserveeJours: charge.sauvegarde_conservee_jours,
    nbUtilisateurs: charge.nb_utilisateurs,
    nbProjets: charge.nb_projets,
    nbPaiements: charge.nb_paiements,
    adresses: charge.adresses,
    dirigeants: (charge.dirigeants || []).map((d) => ({
      nom: d.nom || d.email,
      email: d.email,
    })),
  };
}

/**
 * Supprime l'entreprise, son schéma, ses comptes, et libère ses adresses —
 * `POST /admins/clients/<id>/supprimer-definitivement/`. **Irréversible.**
 *
 * `POST`, et non `DELETE` : un `DELETE` ne porte pas de corps, et le serveur
 * exige le nom retapé et le motif. **Irréversible** côté écran ; une sauvegarde du schéma est
 * conservée 30 jours côté serveur.
 */
export async function supprimerClientDefinitivement(
  id: string,
  confirmation: string,
  motif: string,
): Promise<ResultatSuppression> {
  return await apiAdministration.creer<ResultatSuppression>(
    `/admins/clients/${id}/supprimer-definitivement/`,
    {
      confirmation,
      motif,
    },
  );
}


/* ------------------------------------------------------------------ *
 * Rôles système (gabarits propagés à toutes les entreprises)
 * ------------------------------------------------------------------ */

interface ChargeRoleSysteme {
  id: string;
  code: string;
  libelle: string;
  description: string;
  portee: PorteeRoleSysteme;
  modules: string[];
}

function versRoleSysteme(charge: ChargeRoleSysteme): RoleSysteme {
  return {
    id: charge.id,
    code: charge.code,
    libelle: charge.libelle,
    description: charge.description,
    portee: charge.portee,
    modules: charge.modules,
  };
}

/** `GET /admins/roles-systeme/`. */
export async function listerRolesSysteme(signal?: AbortSignal): Promise<RoleSysteme[]> {
  const charges = await apiAdministration.lire<ChargeRoleSysteme[]>(
    "/admins/roles-systeme/",
    undefined,
    signal,
  );
  return charges.map(versRoleSysteme);
}

/** `POST /admins/roles-systeme/` — créé puis propagé à toutes les entreprises. */
export async function creerRoleSysteme(demande: DemandeRoleSysteme): Promise<RoleSysteme> {
  const charge = await apiAdministration.creer<ChargeRoleSysteme>(
    "/admins/roles-systeme/",
    demande,
  );
  return versRoleSysteme(charge);
}

/** `PATCH /admins/roles-systeme/{id}/` — le code reste. */
export async function modifierRoleSysteme(
  id: string,
  demande: Omit<DemandeRoleSysteme, "code">,
): Promise<RoleSysteme> {
  const charge = await apiAdministration.modifier<ChargeRoleSysteme>(
    `/admins/roles-systeme/${id}/`,
    demande,
  );
  return versRoleSysteme(charge);
}

/** `DELETE /admins/roles-systeme/{id}/` — il devient personnalisé dans chaque entreprise. */
export async function supprimerRoleSysteme(id: string): Promise<void> {
  await apiAdministration.supprimer(`/admins/roles-systeme/${id}/`);
}

/* ------------------------------------------------------------------ *
 * Référentiels de la plateforme (types de projet, noms de lot)
 * ------------------------------------------------------------------ */

/** `GET /admins/referentiels/{categorie}/`. */
export async function listerReferentielPlateforme(
  categorie: CategorieReferentielPlateforme,
  signal?: AbortSignal,
): Promise<EntreeReferentielPlateforme[]> {
  return apiAdministration.lire<EntreeReferentielPlateforme[]>(
    `/admins/referentiels/${categorie}/`,
    undefined,
    signal,
  );
}

/** `POST /admins/referentiels/{categorie}/` — proposé aussitôt à toutes les entreprises. */
export async function ajouterReferentielPlateforme(
  categorie: CategorieReferentielPlateforme,
  saisie: { libelle: string; groupe: string },
): Promise<EntreeReferentielPlateforme> {
  return apiAdministration.creer<EntreeReferentielPlateforme>(
    `/admins/referentiels/${categorie}/`,
    saisie,
  );
}

/** `PATCH /admins/referentiels/{categorie}/{id}/` — libellé et groupe ; le code reste. */
export async function modifierReferentielPlateforme(
  categorie: CategorieReferentielPlateforme,
  id: string,
  saisie: { libelle: string; groupe: string },
): Promise<EntreeReferentielPlateforme> {
  return apiAdministration.modifier<EntreeReferentielPlateforme>(
    `/admins/referentiels/${categorie}/${id}/`,
    saisie,
  );
}

/** `DELETE /admins/referentiels/{categorie}/{id}/` — les projets existants gardent leur valeur. */
export async function supprimerReferentielPlateforme(
  categorie: CategorieReferentielPlateforme,
  id: string,
): Promise<void> {
  await apiAdministration.supprimer(`/admins/referentiels/${categorie}/${id}/`);
}

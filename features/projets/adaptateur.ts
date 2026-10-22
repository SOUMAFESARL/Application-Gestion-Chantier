/**
 * L'accès aux données du domaine Projets — plan de refonte, lot 4, couche 4.
 *
 * **C'est le seul fichier du domaine qui sait que le serveur existe**, et le
 * seul qui connaisse la forme de ce qu'il envoie. Tout ce qui est au-dessus
 * (écrans, composants, règles) manipule les types de `types.ts` et ignore
 * qu'il y a eu une requête.
 *
 * L'intérêt n'est pas théorique : quand un champ est renommé côté Django, ou
 * qu'une ressource est découpée en deux appels, la correction tient dans ce
 * fichier. Sans cette couche, elle se propage à chaque écran qui avait lu la
 * charge utile en direct.
 *
 * Les charges utiles (`Charge*`) sont **privées**. Rien ne doit les importer
 * d'ici : elles décrivent un transport, et les exporter reviendrait à rouvrir
 * la brèche que cette couche ferme.
 */

import { texte } from "@/i18n/horsReact";
import { api, type ErreurApi } from "@/lib/api";

import {
  lireLotsImportes,
  ROLE_MEMBRE_PAR_DEFAUT,
  ROLE_PROJET_PAR_FONCTION,
  STATUT_DECLARE_PAR_DEFAUT,
  statutDeReprise,
} from "./regles";

import type {
  Activite,
  AjoutEncadrement,
  AlerteIntemperies,
  AutreMembreProjet,
  ChefChantierProjet,
  ClientProjet,
  CreationEquipe,
  CreationLotProjet,
  ContratProjet,
  CreationProjet,
  Equipe,
  EvenementAvancement,
  EvenementDate,
  FonctionAutreMembre,
  EquipeChantier,
  InstantaneSante,
  Intervenant,
  LigneImportLot,
  Lot,
  MembreEquipe,
  MeteoProjet,
  MiseAJourAvancement,
  ModeExecutionLot,
  ModificationProjet,
  MotifReport,
  NatureEquipe,
  PlanningProjet,
  PonderationAvancement,
  Projet,
  Reprogrammation,
  ResultatReprogrammation,
  RoleMembreEquipe,
  SaisieActiviteDomaine,
  SaisieMembreEquipe,
  SanteProjet,
  StatistiquesProjet,
  StatutDeclare,
  StatutProjet,
  TypeBordereau,
  TypeProjet,
  UniteActivite,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur — la seule zone en `snake_case`.
 * ------------------------------------------------------------------ */

interface ChargeIntervenant {
  id: string;
  nom: string;
  prenom: string;
  nom_complet?: string;
  email: string;
  telephone: string;
  statut?: "INVITE" | "ACTIF";
  lien_whatsapp?: string;
  affectation_id?: string | null;
}

interface ChargeClient {
  id: string;
  raison_sociale: string;
  telephone?: string;
  email?: string;
  ville?: string;
}

/**
 * Un chantier, tel que `GET /projets/` et `GET /projets/{id}/` le renvoient.
 *
 * La route livrée porte l'identification et le cadrage : maître d'ouvrage en
 * clair, dates, budget, contrats joints. Le statut, l'avancement, la fiche
 * client et l'équipe d'encadrement restent facultatifs : ils arriveront avec
 * les modules qui les calculent, et `versProjet` leur donne d'ici là un
 * défaut explicite.
 */
interface ChargeProjet {
  id: string;
  reference: string;
  nom: string;
  peut_renommer?: boolean;
  description?: string;
  type_projet?: TypeProjet | null;
  /** Le maître d'ouvrage, en clair — la forme de la route livrée. */
  maitre_ouvrage?: string;
  /** Une fiche tiers complète, si le serveur la joint un jour. */
  client?: ChargeClient | null;
  ville: string;
  quartier?: string;
  statut?: StatutProjet;
  avancement_reel?: number;
  avancement_theorique?: number;
  delta_retard?: number | string | null;
  indice_sante?: number | null;
  /** Un `DecimalField` : Django peut l'envoyer en chaîne. */
  budget_initial_montant: number | string | null;
  budget_consomme_montant?: number;
  date_debut_prevue?: string | null;
  date_fin_prevue?: string | null;
  date_debut_reelle?: string | null;
  date_fin_reelle?: string | null;
  duree_jours_ouvres?: number | null;
  duree?: {
    annees: number;
    mois: number;
    jours: number;
    jours_ouvres: number;
  } | null;
  maitre_oeuvre?: string | null;
  contrat?: ChargeContrat[];
  chef_projet?: ChargeIntervenant | null;
  conducteurs_travaux?: ChargeIntervenant[];
  chefs_chantier?: ChargeChefChantier[];
  autres_membres?: ChargeAutreMembre[];
  statistiques?: ChargeStatistiques | null;
}

/** Les chiffres de structure que le serveur calcule sur les lots du chantier. */
interface ChargeStatistiques {
  lots_count: number;
  activites_count: number;
  avancement_pondere: number;
  ponderation: PonderationAvancement;
  activites_en_retard: number;
  /** Un `DecimalField`, comme le budget initial. */
  budget_activites_montant: number | string | null;
}

interface ChargeContrat {
  id: string;
  nom: string;
  taille: number;
  type_contenu: string;
  url: string;
}

interface ChargeChefChantier {
  utilisateur: ChargeIntervenant;
  zone?: string | null;
  affectation_id?: string | null;
}

interface ChargeAutreMembre {
  utilisateur: ChargeIntervenant;
  fonction: FonctionAutreMembre;
  role_code?: string;
  role_libelle?: string;
  affectation_id?: string | null;
}

/** L'enveloppe de pagination de DRF, quand elle est activée sur la ressource. */
interface ChargeListe<T> {
  results?: T[];
}

interface ChargeMeteo {
  disponible: boolean;
  ville: string;
  temperature: number | null;
  portee?: "ENTREPRISE" | "CHANTIER";
  condition?: string | null;
  code_wmo?: number | null;
  praticable: boolean;
  alerte?: string | null;
  releve_le?: string | null;
  raison?: string | null;
  description?: string;
  alerte_intemperies?: ChargeAlerteIntemperies | null;
}

interface ChargeAlerteIntemperies {
  projet: string;
  description: string;
  ville?: string;
  condition?: string;
}

/** La charge de `POST /projets/`. Les contrats joints la font passer en `multipart`. */
interface ChargeCreationProjet {
  nom: string;
  reference?: string;
  type_projet: string;
  ville: string;
  maitre_ouvrage: string;
  maitre_oeuvre?: string;
  date_debut_prevue?: string;
  date_fin_prevue?: string;
  budget_initial_montant?: number;
  description?: string;
}

/* ------------------------------------------------------------------ *
 * Traductions — serveur vers domaine.
 * ------------------------------------------------------------------ */

function versIntervenant(charge: ChargeIntervenant | null | undefined): Intervenant | null {
  if (!charge) return null;
  return {
    id: charge.id,
    nom: charge.nom,
    prenom: charge.prenom,
    /**
     * Le serveur ne renvoie `nom_complet` que sur certaines ressources. On le
     * reconstitue plutôt que de laisser l'écran choisir entre deux champs :
     * c'est précisément le genre d'arbitrage qui se met à diverger.
     */
    nomComplet: charge.nom_complet ?? `${charge.prenom} ${charge.nom}`.trim(),
    email: charge.email,
    telephone: charge.telephone,
    statut: charge.statut ?? null,
    lienWhatsApp: charge.lien_whatsapp ?? null,
    affectationId: charge.affectation_id ?? null,
  };
}

function intervenants(charges: ChargeIntervenant[] | undefined): Intervenant[] {
  return (charges ?? [])
    .map(versIntervenant)
    .filter((intervenant): intervenant is Intervenant => intervenant !== null);
}

function versChefChantier(charge: ChargeChefChantier): ChefChantierProjet | null {
  const intervenant = versIntervenant(charge.utilisateur);
  return intervenant
    ? {
        intervenant,
        zone: charge.zone || null,
        affectationId: charge.affectation_id ?? intervenant.affectationId ?? null,
      }
    : null;
}

function versAutreMembre(charge: ChargeAutreMembre): AutreMembreProjet | null {
  const intervenant = versIntervenant(charge.utilisateur);
  return intervenant
    ? {
        intervenant,
        fonction: charge.fonction,
        roleCode: charge.role_code ?? "VI",
        roleLibelle: charge.role_libelle ?? "",
        affectationId: charge.affectation_id ?? intervenant.affectationId ?? null,
      }
    : null;
}

/**
 * Le maître d'ouvrage. La route livrée ne le donne qu'en clair : la fiche n'a
 * alors ni identifiant ni coordonnées — on ne les invente pas.
 */
function versClient(charge: ChargeProjet): ClientProjet {
  if (charge.client) {
    return {
      id: charge.client.id,
      raisonSociale: charge.client.raison_sociale,
      telephone: charge.client.telephone ?? null,
      email: charge.client.email ?? null,
      ville: charge.client.ville ?? null,
    };
  }
  return {
    id: null,
    raisonSociale: charge.maitre_ouvrage ?? "",
    telephone: null,
    email: null,
    ville: null,
  };
}

function versContrat(charge: ChargeContrat): ContratProjet {
  return {
    id: charge.id,
    nom: charge.nom,
    taille: charge.taille,
    typeContenu: charge.type_contenu,
    url: charge.url,
  };
}

/**
 * Django sérialise un `DecimalField` en chaîne (`"1500000.00"`). Le domaine
 * compte en entiers : la conversion se fait ici, une fois.
 */
function versMontant(valeur: number | string | null | undefined): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const montant = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(montant) ? Math.round(montant) : null;
}

/** Les chiffres de structure, tels que le serveur les compte sur les lots. */
function versStatistiques(
  charge: ChargeStatistiques | null | undefined,
): StatistiquesProjet | null {
  if (!charge) return null;
  return {
    lots: charge.lots_count,
    activites: charge.activites_count,
    avancement: charge.avancement_pondere,
    ponderation: charge.ponderation,
    enRetard: charge.activites_en_retard,
    budgetActivites: versMontant(charge.budget_activites_montant) ?? 0,
  };
}

/**
 * La traduction d'un chantier.
 *
 * Les valeurs absentes sont ramenées ici à un défaut **explicite** — chaîne
 * vide pour un texte, `0` pour une consommation, `null` pour un budget non
 * défini — pour qu'aucun écran n'ait à écrire `?? ""` sur un champ du domaine.
 */
export function versProjet(charge: ChargeProjet): Projet {
  return {
    id: charge.id,
    reference: charge.reference,
    nom: charge.nom,
    peutRenommer: charge.peut_renommer ?? false,
    description: charge.description ?? "",
    typeProjet: charge.type_projet ?? null,
    client: versClient(charge),
    ville: charge.ville,
    quartier: charge.quartier ?? "",
    // Sans statut calculé par le serveur, un projet n'a pas encore démarré.
    statut: charge.statut ?? "EN_ATTENTE",
    avancementReel: charge.avancement_reel ?? 0,
    avancementTheorique: charge.avancement_theorique ?? 0,
    deltaRetard: versNombre(charge.delta_retard),
    indiceSante: charge.indice_sante ?? null,
    budgetInitial: versMontant(charge.budget_initial_montant),
    budgetConsomme: charge.budget_consomme_montant ?? 0,
    dateDebutPrevue: charge.date_debut_prevue ?? null,
    dateFinPrevue: charge.date_fin_prevue ?? null,
    dateDebutReelle: charge.date_debut_reelle ?? null,
    dateFinReelle: charge.date_fin_reelle ?? null,
    dureeJoursOuvres: charge.duree_jours_ouvres ?? null,
    duree: charge.duree
      ? {
          annees: charge.duree.annees,
          mois: charge.duree.mois,
          jours: charge.duree.jours,
          joursOuvres: charge.duree.jours_ouvres,
        }
      : null,
    maitreOeuvre: charge.maitre_oeuvre || null,
    contrats: (charge.contrat ?? []).map(versContrat),
    chefProjet: versIntervenant(charge.chef_projet),
    conducteursTravaux: intervenants(charge.conducteurs_travaux),
    chefsChantier: (charge.chefs_chantier ?? [])
      .map(versChefChantier)
      .filter((chef): chef is ChefChantierProjet => chef !== null),
    autresMembres: (charge.autres_membres ?? [])
      .map(versAutreMembre)
      .filter((membre): membre is AutreMembreProjet => membre !== null),
    statistiques: versStatistiques(charge.statistiques),
  };
}

/**
 * La traduction d'une alerte intempéries, quelle que soit sa provenance.
 *
 * Elle est exportée parce que le tableau de bord reçoit la même alerte sous
 * la même forme : la recopier là-bas rouvrirait la porte que cette couche
 * ferme.
 */
export function versAlerteIntemperies(
  charge: ChargeAlerteIntemperies | null | undefined,
): AlerteIntemperies | null {
  if (!charge) return null;
  return {
    projet: charge.projet,
    description: charge.description,
    ville: charge.ville ?? null,
    condition: charge.condition ?? null,
  };
}

function versMeteo(charge: ChargeMeteo): MeteoProjet {
  return {
    disponible: charge.disponible,
    ville: charge.ville,
    temperature: charge.temperature,
    portee: charge.portee ?? null,
    condition: charge.condition ?? null,
    codeWmo: charge.code_wmo ?? null,
    praticable: charge.praticable,
    alerte: charge.alerte ?? null,
    releveLe: charge.releve_le ?? null,
    raison: charge.raison ?? null,
    description: charge.description ?? "",
    alerteIntemperies: versAlerteIntemperies(charge.alerte_intemperies),
  };
}

/** Traduction domaine vers serveur — le seul sens où l'on écrit du `snake_case`. */
function versChargeCreation(creation: CreationProjet): ChargeCreationProjet {
  return {
    nom: creation.nom,
    reference: creation.reference,
    type_projet: creation.typeProjet,
    ville: creation.ville,
    maitre_ouvrage: creation.maitreOuvrage,
    maitre_oeuvre: creation.maitreOeuvre,
    date_debut_prevue: creation.dateDebutPrevue,
    date_fin_prevue: creation.dateFinPrevue,
    budget_initial_montant: creation.budgetInitial,
    description: creation.description,
  };
}

/** La charge de `PATCH /projets/{id}/` — l'identification, sans la référence. */
function versChargeModification(modification: ModificationProjet) {
  const charge: Record<string, unknown> = {
    type_projet: modification.typeProjet,
    ville: modification.ville,
    maitre_ouvrage: modification.maitreOuvrage,
    maitre_oeuvre: modification.maitreOeuvre,
    date_debut_prevue: modification.dateDebutPrevue,
    date_fin_prevue: modification.dateFinPrevue,
  };
  if (modification.nom !== undefined) {
    charge.nom = modification.nom;
  }
  return charge;
}

/* ------------------------------------------------------------------ *
 * Lectures et écritures.
 * ------------------------------------------------------------------ */

/**
 * Les chantiers de l'entreprise, pour la liste.
 *
 * Django pagine ou non selon le réglage du `ViewSet`, et les deux formes se
 * lisent ici : l'écran reçoit un tableau dans les deux cas et n'a pas à
 * savoir laquelle est active. Le `signal` vient de React Query, qui annule
 * la requête quand l'écran est quitté avant la réponse.
 */
export async function listerProjets(signal?: AbortSignal): Promise<Projet[]> {
  const charge = await api.lire<ChargeProjet[] | ChargeListe<ChargeProjet>>(
    "/projets/",
    undefined,
    signal,
  );
  const charges = Array.isArray(charge) ? charge : (charge?.results ?? []);
  return charges.map(versProjet);
}

export async function lireProjet(id: string): Promise<Projet> {
  return versProjet(await api.lire<ChargeProjet>(`/projets/${id}/`));
}

/**
 * Sans contrat, la création part en JSON. Avec, elle part en `multipart` :
 * les champs à plat, et un `contrats` répété par fichier — la forme que lit
 * `request.FILES.getlist("contrats")` côté Django.
 */
function versCorpsCreation(creation: CreationProjet): ChargeCreationProjet | FormData {
  const charge = versChargeCreation(creation);
  if (!creation.contrats?.length) return charge;

  const corps = new FormData();
  for (const [cle, valeur] of Object.entries(charge)) {
    if (valeur !== undefined && valeur !== "") corps.append(cle, String(valeur));
  }
  for (const contrat of creation.contrats) corps.append("contrats", contrat, contrat.name);
  return corps;
}

export async function creerProjet(creation: CreationProjet): Promise<Projet> {
  return versProjet(await api.creer<ChargeProjet>("/projets/", versCorpsCreation(creation)));
}

export async function modifierProjet(
  id: string,
  modification: ModificationProjet,
): Promise<Projet> {
  return versProjet(
    await api.modifier<ChargeProjet>(`/projets/${id}/`, versChargeModification(modification)),
  );
}

/**
 * La suspension et la reprise sont une écriture du statut (`PATCH`) : le
 * serveur n'expose pas d'action dédiée. Le statut retrouvé à la reprise est
 * choisi par `statutDeReprise`.
 */
export async function suspendreProjet(id: string): Promise<Projet> {
  return versProjet(await api.modifier<ChargeProjet>(`/projets/${id}/`, { statut: "SUSPENDU" }));
}

export async function reprendreProjet(projet: Projet): Promise<Projet> {
  return versProjet(
    await api.modifier<ChargeProjet>(`/projets/${projet.id}/`, {
      statut: statutDeReprise(projet),
    }),
  );
}

/**
 * Le projet et ce qui lui est rattaché. Le serveur peut refuser un projet
 * trop engagé pour disparaître : l'écran affiche alors son message plutôt
 * que de deviner la règle.
 */
export async function supprimerProjet(id: string): Promise<void> {
  await api.supprimer(`/projets/${id}/`);
}

/*
 * Le cadrage d'un projet — planning contractuel et budget prévisionnel. Ni
 * l'un ni l'autre ne se demande plus à la création : c'est le chef de projet
 * désigné qui les fixe, depuis la fiche. Deux écritures distinctes, pour que
 * fixer l'un ne renvoie pas (et n'écrase pas) l'autre.
 */

export async function definirPlanningProjet(id: string, planning: PlanningProjet): Promise<Projet> {
  return versProjet(
    await api.modifier<ChargeProjet>(`/projets/${id}/`, {
      date_debut_prevue: planning.dateDebutPrevue,
      date_fin_prevue: planning.dateFinPrevue,
    }),
  );
}

/** `budgetInitial` est en **centimes**, comme partout dans le domaine. */
export async function definirBudgetProjet(id: string, budgetInitial: number): Promise<Projet> {
  return versProjet(
    await api.modifier<ChargeProjet>(`/projets/${id}/`, {
      budget_initial_montant: budgetInitial,
    }),
  );
}

/*
 * L'équipe d'encadrement et de gestion du projet. Affectations servies par
 * Django : ajout, modification, retrait par effacement physique journalisé.
 * Chaque écriture relit le projet entier (lireProjet).
 */

export async function ajouterMembreEncadrement(
  projetId: string,
  ajout: AjoutEncadrement,
): Promise<Projet> {
  const payload: {
    utilisateur_id: string;
    role_projet: string;
    zone?: string | null;
  } = {
    utilisateur_id: ajout.intervenant.id,
    // Le rôle tenu sur le projet est celui de la plateforme, quel qu'il soit.
    role_projet:
      ajout.fonction === "AUTRE_MEMBRE" ? ajout.roleCode : ROLE_PROJET_PAR_FONCTION[ajout.fonction],
  };

  if (ajout.fonction === "CHEF_CHANTIER") {
    payload.zone = ajout.zone ?? null;
  }

  await api.creer(`/projets/${projetId}/affectations/`, payload);
  return lireProjet(projetId);
}

export async function retirerMembreEncadrement(
  projetId: string,
  affectationId: string,
): Promise<Projet> {
  await api.supprimer(`/projets/${projetId}/affectations/${affectationId}/?hard=true`);
  return lireProjet(projetId);
}

export async function modifierMembreEncadrement(
  projetId: string,
  affectationId: string,
  modifications: { zone?: string | null; fonctionMembre?: FonctionAutreMembre },
): Promise<Projet> {
  const payload: { zone?: string | null; fonction_membre?: string } = {};
  if ("zone" in modifications) {
    payload.zone = modifications.zone ?? null;
  }
  if (modifications.fonctionMembre) {
    payload.fonction_membre = modifications.fonctionMembre;
  }
  await api.modifier(`/projets/${projetId}/affectations/${affectationId}/`, payload);
  return lireProjet(projetId);
}

export async function listerAffectables(
  projetId: string,
  signal?: AbortSignal,
): Promise<{ id: string; nom: string; role: string; roleCode: string }[]> {
  type Charge = { id: string; nom: string; role: string; role_code?: string };
  const reponse = await api.lire<Charge[] | ChargeListe<Charge>>(
    `/projets/${projetId}/collaborateurs-affectables/`,
    undefined,
    signal,
  );
  const charges = Array.isArray(reponse) ? reponse : (reponse?.results ?? []);
  return charges.map(({ role_code, ...reste }) => ({ ...reste, roleCode: role_code ?? "" }));
}

export async function obtenirMeteo(params?: {
  projetId?: string;
  ville?: string;
  pays?: string;
}): Promise<MeteoProjet> {
  const requete = new URLSearchParams();
  if (params?.projetId) requete.set("projet_id", params.projetId);
  if (params?.ville) requete.set("ville", params.ville);
  if (params?.pays) requete.set("pays", params.pays);
  const chaine = requete.toString();
  return versMeteo(await api.lire<ChargeMeteo>(`/projets/meteo/${chaine ? `?${chaine}` : ""}`));
}

/* ------------------------------------------------------------------ *
 * Lots et activités — routes livrées par Django.
 *
 *   GET/POST   /projets/{id}/lots/          les lots d'un chantier
 *   PATCH/DEL  /lots/{id}/                  un lot (suppression logique)
 *   GET/POST   /lots/{lot_id}/activites/    les activités d'un lot
 *   PATCH/DEL  /activites/{id}/             une activité
 *   GET        /projets/{id}/statistiques/  les chiffres de structure
 *
 * Pas encore branchées : `activation/` (lot et activité) et `lots/import/` —
 * l'import passe d'ici là par la création, lot par lot.
 * ------------------------------------------------------------------ */

interface ChargeEquipe {
  id: string;
  nom: string;
  effectif?: number;
}

interface ChargeEquipeChantierActivite {
  id: string;
  nom: string;
  effectif?: number;
  affectation_id?: string;
}

/**
 * Une activité, telle que `GET /lots/{lot_id}/activites/` la renvoie. Elle
 * n'a pas de code : `listerActivites` lui en donne un d'après son rang dans
 * le lot.
 */
interface ChargeActivite {
  id: string;
  lot_id: string;
  libelle: string;
  statut?: string | null;
  /** L'activité qui doit être terminée avant celle-ci. */
  dependance?: string | null;
  /** Le collaborateur responsable. */
  responsable?: string | null;
  equipe_chantier?: ChargeEquipeChantierActivite | null;
  budget_initial_montant?: number | string | null;
  unite?: UniteActivite | null;
  unite_libelle?: string;
  /** Des `DecimalField`, en chaîne. */
  quantite_prevue?: number | string | null;
  quantite_realisee?: number | string | null;
  avancement?: number | string | null;
  poids?: number | string | null;
  date_debut_prevue?: string | null;
  date_fin_prevue?: string | null;
  date_debut_baseline?: string | null;
  date_fin_baseline?: string | null;
  ordre?: number;
  est_actif?: boolean;
  cree_le?: string;
}

/** Un lot, tel que `GET /projets/{id}/lots/` le renvoie — sans ses activités. */
interface ChargeLot {
  id: string;
  projet_id: string;
  /** `L-01`. */
  code: string;
  nom: string;
  statut?: string | null;
  mode_execution: string;
  type_bordereau: string;
  /** Un `DecimalField` : Django peut l'envoyer en chaîne. */
  budget_initial_montant?: number | string | null;
  date_debut_prevue?: string | null;
  date_fin_prevue?: string | null;
  date_debut_reelle?: string | null;
  date_fin_reelle?: string | null;
  avancement?: number | string | null;
  avancement_temporel?: number | string | null;
  delta_retard?: number | string | null;
  activites_count?: number;
  ordre?: number;
  est_actif?: boolean;
}

/*
 * Les énumérations du serveur ne sont pas celles du domaine. Seules
 * `REGIE`, `FORFAIT` et `PLANIFIE` ont été observées ; les autres valeurs
 * sont supposées porter le nom du domaine — **à confirmer**, et à corriger
 * ici seulement.
 */

const MODE_EXECUTION_SERVEUR: Record<ModeExecutionLot, string> = {
  REGIE_DIRECTE: "REGIE",
  SOUS_TRAITANCE_STRUCTUREE: "SOUS_TRAITANCE_STRUCTUREE",
  SOUS_TRAITANCE_INFORMELLE: "SOUS_TRAITANCE_INFORMELLE",
};

const TYPE_BORDEREAU_SERVEUR: Record<TypeBordereau, string> = {
  FORFAIT_GLOBAL: "FORFAIT",
  PRIX_UNITAIRE: "PRIX_UNITAIRE",
};

const STATUT_SERVEUR: Record<StatutDeclare, string> = {
  NON_DEMARRE: "PLANIFIE",
  EN_COURS: "EN_COURS",
  TERMINE: "TERMINE",
  BLOQUE: "BLOQUE",
};

/**
 * La valeur du domaine qui correspond à celle du serveur. Une valeur déjà
 * au format du domaine passe telle quelle ; une valeur inconnue prend le
 * défaut — l'écran ne reçoit jamais une chaîne qu'il ne sait pas afficher.
 */
function depuisServeur<T extends string>(
  table: Record<T, string>,
  valeur: string | null | undefined,
  defaut: T,
): T {
  if (!valeur) return defaut;
  const domaine = (Object.keys(table) as T[]).find((cle) => table[cle] === valeur);
  if (domaine) return domaine;
  return valeur in table ? (valeur as T) : defaut;
}

/** Une quantité ou un pourcentage : un `DecimalField` peut arriver en chaîne. */
function versNombre(valeur: number | string | null | undefined): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const nombre = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(nombre) ? nombre : null;
}

function versEquipe(charge: ChargeEquipe): EquipeChantier {
  return { id: charge.id, nom: charge.nom, effectif: charge.effectif ?? 0 };
}

/**
 * La traduction d'une activité. `code` est celui que lui donne son rang dans
 * le lot — vide hors d'une liste, l'écran la relit derrière. L'équipe vient
 * de `avecEquipeSimulee` : le serveur n'en donne que les identifiants, et le
 * chemin critique ne fait pas encore partie de sa réponse.
 */
function versActivite(charge: ChargeActivite, code = ""): Activite {
  return {
    id: charge.id,
    lotId: charge.lot_id,
    code,
    libelle: charge.libelle,
    quantitePrevue: versNombre(charge.quantite_prevue),
    unite: charge.unite ?? null,
    budget: versMontant(charge.budget_initial_montant),
    dateDebutPrevue: charge.date_debut_prevue ?? null,
    dateFinPrevue: charge.date_fin_prevue ?? null,
    avancement: versNombre(charge.avancement) ?? 0,
    quantiteRealisee: versNombre(charge.quantite_realisee),
    surCheminCritique: false,
    dependanceId: charge.dependance ?? null,
    responsableId: charge.responsable ?? null,
    equipe: charge.equipe_chantier
      ? {
          id: charge.equipe_chantier.id,
          nom: charge.equipe_chantier.nom,
          effectif: charge.equipe_chantier.effectif ?? 0,
          affectationId: charge.equipe_chantier.affectation_id,
        }
      : null,
    statut: depuisServeur(STATUT_SERVEUR, charge.statut, STATUT_DECLARE_PAR_DEFAUT),
  };
}

/**
 * Le lot seul : la route des lots ne joint pas les activités. `activites`
 * les fournit quand elles ont été lues à part.
 */
function versLot(charge: ChargeLot, activites: Activite[] = []): Lot {
  return {
    id: charge.id,
    projetId: charge.projet_id,
    code: charge.code,
    nom: charge.nom,
    modeExecution: depuisServeur(MODE_EXECUTION_SERVEUR, charge.mode_execution, "REGIE_DIRECTE"),
    typeBordereau: depuisServeur(TYPE_BORDEREAU_SERVEUR, charge.type_bordereau, "FORFAIT_GLOBAL"),
    budget: versMontant(charge.budget_initial_montant),
    dateDebut: charge.date_debut_prevue ?? null,
    dateFin: charge.date_fin_prevue ?? null,
    statut: depuisServeur(STATUT_SERVEUR, charge.statut, STATUT_DECLARE_PAR_DEFAUT),
    avancement: versNombre(charge.avancement),
    avancementTemporel: versNombre(charge.avancement_temporel),
    deltaRetard: versNombre(charge.delta_retard),
    activites,
  };
}

/** DRF pagine ou non selon le `ViewSet` : les deux formes se lisent ici. */
function aPlat<T>(charge: T[] | ChargeListe<T> | null | undefined): T[] {
  return Array.isArray(charge) ? charge : (charge?.results ?? []);
}

function parOrdre<T extends { ordre?: number }>(charges: T[]): T[] {
  return [...charges].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
}

/** Les activités d'un lot, codées `L-03.02` d'après leur rang dans le lot. */
async function listerActivites(
  _projetId: string,
  lot: Pick<ChargeLot, "id" | "code">,
  signal?: AbortSignal,
): Promise<Activite[]> {
  const charge = await api.lire<ChargeActivite[] | ChargeListe<ChargeActivite>>(
    `/lots/${lot.id}/activites/`,
    undefined,
    signal,
  );
  return parOrdre(aPlat(charge)).map((activite, rang) =>
    versActivite(activite, `${lot.code}.${String(rang + 1).padStart(2, "0")}`),
  );
}

/**
 * Les lots d'un chantier, chacun avec ses activités, dans l'ordre du serveur.
 * Les activités se lisent lot par lot, en parallèle ; un lot qui n'en compte
 * aucune n'en coûte pas la requête.
 */
export async function listerLots(projetId: string, signal?: AbortSignal): Promise<Lot[]> {
  const charge = await api.lire<ChargeLot[] | ChargeListe<ChargeLot>>(
    `/projets/${projetId}/lots/`,
    undefined,
    signal,
  );
  return Promise.all(
    parOrdre(aPlat(charge)).map(async (lot) =>
      versLot(lot, lot.activites_count === 0 ? [] : await listerActivites(projetId, lot, signal)),
    ),
  );
}

function versChargeLot(creation: CreationLotProjet) {
  const charge: Record<string, unknown> = {
    nom: creation.nom,
    mode_execution: MODE_EXECUTION_SERVEUR[creation.modeExecution],
    type_bordereau: TYPE_BORDEREAU_SERVEUR[creation.typeBordereau],
    statut: STATUT_SERVEUR[creation.statut ?? STATUT_DECLARE_PAR_DEFAUT],
  };
  if (creation.budget !== undefined) {
    charge.budget_initial_montant = creation.budget;
  }
  if (creation.dateDebut !== undefined) {
    charge.date_debut_prevue = creation.dateDebut;
  }
  if (creation.dateFin !== undefined) {
    charge.date_fin_prevue = creation.dateFin;
  }
  return charge;
}

export async function creerLot(projetId: string, creation: CreationLotProjet): Promise<Lot> {
  return versLot(await api.creer<ChargeLot>(`/projets/${projetId}/lots/`, versChargeLot(creation)));
}

/**
 * Les champs du lot, réécrits ; son code et ses activités ne bougent pas. Le
 * serveur ne renvoie que le lot : ses activités sont à reprendre du cache.
 */
export async function modifierLot(lotId: string, modification: CreationLotProjet): Promise<Lot> {
  return versLot(await api.modifier<ChargeLot>(`/lots/${lotId}/`, versChargeLot(modification)));
}

/**
 * Suppression logique du lot et de ses activités. Le serveur peut refuser un
 * lot dont une activité a déjà avancé — même règle que `lotSupprimable`.
 */
export async function supprimerLot(lotId: string): Promise<void> {
  await api.supprimer(`/lots/${lotId}/`);
}

/**
 * La première feuille d'un fichier Excel de lots, lue et interprétée par
 * `lireLotsImportes`. La bibliothèque n'est chargée qu'ici, au premier
 * import : elle n'a rien à faire dans le paquet des autres écrans.
 *
 * Rejette si le fichier n'est pas un `.xlsx` lisible.
 */
export async function lireFichierLots(
  fichier: File,
  lotsExistants: Lot[],
  budgetProjet: number | null,
  voitMontants: boolean = true,
): Promise<LigneImportLot[]> {
  const { readSheet } = await import("read-excel-file/browser");
  const feuille = await readSheet(fichier);
  return lireLotsImportes(feuille as unknown[][], lotsExistants, budgetProjet, voitMontants);
}

/**
 * Import atomique de lots depuis un classeur Excel envoyé au serveur.
 * Si le serveur rejette le fichier ou une seule ligne, aucun lot n'est créé.
 */
export async function importerLots(
  projetId: string,
  fichier: File,
): Promise<Lot[]> {
  const donnees = new FormData();
  donnees.append("fichier", fichier);
  const charge = await api.creer<ChargeLot[] | ChargeListe<ChargeLot>>(
    `/projets/${projetId}/lots/import/`,
    donnees,
  );
  return aPlat(charge).map((lot) => versLot(lot, []));
}

/**
 * Télécharge le modèle officiel Excel (.xlsx) pour l'import des lots.
 */
export async function telechargerModeleLots(
  projetId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  return api.telecharger(`/projets/${projetId}/lots/modele/`, undefined, signal);
}

function versChargeActivite(saisie: SaisieActiviteDomaine) {
  const charge: Record<string, unknown> = {
    lot_id: saisie.lotId,
    libelle: saisie.libelle,
    quantite_prevue: saisie.quantitePrevue,
    unite: saisie.unite,
    responsable: saisie.responsableId,
    statut: STATUT_SERVEUR[saisie.statut],
  };
  if (saisie.budget !== undefined) {
    charge.budget_initial_montant = saisie.budget;
  }
  if (saisie.dateDebutPrevue !== undefined) {
    charge.date_debut_prevue = saisie.dateDebutPrevue;
  }
  if (saisie.dateFinPrevue !== undefined) {
    charge.date_fin_prevue = saisie.dateFinPrevue;
  }
  return charge;
}

/**
 * À la création, un champ non saisi n'est pas envoyé du tout : le serveur
 * applique son défaut, là où un `null` explicite peut être refusé. Le lot
 * est dans l'adresse, il ne se répète pas dans le corps. (La modification,
 * elle, envoie les `null` : c'est ainsi qu'on vide un champ.)
 */
function sansVides(charge: ReturnType<typeof versChargeActivite>): Partial<typeof charge> {
  return Object.fromEntries(
    Object.entries(charge).filter(
      ([cle, valeur]) => cle !== "lot_id" && valeur !== null && valeur !== undefined,
    ),
  );
}

export async function creerActivite(
  projetId: string,
  saisie: SaisieActiviteDomaine,
): Promise<Activite> {
  let creee = versActivite(
    await api.creer<ChargeActivite>(
      `/lots/${saisie.lotId}/activites/`,
      sansVides(versChargeActivite(saisie)),
    ),
  );
  if (saisie.equipeId) {
    creee = await affecterEquipe(projetId, creee, saisie.equipeId);
  }
  return creee;
}

export async function modifierActivite(
  projetId: string,
  activiteId: string,
  saisie: SaisieActiviteDomaine,
): Promise<Activite> {
  let modifiee = versActivite(
    await api.modifier<ChargeActivite>(`/activites/${activiteId}/`, versChargeActivite(saisie)),
  );
  if (saisie.equipeId !== undefined) {
    const equipeActuelle = modifiee.equipe?.id ?? null;
    if (saisie.equipeId !== equipeActuelle) {
      modifiee = await affecterEquipe(projetId, modifiee, saisie.equipeId);
    }
  }
  return modifiee;
}

/**
 * Les champs du formulaire d'activité que désigne un refus du serveur. Les
 * noms du serveur ne sont pas ceux du formulaire : la correspondance se tient
 * ici, avec le reste de la charge. Un champ sans équivalent (`lot_id`,
 * `non_field_errors`…) est rendu sous sa clé serveur, pour le message général.
 */
const CHAMPS_ACTIVITE: Record<string, string> = {
  lot_id: "lotId",
  libelle: "libelle",
  quantite_prevue: "quantite",
  unite: "unite",
  budget_initial_montant: "budget",
  date_debut_prevue: "dateDebut",
  date_fin_prevue: "dateFin",
  responsable: "responsableId",
  equipe_ids: "equipeId",
  statut: "statut",
};

export function erreursChampsActivite(erreur: ErreurApi): Record<string, string> {
  return Object.fromEntries(
    Object.entries(erreur.erreursParChamp).map(([champ, message]) => [
      CHAMPS_ACTIVITE[champ] ?? champ,
      message,
    ]),
  );
}

/**
 * Suppression logique de l'activité. Le serveur peut refuser une activité
 * qui a déjà avancé — même règle que `activiteSupprimable`.
 */
export async function supprimerActivite(activiteId: string): Promise<void> {
  await api.supprimer(`/activites/${activiteId}/`);
}

/*
 * L'avancement d'une activité ne s'écrit **pas** par `modifierActivite` : le
 * serveur refuse `quantite_realisee` et `avancement` au PATCH ordinaire (403).
 * Il passe par une route dédiée, qui journalise la mise à jour (F3, SFD §5).
 */

/** Une ligne de `GET /activites/{id}/avancement/historique/`. */
interface ChargeEvenementAvancement {
  id: string;
  auteur: string;
  date: string;
  /** Des `DecimalField`, en chaîne. */
  quantite_avant?: number | string | null;
  quantite_apres?: number | string | null;
  avancement_avant?: number | string | null;
  avancement_apres?: number | string | null;
  commentaire: string;
}

function versEvenementAvancement(charge: ChargeEvenementAvancement): EvenementAvancement {
  return {
    id: charge.id,
    auteur: charge.auteur,
    quantiteAvant: versNombre(charge.quantite_avant),
    quantiteApres: versNombre(charge.quantite_apres),
    avancementAvant: versNombre(charge.avancement_avant),
    avancementApres: versNombre(charge.avancement_apres),
    commentaire: charge.commentaire,
    le: new Date(charge.date),
  };
}

/**
 * La mise à jour manuelle de l'avancement (CT et CP du chantier). Le serveur
 * refuse une quantité en baisse (422) et un autre rôle (403) : l'écran
 * affiche alors son message. Renvoie l'activité telle que le serveur l'a
 * recalculée.
 */
export async function mettreAJourAvancement(
  activiteId: string,
  miseAJour: MiseAJourAvancement,
): Promise<Activite> {
  return versActivite(
    await api.modifier<ChargeActivite>(`/activites/${activiteId}/avancement/`, {
      quantite_realisee: miseAJour.quantiteRealisee,
      commentaire: miseAJour.commentaire,
    }),
  );
}

/** Les mises à jour manuelles d'une activité, de la plus récente à la plus ancienne. */
export async function lireHistoriqueAvancement(
  activiteId: string,
  signal?: AbortSignal,
): Promise<EvenementAvancement[]> {
  const charge = await api.lire<
    ChargeEvenementAvancement[] | ChargeListe<ChargeEvenementAvancement>
  >(`/activites/${activiteId}/avancement/historique/`, undefined, signal);
  return aPlat(charge).map(versEvenementAvancement);
}

/**
 * Les chiffres de structure du chantier, recomptés par le serveur. Même forme
 * que ceux joints au projet : la traduction est commune.
 */
export async function lireStatistiques(
  projetId: string,
  signal?: AbortSignal,
): Promise<StatistiquesProjet | null> {
  return versStatistiques(
    await api.lire<ChargeStatistiques>(`/projets/${projetId}/statistiques/`, undefined, signal),
  );
}

/* ------------------------------------------------------------------ *
 * Équipes et affectations — routes réelles servies par Django (B5).
 * ------------------------------------------------------------------ */

interface ChargeMembre {
  id: string;
  prenom?: string;
  nom?: string;
  role?: RoleMembreEquipe;
  collaborateur_id?: string | null;
  utilisateur_id?: string | null;
}

interface ChargeEquipeDetail extends ChargeEquipe {
  projet_id: string;
  nature: NatureEquipe;
  corps_etat?: string;
  specialite?: string;
  chef?: ChargeMembre | null;
  membres?: ChargeMembre[];
}

function versMembre(charge: ChargeMembre, chef = false): MembreEquipe {
  return {
    id: charge.id,
    prenom: charge.prenom ?? "",
    nom: charge.nom ?? "",
    // Un serveur qui ne renverrait pas encore le rôle : la place dans l'équipe le dit.
    role: charge.role ?? (chef ? "CHEF_EQUIPE" : ROLE_MEMBRE_PAR_DEFAUT),
    collaborateurId: charge.collaborateur_id ?? charge.utilisateur_id ?? null,
  };
}

function versChargeMembre(membre: SaisieMembreEquipe): Record<string, unknown> {
  if (membre.collaborateurId) {
    return {
      collaborateur_id: membre.collaborateurId,
      role: membre.role,
    };
  }
  return {
    prenom: membre.prenom,
    nom: membre.nom,
    role: membre.role,
  };
}

function versEquipeDetail(charge: ChargeEquipeDetail): Equipe {
  return {
    ...versEquipe(charge),
    projetId: charge.projet_id,
    nature: charge.nature,
    specialite: charge.specialite ?? charge.corps_etat ?? "",
    chef: charge.chef ? versMembre(charge.chef, true) : null,
    membres: (charge.membres ?? []).map((membre) => versMembre(membre)),
  };
}

/** Les équipes constituées sur un chantier — celles qu'on peut y affecter. */
export async function listerEquipes(projetId: string, signal?: AbortSignal): Promise<Equipe[]> {
  const charge = await api.lire<ChargeEquipeDetail[] | ChargeListe<ChargeEquipeDetail>>(
    `/projets/${projetId}/equipes/`,
    undefined,
    signal,
  );
  const charges = Array.isArray(charge) ? charge : (charge?.results ?? []);
  return charges.map(versEquipeDetail);
}

export async function creerEquipe(projetId: string, creation: CreationEquipe): Promise<Equipe> {
  return versEquipeDetail(
    await api.creer<ChargeEquipeDetail>(`/projets/${projetId}/equipes/`, {
      nom: creation.nom,
      nature: creation.nature,
      specialite: creation.specialite,
      chef: versChargeMembre(creation.chef),
      membres: creation.membres.map(versChargeMembre),
    }),
  );
}

/*
 * Les membres d'une équipe constituée. Chaque écriture renvoie **l'équipe
 * entière** : nommer un chef en fait redescendre un autre, retirer quelqu'un
 * change l'effectif — l'écran repart de ce que le serveur a retenu plutôt que
 * de refaire le calcul de son côté.
 */

export async function ajouterMembreEquipe(
  projetId: string,
  equipeId: string,
  membre: SaisieMembreEquipe,
): Promise<Equipe> {
  return versEquipeDetail(
    await api.creer<ChargeEquipeDetail>(
      `/projets/${projetId}/equipes/${equipeId}/membres/`,
      versChargeMembre(membre),
    ),
  );
}

export async function changerRoleMembreEquipe(
  projetId: string,
  equipeId: string,
  membreId: string,
  role: RoleMembreEquipe,
): Promise<Equipe> {
  return versEquipeDetail(
    await api.modifier<ChargeEquipeDetail>(
      `/projets/${projetId}/equipes/${equipeId}/membres/${membreId}/`,
      { role },
    ),
  );
}

/** Le retrait ne renvoie rien (204) : l'équipe est relue derrière. */
export async function retirerMembreEquipe(
  projetId: string,
  equipeId: string,
  membreId: string,
): Promise<Equipe> {
  await api.supprimer(`/projets/${projetId}/equipes/${equipeId}/membres/${membreId}/`);
  return versEquipeDetail(
    await api.lire<ChargeEquipeDetail>(`/projets/${projetId}/equipes/${equipeId}/`),
  );
}

/**
 * L'équipe d'une activité — `null` la retire. Une écriture à part plutôt que
 * `modifierActivite` : affecter ne doit pas renvoyer (et risquer d'écraser)
 * les dates ou le budget qu'un autre aurait changés entre-temps.
 */
export async function affecterEquipe(
  projetId: string,
  activite: Activite | string,
  equipeId: string | null,
): Promise<Activite> {
  const activiteId = typeof activite === "string" ? activite : activite.id;

  if (equipeId) {
    await api.creer(`/projets/${projetId}/equipes/affectations/`, {
      equipe_id: equipeId,
      activite_id: activiteId,
    });
  } else {
    let affectationId: string | undefined;
    if (typeof activite === "object" && activite.equipe?.affectationId) {
      affectationId = activite.equipe.affectationId;
    } else {
      const chargeAct = await api.lire<ChargeActivite>(`/activites/${activiteId}/`);
      affectationId = chargeAct.equipe_chantier?.affectation_id;
    }

    if (affectationId) {
      await api.supprimer(`/projets/${projetId}/equipes/affectations/${affectationId}/`);
    }
  }

  return versActivite(await api.lire<ChargeActivite>(`/activites/${activiteId}/`));
}

/* ------------------------------------------------------------------ *
 * Reprogrammation des dates et historique (US 3.8, RG-11).
 * ------------------------------------------------------------------ */

interface ChargeMotifReport {
  id: string;
  code: string;
  libelle: string;
  description?: string | null;
  ordre?: number;
}

interface ChargeReprogrammationResultat {
  id: string;
  type_objet: "PROJET" | "LOT" | "ACTIVITE";
  date_debut_prevue: string;
  date_fin_prevue: string;
  date_debut_baseline: string | null;
  date_fin_baseline: string | null;
  jours_derive_baseline: number;
  alerte_dg_declenchee: boolean;
}

interface ChargeHistoriqueDate {
  id: string;
  type_objet: "PROJET" | "LOT" | "ACTIVITE";
  champ: string;
  valeur_avant: string | null;
  valeur_apres: string | null;
  ecart_jours: number | null;
  motif?: ChargeMotifReport | null;
  justification: string;
  auteur_id?: string | null;
  auteur_nom?: string | null;
  auteur_email?: string | null;
  objet_id?: string | null;
  objet_libelle?: string | null;
  projet_id?: string | null;
  projet_reference?: string | null;
  projet_nom?: string | null;
  cree_le: string;
}

function versMotifReport(charge: ChargeMotifReport): MotifReport {
  return {
    id: charge.id,
    code: charge.code,
    libelle: charge.libelle,
    description: charge.description ?? null,
    ordre: charge.ordre,
  };
}

function versResultatReprogrammation(
  charge: ChargeReprogrammationResultat,
): ResultatReprogrammation {
  return {
    id: charge.id,
    typeObjet: charge.type_objet,
    dateDebutPrevue: charge.date_debut_prevue,
    dateFinPrevue: charge.date_fin_prevue,
    dateDebutBaseline: charge.date_debut_baseline,
    dateFinBaseline: charge.date_fin_baseline,
    joursDeriveBaseline: charge.jours_derive_baseline,
    alerteDg: charge.alerte_dg_declenchee,
  };
}

function versEvenementDate(charge: ChargeHistoriqueDate): EvenementDate {
  return {
    id: charge.id,
    typeObjet: charge.type_objet,
    champ: charge.champ,
    avant: charge.valeur_avant,
    apres: charge.valeur_apres,
    ecartJours: charge.ecart_jours,
    motif: charge.motif?.libelle ?? charge.motif?.code ?? "",
    justification: charge.justification,
    auteur: charge.auteur_nom || charge.auteur_email || texte("projets.reprogrammation.systeme"),
    objet: charge.objet_libelle || "",
    objetId: charge.objet_id,
    projetId: charge.projet_id,
    projetNom: charge.projet_nom ?? undefined,
    le: new Date(charge.cree_le),
  };
}

/** La liste dynamique des motifs de report actifs. */
export async function listerMotifsReport(signal?: AbortSignal): Promise<MotifReport[]> {
  const charge = await api.lire<ChargeMotifReport[] | ChargeListe<ChargeMotifReport>>(
    "/referentiels/motifs-report/",
    undefined,
    signal,
  );
  return parOrdre(aPlat(charge)).map(versMotifReport);
}

/** Reprogrammer un projet, un lot ou une activité (US 3.8, RG-11). */
export async function reprogrammer(
  objet: "projets" | "lots" | "activites",
  id: string,
  reprogrammation: Reprogrammation,
): Promise<ResultatReprogrammation> {
  const charge = await api.creer<ChargeReprogrammationResultat>(
    `/${objet}/${id}/reprogrammer/`,
    {
      date_debut_prevue: reprogrammation.dateDebutPrevue || undefined,
      date_fin_prevue: reprogrammation.dateFinPrevue,
      motif_id: reprogrammation.motifId,
      justification: reprogrammation.justification,
    },
  );
  return versResultatReprogrammation(charge);
}

/** L'historique des dates pour un objet précis (projet, lot ou activité). */
export async function lireHistoriqueDates(
  objet: "projets" | "lots" | "activites",
  id: string,
  signal?: AbortSignal,
): Promise<EvenementDate[]> {
  const charge = await api.lire<ChargeHistoriqueDate[] | ChargeListe<ChargeHistoriqueDate>>(
    `/${objet}/${id}/historique-dates/`,
    undefined,
    signal,
  );
  return aPlat(charge).map(versEvenementDate);
}

/** L'historique consolidé des reports d'un projet (projet, lots, activités). */
export async function lireJournalReports(
  projetId: string,
  signal?: AbortSignal,
): Promise<EvenementDate[]> {
  const charge = await api.lire<ChargeHistoriqueDate[] | ChargeListe<ChargeHistoriqueDate>>(
    `/projets/${projetId}/journal-reports/`,
    undefined,
    signal,
  );
  return aPlat(charge).map(versEvenementDate);
}

/* ------------------------------------------------------------------ *
 * Santé du projet (indice de santé, décomposition et historique).
 * ------------------------------------------------------------------ */

interface ChargeSanteProjet {
  projet_id: string;
  statut: string;
  etat_calcul: "NON_DEMARRE" | "ACTIF" | "FIGE";
  score: number | null;
  badge: "VERT" | "ORANGE" | "ROUGE" | null;
  badge_brut: "VERT" | "ORANGE" | "ROUGE" | null;
  avancement_physique: number;
  avancement_temporel: number;
  retard_pts: number;
  seuil_retard: number;
  penalite_delais: number;
  blocages_critiques: number;
  blocages_majeurs: number;
  blocages_moderes: number;
  penalite_blocages: number;
  taux_reporting: number;
  penalite_reporting: number;
  plancher_applique: boolean;
  formule_appliquee: string;
  avertissements: string[];
  calcule_le: string | null;
}

interface ChargeInstantaneSante {
  id: string;
  score: number;
  badge: "VERT" | "ORANGE" | "ROUGE";
  penalite_delais: number;
  penalite_blocages: number;
  penalite_reporting: number;
  retard_pts: number;
  avancement_physique: number;
  avancement_temporel: number;
  taux_reporting: number;
  calcule_le: string;
}

function versSanteProjet(charge: ChargeSanteProjet): SanteProjet {
  return {
    projetId: charge.projet_id,
    statut: charge.statut,
    etatCalcul: charge.etat_calcul,
    score: charge.score,
    badge: charge.badge,
    badgeBrut: charge.badge_brut,
    avancementPhysique: charge.avancement_physique,
    avancementTemporel: charge.avancement_temporel,
    retardPts: charge.retard_pts,
    seuilRetard: charge.seuil_retard,
    penaliteDelais: charge.penalite_delais,
    blocagesCritiques: charge.blocages_critiques,
    blocagesMajeurs: charge.blocages_majeurs,
    blocagesModeres: charge.blocages_moderes,
    penaliteBlocages: charge.penalite_blocages,
    tauxReporting: charge.taux_reporting,
    penaliteReporting: charge.penalite_reporting,
    plancherApplique: charge.plancher_applique,
    formuleAppliquee: charge.formule_appliquee,
    avertissements: charge.avertissements ?? [],
    calculeLe: charge.calcule_le,
  };
}

function versInstantaneSante(charge: ChargeInstantaneSante): InstantaneSante {
  return {
    id: charge.id,
    score: charge.score,
    badge: charge.badge,
    penaliteDelais: charge.penalite_delais,
    penaliteBlocages: charge.penalite_blocages,
    penaliteReporting: charge.penalite_reporting,
    retardPts: charge.retard_pts,
    avancementPhysique: charge.avancement_physique,
    avancementTemporel: charge.avancement_temporel,
    tauxReporting: charge.taux_reporting,
    calculeLe: charge.calcule_le,
  };
}

/** Consultation détaillée de la santé d'un projet (score, pénalités, état). */
export async function lireSanteProjet(
  projetId: string,
  signal?: AbortSignal,
): Promise<SanteProjet> {
  const charge = await api.lire<ChargeSanteProjet>(
    `/projets/${projetId}/sante/detail/`,
    undefined,
    signal,
  );
  return versSanteProjet(charge);
}

/** Historique des instantanés de santé calculés pour un projet. */
export async function lireHistoriqueSante(
  projetId: string,
  signal?: AbortSignal,
): Promise<InstantaneSante[]> {
  const charge = await api.lire<ChargeInstantaneSante[] | ChargeListe<ChargeInstantaneSante>>(
    `/projets/${projetId}/sante/historique/`,
    undefined,
    signal,
  );
  return aPlat(charge).map(versInstantaneSante);
}


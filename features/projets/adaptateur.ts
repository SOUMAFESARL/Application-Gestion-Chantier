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

import { api, type ErreurApi } from "@/lib/api";
import { routesSimulees } from "@/lib/api/simulation";

import {
  lireLotsImportes,
  ROLE_MEMBRE_PAR_DEFAUT,
  STATUT_DECLARE_PAR_DEFAUT,
  statutDeReprise,
} from "./regles";
import { simulationEquipes } from "./simulationEquipes";

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
  FonctionAutreMembre,
  FonctionProjet,
  EquipeChantier,
  Intervenant,
  LigneImportLot,
  Lot,
  MembreEquipe,
  MeteoProjet,
  ModeExecutionLot,
  ModificationProjet,
  NatureEquipe,
  PlanningProjet,
  PonderationAvancement,
  Projet,
  RoleMembreEquipe,
  SaisieActiviteDomaine,
  SaisieMembreEquipe,
  StatistiquesProjet,
  StatutDeclare,
  StatutProjet,
  TypeBordereau,
  TypeProjet,
  UniteActivite,
} from "./types";

/**
 * Équipes et affectations : `false` tant que Django ne les sert pas, ce qui
 * les garde simulées même en production. Les lots et activités, eux, sont
 * servis par le serveur.
 */
const EQUIPES_SIMULEES = routesSimulees(false);

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
  indice_sante?: number | null;
  /** Un `DecimalField` : Django peut l'envoyer en chaîne. */
  budget_initial_montant: number | string | null;
  budget_consomme_montant?: number;
  date_debut_prevue?: string | null;
  date_fin_prevue?: string | null;
  date_debut_reelle?: string | null;
  date_fin_reelle?: string | null;
  duree_jours_ouvres?: number | null;
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
}

interface ChargeAutreMembre {
  utilisateur: ChargeIntervenant;
  fonction: FonctionAutreMembre;
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
  };
}

function intervenants(charges: ChargeIntervenant[] | undefined): Intervenant[] {
  return (charges ?? [])
    .map(versIntervenant)
    .filter((intervenant): intervenant is Intervenant => intervenant !== null);
}

function versChefChantier(charge: ChargeChefChantier): ChefChantierProjet | null {
  const intervenant = versIntervenant(charge.utilisateur);
  return intervenant ? { intervenant, zone: charge.zone || null } : null;
}

function versAutreMembre(charge: ChargeAutreMembre): AutreMembreProjet | null {
  const intervenant = versIntervenant(charge.utilisateur);
  return intervenant ? { intervenant, fonction: charge.fonction } : null;
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
    description: charge.description ?? "",
    typeProjet: charge.type_projet ?? null,
    client: versClient(charge),
    ville: charge.ville,
    quartier: charge.quartier ?? "",
    // Sans statut calculé par le serveur, un projet n'a pas encore démarré.
    statut: charge.statut ?? "EN_ATTENTE",
    avancementReel: charge.avancement_reel ?? 0,
    avancementTheorique: charge.avancement_theorique ?? 0,
    indiceSante: charge.indice_sante ?? null,
    budgetInitial: versMontant(charge.budget_initial_montant),
    budgetConsomme: charge.budget_consomme_montant ?? 0,
    dateDebutPrevue: charge.date_debut_prevue ?? null,
    dateFinPrevue: charge.date_fin_prevue ?? null,
    dateDebutReelle: charge.date_debut_reelle ?? null,
    dateFinReelle: charge.date_fin_reelle ?? null,
    dureeJoursOuvres: charge.duree_jours_ouvres ?? null,
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
  return {
    nom: modification.nom,
    type_projet: modification.typeProjet,
    ville: modification.ville,
    maitre_ouvrage: modification.maitreOuvrage,
    maitre_oeuvre: modification.maitreOeuvre,
  };
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
 * L'équipe d'encadrement et de gestion du projet. Routes proposées par le
 * frontend, pas encore livrées par Django (elles répondent `404` d'ici là). Chaque
 * écriture renvoie **le projet entier** : désigner un chef de projet en
 * remplace un autre, et l'écran repart de ce que le serveur a retenu.
 */

export async function ajouterMembreEncadrement(
  projetId: string,
  ajout: AjoutEncadrement,
): Promise<Projet> {
  return versProjet(
    await api.creer<ChargeProjet>(`/projets/${projetId}/encadrement/`, {
      fonction: ajout.fonction,
      utilisateur_id: ajout.intervenant.id,
      zone: ajout.fonction === "CHEF_CHANTIER" ? ajout.zone : undefined,
      fonction_membre: ajout.fonction === "AUTRE_MEMBRE" ? ajout.fonctionMembre : undefined,
    }),
  );
}

/** Le retrait ne renvoie rien (204) : le projet est relu derrière. */
export async function retirerMembreEncadrement(
  projetId: string,
  fonction: FonctionProjet,
  utilisateurId: string,
): Promise<Projet> {
  await api.supprimer(`/projets/${projetId}/encadrement/${fonction}/${utilisateurId}/`);
  return lireProjet(projetId);
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

/**
 * Une activité, telle que `GET /lots/{lot_id}/activites/` la renvoie. Elle
 * n'a pas de code : `listerActivites` lui en donne un d'après son rang dans
 * le lot. Ses équipes ne sont que des identifiants.
 */
interface ChargeActivite {
  id: string;
  lot_id: string;
  libelle: string;
  statut?: string | null;
  /** L'activité qui doit être terminée avant celle-ci. */
  dependance?: string | null;
  /** Le collaborateur responsable — nom du champ **à confirmer** côté serveur. */
  responsable?: string | null;
  equipe_ids?: string[];
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
    dateDebutPrevue: charge.date_debut_prevue ?? null,
    dateFinPrevue: charge.date_fin_prevue ?? null,
    avancement: versNombre(charge.avancement) ?? 0,
    surCheminCritique: false,
    dependanceId: charge.dependance ?? null,
    responsableId: charge.responsable ?? null,
    equipe: null,
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

/**
 * Tant que les équipes sont simulées, l'équipe d'une activité vient de la
 * simulation : le serveur ne connaît pas ses identifiants.
 */
function avecEquipeSimulee(projetId: string, activites: Activite[]): Activite[] {
  if (!EQUIPES_SIMULEES) return activites;
  const affectations = simulationEquipes.affectations(projetId);
  return activites.map((activite) => ({
    ...activite,
    equipe: affectations.get(activite.id) ?? null,
  }));
}

/** Les activités d'un lot, codées `L-03.02` d'après leur rang dans le lot. */
async function listerActivites(
  projetId: string,
  lot: Pick<ChargeLot, "id" | "code">,
  signal?: AbortSignal,
): Promise<Activite[]> {
  const charge = await api.lire<ChargeActivite[] | ChargeListe<ChargeActivite>>(
    `/lots/${lot.id}/activites/`,
    undefined,
    signal,
  );
  return avecEquipeSimulee(
    projetId,
    parOrdre(aPlat(charge)).map((activite, rang) =>
      versActivite(activite, `${lot.code}.${String(rang + 1).padStart(2, "0")}`),
    ),
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
  return {
    nom: creation.nom,
    mode_execution: MODE_EXECUTION_SERVEUR[creation.modeExecution],
    type_bordereau: TYPE_BORDEREAU_SERVEUR[creation.typeBordereau],
    budget_initial_montant: creation.budget ?? null,
    date_debut_prevue: creation.dateDebut ?? null,
    date_fin_prevue: creation.dateFin ?? null,
    statut: STATUT_SERVEUR[creation.statut ?? STATUT_DECLARE_PAR_DEFAUT],
  };
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
): Promise<LigneImportLot[]> {
  const { readSheet } = await import("read-excel-file/browser");
  const feuille = await readSheet(fichier);
  return lireLotsImportes(feuille as unknown[][], lotsExistants);
}

/**
 * Plusieurs lots d'un coup — l'import d'un fichier. La route dédiée
 * (`lots/import/`, tout ou rien) n'est pas encore branchée : les lots sont
 * créés **un par un, dans l'ordre du fichier**, pour que les codes se
 * suivent. Un échec arrête l'import ; les lots déjà créés le restent.
 */
export async function importerLots(
  projetId: string,
  creations: CreationLotProjet[],
): Promise<Lot[]> {
  const crees: Lot[] = [];
  for (const creation of creations) {
    crees.push(await creerLot(projetId, creation));
  }
  return crees;
}

function versChargeActivite(saisie: SaisieActiviteDomaine) {
  return {
    lot_id: saisie.lotId,
    libelle: saisie.libelle,
    quantite_prevue: saisie.quantitePrevue,
    unite: saisie.unite,
    date_debut_prevue: saisie.dateDebutPrevue,
    date_fin_prevue: saisie.dateFinPrevue,
    // La dépendance ne se saisit plus : un PATCH sans elle la laisse intacte.
    responsable: saisie.responsableId,
    // Une équipe simulée n'existe pas pour le serveur : elle ne lui est pas envoyée.
    ...(EQUIPES_SIMULEES ? {} : { equipe_ids: saisie.equipeId ? [saisie.equipeId] : [] }),
    statut: STATUT_SERVEUR[saisie.statut],
  };
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

/** L'équipe saisie, gardée par la simulation tant que les équipes y vivent. */
function retenirEquipe(projetId: string, activite: Activite, equipeId: string | null): Activite {
  if (!EQUIPES_SIMULEES) return activite;
  return {
    ...activite,
    equipe: simulationEquipes.affecter(projetId, activite.id, equipeId),
  };
}

export async function creerActivite(
  projetId: string,
  saisie: SaisieActiviteDomaine,
): Promise<Activite> {
  const creee = versActivite(
    await api.creer<ChargeActivite>(
      `/lots/${saisie.lotId}/activites/`,
      sansVides(versChargeActivite(saisie)),
    ),
  );
  return retenirEquipe(projetId, creee, saisie.equipeId);
}

export async function modifierActivite(
  projetId: string,
  activiteId: string,
  saisie: SaisieActiviteDomaine,
): Promise<Activite> {
  const modifiee = versActivite(
    await api.modifier<ChargeActivite>(`/activites/${activiteId}/`, versChargeActivite(saisie)),
  );
  return retenirEquipe(projetId, modifiee, saisie.equipeId);
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
 * Équipes et affectations — routes proposées, pas encore livrées : servies
 * par `simulationEquipes.ts` en attendant Django.
 * ------------------------------------------------------------------ */

interface ChargeMembre {
  id: string;
  prenom: string;
  nom: string;
  role?: RoleMembreEquipe;
  collaborateur_id?: string | null;
}

interface ChargeEquipeDetail extends ChargeEquipe {
  projet_id: string;
  nature: NatureEquipe;
  specialite?: string;
  chef?: ChargeMembre | null;
  membres?: ChargeMembre[];
}

function versMembre(charge: ChargeMembre, chef = false): MembreEquipe {
  return {
    id: charge.id,
    prenom: charge.prenom,
    nom: charge.nom,
    // Un serveur qui ne renverrait pas encore le rôle : la place dans l'équipe le dit.
    role: charge.role ?? (chef ? "CHEF_EQUIPE" : ROLE_MEMBRE_PAR_DEFAUT),
    collaborateurId: charge.collaborateur_id ?? null,
  };
}

function versChargeMembre(membre: SaisieMembreEquipe): Omit<ChargeMembre, "id"> {
  return {
    prenom: membre.prenom,
    nom: membre.nom,
    role: membre.role,
    collaborateur_id: membre.collaborateurId,
  };
}

function versEquipeDetail(charge: ChargeEquipeDetail): Equipe {
  return {
    ...versEquipe(charge),
    projetId: charge.projet_id,
    nature: charge.nature,
    specialite: charge.specialite ?? "",
    chef: charge.chef ? versMembre(charge.chef, true) : null,
    membres: (charge.membres ?? []).map((membre) => versMembre(membre)),
  };
}

/** Les équipes constituées sur un chantier — celles qu'on peut y affecter. */
export async function listerEquipes(projetId: string, signal?: AbortSignal): Promise<Equipe[]> {
  if (EQUIPES_SIMULEES) return simulationEquipes.listerEquipes(projetId);
  const charge = await api.lire<ChargeEquipeDetail[] | ChargeListe<ChargeEquipeDetail>>(
    `/projets/${projetId}/equipes/`,
    undefined,
    signal,
  );
  const charges = Array.isArray(charge) ? charge : (charge?.results ?? []);
  return charges.map(versEquipeDetail);
}

export async function creerEquipe(projetId: string, creation: CreationEquipe): Promise<Equipe> {
  if (EQUIPES_SIMULEES) return simulationEquipes.creerEquipe(projetId, creation);
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
  if (EQUIPES_SIMULEES) return simulationEquipes.ajouterMembre(projetId, equipeId, membre);
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
  if (EQUIPES_SIMULEES)
    return simulationEquipes.changerRoleMembre(projetId, equipeId, membreId, role);
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
  if (EQUIPES_SIMULEES) return simulationEquipes.retirerMembre(projetId, equipeId, membreId);
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
  activiteId: string,
  equipeId: string | null,
): Promise<Activite> {
  if (EQUIPES_SIMULEES) {
    const activite = versActivite(await api.lire<ChargeActivite>(`/activites/${activiteId}/`));
    return {
      ...activite,
      equipe: simulationEquipes.affecter(projetId, activiteId, equipeId),
    };
  }
  return versActivite(
    await api.modifier<ChargeActivite>(`/activites/${activiteId}/`, {
      equipe_ids: equipeId ? [equipeId] : [],
    }),
  );
}

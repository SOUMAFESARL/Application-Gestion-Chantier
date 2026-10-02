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

import { api } from "@/lib/api";
import { routesSimulees } from "@/lib/api/simulation";

import { lireLotsImportes, ROLE_MEMBRE_PAR_DEFAUT } from "./regles";
import { simulationLots } from "./simulationLots";

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
  Projet,
  RoleMembreEquipe,
  SaisieActiviteDomaine,
  SaisieMembreEquipe,
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
 * La suspension et la reprise sont des **actions**, pas une écriture du
 * statut : c'est le serveur qui décide du statut qu'un projet retrouve à sa
 * reprise (en cours, en retard…), à partir de son planning. Un `PATCH
 * statut` laisserait l'écran l'inventer.
 */
export async function suspendreProjet(id: string): Promise<Projet> {
  return versProjet(await api.creer<ChargeProjet>(`/projets/${id}/suspendre/`, {}));
}

export async function reprendreProjet(id: string): Promise<Projet> {
  return versProjet(await api.creer<ChargeProjet>(`/projets/${id}/reprendre/`, {}));
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
 * Lots et activités.
 *
 * Aucune de ces routes n'est encore livrée côté Django : elles passent par
 * `simulationLots.ts`, en production comme en développement. Les formes
 * ci-dessous sont la proposition du frontend, à aligner ici — et seulement
 * ici — quand les routes arriveront.
 * ------------------------------------------------------------------ */

/**
 * Lots, activités, équipes et affectations : `false` tant que Django ne les
 * sert pas, ce qui les garde simulés même en production.
 */
const LOTS_SIMULES = routesSimulees(false);

interface ChargeEquipe {
  id: string;
  nom: string;
  effectif?: number;
}

interface ChargeActivite {
  id: string;
  lot_id: string;
  code: string;
  libelle: string;
  quantite_prevue?: number | null;
  unite?: UniteActivite | null;
  date_debut_prevue?: string | null;
  date_fin_prevue?: string | null;
  avancement?: number;
  sur_chemin_critique?: boolean;
  dependance_id?: string | null;
  equipe?: ChargeEquipe | null;
}

interface ChargeLot {
  id: string;
  projet_id: string;
  code: string;
  nom: string;
  mode_execution: ModeExecutionLot;
  type_bordereau: TypeBordereau;
  budget_montant?: number | null;
  date_debut?: string | null;
  date_fin?: string | null;
  activites?: ChargeActivite[];
}

function versEquipe(charge: ChargeEquipe): EquipeChantier {
  return { id: charge.id, nom: charge.nom, effectif: charge.effectif ?? 0 };
}

function versActivite(charge: ChargeActivite): Activite {
  return {
    id: charge.id,
    lotId: charge.lot_id,
    code: charge.code,
    libelle: charge.libelle,
    quantitePrevue: charge.quantite_prevue ?? null,
    unite: charge.unite ?? null,
    dateDebutPrevue: charge.date_debut_prevue ?? null,
    dateFinPrevue: charge.date_fin_prevue ?? null,
    avancement: charge.avancement ?? 0,
    surCheminCritique: charge.sur_chemin_critique ?? false,
    dependanceId: charge.dependance_id ?? null,
    equipe: charge.equipe ? versEquipe(charge.equipe) : null,
  };
}

function versLot(charge: ChargeLot): Lot {
  return {
    id: charge.id,
    projetId: charge.projet_id,
    code: charge.code,
    nom: charge.nom,
    modeExecution: charge.mode_execution,
    typeBordereau: charge.type_bordereau,
    budget: charge.budget_montant ?? null,
    dateDebut: charge.date_debut ?? null,
    dateFin: charge.date_fin ?? null,
    activites: (charge.activites ?? []).map(versActivite),
  };
}

function versChargeActivite(saisie: SaisieActiviteDomaine) {
  return {
    lot_id: saisie.lotId,
    libelle: saisie.libelle,
    quantite_prevue: saisie.quantitePrevue,
    unite: saisie.unite,
    date_debut_prevue: saisie.dateDebutPrevue,
    date_fin_prevue: saisie.dateFinPrevue,
    dependance_id: saisie.dependanceId,
    equipe_id: saisie.equipeId,
  };
}

/** Les lots d'un chantier, chacun avec ses activités, dans l'ordre des codes. */
export async function listerLots(projetId: string, signal?: AbortSignal): Promise<Lot[]> {
  if (LOTS_SIMULES) return simulationLots.lister(projetId);
  const charge = await api.lire<ChargeLot[] | ChargeListe<ChargeLot>>(
    `/projets/${projetId}/lots/`,
    undefined,
    signal,
  );
  const charges = Array.isArray(charge) ? charge : (charge?.results ?? []);
  return charges.map(versLot);
}

function versChargeLot(creation: CreationLotProjet) {
  return {
    nom: creation.nom,
    mode_execution: creation.modeExecution,
    type_bordereau: creation.typeBordereau,
    budget_montant: creation.budget,
    date_debut: creation.dateDebut,
    date_fin: creation.dateFin,
  };
}

export async function creerLot(projetId: string, creation: CreationLotProjet): Promise<Lot> {
  if (LOTS_SIMULES) return simulationLots.creerLot(projetId, creation);
  return versLot(await api.creer<ChargeLot>(`/projets/${projetId}/lots/`, versChargeLot(creation)));
}

/** Les champs du lot, réécrits ; son code et ses activités ne bougent pas. */
export async function modifierLot(
  projetId: string,
  lotId: string,
  modification: CreationLotProjet,
): Promise<Lot> {
  if (LOTS_SIMULES) return simulationLots.modifierLot(projetId, lotId, modification);
  return versLot(
    await api.modifier<ChargeLot>(`/projets/${projetId}/lots/${lotId}/`, versChargeLot(modification)),
  );
}

/**
 * Le lot et ses activités. Le serveur refuse (`lot_avance`) un lot dont une
 * activité a déjà avancé — même règle que `lotSupprimable`.
 */
export async function supprimerLot(projetId: string, lotId: string): Promise<void> {
  if (LOTS_SIMULES) return simulationLots.supprimerLot(projetId, lotId);
  await api.supprimer(`/projets/${projetId}/lots/${lotId}/`);
}

/**
 * La première feuille d'un fichier Excel de lots, lue et interprétée par
 * `lireLotsImportes`. La bibliothèque n'est chargée qu'ici, au premier
 * import : elle n'a rien à faire dans le paquet des autres écrans.
 *
 * Rejette si le fichier n'est pas un `.xlsx` lisible.
 */
export async function lireFichierLots(fichier: File, lotsExistants: Lot[]): Promise<LigneImportLot[]> {
  const { readSheet } = await import("read-excel-file/browser");
  const feuille = await readSheet(fichier);
  return lireLotsImportes(feuille as unknown[][], lotsExistants);
}

/**
 * Plusieurs lots d'un coup — l'import d'un fichier. **Une seule requête** :
 * le serveur les crée tous ou aucun, et un import ne s'arrête jamais à la
 * moitié, avec des codes déjà pris et le reste à refaire à la main.
 */
export async function importerLots(projetId: string, creations: CreationLotProjet[]): Promise<Lot[]> {
  if (LOTS_SIMULES) return simulationLots.importerLots(projetId, creations);
  const charge = await api.creer<ChargeLot[]>(`/projets/${projetId}/lots/import/`, {
    lots: creations.map(versChargeLot),
  });
  return (charge ?? []).map(versLot);
}

export async function creerActivite(
  projetId: string,
  saisie: SaisieActiviteDomaine,
): Promise<Activite> {
  if (LOTS_SIMULES) return simulationLots.creerActivite(projetId, saisie);
  return versActivite(
    await api.creer<ChargeActivite>(`/projets/${projetId}/activites/`, versChargeActivite(saisie)),
  );
}

export async function modifierActivite(
  projetId: string,
  activiteId: string,
  saisie: SaisieActiviteDomaine,
): Promise<Activite> {
  if (LOTS_SIMULES) return simulationLots.modifierActivite(projetId, activiteId, saisie);
  return versActivite(
    await api.modifier<ChargeActivite>(
      `/projets/${projetId}/activites/${activiteId}/`,
      versChargeActivite(saisie),
    ),
  );
}

/* ------------------------------------------------------------------ *
 * Équipes et affectations — même statut que les lots : routes proposées,
 * servies par `simulationLots.ts` en attendant Django.
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
  if (LOTS_SIMULES) return simulationLots.listerEquipes(projetId);
  const charge = await api.lire<ChargeEquipeDetail[] | ChargeListe<ChargeEquipeDetail>>(
    `/projets/${projetId}/equipes/`,
    undefined,
    signal,
  );
  const charges = Array.isArray(charge) ? charge : (charge?.results ?? []);
  return charges.map(versEquipeDetail);
}

export async function creerEquipe(projetId: string, creation: CreationEquipe): Promise<Equipe> {
  if (LOTS_SIMULES) return simulationLots.creerEquipe(projetId, creation);
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
  if (LOTS_SIMULES) return simulationLots.ajouterMembre(projetId, equipeId, membre);
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
  if (LOTS_SIMULES) return simulationLots.changerRoleMembre(projetId, equipeId, membreId, role);
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
  if (LOTS_SIMULES) return simulationLots.retirerMembre(projetId, equipeId, membreId);
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
  if (LOTS_SIMULES) return simulationLots.affecterEquipe(projetId, activiteId, equipeId);
  return versActivite(
    await api.modifier<ChargeActivite>(`/projets/${projetId}/activites/${activiteId}/`, {
      equipe_id: equipeId,
    }),
  );
}

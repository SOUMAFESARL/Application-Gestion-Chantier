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
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";

import { simulationProjets } from "./simulationProjets";

import type {
  AlerteIntemperies,
  ClientProjet,
  CreationProjet,
  InvitationIntervenant,
  Intervenant,
  MeteoProjet,
  Projet,
  StatutProjet,
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

interface ChargeProjet {
  id: string;
  reference: string;
  nom: string;
  description?: string;
  client: ChargeClient;
  ville: string;
  quartier?: string;
  statut: StatutProjet;
  avancement_reel: number;
  avancement_theorique: number;
  budget_initial_montant: number | null;
  budget_consomme_montant?: number;
  date_debut_prevue: string;
  date_fin_prevue: string;
  date_debut_reelle?: string | null;
  date_fin_reelle?: string | null;
  chef_projet?: ChargeIntervenant | null;
  conducteur_travaux?: ChargeIntervenant | null;
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

interface ChargeCreationProjet {
  nom: string;
  client: string;
  ville: string;
  quartier?: string;
  date_debut_prevue: string;
  date_fin_prevue: string;
  budget_initial_montant?: number | null;
  description?: string;
  chef_projet_id?: string;
  chef_projet_invite?: ChargeInvitation;
  conducteur_travaux_id?: string;
  conducteur_travaux_invite?: ChargeInvitation;
}

interface ChargeInvitation {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
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

function versClient(charge: ChargeClient): ClientProjet {
  return {
    id: charge.id,
    raisonSociale: charge.raison_sociale,
    telephone: charge.telephone ?? null,
    email: charge.email ?? null,
    ville: charge.ville ?? null,
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
    client: versClient(charge.client),
    ville: charge.ville,
    quartier: charge.quartier ?? "",
    statut: charge.statut,
    avancementReel: charge.avancement_reel ?? 0,
    avancementTheorique: charge.avancement_theorique ?? 0,
    budgetInitial: charge.budget_initial_montant ?? null,
    budgetConsomme: charge.budget_consomme_montant ?? 0,
    dateDebutPrevue: charge.date_debut_prevue,
    dateFinPrevue: charge.date_fin_prevue,
    dateDebutReelle: charge.date_debut_reelle ?? null,
    dateFinReelle: charge.date_fin_reelle ?? null,
    chefProjet: versIntervenant(charge.chef_projet),
    conducteurTravaux: versIntervenant(charge.conducteur_travaux),
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

function versInvitation(invitation: InvitationIntervenant): ChargeInvitation {
  return {
    nom: invitation.nom,
    prenom: invitation.prenom,
    email: invitation.email,
    telephone: invitation.telephone,
  };
}

/** Traduction domaine vers serveur — le seul sens où l'on écrit du `snake_case`. */
function versChargeCreation(creation: CreationProjet): ChargeCreationProjet {
  return {
    nom: creation.nom,
    client: creation.clientId,
    ville: creation.ville,
    quartier: creation.quartier,
    date_debut_prevue: creation.dateDebutPrevue,
    date_fin_prevue: creation.dateFinPrevue,
    budget_initial_montant: creation.budgetInitial,
    description: creation.description,
    chef_projet_id: creation.chefProjetId,
    chef_projet_invite: creation.chefProjetInvite
      ? versInvitation(creation.chefProjetInvite)
      : undefined,
    conducteur_travaux_id: creation.conducteurTravauxId,
    conducteur_travaux_invite: creation.conducteurTravauxInvite
      ? versInvitation(creation.conducteurTravauxInvite)
      : undefined,
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
 *
 * `GET /projets/` n'est pas encore branché : sous `NEXT_PUBLIC_API_SIMULE`,
 * la lecture vient du jeu de démonstration du domaine. L'appel réel est déjà
 * à sa place définitive — le jour où la route existe, le drapeau passe à `0`
 * et aucun écran ne bouge.
 */
export async function listerProjets(signal?: AbortSignal): Promise<Projet[]> {
  if (SIMULATION_ACTIVE) return simulationProjets.lister();

  const charge = await api.lire<ChargeProjet[] | ChargeListe<ChargeProjet>>(
    "/projets/",
    undefined,
    signal,
  );
  const charges = Array.isArray(charge) ? charge : (charge?.results ?? []);
  return charges.map(versProjet);
}

export async function lireProjet(id: string): Promise<Projet> {
  if (SIMULATION_ACTIVE) return simulationProjets.lire(id);
  return versProjet(await api.lire<ChargeProjet>(`/projets/${id}/`));
}

export async function creerProjet(creation: CreationProjet): Promise<Projet> {
  if (SIMULATION_ACTIVE) return simulationProjets.creer(creation);
  return versProjet(await api.creer<ChargeProjet>("/projets/", versChargeCreation(creation)));
}

/** `budgetInitial` est en **centimes**, comme partout dans le domaine. */
export async function definirBudgetProjet(id: string, budgetInitial: number): Promise<Projet> {
  return versProjet(
    await api.modifier<ChargeProjet>(`/projets/${id}/`, {
      budget_initial_montant: budgetInitial,
    }),
  );
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

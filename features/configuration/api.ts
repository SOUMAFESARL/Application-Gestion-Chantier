/**
 * Configuration initiale — contrat T-024.
 *
 * La ressource s'appelle `/configuration/`, **au singulier** : il n'en existe
 * qu'une par schéma (conventions §2.2 réserve le pluriel aux collections), et
 * en français (décision A3). `WizardProgress` était le nom de travail du
 * backlog ; le `CLAUDE.md` du dépôt réserve le français aux noms de modèles,
 * de tables, de colonnes et de routes.
 *
 * **Le pourcentage n'est jamais écrit.** Il se déduit des étapes franchies
 * (R-90). Ce que le serveur persiste, ce sont les étapes ; le nombre s'en
 * calcule — un champ calculé qu'on peut écrire finit toujours par diverger de
 * son calcul (MLD §7.4).
 *
 * **Cet endpoint n'écrit aucune donnée métier** (R-98). L'entreprise, le
 * projet et les invitations sont créés par leurs endpoints respectifs ; ici on
 * enregistre seulement qu'une étape a été franchie.
 */

import { api } from "@/lib/api";
import { SIMULATION_ACTIVE, simulationConfiguration } from "@/lib/api/simulation";

const BASE = "/configuration";

/**
 * Émis quand le profil de l'entreprise change — logo, nom, couleur de marque.
 *
 * **La barre d'application chargeait l'entreprise une seule fois, au montage.**
 * Elle reste montée pendant toute la navigation dans `(app)` : un logo téléversé
 * à l'étape 1 du wizard n'y apparaissait donc **qu'après un rechargement
 * complet de la page**. La personne voyait son logo accepté d'un côté de
 * l'écran et l'icône générique de l'autre, sans comprendre lequel des deux
 * disait vrai.
 *
 * Même mécanisme que `EVENEMENT_SESSION_EXPIREE` : la couche qui écrit
 * **signale**, et l'écran décide. Pas de magasin d'état global à introduire
 * pour un seul rafraîchissement.
 */
export const EVENEMENT_ENTREPRISE_MODIFIEE = "ccd:entreprise-modifiee";

function signalerEntrepriseModifiee(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENEMENT_ENTREPRISE_MODIFIEE));
  }
}

// ---------------------------------------------------------------------------
// Types du contrat
// ---------------------------------------------------------------------------
export type CodeEtape = "ENTREPRISE" | "PROJET" | "EQUIPE";
export type ModeFranchissement = "VALIDEE" | "PASSEE";

export interface EtapeFranchie {
  code: CodeEtape;
  mode: ModeFranchissement | null;
  franchie_le: string | null;
}

export interface Progression {
  statut: "EN_COURS" | "TERMINEE";
  etape_courante: CodeEtape;
  /** Lecture seule — calculé côté serveur, refusé en écriture (R-90). */
  pourcentage: number;
  demarre_le: string;
  terminee_le: string | null;
  /** Les trois étapes, toujours, dans l'ordre — même non franchies. */
  etapes: EtapeFranchie[];
}

/**
 * Le catalogue, dans l'ordre. L'ordre est porté par le code, pas par la base.
 *
 * **Aucun libellé ici.** Ils vivaient dans ce tableau, en français, dans un
 * module que la règle `no-literal-string` ne regarde pas — elle ne voit que le
 * JSX. Ils sont dans `messages/fr.json`, sous `configuration.etapes.<CODE>`,
 * et l'écran les lit par le code de l'étape : Socle Commun §1.1.
 */
export const ETAPES: {
  code: CodeEtape;
  facultative: boolean;
}[] = [
  { code: "ENTREPRISE", facultative: false },
  { code: "PROJET", facultative: true },
  { code: "EQUIPE", facultative: true },
];

export interface DonneesEntreprise {
  raison_sociale: string;
  nom_commercial?: string;
  /**
   * Le pays, **en lecture seule** : choisi à l'inscription, il gouverne la
   * liste des villes de l'étape 1 et l'indicatif proposé par les champs
   * téléphone. Le serveur le renvoie et refuse de le modifier — changer de
   * pays après avoir saisi des chantiers laisserait leurs villes derrière.
   */
  pays?: string;
  adresse: string;
  ville: string;
  rccm: string;
  nif: string;
  telephone_contact: string;
  email_contact: string;
  /**
   * Les trois variantes du logo, en **URL absolues**, en lecture seule.
   *
   * `logo_1x` et `logo` sont la même marque taillée pour les deux densités
   * d'écran de la barre — **32 px de haut, largeur libre**. La forme du logo
   * est conservée : pressé dans un carré, un logo qui porte un nom devient
   * illisible. `logo_original` est le master recadré, pour les documents.
   */
  logo?: string;
  logo_1x?: string;
  logo_original?: string;
  couleur_primaire?: string;
  statut?: string;
  /**
   * Efface le logo. `logo: ""` ne le fait plus : le champ est calculé côté
   * serveur depuis une clé de stockage, il n'est plus inscriptible.
   */
  retirer_logo?: boolean;
}

/** La réponse du `PATCH`. `fond_retire` n'accompagne qu'un envoi de fichier. */
export interface ReponseEntreprise extends DonneesEntreprise {
  /**
   * Le détourage a-t-il eu lieu. Il ne s'applique qu'à un fond **uniforme** :
   * un dégradé, une photo ou un cadre le font échouer, légitimement. Ce qui ne
   * l'était pas, c'est que l'échec soit muet — le logo partait alors en barre
   * avec son rectangle, et l'écran qui l'avait envoyé n'en savait rien.
   */
  fond_retire?: boolean;
}

export interface DonneesProjet {
  nom: string;
  client_raison_sociale: string;
  client_telephone: string;
  ville: string;
  date_debut_prevue: string;
  date_fin_prevue: string;
  /** Centimes de FCFA — conventions §6. L'écran saisit des francs. Facultatif (null). */
  budget_initial_montant: number | null;
  description: string;
  chef_projet_id?: string | null;
  chef_projet_invite?: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
  } | null;
  conducteur_travaux_id?: string | null;
  conducteur_travaux_invite?: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
  } | null;
}

export interface Collaborateur {
  email: string;
  nom: string;
  role_propose: string;
}

// ---------------------------------------------------------------------------
// La progression — réelle depuis DEV-11 (03/09/2026)
//
// Ces quatre appels n'ont plus de branche simulée : les endpoints existent,
// écrivent dans `progression_configuration` et `etape_configuration`, et
// journalisent le franchissement. Laisser la branche « au cas où » aurait
// gardé deux implémentations d'un même contrat, dont une seule est vérifiée
// par les tests du serveur.
// ---------------------------------------------------------------------------
export function lireProgression(): Promise<Progression> {
  return api.lire<Progression>(`${BASE}/`);
}

export function validerEtape(code: CodeEtape): Promise<Progression> {
  return api.creer<Progression>(`${BASE}/etapes/${code}/valider/`, {});
}

export function passerEtape(code: CodeEtape): Promise<Progression> {
  return api.creer<Progression>(`${BASE}/etapes/${code}/passer/`, {});
}

export function terminerConfiguration(): Promise<Progression> {
  return api.creer<Progression>(`${BASE}/terminer/`, {});
}

// ---------------------------------------------------------------------------
// Les écritures métier — endpoints propres, appelés par les étapes
// ---------------------------------------------------------------------------
export function lireEntreprise(): Promise<DonneesEntreprise> {
  if (SIMULATION_ACTIVE)
    return Promise.resolve({
      raison_sociale: "ENTREPRISE DÉMO",
      pays: "CI",
      adresse: "",
      ville: "",
      rccm: "",
      nif: "",
      telephone_contact: "",
      email_contact: "",
    });
  return api.lire<DonneesEntreprise>("/entreprise/");
}

/**
 * Le pays de l'entreprise, mémorisé pour la durée de l'onglet.
 *
 * Il est demandé par tous les écrans qui proposent une ville ou un indicatif —
 * l'étape 1, l'étape 2, la création de chantier depuis le tableau de bord.
 * Sans mémoire, chacun rappellerait `/entreprise/` pour un code de deux
 * lettres qui ne change jamais : le pays est **en lecture seule** côté
 * serveur, il n'y a donc rien à invalider.
 */
let paysMemorise: Promise<string> | null = null;

export function paysEntreprise(): Promise<string> {
  if (!paysMemorise) {
    paysMemorise = lireEntreprise()
      .then((entreprise) => entreprise.pays || "")
      .catch(() => {
        // Un échec ne se garde pas en mémoire : l'écran affichera sa saisie
        // libre cette fois-ci, et le prochain qui demande retentera.
        paysMemorise = null;
        return "";
      });
  }
  return paysMemorise;
}

export function enregistrerEntreprise(
  donnees: DonneesEntreprise,
  fichierLogo?: File | null,
): Promise<ReponseEntreprise> {
  if (SIMULATION_ACTIVE)
    return simulationConfiguration
      .enregistrerEntreprise({ ...donnees })
      .then(() => ({ ...donnees }));

  if (fichierLogo) {
    const formData = new FormData();
    formData.append("fichier_logo", fichierLogo);
    for (const [cle, valeur] of Object.entries(donnees)) {
      if (valeur !== undefined && valeur !== null && valeur !== "") {
        formData.append(cle, String(valeur));
      }
    }
    return api.modifier<ReponseEntreprise>("/entreprise/", formData).then((r) => {
      signalerEntrepriseModifiee();
      return r;
    });
  }

  return api.modifier<ReponseEntreprise>("/entreprise/", donnees).then((r) => {
    signalerEntrepriseModifiee();
    return r;
  });
}

/**
 * L'étape 2 enchaîne **deux** appels : le client est un `Tiers`, pas une
 * chaîne (MLD §6.1, `client_id NOT NULL → tiers(id)`). Créer le tiers depuis
 * `POST /projets/` serait commode pour le wizard et irrégulier pour l'API,
 * où un client se crée par `POST /tiers/` — T-022 §8.
 */
export function creerPremierProjet(donnees: DonneesProjet): Promise<{ reference: string }> {
  if (SIMULATION_ACTIVE) return simulationConfiguration.creerProjet({ ...donnees });
  return api
    .creer<{ id: string }>("/tiers/", {
      type_tiers: "ENTREPRISE",
      raison_sociale: donnees.client_raison_sociale,
      telephone: donnees.client_telephone,
      roles: ["CLIENT_MOA"],
    })
    .then((tiers) => {
      const corps: Record<string, unknown> = {
        nom: donnees.nom,
        client: tiers.id,
        ville: donnees.ville,
        date_debut_prevue: donnees.date_debut_prevue,
        date_fin_prevue: donnees.date_fin_prevue,
        budget_initial_montant: donnees.budget_initial_montant ?? null,
        description: donnees.description,
      };
      const ctId = donnees.conducteur_travaux_id || donnees.chef_projet_id;
      const ctInvite = donnees.conducteur_travaux_invite || donnees.chef_projet_invite;
      if (ctId) {
        corps.conducteur_travaux_id = ctId;
        corps.chef_projet_id = ctId;
      }
      if (ctInvite) {
        corps.conducteur_travaux_invite = ctInvite;
        corps.chef_projet_invite = ctInvite;
      }
      return api.creer<{ reference: string }>("/projets/", corps);
    });
}

export function modifierPremierProjet(
  projetId: string,
  tiersId: string,
  donnees: DonneesProjet,
): Promise<{ reference: string }> {
  if (SIMULATION_ACTIVE) return simulationConfiguration.creerProjet({ ...donnees });
  return api
    .modifier<{ id: string }>(`/tiers/${tiersId}/`, {
      raison_sociale: donnees.client_raison_sociale,
      telephone: donnees.client_telephone,
    })
    .then(() => {
      const corps: Record<string, unknown> = {
        nom: donnees.nom,
        ville: donnees.ville,
        date_debut_prevue: donnees.date_debut_prevue,
        date_fin_prevue: donnees.date_fin_prevue,
        budget_initial_montant: donnees.budget_initial_montant ?? null,
        description: donnees.description,
      };
      const ctId = donnees.conducteur_travaux_id || donnees.chef_projet_id;
      if (ctId) {
        corps.conducteur_travaux_id = ctId;
        corps.chef_projet_id = ctId;
      }
      return api.modifier<{ reference: string }>(`/projets/${projetId}/`, corps);
    });
}

export function inviterCollaborateurs(liste: Collaborateur[]): Promise<void> {
  if (SIMULATION_ACTIVE) return simulationConfiguration.inviter(liste);
  return Promise.all(liste.map((c) => api.creer("/invitations/", c))).then(() => undefined);
}


/** Récapitulatif de l'écran de confirmation — M9. */
export interface Recapitulatif {
  entreprise: Record<string, unknown> | null;
  projet: Record<string, unknown> | null;
  reference: string | null;
  invitations: number;
}

export function lireRecapitulatif(): Promise<Recapitulatif> {
  if (SIMULATION_ACTIVE) return simulationConfiguration.recapitulatif();
  return api.lire<Recapitulatif>(`${BASE}/recapitulatif/`);
}

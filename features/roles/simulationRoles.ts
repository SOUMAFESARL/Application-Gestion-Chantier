/**
 * Le jeu de démonstration du domaine Rôles — en attendant les endpoints.
 *
 * **Pourquoi ce module existe.** `GET/POST/PATCH /roles/` ne sont pas encore
 * branchés sur ce poste : `NEXT_PUBLIC_API_URL` pointe vers l'API réelle
 * (`api-chantier.soumafe.com`), où ce navigateur n'a pas de session valide.
 * Sans ce module, l'écran `/parametres/roles` s'ouvrait donc sur « Vous devez
 * être connecté pour effectuer cette action » — la réponse bien réelle de ce
 * serveur distant à une requête sans jeton valable — au lieu de la matrice de
 * démonstration.
 *
 * **Ce qu'il n'est pas.** Il ne remplace pas le serveur. Les vrais appels
 * restent à leur place définitive dans `api.ts`, juste à côté de l'aiguillage :
 * le jour où les routes existent, `NEXT_PUBLIC_API_SIMULE` passe à `0` et
 * **aucun écran ne change**. C'est la règle de `lib/api/simulation.ts`,
 * appliquée à ce domaine — même mécanique que `features/projets`.
 *
 * **Il parle le domaine, pas le transport.** `api.ts` ne traduit aujourd'hui
 * aucune charge utile (`RoleItem` est déjà la forme lue depuis `/roles/`) :
 * la simulation renvoie donc directement les types de `types.ts`, sans
 * `Charge*` intermédiaire à inventer.
 *
 * **Il se souvient le temps de l'onglet** (`sessionStorage`), pour qu'un rôle
 * créé ou modifié survive à un rechargement de page sans s'installer pour
 * autant sur la machine.
 */

import { attendre, refuser } from "@/lib/api/simulation";
import type {
  CreationRolePayload,
  ModificationRolePayload,
  ResultatSuppressionRole,
  SuppressionRolePayload,
} from "./api";
import type { NiveauAcces, ProjetRoleMatrice, RoleDetailItem, RoleItem } from "./types";
import { MODULES_CCD } from "./types";

const CLE_ETAT = "ccd.simulation.roles";
const CLE_ETAT_PROJETS = "ccd.simulation.roles_projets";

const LATENCE_LECTURE = 400;
const LATENCE_ECRITURE = 600;

function toutesPermissions(niveau: NiveauAcces): Record<string, NiveauAcces> {
  const permissions: Record<string, NiveauAcces> = {};
  for (const code of MODULES_CCD) permissions[code] = niveau;
  return permissions;
}

/**
 * Cinq rôles choisis pour couvrir les cas que l'écran doit montrer : un rôle
 * système inamovible (DG), et quatre rôles personnalisés aux permissions
 * contrastées d'un module à l'autre.
 */
const ROLES_INITIAUX: RoleItem[] = [
  {
    id: "10b1a001-1111-4a11-8a11-000000000001",
    code: "DG",
    libelle: "Directeur Général",
    description: "Accès complet à l'ensemble des modules de l'entreprise.",
    est_systeme: true,
    est_actif: true,
    nb_utilisateurs: 1,
    permissions_modules: toutesPermissions(3),
  },
  {
    id: "10b1a002-2222-4a22-8a22-000000000002",
    code: "CHEF_PROJET",
    libelle: "Chef de projet",
    description: "Pilotage des chantiers, du suivi d'avancement au reporting.",
    est_systeme: false,
    est_actif: true,
    nb_utilisateurs: 3,
    permissions_modules: {
      projets: 3,
      chantier: 3,
      finance: 2,
      achats: 2,
      stocks: 1,
      rh: 1,
      equipements: 2,
      qhse: 2,
      contrats: 1,
      tiers: 1,
      ged: 2,
      pilotage: 1,
    },
  },
  {
    id: "10b1a003-3333-4a33-8a33-000000000003",
    code: "CONDUCTEUR_TRAVAUX",
    libelle: "Conducteur de travaux",
    description: "Suivi terrain quotidien : rapports, pointages, sécurité.",
    est_systeme: false,
    est_actif: true,
    nb_utilisateurs: 4,
    permissions_modules: {
      projets: 1,
      chantier: 3,
      finance: 0,
      achats: 1,
      stocks: 2,
      rh: 2,
      equipements: 2,
      qhse: 3,
      contrats: 0,
      tiers: 1,
      ged: 1,
      pilotage: 0,
    },
  },
  {
    id: "10b1a004-4444-4a44-8a44-000000000004",
    code: "COMPTABLE",
    libelle: "Comptable",
    description: "Bons de paiement, situations et suivi budgétaire.",
    est_systeme: false,
    est_actif: true,
    nb_utilisateurs: 1,
    permissions_modules: {
      projets: 1,
      chantier: 0,
      finance: 3,
      achats: 2,
      stocks: 0,
      rh: 1,
      equipements: 0,
      qhse: 0,
      contrats: 1,
      tiers: 1,
      ged: 1,
      pilotage: 1,
    },
  },
  {
    id: "10b1a005-5555-4a55-8a55-000000000005",
    code: "MAGASINIER",
    libelle: "Magasinier de chantier",
    description: "Entrées, sorties et inventaires du dépôt.",
    est_systeme: false,
    est_actif: true,
    nb_utilisateurs: 2,
    permissions_modules: {
      projets: 0,
      chantier: 1,
      finance: 0,
      achats: 2,
      stocks: 3,
      rh: 0,
      equipements: 1,
      qhse: 1,
      contrats: 0,
      tiers: 0,
      ged: 0,
      pilotage: 0,
    },
  },
];

function identifiant(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sim-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function lireEtat(): RoleItem[] {
  if (typeof window === "undefined") return [...ROLES_INITIAUX];
  try {
    const brut = window.sessionStorage.getItem(CLE_ETAT);
    return brut ? (JSON.parse(brut) as RoleItem[]) : [...ROLES_INITIAUX];
  } catch {
    return [...ROLES_INITIAUX];
  }
}

function ecrireEtat(roles: RoleItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_ETAT, JSON.stringify(roles));
  } catch {
    // Navigation privée saturée : la simulation perd sa mémoire, sans plus.
  }
}

/** Les surcharges par chantier : `{ [projetId]: { [roleId]: { [module]: niveau } } }`. */
type SurchargesProjets = Record<string, Record<string, Partial<Record<string, NiveauAcces>>>>;

function lireSurcharges(): SurchargesProjets {
  if (typeof window === "undefined") return {};
  try {
    const brut = window.sessionStorage.getItem(CLE_ETAT_PROJETS);
    return brut ? (JSON.parse(brut) as SurchargesProjets) : {};
  } catch {
    return {};
  }
}

function ecrireSurcharges(surcharges: SurchargesProjets): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_ETAT_PROJETS, JSON.stringify(surcharges));
  } catch {
    // Sans effet.
  }
}

function versDetail(role: RoleItem): RoleDetailItem {
  return {
    ...role,
    comptage: {
      utilisateurs: role.nb_utilisateurs,
      affectations: 0,
      total: role.nb_utilisateurs,
    },
  };
}

export const simulationRoles = {
  async lister(): Promise<RoleItem[]> {
    return attendre(lireEtat(), LATENCE_LECTURE);
  },

  async obtenir(roleId: string): Promise<RoleDetailItem> {
    const role = lireEtat().find((candidat) => candidat.id === roleId);
    if (!role) refuser("introuvable", "Ce rôle n'existe pas ou a été supprimé.", 404);
    return attendre(versDetail(role), LATENCE_LECTURE);
  },

  async creer(payload: CreationRolePayload): Promise<RoleDetailItem> {
    const roles = lireEtat();
    const permissions: Record<string, NiveauAcces> = { ...toutesPermissions(0), ...payload.permissions_modules };

    const role: RoleItem = {
      id: identifiant(),
      code: payload.code,
      libelle: payload.libelle,
      description: payload.description ?? "",
      est_systeme: false,
      est_actif: true,
      nb_utilisateurs: 0,
      permissions_modules: permissions,
    };

    ecrireEtat([...roles, role]);
    return attendre(versDetail(role), LATENCE_ECRITURE);
  },

  async modifier(roleId: string, payload: ModificationRolePayload): Promise<RoleDetailItem> {
    const roles = lireEtat();
    const index = roles.findIndex((candidat) => candidat.id === roleId);
    if (index === -1) refuser("introuvable", "Ce rôle n'existe pas ou a été supprimé.", 404);

    const role = roles[index];
    const roleMaj: RoleItem = {
      ...role,
      libelle: payload.libelle ?? role.libelle,
      description: payload.description ?? role.description,
      permissions_modules: payload.permissions_modules
        ? { ...role.permissions_modules, ...payload.permissions_modules }
        : role.permissions_modules,
    };

    roles[index] = roleMaj;
    ecrireEtat(roles);
    return attendre(versDetail(roleMaj), LATENCE_ECRITURE);
  },

  async supprimer(
    roleId: string,
    payload: SuppressionRolePayload,
  ): Promise<ResultatSuppressionRole> {
    const roles = lireEtat();
    const role = roles.find((candidat) => candidat.id === roleId);
    if (!role) refuser("introuvable", "Ce rôle n'existe pas ou a été supprimé.", 404);
    if (role.est_systeme) {
      refuser("role_systeme", "Un rôle système ne peut pas être supprimé.", 409);
    }

    const cible = roles.find((candidat) => candidat.id === payload.role_substitution_id);
    if (!cible) {
      refuser("introuvable", "Le rôle de remplacement n'existe pas.", 404);
    }

    ecrireEtat(roles.filter((candidat) => candidat.id !== roleId));

    return attendre(
      {
        message: "Rôle supprimé.",
        role_supprime: role.id,
        utilisateurs_reassignes: role.nb_utilisateurs,
        affectations_reassignees: 0,
      },
      LATENCE_ECRITURE,
    );
  },

  async obtenirMatriceProjet(projetId: string): Promise<ProjetRoleMatrice[]> {
    const roles = lireEtat();
    const surcharges = lireSurcharges()[projetId] ?? {};

    const matrice: ProjetRoleMatrice[] = roles.map((role) => {
      const modules: ProjetRoleMatrice["modules"] = {};
      for (const code of MODULES_CCD) {
        const surcharge = surcharges[role.id]?.[code];
        modules[code] = {
          niveau: surcharge ?? role.permissions_modules[code] ?? 0,
          est_surcharge: surcharge !== undefined,
        };
      }
      return {
        role_id: role.id,
        code: role.code,
        libelle: role.libelle,
        est_systeme: role.est_systeme,
        modules,
      };
    });

    return attendre(matrice, LATENCE_LECTURE);
  },

  async sauvegarderMatriceProjet(
    projetId: string,
    surchargesEnvoyees: { role_id: string; module: string; niveau: NiveauAcces | null }[],
  ): Promise<ProjetRoleMatrice[]> {
    const surcharges = lireSurcharges();
    const surchargesProjet = { ...(surcharges[projetId] ?? {}) };

    for (const { role_id, module: code, niveau } of surchargesEnvoyees) {
      const surchargesRole = { ...(surchargesProjet[role_id] ?? {}) };
      if (niveau === null) {
        delete surchargesRole[code];
      } else {
        surchargesRole[code] = niveau;
      }
      surchargesProjet[role_id] = surchargesRole;
    }

    surcharges[projetId] = surchargesProjet;
    ecrireSurcharges(surcharges);

    return this.obtenirMatriceProjet(projetId);
  },
};

/* eslint-disable no-restricted-syntax --
 * Outil de développement, jamais livré : mêmes libellés en dur que `Incarnation.tsx`.
 */

import type { PorteeProjets } from "@/features/habilitations/types";
import type { FonctionProjet, Projet } from "@/features/projets/types";
import { listerRoles } from "@/features/roles/api";
import { permissionsNormalisees } from "@/features/roles/regles";
import type { NiveauAcces, RoleItem } from "@/features/roles/types";
import { MODULES_CCD } from "@/features/roles/types";

/**
 * Les rôles proposés par « Voir en tant que… » — OUTIL DE DÉVELOPPEMENT.
 *
 * `GET /parametres/roles/` revient vide tant que le backend n'a pas semé les
 * rôles de l'entreprise : l'outil n'avait alors rien à incarner. Ces cinq
 * rôles comblent le trou **dans l'outil seulement** — l'écran
 * `/parametres/roles` n'en voit aucun (clé de cache distincte), et un rôle du
 * serveur portant le même code l'emporte toujours sur sa version en dur.
 *
 * Les niveaux (0 aucun → 3 validation) sont une hypothèse de travail, à
 * aligner sur le paramétrage réel dès qu'il existe.
 */

export const CLE_ROLES_INCARNABLES = ["test", "incarnation", "roles"] as const;

function partout(niveau: NiveauAcces): Record<string, NiveauAcces> {
  return Object.fromEntries(MODULES_CCD.map((code) => [code, niveau]));
}

function roleTest(
  code: string,
  libelle: string,
  permissions: Record<string, NiveauAcces>,
): RoleItem {
  return {
    id: `test-${code}`,
    code,
    libelle,
    description: "",
    est_systeme: false,
    est_actif: true,
    nb_utilisateurs: 0,
    permissions_modules: permissionsNormalisees(permissions),
  };
}

const ROLES_EN_DUR: RoleItem[] = [
  // Incarné, le DG garde tous les accès mais n'est plus « la direction » :
  // Paramètres et Abonnement lui restent fermés, comme à tout rôle.
  roleTest("DG", "Directeur général", partout(3)),
  roleTest("ADMINISTRATEUR", "Administrateur", partout(3)),
  roleTest("CHEF_PROJET", "Chef de projet", {
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
  }),
  roleTest("CHEF_CHANTIER", "Chef de chantier", {
    projets: 1,
    chantier: 2,
    achats: 1,
    stocks: 2,
    rh: 1,
    equipements: 1,
    qhse: 2,
    ged: 1,
  }),
  roleTest("CONDUCTEUR_TRAVAUX", "Conducteur des travaux", {
    projets: 1,
    chantier: 3,
    achats: 1,
    stocks: 2,
    rh: 2,
    equipements: 2,
    qhse: 3,
    tiers: 1,
    ged: 1,
  }),
];

/**
 * Les rôles du serveur, complétés des rôles en dur dont le code manque. Un
 * serveur injoignable n'empêche pas de tester l'interface : il reste la liste
 * en dur.
 */
export async function listerRolesIncarnables(): Promise<RoleItem[]> {
  const serveur = await listerRoles().catch(() => [] as RoleItem[]);
  const codes = new Set(serveur.map((r) => r.code));
  return [...serveur, ...ROLES_EN_DUR.filter((r) => !codes.has(r.code))];
}

/**
 * La personne de test : personne n'est encore affecté à un chantier tant que
 * l'encadrement n'est pas livré côté serveur, et une personne sans chantier
 * ne voit rien. Elle reçoit les deux premiers chantiers de l'entreprise, dans
 * la fonction que son rôle suggère.
 */
export const PERSONNE_TEST = { id: "test-personne", nom: "Personne de test" } as const;

const NOMBRE_CHANTIERS_SIMULES = 2;

export function chantiersSimules(projets: Projet[]): Projet[] {
  return projets.slice(0, NOMBRE_CHANTIERS_SIMULES);
}

/** La fonction tenue sur les chantiers simulés — « autre membre » pour un rôle sans équivalent. */
function fonctionDuRole(role: RoleItem): FonctionProjet {
  switch (role.code) {
    case "CHEF_PROJET":
    case "CONDUCTEUR_TRAVAUX":
    case "CHEF_CHANTIER":
      return role.code;
    default:
      return "AUTRE_MEMBRE";
  }
}

export function porteeSimulee(role: RoleItem, chantiers: string[]): PorteeProjets {
  const fonction = fonctionDuRole(role);
  return {
    type: "PERSONNE",
    collaborateurId: PERSONNE_TEST.id,
    fonctionsSimulees: Object.fromEntries(chantiers.map((id) => [id, [fonction]])),
  };
}

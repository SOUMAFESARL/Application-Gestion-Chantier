/* eslint-disable no-restricted-syntax --
 * Outil de développement, jamais livré : mêmes libellés en dur que `Incarnation.tsx`.
 */

import type { PorteeProjets } from "@/features/habilitations/types";
import type { FonctionProjet, Projet } from "@/features/projets/types";
import { listerRoles } from "@/features/roles/api";
import type { ModuleRole, RoleItem } from "@/features/roles/types";

/**
 * Les rôles proposés par « Voir en tant que… » — OUTIL DE DÉVELOPPEMENT.
 *
 * `GET /parametres/roles/` revient vide tant que le backend n'a pas semé les
 * rôles de l'entreprise : l'outil n'avait alors rien à incarner. Ces rôles
 * comblent le trou **dans l'outil seulement** — l'écran `/parametres/roles`
 * n'en voit aucun (clé de cache distincte), et un rôle du serveur portant le
 * même code l'emporte toujours sur sa version en dur.
 *
 * Chaque rôle est une liste de codes de permission. Ceux des modules que le
 * serveur n'a pas encore (`stocks.valider`, `achats.ecrire`…) sont une
 * hypothèse de travail, à aligner sur le catalogue réel dès qu'il existe.
 */

export const CLE_ROLES_INCARNABLES = ["test", "incarnation", "roles"] as const;

/** Lire, écrire et valider sur chacun de ces modules. */
function toutSur(...modules: string[]): string[] {
  return modules.flatMap((m) => [`${m}.lire`, `${m}.ecrire`, `${m}.valider`]);
}

const TOUS_LES_MODULES = [
  "projets", "chantier", "finance", "achats", "stocks", "rh",
  "equipements", "qhse", "contrats", "tiers", "ged", "pilotage",
];

/** Un rôle de test : ses codes, rangés par module (le préfixe du code). */
function roleTest(code: string, libelle: string, codes: string[]): RoleItem {
  const parModule = new Map<string, string[]>();
  for (const c of codes) {
    const prefixe = c.split(".")[0];
    parModule.set(prefixe, [...(parModule.get(prefixe) ?? []), c]);
  }
  const modules: ModuleRole[] = [...parModule.entries()].map(([modCode, codesModule], idx) => ({
    moduleId: `mod-${modCode}`,
    code: modCode,
    libelle: modCode.charAt(0).toUpperCase() + modCode.slice(1),
    description: "",
    icone: "",
    ordre: idx + 1,
    permissions: codesModule.map((c, i) => ({
      id: `perm-${c}`,
      code: c,
      libelle: c,
      description: "",
      ordre: i + 1,
    })),
  }));

  return {
    id: `test-${code}`,
    code,
    libelle,
    description: "",
    est_systeme: false,
    est_actif: true,
    nb_utilisateurs: 0,
    portee: "PROJET",
    avertissements: [],
    modules,
  };
}

const ROLES_EN_DUR: RoleItem[] = [
  // Incarné, le DG garde tous les droits mais n'est plus « la direction » :
  // Paramètres et Abonnement lui restent fermés, comme à tout rôle.
  roleTest("DG", "Directeur général", toutSur(...TOUS_LES_MODULES)),
  roleTest("ADMINISTRATEUR", "Administrateur", toutSur(...TOUS_LES_MODULES)),
  /*
   * Le stock (F9 v1.2, matrice §3.2) : `achats` porte la DA (écrire) et le BC
   * (valider) ; `stocks`, le terrain (écrire) et sa validation — indépendants :
   * le chef de projet valide le stock sans le saisir. Voir docs/PLAN_F9_STOCK.md §3.
   */
  roleTest("DIRECTEUR_OPERATIONS", "Directeur des opérations", [
    "projets.lire", "chantier.lire", "finance.lire",
    // Reçoit les DA, émet les BC (standard ou commande directe).
    "achats.lire", "achats.valider",
    "stocks.lire", "tiers.lire", "ged.lire", "pilotage.lire",
  ]),
  roleTest("CHEF_PROJET", "Chef de projet", [
    "projets.lire", "projets.ecrire", "projets.changer_statut",
    "chantier.lire", "chantier.rediger", "chantier.valider",
    "finance.lire", "finance.ecrire",
    // Émet et modifie ses DA, clôture un BC partiel.
    "achats.lire", "achats.ecrire",
    // Valide les BRV équipements (2ᵉ niveau), les inventaires, les transferts inter-chantiers.
    "stocks.lire", "stocks.valider",
    "rh.lire", "equipements.lire", "equipements.ecrire", "qhse.lire", "qhse.ecrire",
    "contrats.lire", "tiers.lire", "ged.lire", "ged.ecrire", "pilotage.lire",
  ]),
  roleTest("CONDUCTEUR_TRAVAUX", "Conducteur des travaux", [
    "projets.lire",
    "chantier.lire", "chantier.rediger", "chantier.valider",
    // Lit les BC ; ne voit pas les DA.
    "achats.lire",
    // Valide les BRV (1ᵉʳ niveau), dépose le BL, mouvements manuels, transferts inter-lots.
    "stocks.lire", "stocks.ecrire", "stocks.valider",
    "rh.lire", "rh.ecrire", "equipements.lire", "equipements.ecrire",
    "qhse.lire", "qhse.ecrire", "qhse.valider", "tiers.lire", "ged.lire",
  ]),
  roleTest("MAGASINIER", "Magasinier", [
    "projets.lire", "chantier.lire",
    // Émet ses DA, clôture un BC partiel.
    "achats.lire", "achats.ecrire",
    // Réceptionne, photographie le BL, mouvements manuels, inventaires.
    "stocks.lire", "stocks.ecrire",
    "equipements.lire", "ged.lire",
  ]),
  roleTest("CHEF_CHANTIER", "Chef de chantier", [
    "projets.lire", "chantier.lire", "chantier.rediger",
    // Consulte le stock : il le consomme par son rapport (F2), sans le gérer.
    "stocks.lire",
    "rh.lire", "equipements.lire", "qhse.lire", "qhse.ecrire", "ged.lire",
  ]),
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

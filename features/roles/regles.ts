/**
 * Règles pures du domaine Rôles — zéro React.
 */

import { ErreurApi } from "@/lib/api";
import { ACCES_MODULE, MODULES_CCD } from "./types";
import type {
  AccesModule,
  ModuleCatalogue,
  NiveauAcces,
  PermissionsModules,
  Raccourci,
  RoleItem,
} from "./types";

/**
 * Les accès équivalents à un niveau cumulatif de l'ancien format : le niveau
 * 2 (Saisie) comprend la lecture, le niveau 3 comprend tout.
 */
export function accesDepuisNiveau(niveau: NiveauAcces): AccesModule[] {
  return ACCES_MODULE.slice(0, niveau);
}

/**
 * Les accès d'un module, quel que soit le format reçu : un niveau (format
 * actuel du serveur) ou une liste (format cible). Toute autre valeur vaut
 * « Aucun » — un droit illisible ne s'accorde pas par défaut.
 */
export function accesNormalises(valeur: unknown): AccesModule[] {
  if (typeof valeur === "number") {
    return valeur >= 0 && valeur <= 3 ? accesDepuisNiveau(valeur as NiveauAcces) : [];
  }
  if (Array.isArray(valeur)) {
    return ACCES_MODULE.filter((acces) => valeur.includes(acces));
  }
  return [];
}

/** Les douze modules, chacun avec ses accès normalisés. */
export function permissionsNormalisees(brutes: Record<string, unknown> | null | undefined): PermissionsModules {
  const permissions: PermissionsModules = {};
  for (const code of MODULES_CCD) {
    permissions[code] = accesNormalises(brutes?.[code]);
  }
  return permissions;
}

/**
 * Coche ou décoche un accès. « Aucun » exclut tout le reste : le cocher vide
 * la liste, cocher un autre accès le décoche. Décocher « Aucun » seul ne fait
 * rien — il resterait un module sans accès et sans « Aucun » coché.
 *
 * L'ordre de `ACCES_MODULE` est conservé, pour une charge utile stable.
 */
export function basculerAcces(
  acces: AccesModule[],
  cible: AccesModule | "aucun",
  coche: boolean,
): AccesModule[] {
  if (cible === "aucun") return coche ? [] : acces;
  const suivants = coche ? [...acces, cible] : acces.filter((a) => a !== cible);
  return ACCES_MODULE.filter((a) => suivants.includes(a));
}

/**
 * Le rang de l'accès le plus élevé (0 à 3). Ne décide d'aucun droit : il ne
 * sert qu'à choisir le ton d'affichage d'une cellule.
 */
export function rangAccesMax(acces: AccesModule[]): 0 | 1 | 2 | 3 {
  return ACCES_MODULE.reduce<0 | 1 | 2 | 3>(
    (rang, a, i) => (acces.includes(a) ? ((i + 1) as 1 | 2 | 3) : rang),
    0,
  );
}

/** Les codes accordés au rôle, tous modules confondus, triés, sans doublon. */
export function codesDuRole(role: RoleItem): string[] {
  const codes = new Set<string>();
  for (const mod of role.modules ?? []) {
    for (const perm of mod.permissions ?? []) {
      if (perm.code) codes.add(perm.code.toLowerCase());
    }
  }
  return Array.from(codes).sort();
}

/**
 * Un code « de base » : celui qu'un raccourci coche. La correspondance du serveur
 * (`_normaliser_permissions_modules`) :
 *   lecture ← `.lire` ; saisie ← `.ecrire`, `.rediger` ; validation ← `.valider`, `projets.changer_statut`.
 */
export function accesDuCode(code: string): AccesModule | null {
  const c = code.toLowerCase();
  if (c.endsWith(".lire")) return "lecture";
  if (c.endsWith(".ecrire") || c.endsWith(".rediger")) return "saisie";
  if (c.endsWith(".valider") || c === "projets.changer_statut") return "validation";
  return null;
}

/**
 * Les codes de base qu'un raccourci coche sur ce module — cumulatif, comme les anciens niveaux :
 * « saisie » = lecture + saisie ; « validation » = les trois ; « aucun » = rien.
 * Seuls les codes **présents dans le catalogue du module** sont rendus.
 */
export function codesDuRaccourci(module: ModuleCatalogue, raccourci: Raccourci): string[] {
  if (raccourci === "aucun") return [];

  const accesAutorises: AccesModule[] =
    raccourci === "lecture"
      ? ["lecture"]
      : raccourci === "saisie"
        ? ["lecture", "saisie"]
        : ["lecture", "saisie", "validation"];

  const codes: string[] = [];
  for (const perm of module.permissions) {
    const acc = accesDuCode(perm.code);
    if (acc && accesAutorises.includes(acc)) {
      codes.push(perm.code.toLowerCase());
    }
  }
  return codes.sort();
}

/**
 * Applique un raccourci aux codes du rôle :
 * - « aucun » retire tous les codes du module (de base et fins) ;
 * - les autres remplacent les codes de base du module par ceux du raccourci et laissent les
 *   codes fins (`projets.creer`, `projets.voir_montants`…) tels qu'ils sont.
 * Renvoie une liste triée, sans doublon.
 */
export function appliquerRaccourci(
  codes: string[],
  module: ModuleCatalogue,
  raccourci: Raccourci,
): string[] {
  const codesModuleCatalogue = new Set(module.permissions.map((p) => p.code.toLowerCase()));
  const ensemble = new Set(codes.map((c) => c.toLowerCase()));

  if (raccourci === "aucun") {
    // Retire TOUS les codes du module
    for (const c of codesModuleCatalogue) {
      ensemble.delete(c);
    }
    return Array.from(ensemble).sort();
  }

  // Remplacer les codes de base du module par ceux du raccourci
  for (const p of module.permissions) {
    const c = p.code.toLowerCase();
    const acc = accesDuCode(c);
    if (acc !== null) {
      // C'est un code de base, on le retire d'abord
      ensemble.delete(c);
    }
  }

  // Ajouter ceux du raccourci
  const nouveauxDeBase = codesDuRaccourci(module, raccourci);
  for (const c of nouveauxDeBase) {
    ensemble.add(c);
  }

  return Array.from(ensemble).sort();
}

/** Le raccourci que les codes du module réalisent exactement, ou `null` (une combinaison libre). */
export function raccourciCourant(codes: string[], module: ModuleCatalogue): Raccourci | null {
  const codesDuModuleActifs = new Set(
    codes
      .map((c) => c.toLowerCase())
      .filter((c) => module.permissions.some((p) => p.code.toLowerCase() === c)),
  );

  // Si aucun code du module n'est actif
  if (codesDuModuleActifs.size === 0) {
    return "aucun";
  }

  // Tester chacun des autres raccourcis
  for (const r of ["validation", "saisie", "lecture"] as const) {
    const attendus = codesDuRaccourci(module, r);
    if (
      attendus.length === codesDuModuleActifs.size &&
      attendus.every((c) => codesDuModuleActifs.has(c))
    ) {
      return r;
    }
  }

  return null;
}

/** Coche ou décoche une permission. Triée, sans doublon. */
export function basculerCode(codes: string[], code: string, coche: boolean): string[] {
  const c = code.toLowerCase();
  const ensemble = new Set(codes.map((x) => x.toLowerCase()));
  if (coche) {
    ensemble.add(c);
  } else {
    ensemble.delete(c);
  }
  return Array.from(ensemble).sort();
}

/** Les codes du rôle absents du catalogue (D1 : un AD devant un rôle qui dépasse son périmètre). */
export function codesHorsCatalogue(codes: string[], catalogue: ModuleCatalogue[]): string[] {
  const codesCatalogue = new Set<string>();
  for (const mod of catalogue) {
    for (const p of mod.permissions) {
      codesCatalogue.add(p.code.toLowerCase());
    }
  }
  return codes
    .map((c) => c.toLowerCase())
    .filter((c) => !codesCatalogue.has(c))
    .sort();
}

/**
 * Ce que ce compte peut faire de ce rôle — les règles du serveur (`apps/accounts/views/role.py`) :
 * - rôle `DG` : rien, pour personne (`modification_dg_interdite`) ;
 * - rôle système (`est_systeme`) : le DG seul (`modification_role_systeme_interdite`) ;
 * - matrice : pas si le compte n'est pas DG et que le rôle porte un code hors de son catalogue (D1) ;
 * - suppression : jamais un rôle système, jamais le DG.
 * `raison` est la clé du message qui explique une lecture seule (sous `roles.lectureSeule.*`).
 */
export function gestesSurRole(
  role: RoleItem | null | undefined,
  compte: { estDirection: boolean },
  catalogue: ModuleCatalogue[],
): {
  modifiable: boolean; // intitulé, description
  matriceModifiable: boolean;
  supprimable: boolean;
  raison: "roleDg" | "roleSysteme" | "horsPerimetre" | null;
} {
  if (!role) {
    return { modifiable: false, matriceModifiable: false, supprimable: false, raison: null };
  }

  const isDgRole = role.code.toUpperCase() === "DG";
  if (isDgRole) {
    return {
      modifiable: false,
      matriceModifiable: false,
      supprimable: false,
      raison: "roleDg",
    };
  }

  if (role.est_systeme && !compte.estDirection) {
    return {
      modifiable: false,
      matriceModifiable: false,
      supprimable: false,
      raison: "roleSysteme",
    };
  }

  const codes = codesDuRole(role);
  const hors = !compte.estDirection && codesHorsCatalogue(codes, catalogue).length > 0;

  return {
    modifiable: true,
    matriceModifiable: !hors,
    supprimable: !role.est_systeme,
    raison: hors ? "horsPerimetre" : null,
  };
}

export interface ColonneMatrice {
  code: string;
  libelle: string;
  description: string;
  ordre: number;
}

/**
 * Union des colonnes de modules du catalogue et des rôles existants.
 */
export function colonnesDeMatrice(
  roles: RoleItem[],
  catalogue: ModuleCatalogue[],
): ColonneMatrice[] {
  const carte = new Map<string, ColonneMatrice>();

  for (const mod of catalogue) {
    const code = mod.code.toLowerCase();
    carte.set(code, {
      code,
      libelle: mod.libelle,
      description: mod.description,
      ordre: mod.ordre,
    });
  }

  for (const role of roles) {
    for (const mod of role.modules ?? []) {
      const code = mod.code.toLowerCase();
      if (!carte.has(code)) {
        carte.set(code, {
          code,
          libelle: mod.libelle,
          description: mod.description,
          ordre: mod.ordre,
        });
      }
    }
  }

  return Array.from(carte.values()).sort(
    (a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code),
  );
}

/**
 * Le nombre de personnes touchées si l'erreur est la demande de confirmation d'un changement de
 * portée ; `null` pour toute autre erreur. Le serveur l'envoie en nombre, `ErreurApi.details` le
 * type en chaîne : `Number(...)`.
 */
export function personnesTouchees(erreur: unknown): number | null {
  if (!(erreur instanceof ErreurApi)) return null;
  if (erreur.code !== "confirmation_requise") return null;

  const brute = (erreur.details as Record<string, unknown> | undefined)?.personnes_touchees;
  if (brute === undefined || brute === null) return 0;
  const n = Number(Array.isArray(brute) ? brute[0] : brute);
  return Number.isNaN(n) ? 0 : n;
}

/** Changer la portée de ce rôle : la direction seule, jamais le rôle DG. */
export function peutChangerPortee(
  role: RoleItem | null | undefined,
  compte: { estDirection: boolean },
): boolean {
  if (!role) return false;
  if (role.code.toUpperCase() === "DG") return false;
  return compte.estDirection;
}


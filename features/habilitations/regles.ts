/**
 * Les règles des habilitations — pures, sans React.
 *
 * **Ce n'est pas une barrière de sécurité.** Masquer un bouton ne protège
 * rien : c'est Django (`PermissionModule`) qui refuse. Ces règles évitent
 * seulement de proposer un geste que le serveur refuserait.
 */

import { fonctionsDansProjet, projetModifiable } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import { ACCES_MODULE, MODULES_CCD } from "@/features/roles/types";

import type { AccesModule, CodeModule, ConditionAcces, Droits } from "./types";

/** Tous les accès sur tous les modules, tous les chantiers : le DG. */
export function droitsDirection(): Droits {
  const permissions: Record<string, AccesModule[]> = {};
  for (const code of MODULES_CCD) permissions[code] = [...ACCES_MODULE];
  return { estDirection: true, permissions, portee: { type: "TOUS" } };
}

/**
 * Le compte a-t-il cet accès sur ce module ? La direction a tout. Un module
 * que la matrice ne cite pas n'accorde rien : un droit ne se devine pas.
 */
export function peut(droits: Droits | null, module: CodeModule, acces: AccesModule = "lecture"): boolean {
  if (!droits) return false;
  if (droits.estDirection) return true;
  return droits.permissions[module]?.includes(acces) ?? false;
}

export function satisfait(droits: Droits | null, condition: ConditionAcces): boolean {
  switch (condition.type) {
    case "TOUS":
      return droits !== null;
    case "DIRECTION":
      return droits?.estDirection ?? false;
    case "MODULE":
      return peut(droits, condition.module, condition.acces);
  }
}

const TOUS: ConditionAcces = { type: "TOUS" };
const DIRECTION: ConditionAcces = { type: "DIRECTION" };
function lecture(module: CodeModule): ConditionAcces {
  return { type: "MODULE", module, acces: "lecture" };
}

/**
 * Le module dont relève chaque écran de l'espace entreprise, par préfixe
 * d'URL. Le préfixe le plus long l'emporte. Une route absente de la table
 * n'est ouverte qu'à la direction : un écran nouveau reste fermé tant qu'on
 * n'a pas dit à quel module il appartient.
 */
export const CONDITIONS_ROUTES: readonly (readonly [string, ConditionAcces])[] = [
  ["/tableau-de-bord", TOUS],
  ["/notifications", TOUS],
  ["/profil", TOUS],
  ["/projets", lecture("projets")],
  ["/planning", lecture("projets")],
  ["/rapports", lecture("chantier")],
  ["/finance", lecture("finance")],
  ["/achats", lecture("achats")],
  ["/stocks", lecture("stocks")],
  ["/rh", lecture("rh")],
  ["/equipements", lecture("equipements")],
  ["/qhse", lecture("qhse")],
  ["/contrats", lecture("contrats")],
  ["/tiers", lecture("tiers")],
  ["/documents", lecture("ged")],
  ["/parametres", DIRECTION],
  ["/abonnement", DIRECTION],
];

function correspond(chemin: string, prefixe: string): boolean {
  return chemin === prefixe || chemin.startsWith(`${prefixe}/`);
}

export function conditionDeRoute(chemin: string): ConditionAcces {
  let retenue: readonly [string, ConditionAcces] | null = null;
  for (const entree of CONDITIONS_ROUTES) {
    if (correspond(chemin, entree[0]) && (!retenue || entree[0].length > retenue[0].length)) {
      retenue = entree;
    }
  }
  return retenue ? retenue[1] : DIRECTION;
}

export function routeAutorisee(droits: Droits | null, chemin: string): boolean {
  return satisfait(droits, conditionDeRoute(chemin));
}

/**
 * Les chantiers que le compte voit. Hors direction, ce sont **ses** chantiers
 * (décision du 30/09/2026) : ceux où il est désigné dans l'équipe projet.
 */
export function projetsVisibles(projets: Projet[], droits: Droits | null): Projet[] {
  if (!droits) return [];
  if (droits.portee.type === "TOUS") return projets;
  const { collaborateurId } = droits.portee;
  return projets.filter((projet) => fonctionsDansProjet(projet, collaborateurId).length > 0);
}

export function projetVisible(projet: Projet, droits: Droits | null): boolean {
  return projetsVisibles([projet], droits).length === 1;
}

/**
 * Le compte est-il le chef de projet désigné de ce chantier ? La direction
 * voit tout mais n'est la personne de personne : sa portée ne porte pas
 * d'identifiant.
 */
export function estChefDuProjet(projet: Projet, droits: Droits | null): boolean {
  if (!droits || droits.portee.type !== "PERSONNE") return false;
  return projet.chefProjet !== null && projet.chefProjet.id === droits.portee.collaborateurId;
}

/** Désigner (ou remplacer) le chef de projet : un acte de direction. */
export function peutDesignerChefProjet(projet: Projet, droits: Droits | null): boolean {
  return projetModifiable(projet) && (droits?.estDirection ?? false);
}

/**
 * Compléter l'équipe d'encadrement — conducteurs, chefs de chantier, autres
 * membres : la direction, ou le chef de projet du chantier, qui en a la main.
 */
export function peutGererEncadrement(projet: Projet, droits: Droits | null): boolean {
  return projetModifiable(projet) && ((droits?.estDirection ?? false) || estChefDuProjet(projet, droits));
}

/**
 * Fixer le planning contractuel et le budget prévisionnel : le chef de
 * projet du chantier, et lui seul. Ils ne se saisissent plus à la création.
 */
export function peutCadrerProjet(projet: Projet, droits: Droits | null): boolean {
  return projetModifiable(projet) && estChefDuProjet(projet, droits);
}

/**
 * Les règles des habilitations — pures, sans React.
 *
 * **Ce n'est pas une barrière de sécurité.** Masquer un bouton ne protège
 * rien : c'est Django (`PermissionModule`) qui refuse. Ces règles évitent
 * seulement de proposer un geste que le serveur refuserait.
 */

import { fonctionsDansProjet, projetModifiable } from "@/features/projets/regles";
import type { FonctionProjet, Projet } from "@/features/projets/types";

import type { ConditionAcces, Droits } from "./types";

/**
 * Tous les droits, tous les chantiers : le DG. `codes` est la liste que le serveur lui accorde —
 * toutes les permissions des modules **ouverts** à l'entreprise, et celles-là seulement.
 */
export function droitsDirection(codes: readonly string[] = []): Droits {
  return { estDirection: true, codes, portee: { type: "TOUS" } };
}

/** Le module d'un code de permission : `projets` pour `projets.creer`. */
export function moduleDuCode(code: string): string {
  return code.toLowerCase().split(".")[0] ?? "";
}

/**
 * Le menu d'un module s'affiche-t-il ? **Dès une permission sur le module, et pas avant** —
 * pour tout le monde, direction comprise. La liste du profil ne porte que les permissions des
 * modules que le super admin laisse ouverts : un module désactivé disparaît donc aussi du DG.
 */
export function voitModule(droits: Droits | null, module: string): boolean {
  if (!droits) return false;
  const prefixe = `${module.toLowerCase()}.`;
  return droits.codes.some((code) => code.startsWith(prefixe));
}

/**
 * Le compte détient-il ce code ? Recopie `a_permission` (`apps/core/droits.py`) : la liste du
 * profil est déjà celle que le serveur applique. Un code absent n'accorde rien : un droit ne se
 * devine pas. La direction a tout, **dans les modules ouverts** à l'entreprise.
 */
export function peutCode(droits: Droits | null, code: string): boolean {
  if (!droits) return false;
  if (droits.estDirection) return voitModule(droits, moduleDuCode(code));
  return droits.codes.includes(code.toLowerCase());
}

/**
 * Ce geste sur ce chantier : le code, **et** une portée « entreprise » ou une fonction tenue sur
 * le chantier. Recopie `GardePermissionProjet` (`apps/core/permissions.py`, règle D-08).
 */
export function peutSurProjet(droits: Droits | null, code: string, projet: Projet): boolean {
  if (!droits) return false;
  if (droits.estDirection) return true;
  if (!peutCode(droits, code)) return false;
  if (droits.portee.type === "TOUS") return true;
  return fonctionsSurProjet(projet, droits).length > 0;
}

export function satisfait(droits: Droits | null, condition: ConditionAcces): boolean {
  switch (condition.type) {
    case "TOUS":
      return droits !== null;
    case "DIRECTION":
      return droits?.estDirection ?? false;
    case "PERMISSION":
      return peutCode(droits, condition.code);
    case "MODULE":
      return voitModule(droits, condition.module);
  }
}

const TOUS: ConditionAcces = { type: "TOUS" };
const DIRECTION: ConditionAcces = { type: "DIRECTION" };
function permission(code: string): ConditionAcces {
  return { type: "PERMISSION", code };
}
function module(code: string): ConditionAcces {
  return { type: "MODULE", module: code };
}

/**
 * Ce qu'exige chaque écran de l'espace entreprise, par préfixe d'URL. Le
 * préfixe le plus long l'emporte. Une route absente de la table n'est ouverte
 * qu'à la direction : un écran nouveau reste fermé tant qu'on n'a pas dit quel
 * droit l'ouvre.
 *
 * **L'écran d'un module s'ouvre dès une permission sur ce module** (`module`),
 * comme son entrée de menu : le tableau de bord appartient au module
 * `pilotage`, il disparaît pour qui n'y a aucune permission. Les modules que le
 * catalogue du serveur n'a pas encore (finance, achats, stocks…) ne portent
 * aucune permission : ils restent fermés à tous, direction comprise.
 */
export const CONDITIONS_ROUTES: readonly (readonly [string, ConditionAcces])[] = [
  ["/tableau-de-bord", module("pilotage")],
  ["/notifications", TOUS],
  ["/profil", TOUS],
  ["/projets", module("projets")],
  ["/planning", module("projets")],
  ["/rapports", module("chantier")],
  // Rédiger le rapport journalier : le chef de chantier (SFD F2 §3.2).
  ["/rapports/saisie", permission("chantier.rediger")],
  ["/finance", module("finance")],
  ["/achats", module("achats")],
  ["/stocks", module("stocks")],
  ["/rh", module("rh")],
  ["/equipements", module("equipements")],
  ["/qhse", module("qhse")],
  ["/contrats", module("contrats")],
  ["/tiers", module("tiers")],
  ["/documents", module("ged")],
  ["/parametres/collaborateurs", permission("administration.collaborateurs_voir")],
  ["/parametres/roles", permission("administration.roles_gerer")],
  ["/parametres/listes", permission("projets.creer")],
  // Tout le monde consulte le calendrier de l'entreprise ; l'écriture, elle, exige
  // `administration.calendrier_gerer` (erratum E-4) et se masque dans l'écran.
  ["/parametres/calendrier", TOUS],
  // Tout compte consulte l'en-tête et le pied des documents (chaque PDF les lit) ; l'écriture
  // exige `administration.documents_gerer` et se désactive dans l'écran.
  ["/parametres/documents", TOUS],
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

/** Les pages d'accueil possibles, dans l'ordre de préférence. Le profil est ouvert à tous. */
const ROUTES_ACCUEIL = ["/tableau-de-bord", "/projets", "/rapports", "/planning", "/documents", "/tiers", "/profil"];

/**
 * La page où l'on arrive : le tableau de bord, sinon le premier module ouvert au compte.
 * Sans permission sur le tableau de bord, il n'apparaît pas — on ne peut donc pas y envoyer
 * quelqu'un par défaut.
 */
export function routeAccueil(droits: Droits | null): string {
  return ROUTES_ACCUEIL.find((route) => routeAutorisee(droits, route)) ?? "/profil";
}

/**
 * Les chantiers que le compte voit. Hors direction, ce sont **ses** chantiers
 * (décision du 30/09/2026) : ceux où il est désigné dans l'équipe projet.
 */
export function projetsVisibles(projets: Projet[], droits: Droits | null): Projet[] {
  if (!droits) return [];
  if (droits.portee.type === "TOUS") return projets;
  const portee = droits.portee;
  return projets.filter((projet) => fonctionsDuCompte(projet, portee).length > 0);
}

/** Les fonctions du compte sur ce chantier : celles des données, plus les simulées. */
function fonctionsDuCompte(
  projet: Projet,
  portee: Extract<Droits["portee"], { type: "PERSONNE" }>,
): FonctionProjet[] {
  return [
    ...fonctionsDansProjet(projet, portee.collaborateurId),
    ...(portee.fonctionsSimulees?.[projet.id] ?? []),
  ];
}

/**
 * Ce que le compte tient sur ce chantier — chef de projet, conducteur… La
 * direction n'y tient aucune fonction : elle voit tout, sans y être nommée.
 */
export function fonctionsSurProjet(projet: Projet, droits: Droits | null): FonctionProjet[] {
  if (!droits || droits.portee.type !== "PERSONNE") return [];
  return fonctionsDuCompte(projet, droits.portee);
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
  return fonctionsSurProjet(projet, droits).includes("CHEF_PROJET");
}

/**
 * Rédiger le rapport journalier : `chantier.rediger` (`PeutRedigerRapports`).
 * La direction, qui a tous les droits, y entre aussi : le formulaire lui est
 * montré (demande du 05/10, pour que le backend voie l'écran de saisie).
 */
export function peutRedigerJournal(droits: Droits | null): boolean {
  return peutCode(droits, "chantier.rediger");
}

/** Relancer un chef de chantier en retard : `chantier.valider` (`JournalRelancerView`). */
export function peutRelancerJournal(droits: Droits | null): boolean {
  return peutCode(droits, "chantier.valider");
}

/**
 * Le journal vu de celui qui le tient — le chef de chantier. Le DG **consulte**
 * le journal sans le tenir (SFD F2 §3.1) : même s'il peut ouvrir le
 * formulaire, son onglet « Aujourd'hui » reste celui du suivi et de la relance.
 */
export function estRedacteurJournal(droits: Droits | null): boolean {
  return !(droits?.estDirection ?? false) && peutRedigerJournal(droits);
}

/**
 * L'étape du circuit que ce compte doit signer sur ce rapport, ou `null`.
 *
 * **Signe celui qui tient la fonction sur le chantier, et lui seul** —
 * décision du 14/10/2026, appliquée de la même façon par le serveur :
 *
 * - un rapport **soumis** attend le **conducteur de travaux** du chantier,
 *   qui tient `chantier.valider` ;
 * - un rapport **validé par le CT** attend le **chef de projet** du chantier.
 *
 * Le directeur général ne signe pas : il ne tient aucune fonction de
 * chantier, il consulte et relance. `collaborateurId` vient de
 * `personneQuiSigne`, qui le lui refuse.
 */
export function etapeASigner(
  situation: string,
  projet: Projet | undefined,
  droits: Droits | null,
  collaborateurId: string | null,
): "CT" | "CP" | null {
  const etape = situation === "SOUMIS" ? "CT" : situation === "VALIDE_CT" ? "CP" : null;
  return etape && tientEtape(etape, projet, droits, collaborateurId) ? etape : null;
}

/**
 * La personne dont on lit la fonction sur le chantier, ou `null` si elle n'en
 * tient aucune : celle que portent les droits (un rôle incarné en
 * développement compris), sinon le compte connecté — la portée de la direction
 * ne nomme personne.
 *
 * **Le Directeur Général ne tient aucune fonction de chantier** (décision du
 * 14/10/2026) : une donnée antérieure qui le désignerait encore ne lui donne
 * pas de signature, côté serveur comme ici.
 */
export function personneQuiSigne(
  droits: Droits | null,
  profil: { id: string; is_dg: boolean; is_owner: boolean } | null,
): string | null {
  if (droits?.portee.type === "PERSONNE") return droits.portee.collaborateurId;
  if (!profil || profil.is_dg || profil.is_owner) return null;
  return profil.id;
}

/**
 * Ce compte tient-il cette étape du circuit sur ce chantier ? La fonction sur
 * le chantier, et le code qui va avec : `chantier.valider` pour le conducteur
 * de travaux, `chantier.rediger` pour le chef de projet — comme le serveur
 * (`apps/chantier/views/journal.py`). Sert au rapport (`etapeASigner`) comme à
 * la synthèse périodique.
 */
export function tientEtape(
  etape: "CT" | "CP",
  projet: Projet | undefined,
  droits: Droits | null,
  collaborateurId: string | null,
): boolean {
  if (!projet || !collaborateurId) return false;
  const fonctions = fonctionsDansProjet(projet, collaborateurId);
  if (etape === "CT") return fonctions.includes("CONDUCTEUR_TRAVAUX") && peutCode(droits, "chantier.valider");
  return fonctions.includes("CHEF_PROJET") && peutCode(droits, "chantier.rediger");
}

/**
 * Désigner (ou remplacer) le chef de projet : acte de portée entreprise (décision du 14/10/2026).
 * Recopie la règle serveur (`projets.affecter_membres` et portée entreprise, le CP ne se désigne pas un successeur).
 */
export function peutDesignerChefProjet(projet: Projet, droits: Droits | null): boolean {
  if (!droits) return false;
  return (
    projetModifiable(projet) &&
    (droits.estDirection || (peutCode(droits, "projets.affecter_membres") && droits.portee.type === "TOUS"))
  );
}

/**
 * Compléter l'équipe d'encadrement (CT, CC, autres membres) : le code `projets.affecter_membres`
 * sur ce chantier (règle D-08, `GardePermissionProjet`).
 */
export function peutGererEncadrement(projet: Projet, droits: Droits | null): boolean {
  if (!droits) return false;
  return projetModifiable(projet) && peutSurProjet(droits, "projets.affecter_membres", projet);
}

/**
 * Fixer le planning contractuel et le budget prévisionnel : le chef de
 * projet du chantier, et lui seul. Ils ne se saisissent plus à la création.
 */
export function peutCadrerProjet(projet: Projet, droits: Droits | null): boolean {
  return projetModifiable(projet) && estChefDuProjet(projet, droits);
}

/**
 * Voir et saisir les montants (budgets, coûts) : le code `projets.voir_montants`.
 * Recopie `peut_voir_montants` (`apps/core/droits.py`, règle E-11) : le serveur retire les
 * montants des réponses faites aux autres — un 0 affiché serait faux.
 */
export function peutVoirMontants(droits: Droits | null): boolean {
  return peutCode(droits, "projets.voir_montants");
}

/**
 * Les cles de cache React Query du back-office.
 *
 * Rassemblees ici parce qu'une mutation doit invalider exactement ce que les
 * ecrans ont lu : suspendre un client depuis sa fiche doit rafraichir la
 * liste **et** la vue d'ensemble, qui comptent tous deux les suspendus. Des
 * cles ecrites a la main dans chaque fichier se desynchronisent a la premiere
 * faute de frappe, sans rien casser de visible — le compteur reste juste faux.
 */
import type { FiltresJournalPlateforme } from "@/features/administration";

export const CLES_ADMINISTRATION = {
  moi: () => ["administration", "moi"] as const,
  clients: () => ["administration", "clients"] as const,
  client: (id: string) => ["administration", "clients", id] as const,
  apercuSuppression: (id: string) =>
    ["administration", "clients", id, "suppression"] as const,
  indicateurs: () => ["administration", "indicateurs"] as const,
  evolution: () => ["administration", "indicateurs", "evolution"] as const,
  tendances: () => ["administration", "indicateurs", "tendances"] as const,
  comptes: () => ["administration", "comptes"] as const,
  modules: () => ["administration", "modules"] as const,
  permissions: () => ["administration", "permissions"] as const,
  messagerie: () => ["administration", "messagerie"] as const,
  journal: (filtres: FiltresJournalPlateforme) =>
    ["administration", "journal", filtres] as const,
  actionsJournal: () => ["administration", "journal", "actions"] as const,
};

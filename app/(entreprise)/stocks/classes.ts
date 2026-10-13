/**
 * Les tons partagés par les écrans du stock — chaque statut a sa couleur, et
 * la même partout : liste, tiroir, tableau de bord, BRV imprimé.
 *
 * **Aucune valeur en dur** (règle 4) : les variantes de `Badge` et les fonds
 * d'`Indicateur` passent par les jetons de la charte. Le principe est celui
 * du journal : ce qui attend est bleu, ce qui manque ou bloque est orange ou
 * rouge, ce qui est clos est vert.
 */

import type { VarianteBadge } from "@/components/ui";
import type { TonPdf } from "@/lib/export/documentPdf";
import type {
  EtatStock,
  StatutCommande,
  StatutDemande,
  StatutInventaire,
  StatutLivraison,
  TypeMouvement,
} from "@/features/stocks";

export { BLOC, BLOC_CORPS, BLOC_ENTETE, BLOC_SOUS_TITRE, BLOC_TITRE, BLOC_VIDE, LIGNE_LISTE } from "../tableau-de-bord/classes";

export const TON_DEMANDE: Record<StatutDemande, VarianteBadge> = {
  EN_ATTENTE: "information",
  COMMANDEE_PARTIELLEMENT: "primaire",
  COMMANDEE: "secondaire",
  SOLDEE: "succes",
  ANNULEE: "neutre",
};

export const TON_COMMANDE: Record<StatutCommande, VarianteBadge> = {
  EMIS: "neutre",
  EN_ATTENTE_LIVRAISON: "information",
  RECU_PARTIELLEMENT: "avertissement",
  LIVRE: "succes",
  ANNULE: "neutre",
};

/** « Validé sans justificatif » est orange : la marchandise est là, elle n'est pas en stock. */
export const TON_LIVRAISON: Record<StatutLivraison, VarianteBadge> = {
  EN_ATTENTE_VALIDATION_CT: "information",
  EN_ATTENTE_VALIDATION_CP: "primaire",
  VALIDE_WORKFLOW: "avertissement",
  VALIDE_AVEC_JUSTIFICATIF: "succes",
  REJETE: "erreur",
};

export const TON_INVENTAIRE: Record<StatutInventaire, VarianteBadge> = {
  EN_COURS: "information",
  SOUMIS: "avertissement",
  VALIDE: "succes",
};

export const TON_ETAT_STOCK: Record<EtatStock, VarianteBadge> = {
  RUPTURE: "erreur",
  ALERTE: "avertissement",
  OK: "succes",
};

export const TON_MOUVEMENT: Record<TypeMouvement, VarianteBadge> = {
  ENTREE: "succes",
  SORTIE: "information",
  TRANSFERT: "secondaire",
  INVENTAIRE: "avertissement",
};

/** Le même ton, dans le BRV imprimé. */
export const TON_PDF_LIVRAISON: Record<StatutLivraison, TonPdf> = TON_LIVRAISON;

/** Le chiffre d'une quantité signée : ce qui entre en vert, ce qui sort en neutre. */
export function classeQuantite(quantite: number): string {
  return quantite > 0 ? "text-succes" : quantite < 0 ? "text-neutral-800" : "text-neutral-500";
}

/** Les rangées d'un formulaire de tiroir. */
export const RANGEE = "grid grid-cols-2 gap-x-4 gap-y-3 max-[640px]:grid-cols-1";
/**
 * Un champ de tiroir. `min-w-0` : `FormItem` est une grille, dont la colonne
 * prendrait sinon la largeur d'un libellé long (« 01 — Terrassements et
 * fondations ») et sortirait du tiroir au lieu de le tronquer.
 */
export const CHAMP = "h-[var(--input-height-md)] min-w-0";
/** Le corps défilant d'un tiroir. */
export const CORPS_TIROIR = "flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 [scrollbar-width:thin]";
export const ENTETE_TIROIR = "border-b border-neutral-200 py-5 pr-14 pl-6";
export const PIED_TIROIR = "flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4";
/** Une fiche clé / valeur dans un tiroir de détail. */
export const FICHE = "grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm max-[480px]:grid-cols-1";
export const FICHE_LIBELLE = "text-xs text-neutral-500";
export const FICHE_VALEUR = "font-medium text-neutral-900";

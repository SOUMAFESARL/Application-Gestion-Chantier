/**
 * Types TypeScript pour la gestion des quotas, alertes et surclassement — T-025 §8.
 */

export type TypeRessourceQuota = "CHANTIERS" | "COLLABORATEURS" | "STOCKAGE" | "IA";

export type StatutNiveauQuota = "NORMAL" | "AVERTISSEMENT" | "BLOQUANT" | "ILLIMITE";

export interface MetriqueQuota {
  type: TypeRessourceQuota;
  libelle: string;
  actuel: number;
  limite: number | null; // null = illimité
  unite: string;
  pourcentage: number; // 0 à 100
  statut: StatutNiveauQuota;
  messageAlerte?: string;
}

export interface InfoSurclassement {
  forfaitActuelCode: "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR";
  forfaitActuelLibelle: string;
  forfaitCibleCode: "MAITRE_OEUVRE" | "PROMOTEUR";
  forfaitCibleLibelle: string;
  prixCibleMensuelFcfa: number;
  prixCibleAnnuelFcfa: number;
  titreIncitation: string;
  argumentaire: string;
  beneficesDebloques: {
    ressource: string;
    avant: string;
    apres: string;
    gainCle: string;
  }[];
  estMeilleureOffre?: boolean;
}

export interface ResumeQuotas {
  forfaitCode: "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR";
  forfaitLibelle: string;
  estEnEssai: boolean;
  joursEssaiRestants: number | null;
  aAuMoinsUnAvertissement: boolean;
  aAuMoinsUnBlocage: boolean;
  ressources: {
    chantiers: MetriqueQuota;
    collaborateurs: MetriqueQuota;
    stockage: MetriqueQuota;
    ia: MetriqueQuota;
  };
  recommandationSurclassement: InfoSurclassement | null;
}

export interface ScenarioSimulationQuota {
  id: string;
  nom: string;
  description: string;
  forfaitCode: "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR";
  chantiers: { actuel: number; limite: number | null };
  collaborateurs: { actuel: number; limite: number | null };
  stockageGo: { actuel: number; limite: number | null };
  accesIA: boolean;
}

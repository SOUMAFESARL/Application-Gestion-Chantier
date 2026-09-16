/**
 * Types pour le Journal de Chantier et la Saisie Quotidienne — T-005 & MLD §6.7.
 */

export type MeteoType = "ENSOLEILLE" | "NUAGEUX" | "PLUIE" | "ORAGE";
export type ImpactMeteo = "AUCUN" | "RALENTISSEMENT" | "ARRET_PARTIEL" | "ARRET_TOTAL";
export type StatutRapport = "BROUILLON" | "SOUMIS" | "APPROUVE" | "REJETE";

export interface MeteoDonnees {
  condition: MeteoType;
  temperatureC: number;
  impactTravaux: ImpactMeteo;
  heuresIntemperies: number;
  commentaireMeteo?: string;
}

export interface LignePresence {
  id: string;
  categorie: "REGIE" | "SOUS_TRAITANT" | "ENCADREMENT";
  corpsMetier: string; // Ex: Maçons, Ferrailleurs, Électriciens, Conducteur
  entrepriseSousTraitante?: string;
  effectif: number;
  heuresTravaillees: number;
  remarques?: string;
}

export interface LigneMateriau {
  id: string;
  designation: string; // Ex: Ciment CPJ 42.5
  quantite: number;
  unite: string; // Ex: Sacs (50kg), m³, Tonnes, Unités
  fournisseur: string; // Ex: CIMAF, Lafarge
  numeroBL: string; // Bon de livraison
  etatConformite: "CONFORME" | "NON_CONFORME" | "AVEC_RESERVES";
  heureReception?: string;
}

export interface IncidentBlocage {
  id: string;
  gravite: "MINEUR" | "MAJEUR" | "BLOQUANT";
  categorie: "TECHNIQUE" | "MATERIEL" | "FOURNISSEUR" | "SECURITE" | "CLIENT";
  titre: string;
  description: string;
  mesurePrise?: string;
}

export interface RapportJournalierData {
  id: string;
  projetId: string;
  nomProjet: string;
  lotId?: string;
  nomLot?: string;
  dateRapport: string; // YYYY-MM-DD
  auteurNom: string;
  auteurRole: string;
  statut: StatutRapport;
  meteo: MeteoDonnees;
  presences: LignePresence[];
  materiaux: LigneMateriau[];
  travauxRealises: string;
  incidents: IncidentBlocage[];
  remarquesGenerales: string;
  validePar?: string;
  valideLe?: string;
}

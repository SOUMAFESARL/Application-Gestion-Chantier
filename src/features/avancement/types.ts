/**
 * Types pour le Suivi d'Avancement des Travaux et Photos de Preuve — MLD §6.7 & RG-12
 */

export interface PhotoPreuve {
  id: string;
  url: string;
  titre: string;
  lotId: string;
  nomLot: string;
  datePrise: string; // YYYY-MM-DD HH:mm
  auteurNom: string;
  auteurRole: string;
  localisation: string;
  pourcentageAssocie: number;
  statutConformite: "VERIFIEE" | "EN_ATTENTE" | "A_REPRENDRE";
  commentaire?: string;
}

export interface SousTacheLot {
  id: string;
  libelle: string;
  poidsPourcentage: number; // Poids dans le lot (ex: 20%)
  avancement: number; // 0 à 100%
  dernierChangement?: string;
}

export interface LotAvancement {
  id: string;
  numeroLot: string; // Ex: "01"
  nom: string; // Ex: "Gros Œuvre & Maçonnerie"
  responsableNom: string;
  avancementReel: number; // 0 à 100%
  avancementTheorique: number; // 0 à 100%
  sousTaches: SousTacheLot[];
  photosPreuvesIds: string[];
}

export interface ProjetAvancement {
  id: string;
  code: string;
  nom: string;
  clientMOA: string;
  localisation: string;
  dateDebut: string;
  dateFinPrevue: string;
  avancementReelGlobal: number; // %
  avancementTheoriqueGlobal: number; // %
  lots: LotAvancement[];
  photos: PhotoPreuve[];
}

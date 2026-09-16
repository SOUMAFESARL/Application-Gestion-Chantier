/**
 * Données de test et référentiels pour le Journal de Chantier
 */

import { RapportJournalierData } from "./types";

export interface ProjetOption {
  id: string;
  nom: string;
  code: string;
  lieu: string;
  lots: { id: string; nom: string }[];
}

export const PROJETS_CHANTIER: ProjetOption[] = [
  {
    id: "proj-001",
    nom: "Résidence Les Palmiers - Bâtiment B",
    code: "PALM-B",
    lieu: "Cocody Riviera Golf, Abidjan",
    lots: [
      { id: "lot-01", nom: "Lot 01 - Gros Œuvre & Maçonnerie" },
      { id: "lot-02", nom: "Lot 02 - Électricité & Courants Faibles" },
      { id: "lot-03", nom: "Lot 03 - Plomberie & Sanitaires" },
      { id: "lot-04", nom: "Lot 04 - Peinture & Revêtements" },
    ],
  },
  {
    id: "proj-002",
    nom: "Tour Horizon d'Affaires - R+12",
    code: "TH-02",
    lieu: "Le Plateau, Abidjan",
    lots: [
      { id: "lot-11", nom: "Lot 01 - Fondations Spéciales" },
      { id: "lot-12", nom: "Lot 02 - Structure Béton Armé" },
      { id: "lot-13", nom: "Lot 03 - Façade Mur-Rideau" },
    ],
  },
  {
    id: "proj-003",
    nom: "Entrepôt Logistique Zone Industrielle",
    code: "ENT-YOP",
    lieu: "Zone Industrielle Yopougon",
    lots: [
      { id: "lot-21", nom: "Lot 01 - Terrassement & Plateforme" },
      { id: "lot-22", nom: "Lot 02 - Charpente Métallique" },
    ],
  },
];

export const RAPPORTS_INITIAL: RapportJournalierData[] = [
  {
    id: "rap-2026-09-16-01",
    projetId: "proj-001",
    nomProjet: "Résidence Les Palmiers - Bâtiment B",
    lotId: "lot-01",
    nomLot: "Lot 01 - Gros Œuvre & Maçonnerie",
    dateRapport: "2026-09-16",
    auteurNom: "Mamadou Traoré",
    auteurRole: "Chef de Chantier",
    statut: "SOUMIS",
    meteo: {
      condition: "ENSOLEILLE",
      temperatureC: 31,
      impactTravaux: "AUCUN",
      heuresIntemperies: 0,
      commentaireMeteo: "Temps chaud et dégagé, conditions optimales pour le coulage du béton.",
    },
    presences: [
      {
        id: "pres-1",
        categorie: "REGIE",
        corpsMetier: "Maçons & Coffreurs",
        effectif: 12,
        heuresTravaillees: 8,
        remarques: "Coffrage des poteaux axiaux R+2",
      },
      {
        id: "pres-2",
        categorie: "REGIE",
        corpsMetier: "Ferrailleurs",
        effectif: 6,
        heuresTravaillees: 8,
        remarques: "Ferraillage de la dalle haute",
      },
      {
        id: "pres-3",
        categorie: "SOUS_TRAITANT",
        corpsMetier: "Électriciens",
        entrepriseSousTraitante: "ELECBAT Sarl",
        effectif: 4,
        heuresTravaillees: 7,
        remarques: "Passage des gaines ICTA sous dalle",
      },
      {
        id: "pres-4",
        categorie: "ENCADREMENT",
        corpsMetier: "Chef de chantier & Géomètre",
        effectif: 2,
        heuresTravaillees: 8,
      },
    ],
    materiaux: [
      {
        id: "mat-1",
        designation: "Ciment CPJ 42.5",
        quantite: 150,
        unite: "Sacs (50kg)",
        fournisseur: "CIMAF Côte d'Ivoire",
        numeroBL: "BL-CIM-8921",
        etatConformite: "CONFORME",
        heureReception: "08:30",
      },
      {
        id: "mat-2",
        designation: "Fers à béton HA 12 & HA 14",
        quantite: 4.5,
        unite: "Tonnes",
        fournisseur: "SOTACI",
        numeroBL: "BL-STC-4410",
        etatConformite: "CONFORME",
        heureReception: "10:15",
      },
    ],
    travauxRealises: "Achevement du ferraillage de la dalle R+2. Réception des armatures avec le bureau de contrôle. Début du coffrage des rives et réservation trémie ascenseur.",
    incidents: [],
    remarquesGenerales: "Contrôle d'enrobage validé par le bureau SOCOTEC. Coulage prévu demain matin à 07h00 avant les fortes chaleurs.",
  },
  {
    id: "rap-2026-09-15-02",
    projetId: "proj-001",
    nomProjet: "Résidence Les Palmiers - Bâtiment B",
    lotId: "lot-01",
    nomLot: "Lot 01 - Gros Œuvre & Maçonnerie",
    dateRapport: "2026-09-15",
    auteurNom: "Mamadou Traoré",
    auteurRole: "Chef de Chantier",
    statut: "APPROUVE",
    meteo: {
      condition: "PLUIE",
      temperatureC: 26,
      impactTravaux: "ARRET_PARTIEL",
      heuresIntemperies: 2.5,
      commentaireMeteo: "Fortes averses orageuses entre 13h00 et 15h30. Évacuation temporaire des extérieurs.",
    },
    presences: [
      {
        id: "pres-10",
        categorie: "REGIE",
        corpsMetier: "Maçons",
        effectif: 10,
        heuresTravaillees: 5.5,
      },
      {
        id: "pres-11",
        categorie: "REGIE",
        corpsMetier: "Ferrailleurs",
        effectif: 6,
        heuresTravaillees: 5.5,
      },
      {
        id: "pres-12",
        categorie: "ENCADREMENT",
        corpsMetier: "Chef de chantier",
        effectif: 1,
        heuresTravaillees: 8,
      },
    ],
    materiaux: [
      {
        id: "mat-10",
        designation: "Sable fin lagunaire",
        quantite: 18,
        unite: "m³ (1 camion benne)",
        fournisseur: "Carrière Lagunaire Bassam",
        numeroBL: "BL-CLB-201",
        etatConformite: "CONFORME",
        heureReception: "11:00",
      },
    ],
    travauxRealises: "Ferraillage poutres P1 à P8. Pose des cales d'armatures.",
    incidents: [
      {
        id: "inc-1",
        gravite: "MINEUR",
        categorie: "TECHNIQUE",
        titre: "Arrêt intempérie pluie 2h30",
        description: "Reprise des travaux à 15h45 après pompage léger de la rétention eau de pluie.",
        mesurePrise: "Pompe de relevage activée.",
      },
    ],
    remarquesGenerales: "Retard de 2h30 rattrapable sur la journée de mercredi.",
    validePar: "Ing. Koffi Brou (Conducteur de travaux)",
    valideLe: "2026-09-15 18:45",
  },
];

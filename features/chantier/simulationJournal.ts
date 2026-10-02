/**
 * Le journal de chantier de démonstration — en attendant les routes.
 *
 * Même contrat que `features/projets/simulationLots.ts` : il parle le
 * domaine (les types de `types.ts`), les vrais appels restent à leur place
 * dans `adaptateur.ts`, et le jour où Django sert le journal,
 * `NEXT_PUBLIC_API_SIMULE` passe à `0` sans qu'aucun écran ne change. Pas de
 * bandeau : le propriétaire du produit l'a demandé (24/09/2026).
 *
 * **Tout est calculé, rien n'est tiré au hasard** : un générateur à graine
 * donne à chaque (lot, jour) toujours les mêmes effectifs, quantités et
 * incidents — un rapport relu deux fois ne change pas, et la synthèse
 * retrouve exactement les chiffres des rapports qu'elle agrège.
 *
 * **Les dates sont relatives à aujourd'hui** : neuf semaines de rapports qui
 * finissent ce jour, pour que « Aujourd'hui », l'historique et les synthèses
 * aient toujours de quoi montrer.
 *
 * Les chantiers sont ceux de l'ancien jeu de démonstration des projets ; les lots reprennent ceux
 * de `simulationLots` quand ils y existent.
 */

import { attendre, refuser } from "@/lib/api/simulation";

import {
  agregerSynthese,
  ajouterJours,
  estDepose,
  estJourOuvre,
  jourDe,
  jourOuvreAvant,
  numeroSemaine,
  periodeClose,
} from "./regles";
import type {
  Appreciation,
  Blocage,
  ConditionsMeteo,
  DemandeSynthese,
  EntreeJournal,
  EtapeCircuit,
  Incident,
  Journal,
  LigneActivite,
  LigneEffectif,
  LigneEquipement,
  LigneMateriau,
  LigneProduction,
  Livraison,
  LotJournal,
  Meteo,
  ObjectifSuivant,
  Photo,
  Prevision,
  RapportJournalier,
  SituationRapport,
  SynthesePeriodique,
} from "./types";

const CLE_RELANCES = "ccd.simulation.journal.relances";
const LATENCE_LECTURE = 350;
const LATENCE_ECRITURE = 450;
/** Neuf semaines : le mois précédent se synthétise en entier. */
const JOURS_HISTORIQUE = 45;

/* ------------------------------------------------------------------ *
 * Le générateur à graine.
 * ------------------------------------------------------------------ */

function hacher(texte: string): number {
  let valeur = 2166136261;
  for (let rang = 0; rang < texte.length; rang += 1) {
    valeur ^= texte.charCodeAt(rang);
    valeur = Math.imul(valeur, 16777619);
  }
  return valeur >>> 0;
}

/** Un nombre entre 0 et 1, toujours le même pour la même graine. */
function alea(...graine: (string | number)[]): number {
  let valeur = hacher(graine.join("|"));
  valeur = Math.imul(valeur ^ (valeur >>> 15), 2246822507);
  valeur = Math.imul(valeur ^ (valeur >>> 13), 3266489909);
  return ((valeur ^ (valeur >>> 16)) >>> 0) / 4294967296;
}

function choisir<T>(liste: readonly T[], ...graine: (string | number)[]): T {
  return liste[Math.floor(alea(...graine) * liste.length) % liste.length];
}

function arrondir(valeur: number, decimales = 0): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

/* ------------------------------------------------------------------ *
 * Les gabarits de lots.
 * ------------------------------------------------------------------ */

interface GabaritActivite {
  libelle: string;
  unite: string;
  quantitePrevue: number;
  /** L'avancement au soir d'aujourd'hui, en %. */
  avancement: number;
  theorique: number;
  /** Le rythme moyen, en % de la quantité prévue par jour ouvré. */
  rythme: number;
  observations: string[];
}

interface GabaritMateriau {
  designation: string;
  unite: string;
  stock: number;
  consommation: number;
  seuil: number;
}

interface GabaritLot {
  cle: string;
  lot: LotJournal;
  localisation: string;
  latitude: number;
  longitude: number;
  conducteurTravaux: string;
  chefProjet: string;
  /** Régie directe seulement : les catégories d'ouvriers. */
  effectifs: { categorie: string; prevus: number; heures: number }[] | null;
  /** Hors régie : le total déclaré par le sous-traitant. */
  effectifDeclare: number;
  production: Omit<LigneProduction, "quantiteJour" | "cumul">[] | null;
  activites: GabaritActivite[];
  materiaux: GabaritMateriau[];
  livraisons: Omit<Livraison, "heure">[];
  equipements: LigneEquipement[];
  incidents: Omit<Incident, "numero" | "resolu">[];
  photos: string[];
  notes: string[];
  previsions: Prevision[];
}

const ID_RESIDENCE = "b1b72e51-4fa3-433b-821b-cfc1901ddfa2";
const ID_SIEGE = "c2c83f62-5fb4-4a5c-932c-d02a12eeeb13";
const ID_ENTREPOT = "d3d94073-6fc5-4b6d-a43d-e13b23fffc24";

const RESIDENCE = {
  projetId: ID_RESIDENCE,
  projetNom: "Résidence Les Merveilles",
  projetReference: "PRJ-2026-001",
};
const SIEGE = {
  projetId: ID_SIEGE,
  projetNom: "Siège Banque Atlantique",
  projetReference: "PRJ-2026-002",
};
const ENTREPOT = {
  projetId: ID_ENTREPOT,
  projetNom: "Entrepôt logistique Sifca",
  projetReference: "PRJ-2026-003",
};

const INCIDENT_EPI: Omit<Incident, "numero" | "resolu"> = {
  type: "SECURITE",
  description: "Ouvrier observé sans casque dans la zone de levage.",
  gravite: "MINEUR",
  decidePar: "CC",
  action: "Rappel du règlement, EPI fourni. Inscrit au registre HSE.",
};

const GABARITS: GabaritLot[] = [
  {
    cle: "res-l03",
    lot: {
      id: "lot-res-l03",
      code: "L-03",
      nom: "Gros œuvre",
      modeExecution: "REGIE_DIRECTE",
      ...RESIDENCE,
      chefChantier: "Oumar Gbané",
    },
    localisation: "Cocody Angré, Abidjan",
    latitude: 5.3964,
    longitude: -3.9885,
    conducteurTravaux: "Emmanuel Brou",
    chefProjet: "Manson Zanfack",
    effectifs: [
      { categorie: "Chef de chantier", prevus: 1, heures: 9.5 },
      { categorie: "Maçons qualifiés", prevus: 6, heures: 9 },
      { categorie: "Ferrailleurs", prevus: 4, heures: 9.5 },
      { categorie: "Coffreurs", prevus: 3, heures: 9.5 },
      { categorie: "Manœuvres", prevus: 12, heures: 9 },
      { categorie: "Grutier", prevus: 1, heures: 9.5 },
    ],
    effectifDeclare: 27,
    production: null,
    activites: [
      {
        libelle: "Poteaux et dalle RDC",
        unite: "m²",
        quantitePrevue: 420,
        avancement: 85,
        theorique: 92,
        rythme: 1.9,
        observations: ["Coulage travée 3–4", "Décoffrage axe D", "Reprise des abouts de dalle"],
      },
      {
        libelle: "Ferraillage dalle R+1",
        unite: "kg",
        quantitePrevue: 14500,
        avancement: 40,
        theorique: 48,
        rythme: 2.6,
        observations: ["Nappe inférieure travée 1", "Chapeaux sur appuis", "Attente livraison HA 12"],
      },
      {
        libelle: "Maçonnerie des élévations",
        unite: "m²",
        quantitePrevue: 1250,
        avancement: 12,
        theorique: 18,
        rythme: 1.1,
        observations: ["Agglos de 15 façade nord", "Chaînages verticaux", "Démarrage cage d'escalier"],
      },
    ],
    materiaux: [
      { designation: "Ciment CPA 42.5", unite: "sacs", stock: 220, consommation: 110, seuil: 200 },
      { designation: "Sable concassé", unite: "m³", stock: 17, consommation: 7, seuil: 10 },
      { designation: "Gravier 15/25", unite: "m³", stock: 12, consommation: 5, seuil: 8 },
      { designation: "Fer HA 12", unite: "kg", stock: 2350, consommation: 420, seuil: 1000 },
      { designation: "Bois de coffrage", unite: "m²", stock: 156, consommation: 22, seuil: 80 },
    ],
    livraisons: [
      {
        fournisseur: "CIMAF Côte d'Ivoire",
        designation: "Ciment CPA 42.5 — sacs de 50 kg",
        quantite: "200 sacs",
        bonLivraison: "BL-CIMAF-4218",
        conformite: "PARTIELLE",
        observation: "3 sacs humides refusés — avoir demandé.",
      },
      {
        fournisseur: "SATOCI",
        designation: "Gravier 15/25 — camion benne",
        quantite: "10 m³",
        bonLivraison: "BL-SAT-0891",
        conformite: "CONFORME",
        observation: "Stocké zone nord.",
      },
      {
        fournisseur: "Béton Bâti CI",
        designation: "Béton prêt à l'emploi B25",
        quantite: "8 m³",
        bonLivraison: "BL-BBC-1102",
        conformite: "CONFORME",
        observation: "Coulé dès réception.",
      },
      {
        fournisseur: "FENICIA",
        designation: "Fer HA 12 — barres de 12 m",
        quantite: "2 000 kg",
        bonLivraison: "BL-FEN-0389",
        conformite: "CONFORME",
        observation: null,
      },
    ],
    equipements: [
      {
        designation: "Grue à tour 6 T",
        reference: "GRU-001",
        propriete: "ENTREPRISE",
        utilisation: "7 h 30",
        operateur: "Etienne Koffi",
        etat: "BON",
        observation: "Vérification des câbles vendredi.",
      },
      {
        designation: "Bétonnière 350 L",
        reference: "MAT-001",
        propriete: "ENTREPRISE",
        utilisation: "8 h",
        operateur: "Adama Coulibaly",
        etat: "BON",
        observation: null,
      },
      {
        designation: "Vibreur à béton",
        reference: "MAT-003",
        propriete: "ENTREPRISE",
        utilisation: "6 h",
        operateur: "Kader Traoré",
        etat: "BON",
        observation: null,
      },
      {
        designation: "Camion toupie 8 m³",
        reference: "EXT-BBC",
        propriete: "LOCATION",
        utilisation: "2 rotations",
        operateur: "Chauffeur BBC",
        etat: "BON",
        observation: null,
      },
    ],
    incidents: [
      {
        type: "QUALITE",
        description: "Livraison CIMAF : sacs percés et humides constatés à la réception.",
        gravite: "MINEUR",
        decidePar: "CC",
        action: "Sacs refusés et retournés, bon de retour signé, avoir demandé.",
      },
      INCIDENT_EPI,
      {
        type: "MATERIEL",
        description: "Vibreur à béton en surchauffe, arrêt de 45 minutes.",
        gravite: "MINEUR",
        decidePar: "CC",
        action: "Vibreur de secours utilisé ; révision demandée au parc.",
      },
    ],
    photos: [
      "Ferraillage poteaux axe C",
      "Coulage béton poteaux A1–A4",
      "Vue d'ensemble de l'avancement RDC",
      "Coffrage de la travée 3–4",
    ],
    notes: [
      "Journée productive malgré les absences. Prévoir le réapprovisionnement en ciment avant vendredi.",
      "Décoffrage axe D : résistance du béton satisfaisante, aucune anomalie.",
      "Demande au CT : heures supplémentaires samedi pour rattraper le retard sur le planning.",
      "Bonne cadence sur le ferraillage. Livraison FENICIA confirmée pour demain 07h30.",
    ],
    previsions: [
      {
        activite: "Décoffrage poteaux axes A1–A4",
        equipe: "Coffreurs (3)",
        objectif: "8 poteaux",
        prerequis: "Délai de 24 h atteint",
      },
      {
        activite: "Ferraillage voiles axe D",
        equipe: "Ferrailleurs (4)",
        objectif: "40 m²",
        prerequis: "Livraison FENICIA attendue à 07h30",
      },
      {
        activite: "Coulage béton poteaux axe C",
        equipe: "Maçons et manœuvres",
        objectif: "6 poteaux",
        prerequis: "Béton B25 commandé pour 09h00",
      },
    ],
  },
  {
    cle: "res-l04",
    lot: {
      id: "lot-res-l04",
      code: "L-04",
      nom: "Charpente et couverture",
      modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
      ...RESIDENCE,
      chefChantier: "Adama Coulibaly",
    },
    localisation: "Cocody Angré, Abidjan",
    latitude: 5.3966,
    longitude: -3.9883,
    conducteurTravaux: "Emmanuel Brou",
    chefProjet: "Manson Zanfack",
    effectifs: null,
    effectifDeclare: 8,
    production: null,
    activites: [
      {
        libelle: "Charpente métallique",
        unite: "kg",
        quantitePrevue: 8500,
        avancement: 18,
        theorique: 30,
        rythme: 0.9,
        observations: ["Levage des fermes 1 à 4", "Boulonnage des pannes", "Contrôle des aplombs"],
      },
    ],
    materiaux: [
      { designation: "Boulons HR M16", unite: "u", stock: 640, consommation: 60, seuil: 200 },
      { designation: "Peinture antirouille", unite: "l", stock: 90, consommation: 8, seuil: 30 },
    ],
    livraisons: [
      {
        fournisseur: "Métal Ouest Afrique",
        designation: "Fermes métalliques — lot 2",
        quantite: "4 fermes",
        bonLivraison: "BL-MOA-0217",
        conformite: "CONFORME",
        observation: null,
      },
    ],
    equipements: [
      {
        designation: "Nacelle articulée 16 m",
        reference: "EXT-NAC",
        propriete: "LOCATION",
        utilisation: "6 h",
        operateur: "Sous-traitant",
        etat: "BON",
        observation: null,
      },
    ],
    incidents: [
      {
        type: "SECURITE",
        description: "Harnais non attaché lors d'un levage de ferme.",
        gravite: "SIGNIFICATIF",
        decidePar: "CT",
        action: "Arrêt du levage, briefing sécurité du sous-traitant, reprise après contrôle.",
      },
    ],
    photos: ["Levage d'une ferme", "Assemblage des pannes"],
    notes: [
      "Le sous-traitant tient la cadence prévue sur les fermes.",
      "Attente du lot 3 de fermes : risque de retard de deux jours.",
    ],
    previsions: [
      {
        activite: "Levage fermes 5 à 8",
        equipe: "Métal Ouest Afrique",
        objectif: "4 fermes",
        prerequis: "Nacelle disponible",
      },
    ],
  },
  {
    cle: "sie-l02",
    lot: {
      id: "lot-sie-l02",
      code: "L-02",
      nom: "Façade",
      modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
      ...SIEGE,
      chefChantier: "Mamadou Diabaté",
    },
    localisation: "Plateau, Abidjan",
    latitude: 5.3197,
    longitude: -4.0197,
    conducteurTravaux: "Emmanuel Brou",
    chefProjet: "Koffi Kouamé",
    effectifs: null,
    effectifDeclare: 10,
    production: null,
    activites: [
      {
        libelle: "Mur rideau vitré",
        unite: "m²",
        quantitePrevue: 1850,
        avancement: 55,
        theorique: 90,
        rythme: 0.8,
        observations: ["Pose des montants niveau 4", "Vitrages façade est", "Joints silicone niveau 3"],
      },
      {
        libelle: "Ravalement des pignons",
        unite: "m²",
        quantitePrevue: 900,
        avancement: 70,
        theorique: 100,
        rythme: 0.6,
        observations: ["Enduit pignon ouest", "Peinture de finition"],
      },
    ],
    materiaux: [
      { designation: "Profilés aluminium", unite: "ml", stock: 235, consommation: 18, seuil: 50 },
      { designation: "Vitrages feuilletés", unite: "u", stock: 42, consommation: 4, seuil: 12 },
    ],
    livraisons: [
      {
        fournisseur: "Alu Façades CI",
        designation: "Profilés aluminium anodisé",
        quantite: "120 ml",
        bonLivraison: "BL-AFC-0512",
        conformite: "PARTIELLE",
        observation: "Livraison incomplète, solde attendu.",
      },
    ],
    equipements: [
      {
        designation: "Nacelle ciseaux 12 m",
        reference: "EXT-NCS",
        propriete: "LOCATION",
        utilisation: "7 h",
        operateur: "Sous-traitant",
        etat: "BON",
        observation: null,
      },
    ],
    incidents: [
      {
        type: "APPROVISIONNEMENT",
        description: "Retard de livraison des profilés aluminium.",
        gravite: "MINEUR",
        decidePar: "CC",
        action: "Relance du fournisseur ; pose réorganisée sur la façade est.",
      },
    ],
    photos: ["Façade est — vitrages posés", "Montants niveau 4"],
    notes: [
      "Cadence ralentie faute de profilés. Relance faite auprès d'Alu Façades CI.",
      "Pose des vitrages conforme au calepinage.",
    ],
    previsions: [
      {
        activite: "Pose des vitrages niveau 4",
        equipe: "Alu Façades CI",
        objectif: "24 m²",
        prerequis: "Réception du solde de profilés",
      },
    ],
  },
  {
    cle: "sie-l04",
    lot: {
      id: "lot-sie-l04",
      code: "L-04",
      nom: "Revêtements de sols",
      modeExecution: "SOUS_TRAITANCE_INFORMELLE",
      ...SIEGE,
      chefChantier: "Serge Oulai",
    },
    localisation: "Plateau, Abidjan",
    latitude: 5.3199,
    longitude: -4.0195,
    conducteurTravaux: "Emmanuel Brou",
    chefProjet: "Koffi Kouamé",
    effectifs: null,
    effectifDeclare: 6,
    production: [
      { intervenant: "Yao Koffi", activite: "Carrelage plateaux", unite: "m²", prixUnitaire: 8_500_00 },
      { intervenant: "Paul Adjoumani", activite: "Carrelage escaliers", unite: "m²", prixUnitaire: 9_200_00 },
      { intervenant: "Issa Kaboré", activite: "Plinthes", unite: "ml", prixUnitaire: 1_500_00 },
    ],
    activites: [
      {
        libelle: "Carrelage plateaux",
        unite: "m²",
        quantitePrevue: 1600,
        avancement: 32,
        theorique: 36,
        rythme: 0.9,
        observations: ["Plateau niveau 2", "Hall d'accueil"],
      },
      {
        libelle: "Carrelage escaliers",
        unite: "m²",
        quantitePrevue: 180,
        avancement: 28,
        theorique: 30,
        rythme: 0.8,
        observations: ["Volée RDC-R+1"],
      },
      {
        libelle: "Plinthes",
        unite: "ml",
        quantitePrevue: 1400,
        avancement: 20,
        theorique: 26,
        rythme: 0.7,
        observations: ["Bureaux niveau 1"],
      },
    ],
    materiaux: [
      { designation: "Carreaux grès cérame 60×60", unite: "m²", stock: 380, consommation: 16, seuil: 100 },
      { designation: "Colle carrelage", unite: "sacs", stock: 95, consommation: 8, seuil: 30 },
    ],
    livraisons: [
      {
        fournisseur: "Céramique du Golfe",
        designation: "Carreaux grès cérame 60×60",
        quantite: "150 m²",
        bonLivraison: "BL-CDG-2231",
        conformite: "CONFORME",
        observation: null,
      },
    ],
    equipements: [
      {
        designation: "Coupe-carreaux électrique",
        reference: "MAT-021",
        propriete: "ENTREPRISE",
        utilisation: "5 h",
        operateur: "Yao Koffi",
        etat: "BON",
        observation: null,
      },
    ],
    incidents: [
      {
        type: "QUALITE",
        description: "Planéité hors tolérance sur 6 m² du plateau niveau 2.",
        gravite: "MINEUR",
        decidePar: "CC",
        action: "Dépose et repose aux frais du tâcheron.",
      },
    ],
    photos: ["Carrelage plateau niveau 2", "Volée d'escalier"],
    notes: [
      "Tâcherons présents et réguliers. Quantités métrées en fin de journée avec le CC.",
      "Prévoir la réception du hall avant la pose des plinthes.",
    ],
    previsions: [
      {
        activite: "Carrelage plateau niveau 2 — zone sud",
        equipe: "Tâcherons (3)",
        objectif: "20 m²",
        prerequis: "Chape sèche contrôlée",
      },
    ],
  },
  {
    cle: "sif-l01",
    lot: {
      id: "lot-sif-l01",
      code: "L-01",
      nom: "Terrassement et plateforme",
      modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
      ...ENTREPOT,
      chefChantier: "Kouamé Yao",
    },
    localisation: "Zone industrielle, Yamoussoukro",
    latitude: 6.8276,
    longitude: -5.2893,
    conducteurTravaux: "Ibrahim Cissé",
    chefProjet: "Awa Soro",
    effectifs: null,
    effectifDeclare: 14,
    production: null,
    activites: [
      {
        libelle: "Fouilles en masse",
        unite: "m³",
        quantitePrevue: 6200,
        avancement: 78,
        theorique: 100,
        rythme: 0.7,
        observations: ["Zone C", "Évacuation des déblais", "Purges ponctuelles"],
      },
      {
        libelle: "Couche de forme",
        unite: "m²",
        quantitePrevue: 4200,
        avancement: 26,
        theorique: 100,
        rythme: 0.6,
        observations: ["Compactage zone A", "Réglage à la niveleuse"],
      },
    ],
    materiaux: [
      { designation: "Grave latéritique", unite: "m³", stock: 340, consommation: 60, seuil: 150 },
      { designation: "Gasoil engins", unite: "l", stock: 2800, consommation: 420, seuil: 1000 },
    ],
    livraisons: [
      {
        fournisseur: "Carrière de Tiébissou",
        designation: "Grave latéritique",
        quantite: "120 m³",
        bonLivraison: "BL-CTB-0773",
        conformite: "CONFORME",
        observation: null,
      },
      {
        fournisseur: "Total Energies CI",
        designation: "Gasoil — citerne",
        quantite: "2 000 l",
        bonLivraison: "BL-TOT-5520",
        conformite: "CONFORME",
        observation: null,
      },
    ],
    equipements: [
      {
        designation: "Pelle hydraulique 22 T",
        reference: "ENG-004",
        propriete: "ENTREPRISE",
        utilisation: "8 h",
        operateur: "Drissa Koné",
        etat: "BON",
        observation: null,
      },
      {
        designation: "Compacteur à rouleau",
        reference: "MAT-007",
        propriete: "ENTREPRISE",
        utilisation: "3 h 30",
        operateur: "Abou Sylla",
        etat: "ENTRETIEN",
        observation: "Filtre à air à remplacer.",
      },
    ],
    incidents: [
      {
        type: "MATERIEL",
        description: "Compacteur MAT-007 : filtre à air encrassé, arrêt de 1 h 30.",
        gravite: "MINEUR",
        decidePar: "CC",
        action: "Maintenance planifiée ; compactage reporté au lendemain.",
      },
      {
        type: "QUALITE",
        description: "Poche d'argile détectée en zone C, portance insuffisante.",
        gravite: "SIGNIFICATIF",
        decidePar: "CT",
        action: "Purge et substitution par grave latéritique, métré contradictoire.",
      },
    ],
    photos: ["Fouilles zone C", "Compactage couche de forme", "Stock de grave latéritique"],
    notes: [
      "Retard toujours marqué sur la couche de forme ; la pelle est seule sur les fouilles.",
      "Le compacteur doit passer en maintenance, je demande un engin de remplacement.",
      "Sol détrempé le matin, reprise du compactage l'après-midi.",
    ],
    previsions: [
      {
        activite: "Couche de forme zone A",
        equipe: "Équipe Terrassement Nord",
        objectif: "300 m²",
        prerequis: "Compacteur remis en service",
      },
    ],
  },
  {
    cle: "sif-l02",
    lot: {
      id: "lot-sif-l02",
      code: "L-02",
      nom: "Charpente métallique",
      modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
      ...ENTREPOT,
      chefChantier: "Boubacar Traoré",
    },
    localisation: "Zone industrielle, Yamoussoukro",
    latitude: 6.8279,
    longitude: -5.2889,
    conducteurTravaux: "Ibrahim Cissé",
    chefProjet: "Awa Soro",
    effectifs: null,
    effectifDeclare: 9,
    production: null,
    activites: [
      {
        libelle: "Portiques et pannes",
        unite: "T",
        quantitePrevue: 96,
        avancement: 8,
        theorique: 30,
        rythme: 0.5,
        observations: ["Scellement des platines", "Levage portique 1"],
      },
    ],
    materiaux: [
      { designation: "Tiges d'ancrage", unite: "u", stock: 180, consommation: 12, seuil: 60 },
    ],
    livraisons: [
      {
        fournisseur: "Acier Charpente CI",
        designation: "Portiques — travées 1 à 3",
        quantite: "12 T",
        bonLivraison: "BL-ACC-0144",
        conformite: "PARTIELLE",
        observation: "Une traverse déformée au transport.",
      },
    ],
    equipements: [
      {
        designation: "Grue mobile 50 T",
        reference: "EXT-GRM",
        propriete: "LOCATION",
        utilisation: "5 h",
        operateur: "Grutier loueur",
        etat: "BON",
        observation: null,
      },
    ],
    incidents: [
      {
        type: "ADMINISTRATIF",
        description: "Plans d'exécution de la charpente non visés par le bureau de contrôle.",
        gravite: "SIGNIFICATIF",
        decidePar: "CP",
        action: "Relance du bureau de contrôle, levage limité aux travées validées.",
      },
    ],
    photos: ["Platines scellées", "Levage du portique 1"],
    notes: [
      "Démarrage lent : les plans visés ne sont pas encore revenus du bureau de contrôle.",
      "Levage du premier portique réussi, aplombs conformes.",
    ],
    previsions: [
      {
        activite: "Levage portiques 2 et 3",
        equipe: "Acier Charpente CI",
        objectif: "2 portiques",
        prerequis: "Grue mobile réservée, plans visés",
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Les situations mises en scène.
 * ------------------------------------------------------------------ */

/**
 * Par défaut un rapport ancien est approuvé, celui de la veille validé par le
 * CT, celui du jour soumis. Ces exceptions font voir chaque état à
 * l'ouverture : trois lots sans rapport aujourd'hui, des
 * validations hors délai, un rejet, deux absences passées.
 */
const SITUATIONS_MISES_EN_SCENE: Record<string, SituationRapport> = {
  "res-l03:0": "SOUMIS",
  "res-l04:0": "VALIDE_CT",
  "sie-l02:0": "NON_SOUMIS",
  "sie-l04:0": "NON_SOUMIS",
  "sif-l01:0": "SOUMIS",
  "sif-l02:0": "NON_SOUMIS",
  "res-l03:1": "APPROUVE_CP",
  "sie-l02:1": "SOUMIS",
  "sif-l01:1": "REJETE",
  "sif-l02:1": "SOUMIS",
  "sie-l04:2": "VALIDE_CT",
  "sie-l02:6": "NON_SOUMIS",
  "sif-l02:13": "NON_SOUMIS",
  "res-l04:22": "NON_SOUMIS",
};

function situationDe(cle: string, rang: number): SituationRapport {
  const miseEnScene = SITUATIONS_MISES_EN_SCENE[`${cle}:${rang}`];
  if (miseEnScene) return miseEnScene;
  if (rang === 0) return "SOUMIS";
  if (rang === 1) return "VALIDE_CT";
  return "APPROUVE_CP";
}

const MOTIF_REJET =
  "Quantités de fouilles incohérentes avec le métré contradictoire : reprendre le cumul de la zone C.";

/* ------------------------------------------------------------------ *
 * Le temps.
 * ------------------------------------------------------------------ */

function horodatage(jour: string, heure: string): string {
  return new Date(`${jour}T${heure}:00`).toISOString();
}

function ilYa(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function jourOuvreApres(jour: string): string {
  let suivant = ajouterJours(jour, 1);
  while (!estJourOuvre(suivant)) suivant = ajouterJours(suivant, 1);
  return suivant;
}

function aujourdhui(): string {
  return jourDe(new Date());
}

/** Les jours ouvrés couverts, le plus récent en tête : `jours[rang]`. */
function joursCouverts(): string[] {
  const dernier = aujourdhui();
  return Array.from({ length: JOURS_HISTORIQUE }, (_, rang) => jourOuvreAvant(dernier, rang)).filter(
    (jour) => jour <= dernier,
  );
}

/* ------------------------------------------------------------------ *
 * Les séries — cumuls et stocks, construits à rebours depuis aujourd'hui.
 * ------------------------------------------------------------------ */

interface Series {
  /** `cumuls[activite][rang]` : le cumul au soir du jour `rang`. */
  cumuls: number[][];
  /** `stocks[materiau][rang]` : le stock au soir du jour `rang`. */
  stocks: number[][];
  livres: number[][];
  utilises: number[][];
}

const seriesParLot = new Map<string, Series>();

function series(gabarit: GabaritLot): Series {
  const connues = seriesParLot.get(gabarit.cle);
  if (connues) return connues;
  const cumuls = gabarit.activites.map((activite, indice) => {
    const liste = [(activite.quantitePrevue * activite.avancement) / 100];
    for (let rang = 0; rang <= JOURS_HISTORIQUE; rang += 1) {
      const jour = (activite.quantitePrevue * activite.rythme * (0.55 + 0.9 * alea(gabarit.cle, indice, rang))) / 100;
      liste.push(Math.max(0, liste[rang] - jour));
    }
    return liste.map((valeur) => arrondir(valeur, activite.quantitePrevue < 200 ? 1 : 0));
  });
  const utilises: number[][] = [];
  const livres: number[][] = [];
  const stocks = gabarit.materiaux.map((materiau, indice) => {
    const liste = [materiau.stock];
    const utilise: number[] = [];
    const livre: number[] = [];
    for (let rang = 0; rang <= JOURS_HISTORIQUE; rang += 1) {
      const conso = Math.round(materiau.consommation * (0.6 + 0.8 * alea(gabarit.cle, "m", indice, rang)));
      const apport =
        alea(gabarit.cle, "l", indice, rang) < 0.22 ? Math.round(materiau.consommation * 3.5) : 0;
      utilise.push(conso);
      livre.push(apport);
      // Le stock de la veille : celui du soir, moins l'apport, plus la consommation.
      liste.push(liste[rang] - apport + conso);
    }
    utilises.push(utilise);
    livres.push(livre);
    return liste;
  });
  const resultat = { cumuls, stocks, livres, utilises };
  seriesParLot.set(gabarit.cle, resultat);
  return resultat;
}

function theoriqueActivite(activite: GabaritActivite, rang: number): number {
  const pas = activite.rythme * 1.15;
  return Math.max(0, Math.min(100, arrondir(activite.theorique - pas * rang)));
}

/* ------------------------------------------------------------------ *
 * La construction d'une entrée.
 * ------------------------------------------------------------------ */

function identifiant(cle: string, jour: string, situation: SituationRapport): string {
  return `${situation === "NON_SOUMIS" ? "abs" : "rap"}-${cle}-${jour}`;
}

function referenceRapport(gabarit: GabaritLot, jour: string, rang: number): string {
  const annee = jour.slice(0, 4);
  const projet = gabarit.lot.projetReference.slice(-3);
  const numero = String(120 + JOURS_HISTORIQUE - rang).padStart(3, "0");
  return `RAP-${annee}-${projet}-${gabarit.lot.code.replace("-", "")}-${numero}`;
}

function circuitDe(gabarit: GabaritLot, jour: string, rang: number, situation: SituationRapport): {
  circuit: EtapeCircuit[];
  soumisLe: string | null;
} {
  const lendemain = jourOuvreApres(jour);
  const aujourdhuiMeme = rang === 0;
  const soumisLe = !estDepose(situation)
    ? null
    : aujourdhuiMeme
      ? ilYa(situation === "VALIDE_CT" ? 190 : 55 + Math.round(alea(gabarit.cle, jour) * 60))
      : horodatage(jour, `17:${String(5 + Math.floor(alea(gabarit.cle, jour, "h") * 40)).padStart(2, "0")}`);
  const signeCt = aujourdhuiMeme ? ilYa(70) : horodatage(lendemain, "08:10");

  const cc: EtapeCircuit = {
    role: "CC",
    signataire: gabarit.lot.chefChantier,
    etat: soumisLe ? "SIGNE" : "EN_ATTENTE",
    signeLe: soumisLe,
    echeance: soumisLe ? null : horodatage(jour, "17:30"),
    commentaire: null,
  };
  const ct: EtapeCircuit = {
    role: "CT",
    signataire: gabarit.conducteurTravaux,
    etat: "A_VENIR",
    signeLe: null,
    echeance: null,
    commentaire: null,
  };
  const cp: EtapeCircuit = {
    role: "CP",
    signataire: gabarit.chefProjet,
    etat: "A_VENIR",
    signeLe: null,
    echeance: null,
    commentaire: null,
  };

  if (situation === "SOUMIS") {
    ct.etat = "EN_ATTENTE";
    ct.echeance = horodatage(lendemain, "07:30");
  }
  if (situation === "REJETE") {
    ct.etat = "REJETE";
    ct.signeLe = signeCt;
    ct.commentaire = MOTIF_REJET;
  }
  if (situation === "VALIDE_CT" || situation === "APPROUVE_CP") {
    ct.etat = "SIGNE";
    ct.signeLe = signeCt;
    const jourCt = aujourdhuiMeme ? jour : lendemain;
    if (situation === "VALIDE_CT") {
      cp.etat = "EN_ATTENTE";
      cp.echeance = horodatage(aujourdhuiMeme ? lendemain : jourCt, "17:00");
    } else {
      cp.etat = "SIGNE";
      cp.signeLe = horodatage(jourCt, "11:40");
    }
  }
  return { circuit: [cc, ct, cp], soumisLe };
}

function avancementLot(gabarit: GabaritLot, rang: number): { reel: number; theorique: number } {
  const { cumuls } = series(gabarit);
  const reels = gabarit.activites.map((activite, indice) => (cumuls[indice][rang] / activite.quantitePrevue) * 100);
  const theoriques = gabarit.activites.map((activite) => theoriqueActivite(activite, rang));
  const moyenne = (valeurs: number[]) => valeurs.reduce((total, valeur) => total + valeur, 0) / valeurs.length;
  return { reel: Math.round(moyenne(reels)), theorique: Math.round(moyenne(theoriques)) };
}

function effectifsDe(gabarit: GabaritLot, jour: string): LigneEffectif[] | null {
  if (!gabarit.effectifs) return null;
  return gabarit.effectifs.map((categorie, indice) => {
    const tirage = alea(gabarit.cle, jour, "eff", indice);
    const absents =
      categorie.prevus <= 1 ? 0 : tirage < 0.55 ? 0 : tirage < 0.85 ? 1 : Math.min(2, categorie.prevus - 1);
    const presents = categorie.prevus - absents;
    const observation =
      absents === 0
        ? null
        : categorie.categorie === "Manœuvres"
          ? `${absents} absence(s) non justifiée(s) — signalement RH`
          : "Absence pour maladie — certificat attendu";
    return {
      categorie: categorie.categorie,
      prevus: categorie.prevus,
      presents,
      heures: arrondir(presents * categorie.heures, 1),
      observation,
    };
  });
}

function effectifTotal(gabarit: GabaritLot, jour: string): { present: number; prevu: number } {
  const lignes = effectifsDe(gabarit, jour);
  if (lignes) {
    return {
      present: lignes.reduce((total, ligne) => total + ligne.presents, 0),
      prevu: lignes.reduce((total, ligne) => total + ligne.prevus, 0),
    };
  }
  const absents = Math.floor(alea(gabarit.cle, jour, "decl") * 3);
  return { present: gabarit.effectifDeclare - absents, prevu: gabarit.effectifDeclare };
}

function incidentsDe(gabarit: GabaritLot, jour: string, rang: number): Incident[] {
  const tirage = alea(gabarit.cle, jour, "inc");
  const nombre = tirage < 0.68 ? 0 : tirage < 0.92 ? 1 : 2;
  return Array.from({ length: Math.min(nombre, gabarit.incidents.length) }, (_, indice) => ({
    ...gabarit.incidents[(Math.floor(alea(gabarit.cle, jour, "inc-rang") * gabarit.incidents.length) + indice) % gabarit.incidents.length],
    numero: `INC-${String(indice + 1).padStart(2, "0")}`,
    resolu: rang > 2 || alea(gabarit.cle, jour, "res", indice) < 0.4,
  }));
}

/** Les blocages sont mis en scène : ils sont rares, et chacun raconte quelque chose. */
function blocagesDe(gabarit: GabaritLot, rang: number): Blocage[] {
  if (gabarit.cle === "sif-l01" && (rang === 1 || rang === 4)) {
    return [
      {
        numero: "BLO-01",
        nature: "METEO",
        niveau: "SIGNIFICATIF",
        description: "Pluies de la nuit : plateforme détrempée, compactage impossible le matin.",
        impact: "Trois heures de compactage perdues.",
        escalade: "CT",
      },
    ];
  }
  if (gabarit.cle === "sie-l02" && rang === 2) {
    return [
      {
        numero: "BLO-01",
        nature: "APPROVISIONNEMENT",
        niveau: "BLOQUANT",
        description: "Rupture de profilés aluminium : la pose du mur rideau est à l'arrêt.",
        impact: "Pose arrêtée sur la façade nord jusqu'à réception du solde.",
        escalade: "CP",
      },
    ];
  }
  return [];
}

function photosDe(gabarit: GabaritLot, jour: string): Photo[] {
  const nombre = 2 + Math.floor(alea(gabarit.cle, jour, "ph") * 2);
  const heures = ["07:45", "11:20", "14:35", "16:45"];
  return Array.from({ length: nombre }, (_, indice) => ({
    legende: gabarit.photos[indice % gabarit.photos.length],
    heure: heures[indice],
    latitude: arrondir(gabarit.latitude + (alea(gabarit.cle, jour, "lat", indice) - 0.5) * 0.0004, 4),
    longitude: arrondir(gabarit.longitude + (alea(gabarit.cle, jour, "lon", indice) - 0.5) * 0.0004, 4),
    gpsConfirme: true,
  }));
}

function meteoDe(gabarit: GabaritLot, jour: string): ConditionsMeteo {
  const tirage = alea(gabarit.lot.projetId, jour, "meteo");
  const matin: Meteo = tirage < 0.15 ? "PLUVIEUX" : tirage < 0.25 ? "BRUMEUX" : tirage < 0.55 ? "NUAGEUX" : "ENSOLEILLE";
  const apresMidi: Meteo =
    tirage > 0.88 ? "ORAGEUX" : tirage < 0.15 ? "NUAGEUX" : tirage < 0.6 ? "ENSOLEILLE" : "NUAGEUX";
  const pluie = matin === "PLUVIEUX" || apresMidi === "ORAGEUX";
  return {
    matin,
    apresMidi,
    temperatureMin: 24 + Math.floor(alea(jour, "tmin") * 3),
    temperatureMax: 30 + Math.floor(alea(jour, "tmax") * 4),
    humidite: 68 + Math.floor(alea(jour, "hum") * 20),
    vent: choisir(["Faible, sud-ouest", "Modéré, sud-ouest", "Faible, sud"], jour, "vent"),
    conditions: pluie ? "DIFFICILES" : "FAVORABLES",
    prevision:
      alea(jourOuvreApres(jour), "meteo-demain") < 0.3
        ? "Risque de pluie en fin d'après-midi : prévoir la couverture des ouvrages avant 15h30."
        : null,
  };
}

function productionDe(gabarit: GabaritLot, jour: string, rang: number): LigneProduction[] | null {
  if (!gabarit.production) return null;
  return gabarit.production.map((ligne, indice) => {
    const quantiteJour = 4 + Math.floor(alea(gabarit.cle, jour, "prod", indice) * 12);
    return { ...ligne, quantiteJour, cumul: quantiteJour + (JOURS_HISTORIQUE - rang) * 9 };
  });
}

function construireEntree(gabarit: GabaritLot, jour: string, rang: number, jours: string[], relances: Record<string, string>): EntreeJournal {
  const situation = situationDe(gabarit.cle, rang);
  const id = identifiant(gabarit.cle, jour, situation);
  const { circuit, soumisLe } = circuitDe(gabarit, jour, rang, situation);
  const avancement = avancementLot(gabarit, rang);
  const avecDonnees = situation !== "NON_SOUMIS";
  const effectif = effectifTotal(gabarit, jour);

  let dernierRapportLe: string | null = null;
  if (situation === "NON_SOUMIS") {
    for (let precedent = rang + 1; precedent < jours.length; precedent += 1) {
      if (estDepose(situationDe(gabarit.cle, precedent))) {
        dernierRapportLe = jours[precedent];
        break;
      }
    }
  }

  return {
    id,
    reference: avecDonnees ? referenceRapport(gabarit, jour, rang) : null,
    date: jour,
    lot: gabarit.lot,
    situation,
    effectifPresent: avecDonnees ? effectif.present : null,
    effectifPrevu: avecDonnees ? effectif.prevu : null,
    avancementLot: avecDonnees ? avancement.reel : null,
    avancementTheorique: avancement.theorique,
    incidents: avecDonnees ? incidentsDe(gabarit, jour, rang).length : null,
    blocages: avecDonnees ? blocagesDe(gabarit, rang).length : null,
    photos: avecDonnees ? photosDe(gabarit, jour).length : null,
    soumisLe,
    dernierRapportLe,
    relanceLe: relances[id] ?? null,
    noteChefChantier: avecDonnees ? choisir(gabarit.notes, gabarit.cle, jour, "note") : null,
    circuit,
  };
}

function construireRapport(entree: EntreeJournal, gabarit: GabaritLot, rang: number): RapportJournalier {
  const { cumuls, stocks, livres, utilises } = series(gabarit);
  const jour = entree.date;

  const activites: LigneActivite[] = gabarit.activites.map((activite, indice) => ({
    libelle: activite.libelle,
    unite: activite.unite,
    quantitePrevue: activite.quantitePrevue,
    cumulVeille: cumuls[indice][rang + 1],
    quantiteJour: arrondir(cumuls[indice][rang] - cumuls[indice][rang + 1], 1),
    avancementTheorique: theoriqueActivite(activite, rang),
    observation: choisir(activite.observations, gabarit.cle, jour, "obs", indice),
  }));

  const materiaux: LigneMateriau[] = gabarit.materiaux.map((materiau, indice) => {
    const soir = stocks[indice][rang];
    const livre = livres[indice][rang];
    const utilise = utilises[indice][rang];
    // Le stock du matin est celui du soir précédent : la synthèse retombe
    // ainsi exactement sur la somme des consommations et des livraisons.
    return {
      designation: materiau.designation,
      unite: materiau.unite,
      stockDebut: soir - livre + utilise,
      livre,
      utilise,
      seuilAlerte: materiau.seuil,
    };
  });

  const nombreLivraisons = Math.floor(alea(gabarit.cle, jour, "liv") * 2.4);
  const heuresLivraison = ["09:15", "11:45", "14:20"];
  // Des livraisons distinctes : deux fois le même bon le même jour serait un doublon.
  const premiere = Math.floor(alea(gabarit.cle, jour, "liv-rang") * gabarit.livraisons.length);
  const livraisons: Livraison[] = Array.from({ length: Math.min(nombreLivraisons, gabarit.livraisons.length) }, (_, indice) => ({
    ...gabarit.livraisons[(premiere + indice) % gabarit.livraisons.length],
    heure: heuresLivraison[indice],
  }));

  return {
    ...entree,
    localisation: gabarit.localisation,
    intervenants: {
      chefChantier: gabarit.lot.chefChantier,
      conducteurTravaux: gabarit.conducteurTravaux,
      chefProjet: gabarit.chefProjet,
    },
    heureDebut: "07:30",
    heureFin: "17:00",
    meteo: meteoDe(gabarit, jour),
    effectifs: effectifsDe(gabarit, jour),
    production: productionDe(gabarit, jour, rang),
    activites,
    materiaux,
    livraisons,
    equipements: gabarit.equipements,
    listeIncidents: incidentsDe(gabarit, jour, rang),
    listeBlocages: blocagesDe(gabarit, rang),
    listePhotos: photosDe(gabarit, jour),
    previsions: gabarit.previsions,
  };
}

/* ------------------------------------------------------------------ *
 * La mémoire des relances.
 * ------------------------------------------------------------------ */

function lireRelances(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(CLE_RELANCES) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function ecrireRelances(relances: Record<string, string>): void {
  try {
    window.sessionStorage.setItem(CLE_RELANCES, JSON.stringify(relances));
  } catch {
    // Navigation privée saturée : la relance est oubliée, sans plus.
  }
}

function toutesLesEntrees(): { entree: EntreeJournal; gabarit: GabaritLot; rang: number }[] {
  const jours = joursCouverts();
  const relances = lireRelances();
  return jours.flatMap((jour, rang) =>
    GABARITS.map((gabarit) => ({
      entree: construireEntree(gabarit, jour, rang, jours, relances),
      gabarit,
      rang,
    })),
  );
}

/* ------------------------------------------------------------------ *
 * La synthèse : l'agrégation, plus ce que le CT y ajoute.
 * ------------------------------------------------------------------ */

function referenceSynthese(demande: DemandeSynthese, projetReference: string): string {
  const annee = demande.debut.slice(0, 4);
  const projet = projetReference.slice(-3);
  const suffixe =
    demande.type === "HEBDOMADAIRE"
      ? `S${numeroSemaine(demande.debut)}`
      : demande.type === "MENSUELLE"
        ? `M${demande.debut.slice(5, 7)}`
        : `P${demande.debut.slice(5, 7)}${demande.debut.slice(8, 10)}`;
  return `SYNT-${annee}-${projet}-${suffixe}`;
}

function appreciationDe(synthese: ReturnType<typeof agregerSynthese>, auteur: string, redigeeLe: string): Appreciation {
  const { progression, chiffres } = synthese;
  const ecart = progression.gain - progression.objectif;
  const lignes = [
    ecart >= 0
      ? `Période satisfaisante : gain de ${progression.gain} points pour un objectif de ${progression.objectif}.`
      : `Période en deçà de l'objectif : gain de ${progression.gain} points pour ${progression.objectif} attendus.`,
  ];
  for (const { lot, activites } of synthese.avancement) {
    const retard = activites.filter((activite) => activite.avancementFin - activite.avancementDebut < activite.objectifGain);
    if (retard.length) {
      lignes.push(`${lot.code} ${lot.nom} : ${retard.map((activite) => activite.libelle.toLowerCase()).join(", ")} sous l'objectif — rattrapage à organiser.`);
    }
  }
  const manquants = chiffres.rapportsAttendus - chiffres.rapportsRecus;
  if (manquants > 0) {
    lignes.push(`${manquants} rapport(s) non soumis sur la période : explication demandée aux chefs de chantier concernés.`);
  }
  if (chiffres.incidentsMajeurs > 0) {
    lignes.push(`${chiffres.incidentsMajeurs} incident(s) significatif(s) : suivi des actions correctives en réunion de chantier.`);
  }
  return { auteur, redigeeLe, texte: lignes.join(" ") };
}

function objectifsDe(synthese: ReturnType<typeof agregerSynthese>, gabarits: GabaritLot[]): ObjectifSuivant[] {
  return synthese.avancement.flatMap(({ lot, activites }) => {
    const enCours = activites.filter((activite) => activite.avancementFin < 100);
    const prioritaire = [...enCours].sort((a, b) => a.avancementFin - b.avancementFin)[0];
    if (!prioritaire) return [];
    const gain = Math.max(3, Math.round(prioritaire.objectifGain));
    const gabarit = gabarits.find((candidat) => candidat.lot.id === lot.id);
    return [
      {
        lotCode: lot.code,
        activite: prioritaire.libelle,
        objectif: `+${Math.round((prioritaire.quantitePrevue * gain) / 100)} ${prioritaire.unite}`,
        cible: Math.min(100, prioritaire.avancementFin + gain),
        prerequis: gabarit?.previsions[0]?.prerequis ?? "",
      },
    ];
  });
}

/* ------------------------------------------------------------------ *
 * Le contrat rejoué.
 * ------------------------------------------------------------------ */

export const simulationJournal = {
  /** Toutes les lignes des neuf dernières semaines, pour tous les chantiers. */
  async lireJournal(): Promise<Journal> {
    return attendre(
      {
        aujourdhui: aujourdhui(),
        luLe: new Date().toISOString(),
        entrees: toutesLesEntrees().map(({ entree }) => entree),
      },
      LATENCE_LECTURE,
    );
  },

  async lireRapport(id: string): Promise<RapportJournalier> {
    const trouve = toutesLesEntrees().find(({ entree }) => entree.id === id);
    if (!trouve || trouve.entree.situation === "NON_SOUMIS") {
      refuser("introuvable", "Ce rapport n'existe pas ou n'a pas encore été rédigé.", 404);
    }
    return attendre(construireRapport(trouve.entree, trouve.gabarit, trouve.rang), LATENCE_LECTURE);
  },

  /** Relance le chef de chantier (rapport absent) ou le signataire attendu. */
  async relancer(id: string): Promise<{ relanceLe: string }> {
    const relances = lireRelances();
    const relanceLe = new Date().toISOString();
    ecrireRelances({ ...relances, [id]: relanceLe });
    return attendre({ relanceLe }, LATENCE_ECRITURE);
  },

  async lireSynthese(demande: DemandeSynthese): Promise<SynthesePeriodique> {
    const gabarits = GABARITS.filter((gabarit) => gabarit.lot.projetId === demande.projetId);
    if (gabarits.length === 0) {
      refuser("introuvable", "Aucun rapport journalier n'existe pour ce chantier.", 404);
    }
    const lignes = toutesLesEntrees().filter(({ gabarit }) => gabarit.lot.projetId === demande.projetId);
    const rapports = lignes
      .filter(({ entree }) => entree.date >= demande.debut && entree.date <= demande.fin && estDepose(entree.situation))
      .map(({ entree, gabarit, rang }) => construireRapport(entree, gabarit, rang));
    const agregee = agregerSynthese(
      demande,
      gabarits.map((gabarit) => gabarit.lot),
      lignes.map(({ entree }) => entree),
      rapports,
    );

    const jour = aujourdhui();
    const close = periodeClose(demande, jour);
    const premier = gabarits[0];
    const genereLe = close ? horodatage(jourOuvreApres(demande.fin), "08:00") : new Date().toISOString();
    const signeCt = close ? horodatage(jourOuvreApres(demande.fin), "09:45") : null;
    const approuvee = close && ajouterJours(demande.fin, 7) < jour;

    const circuit: EtapeCircuit[] = [
      {
        role: "CT",
        signataire: premier.conducteurTravaux,
        etat: close ? "SIGNE" : "A_VENIR",
        signeLe: signeCt,
        echeance: null,
        commentaire: null,
      },
      {
        role: "CP",
        signataire: premier.chefProjet,
        etat: approuvee ? "SIGNE" : close ? "EN_ATTENTE" : "A_VENIR",
        signeLe: approuvee ? horodatage(jourOuvreApres(jourOuvreApres(demande.fin)), "11:00") : null,
        echeance: close && !approuvee ? horodatage(jourOuvreApres(demande.fin), "17:00") : null,
        commentaire: null,
      },
    ];

    return attendre(
      {
        ...agregee,
        reference: referenceSynthese(demande, premier.lot.projetReference),
        genereLe,
        localisation: premier.localisation,
        chefProjet: premier.chefProjet,
        conducteurTravaux: premier.conducteurTravaux,
        appreciation: close && signeCt ? appreciationDe(agregee, premier.conducteurTravaux, signeCt) : null,
        objectifs: close ? objectifsDe(agregee, gabarits) : [],
        circuit,
      },
      LATENCE_LECTURE,
    );
  },
};

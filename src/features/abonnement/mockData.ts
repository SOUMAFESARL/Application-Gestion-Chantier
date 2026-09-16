/**
 * Données mockées et types pour l'abonnement, le catalogue de forfaits BTP
 * et la simulation de paiement CinetPay / Mobile Money.
 */

export interface ForfaitBTP {
  code: "BATISSEUR" | "MAITRE_OEUVRE" | "PROMOTEUR";
  libelle: string;
  badge?: string;
  description: string;
  prixMensuelFcfa: number;
  prixAnnuelFcfa: number;
  limiteChantiers: number | null; // null = illimité
  limiteUtilisateurs: number | null; // null = illimité
  limiteStockageGo: number | null; // en Go
  accesIA: boolean;
  caracteristiques: string[];
  pointsForts: string[];
  couleurAccent?: string;
}

export const FORFAITS_BTP: ForfaitBTP[] = [
  {
    code: "BATISSEUR",
    libelle: "Bâtisseur",
    description: "Idéal pour les artisans, maîtres d'œuvre indépendants et petits chantiers.",
    prixMensuelFcfa: 29000,
    prixAnnuelFcfa: 290000,
    limiteChantiers: 5,
    limiteUtilisateurs: 5,
    limiteStockageGo: 5,
    accesIA: false,
    caracteristiques: [
      "Jusqu'à 5 chantiers actifs",
      "5 collaborateurs inclus",
      "5 Go de stockage sécurisé",
      "Journal de chantier quotidien",
      "Suivi météo connectée",
      "Suivi présences ouvriers",
      "Export PDF rapports de base",
      "Support standard par email (24h)",
    ],
    pointsForts: [
      "Mise en route immédiate",
      "Parfait pour démarrer la digitalisation",
    ],
  },
  {
    code: "MAITRE_OEUVRE",
    libelle: "Maître d'Œuvre",
    badge: "Le plus populaire",
    description: "Recommandé pour les PME du BTP, gestion multi-équipes et plusieurs chantiers en parallèle.",
    prixMensuelFcfa: 79000,
    prixAnnuelFcfa: 790000,
    limiteChantiers: 50,
    limiteUtilisateurs: 25,
    limiteStockageGo: 20,
    accesIA: true,
    caracteristiques: [
      "Jusqu'à 50 chantiers actifs",
      "25 collaborateurs inclus",
      "20 Go de stockage photos & plans",
      "Module IA d'assistance aux comptes-rendus",
      "Suivi d'avancement & photos géolocalisées",
      "Gestion budgétaire & bons de paiement",
      "Gestion des stocks & achats",
      "Alertes automatiques de quotas & dépassements",
      "Rapports QHSE et sécurité",
      "Support prioritaire sous 2h (WhatsApp & Téléphone)",
    ],
    pointsForts: [
      "Assistant IA inclus",
      "Gestion complète des chantiers et finances",
      "Idéal PME et entreprises en croissance",
    ],
    couleurAccent: "var(--color-primary-500, #D4652A)",
  },
  {
    code: "PROMOTEUR",
    libelle: "Promoteur",
    badge: "Grands comptes",
    description: "Conçu pour les promoteurs immobiliers, bureaux d'études et entreprises générales.",
    prixMensuelFcfa: 189000,
    prixAnnuelFcfa: 1890000,
    limiteChantiers: null, // illimité
    limiteUtilisateurs: null, // illimité
    limiteStockageGo: 100,
    accesIA: true,
    caracteristiques: [
      "Chantiers illimités",
      "Collaborateurs illimités",
      "100 Go de stockage cloud haute performance",
      "Assistant IA illimité (analyse risques, résumés auto)",
      "Multi-filiales & gestion consolidée",
      "Personnalisation marque blanche (logo, charte client)",
      "Rapprochement bancaire & exports comptables",
      "Intégrations API & webhooks",
      "Sauvegardes quotidiennes externalisées",
      "Chargé de compte dédié + Formation sur site",
    ],
    pointsForts: [
      "Aucune limite de projets ou d'utilisateurs",
      "Marque blanche et intégrations avancées",
      "Accompagnement VIP dédié",
    ],
  },
];

export type MoyenPaiementId = "ORANGE_MONEY" | "WAVE" | "MTN_MOMO" | "MOOV_MONEY" | "CARTE_BANCAIRE" | "VIREMENT";

export interface OptionPaiement {
  id: MoyenPaiementId;
  categorie: "MOBILE_MONEY" | "CARTE" | "VIREMENT";
  nom: string;
  description: string;
  badge?: string;
  iconeType: "orange" | "wave" | "mtn" | "moov" | "carte" | "virement";
  delai: string;
}

export const MOYENS_PAIEMENT: OptionPaiement[] = [
  {
    id: "WAVE",
    categorie: "MOBILE_MONEY",
    nom: "Wave",
    description: "Paiement direct sans frais par scan QR ou validation mobile",
    badge: "Instantané · 0% frais",
    iconeType: "wave",
    delai: "Activation immédiate",
  },
  {
    id: "ORANGE_MONEY",
    categorie: "MOBILE_MONEY",
    nom: "Orange Money",
    description: "Paiement sécurisé via votre compte Orange Money CI / SN / ML / BF",
    badge: "Populaire",
    iconeType: "orange",
    delai: "Activation immédiate",
  },
  {
    id: "MTN_MOMO",
    categorie: "MOBILE_MONEY",
    nom: "MTN MoMo",
    description: "Paiement rapide via MTN Mobile Money",
    iconeType: "mtn",
    delai: "Activation immédiate",
  },
  {
    id: "MOOV_MONEY",
    categorie: "MOBILE_MONEY",
    nom: "Moov Money",
    description: "Paiement via votre portefeuille Moov Money",
    iconeType: "moov",
    delai: "Activation immédiate",
  },
  {
    id: "CARTE_BANCAIRE",
    categorie: "CARTE",
    nom: "Carte Bancaire (Visa / Mastercard)",
    description: "Cartes nationales et internationales avec protocole 3D-Secure",
    badge: "Sécurisé SSL",
    iconeType: "carte",
    delai: "Activation immédiate",
  },
  {
    id: "VIREMENT",
    categorie: "VIREMENT",
    nom: "Virement Bancaire Entreprise",
    description: "Pour les entreprises émettant des bons de commande administratifs",
    iconeType: "virement",
    delai: "Activation sous 24h ouvrées",
  },
];

export interface TransactionPaiement {
  idTransaction: string;
  referenceFacture: string;
  datePaiement: string;
  forfait: ForfaitBTP;
  cycle: "MENSUEL" | "ANNUEL";
  montantFcfa: number;
  tvaFcfa: number;
  montantTotalFcfa: number;
  moyenPaiement: OptionPaiement;
  coordonneesPaiement: {
    telephone?: string;
    nomTitulaire?: string;
    derniersChiffresCarte?: string;
    nomEntreprise?: string;
  };
  statut: "SUCCES" | "EN_ATTENTE" | "ECHEC";
}

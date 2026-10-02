/**
 * La liste indicative des lots d'un marché de bâtiment, par corps d'état.
 *
 * Reprise de « liste INDICATIVE DES LOTS.xlsx » — espaces et coquilles
 * nettoyés, notes de rédaction retirées (« les clés pass », « 600 places ») :
 * un nom de lot ne porte pas le détail du CCTP. C'est la nomenclature que
 * les clients emploient déjà dans leurs DCE. Elle est **indicative** — le champ du nom de lot la
 * propose, il ne l'impose pas : un nom absent reste saisissable.
 *
 * De la donnée, pas du texte d'interface : comme `villes.ts`, ce fichier est
 * exempté de la règle i18n dans `eslint.config.mjs`.
 */

export interface FamilleLots {
  /** Le corps d'état, titre du groupe dans la liste. */
  famille: string;
  lots: readonly string[];
}

export const LOTS_INDICATIFS: readonly FamilleLots[] = [
  {
    famille: "Voiries et réseaux divers",
    lots: [
      "VRD1 Terrassements généraux, voirie, parkings, clôture",
      "VRD2 Drainage général, murs de soutènement, traitement des déchets",
      "VRD3 Assainissement eaux pluviales, eaux usées, eaux vannes, station d’épuration",
      "VRD4 Alimentation en eau potable, arrosage, bâches à eau (sanitaire et sécurité incendie)",
      "VRD5 Alimentation électricité, locaux transfo, groupes électrogènes, éclairage public",
      "VRD6 Alimentation télécommunications",
      "VRD7 Jardins, plantations d’arbres, d’arbustes et engazonnement",
      "VRD8 Mobilier urbain et signalétique extérieure",
      "VRD9 Terrains de sports",
    ],
  },
  {
    famille: "Lots architecturaux",
    lots: [
      "Fondations profondes",
      "Gros œuvre",
      "Étanchéité des toitures terrasses et autres",
      "Menuiserie intérieure en bois",
      "Menuiserie aluminium",
      "Vitrerie",
      "Menuiserie métallique",
      "Revêtements durs décoratifs",
      "Revêtements durs",
      "Revêtements souples",
      "Faux plafonds (staff, acoustique ou diffusant)",
      "Peinture",
      "Teintures, rideaux, stores",
      "Signalétique",
    ],
  },
  {
    famille: "Lots techniques",
    lots: [
      "Plomberie sanitaire, ventilation mécanique contrôlée",
      "Climatisation",
      "Électricité courant fort",
      "Distribution du courant régulé",
      "Détection, extinction, report d’alarmes techniques",
      "Sonorisation des salles de langue, conférence, projection",
      "Ascenseurs",
      "Portes coupe-feu",
      "Sécurité incendie",
      "Nacelle de nettoyage des façades",
      "Paratonnerre",
    ],
  },
  {
    famille: "Télécommunication et informatique",
    lots: ["Réseau informatique", "Téléphonie, interphonie", "Installation TV"],
  },
  {
    famille: "Sécurité d’accès",
    lots: [
      "Système de sécurité d’accès par lecteur biométrique, digicode",
      "Système de caméras de surveillance",
      "Anti-intrusion",
      "GTB/GTC",
    ],
  },
  {
    famille: "Décoration",
    lots: [
      "Décoration habillage muraux (salle de conférence, bibliothèque)",
      "Décoration mobilier salle de conférence (sièges)",
      "Décoration plafond salle de conférence",
      "Rideaux décoratifs salle de conférence",
    ],
  },
  {
    famille: "Mobilier",
    lots: [
      "MOB.1 Mobilier bureaux, académique",
      "MOB.2 Mobilier logement étudiants et enseignants, logements de fonction et astreintes",
      "MOB.3 Mobilier restauration et centre médical",
      "MOB.4 Mobilier urbain de jardin",
      "MOB.5 Mobilier bibliothèque",
    ],
  },
  {
    famille: "Équipements",
    lots: [
      "EQU.1 Équipements scientifiques de laboratoires spécialisés et ateliers",
      "EQU.2 Équipements de laboratoires de langue et multimédia",
      "EQU.3 Équipements de cuisine et vaissellerie",
      "EQU.4 Équipements informatiques pour l’administration",
      "EQU.5 Équipements de reprographie centrale et photocopie en bureaux",
      "EQU.6 Équipements didactiques divers (tableaux)",
      "EQU.7 Équipements sportifs",
      "EQU.8 Équipements médicaux",
      "EQU.9 Équipements téléenseignement, visioconférence",
    ],
  },
];

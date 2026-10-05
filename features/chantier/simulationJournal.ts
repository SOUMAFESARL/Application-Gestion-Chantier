/**
 * Le journal de chantier, rejoué — en attendant les routes.
 *
 * Même contrat que `features/projets/simulationEquipes.ts` : il parle le
 * domaine (les types de `types.ts`), les vrais appels restent à leur place
 * dans `adaptateur.ts`, et le jour où Django sert le journal,
 * `NEXT_PUBLIC_API_SIMULE` passe à `0` sans qu'aucun écran ne change. Pas de
 * bandeau : le propriétaire du produit l'a demandé (24/09/2026).
 *
 * Les chantiers sont les vrais, lus sur `/projets/` : un chantier en cours
 * attend un rapport chaque jour ouvré depuis son démarrage. Chacun de ces
 * jours est, par ordre de priorité :
 * - le rapport rédigé et soumis depuis `/rapports/saisie` (`simulationSaisie`),
 *   s'il existe — il vit dans le `localStorage` du poste et, faute d'écran de
 *   validation CT / CP, y reste « Soumis » ;
 * - sinon un **rapport de démonstration** (demande produit : le journal montre
 *   des données simulées jusqu'au branchement de l'API), bâti sur les vrais
 *   lots et activités du chantier, avec son circuit plus ou moins avancé ;
 * - sinon, certains jours, une absence — ce que le serveur saura seul.
 */

import { lireProjet, listerLots, listerProjets } from "@/features/projets/adaptateur";
import type { Activite, Lot, Projet, StatutProjet } from "@/features/projets/types";
import { texte } from "@/i18n/horsReact";
import { attendre, refuser } from "@/lib/api/simulation";
import { ABSENT } from "@/lib/format";

import {
  agregerSynthese,
  ajouterJours,
  estDepose,
  jourDe,
  jourOuvreAvant,
  joursOuvres,
  joursSaisissables,
  numeroSemaine,
  periodeClose,
} from "./regles";
import { rapportSaisi, rapportsSaisis } from "./simulationSaisie";
import type {
  Blocage,
  ChantierJournal,
  ConditionsMeteo,
  DemandeSynthese,
  EntreeJournal,
  EtapeCircuit,
  Incident,
  Journal,
  LigneActivite,
  LigneEffectif,
  LigneEquipement,
  LigneProduction,
  LotJournal,
  Meteo,
  RapportJournalier,
  SituationRapport,
  SynthesePeriodique,
  TravauxLot,
} from "./types";

const CLE_RELANCES = "ccd.simulation.journal.relances";
const LATENCE_LECTURE = 350;
const LATENCE_ECRITURE = 450;
/** Neuf semaines : le mois précédent se synthétise en entier. */
const JOURS_HISTORIQUE = 45;
/** Un chantier attend un rapport tant qu'il est ouvert ; en attente, suspendu ou clos, plus rien. */
const STATUTS_ATTENDUS: readonly StatutProjet[] = ["EN_COURS", "EN_RETARD", "CRITIQUE"];

/* ------------------------------------------------------------------ *
 * Les lectures réelles, gardées en mémoire.
 *
 * Le journal est simulé, mais il se construit sur les vrais chantiers : une
 * lecture de `/projets/`, puis les lots de chacun, puis les activités de
 * chaque lot. Refaite à chaque écran (journal, situation du jour, file de
 * validation, rapport, synthèse), c'était des dizaines d'appels à Django pour
 * une page « sans base de données ». On les garde le temps du `staleTime` de
 * React Query (`app/providers.tsx`) : un lot ajouté apparaît au plus 30 s
 * plus tard, comme partout ailleurs.
 *
 * Pas de `signal` : la promesse est partagée, et l'écran qu'on quitte ne doit
 * pas annuler la lecture que le suivant attend. Un échec n'est pas retenu.
 * ------------------------------------------------------------------ */

const DUREE_MEMOIRE_MS = 30_000;
const memoire = new Map<string, { expireLe: number; promesse: Promise<unknown> }>();

function memorise<T>(cle: string, lire: () => Promise<T>): Promise<T> {
  const present = memoire.get(cle);
  if (present && present.expireLe > Date.now()) return present.promesse as Promise<T>;
  const promesse = lire();
  memoire.set(cle, { expireLe: Date.now() + DUREE_MEMOIRE_MS, promesse });
  promesse.catch(() => {
    if (memoire.get(cle)?.promesse === promesse) memoire.delete(cle);
  });
  return promesse;
}

const projetsMemorises = () => memorise("projets", () => listerProjets());
const lotsMemorises = (projetId: string) => memorise(`lots:${projetId}`, () => listerLots(projetId));

/* ------------------------------------------------------------------ *
 * Le temps.
 * ------------------------------------------------------------------ */

function aujourdhui(): string {
  return jourDe(new Date());
}

function horodatage(jour: string, heure: string): string {
  return new Date(`${jour}T${heure}:00`).toISOString();
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

/* ------------------------------------------------------------------ *
 * Les chantiers et les rapports attendus.
 * ------------------------------------------------------------------ */

function nomComplet(intervenant: { nomComplet: string } | null | undefined): string {
  return intervenant?.nomComplet || ABSENT;
}

function chantierDe(projet: Projet): ChantierJournal {
  return {
    projetId: projet.id,
    projetNom: projet.nom,
    projetReference: projet.reference,
    chefChantier: nomComplet(projet.chefsChantier[0]?.intervenant),
  };
}

/**
 * Les jours où le chantier attend un rapport, dans la fenêtre du journal.
 * Sans date de démarrage, comme à la saisie (`rapportsEnAttente`) : les
 * jours encore rédigeables seulement.
 */
function joursAttendus(projet: Projet, jour: string): string[] {
  if (!STATUTS_ATTENDUS.includes(projet.statut)) return [];
  const demarrage = projet.dateDebutReelle ?? projet.dateDebutPrevue;
  const premier = demarrage && demarrage <= jour ? demarrage : (joursSaisissables(jour).at(-1) ?? jour);
  const fenetre = jourOuvreAvant(jour, JOURS_HISTORIQUE - 1);
  return joursOuvres(premier > fenetre ? premier : fenetre, jour);
}

/** La ligne d'un rapport attendu et pas soumis — jamais commencé, ou resté en brouillon. */
function absence(
  projet: Projet,
  date: string,
  deposes: RapportJournalier[],
  relances: Record<string, string>,
): EntreeJournal {
  const id = `abs-${projet.id}-${date}`;
  const chantier = chantierDe(projet);
  const precedent = deposes
    .filter((rapport) => rapport.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const circuit: EtapeCircuit[] = [
    {
      role: "CC",
      signataire: chantier.chefChantier,
      etat: "EN_ATTENTE",
      signeLe: null,
      echeance: horodatage(date, "17:30"),
      commentaire: null,
    },
    {
      role: "CT",
      signataire: nomComplet(projet.conducteursTravaux[0]),
      etat: "A_VENIR",
      signeLe: null,
      echeance: null,
      commentaire: null,
    },
    { role: "CP", signataire: nomComplet(projet.chefProjet), etat: "A_VENIR", signeLe: null, echeance: null, commentaire: null },
  ];
  return {
    id,
    reference: null,
    date,
    chantier,
    lots: [],
    situation: "NON_SOUMIS",
    effectifPresent: null,
    effectifPrevu: null,
    avancement: null,
    avancementTheorique: null,
    incidents: null,
    blocages: null,
    photos: null,
    soumisLe: null,
    dernierRapportLe: precedent?.date ?? null,
    relanceLe: relances[id] ?? null,
    noteChefChantier: null,
    circuit,
  };
}

/* ------------------------------------------------------------------ *
 * Les rapports de démonstration.
 *
 * En attendant les routes, le journal ne reste pas vide : chaque jour
 * attendu d'un vrai chantier en cours que le formulaire n'a pas couvert
 * reçoit un rapport rejoué — sur les vrais lots et les vraies activités du
 * chantier, tiré d'une graine (chantier × jour) pour rester identique d'une
 * lecture à l'autre. Un rapport saisi au formulaire remplace toujours celui
 * de démonstration du même jour.
 * ------------------------------------------------------------------ */

const PREFIXE_DEMO = "demo";

function hacher(graine: string): number {
  let empreinte = 2_166_136_261;
  for (let rang = 0; rang < graine.length; rang += 1) {
    empreinte ^= graine.charCodeAt(rang);
    empreinte = Math.imul(empreinte, 16_777_619);
  }
  return empreinte >>> 0;
}

/** Un tirage dans [0, 1[, toujours le même pour la même graine. */
function alea(...graine: (string | number)[]): number {
  return hacher(graine.join("|")) / 4_294_967_296;
}

function choisir<T>(liste: readonly T[], ...graine: (string | number)[]): T {
  return liste[Math.floor(alea(...graine) * liste.length)];
}

function entre(minimum: number, maximum: number, ...graine: (string | number)[]): number {
  return minimum + Math.floor(alea(...graine) * (maximum - minimum + 1));
}

function arrondir(valeur: number, decimales = 0): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

function borner(valeur: number): number {
  return Math.min(100, Math.max(0, valeur));
}

const CATEGORIES_EFFECTIF = [
  { categorie: "Chef d'équipe", prevus: 2 },
  { categorie: "Maçons", prevus: 8 },
  { categorie: "Ferrailleurs", prevus: 4 },
  { categorie: "Coffreurs", prevus: 4 },
  { categorie: "Manœuvres", prevus: 10 },
] as const;

const TACHERONS = ["Équipe Koné", "Équipe Traoré", "Équipe Yao", "Équipe Ouattara"] as const;
const OPERATEURS = ["Konan A.", "Diallo M.", "Bamba S."] as const;

const MATERIAUX = [
  { designation: "Ciment CPJ 42.5", unite: "sac", stock: 420, seuil: 80, conso: [15, 45] },
  { designation: "Sable lagunaire", unite: "m³", stock: 60, seuil: 10, conso: [2, 6] },
  { designation: "Gravier 5/15", unite: "m³", stock: 48, seuil: 8, conso: [2, 5] },
  { designation: "Fer HA 12", unite: "barre", stock: 300, seuil: 50, conso: [10, 30] },
] as const;

const EQUIPEMENTS: readonly Pick<LigneEquipement, "designation" | "reference" | "propriete" | "utilisation">[] = [
  { designation: "Bétonnière 350 L", reference: "BET-01", propriete: "ENTREPRISE", utilisation: "8 h" },
  { designation: "Vibreur à aiguille", reference: "VIB-02", propriete: "ENTREPRISE", utilisation: "5 h" },
  { designation: "Camion-grue 20 t", reference: "LOC-117", propriete: "LOCATION", utilisation: "3 h" },
];

const FOURNISSEURS = ["CIMAF", "Sotaci", "Carrière de Bingerville", "Quincaillerie du Plateau"] as const;

const NOTES = [
  "Bonne cadence aujourd'hui, l'équipe a tenu les objectifs.",
  "Retard d'une heure à l'ouverture : livraison de ciment arrivée à 9 h.",
  "Pluie en fin d'après-midi, travaux extérieurs arrêtés à 16 h.",
  "RAS. Le planning du lendemain est confirmé avec le conducteur de travaux.",
  "Deux manœuvres absents, compensés par l'équipe de coffrage.",
] as const;

const INCIDENTS: readonly Omit<Incident, "numero" | "resolu">[] = [
  {
    type: "SECURITE",
    description: "Ouvrier sans casque sur la zone de levage.",
    gravite: "MINEUR",
    decidePar: "CC",
    action: "Rappel des consignes EPI au quart d'heure sécurité.",
  },
  {
    type: "QUALITE",
    description: "Nid de cailloux constaté au décoffrage d'un poteau.",
    gravite: "SIGNIFICATIF",
    decidePar: "CT",
    action: "Ragréage au mortier de réparation, contrôle visuel du lot.",
  },
  {
    type: "MATERIEL",
    description: "Panne de la bétonnière en milieu de matinée.",
    gravite: "SIGNIFICATIF",
    decidePar: "CC",
    action: "Location d'une bétonnière de remplacement.",
  },
];

const BLOCAGES: readonly Omit<Blocage, "numero">[] = [
  {
    nature: "APPROVISIONNEMENT",
    niveau: "SIGNIFICATIF",
    description: "Rupture de fer HA 12 chez le fournisseur.",
    impact: "Ferraillage des longrines décalé d'un jour.",
    escalade: "CT",
  },
  {
    nature: "METEO",
    niveau: "MINEUR",
    description: "Sol détrempé après l'averse de la nuit.",
    impact: "Terrassement repris l'après-midi.",
    escalade: null,
  },
];

const MOTIF_REJET = "Les quantités du jour ne concordent pas avec le métré : merci de reprendre l'avancement.";

const METEOS: readonly Meteo[] = ["ENSOLEILLE", "ENSOLEILLE", "NUAGEUX", "NUAGEUX", "PLUVIEUX", "ORAGEUX"];

/**
 * La situation d'un jour, `rang` jours ouvrés avant aujourd'hui : plus il est
 * ancien, plus son circuit est avancé — et quelques absences, quelques rejets,
 * pour que chaque état se voie.
 *
 * Le jour même n'est jamais soumis par la démonstration : le chef de chantier
 * de test doit toujours trouver son rapport du jour à rédiger. Seul le
 * formulaire le remet.
 */
function situationDemo(projetId: string, date: string, rang: number): SituationRapport {
  if (rang === 0) return "NON_SOUMIS";
  const tirage = alea(projetId, date, "situation");
  if (rang === 1) {
    if (tirage < 0.08) return "NON_SOUMIS";
    if (tirage < 0.18) return "REJETE";
    return tirage < 0.7 ? "SOUMIS" : "VALIDE_CT";
  }
  if (rang <= 3) {
    if (tirage < 0.06) return "NON_SOUMIS";
    if (tirage < 0.12) return "REJETE";
    if (tirage < 0.35) return "SOUMIS";
    return tirage < 0.75 ? "VALIDE_CT" : "APPROUVE_CP";
  }
  return tirage < 0.05 ? "NON_SOUMIS" : "APPROUVE_CP";
}

function idDemo(projetId: string, date: string): string {
  return `${PREFIXE_DEMO}-${projetId}-${date}`;
}

/** `demo-<id du projet>-AAAA-MM-JJ` : la date en fait les dix derniers caractères. */
function lireIdDemo(id: string): { projetId: string; date: string } | null {
  if (!id.startsWith(`${PREFIXE_DEMO}-`) || id.length < PREFIXE_DEMO.length + 13) return null;
  return { projetId: id.slice(PREFIXE_DEMO.length + 1, -11), date: id.slice(-10) };
}

/**
 * Les lots fictifs d'un chantier qui n'en a pas encore — un projet tout juste
 * créé n'a ni lots ni activités, et ses rapports resteraient vides.
 */
const LOTS_FICTIFS: readonly {
  nom: string;
  modeExecution: Lot["modeExecution"];
  activites: readonly { libelle: string; quantitePrevue: number; unite: NonNullable<Activite["unite"]> }[];
}[] = [
  {
    nom: "Terrassements et fondations",
    modeExecution: "REGIE_DIRECTE",
    activites: [
      { libelle: "Fouilles en rigole", quantitePrevue: 180, unite: "M3" },
      { libelle: "Béton de propreté", quantitePrevue: 24, unite: "M3" },
      { libelle: "Semelles filantes en béton armé", quantitePrevue: 62, unite: "M3" },
    ],
  },
  {
    nom: "Gros œuvre",
    modeExecution: "REGIE_DIRECTE",
    activites: [
      { libelle: "Élévation des murs en agglos de 15", quantitePrevue: 860, unite: "M2" },
      { libelle: "Poteaux et poutres en béton armé", quantitePrevue: 48, unite: "M3" },
      { libelle: "Dalle pleine du plancher haut", quantitePrevue: 320, unite: "M2" },
    ],
  },
  {
    nom: "Enduits et revêtements",
    modeExecution: "SOUS_TRAITANCE_INFORMELLE",
    activites: [
      { libelle: "Enduit intérieur au mortier de ciment", quantitePrevue: 1_450, unite: "M2" },
      { libelle: "Carrelage des sols", quantitePrevue: 540, unite: "M2" },
    ],
  },
  {
    nom: "Électricité et plomberie",
    modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
    activites: [
      { libelle: "Saignées et fourreaux", quantitePrevue: 620, unite: "ML" },
      { libelle: "Réseau d'eau froide en PPR", quantitePrevue: 210, unite: "ML" },
    ],
  },
];

function lotsFictifs(projet: Projet): Lot[] {
  return LOTS_FICTIFS.map((gabarit, rangLot) => {
    const code = String(rangLot + 1).padStart(2, "0");
    const lotId = `${PREFIXE_DEMO}-lot-${projet.id}-${code}`;
    return {
      id: lotId,
      projetId: projet.id,
      code,
      nom: gabarit.nom,
      modeExecution: gabarit.modeExecution,
      typeBordereau: "PRIX_UNITAIRE",
      budget: null,
      dateDebut: null,
      dateFin: null,
      statut: "EN_COURS",
      activites: gabarit.activites.map((activite, rangActivite) => ({
        id: `${lotId}-${rangActivite + 1}`,
        lotId,
        code: `${code}.${String(rangActivite + 1).padStart(2, "0")}`,
        libelle: activite.libelle,
        quantitePrevue: activite.quantitePrevue,
        unite: activite.unite,
        dateDebutPrevue: null,
        dateFinPrevue: null,
        avancement: 0,
        surCheminCritique: false,
        dependanceId: null,
        responsableId: null,
        equipe: null,
        statut: "EN_COURS",
      })),
    };
  });
}

/** Les intervenants nommés : ceux du chantier, sinon des noms fictifs. */
function intervenantsDemo(projet: Projet): { chefChantier: string; conducteurTravaux: string; chefProjet: string } {
  const repli = (nom: string, fictif: string) => (nom === ABSENT ? fictif : nom);
  return {
    chefChantier: repli(chantierDe(projet).chefChantier, "Jean Kouassi"),
    conducteurTravaux: repli(nomComplet(projet.conducteursTravaux[0]), "Issa Bamba"),
    chefProjet: repli(nomComplet(projet.chefProjet), "Aya Koffi"),
  };
}

/** L'avancement d'aujourd'hui : celui du chantier, ou un fictif s'il n'a pas commencé. */
function avancementsDemo(projet: Projet): { reel: number; theorique: number } {
  if (projet.avancementReel > 0) return { reel: projet.avancementReel, theorique: projet.avancementTheorique };
  const reel = entre(25, 55, projet.id, "avancement");
  return { reel, theorique: reel + entre(-4, 9, projet.id, "theorique") };
}

function jourOuvreApres(jour: string): string {
  let suivant = ajouterJours(jour, 1);
  while (joursOuvres(suivant, suivant).length === 0) suivant = ajouterJours(suivant, 1);
  return suivant;
}

function libelleUnite(unite: Activite["unite"]): string {
  return unite ? texte(`projets.lotsActivites.unites.${unite}`) : texte("journal.saisie.avancement.unitePourcent");
}

function versLotJournal(projet: Projet, lot: Lot): LotJournal {
  return {
    id: lot.id,
    code: `L-${lot.code}`,
    nom: lot.nom,
    modeExecution: lot.modeExecution,
    projetId: projet.id,
    projetNom: projet.nom,
    projetReference: projet.reference,
    chefChantier: intervenantsDemo(projet).chefChantier,
  };
}

/** Les lots travaillés ce jour : un à trois, tirés parmi ceux du chantier. */
function lotsTravailles(projet: Projet, lots: Lot[], date: string): Lot[] {
  if (lots.length === 0) return [];
  const melanges = [...lots].sort((a, b) => alea(projet.id, date, a.id) - alea(projet.id, date, b.id));
  return melanges
    .slice(0, Math.min(lots.length, entre(1, 3, projet.id, date, "lots")))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** L'avancement au soir d'un jour : celui d'aujourd'hui, reculé d'un pas par jour ouvré. */
function avancementAu(reference: number, rang: number, pas: number): number {
  return arrondir(borner(reference - rang * pas), 1);
}

function travauxDemo(projet: Projet, lots: Lot[], date: string, rang: number): TravauxLot[] {
  return lots.map((lot) => {
    const reference = avancementsDemo(projet);
    const avancement = avancementAu(reference.reel + entre(-8, 8, lot.id), rang, 0.6);
    const avancementTheorique = avancementAu(reference.theorique + entre(-5, 5, lot.id), rang, 0.6);
    return {
      lot: versLotJournal(projet, lot),
      avancement,
      avancementTheorique,
      observation: alea(lot.id, date, "observation") < 0.3 ? "Travaux conformes au planning de la semaine." : null,
      activites: lot.activites.slice(0, 4).map((activite): LigneActivite => {
        const prevue = activite.quantitePrevue ?? 100;
        const part = borner(avancement + entre(-10, 10, activite.id)) / 100;
        const duJour = arrondir(prevue * (0.005 + alea(activite.id, date) * 0.02), 1);
        return {
          libelle: activite.libelle,
          unite: libelleUnite(activite.unite),
          quantitePrevue: prevue,
          cumulVeille: arrondir(Math.max(0, prevue * part - duJour), 1),
          quantiteJour: duJour,
          avancementTheorique: arrondir(borner(avancementTheorique + entre(-10, 10, activite.id, "theorique")), 1),
          observation: null,
        };
      }),
    };
  });
}

function effectifsDemo(projetId: string, date: string): LigneEffectif[] {
  return CATEGORIES_EFFECTIF.map(({ categorie, prevus }) => {
    const absents = alea(projetId, date, categorie) < 0.35 ? entre(1, 2, projetId, date, categorie, "absents") : 0;
    const presents = Math.max(0, prevus - absents);
    return {
      categorie,
      prevus,
      presents,
      heures: presents * 8,
      observation: absents > 0 ? "Absences non justifiées" : null,
    };
  });
}

function productionDemo(projet: Projet, lots: Lot[], date: string, rang: number): LigneProduction[] {
  return lots
    .filter((lot) => lot.modeExecution === "SOUS_TRAITANCE_INFORMELLE")
    .flatMap((lot) => lot.activites.slice(0, 2))
    .map((activite) => {
      const quantiteJour = entre(3, 15, activite.id, date);
      return {
        intervenant: choisir(TACHERONS, activite.id),
        activite: activite.libelle,
        unite: libelleUnite(activite.unite),
        prixUnitaire: entre(15, 60, activite.id, "prix") * 100_000,
        quantiteJour,
        cumul: quantiteJour * Math.max(1, 10 + entre(5, 30, projet.id) - rang),
      };
    });
}

function meteoDemo(projetId: string, date: string): ConditionsMeteo {
  const matin = choisir(METEOS, projetId, date, "matin");
  const apresMidi = choisir(METEOS, projetId, date, "apresMidi");
  const pluie = [matin, apresMidi].some((meteo) => meteo === "PLUVIEUX" || meteo === "ORAGEUX");
  return {
    matin,
    apresMidi,
    temperatureMin: entre(23, 26, projetId, date, "min"),
    temperatureMax: entre(29, 34, projetId, date, "max"),
    humidite: entre(65, 92, projetId, date, "humidite"),
    vent: `${entre(5, 20, projetId, date, "vent")} km/h SO`,
    conditions: apresMidi === "ORAGEUX" ? "DIFFICILES" : "FAVORABLES",
    prevision: pluie ? "Averses attendues demain matin : bétonnage décalé à l'après-midi." : null,
  };
}

function circuitDemo(projet: Projet, date: string, situation: SituationRapport, soumisLe: string): EtapeCircuit[] {
  const lendemain = jourOuvreApres(date);
  const { chefChantier, conducteurTravaux: conducteur, chefProjet } = intervenantsDemo(projet);
  const ct: EtapeCircuit =
    situation === "SOUMIS"
      ? {
          role: "CT",
          signataire: conducteur,
          etat: "EN_ATTENTE",
          signeLe: null,
          echeance: new Date(Date.parse(soumisLe) + 24 * 3_600_000).toISOString(),
          commentaire: null,
        }
      : situation === "REJETE"
        ? { role: "CT", signataire: conducteur, etat: "REJETE", signeLe: horodatage(lendemain, "08:40"), echeance: null, commentaire: MOTIF_REJET }
        : { role: "CT", signataire: conducteur, etat: "SIGNE", signeLe: horodatage(lendemain, "09:15"), echeance: null, commentaire: null };
  const cp: EtapeCircuit =
    situation === "APPROUVE_CP"
      ? { role: "CP", signataire: chefProjet, etat: "SIGNE", signeLe: horodatage(lendemain, "15:30"), echeance: null, commentaire: null }
      : situation === "VALIDE_CT"
        ? {
            role: "CP",
            signataire: chefProjet,
            etat: "EN_ATTENTE",
            signeLe: null,
            echeance: horodatage(jourOuvreApres(lendemain), "17:00"),
            commentaire: null,
          }
        : { role: "CP", signataire: chefProjet, etat: "A_VENIR", signeLe: null, echeance: null, commentaire: null };
  return [
    {
      role: "CC",
      signataire: chefChantier,
      etat: situation === "REJETE" ? "EN_ATTENTE" : "SIGNE",
      signeLe: soumisLe,
      echeance: null,
      commentaire: null,
    },
    ct,
    cp,
  ];
}

/** L'heure de dépôt : en fin de journée, jamais dans le futur. */
function soumisLeDemo(projetId: string, date: string): string {
  const instant = horodatage(date, `17:${String(entre(5, 55, projetId, date, "depot")).padStart(2, "0")}`);
  return Date.parse(instant) < Date.now()
    ? instant
    : new Date(Date.now() - entre(10, 90, projetId, date, "depot") * 60_000).toISOString();
}

/** Le rapport complet d'un jour de démonstration. */
function rapportDemo(
  projet: Projet,
  lots: Lot[],
  date: string,
  rang: number,
  numero: number,
  situation: Exclude<SituationRapport, "NON_SOUMIS">,
): RapportJournalier {
  const intervenants = intervenantsDemo(projet);
  const chantier = { ...chantierDe(projet), chefChantier: intervenants.chefChantier };
  const avancements = avancementsDemo(projet);
  const travailles = lotsTravailles(projet, lots, date);
  const avecEffectifs = travailles.length === 0 || travailles.some((lot) => lot.modeExecution === "REGIE_DIRECTE");
  const effectifs = avecEffectifs ? effectifsDemo(projet.id, date) : null;
  const production = productionDemo(projet, travailles, date, rang);
  const travaux = travauxDemo(projet, travailles, date, rang);
  const incidents = alea(projet.id, date, "incident") < 0.18 ? [choisir(INCIDENTS, projet.id, date, "lequel")] : [];
  const blocages = alea(projet.id, date, "blocage") < 0.12 ? [choisir(BLOCAGES, projet.id, date, "lequel")] : [];
  const nombrePhotos = entre(0, 4, projet.id, date, "photos");
  const soumisLe = soumisLeDemo(projet.id, date);
  const livraison = alea(projet.id, date, "livraison") < 0.4;

  return {
    id: idDemo(projet.id, date),
    reference: `RAP-${date.slice(0, 4)}-${projet.reference.slice(-3)}-${String(numero).padStart(3, "0")}`,
    date,
    chantier,
    lots: travaux.map((ligne) => ligne.lot),
    situation,
    effectifPresent: effectifs?.reduce((total, ligne) => total + ligne.presents, 0) ?? null,
    effectifPrevu: effectifs?.reduce((total, ligne) => total + ligne.prevus, 0) ?? null,
    avancement: avancementAu(avancements.reel, rang, 0.4),
    avancementTheorique: avancementAu(avancements.theorique, rang, 0.4),
    incidents: incidents.length,
    blocages: blocages.length,
    photos: nombrePhotos,
    soumisLe,
    dernierRapportLe: null,
    relanceLe: null,
    noteChefChantier: alea(projet.id, date, "note") < 0.6 ? choisir(NOTES, projet.id, date, "laquelle") : null,
    circuit: circuitDemo(projet, date, situation, soumisLe),
    localisation: [projet.quartier, projet.ville].filter(Boolean).join(", ") || ABSENT,
    intervenants,
    heureDebut: "07:30",
    heureFin: "17:00",
    meteo: meteoDemo(projet.id, date),
    effectifs,
    production: production.length > 0 ? production : null,
    travaux,
    materiaux: MATERIAUX.map((materiau) => ({
      designation: materiau.designation,
      unite: materiau.unite,
      stockDebut: Math.max(materiau.seuil - 5, materiau.stock - rang * 3 - entre(0, 40, projet.id, materiau.designation)),
      livre: livraison && materiau === MATERIAUX[0] ? 200 : 0,
      utilise: entre(materiau.conso[0], materiau.conso[1], projet.id, date, materiau.designation),
      seuilAlerte: materiau.seuil,
    })),
    livraisons: livraison
      ? [
          {
            fournisseur: choisir(FOURNISSEURS, projet.id, date, "fournisseur"),
            designation: MATERIAUX[0].designation,
            quantite: "200 sacs",
            bonLivraison: `BL-${entre(10_000, 99_999, projet.id, date, "bon")}`,
            heure: "09:10",
            conformite: alea(projet.id, date, "conformite") < 0.85 ? "CONFORME" : "PARTIELLE",
            observation: null,
          },
        ]
      : [],
    equipements: EQUIPEMENTS.slice(0, entre(1, EQUIPEMENTS.length, projet.id, "equipements")).map(
      (equipement, rangEquipement) => ({
        ...equipement,
        operateur: choisir(OPERATEURS, projet.id, rangEquipement),
        etat: incidents[0]?.type === "MATERIEL" && rangEquipement === 0 ? "PANNE" : "BON",
        observation: null,
      }),
    ),
    listeIncidents: incidents.map((incident, rangIncident) => ({
      ...incident,
      numero: `INC-${String(rangIncident + 1).padStart(2, "0")}`,
      resolu: rang > 0,
    })),
    listeBlocages: blocages.map((blocage, rangBlocage) => ({
      ...blocage,
      numero: `BLQ-${String(rangBlocage + 1).padStart(2, "0")}`,
    })),
    listePhotos: Array.from({ length: nombrePhotos }, (_, rangPhoto) => ({
      url: null,
      legende: travaux[rangPhoto % Math.max(1, travaux.length)]?.lot.nom ?? chantier.projetNom,
      heure: `${String(9 + rangPhoto * 2).padStart(2, "0")}:${String(entre(0, 59, projet.id, date, rangPhoto)).padStart(2, "0")}`,
      latitude: 5.36 + alea(projet.id, "latitude") * 0.05,
      longitude: -4.01 + alea(projet.id, "longitude") * 0.05,
      gpsConfirme: true,
    })),
    // Les rapports de démonstration ne joignent aucun document : seuls ceux du formulaire en portent.
    documents: [],
    previsions: travailles.slice(0, 2).map((lot) => ({
      activite: lot.activites[0]?.libelle ?? lot.nom,
      equipe: choisir(TACHERONS, lot.id, "equipe"),
      objectif: "Poursuite selon le planning",
      prerequis: "Matériaux disponibles sur site",
    })),
  };
}

/** Tout chantier ni clos ni archivé a son historique de démonstration — même pas encore démarré. */
const STATUTS_DEMO: readonly StatutProjet[] = ["EN_ATTENTE", "EN_COURS", "EN_RETARD", "CRITIQUE", "SUSPENDU"];
/** Quatre semaines de rapports de démonstration. */
const JOURS_DEMO = 20;

/**
 * Les jours couverts par la démonstration : ceux depuis le démarrage s'il est
 * passé, sinon les quatre dernières semaines — un projet tout juste créé
 * montre lui aussi un historique.
 */
function joursDemo(projet: Projet, jour: string): string[] {
  if (!STATUTS_DEMO.includes(projet.statut)) return [];
  const fenetre = jourOuvreAvant(jour, JOURS_DEMO - 1);
  const demarrage = projet.dateDebutReelle ?? projet.dateDebutPrevue;
  const premier = demarrage && demarrage > fenetre && demarrage <= jourOuvreAvant(jour, 4) ? demarrage : fenetre;
  return joursOuvres(premier, jour);
}

/** Les rapports de démonstration d'un chantier, sur ses jours que le formulaire n'a pas couverts. */
function rapportsDemo(projet: Projet, lots: Lot[], jour: string, remis: Set<string>): RapportJournalier[] {
  const jours = joursDemo(projet, jour);
  return jours.flatMap((date, index) => {
    if (remis.has(date)) return [];
    const rang = jours.length - 1 - index;
    const situation = situationDemo(projet.id, date, rang);
    return situation === "NON_SOUMIS" ? [] : [rapportDemo(projet, lots, date, rang, index + 1, situation)];
  });
}

/** Les lots de chaque chantier en cours — une lecture par chantier, un échec n'en prive que lui. */
async function lotsDesProjets(projets: Projet[]): Promise<Map<string, Lot[]>> {
  const lus = await Promise.all(
    projets
      .filter((projet) => STATUTS_DEMO.includes(projet.statut))
      .map(async (projet) => {
        const lots = await lotsMemorises(projet.id).catch((): Lot[] => []);
        return [projet.id, lots.length > 0 ? lots : lotsFictifs(projet)] as const;
      }),
  );
  return new Map(lus);
}

/** Un rapport de démonstration relu par son identifiant — `null` si ce n'en est pas un. */
async function rapportDemoLu(id: string): Promise<RapportJournalier | null> {
  const cible = lireIdDemo(id);
  if (!cible) return null;
  const projet =
    (await projetsMemorises().catch((): Projet[] => [])).find((candidat) => candidat.id === cible.projetId) ??
    (await lireProjet(cible.projetId).catch(() => null));
  if (!projet) return null;
  const lots = (await lotsDesProjets([projet])).get(projet.id) ?? [];
  const remis = new Set(
    rapportsSaisis()
      .filter((rapport) => rapport.chantier.projetId === projet.id)
      .map((rapport) => rapport.date),
  );
  return rapportsDemo(projet, lots, aujourdhui(), remis).find((rapport) => rapport.id === id) ?? null;
}

/**
 * Les rapports soumis du formulaire, ceux de démonstration, et les absences
 * des chantiers en cours.
 */
function lignesDuJournal(
  projets: Projet[],
  lotsParProjet: Map<string, Lot[]>,
  jour: string,
): { entrees: EntreeJournal[]; rapports: RapportJournalier[] } {
  const relances = lireRelances();
  const saisis = rapportsSaisis().filter((rapport) => rapport.date <= jour);
  const demos = projets.flatMap((projet) => {
    const remis = new Set(saisis.filter((rapport) => rapport.chantier.projetId === projet.id).map((rapport) => rapport.date));
    return rapportsDemo(projet, lotsParProjet.get(projet.id) ?? [], jour, remis);
  });
  const rapports = [...saisis, ...demos].map((rapport) => ({
    ...rapport,
    relanceLe: relances[rapport.id] ?? rapport.relanceLe,
  }));
  const absences = projets.flatMap((projet) => {
    const duProjet = rapports.filter((rapport) => rapport.chantier.projetId === projet.id);
    const remis = new Set(duProjet.map((rapport) => rapport.date));
    return joursAttendus(projet, jour)
      .filter((date) => !remis.has(date))
      .map((date) => absence(projet, date, duProjet, relances));
  });
  return { entrees: [...rapports, ...absences], rapports };
}

/* ------------------------------------------------------------------ *
 * La synthèse.
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

/** Les lots dont les rapports du chantier ont rendu compte, une fois chacun. */
function lotsDesRapports(rapports: RapportJournalier[]): LotJournal[] {
  const lots = new Map(rapports.flatMap((rapport) => rapport.lots).map((lot) => [lot.id, lot]));
  return [...lots.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/* ------------------------------------------------------------------ *
 * Le contrat rejoué.
 * ------------------------------------------------------------------ */

export const simulationJournal = {
  /** Les lignes des neuf dernières semaines, pour tous les chantiers. */
  async lireJournal(): Promise<Journal> {
    const jour = aujourdhui();
    const projets = await projetsMemorises();
    const lots = await lotsDesProjets(projets);
    return attendre(
      { aujourdhui: jour, luLe: new Date().toISOString(), entrees: lignesDuJournal(projets, lots, jour).entrees },
      LATENCE_LECTURE,
    );
  },

  async lireRapport(id: string): Promise<RapportJournalier> {
    const saisi = rapportSaisi(id) ?? (await rapportDemoLu(id));
    if (!saisi) refuser("introuvable", "Ce rapport n'existe pas ou n'a pas encore été rédigé.", 404);
    return attendre({ ...saisi, relanceLe: lireRelances()[id] ?? saisi.relanceLe }, LATENCE_LECTURE);
  },

  /** Relance le chef de chantier (rapport absent) ou le signataire attendu. */
  async relancer(id: string): Promise<{ relanceLe: string }> {
    const relances = lireRelances();
    const relanceLe = new Date().toISOString();
    ecrireRelances({ ...relances, [id]: relanceLe });
    return attendre({ relanceLe }, LATENCE_ECRITURE);
  },

  /**
   * La synthèse d'un chantier, agrégée de ses rapports soumis. Le CT n'a
   * pas d'écran pour la rédiger : ni appréciation ni objectifs, et le
   * circuit attend sa signature une fois la période close.
   */
  async lireSynthese(demande: DemandeSynthese): Promise<SynthesePeriodique> {
    const jour = aujourdhui();
    const projet = (await projetsMemorises()).find((candidat) => candidat.id === demande.projetId);
    if (!projet) refuser("introuvable", "Ce chantier n'existe pas.", 404);
    const { entrees, rapports } = lignesDuJournal([projet], await lotsDesProjets([projet]), jour);
    const duProjet = entrees.filter((entree) => entree.chantier.projetId === projet.id);
    const deposes = rapports.filter(
      (rapport) => rapport.chantier.projetId === projet.id && estDepose(rapport.situation),
    );
    const agregee = agregerSynthese(demande, lotsDesRapports(deposes), duProjet, deposes);
    const close = periodeClose(demande, jour);

    return attendre(
      {
        ...agregee,
        // Sans lot rapporté, l'agrégation ne sait pas nommer le chantier.
        projetId: projet.id,
        projetNom: projet.nom,
        projetReference: projet.reference,
        reference: referenceSynthese(demande, projet.reference),
        genereLe: new Date().toISOString(),
        localisation: [projet.quartier, projet.ville].filter(Boolean).join(", ") || ABSENT,
        chefProjet: nomComplet(projet.chefProjet),
        conducteurTravaux: nomComplet(projet.conducteursTravaux[0]),
        appreciation: null,
        objectifs: [],
        circuit: [
          {
            role: "CT",
            signataire: nomComplet(projet.conducteursTravaux[0]),
            etat: close ? "EN_ATTENTE" : "A_VENIR",
            signeLe: null,
            echeance: close ? horodatage(ajouterJours(demande.fin, 1), "17:00") : null,
            commentaire: null,
          },
          {
            role: "CP",
            signataire: nomComplet(projet.chefProjet),
            etat: "A_VENIR",
            signeLe: null,
            echeance: null,
            commentaire: null,
          },
        ],
      },
      LATENCE_LECTURE,
    );
  },
};

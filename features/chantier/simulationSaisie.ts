/**
 * La saisie du rapport journalier, rejouée — en attendant les routes.
 *
 * Même contrat que `simulationJournal.ts` : il parle le domaine, les vrais
 * appels restent dans `adaptateur.ts`. Ce que fait ici la simulation, c'est
 * ce que Django fera :
 *
 * - **préparer** le formulaire d'un chantier pour un jour — ses lots en
 *   cours, la réunion des sections de leurs modes d'exécution (RG-F2-07), les
 *   activités avec leur cumul de la veille, les matériaux en stock, et ce que
 *   le dernier rapport du chantier permet de reprendre ;
 * - **garder** un seul rapport par chantier et par jour (RG-F2-01, 409 sinon) ;
 * - **figer** un rapport soumis (RG-F2-03, 409 si l'on y revient).
 *
 * Les lots et les activités sont **les vrais**, lus sur `/projets/{id}/lots/` :
 * seuls les rapports vivent ici, dans le `localStorage` du poste. Un rapport
 * soumis **est** le journal que lit le Directeur Général
 * (`simulationJournal.lireJournal`, qui n'a pas d'autre source), une ligne
 * par chantier et par jour, qui rend compte des lots travaillés
 * (`lotsCouverts`).
 */

import { texte } from "@/i18n/horsReact";
import type { Lot, Projet } from "@/features/projets/types";
import { ABSENT } from "@/lib/format";
import { attendre, refuser } from "@/lib/api/simulation";
import { consommablesDuChantier } from "@/features/stocks/regles";
import { lireStock } from "@/features/stocks/adaptateur";

import {
  avancementLotSaisi,
  avancementTheoriqueLot,
  escaladeBlocage,
  heuresEffectif,
  jourDe,
  jourSaisissable,
  lotsTravaillesDe,
  quantitesDuJour,
  rapportModifiable,
  sectionsActives,
} from "./regles";
import type {
  ActivitePreparee,
  EtapeCircuit,
  LigneActivite,
  LigneMateriau,
  LigneProduction,
  LotJournal,
  MateriauDisponible,
  PreparationSaisie,
  ProjetSaisie,
  RapportExistant,
  RapportJournalier,
  RapportsProjet,
  ReprisesRapport,
  SaisieRapport,
  SectionSaisie,
  SituationRapport,
  StatutRapport,
  SuiviActivite,
  TravauxLot,
} from "./types";

// `.v2` : depuis le 05/10/2026, un rapport couvre un chantier, plus un lot.
const CLE_RAPPORTS = "ccd.simulation.journal.saisies.v2";
const LATENCE_LECTURE = 350;
const LATENCE_ECRITURE = 450;

/** Ce que le serveur sait du chantier au moment où le rapport a été préparé. */
interface ContexteSimule {
  projet: ProjetSaisie;
  lots: LotJournal[];
  localisation: string;
  conducteurTravaux: string;
  chefProjet: string;
  sections: SectionSaisie[];
  activites: ActivitePreparee[];
  materiaux: MateriauDisponible[];
}

interface RapportSimule {
  id: string;
  reference: string;
  statut: StatutRapport;
  saisie: SaisieRapport;
  contexte: ContexteSimule;
  enregistreLe: string;
  soumisLe: string | null;
  commentaireRejet: string | null;
  alertes: string[];
}

/* ------------------------------------------------------------------ *
 * Ce que le serveur sait et que l'écran ne doit pas déduire.
 * ------------------------------------------------------------------ */

/** Les sections de chaque mode d'exécution — SFD F2 §5.2 à 5.4, dans l'ordre du document. */
const SECTIONS_PAR_MODE: Record<Lot["modeExecution"], SectionSaisie[]> = {
  REGIE_DIRECTE: ["EFFECTIFS", "AVANCEMENT", "MATERIAUX", "LIVRAISONS", "EQUIPEMENTS"],
  SOUS_TRAITANCE_STRUCTUREE: ["PRESENCE_SOUS_TRAITANT", "AVANCEMENT"],
  SOUS_TRAITANCE_INFORMELLE: ["PRODUCTION"],
};
const ORDRE_SECTIONS: SectionSaisie[] = [
  "EFFECTIFS",
  "PRESENCE_SOUS_TRAITANT",
  "PRODUCTION",
  "AVANCEMENT",
  "MATERIAUX",
  "LIVRAISONS",
  "EQUIPEMENTS",
];

/** Le rapport d'un chantier porte les sections de tous ses lots en cours. */
function sectionsDuChantier(lots: Lot[]): SectionSaisie[] {
  const sections = new Set(lots.flatMap((lot) => SECTIONS_PAR_MODE[lot.modeExecution]));
  return ORDRE_SECTIONS.filter((section) => sections.has(section));
}

function suiviDe(lot: Lot): SuiviActivite {
  return lot.modeExecution === "SOUS_TRAITANCE_INFORMELLE" ? "PRODUCTION" : "AVANCEMENT";
}

/* ------------------------------------------------------------------ *
 * Le stockage du poste.
 * ------------------------------------------------------------------ */

function lireRapports(): RapportSimule[] {
  try {
    const brut = localStorage.getItem(CLE_RAPPORTS);
    if (!brut) return [];
    // Un rapport d'avant la saisie libre des matériaux portait des lignes du
    // stock, sans désignation : elles ne se relisent plus.
    return (JSON.parse(brut) as RapportSimule[]).map((rapport) => ({
      ...rapport,
      saisie: {
        ...rapport.saisie,
        materiaux: rapport.saisie.materiaux.filter((ligne) => typeof ligne.designation === "string"),
      },
    }));
  } catch {
    return [];
  }
}

/**
 * Un `localStorage` tient environ 5 Mo : quand les photos le remplissent, on
 * garde leurs métadonnées et l'on sacrifie l'image — jamais le rapport.
 */
function ecrireRapports(rapports: RapportSimule[]): void {
  try {
    localStorage.setItem(CLE_RAPPORTS, JSON.stringify(rapports));
  } catch {
    const allege = rapports.map((rapport) => ({
      ...rapport,
      saisie: {
        ...rapport.saisie,
        photos: rapport.saisie.photos.map((photo) => ({ ...photo, url: "" })),
        piecesJointes: (rapport.saisie.piecesJointes ?? []).map((piece) => ({ ...piece, url: "" })),
      },
    }));
    try {
      localStorage.setItem(CLE_RAPPORTS, JSON.stringify(allege));
    } catch {
      // Rien à faire : la saisie reste dans la copie locale du formulaire.
    }
  }
}

function aujourdhui(): string {
  return jourDe(new Date());
}

function horodatage(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ *
 * La préparation.
 * ------------------------------------------------------------------ */

/**
 * Les lots dont le rapport rend compte : ceux travaillés ce jour, et ceux où
 * un tâcheron a produit. Une journée d'arrêt n'en couvre aucun.
 */
function lotsCouverts(contexte: ContexteSimule, saisie: SaisieRapport): LotJournal[] {
  if (saisie.arret) return [];
  const lotDe = new Map(contexte.activites.map((activite) => [activite.activiteId, activite.lotId]));
  const couverts = new Set([
    ...lotsTravaillesDe(saisie, contexte.activites).map((point) => point.lotId),
    ...saisie.production.flatMap((ligne) => lotDe.get(ligne.activiteId) ?? []),
  ]);
  return contexte.lots.filter((lot) => couverts.has(lot.id));
}

function versLotJournal(projet: Projet, lot: Lot, chefChantier: string): LotJournal {
  return {
    id: lot.id,
    code: `L-${lot.code}`,
    nom: lot.nom,
    modeExecution: lot.modeExecution,
    projetId: projet.id,
    projetNom: projet.nom,
    projetReference: projet.reference,
    chefChantier,
  };
}

/** L'avancement que le planning attend d'une activité à cette date. */
function theorique(debut: string | null, fin: string | null, jour: string, reel: number): number {
  if (!debut || !fin || fin <= debut) return reel;
  if (jour <= debut) return 0;
  if (jour >= fin) return 100;
  const total = Date.parse(fin) - Date.parse(debut);
  return Math.round(((Date.parse(jour) - Date.parse(debut)) / total) * 100);
}

/** Les rapports déposés du chantier avant ce jour, du plus ancien au plus récent. */
function anterieurs(projetId: string, jour: string): RapportSimule[] {
  return lireRapports()
    .filter((rapport) => rapport.saisie.projetId === projetId && rapport.saisie.date < jour && rapport.statut !== "BROUILLON")
    .sort((a, b) => a.saisie.date.localeCompare(b.saisie.date));
}

function activitesPreparees(projetId: string, lot: Lot, jour: string): ActivitePreparee[] {
  const precedents = anterieurs(projetId, jour);
  return lot.activites.map((activite) => {
    const quantitePrevue = activite.quantitePrevue ?? 100;
    const deposes = precedents.reduce(
      (total, rapport) => total + (quantitesDuJour(rapport.saisie, rapport.contexte.sections).get(activite.id) ?? 0),
      0,
    );
    return {
      activiteId: activite.id,
      lotId: lot.id,
      suivi: suiviDe(lot),
      code: activite.code,
      libelle: activite.libelle,
      unite: activite.quantitePrevue === null ? null : activite.unite,
      quantitePrevue,
      cumulVeille: Math.round(((activite.avancement / 100) * quantitePrevue + deposes) * 100) / 100,
      avancementTheorique: theorique(
        activite.dateDebutPrevue ?? lot.dateDebut,
        activite.dateFinPrevue ?? lot.dateFin,
        jour,
        activite.avancement,
      ),
    };
  });
}

/**
 * Le stock du chantier, lu dans F9 (RG-STK-02) : seuls les matériaux entrés
 * par un BRV complet — validé ET justifié — sont proposés. F9 ne décompte une
 * consommation qu'à la validation du rapport par le CT (signal Django) : les
 * rapports déjà soumis mais pas encore validés sont donc retranchés ici, pour
 * que le chef de chantier ne voie pas un stock qu'il a déjà consommé.
 */
async function materiauxDisponibles(projetId: string, jour: string, sections: SectionSaisie[]): Promise<MateriauDisponible[]> {
  if (!sections.includes("MATERIAUX")) return [];
  const stock = await lireStock()
    .then((donnees) => consommablesDuChantier(donnees, projetId))
    .catch(() => []);
  const materiaux: MateriauDisponible[] = stock.map((ligne) => ({
    materiauId: ligne.materiau.id,
    designation: ligne.materiau.designation,
    unite: ligne.materiau.unite,
    stockDebut: ligne.stock,
    seuilAlerte: ligne.seuil,
  }));
  const consommes = new Map<string, number>();
  for (const rapport of anterieurs(projetId, jour)) {
    for (const ligne of rapport.saisie.materiaux) {
      const materiau = materiauDuStock(ligne, materiaux);
      if (materiau) consommes.set(materiau.materiauId, (consommes.get(materiau.materiauId) ?? 0) + (ligne.quantite ?? 0));
    }
  }
  return materiaux.map((materiau) => ({
    ...materiau,
    stockDebut: Math.max(0, materiau.stockDebut - (consommes.get(materiau.materiauId) ?? 0)),
  }));
}

/**
 * La saisie est libre : une ligne ne se rattache au stock que si elle en
 * reprend exactement la désignation et l'unité. Le serveur fera ce
 * rapprochement à sa façon.
 */
function materiauDuStock(ligne: { designation: string; unite: string }, materiaux: readonly MateriauDisponible[]) {
  const designation = ligne.designation.trim().toLocaleLowerCase("fr");
  return materiaux.find(
    (materiau) => materiau.designation.toLocaleLowerCase("fr") === designation && materiau.unite === ligne.unite.trim(),
  );
}

/** Ce que le dernier rapport du chantier permet de ne pas ressaisir. */
function reprisesDe(projetId: string, jour: string): ReprisesRapport {
  const dernier = anterieurs(projetId, jour).at(-1);
  if (!dernier) return { effectifs: [], equipements: [], intervenants: [] };
  const { saisie } = dernier;
  return {
    effectifs: saisie.effectifs.map((ligne) => ({ categorie: ligne.categorie, prevus: ligne.prevus ?? 0 })),
    equipements: saisie.equipements.map(({ designation, reference, propriete, operateur }) => ({
      designation,
      reference,
      propriete,
      operateur,
    })),
    intervenants: saisie.production.map((ligne) => ({
      intervenant: ligne.intervenant,
      activiteId: ligne.activiteId,
      prixUnitaire: ligne.prixUnitaire ?? 0,
    })),
  };
}

function versExistant(rapport: RapportSimule): RapportExistant {
  return {
    id: rapport.id,
    statut: rapport.statut,
    saisie: rapport.saisie,
    enregistreLe: rapport.enregistreLe,
    commentaireRejet: rapport.commentaireRejet,
    alertesEnvoyees: rapport.alertes,
  };
}

function nomComplet(intervenant: { nomComplet: string } | null | undefined): string {
  return intervenant?.nomComplet || ABSENT;
}

/* ------------------------------------------------------------------ *
 * Le rapport journalier que lit le reste de l'entreprise.
 * ------------------------------------------------------------------ */

function situationDe(statut: StatutRapport): SituationRapport {
  return statut === "BROUILLON" ? "NON_SOUMIS" : statut;
}

function libelleUnite(activite: ActivitePreparee): string {
  return activite.unite
    ? texte(`projets.lotsActivites.unites.${activite.unite}`)
    : texte("journal.saisie.avancement.unitePourcent");
}

function circuitDe(rapport: RapportSimule): EtapeCircuit[] {
  const soumis = rapport.soumisLe;
  const echeance = soumis ? new Date(Date.parse(soumis) + 24 * 3_600_000).toISOString() : null;
  return [
    {
      role: "CC",
      signataire: rapport.contexte.projet.chefChantier,
      etat: rapport.statut === "REJETE" ? "EN_ATTENTE" : soumis ? "SIGNE" : "EN_ATTENTE",
      signeLe: soumis,
      echeance: null,
      commentaire: null,
    },
    {
      role: "CT",
      signataire: rapport.contexte.conducteurTravaux,
      etat: rapport.statut === "REJETE" ? "REJETE" : rapport.statut === "SOUMIS" ? "EN_ATTENTE" : "A_VENIR",
      signeLe: null,
      echeance: rapport.statut === "SOUMIS" ? echeance : null,
      commentaire: rapport.commentaireRejet,
    },
    { role: "CP", signataire: rapport.contexte.chefProjet, etat: "A_VENIR", signeLe: null, echeance: null, commentaire: null },
  ];
}

function heureLocale(instant: string): string {
  const date = new Date(instant);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function versRapportJournalier(rapport: RapportSimule): RapportJournalier {
  const { saisie, contexte } = rapport;
  const sections = sectionsActives(contexte.sections, saisie.arret !== null);
  const quantites = quantitesDuJour(saisie, contexte.sections);
  const effectifs = sections.includes("EFFECTIFS") ? saisie.effectifs : null;
  const activiteDe = new Map(contexte.activites.map((activite) => [activite.activiteId, activite]));
  const observations = new Map(saisie.activites.map((ligne) => [ligne.activiteId, ligne.observation]));

  const lots = lotsCouverts(contexte, saisie);
  const points = new Map(lotsTravaillesDe(saisie, contexte.activites).map((point) => [point.lotId, point.observation]));
  const travaux: TravauxLot[] = lots.map((lot) => {
    const duLot = contexte.activites.filter((activite) => activite.lotId === lot.id);
    return {
      lot,
      avancement: avancementLotSaisi(duLot, quantites) ?? 0,
      avancementTheorique: avancementTheoriqueLot(duLot) ?? 0,
      observation: points.get(lot.id) || null,
      activites: duLot.map(
        (activite): LigneActivite => ({
          libelle: activite.libelle,
          unite: libelleUnite(activite),
          quantitePrevue: activite.quantitePrevue,
          cumulVeille: activite.cumulVeille,
          quantiteJour: quantites.get(activite.activiteId) ?? 0,
          avancementTheorique: activite.avancementTheorique,
          observation: observations.get(activite.activiteId) || null,
        }),
      ),
    };
  });

  const production: LigneProduction[] | null = sections.includes("PRODUCTION")
    ? saisie.production.map((ligne) => {
        const activite = activiteDe.get(ligne.activiteId);
        const veille = anterieurs(saisie.projetId, saisie.date)
          .flatMap((precedent) => precedent.saisie.production)
          .filter((autre) => autre.intervenant === ligne.intervenant && autre.activiteId === ligne.activiteId)
          .reduce((total, autre) => total + (autre.quantiteJour ?? 0), 0);
        return {
          intervenant: ligne.intervenant,
          activite: activite?.libelle ?? ABSENT,
          unite: activite ? libelleUnite(activite) : ABSENT,
          prixUnitaire: ligne.prixUnitaire ?? 0,
          quantiteJour: ligne.quantiteJour ?? 0,
          cumul: veille + (ligne.quantiteJour ?? 0),
        };
      })
    : null;

  const materiaux: LigneMateriau[] = sections.includes("MATERIAUX")
    ? saisie.materiaux
        .filter((ligne) => (ligne.quantite ?? 0) > 0)
        .map((ligne) => {
          const stock = materiauDuStock(ligne, contexte.materiaux);
          return {
            designation: ligne.designation,
            unite: ligne.unite,
            stockDebut: stock ? stock.stockDebut : null,
            livre: 0,
            utilise: ligne.quantite ?? 0,
            seuilAlerte: stock ? stock.seuilAlerte : null,
          };
        })
    : [];

  const presents = effectifs?.reduce((total, ligne) => total + (ligne.presents ?? 0), 0) ?? null;
  const prevus = effectifs?.reduce((total, ligne) => total + (ligne.prevus ?? 0), 0) ?? null;
  const blocage = saisie.blocage;

  return {
    id: rapport.id,
    reference: rapport.reference,
    date: saisie.date,
    chantier: {
      projetId: contexte.projet.id,
      projetNom: contexte.projet.nom,
      projetReference: contexte.projet.reference,
      chefChantier: contexte.projet.chefChantier,
    },
    lots,
    situation: situationDe(rapport.statut),
    effectifPresent: presents,
    effectifPrevu: prevus,
    avancement: avancementLotSaisi(contexte.activites, quantites),
    avancementTheorique: avancementTheoriqueLot(contexte.activites),
    incidents: saisie.incidents.length,
    blocages: blocage.niveau === "AUCUN" ? 0 : 1,
    photos: saisie.photos.length,
    soumisLe: rapport.soumisLe,
    dernierRapportLe: null,
    relanceLe: null,
    noteChefChantier: saisie.note || null,
    circuit: circuitDe(rapport),
    localisation: contexte.localisation,
    intervenants: {
      chefChantier: contexte.projet.chefChantier,
      conducteurTravaux: contexte.conducteurTravaux,
      chefProjet: contexte.chefProjet,
    },
    heureDebut: saisie.heureDebut,
    heureFin: saisie.heureFin,
    meteo: {
      matin: saisie.meteo.matin,
      apresMidi: saisie.meteo.apresMidi,
      temperatureMin: saisie.meteo.temperatureMin ?? 0,
      temperatureMax: saisie.meteo.temperatureMax ?? 0,
      humidite: saisie.meteo.humidite ?? 0,
      vent: saisie.meteo.vent || ABSENT,
      conditions: saisie.arret ? "ARRET" : saisie.meteo.conditions,
      prevision: saisie.meteo.prevision || null,
    },
    effectifs: effectifs?.map((ligne) => ({
      categorie: ligne.categorie,
      prevus: ligne.prevus ?? 0,
      presents: ligne.presents ?? 0,
      heures: heuresEffectif(ligne),
      observation: ligne.observation || null,
    })) ?? null,
    production,
    travaux: sections.includes("AVANCEMENT") || sections.includes("PRODUCTION") ? travaux : [],
    materiaux,
    livraisons: sections.includes("LIVRAISONS")
      ? saisie.livraisons.map((ligne) => ({ ...ligne, observation: ligne.observation || null }))
      : [],
    equipements: sections.includes("EQUIPEMENTS")
      ? saisie.equipements.map((ligne) => ({ ...ligne, observation: ligne.observation || null }))
      : [],
    listeIncidents: saisie.incidents.map((incident, rang) => ({
      numero: `INC-${String(rang + 1).padStart(2, "0")}`,
      type: incident.type,
      description: incident.description,
      gravite: incident.gravite,
      decidePar: incident.decidePar,
      action: incident.action || ABSENT,
      resolu: false,
    })),
    listeBlocages:
      blocage.niveau === "AUCUN"
        ? []
        : [
            {
              numero: "BLQ-01",
              nature: blocage.nature ?? "TECHNIQUE",
              niveau: blocage.niveau,
              description: blocage.description,
              impact: blocage.impact || ABSENT,
              escalade: escaladeBlocage(blocage.niveau),
            },
          ],
    listePhotos: saisie.photos.map((photo) => ({
      url: photo.url || null,
      legende: photo.legende || ABSENT,
      heure: heureLocale(photo.priseLe),
      latitude: photo.latitude ?? 0,
      longitude: photo.longitude ?? 0,
      gpsConfirme: photo.latitude !== null && photo.longitude !== null,
    })),
    documents: (saisie.piecesJointes ?? []).map((piece) => ({
      nom: piece.nom,
      type: piece.type,
      taille: piece.taille,
      url: piece.url || null,
    })),
    previsions: saisie.previsions,
  };
}

/* ------------------------------------------------------------------ *
 * L'écriture.
 * ------------------------------------------------------------------ */

function referenceDe(contexte: ContexteSimule, date: string, rapports: RapportSimule[]): string {
  const rang = rapports.filter((rapport) => rapport.saisie.projetId === contexte.projet.id).length + 1;
  const projet = contexte.projet.reference.slice(-3);
  return `RAP-${date.slice(0, 4)}-${projet}-${String(rang).padStart(3, "0")}`;
}

/** Les contextes préparés, par chantier et par jour — ce que le serveur relirait en base. */
const contextes = new Map<string, ContexteSimule>();

function cleContexte(projetId: string, date: string): string {
  return `${projetId}|${date}`;
}

function enregistrer(id: string | null, saisie: SaisieRapport, soumettre: boolean): RapportSimule {
  const rapports = lireRapports();
  const jour = aujourdhui();
  if (!jourSaisissable(saisie.date, jour)) {
    refuser("date_hors_delai", "Un rapport se rédige pour le jour même ou les deux jours précédents.", 422);
  }
  const memeJour = rapports.find(
    (rapport) => rapport.saisie.projetId === saisie.projetId && rapport.saisie.date === saisie.date,
  );
  const existant = id ? rapports.find((rapport) => rapport.id === id) : memeJour;
  if (memeJour && existant && memeJour.id !== existant.id) {
    refuser("rapport_existant", "Un rapport existe déjà pour ce chantier à cette date.", 409);
  }
  if (existant && !rapportModifiable(existant.statut)) {
    refuser("rapport_soumis", "Ce rapport a déjà été soumis : il ne se modifie plus.", 409);
  }
  const contexte = existant?.contexte ?? contextes.get(cleContexte(saisie.projetId, saisie.date));
  if (!contexte) refuser("projet_inconnu", "Ce chantier ne vous est pas affecté.", 403);

  const maintenant = horodatage();
  const rapport: RapportSimule = {
    id: existant?.id ?? `saisie-${saisie.projetId}-${saisie.date}`,
    reference: existant?.reference ?? referenceDe(contexte, saisie.date, rapports),
    statut: soumettre ? "SOUMIS" : (existant?.statut ?? "BROUILLON"),
    saisie,
    contexte,
    enregistreLe: maintenant,
    soumisLe: soumettre ? maintenant : null,
    commentaireRejet: soumettre ? null : (existant?.commentaireRejet ?? null),
    alertes: existant?.alertes ?? [],
  };
  ecrireRapports([...rapports.filter((autre) => autre.id !== rapport.id), rapport]);
  return rapport;
}

/* ------------------------------------------------------------------ *
 * Le contrat rejoué.
 * ------------------------------------------------------------------ */

export const simulationSaisie = {
  /** Les rapports du chef de chantier sur un chantier, toutes dates confondues. */
  async lireRapportsProjet(projetId: string): Promise<RapportsProjet> {
    return attendre(
      {
        aujourdhui: aujourdhui(),
        rapports: lireRapports()
          .filter((rapport) => rapport.saisie.projetId === projetId)
          .map((rapport) => ({
            id: rapport.id,
            date: rapport.saisie.date,
            statut: rapport.statut,
            enregistreLe: rapport.enregistreLe,
          })),
      },
      LATENCE_LECTURE,
    );
  },

  /** Seuls les lots en cours attendent un rapport : un lot terminé n'avance plus. */
  async preparer(projet: Projet, lots: Lot[], date: string, chefChantier: string): Promise<PreparationSaisie> {
    const enCours = lots.filter((lot) => lot.statut !== "TERMINE");
    const sections = sectionsDuChantier(enCours);
    const existant = lireRapports().find((rapport) => rapport.saisie.projetId === projet.id && rapport.saisie.date === date);
    const redacteur = existant?.contexte.projet.chefChantier ?? chefChantier;
    const contexte: ContexteSimule = existant && !rapportModifiable(existant.statut)
      ? existant.contexte
      : {
          projet: { id: projet.id, nom: projet.nom, reference: projet.reference, chefChantier: redacteur },
          lots: enCours.map((lot) => versLotJournal(projet, lot, redacteur)),
          localisation: [projet.quartier, projet.ville].filter(Boolean).join(", ") || ABSENT,
          conducteurTravaux: nomComplet(projet.conducteursTravaux[0]),
          chefProjet: nomComplet(projet.chefProjet),
          sections,
          activites: enCours.flatMap((lot) => activitesPreparees(projet.id, lot, date)),
          materiaux: await materiauxDisponibles(projet.id, date, sections),
        };
    contextes.set(cleContexte(projet.id, date), contexte);
    return attendre(
      {
        aujourdhui: aujourdhui(),
        projet: contexte.projet,
        lots: contexte.lots,
        sections: contexte.sections,
        activites: contexte.activites,
        materiaux: contexte.materiaux,
        reprises: reprisesDe(projet.id, date),
        rapport: existant ? versExistant(existant) : null,
      },
      LATENCE_LECTURE,
    );
  },

  async enregistrerBrouillon(id: string | null, saisie: SaisieRapport): Promise<RapportExistant> {
    return attendre(versExistant(enregistrer(id, saisie, false)), LATENCE_ECRITURE);
  },

  async soumettre(id: string | null, saisie: SaisieRapport): Promise<{ id: string; reference: string }> {
    const rapport = enregistrer(id, saisie, true);
    return attendre({ id: rapport.id, reference: rapport.reference }, LATENCE_ECRITURE);
  },

  /** Le CT et le CP sont prévenus ; l'alerte est notée pour ne pas repartir deux fois. */
  async alerter(id: string, cle: string): Promise<{ envoyeeLe: string }> {
    const rapports = lireRapports();
    const rapport = rapports.find((candidat) => candidat.id === id);
    if (!rapport) refuser("introuvable", "Ce rapport n'existe pas.", 404);
    if (!rapport.alertes.includes(cle)) {
      ecrireRapports(rapports.map((autre) => (autre.id === id ? { ...autre, alertes: [...autre.alertes, cle] } : autre)));
    }
    return attendre({ envoyeeLe: horodatage() }, LATENCE_ECRITURE);
  },
};

/** Les rapports déposés par la saisie, pour le journal qu'en lit l'entreprise. */
export function rapportsSaisis(): RapportJournalier[] {
  return lireRapports()
    .filter((rapport) => rapport.statut !== "BROUILLON")
    .map(versRapportJournalier);
}

export function rapportSaisi(id: string): RapportJournalier | null {
  const rapport = lireRapports().find((candidat) => candidat.id === id && candidat.statut !== "BROUILLON");
  return rapport ? versRapportJournalier(rapport) : null;
}

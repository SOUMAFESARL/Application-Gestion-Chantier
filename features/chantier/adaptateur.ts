/**
 * L'accès aux données du journal de chantier — plan de refonte, lot 4, couche 4.
 *
 * Même contrat que `features/projets/adaptateur.ts` : les charges utiles sont
 * privées, et rien au-dessus ne connaît la forme HTTP.
 *
 * **Les routes ne sont pas encore fournies.** Celles-ci sont proposées au
 * backend (`backend/apps/chantier/`) d'après les maquettes F2 et le message
 * du 25/09 :
 *
 * - `GET  /chantier/journal/?date_debut=&date_fin=` — les lignes lot × jour,
 *   absences comprises (le serveur sait quels lots étaient attendus) ;
 * - `GET  /chantier/rapports/{id}/` — un rapport journalier complet ;
 * - `POST /chantier/journal/{id}/relancer/` — relance du CC ou du signataire ;
 * - `GET  /chantier/syntheses/?projet=&type=&date_debut=&date_fin=` — la
 *   synthèse agrégée à la demande par l'ORM.
 *
 * Tant que Django ne les sert pas, `JOURNAL_SIMULE` aiguille vers
 * `simulationJournal`. Les noms de champs sont **à confirmer** : c'est ici,
 * et seulement ici, qu'il faudra les corriger.
 */

import type { Lot, ModeExecutionLot, Projet } from "@/features/projets/types";
import { api } from "@/lib/api";
import { routesSimulees } from "@/lib/api/simulation";

import { cleAlerte } from "./regles";
import { simulationJournal } from "./simulationJournal";
import { simulationSaisie } from "./simulationSaisie";
import type {
  ActivitePreparee,
  AlerteImmediate,
  Appreciation,
  Blocage,
  ConditionsMeteo,
  ConditionsTravail,
  DemandeSynthese,
  EntreeJournal,
  EtapeCircuit,
  EtatEtape,
  Incident,
  IncidentSaisi,
  Journal,
  LigneActivite,
  LigneEffectif,
  LigneEquipement,
  LigneMateriau,
  LigneProduction,
  Livraison,
  LotJournal,
  Meteo,
  MotifArret,
  ObjectifSuivant,
  Photo,
  PreparationSaisie,
  Prevision,
  RapportExistant,
  RapportJournalier,
  RapportsProjet,
  RoleSignataire,
  SaisieRapport,
  SectionSaisie,
  SituationRapport,
  StatutRapport,
  SynthesePeriodique,
  TypePeriode,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur.
 * ------------------------------------------------------------------ */

interface ChargeLot {
  id: string;
  code: string;
  nom: string;
  mode_execution: ModeExecutionLot;
  projet_id: string;
  projet_nom: string;
  projet_reference: string;
  chef_chantier_nom: string;
}

interface ChargeEtape {
  role: RoleSignataire;
  signataire_nom: string;
  etat: EtatEtape;
  signe_le: string | null;
  echeance: string | null;
  commentaire?: string | null;
}

interface ChargeEntree {
  id: string;
  reference: string | null;
  date: string;
  lot: ChargeLot;
  statut: StatutRapport | "NON_SOUMIS";
  effectif_present: number | null;
  effectif_prevu: number | null;
  avancement_lot: number | null;
  avancement_theorique: number | null;
  nb_incidents: number | null;
  nb_blocages: number | null;
  nb_photos: number | null;
  soumis_le: string | null;
  dernier_rapport_le?: string | null;
  relance_le?: string | null;
  note_chef_chantier?: string | null;
  circuit: ChargeEtape[];
}

interface ChargeJournal {
  aujourdhui: string;
  lu_le: string;
  resultats: ChargeEntree[];
}

interface ChargeRapport extends ChargeEntree {
  localisation: string;
  conducteur_travaux_nom: string;
  chef_projet_nom: string;
  heure_debut: string;
  heure_fin: string;
  meteo: {
    matin: ConditionsMeteo["matin"];
    apres_midi: ConditionsMeteo["apresMidi"];
    temperature_min: number;
    temperature_max: number;
    humidite: number;
    vent: string;
    conditions: ConditionsMeteo["conditions"];
    prevision?: string | null;
  };
  effectifs: { categorie: string; prevus: number; presents: number; heures: number; observation?: string | null }[] | null;
  production:
    | {
        intervenant: string;
        activite: string;
        unite: string;
        prix_unitaire: number;
        quantite_jour: number;
        cumul: number;
      }[]
    | null;
  activites: {
    libelle: string;
    unite: string;
    quantite_prevue: number;
    cumul_veille: number;
    quantite_jour: number;
    avancement_theorique: number;
    observation?: string | null;
  }[];
  materiaux: {
    designation: string;
    unite: string;
    stock_debut: number;
    livre: number;
    utilise: number;
    seuil_alerte: number;
  }[];
  livraisons: {
    fournisseur: string;
    designation: string;
    quantite: string;
    bon_livraison: string;
    heure: string;
    conformite: Livraison["conformite"];
    observation?: string | null;
  }[];
  equipements: {
    designation: string;
    reference: string;
    propriete: LigneEquipement["propriete"];
    utilisation: string;
    operateur: string;
    etat: LigneEquipement["etat"];
    observation?: string | null;
  }[];
  incidents: ChargeIncident[];
  blocages: {
    numero: string;
    nature: Blocage["nature"];
    niveau: Blocage["niveau"];
    description: string;
    impact: string;
    escalade?: RoleSignataire | null;
  }[];
  photos: {
    url?: string | null;
    legende: string;
    heure: string;
    latitude: number;
    longitude: number;
    gps_confirme: boolean;
  }[];
  previsions: { activite: string; equipe: string; objectif: string; prerequis: string }[];
}

interface ChargeIncident {
  numero: string;
  type: Incident["type"];
  description: string;
  gravite: Incident["gravite"];
  decide_par: RoleSignataire;
  action: string;
  resolu: boolean;
}

interface ChargeSynthese {
  reference: string;
  type: TypePeriode;
  date_debut: string;
  date_fin: string;
  genere_le: string;
  projet_id: string;
  projet_nom: string;
  projet_reference: string;
  localisation: string;
  chef_projet_nom: string;
  conducteur_travaux_nom: string;
  lots: ChargeLot[];
  chiffres: {
    jours_ouvres: number;
    rapports_attendus: number;
    rapports_recus: number;
    rapports_valides: number;
    effectifs_presents: number;
    effectifs_prevus: number;
    heures: number;
    livraisons: number;
    livraisons_partielles: number;
    incidents: number;
    incidents_majeurs: number;
    blocages: number;
  };
  progression: { debut: number; fin: number; gain: number; objectif: number; theorique: number };
  recapitulatif: ChargeEntree[];
  avancement: {
    lot: ChargeLot;
    activites: {
      libelle: string;
      unite: string;
      quantite_prevue: number;
      avancement_debut: number;
      avancement_fin: number;
      objectif_gain: number;
    }[];
  }[];
  effectifs: {
    categorie: string;
    prevu_par_jour: number;
    presence_moyenne: number;
    heures: number;
    absences: number;
    observation?: string | null;
  }[];
  materiaux: {
    designation: string;
    unite: string;
    stock_debut: number;
    consomme: number;
    livre: number;
    stock_fin: number;
    seuil_alerte: number;
  }[];
  incidents: (ChargeIncident & { date: string; lot_code: string })[];
  appreciation: { auteur_nom: string; redigee_le: string; texte: string } | null;
  objectifs: { lot_code: string; activite: string; objectif: string; cible: number; prerequis: string }[];
  circuit: ChargeEtape[];
}

/* ------------------------------------------------------------------ *
 * Traductions.
 * ------------------------------------------------------------------ */

function versLot(charge: ChargeLot): LotJournal {
  return {
    id: charge.id,
    code: charge.code,
    nom: charge.nom,
    modeExecution: charge.mode_execution,
    projetId: charge.projet_id,
    projetNom: charge.projet_nom,
    projetReference: charge.projet_reference,
    chefChantier: charge.chef_chantier_nom,
  };
}

function versEtape(charge: ChargeEtape): EtapeCircuit {
  return {
    role: charge.role,
    signataire: charge.signataire_nom,
    etat: charge.etat,
    signeLe: charge.signe_le,
    echeance: charge.echeance,
    commentaire: charge.commentaire ?? null,
  };
}

/** Un brouillon est l'affaire de son auteur : vu d'ailleurs, rien n'est soumis. */
function versSituation(statut: ChargeEntree["statut"]): SituationRapport {
  return statut === "BROUILLON" ? "NON_SOUMIS" : statut;
}

function versEntree(charge: ChargeEntree): EntreeJournal {
  return {
    id: charge.id,
    reference: charge.reference,
    date: charge.date,
    lot: versLot(charge.lot),
    situation: versSituation(charge.statut),
    effectifPresent: charge.effectif_present,
    effectifPrevu: charge.effectif_prevu,
    avancementLot: charge.avancement_lot,
    avancementTheorique: charge.avancement_theorique,
    incidents: charge.nb_incidents,
    blocages: charge.nb_blocages,
    photos: charge.nb_photos,
    soumisLe: charge.soumis_le,
    dernierRapportLe: charge.dernier_rapport_le ?? null,
    relanceLe: charge.relance_le ?? null,
    noteChefChantier: charge.note_chef_chantier ?? null,
    circuit: charge.circuit.map(versEtape),
  };
}

function versIncident(charge: ChargeIncident): Incident {
  return {
    numero: charge.numero,
    type: charge.type,
    description: charge.description,
    gravite: charge.gravite,
    decidePar: charge.decide_par,
    action: charge.action,
    resolu: charge.resolu,
  };
}

function versRapport(charge: ChargeRapport): RapportJournalier {
  const effectifs: LigneEffectif[] | null =
    charge.effectifs?.map((ligne) => ({ ...ligne, observation: ligne.observation ?? null })) ?? null;
  const production: LigneProduction[] | null =
    charge.production?.map((ligne) => ({
      intervenant: ligne.intervenant,
      activite: ligne.activite,
      unite: ligne.unite,
      prixUnitaire: ligne.prix_unitaire,
      quantiteJour: ligne.quantite_jour,
      cumul: ligne.cumul,
    })) ?? null;
  const activites: LigneActivite[] = charge.activites.map((ligne) => ({
    libelle: ligne.libelle,
    unite: ligne.unite,
    quantitePrevue: ligne.quantite_prevue,
    cumulVeille: ligne.cumul_veille,
    quantiteJour: ligne.quantite_jour,
    avancementTheorique: ligne.avancement_theorique,
    observation: ligne.observation ?? null,
  }));
  const materiaux: LigneMateriau[] = charge.materiaux.map((ligne) => ({
    designation: ligne.designation,
    unite: ligne.unite,
    stockDebut: ligne.stock_debut,
    livre: ligne.livre,
    utilise: ligne.utilise,
    seuilAlerte: ligne.seuil_alerte,
  }));
  const livraisons: Livraison[] = charge.livraisons.map((ligne) => ({
    fournisseur: ligne.fournisseur,
    designation: ligne.designation,
    quantite: ligne.quantite,
    bonLivraison: ligne.bon_livraison,
    heure: ligne.heure,
    conformite: ligne.conformite,
    observation: ligne.observation ?? null,
  }));
  const equipements: LigneEquipement[] = charge.equipements.map((ligne) => ({
    ...ligne,
    observation: ligne.observation ?? null,
  }));
  const blocages: Blocage[] = charge.blocages.map((ligne) => ({ ...ligne, escalade: ligne.escalade ?? null }));
  const photos: Photo[] = charge.photos.map((photo) => ({
    url: photo.url ?? null,
    legende: photo.legende,
    heure: photo.heure,
    latitude: photo.latitude,
    longitude: photo.longitude,
    gpsConfirme: photo.gps_confirme,
  }));
  const previsions: Prevision[] = charge.previsions;

  return {
    ...versEntree(charge),
    localisation: charge.localisation,
    intervenants: {
      chefChantier: charge.lot.chef_chantier_nom,
      conducteurTravaux: charge.conducteur_travaux_nom,
      chefProjet: charge.chef_projet_nom,
    },
    heureDebut: charge.heure_debut,
    heureFin: charge.heure_fin,
    meteo: {
      matin: charge.meteo.matin,
      apresMidi: charge.meteo.apres_midi,
      temperatureMin: charge.meteo.temperature_min,
      temperatureMax: charge.meteo.temperature_max,
      humidite: charge.meteo.humidite,
      vent: charge.meteo.vent,
      conditions: charge.meteo.conditions,
      prevision: charge.meteo.prevision ?? null,
    },
    effectifs,
    production,
    activites,
    materiaux,
    livraisons,
    equipements,
    listeIncidents: charge.incidents.map(versIncident),
    listeBlocages: blocages,
    listePhotos: photos,
    previsions,
  };
}

function versSynthese(charge: ChargeSynthese): SynthesePeriodique {
  const appreciation: Appreciation | null = charge.appreciation
    ? {
        auteur: charge.appreciation.auteur_nom,
        redigeeLe: charge.appreciation.redigee_le,
        texte: charge.appreciation.texte,
      }
    : null;
  const objectifs: ObjectifSuivant[] = charge.objectifs.map((objectif) => ({
    lotCode: objectif.lot_code,
    activite: objectif.activite,
    objectif: objectif.objectif,
    cible: objectif.cible,
    prerequis: objectif.prerequis,
  }));
  const chiffres = charge.chiffres;
  return {
    reference: charge.reference,
    type: charge.type,
    debut: charge.date_debut,
    fin: charge.date_fin,
    genereLe: charge.genere_le,
    projetId: charge.projet_id,
    projetNom: charge.projet_nom,
    projetReference: charge.projet_reference,
    localisation: charge.localisation,
    chefProjet: charge.chef_projet_nom,
    conducteurTravaux: charge.conducteur_travaux_nom,
    lots: charge.lots.map(versLot),
    chiffres: {
      joursOuvres: chiffres.jours_ouvres,
      rapportsAttendus: chiffres.rapports_attendus,
      rapportsRecus: chiffres.rapports_recus,
      rapportsValides: chiffres.rapports_valides,
      effectifsPresents: chiffres.effectifs_presents,
      effectifsPrevus: chiffres.effectifs_prevus,
      heures: chiffres.heures,
      livraisons: chiffres.livraisons,
      livraisonsPartielles: chiffres.livraisons_partielles,
      incidents: chiffres.incidents,
      incidentsMajeurs: chiffres.incidents_majeurs,
      blocages: chiffres.blocages,
    },
    progression: charge.progression,
    recapitulatif: charge.recapitulatif.map(versEntree),
    avancement: charge.avancement.map((bloc) => ({
      lot: versLot(bloc.lot),
      activites: bloc.activites.map((activite) => ({
        libelle: activite.libelle,
        unite: activite.unite,
        quantitePrevue: activite.quantite_prevue,
        avancementDebut: activite.avancement_debut,
        avancementFin: activite.avancement_fin,
        objectifGain: activite.objectif_gain,
      })),
    })),
    effectifs: charge.effectifs.map((ligne) => ({
      categorie: ligne.categorie,
      prevuParJour: ligne.prevu_par_jour,
      presenceMoyenne: ligne.presence_moyenne,
      heures: ligne.heures,
      absences: ligne.absences,
      observation: ligne.observation ?? null,
    })),
    materiaux: charge.materiaux.map((ligne) => ({
      designation: ligne.designation,
      unite: ligne.unite,
      stockDebut: ligne.stock_debut,
      consomme: ligne.consomme,
      livre: ligne.livre,
      stockFin: ligne.stock_fin,
      seuilAlerte: ligne.seuil_alerte,
    })),
    incidents: charge.incidents.map((incident) => ({
      ...versIncident(incident),
      date: incident.date,
      lotCode: incident.lot_code,
    })),
    appreciation,
    objectifs,
    circuit: charge.circuit.map(versEtape),
  };
}

/* ------------------------------------------------------------------ *
 * Lectures et écritures.
 * ------------------------------------------------------------------ */

/** `false` tant que Django ne sert pas les routes du journal : simulé même en production. */
export const JOURNAL_SIMULE = routesSimulees(false);

/** Le journal des neuf dernières semaines, tous chantiers confondus. */
export async function lireJournal(signal?: AbortSignal): Promise<Journal> {
  if (JOURNAL_SIMULE) return simulationJournal.lireJournal();
  const charge = await api.lire<ChargeJournal>("/chantier/journal/", undefined, signal);
  return {
    aujourdhui: charge.aujourdhui,
    luLe: charge.lu_le,
    entrees: charge.resultats.map(versEntree),
  };
}

export async function lireRapport(id: string, signal?: AbortSignal): Promise<RapportJournalier> {
  if (JOURNAL_SIMULE) return simulationJournal.lireRapport(id);
  return versRapport(await api.lire<ChargeRapport>(`/chantier/rapports/${id}/`, undefined, signal));
}

/**
 * Relance la personne qui bloque une ligne : le chef de chantier si le
 * rapport manque, le signataire attendu s'il est déposé.
 */
export async function relancer(id: string): Promise<{ relanceLe: string }> {
  if (JOURNAL_SIMULE) return simulationJournal.relancer(id);
  const charge = await api.creer<{ relance_le: string }>(`/chantier/journal/${id}/relancer/`, {});
  return { relanceLe: charge.relance_le };
}

export async function lireSynthese(demande: DemandeSynthese, signal?: AbortSignal): Promise<SynthesePeriodique> {
  if (JOURNAL_SIMULE) return simulationJournal.lireSynthese(demande);
  const parametres = {
    projet: demande.projetId,
    type: demande.type,
    date_debut: demande.debut,
    date_fin: demande.fin,
  };
  return versSynthese(await api.lire<ChargeSynthese>("/chantier/syntheses/", parametres, signal));
}

/* ------------------------------------------------------------------ *
 * La saisie du chef de chantier (SFD F2 §13).
 *
 *   GET   /chantier/rapports/preparation/?projet=&date=  le formulaire d'un chantier pour un jour
 *   GET   /chantier/rapports/?auteur=moi&projet=         mes rapports sur ce chantier
 *   POST  /chantier/rapports/                            créer le brouillon (projet, date)
 *   PATCH /chantier/rapports/{id}/draft/              sauvegarde silencieuse (30 s)
 *   POST  /chantier/rapports/{id}/soumettre/          BROUILLON → SOUMIS
 *   POST  /chantier/rapports/{id}/alertes/            blocage bloquant, incident grave
 *
 * **Un rapport couvre un chantier sur un jour**, tous ses lots en cours
 * réunis — décision produit du 05/10/2026, contre le « un lot, un jour » du
 * SFD. Le SFD les écrit sous `/api/v1/rapports/` ; elles sont proposées ici sous
 * `/chantier/`, comme le reste du journal. Simulées tant que Django ne les
 * sert pas (`simulationSaisie`).
 * ------------------------------------------------------------------ */

interface ChargeSaisie {
  projet_id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  arret: { motif: MotifArret; precision: string } | null;
  meteo: {
    matin: Meteo;
    apres_midi: Meteo;
    conditions: ConditionsTravail;
    temperature_min: number | null;
    temperature_max: number | null;
    humidite: number | null;
    vent: string;
    prevision: string;
  };
  effectifs: {
    categorie: string;
    prevus: number | null;
    presents: number | null;
    retards: number | null;
    heures: number | null;
    observation: string;
  }[];
  presence_sous_traitant: SaisieRapport["presenceSousTraitant"];
  production: {
    intervenant: string;
    activite_id: string;
    quantite_jour: number | null;
    prix_unitaire: number | null;
  }[];
  lots_travailles: { lot_id: string; observation: string }[];
  activites: { activite_id: string; quantite_jour: number | null; localisation: string; observation: string }[];
  materiaux: { designation: string; quantite_consommee: number | null; unite: string }[];
  livraisons: {
    fournisseur: string;
    designation: string;
    quantite: string;
    bon_livraison: string;
    heure: string;
    conformite: Livraison["conformite"];
    observation: string;
  }[];
  besoins: SaisieRapport["besoins"];
  equipements: {
    designation: string;
    reference: string;
    propriete: LigneEquipement["propriete"];
    utilisation: string;
    operateur: string;
    etat: LigneEquipement["etat"];
    duree_arret: number | null;
    observation: string;
  }[];
  incidents: {
    cle: string;
    nature: IncidentSaisi["nature"];
    type: Incident["type"];
    heure_debut: string;
    heure_fin: string;
    gravite: Incident["gravite"];
    decide_par: RoleSignataire;
    description: string;
    action_entreprise: string;
  }[];
  blocage: {
    niveau: SaisieRapport["blocage"]["niveau"];
    nature: Blocage["nature"] | null;
    description: string;
    impact: string;
  };
  photos: {
    cle: string;
    fichier: string;
    legende: string;
    horodatage_utc: string;
    latitude: number | null;
    longitude: number | null;
  }[];
  pieces_jointes: { cle: string; fichier: string; nom: string; type_mime: string; taille: number }[];
  previsions: { activite: string; equipe: string; objectif: string; prerequis: string }[];
  note_cc: string;
}

interface ChargeRapportExistant {
  id: string;
  statut: StatutRapport;
  saisie: ChargeSaisie;
  enregistre_le: string;
  commentaire_rejet: string | null;
  alertes_envoyees: string[];
}

interface ChargePreparation {
  aujourdhui: string;
  projet: { id: string; nom: string; reference: string; chef_chantier_nom: string };
  lots: ChargeLot[];
  sections: SectionSaisie[];
  activites: {
    activite_id: string;
    lot_id: string;
    suivi: ActivitePreparee["suivi"];
    code: string;
    libelle: string;
    unite: ActivitePreparee["unite"];
    quantite_prevue: number;
    cumul_veille: number;
    avancement_theorique: number;
  }[];
  materiaux: {
    materiau_id: string;
    designation: string;
    unite: string;
    stock_debut: number;
    seuil_alerte: number;
  }[];
  reprises: {
    effectifs: { categorie: string; prevus: number }[];
    equipements: {
      designation: string;
      reference: string;
      propriete: LigneEquipement["propriete"];
      operateur: string;
    }[];
    intervenants: { intervenant: string; activite_id: string; prix_unitaire: number }[];
  };
  rapport: ChargeRapportExistant | null;
}

function versChargeSaisie(saisie: SaisieRapport): ChargeSaisie {
  return {
    projet_id: saisie.projetId,
    date: saisie.date,
    heure_debut: saisie.heureDebut,
    heure_fin: saisie.heureFin,
    arret: saisie.arret,
    meteo: {
      matin: saisie.meteo.matin,
      apres_midi: saisie.meteo.apresMidi,
      conditions: saisie.meteo.conditions,
      temperature_min: saisie.meteo.temperatureMin,
      temperature_max: saisie.meteo.temperatureMax,
      humidite: saisie.meteo.humidite,
      vent: saisie.meteo.vent,
      prevision: saisie.meteo.prevision,
    },
    effectifs: saisie.effectifs,
    presence_sous_traitant: saisie.presenceSousTraitant,
    production: saisie.production.map((ligne) => ({
      intervenant: ligne.intervenant,
      activite_id: ligne.activiteId,
      quantite_jour: ligne.quantiteJour,
      prix_unitaire: ligne.prixUnitaire,
    })),
    lots_travailles: saisie.lotsTravailles.map((point) => ({
      lot_id: point.lotId,
      observation: point.observation,
    })),
    activites: saisie.activites.map((ligne) => ({
      activite_id: ligne.activiteId,
      quantite_jour: ligne.quantiteJour,
      localisation: ligne.localisation,
      observation: ligne.observation,
    })),
    materiaux: saisie.materiaux.map((ligne) => ({
      designation: ligne.designation,
      quantite_consommee: ligne.quantite,
      unite: ligne.unite,
    })),
    livraisons: saisie.livraisons.map((ligne) => ({
      fournisseur: ligne.fournisseur,
      designation: ligne.designation,
      quantite: ligne.quantite,
      bon_livraison: ligne.bonLivraison,
      heure: ligne.heure,
      conformite: ligne.conformite,
      observation: ligne.observation,
    })),
    besoins: saisie.besoins,
    equipements: saisie.equipements.map(({ dureeArret, ...ligne }) => ({ ...ligne, duree_arret: dureeArret })),
    incidents: saisie.incidents.map((incident) => ({
      cle: incident.cle,
      nature: incident.nature,
      type: incident.type,
      heure_debut: incident.heureDebut,
      heure_fin: incident.heureFin,
      gravite: incident.gravite,
      decide_par: incident.decidePar,
      description: incident.description,
      action_entreprise: incident.action,
    })),
    blocage: saisie.blocage,
    photos: saisie.photos.map((photo) => ({
      cle: photo.cle,
      fichier: photo.url,
      legende: photo.legende,
      horodatage_utc: photo.priseLe,
      latitude: photo.latitude,
      longitude: photo.longitude,
    })),
    pieces_jointes: saisie.piecesJointes.map((piece) => ({
      cle: piece.cle,
      fichier: piece.url,
      nom: piece.nom,
      type_mime: piece.type,
      taille: piece.taille,
    })),
    previsions: saisie.previsions,
    note_cc: saisie.note,
  };
}

function versSaisieDomaine(charge: ChargeSaisie): SaisieRapport {
  return {
    projetId: charge.projet_id,
    date: charge.date,
    heureDebut: charge.heure_debut,
    heureFin: charge.heure_fin,
    arret: charge.arret,
    meteo: {
      matin: charge.meteo.matin,
      apresMidi: charge.meteo.apres_midi,
      conditions: charge.meteo.conditions,
      temperatureMin: charge.meteo.temperature_min,
      temperatureMax: charge.meteo.temperature_max,
      humidite: charge.meteo.humidite,
      vent: charge.meteo.vent,
      prevision: charge.meteo.prevision,
    },
    effectifs: charge.effectifs,
    presenceSousTraitant: charge.presence_sous_traitant,
    production: charge.production.map((ligne) => ({
      intervenant: ligne.intervenant,
      activiteId: ligne.activite_id,
      quantiteJour: ligne.quantite_jour,
      prixUnitaire: ligne.prix_unitaire,
    })),
    lotsTravailles: charge.lots_travailles.map((point) => ({
      lotId: point.lot_id,
      observation: point.observation,
    })),
    activites: charge.activites.map((ligne) => ({
      activiteId: ligne.activite_id,
      quantiteJour: ligne.quantite_jour,
      localisation: ligne.localisation,
      observation: ligne.observation,
    })),
    materiaux: charge.materiaux.map((ligne) => ({
      designation: ligne.designation,
      quantite: ligne.quantite_consommee,
      unite: ligne.unite,
    })),
    livraisons: charge.livraisons.map((ligne) => ({
      fournisseur: ligne.fournisseur,
      designation: ligne.designation,
      quantite: ligne.quantite,
      bonLivraison: ligne.bon_livraison,
      heure: ligne.heure,
      conformite: ligne.conformite,
      observation: ligne.observation,
    })),
    besoins: charge.besoins,
    equipements: charge.equipements.map(({ duree_arret, ...ligne }) => ({ ...ligne, dureeArret: duree_arret })),
    incidents: charge.incidents.map((incident) => ({
      cle: incident.cle,
      nature: incident.nature,
      type: incident.type,
      heureDebut: incident.heure_debut,
      heureFin: incident.heure_fin,
      gravite: incident.gravite,
      decidePar: incident.decide_par,
      description: incident.description,
      action: incident.action_entreprise,
    })),
    blocage: charge.blocage,
    photos: charge.photos.map((photo) => ({
      cle: photo.cle,
      url: photo.fichier,
      legende: photo.legende,
      priseLe: photo.horodatage_utc,
      latitude: photo.latitude,
      longitude: photo.longitude,
    })),
    piecesJointes: charge.pieces_jointes.map((piece) => ({
      cle: piece.cle,
      url: piece.fichier,
      nom: piece.nom,
      type: piece.type_mime,
      taille: piece.taille,
    })),
    previsions: charge.previsions,
    note: charge.note_cc,
  };
}

function versRapportExistant(charge: ChargeRapportExistant): RapportExistant {
  return {
    id: charge.id,
    statut: charge.statut,
    saisie: versSaisieDomaine(charge.saisie),
    enregistreLe: charge.enregistre_le,
    commentaireRejet: charge.commentaire_rejet,
    alertesEnvoyees: charge.alertes_envoyees,
  };
}

function versPreparation(charge: ChargePreparation): PreparationSaisie {
  return {
    aujourdhui: charge.aujourdhui,
    projet: {
      id: charge.projet.id,
      nom: charge.projet.nom,
      reference: charge.projet.reference,
      chefChantier: charge.projet.chef_chantier_nom,
    },
    lots: charge.lots.map(versLot),
    sections: charge.sections,
    activites: charge.activites.map((activite) => ({
      activiteId: activite.activite_id,
      lotId: activite.lot_id,
      suivi: activite.suivi,
      code: activite.code,
      libelle: activite.libelle,
      unite: activite.unite,
      quantitePrevue: activite.quantite_prevue,
      cumulVeille: activite.cumul_veille,
      avancementTheorique: activite.avancement_theorique,
    })),
    materiaux: charge.materiaux.map((materiau) => ({
      materiauId: materiau.materiau_id,
      designation: materiau.designation,
      unite: materiau.unite,
      stockDebut: materiau.stock_debut,
      seuilAlerte: materiau.seuil_alerte,
    })),
    reprises: {
      effectifs: charge.reprises.effectifs,
      equipements: charge.reprises.equipements,
      intervenants: charge.reprises.intervenants.map((ligne) => ({
        intervenant: ligne.intervenant,
        activiteId: ligne.activite_id,
        prixUnitaire: ligne.prix_unitaire,
      })),
    },
    rapport: charge.rapport ? versRapportExistant(charge.rapport) : null,
  };
}

/** `false` tant que Django ne sert pas la saisie. */
const SAISIE_SIMULEE = routesSimulees(false);

interface ChargeRapportsProjet {
  aujourdhui: string;
  resultats: { id: string; date: string; statut: StatutRapport; enregistre_le: string }[];
}

/**
 * Mes rapports sur un chantier, tous statuts et toutes dates : l'écran en
 * déduit ceux qui restent à rédiger (`rapportsEnAttente`).
 */
export async function lireRapportsProjet(projetId: string, signal?: AbortSignal): Promise<RapportsProjet> {
  if (SAISIE_SIMULEE) return simulationSaisie.lireRapportsProjet(projetId);
  const charge = await api.lire<ChargeRapportsProjet>("/chantier/rapports/", { auteur: "moi", projet: projetId }, signal);
  return {
    aujourdhui: charge.aujourdhui,
    rapports: charge.resultats.map((rapport) => ({
      id: rapport.id,
      date: rapport.date,
      statut: rapport.statut,
      enregistreLe: rapport.enregistre_le,
    })),
  };
}

/**
 * Le formulaire d'un chantier pour un jour : les lots en cours, les sections
 * de leurs modes, leurs activités, le stock, les reprises, et le rapport déjà
 * commencé s'il en existe un.
 *
 * Le serveur n'a besoin que du chantier et du jour ; le projet complet, ses
 * lots et le nom du rédacteur ne servent qu'à la simulation, qui n'a pas de
 * base où les relire.
 */
export async function preparerSaisie(
  contexte: { projet: Projet; lots: Lot[]; redacteur: string },
  date: string,
  signal?: AbortSignal,
): Promise<PreparationSaisie> {
  if (SAISIE_SIMULEE) {
    return simulationSaisie.preparer(contexte.projet, contexte.lots, date, contexte.redacteur);
  }
  return versPreparation(
    await api.lire<ChargePreparation>("/chantier/rapports/preparation/", { projet: contexte.projet.id, date }, signal),
  );
}

/** Crée le brouillon au premier enregistrement, puis le met à jour. Aucune notification. */
export async function enregistrerBrouillon(id: string | null, saisie: SaisieRapport): Promise<RapportExistant> {
  if (SAISIE_SIMULEE) return simulationSaisie.enregistrerBrouillon(id, saisie);
  const charge = id
    ? await api.modifier<ChargeRapportExistant>(`/chantier/rapports/${id}/draft/`, versChargeSaisie(saisie))
    : await api.creer<ChargeRapportExistant>("/chantier/rapports/", versChargeSaisie(saisie));
  return versRapportExistant(charge);
}

/**
 * Soumet le rapport : il entre dans la file du CT et ne se modifie plus
 * (RG-F2-03). Le serveur revérifie les champs obligatoires (422) et l'unicité
 * chantier × jour (409).
 */
export async function soumettreRapport(
  id: string | null,
  saisie: SaisieRapport,
): Promise<{ id: string; reference: string }> {
  if (SAISIE_SIMULEE) return simulationSaisie.soumettre(id, saisie);
  const brouillon = id ?? (await enregistrerBrouillon(null, saisie)).id;
  return api.creer<{ id: string; reference: string }>(
    `/chantier/rapports/${brouillon}/soumettre/`,
    versChargeSaisie(saisie),
  );
}

/** Prévient le CT et le CP sans attendre la soumission (RG-F2-11). */
export async function envoyerAlerte(id: string, alerte: AlerteImmediate): Promise<{ envoyeeLe: string }> {
  const cle = cleAlerte(alerte);
  if (SAISIE_SIMULEE) return simulationSaisie.alerter(id, cle);
  const charge = await api.creer<{ envoyee_le: string }>(`/chantier/rapports/${id}/alertes/`, {
    cle,
    type: alerte.type,
    description: alerte.description,
  });
  return { envoyeeLe: charge.envoyee_le };
}

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

import type { ModeExecutionLot } from "@/features/projets/types";
import { api } from "@/lib/api";
import { routesSimulees } from "@/lib/api/simulation";

import { simulationJournal } from "./simulationJournal";
import type {
  Appreciation,
  Blocage,
  ConditionsMeteo,
  DemandeSynthese,
  EntreeJournal,
  EtapeCircuit,
  EtatEtape,
  Incident,
  Journal,
  LigneActivite,
  LigneEffectif,
  LigneEquipement,
  LigneMateriau,
  LigneProduction,
  Livraison,
  LotJournal,
  ObjectifSuivant,
  Photo,
  Prevision,
  RapportJournalier,
  RoleSignataire,
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
  photos: { legende: string; heure: string; latitude: number; longitude: number; gps_confirme: boolean }[];
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
const JOURNAL_SIMULE = routesSimulees(false);

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

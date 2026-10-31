/**
 * L'accès aux données du journal de chantier — plan de refonte, lot 4, couche 4.
 *
 * Même contrat que `features/projets/adaptateur.ts` : les charges utiles sont
 * privées, et rien au-dessus ne connaît la forme HTTP.
 *
 * Les routes ont été proposées au backend d'après les maquettes F2 et le
 * message du 25/09, puis servies par Django (`apps/chantier/`) :
 *
 * - `GET  /chantier/journal/?date_debut=&date_fin=` — les lignes chantier ×
 *   jour, absences comprises (le serveur sait quels chantiers étaient
 *   attendus) ; chaque ligne nomme les lots dont le rapport rend compte ;
 * - `GET  /chantier/rapports/{id}/` — un rapport journalier complet ;
 * - `POST /chantier/journal/{id}/relancer/` — relance du CC ou du signataire ;
 * - `GET  /chantier/syntheses/?projet=&type=&date_debut=&date_fin=` — la
 *   synthèse agrégée à la demande par l'ORM, et son circuit CT → CP.
 *
 * **Tout est réel** depuis le 14/10/2026 (plan d'alignement, lot 1) : saisie,
 * journal, rapport, circuit de validation, relance et synthèse.
 */

import type { ModeExecutionLot } from "@/features/projets/types";
import { api } from "@/lib/api";

import { cleAlerte } from "./regles";
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
  EtatSignataire,
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
  QualiteExecution,
  RapportExistant,
  RapportJournalier,
  RapportsProjet,
  RedactionSynthese,
  RoleSignataire,
  SaisieRapport,
  SectionSaisie,
  SituationRapport,
  StatutRapport,
  StatutSynthese,
  SuiviSynthese,
  SynthesePeriodique,
  TravauxLot,
  TypePeriode,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur.
 * ------------------------------------------------------------------ */

interface ChargeLot {
  id: string;
  code: string;
  nom: string;
  /** Le mode de base : `REGIE_DIRECTE`, `SOUS_TRAITANCE_STRUCTUREE` ou `SOUS_TRAITANCE_INFORMELLE`. */
  mode_execution: ModeExecutionLot;
  mode_execution_libelle?: string;
  projet_id: string;
  projet_nom: string;
  projet_reference: string;
  chef_chantier_nom: string;
}

interface ChargeChantier {
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
  /** Tous ceux qui signent l'étape et où chacun en est (30/10/2026). */
  signataires?: {
    utilisateur_id: string;
    nom: string;
    etat: EtatSignataire;
    signe_le: string | null;
    commentaire: string | null;
  }[];
  sans_signataire?: boolean;
}

interface ChargeEntree {
  id: string;
  reference: string | null;
  date: string;
  chantier: ChargeChantier;
  lots: ChargeLot[];
  statut: StatutRapport | "NON_SOUMIS";
  effectif_present: number | null;
  effectif_prevu: number | null;
  avancement: number | null;
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
    temperature_min: number | null;
    temperature_max: number | null;
    humidite: number | null;
    vent: string;
    conditions: ConditionsMeteo["conditions"];
    prevision?: string | null;
  };
  /** Les nombres sont exigés à la soumission : seul un brouillon les laisse vides. */
  effectifs: { categorie: string; prevus: number; presents: number; heures: number; observation?: string | null }[] | null;
  production:
    | {
        intervenant: string;
        activite: string;
        unite: string;
        /** `null` : masqué pour qui n'a pas le droit de voir les montants. */
        prix_unitaire: number | null;
        quantite_jour: number;
        cumul: number;
      }[]
    | null;
  travaux: {
    lot: ChargeLot;
    avancement: number;
    avancement_theorique: number;
    observation?: string | null;
    activites: {
      libelle: string;
      unite: string;
      quantite_prevue: number;
      cumul_veille: number;
      quantite_jour: number;
      avancement_theorique: number;
      observation?: string | null;
    }[];
  }[];
  materiaux: {
    designation: string;
    unite: string;
    /** `null` tant qu'il n'existe pas de module stocks : consommation déclarée, stock inconnu. */
    stock_debut: number | null;
    livre: number;
    utilise: number;
    seuil_alerte: number | null;
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
    latitude: number | null;
    longitude: number | null;
    gps_confirme: boolean;
  }[];
  /** Absent d'un serveur qui ne les renvoie pas encore : aucun document. */
  pieces_jointes?: { nom: string; type_mime: string; taille: number; fichier?: string | null }[];
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

interface ChargeObjectif {
  lot_code: string;
  activite: string;
  objectif: string;
  cible: number;
  prerequis: string;
}

interface ChargeSynthese {
  id: string | null;
  statut: StatutSynthese;
  /** Renvoyée au seul conducteur de travaux du chantier, tant qu'il peut écrire. */
  redaction: { appreciation: string; objectifs: ChargeObjectif[] } | null;
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
  /** Le module stocks n'existe pas : les stocks et le seuil restent vides. */
  materiaux: {
    designation: string;
    unite: string;
    stock_debut: number | null;
    consomme: number;
    livre: number;
    stock_fin: number | null;
    seuil_alerte: number | null;
  }[];
  incidents: (ChargeIncident & { date: string })[];
  appreciation: { auteur_nom: string; redigee_le: string; texte: string } | null;
  objectifs: ChargeObjectif[];
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
    modeExecutionLibelle: charge.mode_execution_libelle ?? "",
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
    signataires: (charge.signataires ?? []).map((ligne) => ({
      utilisateurId: ligne.utilisateur_id,
      nom: ligne.nom,
      etat: ligne.etat,
      signeLe: ligne.signe_le,
      commentaire: ligne.commentaire,
    })),
    sansSignataire: charge.sans_signataire ?? false,
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
    chantier: {
      projetId: charge.chantier.projet_id,
      projetNom: charge.chantier.projet_nom,
      projetReference: charge.chantier.projet_reference,
      chefChantier: charge.chantier.chef_chantier_nom,
    },
    lots: charge.lots.map(versLot),
    situation: versSituation(charge.statut),
    effectifPresent: charge.effectif_present,
    effectifPrevu: charge.effectif_prevu,
    avancement: charge.avancement,
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
  const travaux: TravauxLot[] = charge.travaux.map((bloc) => ({
    lot: versLot(bloc.lot),
    avancement: bloc.avancement,
    avancementTheorique: bloc.avancement_theorique,
    observation: bloc.observation ?? null,
    activites: bloc.activites.map(
      (ligne): LigneActivite => ({
        libelle: ligne.libelle,
        unite: ligne.unite,
        quantitePrevue: ligne.quantite_prevue,
        cumulVeille: ligne.cumul_veille,
        quantiteJour: ligne.quantite_jour,
        avancementTheorique: ligne.avancement_theorique,
        observation: ligne.observation ?? null,
      }),
    ),
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
      chefChantier: charge.chantier.chef_chantier_nom,
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
    travaux,
    materiaux,
    livraisons,
    equipements,
    listeIncidents: charge.incidents.map(versIncident),
    listeBlocages: blocages,
    listePhotos: photos,
    documents: (charge.pieces_jointes ?? []).map((piece) => ({
      nom: piece.nom,
      type: piece.type_mime,
      taille: piece.taille,
      url: piece.fichier ?? null,
    })),
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
  const chiffres = charge.chiffres;
  return {
    id: charge.id,
    statut: charge.statut,
    redaction: charge.redaction
      ? { appreciation: charge.redaction.appreciation, objectifs: charge.redaction.objectifs.map(versObjectif) }
      : null,
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
    })),
    appreciation,
    objectifs: charge.objectifs.map(versObjectif),
    circuit: charge.circuit.map(versEtape),
  };
}

function versObjectif(charge: ChargeObjectif): ObjectifSuivant {
  return {
    lotCode: charge.lot_code,
    activite: charge.activite,
    objectif: charge.objectif,
    cible: charge.cible,
    prerequis: charge.prerequis,
  };
}

/* ------------------------------------------------------------------ *
 * Lectures et écritures.
 * ------------------------------------------------------------------ */

/**
 * L'écran peut-il proposer la synthèse ? Seulement servie par Django : une
 * synthèse simulée, agrégée de rapports inventés, passerait pour réelle devant
 * un client (décision du 13/10/2026). Django la sert depuis le 14/10/2026 ;
 * l'onglet et la page se masquent ensemble si on repasse ce drapeau à `false`.
 */
export const SYNTHESE_DISPONIBLE = true;

/** Le journal des neuf dernières semaines, tous chantiers confondus. */
export async function lireJournal(signal?: AbortSignal): Promise<Journal> {
  const charge = await api.lire<ChargeJournal>("/chantier/journal/", undefined, signal);
  return {
    aujourdhui: charge.aujourdhui,
    luLe: charge.lu_le,
    entrees: charge.resultats.map(versEntree),
  };
}

export async function lireRapport(id: string, signal?: AbortSignal): Promise<RapportJournalier> {
  return versRapport(await api.lire<ChargeRapport>(`/chantier/rapports/${id}/`, undefined, signal));
}

/* ------------------------------------------------------------------ *
 * Le circuit de validation CC → CT → CP (SFD F2, RG-F2-03).
 *
 *   POST /chantier/rapports/{id}/valider/    signature du conducteur de travaux
 *   POST /chantier/rapports/{id}/approuver/  signature du chef de projet, après le CT
 *   POST /chantier/rapports/{id}/rejeter/    retour au chef de chantier, motif ≥ 20 caractères
 *
 * Chacune renvoie le rapport à jour. Le serveur revérifie tout : le statut
 * attendu, l'affectation du signataire au chantier, et que l'auteur ne signe
 * pas son propre rapport.
 * ------------------------------------------------------------------ */

/** Le conducteur de travaux signe un rapport soumis. */
export async function validerRapport(id: string, commentaire: string): Promise<RapportJournalier> {
  return versRapport(await api.creer<ChargeRapport>(`/chantier/rapports/${id}/valider/`, { commentaire }));
}

/** Le chef de projet signe un rapport déjà validé par le conducteur de travaux. */
export async function approuverRapport(id: string, commentaire: string): Promise<RapportJournalier> {
  return versRapport(await api.creer<ChargeRapport>(`/chantier/rapports/${id}/approuver/`, { commentaire }));
}

/** Renvoie le rapport au chef de chantier, à l'étape où il se trouve. */
export async function rejeterRapport(id: string, motif: string): Promise<RapportJournalier> {
  return versRapport(await api.creer<ChargeRapport>(`/chantier/rapports/${id}/rejeter/`, { motif }));
}

/**
 * Relance par e-mail la personne qui bloque une ligne : le chef de chantier si
 * le rapport manque, est en brouillon ou rejeté ; le signataire attendu s'il
 * est soumis. `id` est celui de la ligne (`{projet}_{jour}` pour un rapport
 * manquant). Une relance par ligne et par jour : une seconde demande le même
 * jour rend la première, sans renvoyer d'e-mail.
 */
export async function relancer(id: string): Promise<{ relanceLe: string }> {
  const charge = await api.creer<{ relance_le: string }>(`/chantier/journal/${id}/relancer/`, {});
  return { relanceLe: charge.relance_le };
}

/* ------------------------------------------------------------------ *
 * La synthèse périodique et son circuit CT → CP.
 *
 *   GET  /chantier/syntheses/?projet=&type=&date_debut=&date_fin=
 *   GET  /chantier/syntheses/suivi/?projet=
 *   POST /chantier/syntheses/redaction/      le CT enregistre, sans signer
 *   POST /chantier/syntheses/soumettre/      le CT enregistre et signe
 *   POST /chantier/syntheses/{id}/approuver/ le CP clôt le circuit
 *   POST /chantier/syntheses/{id}/rejeter/   le CP la rend au CT, motif ≥ 20 caractères
 *
 * Une synthèse se désigne par son chantier et sa période tant que le CT n'y
 * a rien écrit ; elle a ensuite un identifiant. Chaque écriture renvoie la
 * synthèse à jour.
 * ------------------------------------------------------------------ */

function versPeriode(demande: DemandeSynthese) {
  return {
    projet: demande.projetId,
    type: demande.type,
    date_debut: demande.debut,
    date_fin: demande.fin,
  };
}

export async function lireSynthese(demande: DemandeSynthese, signal?: AbortSignal): Promise<SynthesePeriodique> {
  return versSynthese(await api.lire<ChargeSynthese>("/chantier/syntheses/", versPeriode(demande), signal));
}

function versChargeRedaction(demande: DemandeSynthese, redaction: RedactionSynthese) {
  return {
    ...versPeriode(demande),
    appreciation: redaction.appreciation,
    objectifs: redaction.objectifs.map((objectif) => ({
      lot_code: objectif.lotCode,
      activite: objectif.activite,
      objectif: objectif.objectif,
      cible: objectif.cible,
      prerequis: objectif.prerequis,
    })),
  };
}

/** Le CT enregistre son appréciation et ses objectifs, sans signer. */
export async function enregistrerSynthese(
  demande: DemandeSynthese,
  redaction: RedactionSynthese,
): Promise<SynthesePeriodique> {
  return versSynthese(
    await api.creer<ChargeSynthese>("/chantier/syntheses/redaction/", versChargeRedaction(demande, redaction)),
  );
}

/** Le CT enregistre et signe : la synthèse est figée et part au chef de projet. */
export async function soumettreSynthese(
  demande: DemandeSynthese,
  redaction: RedactionSynthese,
): Promise<SynthesePeriodique> {
  return versSynthese(
    await api.creer<ChargeSynthese>("/chantier/syntheses/soumettre/", versChargeRedaction(demande, redaction)),
  );
}

export async function approuverSynthese(id: string, commentaire: string): Promise<SynthesePeriodique> {
  return versSynthese(await api.creer<ChargeSynthese>(`/chantier/syntheses/${id}/approuver/`, { commentaire }));
}

export async function rejeterSynthese(id: string, motif: string): Promise<SynthesePeriodique> {
  return versSynthese(await api.creer<ChargeSynthese>(`/chantier/syntheses/${id}/rejeter/`, { motif }));
}

interface ChargeSuiviSynthese {
  id: string;
  projet_id: string;
  type: TypePeriode;
  date_debut: string;
  date_fin: string;
  statut: StatutSynthese;
}

/** Les synthèses enregistrées des trois derniers mois, chantiers visibles. */
export async function lireSuiviSyntheses(signal?: AbortSignal): Promise<SuiviSynthese[]> {
  const charge = await api.lire<{ resultats: ChargeSuiviSynthese[] }>("/chantier/syntheses/suivi/", undefined, signal);
  return charge.resultats.map((ligne) => ({
    id: ligne.id,
    projetId: ligne.projet_id,
    type: ligne.type,
    debut: ligne.date_debut,
    fin: ligne.date_fin,
    statut: ligne.statut,
  }));
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
 * SFD. Le SFD les écrit sous `/api/v1/rapports/` ; Django les sert sous
 * `/chantier/`, comme le reste du journal.
 *
 * **Ces cinq routes sont réelles** depuis le 13/10/2026 (plan d'alignement,
 * tâche 1.2) : un rapport vit en base, plus dans le navigateur. Le serveur
 * **refuse tout champ qu'il ne connaît pas** (`StrictSerializer`) — un champ
 * ajouté à `ChargeSaisie` sans l'être côté Django donne un 400, pas un oubli
 * silencieux.
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
    /** L'ouvrier, parmi les membres de l'équipe de la tâche ; nul sans équipe. */
    personne_id?: string | null;
    activite_id: string;
    quantite_jour: number | null;
    prix_unitaire: number | null;
  }[];
  /** Les présents des équipes des tâches (30/10/2026) ; absent des saisies antérieures. */
  equipes?: {
    equipe_id: string;
    presents: string[];
    retards: string[];
    heures: number | null;
    qualite: QualiteExecution | "";
    observation: string;
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
    /** `prix_unitaire` vaut `null` pour qui n'a pas le droit de voir les montants. */
    intervenants: {
      intervenant: string;
      personne_id?: string | null;
      activite_id: string;
      prix_unitaire: number | null;
    }[];
    equipes?: { equipe_id: string; presents: string[] }[];
  };
  /** Les équipes des tâches et leurs membres ce jour ; absent d'une photographie ancienne. */
  equipes?: {
    equipe_id: string;
    nom: string;
    nature?: string;
    entreprise?: string;
    corps_etat?: string;
    activites: string[];
    presence: boolean;
    attendue: boolean;
    qualite: boolean;
    membres: { personne_id: string; nom: string; fonction: string; est_chef: boolean }[];
  }[];
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
      personne_id: ligne.personneId,
      activite_id: ligne.activiteId,
      quantite_jour: ligne.quantiteJour,
      prix_unitaire: ligne.prixUnitaire,
    })),
    equipes: saisie.equipes.map((ligne) => ({
      equipe_id: ligne.equipeId,
      presents: ligne.presents,
      retards: ligne.retards,
      heures: ligne.heures,
      qualite: ligne.qualite,
      observation: ligne.observation,
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
      personneId: ligne.personne_id ?? null,
      activiteId: ligne.activite_id,
      quantiteJour: ligne.quantite_jour,
      prixUnitaire: ligne.prix_unitaire,
    })),
    equipes: (charge.equipes ?? []).map((ligne) => ({
      equipeId: ligne.equipe_id,
      presents: ligne.presents ?? [],
      retards: ligne.retards ?? [],
      heures: ligne.heures,
      qualite: ligne.qualite ?? "",
      observation: ligne.observation ?? "",
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
        personneId: ligne.personne_id ?? null,
        activiteId: ligne.activite_id,
        prixUnitaire: ligne.prix_unitaire,
      })),
      equipes: (charge.reprises.equipes ?? []).map((ligne) => ({
        equipeId: ligne.equipe_id,
        presents: ligne.presents,
      })),
    },
    equipes: (charge.equipes ?? []).map((equipe) => ({
      equipeId: equipe.equipe_id,
      nom: equipe.nom,
      nature: equipe.nature ?? "",
      entreprise: equipe.entreprise ?? "",
      corpsEtat: equipe.corps_etat ?? "",
      activites: equipe.activites,
      presence: equipe.presence,
      attendue: equipe.attendue,
      qualite: equipe.qualite,
      membres: equipe.membres.map((membre) => ({
        personneId: membre.personne_id,
        nom: membre.nom,
        fonction: membre.fonction,
        estChef: membre.est_chef,
      })),
    })),
    rapport: charge.rapport ? versRapportExistant(charge.rapport) : null,
  };
}

interface ChargeRapportsProjet {
  aujourdhui: string;
  resultats: { id: string; date: string; statut: StatutRapport; enregistre_le: string }[];
}

/**
 * Mes rapports sur un chantier, tous statuts et toutes dates : l'écran en
 * déduit ceux qui restent à rédiger (`rapportsEnAttente`).
 */
export async function lireRapportsProjet(projetId: string, signal?: AbortSignal): Promise<RapportsProjet> {
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
 * de leurs modes, leurs activités, les reprises, et le rapport déjà commencé
 * s'il en existe un. Le serveur n'a besoin que du chantier et du jour.
 *
 * `materiaux` revient vide tant qu'il n'existe pas de module stocks : la
 * saisie des consommations reste libre.
 */
export async function preparerSaisie(
  projetId: string,
  date: string,
  signal?: AbortSignal,
): Promise<PreparationSaisie> {
  return versPreparation(
    await api.lire<ChargePreparation>("/chantier/rapports/preparation/", { projet: projetId, date }, signal),
  );
}

/** Crée le brouillon au premier enregistrement, puis le met à jour. Aucune notification. */
export async function enregistrerBrouillon(id: string | null, saisie: SaisieRapport): Promise<RapportExistant> {
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
  const brouillon = id ?? (await enregistrerBrouillon(null, saisie)).id;
  return api.creer<{ id: string; reference: string }>(
    `/chantier/rapports/${brouillon}/soumettre/`,
    versChargeSaisie(saisie),
  );
}

/** Prévient le CT et le CP sans attendre la soumission (RG-F2-11). */
export async function envoyerAlerte(id: string, alerte: AlerteImmediate): Promise<{ envoyeeLe: string }> {
  const cle = cleAlerte(alerte);
  const charge = await api.creer<{ envoyee_le: string }>(`/chantier/rapports/${id}/alertes/`, {
    cle,
    type: alerte.type,
    description: alerte.description,
  });
  return { envoyeeLe: charge.envoyee_le };
}

/**
 * L'accès aux données du journal de chantier — couche d'adaptation HTTP ↔ domaine.
 *
 * Même contrat que `features/projets/adaptateur.ts` : les charges utiles `snake_case`
 * restent privées à ce fichier ; rien au-dessus ne connaît la forme HTTP.
 *
 * Le serveur refuse tout champ inconnu (`StrictSerializer`) : `ChargeSaisie` épouse
 * clé pour clé `SaisieJournalSerializer` côté Django.
 */

import type { ModeExecutionLot } from "@/features/projets/types";
import { api } from "@/lib/api";

import { cleAlerte } from "./regles";
import type {
  ActivitePreparee,
  AlerteImmediate,
  Appreciation,
  BesoinRapport,
  Blocage,
  BlocageOuvert,
  ConditionsMeteo,
  ConditionsTravail,
  Conformite,
  DecideurIncident,
  DemandeSynthese,
  EntreeJournal,
  EtapeCircuit,
  EtapeSignable,
  EtatEquipement,
  EtatEtape,
  EtatSignataire,
  GraviteIncident,
  Incident,
  IncidentSaisi,
  Journal,
  LigneActivite,
  LigneEffectif,
  LigneEquipement,
  LigneMateriau,
  Livraison,
  LotJournal,
  Meteo,
  MeteoSuggeree,
  ModeMesureFeuille,
  MotifArret,
  NatureBlocage,
  NatureEvenement,
  NiveauBlocage,
  ObjectifSuivant,
  Photo,
  PreparationSaisie,
  PresenceEquipeRapport,
  Prevision,
  ProprieteEquipement,
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
  TypeIncident,
  TypePeriode,
} from "./types";

/* ------------------------------------------------------------------ *
 * Normalisations défensives (lecture d'enregistrements historiques).
 * ------------------------------------------------------------------ */

type RoleBrut = RoleSignataire | "CC" | "CT" | "CP";
type StatutBrut = StatutRapport | "VALIDE_CT" | "APPROUVE_CP";

function normaliserRole(role: RoleBrut): RoleSignataire {
  if (role === "CC") return "REDACTION";
  if (role === "CT") return "VALIDATION";
  if (role === "CP") return "APPROBATION";
  return role;
}

function normaliserEtapeSignable(etape: EtapeSignable | "CT" | "CP" | null | undefined): EtapeSignable | null {
  if (!etape) return null;
  if (etape === "CT") return "VALIDATION";
  if (etape === "CP") return "APPROBATION";
  return etape;
}

function normaliserStatut(statut: StatutBrut): StatutRapport {
  if (statut === "VALIDE_CT") return "VALIDE";
  if (statut === "APPROUVE_CP") return "APPROUVE";
  return statut;
}

function normaliserDecideur(decideur: string | null | undefined): DecideurIncident | "" {
  if (!decideur) return "";
  if (decideur === "CC") return "REDACTION";
  if (decideur === "CT") return "VALIDATION";
  if (decideur === "CP") return "APPROBATION";
  return decideur as DecideurIncident;
}

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur.
 * ------------------------------------------------------------------ */

interface ChargeLot {
  id: string;
  code: string;
  nom: string;
  mode_execution: ModeExecutionLot;
  mode_execution_libelle?: string;
  projet_id: string;
  projet_nom: string;
  projet_reference: string;
  redacteur_nom?: string;
  chef_chantier_nom?: string;
}

interface ChargeChantier {
  projet_id: string;
  projet_nom: string;
  projet_reference: string;
  redacteur_nom?: string;
  chef_chantier_nom?: string;
}

interface ChargeEtape {
  role: RoleBrut;
  signataire_nom: string;
  etat: EtatEtape;
  signe_le: string | null;
  echeance: string | null;
  commentaire?: string | null;
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
  statut: StatutBrut | "NON_SOUMIS";
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
  note_redacteur?: string | null;
  note_chef_chantier?: string | null;
  circuit: ChargeEtape[];
}

interface ChargeJournal {
  aujourdhui: string;
  est_jour_ouvre?: boolean;
  jours_saisissables?: string[];
  lu_le: string;
  resultats: ChargeEntree[];
}

interface ChargeIncident {
  numero: string;
  nature?: NatureEvenement;
  type: TypeIncident | "";
  heure_debut?: string;
  heure_fin?: string;
  description: string;
  gravite: GraviteIncident | "";
  decide_par: string;
  action: string;
  resolu: boolean;
}

interface ChargePrevision {
  activite_id?: string | null;
  equipe_id?: string | null;
  activite: string;
  equipe: string;
  objectif: string;
  prerequis: string;
}

interface ChargeRapport extends ChargeEntree {
  localisation: string;
  validateurs_nom?: string;
  conducteur_travaux_nom?: string;
  approbateurs_nom?: string;
  chef_projet_nom?: string;
  heure_debut: string;
  heure_fin: string;
  arret?: { motif: MotifArret; precision: string } | null;
  meteo: {
    matin: ConditionsMeteo["matin"];
    apres_midi: ConditionsMeteo["apresMidi"];
    conditions: ConditionsMeteo["conditions"];
  };
  effectifs:
    | {
        categorie: string;
        prevus: number;
        presents: number;
        heures: number;
        observation?: string | null;
      }[]
    | null;
  equipes?: {
    equipe_id: string;
    nom: string;
    entreprise: string;
    presence: "PRESENT" | "PARTIEL" | "ABSENT";
    membres: number;
    presents: string[];
    absents: string[];
    retards: string[];
    heures: number | null;
    qualite: QualiteExecution | null;
    observation: string;
  }[];
  travaux: {
    lot: ChargeLot;
    avancement: number;
    avancement_theorique: number;
    observation?: string | null;
    activites: {
      activite_id?: string;
      libelle: string;
      mode_mesure?: ModeMesureFeuille;
      unite: string | null;
      quantite_prevue: number;
      cumul_veille: number;
      quantite_jour: number;
      pourcentage_veille?: number;
      pourcentage_jour?: number | null;
      jalon_atteint?: boolean;
      avancement_theorique: number;
      equipes_noms?: string[];
      localisation?: string;
      observation?: string | null;
    }[];
  }[];
  materiaux: {
    designation: string;
    unite: string;
    stock_debut: number | null;
    livre: number;
    utilise: number;
    seuil_alerte: number | null;
  }[];
  livraisons: {
    fournisseur: string;
    designation: string;
    quantite: number | null;
    unite?: string;
    bon_livraison: string;
    heure: string;
    conformite: Conformite;
    observation?: string | null;
  }[];
  besoins?: {
    nature: "RUPTURE" | "URGENT";
    designation: string;
    quantite: number | null;
    unite?: string;
    observation?: string | null;
  }[];
  equipements: {
    cle?: string;
    designation: string;
    reference: string;
    propriete: ProprieteEquipement | "";
    heures_utilisation?: number | null;
    usage?: string;
    operateur: string;
    etat: EtatEquipement | "";
    duree_arret?: number | null;
    observation?: string | null;
  }[];
  incidents: ChargeIncident[];
  blocages: {
    numero: string;
    cle?: string;
    blocage_id?: string | null;
    element_id?: string | null;
    element_libelle?: string | null;
    titre?: string;
    nature: NatureBlocage | "";
    niveau: NiveauBlocage;
    description: string;
    impact: string;
    escalade?: RoleBrut | null;
  }[];
  photos: {
    url?: string | null;
    element_id?: string | null;
    element_libelle?: string | null;
    legende: string;
    heure: string;
    latitude: number | null;
    longitude: number | null;
    gps_confirme: boolean;
  }[];
  pieces_jointes?: { nom: string; type_mime: string; taille: number; fichier?: string | null }[];
  previsions: ChargePrevision[];
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
  redaction: { appreciation: string; objectifs: ChargeObjectif[] } | null;
  etape_a_signer: EtapeSignable | "CT" | "CP" | null;
  reference: string;
  type: TypePeriode;
  date_debut: string;
  date_fin: string;
  genere_le: string;
  projet_id: string;
  projet_nom: string;
  projet_reference: string;
  localisation: string;
  approbateurs_nom?: string;
  chef_projet_nom?: string;
  validateurs_nom?: string;
  conducteur_travaux_nom?: string;
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
      mode_mesure?: ModeMesureFeuille;
      unite: string | null;
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
 * Traductions de lecture.
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
    redacteur: charge.redacteur_nom ?? charge.chef_chantier_nom ?? "",
  };
}

function versEtape(charge: ChargeEtape): EtapeCircuit {
  return {
    role: normaliserRole(charge.role),
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

function versSituation(statut: ChargeEntree["statut"]): SituationRapport {
  if (statut === "BROUILLON" || statut === "NON_SOUMIS") return "NON_SOUMIS";
  const normalise = normaliserStatut(statut);
  return normalise === "BROUILLON" ? "NON_SOUMIS" : normalise;
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
      redacteur: charge.chantier.redacteur_nom ?? charge.chantier.chef_chantier_nom ?? "",
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
    noteRedacteur: charge.note_redacteur ?? charge.note_chef_chantier ?? null,
    circuit: charge.circuit.map(versEtape),
  };
}

function versIncident(charge: ChargeIncident): Incident {
  return {
    numero: charge.numero,
    nature: charge.nature ?? "EVENEMENT_PARTICULIER",
    type: charge.type ?? "",
    heureDebut: charge.heure_debut ?? "",
    heureFin: charge.heure_fin ?? "",
    description: charge.description,
    gravite: charge.gravite ?? "",
    decidePar: normaliserDecideur(charge.decide_par),
    action: charge.action,
    resolu: charge.resolu,
  };
}

function versPrevision(charge: ChargePrevision): Prevision {
  return {
    activiteId: charge.activite_id ?? null,
    equipeId: charge.equipe_id ?? null,
    activite: charge.activite,
    equipe: charge.equipe,
    objectif: charge.objectif,
    prerequis: charge.prerequis,
  };
}

function versRapport(charge: ChargeRapport): RapportJournalier {
  const effectifs: LigneEffectif[] | null =
    charge.effectifs?.map((ligne) => ({ ...ligne, observation: ligne.observation ?? null })) ??
    null;

  const equipes: PresenceEquipeRapport[] = (charge.equipes ?? []).map((equipe) => ({
    equipeId: equipe.equipe_id,
    nom: equipe.nom,
    entreprise: equipe.entreprise,
    presence: equipe.presence,
    membres: equipe.membres,
    presents: equipe.presents,
    absents: equipe.absents,
    retards: equipe.retards,
    heures: equipe.heures,
    qualite: equipe.qualite,
    observation: equipe.observation,
  }));

  const travaux: TravauxLot[] = charge.travaux.map((bloc) => ({
    lot: versLot(bloc.lot),
    avancement: bloc.avancement,
    avancementTheorique: bloc.avancement_theorique,
    observation: bloc.observation ?? null,
    activites: bloc.activites.map(
      (ligne, index): LigneActivite => ({
        activiteId: ligne.activite_id ?? `${bloc.lot.id}-${index}`,
        libelle: ligne.libelle,
        modeMesure: ligne.mode_mesure ?? "QUANTITE",
        unite: ligne.unite,
        quantitePrevue: ligne.quantite_prevue,
        cumulVeille: ligne.cumul_veille,
        quantiteJour: ligne.quantite_jour,
        pourcentageVeille: ligne.pourcentage_veille ?? 0,
        pourcentageJour: ligne.pourcentage_jour ?? null,
        jalonAtteint: ligne.jalon_atteint ?? false,
        avancementTheorique: ligne.avancement_theorique,
        equipesNoms: ligne.equipes_noms ?? [],
        localisation: ligne.localisation ?? "",
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
    unite: ligne.unite ?? "",
    bonLivraison: ligne.bon_livraison,
    heure: ligne.heure,
    conformite: ligne.conformite || "CONFORME",
    observation: ligne.observation ?? null,
  }));

  const besoins: BesoinRapport[] = (charge.besoins ?? []).map((besoin) => ({
    nature: besoin.nature,
    designation: besoin.designation,
    quantite: besoin.quantite,
    unite: besoin.unite ?? "",
    observation: besoin.observation ?? null,
  }));

  const equipements: LigneEquipement[] = charge.equipements.map((ligne, index) => ({
    cle: ligne.cle ?? `eq-${index}`,
    designation: ligne.designation,
    reference: ligne.reference,
    propriete: ligne.propriete,
    heuresUtilisation: ligne.heures_utilisation ?? null,
    usage: ligne.usage ?? "",
    operateur: ligne.operateur,
    etat: ligne.etat,
    dureeArret: ligne.duree_arret ?? null,
    observation: ligne.observation ?? null,
  }));

  const blocages: Blocage[] = charge.blocages.map((ligne, index) => ({
    numero: ligne.numero,
    cle: ligne.cle ?? `blc-${index}`,
    blocageId: ligne.blocage_id ?? null,
    elementId: ligne.element_id ?? null,
    elementLibelle: ligne.element_libelle ?? null,
    titre: ligne.titre ?? "",
    nature: ligne.nature ?? "",
    niveau: ligne.niveau,
    description: ligne.description,
    impact: ligne.impact,
    escalade: ligne.escalade ? normaliserRole(ligne.escalade) : null,
  }));

  const photos: Photo[] = charge.photos.map((photo) => ({
    url: photo.url ?? null,
    elementId: photo.element_id ?? null,
    elementLibelle: photo.element_libelle ?? null,
    legende: photo.legende,
    heure: photo.heure,
    latitude: photo.latitude,
    longitude: photo.longitude,
    gpsConfirme: photo.gps_confirme,
  }));

  const redacteur = charge.chantier.redacteur_nom ?? charge.chantier.chef_chantier_nom ?? "";

  return {
    ...versEntree(charge),
    localisation: charge.localisation,
    intervenants: {
      redacteur,
      validateurs: charge.validateurs_nom ?? charge.conducteur_travaux_nom ?? "",
      approbateurs: charge.approbateurs_nom ?? charge.chef_projet_nom ?? "",
    },
    heureDebut: charge.heure_debut,
    heureFin: charge.heure_fin,
    arret: charge.arret ?? null,
    meteo: {
      matin: charge.meteo.matin ?? "",
      apresMidi: charge.meteo.apres_midi ?? "",
      conditions: charge.meteo.conditions ?? "",
    },
    effectifs,
    equipes,
    travaux,
    materiaux,
    livraisons,
    besoins,
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
    previsions: charge.previsions.map(versPrevision),
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
    etapeASigner: normaliserEtapeSignable(charge.etape_a_signer),
    redaction: charge.redaction
      ? {
          appreciation: charge.redaction.appreciation,
          objectifs: charge.redaction.objectifs.map(versObjectif),
        }
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
    approbateurs: charge.approbateurs_nom ?? charge.chef_projet_nom ?? "",
    validateurs: charge.validateurs_nom ?? charge.conducteur_travaux_nom ?? "",
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
        modeMesure: activite.mode_mesure ?? "QUANTITE",
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
 * Lectures et circuit de signatures.
 * ------------------------------------------------------------------ */

export const SYNTHESE_DISPONIBLE = true;

export async function lireJournal(signal?: AbortSignal): Promise<Journal> {
  const charge = await api.lire<ChargeJournal>("/chantier/journal/", undefined, signal);
  return {
    aujourdhui: charge.aujourdhui,
    estJourOuvre: charge.est_jour_ouvre ?? true,
    joursSaisissables: charge.jours_saisissables ?? [],
    luLe: charge.lu_le,
    entrees: charge.resultats.map(versEntree),
  };
}

export async function lireRapport(id: string, signal?: AbortSignal): Promise<RapportJournalier> {
  return versRapport(await api.lire<ChargeRapport>(`/chantier/rapports/${id}/`, undefined, signal));
}

export async function validerRapport(id: string, commentaire: string): Promise<RapportJournalier> {
  return versRapport(
    await api.creer<ChargeRapport>(`/chantier/rapports/${id}/valider/`, { commentaire }),
  );
}

export async function approuverRapport(
  id: string,
  commentaire: string,
): Promise<RapportJournalier> {
  return versRapport(
    await api.creer<ChargeRapport>(`/chantier/rapports/${id}/approuver/`, { commentaire }),
  );
}

export async function rejeterRapport(id: string, motif: string): Promise<RapportJournalier> {
  return versRapport(await api.creer<ChargeRapport>(`/chantier/rapports/${id}/rejeter/`, { motif }));
}

export async function relancer(id: string): Promise<{ relanceLe: string }> {
  const charge = await api.creer<{ relance_le: string }>(`/chantier/journal/${id}/relancer/`, {});
  return { relanceLe: charge.relance_le };
}

/* ------------------------------------------------------------------ *
 * Synthèse périodique.
 * ------------------------------------------------------------------ */

function versPeriode(demande: DemandeSynthese) {
  return {
    projet: demande.projetId,
    type: demande.type,
    date_debut: demande.debut,
    date_fin: demande.fin,
  };
}

export async function lireSynthese(
  demande: DemandeSynthese,
  signal?: AbortSignal,
): Promise<SynthesePeriodique> {
  return versSynthese(
    await api.lire<ChargeSynthese>("/chantier/syntheses/", versPeriode(demande), signal),
  );
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

export async function enregistrerSynthese(
  demande: DemandeSynthese,
  redaction: RedactionSynthese,
): Promise<SynthesePeriodique> {
  return versSynthese(
    await api.creer<ChargeSynthese>(
      "/chantier/syntheses/redaction/",
      versChargeRedaction(demande, redaction),
    ),
  );
}

export async function soumettreSynthese(
  demande: DemandeSynthese,
  redaction: RedactionSynthese,
): Promise<SynthesePeriodique> {
  return versSynthese(
    await api.creer<ChargeSynthese>(
      "/chantier/syntheses/soumettre/",
      versChargeRedaction(demande, redaction),
    ),
  );
}

export async function approuverSynthese(
  id: string,
  commentaire: string,
): Promise<SynthesePeriodique> {
  return versSynthese(
    await api.creer<ChargeSynthese>(`/chantier/syntheses/${id}/approuver/`, { commentaire }),
  );
}

export async function rejeterSynthese(id: string, motif: string): Promise<SynthesePeriodique> {
  return versSynthese(
    await api.creer<ChargeSynthese>(`/chantier/syntheses/${id}/rejeter/`, { motif }),
  );
}

interface ChargeSuiviSynthese {
  id: string;
  projet_id: string;
  type: TypePeriode;
  date_debut: string;
  date_fin: string;
  statut: StatutSynthese;
}

export async function lireSuiviSyntheses(signal?: AbortSignal): Promise<SuiviSynthese[]> {
  const charge = await api.lire<{ resultats: ChargeSuiviSynthese[] }>(
    "/chantier/syntheses/suivi/",
    undefined,
    signal,
  );
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
 * Préparation et écriture de la saisie du rapport journalier.
 * ------------------------------------------------------------------ */

interface ChargeSaisie {
  projet_id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  arret: { motif: MotifArret; precision: string } | null;
  meteo: {
    matin: Meteo | "";
    apres_midi: Meteo | "";
    conditions: ConditionsTravail | "";
  };
  equipes: {
    equipe_id: string;
    presents: string[];
    retards: string[];
    heures: number | null;
    qualite: QualiteExecution | "";
    observation: string;
  }[];
  lots_travailles: { lot_id: string; observation: string }[];
  activites: {
    activite_id: string;
    equipe_ids: string[];
    quantite_jour: number | null;
    pourcentage_jour: number | null;
    jalon_atteint: boolean;
    localisation: string;
    observation: string;
  }[];
  materiaux: { designation: string; quantite_consommee: number | null; unite: string }[];
  livraisons: {
    fournisseur: string;
    designation: string;
    quantite: number | null;
    unite: string;
    bon_livraison: string;
    heure: string;
    conformite: Conformite | "";
    observation: string;
  }[];
  besoins: {
    nature: "RUPTURE" | "URGENT";
    designation: string;
    quantite: number | null;
    unite: string;
    observation: string;
  }[];
  equipements: {
    cle: string;
    designation: string;
    reference: string;
    propriete: ProprieteEquipement | "";
    heures_utilisation: number | null;
    usage: string;
    operateur: string;
    etat: EtatEquipement | "";
    duree_arret: number | null;
    observation: string;
  }[];
  incidents: {
    cle: string;
    nature: IncidentSaisi["nature"];
    type: IncidentSaisi["type"];
    heure_debut: string;
    heure_fin: string;
    gravite: IncidentSaisi["gravite"];
    decide_par: DecideurIncident | "";
    description: string;
    action_entreprise: string;
  }[];
  blocages: {
    cle: string;
    blocage_id: string | null;
    element_id: string | null;
    titre: string;
    niveau: NiveauBlocage;
    nature: NatureBlocage | "";
    description: string;
    impact: string;
  }[];
  photos: {
    cle: string;
    element_id: string | null;
    fichier: string;
    legende: string;
    horodatage_utc: string;
    latitude: number | null;
    longitude: number | null;
  }[];
  pieces_jointes: {
    cle: string;
    fichier: string;
    nom: string;
    type_mime: string;
    taille: number;
  }[];
  previsions: {
    activite_id: string | null;
    equipe_id: string | null;
    activite: string;
    equipe: string;
    objectif: string;
    prerequis: string;
  }[];
  note_redacteur: string;
}

interface ChargeRapportExistant {
  id: string;
  statut: StatutBrut;
  saisie: ChargeSaisie;
  enregistre_le: string;
  commentaire_rejet: string | null;
  alertes_envoyees: string[];
}

interface ChargePreparation {
  aujourdhui: string;
  est_jour_ouvre: boolean;
  jours_saisissables: string[];
  meteo_suggeree: {
    matin: Meteo;
    apres_midi: Meteo;
    conditions: ConditionsTravail;
    source_auto: boolean;
  } | null;
  previsions_veille: ChargePrevision[];
  blocages_ouverts: {
    id: string;
    titre: string;
    severite: string;
    statut: string;
    element_id: string | null;
    element_libelle: string | null;
    ouvert_le: string;
  }[];
  projet: {
    id: string;
    nom: string;
    reference: string;
    redacteur_nom?: string;
    chef_chantier_nom?: string;
  };
  lots: ChargeLot[];
  sections: SectionSaisie[];
  activites: {
    activite_id: string;
    lot_id: string;
    mode_mesure: ModeMesureFeuille;
    code: string;
    libelle: string;
    chemin_libelle: string;
    unite: ActivitePreparee["unite"];
    quantite_prevue: number;
    cumul_veille: number;
    pourcentage_veille: number;
    avancement_theorique: number;
    equipes_affectees: string[];
    attendue_ce_jour: boolean;
  }[];
  materiaux: {
    materiau_id: string;
    designation: string;
    unite: string;
    stock_debut: number;
    seuil_alerte: number;
  }[];
  reprises: {
    equipements: {
      designation: string;
      reference: string;
      propriete: ProprieteEquipement | "";
      operateur: string;
      usage?: string;
    }[];
    equipes?: { equipe_id: string; presents: string[] }[];
  };
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
    },
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
      equipe_ids: ligne.equipeIds,
      quantite_jour: ligne.quantiteJour,
      pourcentage_jour: ligne.pourcentageJour,
      jalon_atteint: ligne.jalonAtteint,
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
      unite: ligne.unite,
      bon_livraison: ligne.bonLivraison,
      heure: ligne.heure,
      conformite: ligne.conformite,
      observation: ligne.observation,
    })),
    besoins: saisie.besoins.map((besoin) => ({
      nature: besoin.nature,
      designation: besoin.designation,
      quantite: besoin.quantite,
      unite: besoin.unite,
      observation: besoin.observation,
    })),
    equipements: saisie.equipements.map((ligne) => ({
      cle: ligne.cle,
      designation: ligne.designation,
      reference: ligne.reference,
      propriete: ligne.propriete,
      heures_utilisation: ligne.heuresUtilisation,
      usage: ligne.usage,
      operateur: ligne.operateur,
      etat: ligne.etat,
      duree_arret: ligne.dureeArret,
      observation: ligne.observation,
    })),
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
    blocages: saisie.blocages.map((blocage) => ({
      cle: blocage.cle,
      blocage_id: blocage.blocageId || null,
      element_id: blocage.elementId || null,
      titre: blocage.titre,
      niveau: blocage.niveau,
      nature: blocage.nature,
      description: blocage.description,
      impact: blocage.impact,
    })),
    photos: saisie.photos.map((photo) => ({
      cle: photo.cle,
      element_id: photo.elementId || null,
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
    previsions: saisie.previsions.map((prevision) => ({
      activite_id: prevision.activiteId || null,
      equipe_id: prevision.equipeId || null,
      activite: prevision.activite,
      equipe: prevision.equipe,
      objectif: prevision.objectif,
      prerequis: prevision.prerequis,
    })),
    note_redacteur: saisie.noteRedacteur,
  };
}

function versSaisieDomaine(charge: ChargeSaisie): SaisieRapport {
  return {
    projetId: charge.projet_id,
    date: charge.date,
    heureDebut: charge.heure_debut ?? "",
    heureFin: charge.heure_fin ?? "",
    arret: charge.arret ?? null,
    meteo: {
      matin: charge.meteo?.matin ?? "",
      apresMidi: charge.meteo?.apres_midi ?? "",
      conditions: charge.meteo?.conditions ?? "",
    },
    equipes: (charge.equipes ?? []).map((ligne) => ({
      equipeId: ligne.equipe_id,
      presents: ligne.presents ?? [],
      retards: ligne.retards ?? [],
      heures: ligne.heures ?? null,
      qualite: ligne.qualite ?? "",
      observation: ligne.observation ?? "",
    })),
    lotsTravailles: (charge.lots_travailles ?? []).map((point) => ({
      lotId: point.lot_id,
      observation: point.observation ?? "",
    })),
    activites: (charge.activites ?? []).map((ligne) => ({
      activiteId: ligne.activite_id,
      equipeIds: ligne.equipe_ids ?? [],
      quantiteJour: ligne.quantite_jour ?? null,
      pourcentageJour: ligne.pourcentage_jour ?? null,
      jalonAtteint: ligne.jalon_atteint ?? false,
      localisation: ligne.localisation ?? "",
      observation: ligne.observation ?? "",
    })),
    materiaux: (charge.materiaux ?? []).map((ligne) => ({
      designation: ligne.designation ?? "",
      quantite: ligne.quantite_consommee ?? null,
      unite: ligne.unite ?? "",
    })),
    livraisons: (charge.livraisons ?? []).map((ligne) => ({
      fournisseur: ligne.fournisseur ?? "",
      designation: ligne.designation ?? "",
      quantite: ligne.quantite ?? null,
      unite: ligne.unite ?? "",
      bonLivraison: ligne.bon_livraison ?? "",
      heure: ligne.heure ?? "",
      conformite: (ligne.conformite || "CONFORME") as Conformite,
      observation: ligne.observation ?? "",
    })),
    besoins: (charge.besoins ?? []).map((besoin) => ({
      nature: besoin.nature,
      designation: besoin.designation ?? "",
      quantite: besoin.quantite ?? null,
      unite: besoin.unite ?? "",
      observation: besoin.observation ?? "",
    })),
    equipements: (charge.equipements ?? []).map((ligne, index) => ({
      cle: ligne.cle || `eq-${index}`,
      designation: ligne.designation ?? "",
      reference: ligne.reference ?? "",
      propriete: ligne.propriete ?? "",
      heuresUtilisation: ligne.heures_utilisation ?? null,
      usage: ligne.usage ?? "",
      operateur: ligne.operateur ?? "",
      etat: ligne.etat ?? "",
      dureeArret: ligne.duree_arret ?? null,
      observation: ligne.observation ?? "",
    })),
    incidents: (charge.incidents ?? []).map((incident, index) => ({
      cle: incident.cle || `inc-${index}`,
      nature: incident.nature ?? "EVENEMENT_PARTICULIER",
      type: incident.type ?? "",
      heureDebut: incident.heure_debut ?? "",
      heureFin: incident.heure_fin ?? "",
      gravite: incident.gravite ?? "",
      decidePar: normaliserDecideur(incident.decide_par),
      description: incident.description ?? "",
      action: incident.action_entreprise ?? "",
    })),
    blocages: (charge.blocages ?? []).map((blocage, index) => ({
      cle: blocage.cle || `blc-${index}`,
      blocageId: blocage.blocage_id ?? null,
      elementId: blocage.element_id ?? null,
      titre: blocage.titre ?? "",
      niveau: blocage.niveau,
      nature: blocage.nature ?? "",
      description: blocage.description ?? "",
      impact: blocage.impact ?? "",
    })),
    photos: (charge.photos ?? []).map((photo, index) => ({
      cle: photo.cle || `ph-${index}`,
      elementId: photo.element_id ?? null,
      url: photo.fichier,
      legende: photo.legende ?? "",
      priseLe: photo.horodatage_utc ?? "",
      latitude: photo.latitude ?? null,
      longitude: photo.longitude ?? null,
    })),
    piecesJointes: (charge.pieces_jointes ?? []).map((piece, index) => ({
      cle: piece.cle || `pj-${index}`,
      url: piece.fichier,
      nom: piece.nom,
      type: piece.type_mime,
      taille: piece.taille,
    })),
    previsions: (charge.previsions ?? []).map(versPrevision),
    noteRedacteur: charge.note_redacteur ?? "",
  };
}

function versRapportExistant(charge: ChargeRapportExistant): RapportExistant {
  return {
    id: charge.id,
    statut: normaliserStatut(charge.statut),
    saisie: versSaisieDomaine(charge.saisie),
    enregistreLe: charge.enregistre_le,
    commentaireRejet: charge.commentaire_rejet,
    alertesEnvoyees: charge.alertes_envoyees ?? [],
  };
}

function versPreparation(charge: ChargePreparation): PreparationSaisie {
  const meteoSuggeree: MeteoSuggeree | null = charge.meteo_suggeree
    ? {
        matin: charge.meteo_suggeree.matin,
        apresMidi: charge.meteo_suggeree.apres_midi,
        conditions: charge.meteo_suggeree.conditions,
        sourceAuto: charge.meteo_suggeree.source_auto,
      }
    : null;

  const blocagesOuverts: BlocageOuvert[] = (charge.blocages_ouverts ?? []).map((b) => ({
    id: b.id,
    titre: b.titre,
    severite: b.severite,
    statut: b.statut,
    elementId: b.element_id,
    elementLibelle: b.element_libelle,
    ouvertLe: b.ouvert_le,
  }));

  return {
    aujourdhui: charge.aujourdhui,
    estJourOuvre: charge.est_jour_ouvre ?? true,
    joursSaisissables: charge.jours_saisissables ?? [],
    meteoSuggeree,
    previsionsVeille: (charge.previsions_veille ?? []).map(versPrevision),
    blocagesOuverts,
    projet: {
      id: charge.projet.id,
      nom: charge.projet.nom,
      reference: charge.projet.reference,
      redacteur: charge.projet.redacteur_nom ?? charge.projet.chef_chantier_nom ?? "",
    },
    lots: charge.lots.map(versLot),
    sections: charge.sections,
    activites: charge.activites.map((activite) => ({
      activiteId: activite.activite_id,
      lotId: activite.lot_id,
      modeMesure: activite.mode_mesure ?? "QUANTITE",
      code: activite.code,
      libelle: activite.libelle,
      cheminLibelle: activite.chemin_libelle ?? activite.libelle,
      unite: activite.unite,
      quantitePrevue: activite.quantite_prevue,
      cumulVeille: activite.cumul_veille,
      pourcentageVeille: activite.pourcentage_veille ?? 0,
      avancementTheorique: activite.avancement_theorique,
      equipesAffectees: activite.equipes_affectees ?? [],
      attendueCeJour: activite.attendue_ce_jour ?? true,
    })),
    materiaux: charge.materiaux.map((materiau) => ({
      materiauId: materiau.materiau_id,
      designation: materiau.designation,
      unite: materiau.unite,
      stockDebut: materiau.stock_debut,
      seuilAlerte: materiau.seuil_alerte,
    })),
    reprises: {
      equipements: (charge.reprises.equipements ?? []).map((equipement) => ({
        designation: equipement.designation,
        reference: equipement.reference,
        propriete: equipement.propriete,
        operateur: equipement.operateur,
        usage: equipement.usage ?? "",
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
  est_jour_ouvre?: boolean;
  jours_saisissables?: string[];
  resultats: { id: string; date: string; statut: StatutBrut; enregistre_le: string }[];
}

export async function lireRapportsProjet(
  projetId: string,
  signal?: AbortSignal,
): Promise<RapportsProjet> {
  const charge = await api.lire<ChargeRapportsProjet>(
    "/chantier/rapports/",
    { auteur: "moi", projet: projetId },
    signal,
  );
  return {
    aujourdhui: charge.aujourdhui,
    estJourOuvre: charge.est_jour_ouvre ?? true,
    joursSaisissables: charge.jours_saisissables ?? [],
    rapports: charge.resultats.map((rapport) => ({
      id: rapport.id,
      date: rapport.date,
      statut: normaliserStatut(rapport.statut),
      enregistreLe: rapport.enregistre_le,
    })),
  };
}

export async function preparerSaisie(
  projetId: string,
  date: string,
  signal?: AbortSignal,
): Promise<PreparationSaisie> {
  return versPreparation(
    await api.lire<ChargePreparation>(
      "/chantier/rapports/preparation/",
      { projet: projetId, date },
      signal,
    ),
  );
}

export async function enregistrerBrouillon(
  id: string | null,
  saisie: SaisieRapport,
): Promise<RapportExistant> {
  const charge = id
    ? await api.modifier<ChargeRapportExistant>(
        `/chantier/rapports/${id}/draft/`,
        versChargeSaisie(saisie),
      )
    : await api.creer<ChargeRapportExistant>("/chantier/rapports/", versChargeSaisie(saisie));
  return versRapportExistant(charge);
}

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

export async function envoyerAlerte(
  id: string,
  alerte: AlerteImmediate,
): Promise<{ envoyeeLe: string }> {
  const cle = cleAlerte(alerte);
  const charge = await api.creer<{ envoyee_le: string }>(`/chantier/rapports/${id}/alertes/`, {
    cle,
    type: alerte.type,
    description: alerte.description,
  });
  return { envoyeeLe: charge.envoyee_le };
}

/**
 * La saisie du rapport journalier — schéma zod et traductions (couche 3).
 *
 * Ni React, ni réseau. Le formulaire tient des **chaînes** (un champ numérique
 * vide n'est pas zéro, et `12,5` se tape avec une virgule) ; `versSaisie` les
 * ramène aux nombres du domaine, `valeursDepuis` fait le chemin inverse.
 *
 * Deux niveaux d'exigence, comme le dit le SFD §6 :
 * - **enregistrer** un brouillon n'exige rien — il se sauve toutes les 30 s,
 *   à moitié rempli ;
 * - **soumettre** exige tout ce que les sections *du chantier* rendent obligatoire.
 *   Le schéma se construit donc à partir des sections que le serveur a
 *   données (`schemaRapport`), jamais d'après un mode lu ailleurs.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import type messages from "@/messages/fr.json";
import { saisieEnCentimes } from "@/lib/format";

import {
  HEURES_MAX_JOUR,
  jourSaisissable,
  LONGUEUR_MIN_DESCRIPTION_INCIDENT,
  LONGUEUR_MIN_NOTE,
  PHOTOS_MAX,
  PIECES_JOINTES_MAX,
  activitesSuivies,
  categorieEvenement,
  lotsSuivisAvancement,
  lotsTravaillesDe,
  sectionsActives,
} from "./regles";
import type {
  Conformite,
  ConditionsTravail,
  EtatEquipement,
  GraviteIncident,
  Meteo,
  MotifArret,
  NatureBlocage,
  NatureEvenement,
  NiveauBlocageSaisi,
  PreparationSaisie,
  PresenceSousTraitant,
  ProprieteEquipement,
  QualiteExecution,
  RoleSignataire,
  SaisieRapport,
  TypeIncident,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les listes fermées, dans l'ordre où le terrain les choisit.
 * ------------------------------------------------------------------ */

export const METEOS: readonly Meteo[] = ["ENSOLEILLE", "NUAGEUX", "PLUVIEUX", "ORAGEUX", "BRUMEUX"];
export const CONDITIONS_TRAVAIL: readonly ConditionsTravail[] = ["FAVORABLES", "DIFFICILES", "ARRET"];
export const MOTIFS_ARRET: readonly MotifArret[] = ["INTEMPERIES", "JOUR_FERIE", "AUTRE"];
export const PRESENCES_SOUS_TRAITANT: readonly PresenceSousTraitant[] = ["PRESENT", "PARTIEL", "ABSENT"];
export const QUALITES_EXECUTION: readonly QualiteExecution[] = ["CONFORME", "NON_CONFORME"];
export const CONFORMITES: readonly Conformite[] = ["CONFORME", "PARTIELLE", "NON_CONFORME"];
export const PROPRIETES_EQUIPEMENT: readonly ProprieteEquipement[] = ["ENTREPRISE", "LOCATION"];
export const ETATS_EQUIPEMENT: readonly EtatEquipement[] = ["BON", "ENTRETIEN", "PANNE"];
export const TYPES_INCIDENT: readonly TypeIncident[] = [
  "QUALITE",
  "SECURITE",
  "MATERIEL",
  "APPROVISIONNEMENT",
  "ADMINISTRATIF",
];
/** Les événements du cahier « Journal de chantier intelligent » §2, dans son ordre. */
export const NATURES_EVENEMENT: readonly NatureEvenement[] = [
  "INCIDENT",
  "DIFFICULTE_TECHNIQUE",
  "NON_CONFORMITE",
  "RETARD",
  "INTEMPERIE",
  "ARRET_TRAVAUX",
  "INSTRUCTION",
  "EVENEMENT_PARTICULIER",
];
export const NATURES_BESOIN = ["RUPTURE", "URGENT"] as const;
export const GRAVITES: readonly GraviteIncident[] = ["MINEUR", "SIGNIFICATIF", "GRAVE"];
export const DECIDEURS: readonly RoleSignataire[] = ["CC", "CT", "CP"];
export const NIVEAUX_BLOCAGE: readonly NiveauBlocageSaisi[] = ["AUCUN", "MINEUR", "SIGNIFICATIF", "BLOQUANT"];
export const NATURES_BLOCAGE: readonly NatureBlocage[] = [
  "APPROVISIONNEMENT",
  "METEO",
  "MAIN_OEUVRE",
  "TECHNIQUE",
  "ADMINISTRATIF",
  "SECURITE",
];

/** Les horaires par défaut d'une journée de chantier. */
const HEURE_DEBUT_DEFAUT = "07:30";
const HEURE_FIN_DEFAUT = "17:00";
/** Les heures par ouvrier d'une journée pleine, proposées sur une ligne neuve. */
export const HEURES_PAR_DEFAUT = "8";

/* ------------------------------------------------------------------ *
 * La forme du formulaire.
 * ------------------------------------------------------------------ */

const photo = z.object({
  cle: z.string(),
  url: z.string(),
  legende: z.string(),
  priseLe: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

const forme = z.object({
  date: z.string(),
  heureDebut: z.string(),
  heureFin: z.string(),
  arret: z.boolean(),
  motifArret: z.string(),
  precisionArret: z.string(),
  meteo: z.object({
    matin: z.string(),
    apresMidi: z.string(),
    conditions: z.string(),
    temperatureMin: z.string(),
    temperatureMax: z.string(),
    humidite: z.string(),
    vent: z.string(),
    prevision: z.string(),
  }),
  effectifs: z.array(
    z.object({
      categorie: z.string(),
      prevus: z.string(),
      presents: z.string(),
      retards: z.string(),
      heures: z.string(),
      observation: z.string(),
    }),
  ),
  presenceSousTraitant: z.object({
    presence: z.string(),
    motif: z.string(),
    qualite: z.string(),
    observation: z.string(),
  }),
  production: z.array(
    z.object({ intervenant: z.string(), activiteId: z.string(), quantiteJour: z.string(), prixUnitaire: z.string() }),
  ),
  lotsTravailles: z.array(z.object({ lotId: z.string(), observation: z.string() })),
  activites: z.array(
    z.object({ activiteId: z.string(), quantiteJour: z.string(), localisation: z.string(), observation: z.string() }),
  ),
  materiaux: z.array(z.object({ designation: z.string(), quantite: z.string(), unite: z.string() })),
  livraisons: z.array(
    z.object({
      fournisseur: z.string(),
      designation: z.string(),
      quantite: z.string(),
      bonLivraison: z.string(),
      heure: z.string(),
      conformite: z.string(),
      observation: z.string(),
    }),
  ),
  besoins: z.array(
    z.object({ nature: z.string(), designation: z.string(), quantite: z.string(), observation: z.string() }),
  ),
  equipements: z.array(
    z.object({
      designation: z.string(),
      reference: z.string(),
      propriete: z.string(),
      utilisation: z.string(),
      operateur: z.string(),
      etat: z.string(),
      dureeArret: z.string(),
      observation: z.string(),
    }),
  ),
  incidents: z.array(
    z.object({
      cle: z.string(),
      nature: z.string(),
      type: z.string(),
      heureDebut: z.string(),
      heureFin: z.string(),
      gravite: z.string(),
      decidePar: z.string(),
      description: z.string(),
      action: z.string(),
    }),
  ),
  blocage: z.object({ niveau: z.string(), nature: z.string(), description: z.string(), impact: z.string() }),
  photos: z.array(photo),
  piecesJointes: z.array(
    z.object({ cle: z.string(), nom: z.string(), type: z.string(), taille: z.number(), url: z.string() }),
  ),
  previsions: z.array(z.object({ activite: z.string(), equipe: z.string(), objectif: z.string(), prerequis: z.string() })),
  note: z.string(),
});

export type ValeursRapport = z.infer<typeof forme>;

/* ------------------------------------------------------------------ *
 * Les nombres tapés au clavier.
 * ------------------------------------------------------------------ */

/** « 12,5 » ou « 12.5 » → 12,5 ; une saisie vide ou illisible → `null`. */
export function versNombre(saisie: string): number | null {
  const propre = saisie.replace(/\s/g, "").replace(",", ".");
  if (propre === "") return null;
  const nombre = Number(propre);
  return Number.isFinite(nombre) ? nombre : null;
}

function enChaine(nombre: number | null | undefined): string {
  return nombre === null || nombre === undefined ? "" : String(nombre).replace(".", ",");
}

export function estRenseigne(saisie: string): boolean {
  return saisie.trim() !== "";
}

/* ------------------------------------------------------------------ *
 * Le schéma de soumission.
 * ------------------------------------------------------------------ */

type CleErreur = keyof (typeof messages)["journal"]["saisie"]["erreurs"];

const erreur = (cle: CleErreur, valeurs?: Record<string, string | number>) =>
  texte(`journal.saisie.erreurs.${cle}`, valeurs);

/**
 * Le schéma qu'un rapport doit satisfaire pour être **soumis**, d'après les
 * sections du chantier. Un brouillon, lui, s'enregistre sans passer par ici.
 */
export function schemaRapport(
  preparation: Pick<PreparationSaisie, "sections" | "aujourdhui" | "activites">,
) {
  const avancement = activitesSuivies(preparation, "AVANCEMENT");
  return forme.superRefine((valeurs, ctx) => {
    const signaler = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    const sections = sectionsActives(preparation.sections, valeurs.arret);
    const requis = erreur("requis");

    // Le contexte.
    if (!jourSaisissable(valeurs.date, preparation.aujourdhui)) signaler(["date"], erreur("dateHorsDelai"));
    if (!valeurs.heureDebut) signaler(["heureDebut"], requis);
    if (!valeurs.heureFin) signaler(["heureFin"], requis);
    if (valeurs.heureDebut && valeurs.heureFin && valeurs.heureFin <= valeurs.heureDebut) {
      signaler(["heureFin"], erreur("heuresIncoherentes"));
    }
    if (valeurs.arret && !valeurs.motifArret) signaler(["motifArret"], requis);
    const temperatures = ["temperatureMin", "temperatureMax", "humidite"] as const;
    for (const champ of temperatures) {
      if (estRenseigne(valeurs.meteo[champ]) && versNombre(valeurs.meteo[champ]) === null) {
        signaler(["meteo", champ], erreur("nombre"));
      }
    }
    const humidite = versNombre(valeurs.meteo.humidite);
    if (humidite !== null && (humidite < 0 || humidite > 100)) signaler(["meteo", "humidite"], erreur("pourcentage"));

    // Une journée d'arrêt s'arrête à la journée : les autres étapes ne
    // s'affichent pas, rien de ce qu'elles portent ne peut être exigé.
    if (valeurs.arret) return;

    // Les effectifs — régie directe.
    if (sections.includes("EFFECTIFS")) {
      if (valeurs.effectifs.length === 0) signaler(["effectifs"], erreur("effectifsVides"));
      valeurs.effectifs.forEach((ligne, rang) => {
        if (!ligne.categorie.trim()) signaler(["effectifs", rang, "categorie"], requis);
        const prevus = versNombre(ligne.prevus);
        const presents = versNombre(ligne.presents);
        const retards = versNombre(ligne.retards);
        const heures = versNombre(ligne.heures);
        if (prevus === null || prevus < 0 || !Number.isInteger(prevus)) signaler(["effectifs", rang, "prevus"], erreur("entier"));
        if (presents === null || presents < 0 || !Number.isInteger(presents)) {
          signaler(["effectifs", rang, "presents"], erreur("entier"));
        }
        if (presents !== null && presents > 0 && (heures === null || heures <= 0 || heures > HEURES_MAX_JOUR)) {
          signaler(["effectifs", rang, "heures"], erreur("heuresTravaillees", { max: HEURES_MAX_JOUR }));
        }
        if (estRenseigne(ligne.retards)) {
          if (retards === null || retards < 0 || !Number.isInteger(retards)) {
            signaler(["effectifs", rang, "retards"], erreur("entier"));
          } else if (presents !== null && retards > presents) {
            signaler(["effectifs", rang, "retards"], erreur("retardsPresents"));
          }
        }
        const absences = prevus !== null && presents !== null && presents < prevus;
        if ((absences || (retards ?? 0) > 0) && !ligne.observation.trim()) {
          signaler(["effectifs", rang, "observation"], erreur("motifAbsence"));
        }
      });
    }

    // La présence du sous-traitant — sous-traitance structurée.
    if (sections.includes("PRESENCE_SOUS_TRAITANT")) {
      const presence = valeurs.presenceSousTraitant;
      if (!presence.presence) signaler(["presenceSousTraitant", "presence"], requis);
      if (presence.presence === "ABSENT" && !presence.motif.trim()) {
        signaler(["presenceSousTraitant", "motif"], erreur("motifAbsenceSousTraitant"));
      }
      if (presence.presence !== "ABSENT" && !presence.qualite) signaler(["presenceSousTraitant", "qualite"], requis);
      if (presence.qualite === "NON_CONFORME" && !presence.observation.trim()) {
        signaler(["presenceSousTraitant", "observation"], erreur("nonConformite"));
      }
    }

    // La production des tâcherons — sous-traitance informelle.
    if (sections.includes("PRODUCTION")) {
      // Seule, la production est la seule preuve de la journée ; à côté de
      // lots suivis à l'avancement, elle peut manquer un jour.
      if (valeurs.production.length === 0 && !sections.includes("AVANCEMENT")) {
        signaler(["production"], erreur("productionVide"));
      }
      valeurs.production.forEach((ligne, rang) => {
        if (!ligne.intervenant.trim()) signaler(["production", rang, "intervenant"], requis);
        if (!ligne.activiteId) signaler(["production", rang, "activiteId"], requis);
        const quantite = versNombre(ligne.quantiteJour);
        if (quantite === null || quantite < 0) signaler(["production", rang, "quantiteJour"], erreur("quantite"));
      });
    }

    // L'avancement se déclare lot par lot : le chef de chantier choisit les
    // lots travaillés, et seules leurs activités comptent. Un champ vide vaut
    // « rien ce jour » ; un lot travaillé sans aucune quantité dit pourquoi.
    let avancementDuJour = false;
    if (sections.includes("AVANCEMENT")) {
      const travailles = new Set(valeurs.lotsTravailles.map((point) => point.lotId));
      const lotsAvances = new Set<string>();
      valeurs.activites.forEach((ligne, rang) => {
        const lotId = avancement[rang]?.lotId;
        if (!lotId || !travailles.has(lotId) || !estRenseigne(ligne.quantiteJour)) return;
        const quantite = versNombre(ligne.quantiteJour);
        if (quantite === null || quantite < 0) signaler(["activites", rang, "quantiteJour"], erreur("quantite"));
        else if (quantite > 0) {
          avancementDuJour = true;
          lotsAvances.add(lotId);
        }
      });
      valeurs.lotsTravailles.forEach((point, rang) => {
        if (!lotsAvances.has(point.lotId) && !point.observation.trim()) {
          signaler(["lotsTravailles", rang, "observation"], erreur("lotSansAvancement"));
        }
      });
      // Une journée travaillée sans lot ni production est une journée d'arrêt
      // qui ne dit pas son nom.
      const productionDuJour = valeurs.production.some((ligne) => (versNombre(ligne.quantiteJour) ?? 0) > 0);
      if (avancement.length > 0 && valeurs.lotsTravailles.length === 0 && !productionDuJour) {
        signaler(["lotsTravailles"], erreur("lotsVides"));
      }
    }

    // Les matériaux — saisis librement, exigés dès que le chantier a avancé (SFD §5.2).
    if (sections.includes("MATERIAUX")) {
      let consommation = false;
      valeurs.materiaux.forEach((ligne, rang) => {
        if (!ligne.designation.trim()) signaler(["materiaux", rang, "designation"], requis);
        if (!ligne.unite.trim()) signaler(["materiaux", rang, "unite"], requis);
        const quantite = versNombre(ligne.quantite);
        if (quantite === null || quantite <= 0) signaler(["materiaux", rang, "quantite"], erreur("quantiteConsommee"));
        else consommation = true;
      });
      if (avancementDuJour && !consommation) signaler(["materiaux"], erreur("materiauxVides"));
    }

    if (sections.includes("LIVRAISONS")) {
      valeurs.livraisons.forEach((ligne, rang) => {
        if (!ligne.fournisseur.trim()) signaler(["livraisons", rang, "fournisseur"], requis);
        if (!ligne.designation.trim()) signaler(["livraisons", rang, "designation"], requis);
        if (!ligne.quantite.trim()) signaler(["livraisons", rang, "quantite"], requis);
        if (ligne.conformite !== "CONFORME" && !ligne.observation.trim()) {
          signaler(["livraisons", rang, "observation"], erreur("livraisonNonConforme"));
        }
      });
    }

    if (sections.includes("EQUIPEMENTS")) {
      valeurs.equipements.forEach((ligne, rang) => {
        if (!ligne.designation.trim()) signaler(["equipements", rang, "designation"], requis);
        if (estRenseigne(ligne.utilisation)) {
          const heures = versNombre(ligne.utilisation);
          if (heures === null || heures < 0 || heures > HEURES_MAX_JOUR) {
            signaler(["equipements", rang, "utilisation"], erreur("heuresTravaillees", { max: HEURES_MAX_JOUR }));
          }
        }
        // Une panne ou une immobilisation dit combien de temps l'engin est resté arrêté.
        if (ligne.etat !== "BON") {
          const arret = versNombre(ligne.dureeArret);
          if (arret === null || arret <= 0 || arret > HEURES_MAX_JOUR) {
            signaler(["equipements", rang, "dureeArret"], erreur("dureeArret", { max: HEURES_MAX_JOUR }));
          }
        }
        if (ligne.etat === "PANNE" && !ligne.observation.trim()) {
          signaler(["equipements", rang, "observation"], erreur("panne"));
        }
      });
    }

    // Les sections communes.
    valeurs.besoins.forEach((besoin, rang) => {
      if (!besoin.designation.trim()) signaler(["besoins", rang, "designation"], requis);
      if (besoin.nature === "URGENT" && !besoin.quantite.trim()) signaler(["besoins", rang, "quantite"], requis);
    });

    valeurs.incidents.forEach((incident, rang) => {
      if (incident.heureDebut && incident.heureFin && incident.heureFin <= incident.heureDebut) {
        signaler(["incidents", rang, "heureFin"], erreur("heuresIncoherentes"));
      }
      if (incident.description.trim().length < LONGUEUR_MIN_DESCRIPTION_INCIDENT) {
        signaler(["incidents", rang, "description"], erreur("descriptionCourte", { min: LONGUEUR_MIN_DESCRIPTION_INCIDENT }));
      }
      if (incident.gravite !== "MINEUR" && !incident.action.trim()) {
        signaler(["incidents", rang, "action"], erreur("actionRequise"));
      }
    });

    if (valeurs.blocage.niveau !== "AUCUN") {
      if (!valeurs.blocage.nature) signaler(["blocage", "nature"], requis);
      if (!valeurs.blocage.description.trim()) signaler(["blocage", "description"], requis);
    }

    if (valeurs.photos.length > PHOTOS_MAX) signaler(["photos"], erreur("tropDePhotos", { max: PHOTOS_MAX }));
    if (valeurs.piecesJointes.length > PIECES_JOINTES_MAX) {
      signaler(["piecesJointes"], erreur("tropDePieces", { max: PIECES_JOINTES_MAX }));
    }

    valeurs.previsions.forEach((prevision, rang) => {
      if (!prevision.activite.trim()) signaler(["previsions", rang, "activite"], requis);
      if (!prevision.objectif.trim()) signaler(["previsions", rang, "objectif"], requis);
    });

    if (valeurs.note.trim().length < LONGUEUR_MIN_NOTE) {
      signaler(["note"], erreur("noteCourte", { min: LONGUEUR_MIN_NOTE }));
    }
  });
}

/* ------------------------------------------------------------------ *
 * Domaine ↔ formulaire.
 * ------------------------------------------------------------------ */

/**
 * Le formulaire d'un chantier pour un jour : le rapport déjà commencé s'il existe,
 * sinon un rapport neuf **prérempli de ce que le terrain a déjà dit** — les
 * catégories d'ouvriers, les engins et les tâcherons du dernier rapport du
 * chantier. On ne ressaisit pas chaque matin ce qui n'a pas changé.
 */
export function valeursDepuis(preparation: PreparationSaisie, date: string): ValeursRapport {
  const existant = preparation.rapport?.saisie;
  const lotsAvancement = lotsSuivisAvancement(preparation);
  const quantites = new Map(existant?.activites.map((ligne) => [ligne.activiteId, ligne]) ?? []);
  const { reprises } = preparation;

  return {
    date: existant?.date ?? date,
    heureDebut: existant?.heureDebut ?? HEURE_DEBUT_DEFAUT,
    heureFin: existant?.heureFin ?? HEURE_FIN_DEFAUT,
    arret: existant?.arret != null,
    motifArret: existant?.arret?.motif ?? "",
    precisionArret: existant?.arret?.precision ?? "",
    meteo: {
      matin: existant?.meteo.matin ?? "ENSOLEILLE",
      apresMidi: existant?.meteo.apresMidi ?? "ENSOLEILLE",
      conditions: existant?.meteo.conditions ?? "FAVORABLES",
      temperatureMin: enChaine(existant?.meteo.temperatureMin),
      temperatureMax: enChaine(existant?.meteo.temperatureMax),
      humidite: enChaine(existant?.meteo.humidite),
      vent: existant?.meteo.vent ?? "",
      prevision: existant?.meteo.prevision ?? "",
    },
    effectifs: existant
      ? existant.effectifs.map((ligne) => ({
          categorie: ligne.categorie,
          prevus: enChaine(ligne.prevus),
          presents: enChaine(ligne.presents),
          // Un rapport d'avant les retards ne les porte pas.
          retards: enChaine(ligne.retards ?? null),
          heures: enChaine(ligne.heures),
          observation: ligne.observation,
        }))
      : reprises.effectifs.map((ligne) => ({
          categorie: ligne.categorie,
          prevus: String(ligne.prevus),
          presents: "",
          retards: "",
          heures: HEURES_PAR_DEFAUT,
          observation: "",
        })),
    presenceSousTraitant: {
      presence: existant?.presenceSousTraitant?.presence ?? "",
      motif: existant?.presenceSousTraitant?.motif ?? "",
      qualite: existant?.presenceSousTraitant?.qualite ?? "",
      observation: existant?.presenceSousTraitant?.observation ?? "",
    },
    production: existant
      ? existant.production.map((ligne) => ({
          intervenant: ligne.intervenant,
          activiteId: ligne.activiteId,
          quantiteJour: enChaine(ligne.quantiteJour),
          prixUnitaire: ligne.prixUnitaire === null ? "" : String(ligne.prixUnitaire / 100),
        }))
      : reprises.intervenants.map((ligne) => ({
          intervenant: ligne.intervenant,
          activiteId: ligne.activiteId,
          quantiteJour: "",
          prixUnitaire: String(ligne.prixUnitaire / 100),
        })),
    // Un rapport neuf part sans lot : le chef de chantier choisit ceux qu'il a
    // travaillés — sauf quand le chantier n'en a qu'un.
    lotsTravailles: existant
      ? lotsTravaillesDe(existant, preparation.activites)
      : lotsAvancement.length === 1
        ? lotsAvancement.map((lot) => ({ lotId: lot.id, observation: "" }))
        : [],
    // Une ligne par activité suivie à l'avancement, dans l'ordre du serveur :
    // l'index du formulaire suit celui de `activitesSuivies(…, "AVANCEMENT")`.
    activites: activitesSuivies(preparation, "AVANCEMENT").map((activite) => ({
      activiteId: activite.activiteId,
      quantiteJour: enChaine(quantites.get(activite.activiteId)?.quantiteJour),
      localisation: quantites.get(activite.activiteId)?.localisation ?? "",
      observation: quantites.get(activite.activiteId)?.observation ?? "",
    })),
    // Un rapport d'avant la saisie libre portait des lignes du stock, sans désignation.
    materiaux: (existant?.materiaux ?? [])
      .filter((ligne) => typeof ligne.designation === "string")
      .map((ligne) => ({ designation: ligne.designation, quantite: enChaine(ligne.quantite), unite: ligne.unite })),
    livraisons: existant?.livraisons ?? [],
    besoins: existant?.besoins ?? [],
    equipements: existant
      ? existant.equipements.map((equipement) => ({ ...equipement, dureeArret: enChaine(equipement.dureeArret ?? null) }))
      : reprises.equipements.map((equipement) => ({
          ...equipement,
          utilisation: "",
          etat: "BON",
          dureeArret: "",
          observation: "",
        })),
    // Un événement d'avant les natures était un incident.
    incidents: (existant?.incidents ?? []).map((incident) => ({
      ...incident,
      nature: incident.nature ?? "INCIDENT",
      heureDebut: incident.heureDebut ?? "",
      heureFin: incident.heureFin ?? "",
    })),
    blocage: {
      niveau: existant?.blocage.niveau ?? "AUCUN",
      nature: existant?.blocage.nature ?? "",
      description: existant?.blocage.description ?? "",
      impact: existant?.blocage.impact ?? "",
    },
    photos: existant?.photos ?? [],
    piecesJointes: existant?.piecesJointes ?? [],
    previsions: existant?.previsions ?? [],
    note: existant?.note ?? "",
  };
}

/**
 * Le formulaire, tel quel, en objet du domaine. Aucune exigence ici : un
 * brouillon passe par la même traduction qu'un rapport soumis. Les quantités
 * d'un lot retiré de la sélection restent dans le formulaire (le remettre les
 * retrouve) mais ne partent pas.
 */
export function versSaisie(
  valeurs: ValeursRapport,
  preparation: Pick<PreparationSaisie, "projet" | "activites">,
): SaisieRapport {
  const saisie = versSaisieComplete(valeurs, preparation);
  if (!valeurs.arret) return saisie;
  // Une journée d'arrêt ne porte que la journée : ce qu'on avait rempli
  // ailleurs avant de cocher reste dans le formulaire (décocher le retrouve),
  // mais ne part pas.
  return {
    ...saisie,
    effectifs: [],
    presenceSousTraitant: null,
    production: [],
    lotsTravailles: [],
    activites: [],
    materiaux: [],
    livraisons: [],
    besoins: [],
    equipements: [],
    incidents: [],
    blocage: { niveau: "AUCUN", nature: null, description: "", impact: "" },
    photos: [],
    piecesJointes: [],
    previsions: [],
    note: "",
  };
}

function versSaisieComplete(
  valeurs: ValeursRapport,
  preparation: Pick<PreparationSaisie, "projet" | "activites">,
): SaisieRapport {
  const presence = valeurs.presenceSousTraitant;
  const avancement = activitesSuivies(preparation, "AVANCEMENT");
  const travailles = new Set(valeurs.lotsTravailles.map((point) => point.lotId));
  return {
    projetId: preparation.projet.id,
    date: valeurs.date,
    heureDebut: valeurs.heureDebut,
    heureFin: valeurs.heureFin,
    arret: valeurs.arret
      ? { motif: (valeurs.motifArret || "AUTRE") as MotifArret, precision: valeurs.precisionArret.trim() }
      : null,
    meteo: {
      matin: valeurs.meteo.matin as Meteo,
      apresMidi: valeurs.meteo.apresMidi as Meteo,
      conditions: valeurs.meteo.conditions as ConditionsTravail,
      temperatureMin: versNombre(valeurs.meteo.temperatureMin),
      temperatureMax: versNombre(valeurs.meteo.temperatureMax),
      humidite: versNombre(valeurs.meteo.humidite),
      vent: valeurs.meteo.vent.trim(),
      prevision: valeurs.meteo.prevision.trim(),
    },
    effectifs: valeurs.effectifs.map((ligne) => ({
      categorie: ligne.categorie.trim(),
      prevus: versNombre(ligne.prevus),
      presents: versNombre(ligne.presents),
      retards: versNombre(ligne.retards),
      heures: versNombre(ligne.heures),
      observation: ligne.observation.trim(),
    })),
    presenceSousTraitant: presence.presence
      ? {
          presence: presence.presence as PresenceSousTraitant,
          motif: presence.motif.trim(),
          qualite: (presence.qualite || "CONFORME") as QualiteExecution,
          observation: presence.observation.trim(),
        }
      : null,
    production: valeurs.production.map((ligne) => ({
      intervenant: ligne.intervenant.trim(),
      activiteId: ligne.activiteId,
      quantiteJour: versNombre(ligne.quantiteJour),
      prixUnitaire: saisieEnCentimes(ligne.prixUnitaire),
    })),
    lotsTravailles: valeurs.lotsTravailles.map((point) => ({
      lotId: point.lotId,
      observation: point.observation.trim(),
    })),
    activites: valeurs.activites
      .filter((_, rang) => travailles.has(avancement[rang]?.lotId ?? ""))
      .filter((ligne) => estRenseigne(ligne.quantiteJour) || ligne.observation.trim() || ligne.localisation.trim())
      .map((ligne) => ({
        activiteId: ligne.activiteId,
        quantiteJour: versNombre(ligne.quantiteJour),
        localisation: ligne.localisation.trim(),
        observation: ligne.observation.trim(),
      })),
    materiaux: valeurs.materiaux.map((ligne) => ({
      designation: ligne.designation.trim(),
      quantite: versNombre(ligne.quantite),
      unite: ligne.unite.trim(),
    })),
    livraisons: valeurs.livraisons.map((ligne) => ({
      ...ligne,
      conformite: ligne.conformite as Conformite,
      observation: ligne.observation.trim(),
    })),
    besoins: valeurs.besoins.map((besoin) => ({
      nature: besoin.nature === "URGENT" ? "URGENT" : "RUPTURE",
      designation: besoin.designation.trim(),
      quantite: besoin.quantite.trim(),
      observation: besoin.observation.trim(),
    })),
    equipements: valeurs.equipements.map((ligne) => ({
      ...ligne,
      propriete: ligne.propriete as ProprieteEquipement,
      etat: ligne.etat as EtatEquipement,
      dureeArret: ligne.etat === "BON" ? null : versNombre(ligne.dureeArret),
      observation: ligne.observation.trim(),
    })),
    incidents: valeurs.incidents.map((incident) => ({
      cle: incident.cle,
      nature: incident.nature as NatureEvenement,
      type: categorieEvenement(incident.nature as NatureEvenement, incident.type as TypeIncident),
      heureDebut: incident.heureDebut,
      heureFin: incident.heureFin,
      gravite: incident.gravite as GraviteIncident,
      decidePar: incident.decidePar as RoleSignataire,
      description: incident.description.trim(),
      action: incident.action.trim(),
    })),
    blocage: {
      niveau: valeurs.blocage.niveau as NiveauBlocageSaisi,
      nature: valeurs.blocage.niveau === "AUCUN" ? null : ((valeurs.blocage.nature || null) as NatureBlocage | null),
      description: valeurs.blocage.niveau === "AUCUN" ? "" : valeurs.blocage.description.trim(),
      impact: valeurs.blocage.niveau === "AUCUN" ? "" : valeurs.blocage.impact.trim(),
    },
    photos: valeurs.photos,
    piecesJointes: valeurs.piecesJointes,
    previsions: valeurs.previsions.map((prevision) => ({
      activite: prevision.activite.trim(),
      equipe: prevision.equipe.trim(),
      objectif: prevision.objectif.trim(),
      prerequis: prevision.prerequis.trim(),
    })),
    note: valeurs.note.trim(),
  };
}

/* ------------------------------------------------------------------ *
 * Les lignes neuves des listes répétables.
 * ------------------------------------------------------------------ */

export function nouvelleCle(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const ligneEffectifVide = (): ValeursRapport["effectifs"][number] => ({
  categorie: "",
  prevus: "",
  presents: "",
  retards: "",
  heures: HEURES_PAR_DEFAUT,
  observation: "",
});

export const ligneProductionVide = (): ValeursRapport["production"][number] => ({
  intervenant: "",
  activiteId: "",
  quantiteJour: "",
  prixUnitaire: "",
});

export const ligneMateriauVide = (): ValeursRapport["materiaux"][number] => ({
  designation: "",
  quantite: "",
  unite: "",
});

export const ligneLivraisonVide = (heure: string): ValeursRapport["livraisons"][number] => ({
  fournisseur: "",
  designation: "",
  quantite: "",
  bonLivraison: "",
  heure,
  conformite: "CONFORME",
  observation: "",
});

export const ligneEquipementVide = (): ValeursRapport["equipements"][number] => ({
  designation: "",
  reference: "",
  propriete: "ENTREPRISE",
  utilisation: "",
  operateur: "",
  etat: "BON",
  dureeArret: "",
  observation: "",
});

export const besoinVide = (nature: (typeof NATURES_BESOIN)[number]): ValeursRapport["besoins"][number] => ({
  nature,
  designation: "",
  quantite: "",
  observation: "",
});

export const incidentVide = (nature: NatureEvenement = "INCIDENT"): ValeursRapport["incidents"][number] => ({
  cle: nouvelleCle(),
  nature,
  type: "QUALITE",
  heureDebut: "",
  heureFin: "",
  gravite: "MINEUR",
  decidePar: "CC",
  description: "",
  action: "",
});

export const previsionVide = (): ValeursRapport["previsions"][number] => ({
  activite: "",
  equipe: "",
  objectif: "",
  prerequis: "",
});

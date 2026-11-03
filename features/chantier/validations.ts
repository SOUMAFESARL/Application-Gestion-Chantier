/**
 * La saisie du rapport journalier — schéma Zod et traductions formulaire ↔ domaine.
 *
 * Ni React, ni réseau. Le formulaire manipule des chaînes pour la saisie clavier
 * (`12,5` avec virgule, champ vide distinct de zéro) ; `versSaisie` convertit vers
 * les nombres et identifiants attendus par le domaine, `valeursDepuis` fait l'inverse.
 *
 * - **Brouillon** : aucune contrainte bloquante, sauvegarde automatique toutes les 30 s.
 * - **Soumission** : `schemaRapport` valide les horaires, la météo, le pointage par
 *   équipe, le garde-fou travaux ↔ équipes (A3), les trois modes de mesure des feuilles
 *   (`QUANTITE`, `POURCENTAGE`, `JALON`) et les rubriques renseignées.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import type messages from "@/messages/fr.json";

import {
  categorieEvenement,
  HEURES_MAX_JOUR,
  jourSaisissable,
  LONGUEUR_MIN_DESCRIPTION_INCIDENT,
  LONGUEUR_MIN_NOTE,
  lotsSuivisAvancement,
  lotsTravaillesDe,
  PHOTOS_MAX,
  PIECES_JOINTES_MAX,
  sectionsActives,
} from "./regles";
import type {
  ConditionsTravail,
  Conformite,
  DecideurIncident,
  EtatEquipement,
  GraviteIncident,
  Meteo,
  MotifArret,
  NatureBlocage,
  NatureEvenement,
  NiveauBlocage,
  PreparationSaisie,
  ProprieteEquipement,
  QualiteExecution,
  SaisieRapport,
  TypeIncident,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les listes fermées, dans l'ordre présenté au terrain.
 * ------------------------------------------------------------------ */

export const METEOS: readonly Meteo[] = ["ENSOLEILLE", "NUAGEUX", "PLUVIEUX", "ORAGEUX", "BRUMEUX"];
export const CONDITIONS_TRAVAIL: readonly ConditionsTravail[] = ["FAVORABLES", "DIFFICILES", "ARRET"];
export const MOTIFS_ARRET: readonly MotifArret[] = [
  "INTEMPERIES",
  "INCIDENT_SECURITE",
  "RUPTURE_APPROVISIONNEMENT",
  "INJONCTION_ADMINISTRATIVE",
  "GREVE_SOCIAL",
  "AUTRE",
];
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
export const NATURES_EVENEMENT: readonly NatureEvenement[] = [
  "INCIDENT_SECURITE",
  "NON_CONFORMITE",
  "INCIDENT_MATERIEL",
  "DIFFICULTE_TECHNIQUE",
  "VISITE_INSTRUCTION",
  "EVENEMENT_PARTICULIER",
];
export const NATURES_BESOIN = ["RUPTURE", "URGENT"] as const;
export const GRAVITES: readonly GraviteIncident[] = ["MINEUR", "SIGNIFICATIF", "GRAVE"];
export const DECIDEURS: readonly DecideurIncident[] = [
  "REDACTION",
  "VALIDATION",
  "APPROBATION",
  "MAITRE_OEUVRE",
  "BUREAU_CONTROLE",
  "CLIENT",
  "AUTORITE",
];
export const NIVEAUX_BLOCAGE: readonly NiveauBlocage[] = ["MINEUR", "SIGNIFICATIF", "BLOQUANT"];
export const NATURES_BLOCAGE: readonly NatureBlocage[] = [
  "APPROVISIONNEMENT",
  "METEO",
  "MAIN_OEUVRE",
  "TECHNIQUE",
  "ADMINISTRATIF",
  "SECURITE",
];

const HEURE_DEBUT_DEFAUT = "07:30";
const HEURE_FIN_DEFAUT = "17:00";
export const HEURES_PAR_DEFAUT = "8";

/* ------------------------------------------------------------------ *
 * La forme du formulaire.
 * ------------------------------------------------------------------ */

const photo = z.object({
  cle: z.string(),
  elementId: z.string().nullable(),
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
  }),
  equipes: z.array(
    z.object({
      equipeId: z.string(),
      presents: z.array(z.string()),
      retards: z.array(z.string()),
      heures: z.string(),
      qualite: z.string(),
      observation: z.string(),
    }),
  ),
  lotsTravailles: z.array(z.object({ lotId: z.string(), observation: z.string() })),
  activites: z.array(
    z.object({
      activiteId: z.string(),
      equipeIds: z.array(z.string()),
      quantiteJour: z.string(),
      pourcentageJour: z.string(),
      jalonAtteint: z.boolean(),
      localisation: z.string(),
      observation: z.string(),
    }),
  ),
  materiaux: z.array(z.object({ designation: z.string(), quantite: z.string(), unite: z.string() })),
  livraisons: z.array(
    z.object({
      fournisseur: z.string(),
      designation: z.string(),
      quantite: z.string(),
      unite: z.string(),
      bonLivraison: z.string(),
      heure: z.string(),
      conformite: z.string(),
      observation: z.string(),
    }),
  ),
  besoins: z.array(
    z.object({
      nature: z.string(),
      designation: z.string(),
      quantite: z.string(),
      unite: z.string(),
      observation: z.string(),
    }),
  ),
  equipements: z.array(
    z.object({
      cle: z.string(),
      designation: z.string(),
      reference: z.string(),
      propriete: z.string(),
      heuresUtilisation: z.string(),
      usage: z.string(),
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
  blocages: z.array(
    z.object({
      cle: z.string(),
      blocageId: z.string(),
      elementId: z.string(),
      titre: z.string(),
      niveau: z.string(),
      nature: z.string(),
      description: z.string(),
      impact: z.string(),
    }),
  ),
  photos: z.array(photo),
  piecesJointes: z.array(
    z.object({
      cle: z.string(),
      nom: z.string(),
      type: z.string(),
      taille: z.number(),
      url: z.string(),
    }),
  ),
  previsions: z.array(
    z.object({
      activiteId: z.string(),
      equipeId: z.string(),
      activite: z.string(),
      equipe: z.string(),
      objectif: z.string(),
      prerequis: z.string(),
    }),
  ),
  noteRedacteur: z.string(),
});

export type ValeursRapport = z.infer<typeof forme>;

/* ------------------------------------------------------------------ *
 * Les nombres tapés au clavier.
 * ------------------------------------------------------------------ */

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
 * Le schéma qu'un rapport doit satisfaire pour être **soumis**.
 * Un rapport rejeté (`REJETE`) conserve le droit d'être corrigé et resoumis même
 * au-delà de la fenêtre des 3 derniers jours ouvrés.
 */
export function schemaRapport(
  preparation: Pick<PreparationSaisie, "sections" | "aujourdhui" | "activites"> &
    Partial<Pick<PreparationSaisie, "equipes" | "joursSaisissables" | "estJourOuvre" | "rapport">>,
) {
  const feuilles = preparation.activites;
  const equipes = preparation.equipes ?? [];
  const estCorrectionRejet = preparation.rapport?.statut === "REJETE";

  return forme.superRefine((valeurs, ctx) => {
    const signaler = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    const sections = sectionsActives(preparation.sections, valeurs.arret);
    const requis = erreur("requis");

    // 1. Fenêtre de saisie sur jours ouvrés.
    if (!estCorrectionRejet) {
      if (preparation.estJourOuvre === false) {
        signaler(["date"], erreur("jourNonOuvre"));
      } else if (
        !jourSaisissable(valeurs.date, preparation.aujourdhui, preparation.joursSaisissables)
      ) {
        signaler(["date"], erreur("dateHorsDelai"));
      }
    }

    // 2. Météo obligatoire (pré-remplie automatiquement, modifiable).
    if (!valeurs.meteo.matin) signaler(["meteo", "matin"], requis);
    if (!valeurs.meteo.apresMidi) signaler(["meteo", "apresMidi"], requis);
    if (!valeurs.meteo.conditions) signaler(["meteo", "conditions"], requis);

    // 3. Journée d'arrêt ou journée travaillée.
    if (valeurs.arret) {
      if (!valeurs.motifArret) signaler(["motifArret"], requis);
      if (valeurs.motifArret === "AUTRE" && !valeurs.precisionArret.trim()) {
        signaler(["precisionArret"], requis);
      }
      if (valeurs.heureDebut || valeurs.heureFin) {
        if (!valeurs.heureDebut) signaler(["heureDebut"], requis);
        if (!valeurs.heureFin) signaler(["heureFin"], requis);
        if (valeurs.heureDebut && valeurs.heureFin && valeurs.heureFin <= valeurs.heureDebut) {
          signaler(["heureFin"], erreur("heuresIncoherentes"));
        }
      }
    } else {
      if (!valeurs.heureDebut) signaler(["heureDebut"], requis);
      if (!valeurs.heureFin) signaler(["heureFin"], requis);
      if (valeurs.heureDebut && valeurs.heureFin && valeurs.heureFin <= valeurs.heureDebut) {
        signaler(["heureFin"], erreur("heuresIncoherentes"));
      }

      // Pointage nominatif par équipe (section `EQUIPES`).
      const pointagesActifs = new Set<string>();
      if (sections.includes("EQUIPES")) {
        valeurs.equipes.forEach((ligne, rang) => {
          const equipe = equipes.find((item) => item.equipeId === ligne.equipeId);
          if (!equipe) return;
          if (ligne.presents.length > 0) {
            const heures = versNombre(ligne.heures);
            if (heures === null || heures <= 0 || heures > HEURES_MAX_JOUR) {
              signaler(["equipes", rang, "heures"], erreur("heuresTravaillees", { max: HEURES_MAX_JOUR }));
            } else {
              pointagesActifs.add(ligne.equipeId);
            }
            if (equipe.qualite && !ligne.qualite) {
              signaler(["equipes", rang, "qualite"], requis);
            }
            const manquants = equipe.membres.length - ligne.presents.length;
            if ((manquants > 0 || ligne.retards.length > 0) && !ligne.observation.trim()) {
              signaler(["equipes", rang, "observation"], erreur("motifAbsenceEquipe"));
            }
          }
        });
      }

      // Travaux réalisés par feuille (3 modes de mesure) et garde-fou A3.
      if (sections.includes("AVANCEMENT")) {
        const travailles = new Set(valeurs.lotsTravailles.map((point) => point.lotId));
        const lotsAvances = new Set<string>();
        const lotsCommentes = new Set<string>();

        valeurs.activites.forEach((ligne, rang) => {
          const feuille = feuilles[rang];
          if (!feuille || !travailles.has(feuille.lotId)) return;

          if (ligne.observation.trim()) {
            lotsCommentes.add(feuille.lotId);
          }

          let aAvance = false;
          if (feuille.modeMesure === "POURCENTAGE") {
            if (estRenseigne(ligne.pourcentageJour)) {
              const pct = versNombre(ligne.pourcentageJour);
              if (pct === null || pct < 0 || pct > 100) {
                signaler(["activites", rang, "pourcentageJour"], erreur("pourcentage"));
              } else if (pct < feuille.pourcentageVeille) {
                signaler(
                  ["activites", rang, "pourcentageJour"],
                  erreur("pourcentageRecul", { acquis: feuille.pourcentageVeille }),
                );
              } else if (pct > feuille.pourcentageVeille) {
                aAvance = true;
              }
            }
          } else if (feuille.modeMesure === "JALON") {
            if (ligne.jalonAtteint) {
              aAvance = true;
            }
          } else if (estRenseigne(ligne.quantiteJour)) {
            const quantite = versNombre(ligne.quantiteJour);
            if (quantite === null || quantite < 0) {
              signaler(["activites", rang, "quantiteJour"], erreur("quantite"));
            } else if (quantite > 0) {
              aAvance = true;
            }
          }

          if (aAvance) {
            lotsAvances.add(feuille.lotId);
            if (ligne.equipeIds.length === 0) {
              signaler(["activites", rang, "equipeIds"], erreur("equipeTravauxRequise"));
            } else if (!ligne.equipeIds.some((eid) => pointagesActifs.has(eid))) {
              signaler(["activites", rang, "equipeIds"], erreur("equipeTravauxSansPresent"));
            }
          }
        });

        valeurs.lotsTravailles.forEach((point, rang) => {
          if (
            !lotsAvances.has(point.lotId) &&
            !lotsCommentes.has(point.lotId) &&
            !point.observation.trim()
          ) {
            signaler(["lotsTravailles", rang, "observation"], erreur("lotSansAvancement"));
          }
        });

        if (feuilles.length > 0 && valeurs.lotsTravailles.length === 0) {
          signaler(["lotsTravailles"], erreur("lotsVides"));
        }
      }

      if (valeurs.noteRedacteur.trim().length < LONGUEUR_MIN_NOTE) {
        signaler(["noteRedacteur"], erreur("noteCourte", { min: LONGUEUR_MIN_NOTE }));
      }
    }

    // 4. Rubriques communes (saisissables aussi lors d'une journée d'arrêt).
    if (sections.includes("MATERIAUX")) {
      valeurs.materiaux.forEach((ligne, rang) => {
        if (!ligne.designation.trim()) signaler(["materiaux", rang, "designation"], requis);
        if (!ligne.unite.trim()) signaler(["materiaux", rang, "unite"], requis);
        const quantite = versNombre(ligne.quantite);
        if (quantite === null || quantite <= 0) {
          signaler(["materiaux", rang, "quantite"], erreur("quantiteConsommee"));
        }
      });
    }

    if (sections.includes("LIVRAISONS")) {
      valeurs.livraisons.forEach((ligne, rang) => {
        if (!ligne.fournisseur.trim()) signaler(["livraisons", rang, "fournisseur"], requis);
        if (!ligne.designation.trim()) signaler(["livraisons", rang, "designation"], requis);
        if (!ligne.unite.trim()) signaler(["livraisons", rang, "unite"], requis);
        if (!ligne.conformite) signaler(["livraisons", rang, "conformite"], requis);
        const quantite = versNombre(ligne.quantite);
        if (quantite === null || quantite <= 0) {
          signaler(["livraisons", rang, "quantite"], erreur("quantiteConsommee"));
        }
        if (ligne.conformite && ligne.conformite !== "CONFORME" && !ligne.observation.trim()) {
          signaler(["livraisons", rang, "observation"], erreur("livraisonNonConforme"));
        }
      });
    }

    if (sections.includes("EQUIPEMENTS")) {
      valeurs.equipements.forEach((ligne, rang) => {
        if (!ligne.designation.trim()) signaler(["equipements", rang, "designation"], requis);
        if (!ligne.propriete) signaler(["equipements", rang, "propriete"], requis);
        if (!ligne.etat) signaler(["equipements", rang, "etat"], requis);
        if (ligne.etat === "BON") {
          const heures = versNombre(ligne.heuresUtilisation);
          if (heures === null || heures < 0 || heures > HEURES_MAX_JOUR) {
            signaler(
              ["equipements", rang, "heuresUtilisation"],
              erreur("heuresTravaillees", { max: HEURES_MAX_JOUR }),
            );
          }
        } else if (ligne.etat) {
          const arret = versNombre(ligne.dureeArret);
          if (arret === null || arret <= 0 || arret > HEURES_MAX_JOUR) {
            signaler(["equipements", rang, "dureeArret"], erreur("dureeArret", { max: HEURES_MAX_JOUR }));
          }
          if (!ligne.observation.trim()) {
            signaler(["equipements", rang, "observation"], erreur("panne"));
          }
        }
      });
    }

    valeurs.besoins.forEach((besoin, rang) => {
      if (!besoin.designation.trim()) signaler(["besoins", rang, "designation"], requis);
      if (estRenseigne(besoin.quantite)) {
        const quantite = versNombre(besoin.quantite);
        if (quantite === null || quantite <= 0) {
          signaler(["besoins", rang, "quantite"], erreur("quantiteConsommee"));
        }
      } else if (besoin.nature === "URGENT") {
        signaler(["besoins", rang, "quantite"], requis);
      }
    });

    valeurs.incidents.forEach((incident, rang) => {
      if (incident.heureDebut || incident.heureFin) {
        if (!incident.heureDebut) signaler(["incidents", rang, "heureDebut"], requis);
        if (!incident.heureFin) signaler(["incidents", rang, "heureFin"], requis);
        if (incident.heureDebut && incident.heureFin && incident.heureFin < incident.heureDebut) {
          signaler(["incidents", rang, "heureFin"], erreur("heuresIncoherentes"));
        }
      }
      if (!incident.decidePar) signaler(["incidents", rang, "decidePar"], requis);
      if (incident.nature !== "VISITE_INSTRUCTION" && !incident.gravite) {
        signaler(["incidents", rang, "gravite"], requis);
      }
      if (incident.description.trim().length < LONGUEUR_MIN_DESCRIPTION_INCIDENT) {
        signaler(
          ["incidents", rang, "description"],
          erreur("descriptionCourte", { min: LONGUEUR_MIN_DESCRIPTION_INCIDENT }),
        );
      }
      if (
        incident.nature !== "VISITE_INSTRUCTION" &&
        incident.gravite &&
        incident.gravite !== "MINEUR" &&
        !incident.action.trim()
      ) {
        signaler(["incidents", rang, "action"], erreur("actionRequise"));
      }
    });

    valeurs.blocages.forEach((blocage, rang) => {
      if (!blocage.nature) signaler(["blocages", rang, "nature"], requis);
      if (blocage.description.trim().length < LONGUEUR_MIN_DESCRIPTION_INCIDENT) {
        signaler(
          ["blocages", rang, "description"],
          erreur("descriptionCourte", { min: LONGUEUR_MIN_DESCRIPTION_INCIDENT }),
        );
      }
      if (!blocage.impact.trim()) signaler(["blocages", rang, "impact"], requis);
    });

    if (valeurs.photos.length > PHOTOS_MAX) {
      signaler(["photos"], erreur("tropDePhotos", { max: PHOTOS_MAX }));
    }
    valeurs.photos.forEach((item, rang) => {
      if (!item.legende.trim()) {
        signaler(["photos", rang, "legende"], erreur("legendePhotoRequise"));
      }
    });

    if (valeurs.piecesJointes.length > PIECES_JOINTES_MAX) {
      signaler(["piecesJointes"], erreur("tropDePieces", { max: PIECES_JOINTES_MAX }));
    }

    valeurs.previsions.forEach((prevision, rang) => {
      if (!prevision.activite.trim()) signaler(["previsions", rang, "activite"], requis);
      if (!prevision.objectif.trim()) signaler(["previsions", rang, "objectif"], requis);
    });
  });
}

/* ------------------------------------------------------------------ *
 * Domaine ↔ formulaire.
 * ------------------------------------------------------------------ */

export function valeursDepuis(preparation: PreparationSaisie, date: string): ValeursRapport {
  const existant = preparation.rapport?.saisie;
  const lotsAvancement = lotsSuivisAvancement(preparation);
  const lotsAttendusIds = new Set(
    preparation.activites.filter((act) => act.attendueCeJour).map((act) => act.lotId),
  );
  const lotsAttendus = lotsAvancement.filter((lot) => lotsAttendusIds.has(lot.id));
  const parActivite = new Map(
    existant?.activites.map((ligne) => [ligne.activiteId, ligne]) ?? [],
  );
  const { reprises, meteoSuggeree } = preparation;

  return {
    date: existant?.date ?? date,
    heureDebut: existant ? existant.heureDebut : HEURE_DEBUT_DEFAUT,
    heureFin: existant ? existant.heureFin : HEURE_FIN_DEFAUT,
    arret: existant?.arret != null,
    motifArret: existant?.arret?.motif ?? "",
    precisionArret: existant?.arret?.precision ?? "",
    meteo: {
      matin: existant?.meteo.matin || meteoSuggeree?.matin || "ENSOLEILLE",
      apresMidi: existant?.meteo.apresMidi || meteoSuggeree?.apresMidi || "ENSOLEILLE",
      conditions: existant?.meteo.conditions || meteoSuggeree?.conditions || "FAVORABLES",
    },
    equipes: valeursEquipes(preparation),
    lotsTravailles: existant
      ? lotsTravaillesDe(existant, preparation.activites)
      : lotsAttendus.length > 0
        ? lotsAttendus.map((lot) => ({ lotId: lot.id, observation: "" }))
        : lotsAvancement.length === 1
          ? lotsAvancement.map((lot) => ({ lotId: lot.id, observation: "" }))
          : [],
    activites: preparation.activites.map((activite) => {
      const ligne = parActivite.get(activite.activiteId);
      const equipesDefaut =
        ligne?.equipeIds ??
        (activite.equipesAffectees.length === 1 ? [activite.equipesAffectees[0]] : []);
      return {
        activiteId: activite.activiteId,
        equipeIds: equipesDefaut.filter((id) => activite.equipesAffectees.includes(id)),
        quantiteJour: enChaine(ligne?.quantiteJour),
        pourcentageJour: enChaine(ligne?.pourcentageJour),
        jalonAtteint: ligne?.jalonAtteint ?? false,
        localisation: ligne?.localisation ?? "",
        observation: ligne?.observation ?? "",
      };
    }),
    materiaux: (existant?.materiaux ?? []).map((ligne) => ({
      designation: ligne.designation,
      quantite: enChaine(ligne.quantite),
      unite: ligne.unite,
    })),
    livraisons: (existant?.livraisons ?? []).map((ligne) => ({
      fournisseur: ligne.fournisseur,
      designation: ligne.designation,
      quantite: enChaine(ligne.quantite),
      unite: ligne.unite,
      bonLivraison: ligne.bonLivraison,
      heure: ligne.heure,
      conformite: ligne.conformite,
      observation: ligne.observation,
    })),
    besoins: (existant?.besoins ?? []).map((besoin) => ({
      nature: besoin.nature,
      designation: besoin.designation,
      quantite: enChaine(besoin.quantite),
      unite: besoin.unite,
      observation: besoin.observation,
    })),
    equipements: existant
      ? existant.equipements.map((equipement) => ({
          cle: equipement.cle || nouvelleCle(),
          designation: equipement.designation,
          reference: equipement.reference,
          propriete: equipement.propriete,
          heuresUtilisation: enChaine(equipement.heuresUtilisation),
          usage: equipement.usage,
          operateur: equipement.operateur,
          etat: equipement.etat || "BON",
          dureeArret: enChaine(equipement.dureeArret),
          observation: equipement.observation,
        }))
      : reprises.equipements.map((equipement) => ({
          cle: nouvelleCle(),
          designation: equipement.designation,
          reference: equipement.reference,
          propriete: equipement.propriete || "ENTREPRISE",
          heuresUtilisation: "",
          usage: equipement.usage ?? "",
          operateur: equipement.operateur,
          etat: "BON",
          dureeArret: "",
          observation: "",
        })),
    incidents: (existant?.incidents ?? []).map((incident) => ({
      cle: incident.cle || nouvelleCle(),
      nature: incident.nature ?? "EVENEMENT_PARTICULIER",
      type: incident.type ?? "QUALITE",
      heureDebut: incident.heureDebut ?? "",
      heureFin: incident.heureFin ?? "",
      gravite: incident.gravite ?? "",
      decidePar: incident.decidePar ?? "REDACTION",
      description: incident.description ?? "",
      action: incident.action ?? "",
    })),
    blocages: (existant?.blocages ?? []).map((blocage) => ({
      cle: blocage.cle || nouvelleCle(),
      blocageId: blocage.blocageId ?? "",
      elementId: blocage.elementId ?? "",
      titre: blocage.titre ?? "",
      niveau: blocage.niveau,
      nature: blocage.nature ?? "",
      description: blocage.description ?? "",
      impact: blocage.impact ?? "",
    })),
    photos: (existant?.photos ?? []).map((item) => ({
      ...item,
      elementId: item.elementId ?? null,
    })),
    piecesJointes: existant?.piecesJointes ?? [],
    previsions: (existant?.previsions ?? []).map((prevision) => ({
      activiteId: prevision.activiteId ?? "",
      equipeId: prevision.equipeId ?? "",
      activite: prevision.activite,
      equipe: prevision.equipe,
      objectif: prevision.objectif,
      prerequis: prevision.prerequis,
    })),
    noteRedacteur: existant?.noteRedacteur ?? "",
  };
}

/**
 * Traduit l'état du formulaire en `SaisieRapport` du domaine.
 * En journée d'arrêt, seuls les travaux (`activites`, `lotsTravailles`) et le
 * pointage (`equipes`) ne partent pas ; les preuves, blocages, événements,
 * livraisons et matériels restent conservés.
 */
export function versSaisie(
  valeurs: ValeursRapport,
  preparation: Pick<PreparationSaisie, "projet" | "activites">,
): SaisieRapport {
  const saisie = versSaisieComplete(valeurs, preparation);
  if (!valeurs.arret) return saisie;
  return {
    ...saisie,
    equipes: [],
    lotsTravailles: [],
    activites: [],
  };
}

function versSaisieComplete(
  valeurs: ValeursRapport,
  preparation: Pick<PreparationSaisie, "projet" | "activites">,
): SaisieRapport {
  const feuilles = preparation.activites;
  const travailles = new Set(valeurs.lotsTravailles.map((point) => point.lotId));

  return {
    projetId: preparation.projet.id,
    date: valeurs.date,
    heureDebut: valeurs.heureDebut,
    heureFin: valeurs.heureFin,
    arret: valeurs.arret
      ? {
          motif: (valeurs.motifArret || "AUTRE") as MotifArret,
          precision: valeurs.precisionArret.trim(),
        }
      : null,
    meteo: {
      matin: valeurs.meteo.matin as Meteo | "",
      apresMidi: valeurs.meteo.apresMidi as Meteo | "",
      conditions:
        valeurs.arret && valeurs.motifArret === "INTEMPERIES" && !valeurs.meteo.conditions
          ? "ARRET"
          : (valeurs.meteo.conditions as ConditionsTravail | ""),
    },
    equipes: valeurs.equipes.map((ligne) => ({
      equipeId: ligne.equipeId,
      presents: ligne.presents,
      retards: ligne.retards.filter((id) => ligne.presents.includes(id)),
      heures: versNombre(ligne.heures),
      qualite: ligne.qualite as QualiteExecution | "",
      observation: ligne.observation.trim(),
    })),
    lotsTravailles: valeurs.lotsTravailles.map((point) => ({
      lotId: point.lotId,
      observation: point.observation.trim(),
    })),
    activites: valeurs.activites.flatMap((ligne, rang) => {
      const feuille = feuilles[rang];
      if (!feuille || !travailles.has(feuille.lotId)) return [];

      const loc = ligne.localisation.trim();
      const obs = ligne.observation.trim();
      const qSaisie = versNombre(ligne.quantiteJour);
      const pctSaisi = versNombre(ligne.pourcentageJour);
      const aMesure =
        feuille.modeMesure === "POURCENTAGE"
          ? estRenseigne(ligne.pourcentageJour)
          : feuille.modeMesure === "JALON"
            ? ligne.jalonAtteint
            : estRenseigne(ligne.quantiteJour);

      if (!aMesure && !loc && !obs) return [];

      return [
        {
          activiteId: ligne.activiteId,
          equipeIds: ligne.equipeIds.filter((id) => feuille.equipesAffectees.includes(id)),
          quantiteJour:
            feuille.modeMesure === "QUANTITE" ? (qSaisie ?? (loc || obs ? 0 : null)) : null,
          pourcentageJour:
            feuille.modeMesure === "POURCENTAGE"
              ? (pctSaisi ?? (loc || obs ? feuille.pourcentageVeille : null))
              : null,
          jalonAtteint: feuille.modeMesure === "JALON" ? ligne.jalonAtteint : false,
          localisation: loc,
          observation: obs,
        },
      ];
    }),
    materiaux: valeurs.materiaux.map((ligne) => ({
      designation: ligne.designation.trim(),
      quantite: versNombre(ligne.quantite),
      unite: ligne.unite.trim(),
    })),
    livraisons: valeurs.livraisons.map((ligne) => ({
      fournisseur: ligne.fournisseur.trim(),
      designation: ligne.designation.trim(),
      quantite: versNombre(ligne.quantite),
      unite: ligne.unite.trim(),
      bonLivraison: ligne.bonLivraison.trim(),
      heure: ligne.heure,
      conformite: (ligne.conformite || "CONFORME") as Conformite,
      observation: ligne.observation.trim(),
    })),
    besoins: valeurs.besoins.map((besoin) => ({
      nature: besoin.nature === "URGENT" ? "URGENT" : "RUPTURE",
      designation: besoin.designation.trim(),
      quantite: versNombre(besoin.quantite),
      unite: besoin.unite.trim(),
      observation: besoin.observation.trim(),
    })),
    equipements: valeurs.equipements.map((ligne) => ({
      cle: ligne.cle || nouvelleCle(),
      designation: ligne.designation.trim(),
      reference: ligne.reference.trim(),
      propriete: ligne.propriete as ProprieteEquipement | "",
      heuresUtilisation: ligne.etat === "BON" ? versNombre(ligne.heuresUtilisation) : null,
      usage: ligne.usage.trim(),
      operateur: ligne.operateur.trim(),
      etat: ligne.etat as EtatEquipement | "",
      dureeArret: ligne.etat === "BON" ? null : versNombre(ligne.dureeArret),
      observation: ligne.observation.trim(),
    })),
    incidents: valeurs.incidents.map((incident) => ({
      cle: incident.cle,
      nature: incident.nature as NatureEvenement,
      type: categorieEvenement(
        incident.nature as NatureEvenement,
        incident.type as TypeIncident | "",
      ),
      heureDebut: incident.heureDebut,
      heureFin: incident.heureFin,
      gravite:
        incident.nature === "VISITE_INSTRUCTION"
          ? ""
          : (incident.gravite as GraviteIncident | ""),
      decidePar: incident.decidePar as DecideurIncident | "",
      description: incident.description.trim(),
      action: incident.action.trim(),
    })),
    blocages: valeurs.blocages.map((blocage) => ({
      cle: blocage.cle,
      blocageId: blocage.blocageId || null,
      elementId: blocage.elementId || null,
      titre: blocage.titre.trim(),
      niveau: (blocage.niveau || "SIGNIFICATIF") as NiveauBlocage,
      nature: blocage.nature as NatureBlocage | "",
      description: blocage.description.trim(),
      impact: blocage.impact.trim(),
    })),
    photos: valeurs.photos.map((item) => ({
      ...item,
      elementId: item.elementId || null,
    })),
    piecesJointes: valeurs.piecesJointes,
    previsions: valeurs.previsions.map((prevision) => ({
      activiteId: prevision.activiteId || null,
      equipeId: prevision.equipeId || null,
      activite: prevision.activite.trim(),
      equipe: prevision.equipe.trim(),
      objectif: prevision.objectif.trim(),
      prerequis: prevision.prerequis.trim(),
    })),
    noteRedacteur: valeurs.noteRedacteur.trim(),
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

export const ligneMateriauVide = (): ValeursRapport["materiaux"][number] => ({
  designation: "",
  quantite: "",
  unite: "",
});

export const ligneLivraisonVide = (heure: string): ValeursRapport["livraisons"][number] => ({
  fournisseur: "",
  designation: "",
  quantite: "",
  unite: "",
  bonLivraison: "",
  heure,
  conformite: "CONFORME",
  observation: "",
});

export const ligneEquipementVide = (): ValeursRapport["equipements"][number] => ({
  cle: nouvelleCle(),
  designation: "",
  reference: "",
  propriete: "ENTREPRISE",
  heuresUtilisation: "",
  usage: "",
  operateur: "",
  etat: "BON",
  dureeArret: "",
  observation: "",
});

export const besoinVide = (
  nature: (typeof NATURES_BESOIN)[number],
): ValeursRapport["besoins"][number] => ({
  nature,
  designation: "",
  quantite: "",
  unite: "",
  observation: "",
});

export const incidentVide = (
  nature: NatureEvenement = "INCIDENT_SECURITE",
): ValeursRapport["incidents"][number] => ({
  cle: nouvelleCle(),
  nature,
  type: categorieEvenement(nature, "QUALITE"),
  heureDebut: "",
  heureFin: "",
  gravite: nature === "VISITE_INSTRUCTION" ? "" : "MINEUR",
  decidePar: "REDACTION",
  description: "",
  action: "",
});

export const blocageVide = (): ValeursRapport["blocages"][number] => ({
  cle: nouvelleCle(),
  blocageId: "",
  elementId: "",
  titre: "",
  niveau: "SIGNIFICATIF",
  nature: "",
  description: "",
  impact: "",
});

export const previsionVide = (): ValeursRapport["previsions"][number] => ({
  activiteId: "",
  equipeId: "",
  activite: "",
  equipe: "",
  objectif: "",
  prerequis: "",
});

function valeursEquipes(preparation: PreparationSaisie): ValeursRapport["equipes"] {
  const existantes = new Map(
    (preparation.rapport?.saisie.equipes ?? []).map((ligne) => [ligne.equipeId, ligne]),
  );
  const veille = new Map(
    preparation.reprises.equipes.map((ligne) => [ligne.equipeId, ligne.presents]),
  );
  return preparation.equipes
    .filter((equipe) => equipe.presence)
    .map((equipe) => {
      const membres = new Set(equipe.membres.map((membre) => membre.personneId));
      const existante = existantes.get(equipe.equipeId);
      if (existante) {
        return {
          equipeId: equipe.equipeId,
          presents: existante.presents,
          retards: existante.retards,
          heures: enChaine(existante.heures),
          qualite: existante.qualite,
          observation: existante.observation,
        };
      }
      return {
        equipeId: equipe.equipeId,
        presents: (veille.get(equipe.equipeId) ?? []).filter((id) => membres.has(id)),
        retards: [],
        heures: HEURES_PAR_DEFAUT,
        qualite: "",
        observation: "",
      };
    });
}

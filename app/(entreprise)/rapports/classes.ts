/**
 * Les tons et les classes partagés par les écrans du journal de chantier.
 *
 * Même rôle que `tableau-de-bord/classes.ts` : ce que plusieurs blocs disent
 * de la même façon — la couleur d'un statut, d'une étape du circuit, d'une
 * gravité — se partage ici. **Aucune valeur en dur** (règle 4) : chaque
 * teinte passe par un jeton de la charte.
 */

import type { VarianteBadge } from "@/components/ui";
import type {
  ConditionsTravail,
  Conformite,
  EtatEquipement,
  EtatEtape,
  GraviteIncident,
  NiveauBlocage,
  SituationRapport,
} from "@/features/chantier";

import type { FondIndicateur } from "../projets/classes";

export { BLOC, BLOC_CORPS, BLOC_ENTETE, BLOC_SOUS_TITRE, BLOC_TITRE, BLOC_VIDE } from "../tableau-de-bord/classes";

/** Ce qui manque est rouge ; ce qui attend, bleu ; ce qui est clos, vert. */
export const TON_SITUATION: Record<SituationRapport, VarianteBadge> = {
  NON_SOUMIS: "erreur",
  REJETE: "erreur",
  SOUMIS: "information",
  VALIDE_CT: "primaire",
  APPROUVE_CP: "succes",
};

/** Une étape du circuit CC → CT → CP. */
export const PASTILLE_ETAPE: Record<EtatEtape, string> = {
  SIGNE: "bg-succes-fond text-succes",
  EN_ATTENTE: "bg-primary-50 text-primary-700 ring-1 ring-primary-200",
  REJETE: "bg-erreur-fond text-erreur",
  A_VENIR: "bg-neutral-100 text-neutral-500",
};

export const TON_GRAVITE: Record<GraviteIncident, VarianteBadge> = {
  MINEUR: "avertissement",
  SIGNIFICATIF: "erreur",
  GRAVE: "erreur",
};

export const TON_BLOCAGE: Record<NiveauBlocage, VarianteBadge> = {
  MINEUR: "avertissement",
  SIGNIFICATIF: "erreur",
  BLOQUANT: "erreur",
};

export const TON_CONFORMITE: Record<Conformite, VarianteBadge> = {
  CONFORME: "succes",
  PARTIELLE: "avertissement",
  NON_CONFORME: "erreur",
};

export const TON_EQUIPEMENT: Record<EtatEquipement, VarianteBadge> = {
  BON: "succes",
  ENTRETIEN: "avertissement",
  PANNE: "erreur",
};

/**
 * Les teintes des cartes du rapport journalier — ses chiffres du jour. L'écran
 * et le PDF les lisent ici tous les deux, pour que le fichier ne colore pas un
 * chiffre autrement que l'écran. Chaque carte a sa teinte de repos ; elle ne
 * vire au rouge ou à l'orange que s'il y a de quoi alerter.
 */
export function teintesChiffresRapport(chiffres: {
  retard: number | null;
  presenceInsuffisante: boolean;
  livraisonsPartielles: number;
  incidents: number;
  incidentsMajeurs: number;
  blocages: number;
}) {
  const { retard, presenceInsuffisante, livraisonsPartielles, incidents, incidentsMajeurs, blocages } = chiffres;
  return {
    avancement: retard !== null && retard >= 10 ? "erreur" : "primaire",
    effectifs: presenceInsuffisante ? "erreur" : "information",
    heures: "secondaire",
    activites: "succes",
    livraisons: livraisonsPartielles > 0 ? "avertissement" : "information",
    incidents: incidentsMajeurs > 0 ? "erreur" : incidents > 0 ? "avertissement" : "succes",
    blocages: blocages > 0 ? "erreur" : "succes",
    photos: "secondaire",
  } satisfies Record<string, FondIndicateur>;
}

/** Les teintes des cartes de la synthèse périodique — même logique que le rapport journalier. */
export function teintesChiffresSynthese(chiffres: {
  presenceInsuffisante: boolean;
  livraisonsPartielles: number;
  incidents: number;
  incidentsMajeurs: number;
  blocages: number;
  manquants: number;
}) {
  const { presenceInsuffisante, livraisonsPartielles, incidents, incidentsMajeurs, blocages, manquants } = chiffres;
  return {
    presence: presenceInsuffisante ? "erreur" : "information",
    heures: "secondaire",
    livraisons: livraisonsPartielles > 0 ? "avertissement" : "information",
    incidents: incidentsMajeurs > 0 ? "erreur" : incidents > 0 ? "avertissement" : "succes",
    blocages: blocages > 0 ? "erreur" : "succes",
    remise: manquants > 0 ? "erreur" : "succes",
  } satisfies Record<string, FondIndicateur>;
}

/** Les cartes de la météo : le ciel en bleu, la chaleur en orange. */
export const TEINTE_METEO = {
  ciel: "information",
  temperature: "avertissement",
  humidite: "secondaire",
  vent: "neutre",
} as const satisfies Record<string, FondIndicateur>;

/** La carte « Conditions » de la météo, selon ce qu'elles permettent sur le chantier. */
export const TEINTE_CONDITIONS: Record<ConditionsTravail, FondIndicateur> = {
  FAVORABLES: "succes",
  DIFFICILES: "avertissement",
  ARRET: "erreur",
};

/** Le fond d'une tuile dont le chiffre alerte seulement s'il n'est pas nul. */
export function fondSiAlerte(valeur: number, fond: FondIndicateur): FondIndicateur {
  return valeur > 0 ? fond : "neutre";
}

/** La jauge d'avancement d'un tableau de document. */
export const JAUGE = "h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200";
export const JAUGE_REMPLIE = "block h-full rounded-full bg-primary-500";

import {
  CIBLE_PRESENCE,
  ecartObjectif,
  enAlerteStock,
  estManquant,
  incidentsResolus,
  rapportsManquants,
  tauxPresence,
} from "@/features/chantier";
import type { SynthesePeriodique } from "@/features/chantier";
import type { ModeExecutionLot } from "@/features/projets/types";
import { ABSENT, formaterDateHeure, formaterJourMoisNumerique, formaterQuantite } from "@/lib/format";
import type { BlocPdf, CasePdf, CellulePdf, DocumentPdf, SectionPdf } from "@/lib/export/documentPdf";

import { emetteurDocument } from "../../projets/[id]/contenuFichePdf";
import { teintesChiffresSynthese, TON_GRAVITE, TON_SITUATION } from "../classes";
import type { SourcePdf } from "../GenerationDocumentPdf";

/**
 * La synthèse périodique générée — le même document que l'écran, section par
 * section, dessiné par `lib/export/documentPdf` avec l'en-tête et le pied
 * paginé de la fiche projet et du rapport journalier.
 *
 * Ce module ne calcule rien : les chiffres viennent de `features/chantier`,
 * comme à l'écran ; il les traduit.
 */

/** Le traducteur de l'espace `journal` (next-intl). */
type Traduire = (cle: string, valeurs?: Record<string, string | number>) => string;

export interface DonneesSynthesePdf extends SourcePdf {
  synthese: SynthesePeriodique;
  /** La période, déjà mise en mots par l'écran (« Semaine 39 — du … au … »). */
  periode: string;
  modeExecution: (mode: ModeExecutionLot) => string;
}

/** Un écart signé : « +2 », « −3 », « 0 ». */
export function signe(valeur: number): string {
  if (valeur > 0) return `+${valeur}`;
  if (valeur < 0) return `−${Math.abs(valeur)}`;
  return "0";
}

function cellule(texte: string | number, options?: Omit<CellulePdf, "texte">): CellulePdf {
  return { texte: String(texte), ...options };
}

function tableau(entetes: string[], lignes: CellulePdf[][], vide: string): BlocPdf {
  return { type: "tableau", tableau: { entetes, lignes }, vide };
}

export function contenuSynthesePdf(t: Traduire, donnees: DonneesSynthesePdf): DocumentPdf {
  const { synthese, periode, modeExecution, entreprise, logo, marque, maintenant } = donnees;
  const s = (cle: string, valeurs?: Record<string, string | number>) => t(`synthese.${cle}`, valeurs);
  const pourcent = (valeur: number) => t("rapport.pourcent", { valeur });
  const fraction = (a: number, b: number) => t("rapport.fraction", { a, b });
  const role = (cle: string) => t(`circuit.role.${cle}`);

  const { chiffres, progression } = synthese;
  const manquants = rapportsManquants(synthese);
  const presence = tauxPresence(chiffres.effectifsPresents, chiffres.effectifsPrevus);
  const tauxRemise = chiffres.rapportsAttendus
    ? Math.round((chiffres.rapportsRecus / chiffres.rapportsAttendus) * 100)
    : null;
  const ecart = ecartObjectif(progression.gain, progression.objectif);
  const retardCumule = progression.theorique - progression.fin;
  const separateur = s("separateur");
  const resolus = incidentsResolus(synthese.incidents);
  // Les mêmes teintes que les cartes de l'écran.
  const teintes = teintesChiffresSynthese({
    presenceInsuffisante: presence !== null && presence < CIBLE_PRESENCE - 7,
    livraisonsPartielles: chiffres.livraisonsPartielles,
    incidents: chiffres.incidents,
    incidentsMajeurs: chiffres.incidentsMajeurs,
    blocages: chiffres.blocages,
    manquants: manquants.length,
  });

  const totalAbsences = synthese.effectifs.reduce((total, ligne) => total + ligne.absences, 0);
  const totalHeures = synthese.effectifs.reduce((total, ligne) => total + ligne.heures, 0);
  const totalPrevu = synthese.effectifs.reduce((total, ligne) => total + ligne.prevuParJour, 0);
  const totalMoyen = synthese.effectifs.reduce((total, ligne) => total + ligne.presenceMoyenne, 0);
  const tauxEffectifs = totalPrevu ? Math.round((totalMoyen / totalPrevu) * 100) : null;

  /* --- Identification, intervenants, progression, chiffres --- */

  const identification: SectionPdf = {
    titre: s("identification"),
    accent: true,
    blocs: [
      {
        type: "cles",
        elements: [
          { libelle: s("projet"), valeur: synthese.projetNom },
          { libelle: role("CP"), valeur: synthese.chefProjet },
          {
            libelle: s("lots"),
            valeur: synthese.lots.map((lot) => s("lotCouvert", { code: lot.code, nom: lot.nom })).join(separateur),
          },
          { libelle: role("CT"), valeur: synthese.conducteurTravaux },
          { libelle: s("joursOuvres"), valeur: s("joursOuvresValeur", { n: chiffres.joursOuvres }) },
          ...synthese.lots.map((lot) => ({ libelle: s("chefChantierLot", { code: lot.code }), valeur: lot.chefChantier })),
          { libelle: s("rapportsAttendus"), valeur: String(chiffres.rapportsAttendus) },
          {
            libelle: s("rapportsRecus"),
            valeur: s("rapportsRecusValeur", {
              recus: chiffres.rapportsRecus,
              attendus: chiffres.rapportsAttendus,
              taux: tauxRemise ?? 0,
            }),
          },
          {
            libelle: s("manquants"),
            valeur:
              manquants.length === 0
                ? s("aucunManquant")
                : manquants
                    .map((entree) =>
                      s("manquant", { code: entree.lot.code, date: formaterJourMoisNumerique(entree.date) }),
                    )
                    .join(separateur),
            ton: manquants.length ? "erreur" : undefined,
            large: true,
          },
        ],
      },
    ],
  };

  const progressionSection: SectionPdf = {
    titre: s("progression"),
    accent: true,
    blocs: [
      {
        type: "cles",
        elements: [
          { libelle: s("avancementDebut"), valeur: pourcent(progression.debut) },
          { libelle: s("avancementFin"), valeur: pourcent(progression.fin) },
          { libelle: s("gain"), valeur: s("points", { valeur: signe(progression.gain) }) },
          { libelle: s("objectif"), valeur: s("points", { valeur: signe(progression.objectif) }) },
          {
            libelle: s("ecart"),
            valeur: s("points", { valeur: signe(ecart) }),
            ton: ecart < 0 ? "erreur" : "succes",
          },
          { libelle: s("theorique"), valeur: pourcent(progression.theorique) },
          {
            libelle: s("retardCumule"),
            valeur: s("points", { valeur: Math.max(0, retardCumule) }),
            ton: retardCumule > 0 ? "erreur" : undefined,
          },
        ],
      },
      {
        type: "tuiles",
        tuiles: [
          {
            libelle: s("chiffres.presence"),
            valeur: presence === null ? ABSENT : pourcent(presence),
            detail: fraction(chiffres.effectifsPresents, chiffres.effectifsPrevus),
            ton: teintes.presence,
          },
          {
            libelle: s("chiffres.heures"),
            valeur: synthese.effectifs.length ? t("rapport.heures", { valeur: formaterQuantite(chiffres.heures) }) : ABSENT,
            detail: synthese.effectifs.length ? s("chiffres.heuresDetail") : s("chiffres.heuresSousTraitants"),
            ton: teintes.heures,
          },
          {
            libelle: s("chiffres.livraisons"),
            valeur: String(chiffres.livraisons),
            detail: s("chiffres.livraisonsDetail", { n: chiffres.livraisonsPartielles }),
            ton: teintes.livraisons,
          },
        ],
      },
      {
        type: "tuiles",
        tuiles: [
          {
            libelle: s("chiffres.incidents"),
            valeur: String(chiffres.incidents),
            detail: s("chiffres.incidentsDetail", { n: chiffres.incidentsMajeurs }),
            ton: teintes.incidents,
          },
          {
            libelle: s("chiffres.blocages"),
            valeur: String(chiffres.blocages),
            detail: chiffres.blocages ? s("chiffres.blocagesDetail") : s("chiffres.aucunBlocage"),
            ton: teintes.blocages,
          },
          {
            libelle: s("chiffres.remise"),
            valeur: tauxRemise === null ? ABSENT : pourcent(tauxRemise),
            detail: s("chiffres.remiseDetail", { n: manquants.length }),
            ton: teintes.remise,
          },
        ],
      },
    ],
  };

  /* --- Les sections numérotées, dans l'ordre de l'écran --- */

  const numerotees: { titre: string; blocs: BlocPdf[] }[] = [];

  numerotees.push({
    titre: s("sections.recapitulatif"),
    blocs: [
      {
        type: "paragraphe",
        texte: s("recapitulatif.complement", {
          valides: chiffres.rapportsValides,
          attendus: chiffres.rapportsAttendus,
        }),
      },
      tableau(
        [
          s("recapitulatif.date"),
          s("recapitulatif.lot"),
          s("recapitulatif.chef"),
          s("recapitulatif.statut"),
          s("recapitulatif.effectifs"),
          s("recapitulatif.avancement"),
          s("recapitulatif.incidents"),
          s("recapitulatif.blocages"),
        ],
        [
          ...synthese.recapitulatif.map((entree) => {
            const absent = estManquant(entree.situation);
            return [
              cellule(formaterJourMoisNumerique(entree.date)),
              cellule(entree.lot.code),
              cellule(entree.lot.chefChantier),
              cellule(t(`situation.${entree.situation}`), { gras: true, ton: TON_SITUATION[entree.situation] }),
              cellule(
                absent || entree.effectifPresent === null
                  ? ABSENT
                  : fraction(entree.effectifPresent, entree.effectifPrevu ?? 0),
              ),
              absent || entree.avancementLot === null
                ? cellule(s("recapitulatif.nonDisponible"), { ton: "neutre" })
                : cellule(pourcent(entree.avancementLot), { gras: true }),
              cellule(absent ? ABSENT : (entree.incidents ?? 0)),
              cellule(absent ? ABSENT : (entree.blocages ?? 0)),
            ];
          }),
          ...(synthese.recapitulatif.length
            ? [
                [
                  cellule(s("recapitulatif.total"), { gras: true }),
                  cellule(""),
                  cellule(""),
                  cellule(
                    s("recapitulatif.totalValides", {
                      valides: chiffres.rapportsValides,
                      attendus: chiffres.rapportsAttendus,
                    }),
                    { gras: true },
                  ),
                  cellule(fraction(chiffres.effectifsPresents, chiffres.effectifsPrevus), { gras: true }),
                  cellule(presence === null ? "" : s("recapitulatif.totalPresence", { taux: presence }), { gras: true }),
                  cellule(chiffres.incidents, { gras: true }),
                  cellule(chiffres.blocages, { gras: true }),
                ],
              ]
            : []),
        ],
        s("recapitulatif.vide"),
      ),
    ],
  });

  numerotees.push({
    titre: s("sections.avancement"),
    blocs: [
      tableau(
        [
          s("avancement.activite"),
          s("avancement.unite"),
          s("avancement.prevue"),
          s("avancement.debut"),
          s("avancement.fin"),
          s("avancement.gain"),
          s("avancement.objectif"),
          s("avancement.ecart"),
          s("avancement.avancement"),
        ],
        synthese.avancement.flatMap(({ lot, activites }) => [
          [
            cellule(s("avancement.lot", { code: lot.code, nom: lot.nom, mode: modeExecution(lot.modeExecution) }), {
              gras: true,
            }),
            ...Array.from({ length: 8 }, () => cellule("")),
          ],
          ...(activites.length === 0
            ? [[cellule(s("avancement.aucunRapport"), { ton: "neutre" }), ...Array.from({ length: 8 }, () => cellule(""))]]
            : activites.map((activite) => {
                const gain = activite.avancementFin - activite.avancementDebut;
                const ecartActivite = ecartObjectif(gain, activite.objectifGain);
                return [
                  cellule(activite.libelle),
                  cellule(activite.unite),
                  cellule(formaterQuantite(activite.quantitePrevue)),
                  cellule(pourcent(activite.avancementDebut)),
                  cellule(pourcent(activite.avancementFin)),
                  cellule(s("pointsCourts", { valeur: signe(gain) }), { gras: true, ton: "primaire" }),
                  cellule(s("pointsCourts", { valeur: signe(activite.objectifGain) })),
                  cellule(s("pointsCourts", { valeur: signe(ecartActivite) }), {
                    gras: true,
                    ton: ecartActivite < 0 ? "erreur" : "succes",
                  }),
                  cellule(pourcent(activite.avancementFin), { gras: true }),
                ];
              })),
        ]),
        ABSENT,
      ),
    ],
  });

  numerotees.push({
    titre: s("sections.effectifs"),
    blocs:
      synthese.effectifs.length === 0
        ? [{ type: "paragraphe", texte: s("effectifs.sousTraitance") }]
        : [
            tableau(
              [
                s("effectifs.categorie"),
                s("effectifs.prevu"),
                s("effectifs.moyenne"),
                s("effectifs.taux"),
                s("effectifs.heures"),
                s("effectifs.absences"),
                s("effectifs.observation"),
              ],
              [
                ...synthese.effectifs.map((ligne) => {
                  const taux = ligne.prevuParJour ? Math.round((ligne.presenceMoyenne / ligne.prevuParJour) * 100) : 0;
                  return [
                    cellule(ligne.categorie, { gras: true }),
                    cellule(ligne.prevuParJour),
                    cellule(formaterQuantite(ligne.presenceMoyenne)),
                    cellule(pourcent(taux), taux < 85 ? { gras: true, ton: "erreur" } : undefined),
                    cellule(t("rapport.heures", { valeur: formaterQuantite(ligne.heures) })),
                    cellule(ligne.absences, ligne.absences > 0 ? { gras: true, ton: "erreur" } : undefined),
                    cellule(ligne.observation ?? t("rapport.neant")),
                  ];
                }),
                [
                  cellule(s("effectifs.total"), { gras: true }),
                  cellule(totalPrevu, { gras: true }),
                  cellule(formaterQuantite(Math.round(totalMoyen * 10) / 10), { gras: true }),
                  cellule(tauxEffectifs === null ? "" : pourcent(tauxEffectifs), { gras: true }),
                  cellule(t("rapport.heures", { valeur: formaterQuantite(totalHeures) }), { gras: true }),
                  cellule(totalAbsences, { gras: true }),
                  cellule(s("effectifs.cible", { cible: CIBLE_PRESENCE }), { gras: true }),
                ],
              ],
              ABSENT,
            ),
          ],
  });

  numerotees.push({
    titre: s("sections.materiaux"),
    blocs: [
      tableau(
        [
          s("materiaux.designation"),
          s("materiaux.unite"),
          s("materiaux.debut"),
          s("materiaux.consomme"),
          s("materiaux.livre"),
          s("materiaux.fin"),
          s("materiaux.seuil"),
          s("materiaux.statut"),
        ],
        synthese.materiaux.map((ligne) => {
          const alerte = enAlerteStock(ligne.stockFin, ligne.seuilAlerte);
          return [
            cellule(ligne.designation, { gras: true }),
            cellule(ligne.unite),
            cellule(formaterQuantite(ligne.stockDebut)),
            cellule(formaterQuantite(ligne.consomme)),
            cellule(formaterQuantite(ligne.livre)),
            cellule(formaterQuantite(ligne.stockFin), { gras: true, ton: alerte ? "erreur" : undefined }),
            cellule(formaterQuantite(ligne.seuilAlerte)),
            cellule(alerte ? t("rapport.materiaux.alerte") : t("rapport.materiaux.ok"), {
              gras: true,
              ton: alerte ? "erreur" : "succes",
            }),
          ];
        }),
        s("materiaux.vide"),
      ),
    ],
  });

  numerotees.push({
    titre: s("sections.incidents"),
    blocs: [
      tableau(
        [
          s("incidents.date"),
          s("incidents.lot"),
          s("incidents.type"),
          s("incidents.description"),
          s("incidents.gravite"),
          s("incidents.resolution"),
        ],
        [
          ...synthese.incidents.map((incident) => [
            cellule(formaterJourMoisNumerique(incident.date)),
            cellule(incident.lotCode),
            cellule(t(`enumerations.typeIncident.${incident.type}`)),
            cellule(incident.description),
            cellule(t(`enumerations.gravite.${incident.gravite}`), { gras: true, ton: TON_GRAVITE[incident.gravite] }),
            cellule(
              incident.resolu
                ? s("incidents.resolu", { action: incident.action })
                : s("incidents.enCours", { action: incident.action }),
              { ton: incident.resolu ? "succes" : "avertissement" },
            ),
          ]),
          ...(synthese.incidents.length
            ? [
                [
                  cellule(s("incidents.total", { n: synthese.incidents.length }), { gras: true }),
                  cellule(""),
                  cellule(""),
                  cellule(""),
                  cellule(s("incidents.totalGravite", { majeurs: chiffres.incidentsMajeurs }), { gras: true }),
                  cellule(
                    s("incidents.totalResolution", { resolus, enCours: synthese.incidents.length - resolus }),
                    { gras: true },
                  ),
                ],
              ]
            : []),
        ],
        s("incidents.vide"),
      ),
    ],
  });

  numerotees.push({
    titre: s("sections.appreciation"),
    blocs: [
      synthese.appreciation
        ? {
            type: "encadre",
            auteur: s("appreciation.auteur", {
              nom: synthese.appreciation.auteur,
              quand: formaterDateHeure(synthese.appreciation.redigeeLe),
            }),
            texte: synthese.appreciation.texte,
          }
        : { type: "paragraphe", texte: s("appreciation.enAttente") },
    ],
  });

  numerotees.push({
    titre: s("sections.objectifs"),
    blocs: [
      tableau(
        [
          s("objectifs.lot"),
          s("objectifs.activite"),
          s("objectifs.objectif"),
          s("objectifs.cible"),
          s("objectifs.prerequis"),
        ],
        synthese.objectifs.map((objectif) => [
          cellule(objectif.lotCode),
          cellule(objectif.activite, { gras: true }),
          cellule(objectif.objectif),
          cellule(pourcent(objectif.cible)),
          cellule(objectif.prerequis),
        ]),
        s("objectifs.vide"),
      ),
    ],
  });

  // Une case par signataire, et seulement « Signé le : » — comme le rapport journalier.
  const signatures: CasePdf[] = synthese.circuit.map((etape) => ({
    role: role(etape.role),
    mention: etape.signeLe
      ? t("rapport.pdf.signeLe", { quand: formaterDateHeure(etape.signeLe) })
      : t("rapport.pdf.signeLeVide"),
    nom: etape.signataire,
    accent: etape.etat === "SIGNE",
  }));
  numerotees.push({
    titre: s("sections.circuit"),
    blocs: [
      { type: "signatures", cases: signatures },
      { type: "paragraphe", texte: s("mention", { n: chiffres.rapportsRecus }) },
    ],
  });

  /* --- Le document --- */

  const { emetteur, pied } = emetteurDocument(entreprise, marque);

  return {
    nomFichier: s("pdf.nomFichier", { reference: synthese.reference }),
    entete: {
      emetteur,
      logo,
      titre: s("titre"),
      sousTitre: t("rapport.pdf.dateGeneration", { date: formaterDateHeure(maintenant) }),
    },
    objet: {
      titre: s(`type.${synthese.type}`),
      pastilles: [
        { texte: synthese.projetNom, ton: "neutre" },
        { texte: periode, ton: "neutre" },
      ],
      indicateur: {
        libelle: s("avancementFin"),
        valeur: pourcent(progression.fin),
        detail: s("points", { valeur: signe(progression.gain) }),
        ton: ecart < 0 ? "avertissement" : "succes",
      },
    },
    sections: [
      identification,
      progressionSection,
      ...numerotees.map((section, rang) => ({ titre: `${rang + 1}. ${section.titre}`, blocs: section.blocs })),
    ],
    pied: {
      gauche: pied,
      droite: (page, total) => t("rapport.pdf.page", { page, total }),
    },
  };
}

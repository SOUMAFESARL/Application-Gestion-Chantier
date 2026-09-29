import {
  activitesActives,
  avancementActivite,
  cumulActivite,
  enAlerteStock,
  montantProduction,
  presenceSuffisante,
  retardPoints,
  stockFin,
  tauxPresence,
  totalProduction,
  totauxEffectifs,
} from "@/features/chantier";
import type { EtapeCircuit, RapportJournalier } from "@/features/chantier";
import type { ModeExecutionLot } from "@/features/projets/types";
import { formaterDate, formaterDateHeure, formaterMontant, formaterQuantite } from "@/lib/format";
import type { BlocPdf, CasePdf, CellulePdf, DocumentPdf, SectionPdf } from "@/lib/export/documentPdf";

import { emetteurDocument } from "../../projets/[id]/contenuFichePdf";
import {
  TEINTE_CONDITIONS,
  TEINTE_METEO,
  teintesChiffresRapport,
  TON_BLOCAGE,
  TON_CONFORMITE,
  TON_EQUIPEMENT,
  TON_GRAVITE,
  TON_SITUATION,
} from "../classes";
import type { SourcePdf } from "../GenerationDocumentPdf";

/**
 * Le rapport journalier généré — le même document que l'écran, section par
 * section, dessiné par `lib/export/documentPdf` : l'en-tête (logo ou nom de
 * l'entreprise, titre, date de génération, référence) et le pied paginé sont
 * ceux de la fiche projet.
 *
 * Comme `contenuFicheProjet`, ce module ne calcule rien : les chiffres
 * viennent de `features/chantier` (les mêmes que l'écran), il les traduit.
 * Les sections suivent le mode d'exécution renvoyé par le serveur, comme à
 * l'écran : une section sans objet pour le lot n'apparaît pas.
 */

/** Le traducteur de l'espace `journal` (next-intl). */
type Traduire = (cle: string, valeurs?: Record<string, string | number>) => string;

export interface DonneesRapportPdf extends SourcePdf {
  rapport: RapportJournalier;
  /** Le jour du rapport, déjà mis en toutes lettres par l'écran. */
  jour: string;
  modeExecution: (mode: ModeExecutionLot) => string;
}

function tableau(entetes: string[], lignes: CellulePdf[][], vide: string): BlocPdf {
  return { type: "tableau", tableau: { entetes, lignes }, vide };
}

/** Une cellule de texte ; une valeur absente s'écrit comme à l'écran. */
function cellule(texte: string | number | null, options?: Omit<CellulePdf, "texte">): CellulePdf {
  return { texte: texte === null ? "" : String(texte), ...options };
}

export function contenuRapportPdf(t: Traduire, donnees: DonneesRapportPdf): DocumentPdf {
  const { rapport, entreprise, logo, marque, jour, modeExecution, maintenant } = donnees;
  const r = (cle: string, valeurs?: Record<string, string | number>) => t(`rapport.${cle}`, valeurs);
  const role = (cle: EtapeCircuit["role"]) => t(`circuit.role.${cle}`);
  const neant = r("neant");
  const pourcent = (valeur: number) => r("pourcent", { valeur });

  const reference = rapport.reference ?? "";
  const lot = r("lotValeur", { code: rapport.lot.code, nom: rapport.lot.nom });
  const retard = retardPoints(rapport);
  const totaux = rapport.effectifs ? totauxEffectifs(rapport.effectifs) : null;
  const presence = totaux?.taux ?? tauxPresence(rapport.effectifPresent, rapport.effectifPrevu);
  const livraisonsPartielles = rapport.livraisons.filter((livraison) => livraison.conformite !== "CONFORME").length;
  const incidentsMajeurs = rapport.listeIncidents.filter((incident) => incident.gravite !== "MINEUR").length;
  const blocages = rapport.listeBlocages.length;
  const sousTraitanceStructuree = !rapport.effectifs && rapport.lot.modeExecution === "SOUS_TRAITANCE_STRUCTUREE";
  // Les mêmes teintes que les cartes de l'écran.
  const teintes = teintesChiffresRapport({
    retard,
    presenceInsuffisante: presenceSuffisante(presence) === "INSUFFISANTE",
    livraisonsPartielles,
    incidents: rapport.listeIncidents.length,
    incidentsMajeurs,
    blocages,
  });

  /* --- Les sections, numérotées d'après celles que le lot affiche --- */

  const numerotees: { titre: string; blocs: BlocPdf[] }[] = [];

  numerotees.push({
    titre: r("sections.meteo"),
    blocs: [
      // Six cartes teintées comme à l'écran, en deux rangées pour que les
      // valeurs tiennent dans la largeur d'une tuile.
      {
        type: "tuiles",
        tuiles: [
          { libelle: r("meteo.matin"), valeur: t(`enumerations.meteo.${rapport.meteo.matin}`), ton: TEINTE_METEO.ciel },
          {
            libelle: r("meteo.apresMidi"),
            valeur: t(`enumerations.meteo.${rapport.meteo.apresMidi}`),
            ton: TEINTE_METEO.ciel,
          },
          {
            libelle: r("meteo.temperature"),
            valeur: r("meteo.temperatureValeur", {
              min: rapport.meteo.temperatureMin,
              max: rapport.meteo.temperatureMax,
            }),
            ton: TEINTE_METEO.temperature,
          },
        ],
      },
      {
        type: "tuiles",
        tuiles: [
          { libelle: r("meteo.humidite"), valeur: pourcent(rapport.meteo.humidite), ton: TEINTE_METEO.humidite },
          { libelle: r("meteo.vent"), valeur: rapport.meteo.vent, ton: TEINTE_METEO.vent },
          {
            libelle: r("meteo.conditions"),
            valeur: t(`enumerations.conditions.${rapport.meteo.conditions}`),
            ton: TEINTE_CONDITIONS[rapport.meteo.conditions],
          },
        ],
      },
      ...(rapport.meteo.prevision
        ? [{ type: "paragraphe" as const, texte: r("meteo.prevision", { texte: rapport.meteo.prevision }) }]
        : []),
    ],
  });

  if (rapport.effectifs && totaux) {
    numerotees.push({
      titre: r("sections.effectifs"),
      blocs: [
        tableau(
          [
            r("effectifs.categorie"),
            r("effectifs.prevus"),
            r("effectifs.presents"),
            r("effectifs.absents"),
            r("effectifs.presence"),
            r("effectifs.heures"),
            r("effectifs.observation"),
          ],
          [
            ...rapport.effectifs.map((ligne) => {
              const taux = tauxPresence(ligne.presents, ligne.prevus) ?? 0;
              const absents = ligne.prevus - ligne.presents;
              return [
                cellule(ligne.categorie, { gras: true }),
                cellule(ligne.prevus),
                cellule(ligne.presents),
                cellule(absents, absents > 0 ? { ton: "erreur", gras: true } : undefined),
                cellule(pourcent(taux), { jauge: taux }),
                cellule(r("heures", { valeur: formaterQuantite(ligne.heures) })),
                cellule(ligne.observation ?? neant),
              ];
            }),
            [
              cellule(r("total"), { gras: true }),
              cellule(totaux.prevus, { gras: true }),
              cellule(totaux.presents, { gras: true }),
              cellule(totaux.absents, { gras: true }),
              cellule(pourcent(totaux.taux ?? 0), { gras: true }),
              cellule(r("heures", { valeur: formaterQuantite(totaux.heures) }), { gras: true }),
              cellule(r(`effectifs.appreciation.${presenceSuffisante(totaux.taux) ?? "BONNE"}`), { gras: true }),
            ],
          ],
          neant,
        ),
      ],
    });
  }

  if (sousTraitanceStructuree) {
    numerotees.push({
      titre: r("sections.effectifs"),
      blocs: [
        {
          type: "paragraphe",
          texte: r("effectifs.sousTraitant", {
            presents: rapport.effectifPresent ?? 0,
            prevus: rapport.effectifPrevu ?? 0,
          }),
        },
      ],
    });
  }

  if (rapport.production) {
    numerotees.push({
      titre: r("sections.production"),
      blocs: [
        tableau(
          [
            r("production.intervenant"),
            r("production.activite"),
            r("production.unite"),
            r("production.prix"),
            r("production.quantite"),
            r("production.cumul"),
            r("production.montant"),
          ],
          [
            ...rapport.production.map((ligne) => [
              cellule(ligne.intervenant, { gras: true }),
              cellule(ligne.activite),
              cellule(ligne.unite),
              cellule(formaterMontant(ligne.prixUnitaire)),
              cellule(formaterQuantite(ligne.quantiteJour)),
              cellule(r("quantiteUnite", { quantite: formaterQuantite(ligne.cumul), unite: ligne.unite })),
              cellule(formaterMontant(montantProduction(ligne))),
            ]),
            [
              cellule(r("total"), { gras: true }),
              cellule(""),
              cellule(""),
              cellule(""),
              cellule(""),
              cellule(""),
              cellule(formaterMontant(totalProduction(rapport.production)), { gras: true }),
            ],
          ],
          neant,
        ),
        { type: "paragraphe", texte: r("production.aide") },
      ],
    });
  }

  numerotees.push({
    titre: r("sections.avancement", { code: rapport.lot.code, nom: rapport.lot.nom }),
    blocs: [
      {
        type: "paragraphe",
        texte: r("avancement.global", {
          reel: rapport.avancementLot ?? 0,
          theorique: rapport.avancementTheorique ?? 0,
        }),
      },
      tableau(
        [
          r("avancement.activite"),
          r("avancement.unite"),
          r("avancement.prevue"),
          r("avancement.veille"),
          r("avancement.jour"),
          r("avancement.cumul"),
          r("avancement.avancement"),
          r("avancement.observation"),
        ],
        rapport.activites.map((ligne) => {
          const avancement = avancementActivite(ligne);
          return [
            cellule(ligne.libelle, { gras: true }),
            cellule(ligne.unite),
            cellule(formaterQuantite(ligne.quantitePrevue)),
            cellule(formaterQuantite(ligne.cumulVeille)),
            cellule(formaterQuantite(ligne.quantiteJour), { ton: "primaire", gras: true }),
            cellule(formaterQuantite(cumulActivite(ligne))),
            cellule(pourcent(avancement), { jauge: avancement }),
            cellule(ligne.observation ?? neant),
          ];
        }),
        neant,
      ),
    ],
  });

  numerotees.push({
    titre: r("sections.materiaux"),
    blocs: [
      tableau(
        [
          r("materiaux.designation"),
          r("materiaux.unite"),
          r("materiaux.debut"),
          r("materiaux.livre"),
          r("materiaux.utilise"),
          r("materiaux.fin"),
          r("materiaux.seuil"),
          r("materiaux.statut"),
        ],
        rapport.materiaux.map((ligne) => {
          const fin = stockFin(ligne);
          const enAlerte = enAlerteStock(fin, ligne.seuilAlerte);
          return [
            cellule(ligne.designation, { gras: true }),
            cellule(ligne.unite),
            cellule(formaterQuantite(ligne.stockDebut)),
            cellule(ligne.livre ? formaterQuantite(ligne.livre) : neant),
            cellule(formaterQuantite(ligne.utilise)),
            cellule(formaterQuantite(fin), { gras: true, ton: enAlerte ? "erreur" : undefined }),
            cellule(formaterQuantite(ligne.seuilAlerte)),
            cellule(enAlerte ? r("materiaux.alerte") : r("materiaux.ok"), {
              gras: true,
              ton: enAlerte ? "erreur" : "succes",
            }),
          ];
        }),
        r("materiaux.vide"),
      ),
    ],
  });

  numerotees.push({
    titre: r("sections.livraisons"),
    blocs: [
      tableau(
        [
          r("livraisons.fournisseur"),
          r("livraisons.designation"),
          r("livraisons.quantite"),
          r("livraisons.bon"),
          r("livraisons.heure"),
          r("livraisons.conformite"),
          r("livraisons.observation"),
        ],
        rapport.livraisons.map((livraison) => [
          cellule(livraison.fournisseur, { gras: true }),
          cellule(livraison.designation),
          cellule(livraison.quantite),
          cellule(livraison.bonLivraison),
          cellule(livraison.heure),
          cellule(t(`enumerations.conformite.${livraison.conformite}`), {
            gras: true,
            ton: TON_CONFORMITE[livraison.conformite],
          }),
          cellule(livraison.observation ?? neant),
        ]),
        r("livraisons.vide"),
      ),
    ],
  });

  numerotees.push({
    titre: r("sections.equipements"),
    blocs: [
      tableau(
        [
          r("equipements.designation"),
          r("equipements.reference"),
          r("equipements.propriete"),
          r("equipements.utilisation"),
          r("equipements.operateur"),
          r("equipements.etat"),
          r("equipements.observation"),
        ],
        rapport.equipements.map((equipement) => [
          cellule(equipement.designation, { gras: true }),
          cellule(equipement.reference),
          cellule(t(`enumerations.propriete.${equipement.propriete}`)),
          cellule(equipement.utilisation),
          cellule(equipement.operateur),
          cellule(t(`enumerations.etatEquipement.${equipement.etat}`), {
            gras: true,
            ton: TON_EQUIPEMENT[equipement.etat],
          }),
          cellule(equipement.observation ?? neant),
        ]),
        r("equipements.vide"),
      ),
    ],
  });

  numerotees.push({
    titre: r("sections.incidents"),
    blocs: [
      tableau(
        [
          r("incidents.numero"),
          r("incidents.type"),
          r("incidents.description"),
          r("incidents.gravite"),
          r("incidents.decidePar"),
          r("incidents.action"),
        ],
        rapport.listeIncidents.map((incident) => [
          cellule(incident.numero, { gras: true }),
          cellule(t(`enumerations.typeIncident.${incident.type}`)),
          cellule(incident.description),
          cellule(t(`enumerations.gravite.${incident.gravite}`), { gras: true, ton: TON_GRAVITE[incident.gravite] }),
          cellule(role(incident.decidePar)),
          cellule(incident.action),
        ]),
        r("incidents.vide"),
      ),
    ],
  });

  numerotees.push({
    titre: r("sections.blocages"),
    blocs: [
      tableau(
        [
          r("blocages.numero"),
          r("blocages.nature"),
          r("blocages.description"),
          r("blocages.niveau"),
          r("blocages.impact"),
          r("blocages.escalade"),
        ],
        rapport.listeBlocages.map((blocage) => [
          cellule(blocage.numero, { gras: true }),
          cellule(t(`enumerations.natureBlocage.${blocage.nature}`)),
          cellule(blocage.description),
          cellule(t(`enumerations.niveauBlocage.${blocage.niveau}`), { gras: true, ton: TON_BLOCAGE[blocage.niveau] }),
          cellule(blocage.impact),
          cellule(blocage.escalade ? role(blocage.escalade) : neant),
        ]),
        r("blocages.aucun"),
      ),
    ],
  });

  numerotees.push({
    titre: `${r("sections.photos")} — ${r("photos.nombre", { n: rapport.listePhotos.length })}`,
    blocs: [
      {
        type: "liste",
        vide: neant,
        elements: rapport.listePhotos.map((photo, rang) => ({
          texte: r("pdf.photo", {
            titre: r("photos.titre", { rang: rang + 1, total: rapport.listePhotos.length }),
            legende: photo.legende,
            meta: r("photos.meta", {
              heure: photo.heure,
              latitude: Math.abs(photo.latitude).toFixed(4),
              longitude: Math.abs(photo.longitude).toFixed(4),
            }),
          }),
          ton: photo.gpsConfirme ? ("succes" as const) : ("neutre" as const),
        })),
      },
    ],
  });

  numerotees.push({
    titre: r("sections.previsions"),
    blocs: [
      tableau(
        [r("previsions.activite"), r("previsions.equipe"), r("previsions.objectif"), r("previsions.prerequis")],
        rapport.previsions.map((prevision) => [
          cellule(prevision.activite, { gras: true }),
          cellule(prevision.equipe),
          cellule(prevision.objectif),
          cellule(prevision.prerequis),
        ]),
        r("previsions.vide"),
      ),
    ],
  });

  numerotees.push({
    titre: r("sections.note"),
    blocs: [
      {
        type: "encadre",
        auteur: r("note.auteur", {
          nom: rapport.intervenants.chefChantier,
          quand: rapport.soumisLe ? formaterDateHeure(rapport.soumisLe) : formaterDate(rapport.date),
        }),
        texte: rapport.noteChefChantier ?? r("note.vide"),
      },
    ],
  });

  // Une case par signataire, et seulement « Signé le : » — suivi de la date
  // quand l'étape est signée, laissé en blanc sinon.
  const signatures: CasePdf[] = rapport.circuit.map((etape) => ({
    role: role(etape.role),
    mention: etape.signeLe ? r("pdf.signeLe", { quand: formaterDateHeure(etape.signeLe) }) : r("pdf.signeLeVide"),
    nom: etape.signataire,
    accent: etape.etat === "SIGNE",
  }));
  numerotees.push({ titre: r("sections.circuit"), blocs: [{ type: "signatures", cases: signatures }] });

  /* --- L'identification, puis les sections numérotées --- */

  const sections: SectionPdf[] = [
    {
      titre: r("pdf.identification"),
      accent: true,
      blocs: [
        {
          type: "cles",
          elements: [
            { libelle: r("projet"), valeur: rapport.lot.projetNom },
            { libelle: role("CC"), valeur: rapport.intervenants.chefChantier },
            { libelle: r("lot"), valeur: lot },
            { libelle: role("CT"), valeur: rapport.intervenants.conducteurTravaux },
            { libelle: r("mode"), valeur: modeExecution(rapport.lot.modeExecution) },
            { libelle: role("CP"), valeur: rapport.intervenants.chefProjet },
            { libelle: r("referenceProjet"), valeur: rapport.lot.projetReference },
            { libelle: r("date"), valeur: jour },
            { libelle: r("numero"), valeur: reference },
            {
              libelle: r("horaires"),
              valeur: r("horairesValeur", { debut: rapport.heureDebut, fin: rapport.heureFin }),
            },
            { libelle: r("localisation"), valeur: rapport.localisation },
            {
              libelle: r("statutLigne"),
              valeur: t(`situation.${rapport.situation}`),
              ton: TON_SITUATION[rapport.situation],
            },
          ],
        },
        {
          type: "tuiles",
          tuiles: [
            {
              libelle: r("chiffres.effectifs"),
              valeur: r("fraction", { a: rapport.effectifPresent ?? 0, b: rapport.effectifPrevu ?? 0 }),
              detail: r("chiffres.presence", { taux: presence ?? 0 }),
              ton: teintes.effectifs,
            },
            {
              libelle: r("chiffres.heures"),
              valeur: totaux ? r("heures", { valeur: formaterQuantite(totaux.heures) }) : r("sansObjet"),
              detail: totaux ? r("chiffres.heuresDetail") : r("chiffres.heuresSousTraitant"),
              ton: teintes.heures,
            },
            {
              libelle: r("chiffres.activites"),
              valeur: r("fraction", { a: activitesActives(rapport.activites), b: rapport.activites.length }),
              detail: r("chiffres.activitesDetail"),
              ton: teintes.activites,
            },
            {
              libelle: r("chiffres.photos"),
              valeur: String(rapport.listePhotos.length),
              detail: r("chiffres.photosDetail"),
              ton: teintes.photos,
            },
          ],
        },
        {
          type: "tuiles",
          tuiles: [
            {
              libelle: r("chiffres.livraisons"),
              valeur: String(rapport.livraisons.length),
              detail: r("chiffres.livraisonsDetail", { n: livraisonsPartielles }),
              ton: teintes.livraisons,
            },
            {
              libelle: r("chiffres.incidents"),
              valeur: String(rapport.listeIncidents.length),
              detail: r("chiffres.incidentsDetail", { n: incidentsMajeurs }),
              ton: teintes.incidents,
            },
            {
              libelle: r("chiffres.blocages"),
              valeur: String(blocages),
              detail: blocages ? r("chiffres.blocagesDetail") : r("chiffres.aucunBlocage"),
              ton: teintes.blocages,
            },
          ],
        },
      ],
    },
    ...numerotees.map((section, rang) => ({ titre: `${rang + 1}. ${section.titre}`, blocs: section.blocs })),
  ];

  /* --- Le document --- */

  const { emetteur, pied } = emetteurDocument(entreprise, marque);

  return {
    nomFichier: r("pdf.nomFichier", { reference: reference || rapport.id }),
    entete: {
      emetteur,
      logo,
      titre: r("titre"),
      sousTitre: r("pdf.dateGeneration", { date: formaterDateHeure(maintenant) }),
      reference,
    },
    objet: {
      titre: r("titrePage", { jour }),
      pastilles: [
        { texte: lot, ton: "neutre" },
        { texte: t(`situation.${rapport.situation}`), ton: TON_SITUATION[rapport.situation] },
      ],
      indicateur: {
        libelle: r("chiffres.avancement"),
        valeur: pourcent(rapport.avancementLot ?? 0),
        detail:
          retard !== null && retard > 0
            ? r("pdf.retard", { points: retard })
            : r("pdf.alHeure"),
        ton: teintes.avancement,
      },
    },
    sections,
    pied: {
      gauche: pied,
      droite: (page, total) => r("pdf.page", { page, total }),
    },
  };
}

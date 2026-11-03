import {
  activitesActives,
  activitesDuRapport,
  avancementActivite,
  cumulActivite,
  enAlerteStock,
  formatDocument,
  presenceSuffisante,
  retardPoints,
  stockFin,
  tailleKo,
  tauxPresence,
  totauxEffectifs,
  totauxEquipes,
} from "@/features/chantier";
import type { EtapeCircuit, LotJournal, RapportJournalier } from "@/features/chantier";
import { appliquerDocumentsAuPdf } from "@/features/documents";
import { formaterDate, formaterDateHeure, formaterQuantite } from "@/lib/format";
import type {
  BlocPdf,
  CasePdf,
  CellulePdf,
  CleValeurPdf,
  DocumentPdf,
  SectionPdf,
  TonPdf,
} from "@/lib/export/documentPdf";

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
 * Le rapport journalier généré en PDF — le même document que l'écran, section
 * par section, dessiné par `lib/export/documentPdf`.
 */

type Traduire = (cle: string, valeurs?: Record<string, string | number>) => string;

export interface DonneesRapportPdf extends SourcePdf {
  rapport: RapportJournalier;
  jour: string;
  modeExecution: (lot: LotJournal) => string;
}

function tableau(entetes: string[], lignes: CellulePdf[][], vide: string): BlocPdf {
  return { type: "tableau", tableau: { entetes, lignes }, vide };
}

function cellule(texte: string | number | null, options?: Omit<CellulePdf, "texte">): CellulePdf {
  return { texte: texte === null ? "" : String(texte), ...options };
}

export function contenuRapportPdf(t: Traduire, donnees: DonneesRapportPdf): DocumentPdf {
  const { rapport, entreprise, logo, documents, marque, jour, modeExecution, maintenant } = donnees;
  const r = (cle: string, valeurs?: Record<string, string | number>) => t(`rapport.${cle}`, valeurs);
  const role = (cle: EtapeCircuit["role"]) => t(`circuit.role.${cle}`);
  const neant = r("neant");
  const sansObjet = r("sansObjet");
  const separateurNoms = r("separateurNoms");
  const separateurDetail = r("pdf.separateurDetail");
  const pourcent = (valeur: number | string) => r("pourcent", { valeur });
  const chiffre = (libelle: string, valeur: string, detail: string, ton: TonPdf): CleValeurPdf => ({
    libelle,
    valeur: r("pdf.chiffre", { valeur, detail }),
    ton: ton === "erreur" || ton === "avertissement" ? ton : undefined,
  });

  const reference = rapport.reference ?? "";
  const chantier = rapport.chantier.projetNom;
  const activites = activitesDuRapport(rapport);
  const retard = retardPoints(rapport);
  const totaux =
    rapport.equipes.length > 0
      ? totauxEquipes(rapport.equipes)
      : rapport.effectifs
        ? totauxEffectifs(rapport.effectifs)
        : null;
  const presence = totaux?.taux ?? tauxPresence(rapport.effectifPresent, rapport.effectifPrevu);
  const livraisonsPartielles = rapport.livraisons.filter(
    (livraison) => livraison.conformite !== "CONFORME",
  ).length;
  const incidentsMajeurs = rapport.listeIncidents.filter(
    (incident) => incident.gravite !== "" && incident.gravite !== "MINEUR",
  ).length;
  const blocages = rapport.listeBlocages.length;
  const teintes = teintesChiffresRapport({
    retard,
    presenceInsuffisante: presenceSuffisante(presence) === "INSUFFISANTE",
    livraisonsPartielles,
    incidents: rapport.listeIncidents.length,
    incidentsMajeurs,
    blocages,
  });

  const numerotees: { titre: string; blocs: BlocPdf[] }[] = [];

  numerotees.push({
    titre: r("sections.meteo"),
    blocs: [
      {
        type: "tuiles",
        tuiles: [
          {
            libelle: r("meteo.matin"),
            valeur: rapport.meteo.matin ? t(`enumerations.meteo.${rapport.meteo.matin}`) : neant,
            ton: TEINTE_METEO.ciel,
          },
          {
            libelle: r("meteo.apresMidi"),
            valeur: rapport.meteo.apresMidi
              ? t(`enumerations.meteo.${rapport.meteo.apresMidi}`)
              : neant,
            ton: TEINTE_METEO.ciel,
          },
          {
            libelle: r("meteo.conditions"),
            valeur: rapport.meteo.conditions
              ? t(`enumerations.conditions.${rapport.meteo.conditions}`)
              : neant,
            ton: rapport.meteo.conditions
              ? TEINTE_CONDITIONS[rapport.meteo.conditions]
              : "neutre",
          },
        ],
      },
    ],
  });

  if (rapport.equipes.length > 0 && totaux) {
    numerotees.push({
      titre: r("sections.equipes"),
      blocs: [
        tableau(
          [
            r("equipes.nom"),
            r("equipes.entreprise"),
            r("equipes.presents"),
            r("equipes.absents"),
            r("equipes.retards"),
            r("equipes.heures"),
            r("equipes.qualite"),
            r("equipes.observation"),
          ],
          [
            ...rapport.equipes.map((equipe) => [
              cellule(equipe.nom, { gras: true }),
              cellule(equipe.entreprise || neant),
              cellule(
                equipe.presents.length > 0
                  ? `${r("fraction", { a: equipe.presents.length, b: equipe.membres })} (${equipe.presents.join(separateurNoms)})`
                  : r("fraction", { a: 0, b: equipe.membres }),
              ),
              cellule(
                equipe.absents.length > 0 ? equipe.absents.join(separateurNoms) : neant,
                equipe.absents.length > 0 ? { ton: "erreur" } : undefined,
              ),
              cellule(
                equipe.retards.length > 0 ? equipe.retards.join(separateurNoms) : neant,
                equipe.retards.length > 0 ? { ton: "avertissement" } : undefined,
              ),
              cellule(
                equipe.heures !== null ? r("heures", { valeur: formaterQuantite(equipe.heures) }) : neant,
              ),
              cellule(equipe.qualite ? t(`enumerations.qualiteExecution.${equipe.qualite}`) : neant),
              cellule(equipe.observation || neant),
            ]),
            [
              cellule(r("total"), { gras: true }),
              cellule(""),
              cellule(r("fraction", { a: totaux.presents, b: totaux.prevus }), { gras: true }),
              cellule(totaux.absents, { gras: true }),
              cellule(""),
              cellule(r("heures", { valeur: formaterQuantite(totaux.heures) }), { gras: true }),
              cellule(pourcent(totaux.taux ?? 0), { gras: true }),
              cellule(r(`effectifs.appreciation.${presenceSuffisante(totaux.taux) ?? "BONNE"}`), {
                gras: true,
              }),
            ],
          ],
          neant,
        ),
      ],
    });
  } else if (rapport.effectifs && totaux) {
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
                cellule(pourcent(taux)),
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
              cellule(r(`effectifs.appreciation.${presenceSuffisante(totaux.taux) ?? "BONNE"}`), {
                gras: true,
              }),
            ],
          ],
          neant,
        ),
      ],
    });
  }

  numerotees.push({
    titre: r("sections.avancement"),
    blocs: [
      {
        type: "paragraphe",
        texte: r("avancement.global", {
          reel: rapport.avancement ?? 0,
          theorique: rapport.avancementTheorique ?? 0,
        }),
      },
      ...(rapport.travaux.length === 0
        ? [{ type: "paragraphe" as const, texte: r("avancement.aucunLot") }]
        : []),
      ...rapport.travaux.flatMap((travaux): BlocPdf[] => [
        {
          type: "paragraphe",
          texte: r("pdf.lot", {
            lot: r("avancement.lot", { code: travaux.lot.code, nom: travaux.lot.nom }),
            detail: r("avancement.lotDetail", {
              mode: modeExecution(travaux.lot),
              reel: travaux.avancement,
              theorique: travaux.avancementTheorique,
            }),
          }),
        },
        ...(travaux.observation
          ? [
              {
                type: "paragraphe" as const,
                texte: r("avancement.point", { texte: travaux.observation }),
              },
            ]
          : []),
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
          travaux.activites.map((ligne) => {
            const avancement = avancementActivite(ligne);
            const details = [
              ligne.libelle,
              ligne.localisation,
              ligne.equipesNoms.length > 0 ? ligne.equipesNoms.join(separateurNoms) : "",
            ].filter(Boolean);
            const unite =
              ligne.unite ??
              (ligne.modeMesure === "JALON"
                ? r("avancement.uniteJalon")
                : r("avancement.unitePourcent"));
            const veille =
              ligne.modeMesure === "QUANTITE"
                ? formaterQuantite(ligne.cumulVeille)
                : ligne.modeMesure === "POURCENTAGE"
                  ? pourcent(formaterQuantite(ligne.pourcentageVeille))
                  : sansObjet;
            const realiseJour =
              ligne.modeMesure === "QUANTITE"
                ? formaterQuantite(ligne.quantiteJour)
                : ligne.modeMesure === "POURCENTAGE"
                  ? ligne.pourcentageJour !== null
                    ? pourcent(formaterQuantite(ligne.pourcentageJour))
                    : neant
                  : ligne.jalonAtteint
                    ? r("avancement.jalonAtteint")
                    : r("avancement.jalonEnCours");
            return [
              cellule(details.join(separateurDetail), { gras: true }),
              cellule(unite),
              cellule(
                ligne.modeMesure === "QUANTITE"
                  ? formaterQuantite(ligne.quantitePrevue)
                  : sansObjet,
              ),
              cellule(veille),
              cellule(realiseJour, { ton: "primaire", gras: true }),
              cellule(
                ligne.modeMesure === "QUANTITE"
                  ? formaterQuantite(cumulActivite(ligne))
                  : sansObjet,
              ),
              cellule(pourcent(avancement)),
              cellule(ligne.observation ?? neant),
            ];
          }),
          neant,
        ),
      ]),
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
          const quantite = (valeur: number | null) =>
            valeur === null ? neant : formaterQuantite(valeur);
          return [
            cellule(ligne.designation, { gras: true }),
            cellule(ligne.unite),
            cellule(quantite(ligne.stockDebut)),
            cellule(ligne.livre ? formaterQuantite(ligne.livre) : neant),
            cellule(formaterQuantite(ligne.utilise)),
            cellule(quantite(fin), { gras: true, ton: enAlerte ? "erreur" : undefined }),
            cellule(quantite(ligne.seuilAlerte)),
            fin === null
              ? cellule(r("materiaux.horsStock"))
              : cellule(enAlerte ? r("materiaux.alerte") : r("materiaux.ok"), {
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
          cellule(
            livraison.quantite !== null
              ? livraison.unite
                ? r("quantiteUnite", {
                    quantite: formaterQuantite(livraison.quantite),
                    unite: livraison.unite,
                  })
                : formaterQuantite(livraison.quantite)
              : neant,
          ),
          cellule(livraison.bonLivraison || neant),
          cellule(livraison.heure || neant),
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

  if (rapport.besoins.length > 0) {
    numerotees.push({
      titre: r("sections.besoins"),
      blocs: [
        tableau(
          [
            r("besoins.nature"),
            r("besoins.designation"),
            r("besoins.quantite"),
            r("besoins.observation"),
          ],
          rapport.besoins.map((besoin) => [
            cellule(r(`besoins.natures.${besoin.nature}`), {
              gras: true,
              ton: besoin.nature === "RUPTURE" ? "erreur" : "avertissement",
            }),
            cellule(besoin.designation, { gras: true }),
            cellule(
              besoin.quantite !== null
                ? besoin.unite
                  ? r("quantiteUnite", {
                      quantite: formaterQuantite(besoin.quantite),
                      unite: besoin.unite,
                    })
                  : formaterQuantite(besoin.quantite)
                : neant,
            ),
            cellule(besoin.observation ?? neant),
          ]),
          neant,
        ),
      ],
    });
  }

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
          cellule(
            equipement.usage
              ? [equipement.designation, equipement.usage].join(separateurDetail)
              : equipement.designation,
            { gras: true },
          ),
          cellule(equipement.reference || neant),
          cellule(equipement.propriete ? t(`enumerations.propriete.${equipement.propriete}`) : neant),
          cellule(
            equipement.heuresUtilisation !== null
              ? r("heures", { valeur: formaterQuantite(equipement.heuresUtilisation) })
              : equipement.dureeArret !== null
                ? r("equipements.arretValeur", { valeur: formaterQuantite(equipement.dureeArret) })
                : neant,
          ),
          cellule(equipement.operateur || neant),
          equipement.etat
            ? cellule(t(`enumerations.etatEquipement.${equipement.etat}`), {
                gras: true,
                ton: TON_EQUIPEMENT[equipement.etat],
              })
            : cellule(neant),
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
          r("incidents.nature"),
          r("incidents.description"),
          r("incidents.gravite"),
          r("incidents.decidePar"),
          r("incidents.action"),
        ],
        rapport.listeIncidents.map((incident) => [
          cellule(incident.numero, { gras: true }),
          cellule(t(`enumerations.natureEvenement.${incident.nature}`)),
          cellule(incident.description),
          incident.gravite
            ? cellule(t(`enumerations.gravite.${incident.gravite}`), {
                gras: true,
                ton: TON_GRAVITE[incident.gravite],
              })
            : cellule(neant),
          cellule(incident.decidePar ? t(`enumerations.decideur.${incident.decidePar}`) : neant),
          cellule(incident.action || neant),
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
        rapport.listeBlocages.map((blocage) => {
          const parties = [blocage.titre, blocage.elementLibelle, blocage.description].filter(
            Boolean,
          );
          return [
            cellule(blocage.numero, { gras: true }),
            cellule(blocage.nature ? t(`enumerations.natureBlocage.${blocage.nature}`) : neant),
            cellule(parties.join(separateurDetail)),
            cellule(t(`enumerations.niveauBlocage.${blocage.niveau}`), {
              gras: true,
              ton: TON_BLOCAGE[blocage.niveau],
            }),
            cellule(blocage.impact || neant),
            cellule(blocage.escalade ? role(blocage.escalade) : neant),
          ];
        }),
        r("blocages.aucun"),
      ),
    ],
  });

  numerotees.push({
    titre: [r("sections.photos"), r("photos.nombre", { n: rapport.listePhotos.length })].join(
      separateurDetail,
    ),
    blocs: [
      {
        type: "liste",
        vide: neant,
        elements: rapport.listePhotos.map((photo, rang) => ({
          texte: r("pdf.photo", {
            titre: r("photos.titre", { rang: rang + 1, total: rapport.listePhotos.length }),
            legende: photo.elementLibelle
              ? [photo.elementLibelle, photo.legende].join(separateurDetail)
              : photo.legende,
            meta:
              photo.latitude === null || photo.longitude === null
                ? r("photos.metaSansPosition", { heure: photo.heure })
                : r("photos.meta", {
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
    titre: r("sections.documents"),
    blocs: [
      tableau(
        [r("documents.nom"), r("documents.type"), r("documents.taille")],
        rapport.documents.map((piece) => [
          cellule(piece.nom, { gras: true }),
          cellule(t(`enumerations.formatDocument.${formatDocument(piece.nom)}`)),
          cellule(r("documents.tailleValeur", { valeur: formaterQuantite(tailleKo(piece.taille)) })),
        ]),
        r("documents.vide"),
      ),
    ],
  });

  numerotees.push({
    titre: r("sections.previsions"),
    blocs: [
      tableau(
        [
          r("previsions.activite"),
          r("previsions.equipe"),
          r("previsions.objectif"),
          r("previsions.prerequis"),
        ],
        rapport.previsions.map((prevision) => [
          cellule(prevision.activite, { gras: true }),
          cellule(prevision.equipe || neant),
          cellule(prevision.objectif),
          cellule(prevision.prerequis || neant),
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
          nom: rapport.intervenants.redacteur,
          quand: rapport.soumisLe
            ? formaterDateHeure(rapport.soumisLe)
            : formaterDate(rapport.date),
        }),
        texte: rapport.noteRedacteur ?? r("note.vide"),
      },
    ],
  });

  const signatures: CasePdf[] = rapport.circuit.map((etape) => ({
    role: role(etape.role),
    mention: etape.signeLe
      ? r("pdf.signeLe", { quand: formaterDateHeure(etape.signeLe) })
      : r("pdf.signeLeVide"),
    nom: etape.signataire,
    accent: etape.etat === "SIGNE",
  }));
  numerotees.push({
    titre: r("sections.circuit"),
    blocs: [{ type: "signatures", cases: signatures }],
  });

  const sections: SectionPdf[] = [
    {
      titre: r("pdf.identification"),
      accent: true,
      blocs: [
        ...(rapport.arret
          ? [
              {
                type: "paragraphe" as const,
                texte: rapport.arret.precision
                  ? r("arretBandeauPrecision", {
                      motif: r(`motifsArret.${rapport.arret.motif}`),
                      precision: rapport.arret.precision,
                    })
                  : r("arretBandeau", { motif: r(`motifsArret.${rapport.arret.motif}`) }),
              },
            ]
          : []),
        {
          type: "cles",
          legeres: true,
          elements: [
            { libelle: r("projet"), valeur: chantier },
            { libelle: role("REDACTION"), valeur: rapport.intervenants.redacteur },
            { libelle: r("referenceProjet"), valeur: rapport.chantier.projetReference },
            { libelle: role("VALIDATION"), valeur: rapport.intervenants.validateurs },
            {
              libelle: r("lots"),
              valeur:
                rapport.lots.length === 0
                  ? r("lotsValeur", { n: 0 })
                  : rapport.lots
                      .map((lot) =>
                        r("lotMode", {
                          code: lot.code,
                          nom: lot.nom,
                          mode: modeExecution(lot),
                        }),
                      )
                      .join(r("pdf.separateurLots")),
            },
            { libelle: role("APPROBATION"), valeur: rapport.intervenants.approbateurs },
            { libelle: r("date"), valeur: jour },
            { libelle: r("numero"), valeur: reference },
            {
              libelle: r("horaires"),
              valeur:
                rapport.heureDebut && rapport.heureFin
                  ? r("horairesValeur", { debut: rapport.heureDebut, fin: rapport.heureFin })
                  : sansObjet,
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
          type: "cles",
          legeres: true,
          elements: [
            chiffre(
              r("chiffres.effectifs"),
              r("fraction", {
                a: rapport.effectifPresent ?? 0,
                b: rapport.effectifPrevu ?? 0,
              }),
              r("chiffres.presence", { taux: presence ?? 0 }),
              teintes.effectifs,
            ),
            chiffre(
              r("chiffres.heures"),
              totaux ? r("heures", { valeur: formaterQuantite(totaux.heures) }) : sansObjet,
              totaux ? r("chiffres.heuresDetail") : r("chiffres.heuresSousTraitant"),
              teintes.heures,
            ),
            chiffre(
              r("chiffres.activites"),
              r("fraction", { a: activitesActives(activites), b: activites.length }),
              r("chiffres.activitesDetail"),
              teintes.activites,
            ),
            chiffre(
              r("chiffres.photos"),
              String(rapport.listePhotos.length),
              r("chiffres.photosDetail"),
              teintes.photos,
            ),
            chiffre(
              r("chiffres.livraisons"),
              String(rapport.livraisons.length),
              r("chiffres.livraisonsDetail", { n: livraisonsPartielles }),
              teintes.livraisons,
            ),
            chiffre(
              r("chiffres.incidents"),
              String(rapport.listeIncidents.length),
              r("chiffres.incidentsDetail", { n: incidentsMajeurs }),
              teintes.incidents,
            ),
            chiffre(
              r("chiffres.blocages"),
              String(blocages),
              blocages ? r("chiffres.blocagesDetail") : r("chiffres.aucunBlocage"),
              teintes.blocages,
            ),
          ],
        },
      ],
    },
    ...numerotees.map((section, rang) => ({
      titre: `${rang + 1}. ${section.titre}`,
      blocs: section.blocs,
    })),
  ];

  const { emetteur, pied } = emetteurDocument(entreprise, marque);

  const document: DocumentPdf = {
    nomFichier: r("pdf.nomFichier", { reference: reference || rapport.id }),
    entete: {
      emetteur,
      logo,
      titre: r("titre"),
      sousTitre: r("pdf.dateGeneration", { date: formaterDateHeure(maintenant) }),
      reference,
    },
    objet: {
      titre: r("titrePage", { chantier, jour }),
      pastilles: [{ texte: r("lotsValeur", { n: rapport.lots.length }), ton: "neutre" }],
      indicateur: {
        libelle: r("chiffres.avancement"),
        valeur: pourcent(rapport.avancement ?? 0),
        detail:
          retard !== null && retard > 0 ? r("pdf.retard", { points: retard }) : r("pdf.alHeure"),
        ton: teintes.avancement,
      },
    },
    sections,
    pied: {
      gauche: pied,
      droite: (page, total) => r("pdf.page", { page, total }),
    },
  };

  return appliquerDocumentsAuPdf(document, documents);
}

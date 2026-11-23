import type { IndicateursJournalProjet } from "@/features/chantier";
import type { DonneesEntreprise } from "@/features/configuration/api";
import { appliquerDocumentsAuPdf } from "@/features/documents";
import type { DocumentsResolus } from "@/features/documents";
import {
  avancementLot,
  budgetEnVigueur,
  budgetRestant,
  ecartAvancement,
  echeancierProjet,
  effectifProjet,
  estEnRetard,
  financierDuProjet,
  libelleDelta,
  niveauBudget,
  niveauConformite,
  pointsDeVigilance,
  precisionChefChantier,
  prochainesEtapes,
  ratioConsommationBudget,
  statutLot,
  tauxRespectDelais,
} from "@/features/projets/regles";
import type { NiveauConformite, PointVigilance, StatutLot } from "@/features/projets/regles";
import type {
  Equipe,
  FonctionAutreMembre,
  Intervenant,
  Lot,
  NatureProjet,
  Projet,
} from "@/features/projets/types";
import { afficherTelephone } from "@/features/referentiels/telephone";
import {
  ABSENT,
  couleurIndiceSante,
  formaterDate,
  formaterDateHeure,
  formaterDuree,
  formaterMontant,
  formaterPourcentage,
} from "@/lib/format";
import type {
  BlocPdf,
  CellulePdf,
  CleValeurPdf,
  DocumentPdf,
  ImagePdf,
  PastillePdf,
  SectionPdf,
  TonPdf,
} from "@/lib/export/documentPdf";

import { BADGE_STATUT, TON_STATUT } from "../classes";

/** Le traducteur de `ficheProjet.pdf` (next-intl). */
type Traduire = (cle: string, valeurs?: Record<string, string | number>) => string;

export interface DonneesFiche {
  projet: Projet;
  lots: Lot[];
  /** `null` : la liste des équipes n'a pas pu être lue. */
  equipes: Equipe[] | null;
  /** `null` : le journal n'a pas pu être lu — les indicateurs le disent. */
  journal: IndicateursJournalProjet | null;
  entreprise: DonneesEntreprise | null;
  logo: ImagePdf | null;
  /** `null` : le réglage de l'en-tête et du pied n'a pas pu être lu — la fiche sort sans mentions. */
  documents: DocumentsResolus | null;
  /** La note libre du chef de projet ; vide, on replie sur `informationsComplementaires.note_cp`. */
  note: string;
  /** Le nom de la plateforme : l'émetteur à défaut d'entreprise connue. */
  marque: string;
  /** Les libellés d'énumération de l'écran (nature, type, statut, bordereau). */
  libelles: {
    natureProjet?: (nature: NatureProjet) => string;
    typeProjet: (type: NonNullable<Projet["typeProjet"]>) => string;
    statutProjet: (statut: Projet["statut"]) => string;
    typeBordereau: (type: Lot["typeBordereau"]) => string;
    statutActivite: (statut: Exclude<StatutLot, "SANS_ACTIVITE">) => string;
    fonctionAutreMembre: (fonction: FonctionAutreMembre) => string;
  };
  maintenant: Date;
}

const TON_SANTE_PDF: Record<ReturnType<typeof couleurIndiceSante>, TonPdf> = {
  vert: "succes",
  orange: "avertissement",
  rouge: "erreur",
  inconnu: "neutre",
};

const TON_CONFORMITE: Record<NiveauConformite, TonPdf> = {
  conforme: "succes",
  alerte: "avertissement",
  critique: "erreur",
};

function tonTaux(taux: number | null | undefined): TonPdf {
  const niveau = niveauConformite(taux ?? null);
  return niveau ? TON_CONFORMITE[niveau] : "neutre";
}

const TON_BUDGET: Record<NonNullable<ReturnType<typeof niveauBudget>>, TonPdf> = {
  conforme: "succes",
  alerte: "avertissement",
  depassement: "erreur",
};

/** Un montant en francs entiers, avec devise FCFA pour les lignes clé-valeur. */
function francs(centimes: number | null, avecDevise = false): string {
  return centimes === null ? ABSENT : formaterMontant(centimes, { avecDevise });
}

function ajouterSiRempli(
  cible: CleValeurPdf[],
  libelle: string,
  valeur: string | undefined | null,
  large = false,
) {
  if (valeur && valeur.trim().length > 0) {
    cible.push({ libelle, valeur: valeur.trim(), ...(large ? { large: true } : {}) });
  }
}

export function emetteurDocument(
  entreprise: DonneesEntreprise | null,
  marque: string,
): { emetteur: string; pied: string } {
  const emetteur = entreprise?.nom_commercial || entreprise?.raison_sociale || marque;
  const coordonnees = [
    entreprise?.adresse,
    entreprise?.ville,
    entreprise?.telephone_contact ? afficherTelephone(entreprise.telephone_contact) : null,
    entreprise?.email_contact,
  ]
    .filter(Boolean)
    .join(" · ");
  return { emetteur, pied: coordonnees ? `${emetteur} — ${coordonnees}` : emetteur };
}

export function contenuFicheProjet(t: Traduire, donnees: DonneesFiche): DocumentPdf {
  const {
    projet,
    lots,
    equipes,
    journal,
    entreprise,
    logo,
    documents,
    note,
    marque,
    libelles,
    maintenant,
  } = donnees;
  const infos = projet.informationsComplementaires ?? {};
  const estPublic = projet.natureProjet === "PUBLIC";
  const genereLe = formaterDateHeure(maintenant);
  const lieu = [projet.quartier, projet.ville].filter(Boolean).join(", ");
  const nomOuAbsent = (intervenant: Intervenant | null) =>
    intervenant ? intervenant.nomComplet || intervenant.email : t("equipe.nonDesigne");

  /* --- En-tête & Pastilles --- */

  const sante = couleurIndiceSante(projet.indiceSante);
  const libelleNature =
    projet.natureProjet && libelles.natureProjet
      ? libelles.natureProjet(projet.natureProjet)
      : null;

  const pastilles: PastillePdf[] = [
    ...(libelleNature
      ? [
          {
            texte: libelleNature,
            ton: (projet.natureProjet === "PUBLIC" ? "secondaire" : "primaire") as TonPdf,
          },
        ]
      : []),
    ...(projet.typeProjet
      ? [{ texte: libelles.typeProjet(projet.typeProjet), ton: "neutre" as const }]
      : []),
    ...(infos.phase ? [{ texte: infos.phase, ton: "neutre" as const }] : []),
    { texte: libelles.statutProjet(projet.statut), ton: TON_STATUT[projet.statut] },
  ];

  /* --- 1. Identification du projet --- */

  const contactClient =
    infos.contact?.trim() ||
    [
      projet.client.telephone ? afficherTelephone(projet.client.telephone) : null,
      projet.client.email,
    ]
      .filter(Boolean)
      .join(" · ");

  const clesIdentification: CleValeurPdf[] = [
    ...(libelleNature
      ? [{ libelle: t("identification.natureProjet"), valeur: libelleNature }]
      : []),
    { libelle: t("identification.reference"), valeur: projet.reference },
  ];
  ajouterSiRempli(clesIdentification, t("identification.numeroFiche"), infos.numero_fiche);
  clesIdentification.push({
    libelle: t("identification.type"),
    valeur: projet.typeProjet
      ? libelles.typeProjet(projet.typeProjet)
      : t("identification.nonRenseigne"),
  });
  ajouterSiRempli(clesIdentification, t("identification.secteur"), infos.secteur);
  ajouterSiRempli(clesIdentification, t("identification.phase"), infos.phase);
  clesIdentification.push(
    {
      libelle: estPublic ? t("identification.maitreOuvrage") : t("identification.client"),
      valeur: projet.client.raisonSociale,
    },
    { libelle: t("identification.contactClient"), valeur: contactClient || ABSENT },
    {
      libelle: t("identification.maitreOeuvre"),
      valeur: projet.maitreOeuvre ?? t("identification.nonRenseigne"),
    },
  );
  ajouterSiRempli(clesIdentification, t("identification.tutelle"), infos.tutelle);
  ajouterSiRempli(clesIdentification, t("identification.delegue"), infos.delegue);
  ajouterSiRempli(clesIdentification, t("identification.agence"), infos.agence);
  ajouterSiRempli(clesIdentification, t("identification.operateur"), infos.operateur);
  ajouterSiRempli(clesIdentification, t("identification.region"), infos.region);
  clesIdentification.push({ libelle: t("identification.localisation"), valeur: lieu || ABSENT });
  if (projet.ordreService) {
    clesIdentification.push({
      libelle: t("identification.ordreService"),
      valeur: projet.ordreService.nom,
    });
  }
  if (projet.contrats.length > 0) {
    clesIdentification.push({
      libelle: t("identification.contrats"),
      valeur: projet.contrats.map((c) => c.nom).join(", "),
    });
  }
  ajouterSiRempli(
    clesIdentification,
    t("identification.description"),
    projet.description,
    true,
  );
  ajouterSiRempli(clesIdentification, t("identification.interet"), infos.interet, true);

  const blocsIdentification: BlocPdf[] = [{ type: "cles", elements: clesIdentification }];
  if (infos.objectifs && infos.objectifs.length > 0) {
    blocsIdentification.push({
      type: "liste",
      vide: "",
      elements: infos.objectifs.map((obj) => ({
        texte: `${t("identification.objectifs")} : ${obj}`,
        ton: "neutre" as const,
      })),
    });
  }

  const identification: SectionPdf = {
    titre: t("sections.identification"),
    blocs: blocsIdentification,
  };

  /* --- 2. Programme et caractéristiques (affichée si renseignée) --- */

  const clesProgramme: CleValeurPdf[] = [];
  const suffixeUnite = infos.unite_capacite ? ` (${infos.unite_capacite.trim()})` : "";
  if (infos.capacite_projet?.trim()) {
    clesProgramme.push({
      libelle: t("programme.capaciteProjet"),
      valeur: `${infos.capacite_projet.trim()}${suffixeUnite}`,
    });
  }
  if (infos.capacite_terme?.trim()) {
    clesProgramme.push({
      libelle: t("programme.capaciteTerme"),
      valeur: `${infos.capacite_terme.trim()}${suffixeUnite}`,
    });
  }
  ajouterSiRempli(clesProgramme, t("programme.lits"), infos.lits);
  ajouterSiRempli(clesProgramme, t("programme.superficieHa"), infos.superficie_ha);
  ajouterSiRempli(clesProgramme, t("programme.terrainM2"), infos.terrain_m2);
  ajouterSiRempli(clesProgramme, t("programme.surfaceBatie"), infos.surface_batie);
  ajouterSiRempli(clesProgramme, t("programme.niveaux"), infos.niveaux);
  ajouterSiRempli(clesProgramme, t("programme.usage"), infos.usage);
  ajouterSiRempli(clesProgramme, t("programme.perimetre"), infos.perimetre, true);
  ajouterSiRempli(clesProgramme, t("programme.offreFormation"), infos.offre_formation, true);

  const blocsProgramme: BlocPdf[] = [];
  if (clesProgramme.length > 0) {
    blocsProgramme.push({ type: "cles", elements: clesProgramme });
  }
  if (infos.impacts && infos.impacts.length > 0) {
    blocsProgramme.push({
      type: "liste",
      vide: "",
      elements: infos.impacts.map((imp) => ({
        texte: `${t("programme.impacts")} : ${imp}`,
        ton: "succes" as const,
      })),
    });
  }
  const sectionProgramme: SectionPdf[] =
    blocsProgramme.length > 0
      ? [{ titre: t("sections.programme"), blocs: blocsProgramme }]
      : [];

  /* --- 3. Calendrier & budget (sans grosses cases : uniquement des lignes clé-valeur) --- */

  const echeancier = echeancierProjet(projet, maintenant);
  const budget = budgetEnVigueur(projet);
  const ratio = ratioConsommationBudget(budget, projet.budgetConsomme);
  const niveau = niveauBudget(ratio);
  const restant = budgetRestant(projet);
  const part = (centimes: number) =>
    budget && budget > 0
      ? t("budget.part", { valeur: Math.round((centimes / budget) * 100) })
      : null;

  const clesCalendrierBudget: CleValeurPdf[] = [];
  if (infos.date_situation) {
    clesCalendrierBudget.push({
      libelle: t("calendrier.dateSituation"),
      valeur: formaterDate(infos.date_situation),
    });
  }
  clesCalendrierBudget.push(
    { libelle: t("calendrier.debutPrevu"), valeur: formaterDate(projet.dateDebutPrevue) },
    { libelle: t("calendrier.finPrevue"), valeur: formaterDate(projet.dateFinPrevue) },
    { libelle: t("calendrier.duree"), valeur: formaterDuree(projet.duree ?? echeancier.duree) },
  );
  ajouterSiRempli(clesCalendrierBudget, t("calendrier.dureeContrat"), infos.duree_contrat);
  clesCalendrierBudget.push(
    {
      libelle: t("calendrier.debutReel"),
      valeur: projet.dateDebutReelle
        ? formaterDate(projet.dateDebutReelle)
        : t("calendrier.nonDemarre"),
    },
    {
      libelle: t("calendrier.delaiEcoule"),
      valeur:
        echeancier.tempsEcoule === null
          ? ABSENT
          : t("calendrier.delaiEcouleValeur", { valeur: echeancier.tempsEcoule }),
    },
    {
      libelle: t("calendrier.echeance"),
      valeur: libelleEcheance(t, projet, echeancier.joursRestants),
      ton:
        echeancier.joursRestants !== null && echeancier.joursRestants < 0
          ? "erreur"
          : undefined,
    },
  );
  ajouterSiRempli(
    clesCalendrierBudget,
    t("calendrier.reprogrammation"),
    infos.reprogrammation,
    true,
  );

  // Chiffres budgétaires en lignes clé-valeur sobres (pas de tuiles)
  clesCalendrierBudget.push({
    libelle: t("budget.initial"),
    valeur:
      projet.budgetInitial === null
        ? t("budget.nonDefini")
        : francs(projet.budgetInitial, true),
  });
  if (projet.budgetCourant !== null) {
    clesCalendrierBudget.push({
      libelle: t("budget.contractuel"),
      valeur: francs(projet.budgetCourant, true),
    });
  } else if (infos.budget_contractuel?.trim()) {
    clesCalendrierBudget.push({
      libelle: t("budget.contractuel"),
      valeur: infos.budget_contractuel.trim(),
    });
  }
  if (infos.cout?.trim()) {
    const dev = infos.devise || "FCFA";
    clesCalendrierBudget.push({
      libelle: t("budget.coutDeclare"),
      valeur: `${infos.cout.trim()} ${dev}`,
    });
    if (dev !== "FCFA" && infos.taux_change?.trim()) {
      clesCalendrierBudget.push({
        libelle: t("budget.tauxChange", { devise: dev }),
        valeur: `${infos.taux_change.trim()} FCFA`,
      });
    }
  }
  ajouterSiRempli(clesCalendrierBudget, t("budget.regime"), infos.regime);

  const partConsomme = part(projet.budgetConsomme);
  clesCalendrierBudget.push({
    libelle: t("budget.consomme"),
    valeur: partConsomme
      ? `${francs(projet.budgetConsomme, true)} (${partConsomme})`
      : francs(projet.budgetConsomme, true),
    ton: niveau ? TON_BUDGET[niveau] : undefined,
  });

  const partRestant = restant !== null ? part(Math.abs(restant)) : null;
  const valeurRestant =
    restant === null
      ? ABSENT
      : partRestant
        ? `${francs(Math.abs(restant), true)} (${partRestant})`
        : francs(Math.abs(restant), true);
  clesCalendrierBudget.push({
    libelle: restant !== null && restant < 0 ? t("budget.depasse") : t("budget.restant"),
    valeur: valeurRestant,
    ton: restant !== null && restant < 0 ? "erreur" : undefined,
  });

  const calendrierBudget: SectionPdf = {
    titre: t("sections.calendrierBudget"),
    blocs: [{ type: "cles", elements: clesCalendrierBudget }],
  };

  /* --- 4. Financement (affichée si renseignée) --- */

  const clesFinancement: CleValeurPdf[] = [];
  ajouterSiRempli(clesFinancement, t("financement.modeFin"), infos.mode_fin);
  ajouterSiRempli(clesFinancement, t("financement.sourceFin"), infos.source_fin);
  ajouterSiRempli(clesFinancement, t("financement.statutFin"), infos.statut_fin);
  ajouterSiRempli(clesFinancement, t("financement.etablissement"), infos.etablissement);
  ajouterSiRempli(
    clesFinancement,
    t("financement.contractualisation"),
    infos.contractualisation,
  );
  ajouterSiRempli(clesFinancement, t("financement.etatImputation"), infos.etat_imputation);
  ajouterSiRempli(clesFinancement, t("financement.etatEffectif"), infos.etat_effectif);
  ajouterSiRempli(clesFinancement, t("financement.etatDecaissement"), infos.etat_decaissement);
  ajouterSiRempli(clesFinancement, t("financement.procedure"), infos.procedure);
  ajouterSiRempli(clesFinancement, t("financement.texteApplicable"), infos.texte_applicable, true);
  ajouterSiRempli(clesFinancement, t("financement.historique"), infos.historique, true);

  const blocsFinancement: BlocPdf[] = [];
  if (clesFinancement.length > 0) {
    blocsFinancement.push({ type: "cles", elements: clesFinancement });
  }
  if (infos.bailleurs && infos.bailleurs.length > 0) {
    blocsFinancement.push({
      type: "tableau",
      vide: t("financement.bailleurs.vide"),
      tableau: {
        entetes: [
          t("financement.bailleurs.org"),
          t("financement.bailleurs.type"),
          t("financement.bailleurs.signature"),
          t("financement.bailleurs.limite"),
          t("financement.bailleurs.effectif"),
          t("financement.bailleurs.decaisse"),
        ],
        largeurs: [0.24, 0.16, 0.14, 0.14, 0.16, 0.16],
        lignes: infos.bailleurs.map((b) => [
          { texte: b.org || ABSENT, gras: true },
          { texte: b.type || ABSENT },
          { texte: b.signature ? formaterDate(b.signature) : ABSENT },
          { texte: b.limite ? formaterDate(b.limite) : ABSENT },
          { texte: b.effectif || ABSENT },
          { texte: b.decaisse || ABSENT },
        ]),
      },
    });
  }
  const sectionFinancement: SectionPdf[] =
    blocsFinancement.length > 0
      ? [{ titre: t("sections.financement"), blocs: blocsFinancement }]
      : [];

  /* --- 5. Foncier, autorisations et études (affichée si renseignée) --- */

  const clesFoncier: CleValeurPdf[] = [];
  ajouterSiRempli(clesFoncier, t("foncierEtudes.disponibilite"), infos.disponibilite);
  ajouterSiRempli(clesFoncier, t("foncierEtudes.delimitation"), infos.delimitation);
  ajouterSiRempli(clesFoncier, t("foncierEtudes.titreFoncier"), infos.titre_foncier);
  ajouterSiRempli(clesFoncier, t("foncierEtudes.permisStatut"), infos.permis_statut);
  ajouterSiRempli(clesFoncier, t("foncierEtudes.permisNum"), infos.permis_num);
  ajouterSiRempli(clesFoncier, t("foncierEtudes.purgeTotal"), infos.purge_total);
  ajouterSiRempli(clesFoncier, t("foncierEtudes.purgeEngage"), infos.purge_engage);
  ajouterSiRempli(clesFoncier, t("foncierEtudes.purgePaye"), infos.purge_paye);

  const blocsFoncier: BlocPdf[] = [];
  if (clesFoncier.length > 0) {
    blocsFoncier.push({ type: "cles", elements: clesFoncier });
  }
  if (infos.etudes && infos.etudes.length > 0) {
    blocsFoncier.push({
      type: "tableau",
      vide: t("foncierEtudes.etudes.vide"),
      tableau: {
        entetes: [
          t("foncierEtudes.etudes.nom"),
          t("foncierEtudes.etudes.statut"),
          t("foncierEtudes.etudes.avancement"),
          t("foncierEtudes.etudes.prestataire"),
          t("foncierEtudes.etudes.montant"),
        ],
        largeurs: [0.3, 0.16, 0.14, 0.24, 0.16],
        lignes: infos.etudes.map((et) => [
          { texte: et.nom || ABSENT, gras: true },
          { texte: et.statut || ABSENT },
          { texte: et.avancement ? `${et.avancement} %` : ABSENT },
          { texte: et.prestataire || ABSENT },
          { texte: et.montant || ABSENT },
        ]),
      },
    });
  }
  const sectionFoncierEtudes: SectionPdf[] =
    blocsFoncier.length > 0
      ? [{ titre: t("sections.foncierEtudes"), blocs: blocsFoncier }]
      : [];

  /* --- 6. Avancement global --- */

  const ecart = ecartAvancement(projet.avancementReel, projet.avancementTheorique);
  const retard = estEnRetard(ecart);
  const ecartTexte = new Intl.NumberFormat("fr-FR", {
    signDisplay: "exceptZero",
    maximumFractionDigits: 1,
  }).format(ecart);

  const lignesLots: CellulePdf[][] =
    infos.lots && infos.lots.length > 0
      ? infos.lots.map((lot) => [
          { texte: lot.code || ABSENT, gras: true },
          { texte: lot.nom || ABSENT, gras: true },
          { texte: lot.prestataire || ABSENT },
          { texte: ABSENT },
          { texte: lot.avancement ? `${lot.avancement} %` : ABSENT, gras: true },
          { texte: lot.montant || ABSENT },
          { texte: lot.statut || ABSENT, gras: true },
        ])
      : lots.map((lot) => {
          const statut = statutLot(lot, maintenant);
          const avancement = lot.avancement ?? avancementLot(lot);
          const ton: TonPdf = statut === "SANS_ACTIVITE" ? "neutre" : BADGE_STATUT[statut];
          return [
            { texte: lot.code, gras: true },
            { texte: lot.nom, gras: true },
            { texte: lot.modeExecutionLibelle },
            { texte: libelles.typeBordereau(lot.typeBordereau) },
            avancement === null
              ? { texte: ABSENT, ton: "neutre" }
              : { texte: formaterPourcentage(avancement), gras: true, ton },
            { texte: francs(lot.budget) },
            {
              texte:
                statut === "SANS_ACTIVITE"
                  ? t("lots.sansActivite")
                  : libelles.statutActivite(statut),
              gras: true,
              ton,
            },
          ];
        });

  const deltaInfo = libelleDelta(projet.deltaRetard);
  const texteEcart = [
    t("avancement.ecart", { valeur: ecartTexte }),
    deltaInfo ? t(deltaInfo.cle, deltaInfo.params) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const clesAvancementExtra: CleValeurPdf[] = [];
  if (infos.taux_saisi?.trim()) {
    clesAvancementExtra.push({
      libelle: t("avancement.tauxDeclare"),
      valeur: `${infos.taux_saisi.trim()} %`,
    });
  }
  ajouterSiRempli(clesAvancementExtra, t("avancement.etatNarratif"), infos.etat_narratif, true);

  const avancement: SectionPdf = {
    titre: t("sections.avancement"),
    blocs: [
      {
        type: "jauges",
        jauges: [
          {
            libelle: t("avancement.reel"),
            valeur: projet.avancementReel,
            texte: formaterPourcentage(projet.avancementReel),
            ton: retard ? "avertissement" : "succes",
          },
          {
            libelle: t("avancement.theorique"),
            valeur: projet.avancementTheorique,
            texte: formaterPourcentage(projet.avancementTheorique),
            ton: "secondaire",
          },
        ],
      },
      { type: "paragraphe", texte: texteEcart },
      ...(clesAvancementExtra.length > 0
        ? [{ type: "cles" as const, elements: clesAvancementExtra }]
        : []),
      {
        type: "tableau",
        vide: t("lots.vide"),
        tableau: {
          entetes: [
            t("lots.numero"),
            t("lots.lot"),
            t("lots.mode"),
            t("lots.bordereau"),
            t("lots.avancement"),
            t("lots.budget"),
            t("lots.statut"),
          ],
          largeurs: [0.08, 0.24, 0.16, 0.11, 0.14, 0.14, 0.13],
          lignes: lignesLots,
        },
      },
    ],
  };

  /* --- 7. Indicateurs clés (sans grosses cases : lignes clé-valeur sobres) --- */

  const respect = tauxRespectDelais(lots, maintenant);
  const detailSoumission = journal
    ? t("indicateurs.soumissionDetail", {
        deposes: journal.soumission.deposes,
        attendus: journal.soumission.attendus,
      })
    : t("indicateurs.journalIndisponible");
  const detailIncidents = journal
    ? t("indicateurs.incidentsDetail", { blocages: journal.blocages })
    : t("indicateurs.journalIndisponible");
  const detailEcart = t("indicateurs.ecartDetail", {
    reel: formaterPourcentage(projet.avancementReel),
    theorique: formaterPourcentage(projet.avancementTheorique),
  });

  const indicateurs: SectionPdf = {
    titre: t("sections.indicateurs"),
    blocs: [
      {
        type: "cles",
        elements: [
          {
            libelle: t("indicateurs.respectDelais"),
            valeur:
              respect === null
                ? ABSENT
                : `${formaterPourcentage(respect)} (${t("indicateurs.respectDelaisDetail")})`,
            ton: tonTaux(respect),
          },
          {
            libelle: t("indicateurs.soumission"),
            valeur: `${formaterPourcentage(journal?.soumission.taux)} (${detailSoumission})`,
            ton: tonTaux(journal?.soumission.taux),
          },
          {
            libelle: t("indicateurs.incidents"),
            valeur: journal ? `${journal.incidents} (${detailIncidents})` : ABSENT,
            ton: !journal
              ? "neutre"
              : journal.incidents > 0 || journal.blocages > 0
                ? "avertissement"
                : "succes",
          },
          {
            libelle: t("indicateurs.ecart"),
            valeur: `${t("indicateurs.points", { valeur: ecartTexte })} (${detailEcart})`,
            ton: retard ? "erreur" : "succes",
          },
        ],
      },
    ],
  };

  /* --- 8. Risques, blocages et recommandations --- */

  const points = pointsDeVigilance(projet, lots, maintenant).map((point) =>
    pointVigilance(t, point),
  );
  if (journal && journal.blocages > 0) {
    points.push({
      texte: t("vigilance.BLOCAGES", { nombre: journal.blocages }),
      ton: "avertissement",
    });
  }

  const blocsRisques: BlocPdf[] = [{ type: "liste", elements: points, vide: t("vigilance.vide") }];
  if (infos.difficultes && infos.difficultes.length > 0) {
    blocsRisques.push({
      type: "tableau",
      vide: "",
      tableau: {
        entetes: [
          t("vigilance.difficultes.desc"),
          t("vigilance.difficultes.gravite"),
          t("vigilance.difficultes.date"),
          t("vigilance.difficultes.statut"),
        ],
        largeurs: [0.46, 0.2, 0.16, 0.18],
        lignes: infos.difficultes.map((d) => [
          { texte: d.desc || ABSENT, gras: true },
          { texte: d.gravite || ABSENT, ton: "avertissement" },
          { texte: d.date ? formaterDate(d.date) : ABSENT },
          { texte: d.statut || ABSENT },
        ]),
      },
    });
  }
  if (infos.recos && infos.recos.length > 0) {
    blocsRisques.push({
      type: "tableau",
      vide: "",
      tableau: {
        entetes: [
          t("vigilance.recos.texte"),
          t("vigilance.recos.dest"),
          t("vigilance.recos.echeance"),
        ],
        largeurs: [0.54, 0.28, 0.18],
        lignes: infos.recos.map((r) => [
          { texte: r.texte || ABSENT, gras: true },
          { texte: r.dest || ABSENT },
          { texte: r.echeance ? formaterDate(r.echeance) : ABSENT },
        ]),
      },
    });
  }

  const risques: SectionPdf = {
    titre: t("sections.risques"),
    blocs: blocsRisques,
  };

  /* --- 9. Équipe d'encadrement et intervenants --- */

  const membres: { role: string; nom: string; tel: string; email: string; designe: boolean }[] = [];
  if (infos.coordonnateur?.nom?.trim()) {
    membres.push({
      role: t("equipe.coordonnateur"),
      nom: infos.coordonnateur.nom.trim(),
      tel: infos.coordonnateur.tel?.trim() || ABSENT,
      email: infos.coordonnateur.email?.trim() || ABSENT,
      designe: true,
    });
  }
  const ajouterIntervenantInterne = (role: string, intervenant: Intervenant | null) => {
    membres.push({
      role,
      nom: intervenant ? nomOuAbsent(intervenant) : t("equipe.nonDesigne"),
      tel: intervenant?.telephone ? afficherTelephone(intervenant.telephone) : ABSENT,
      email: intervenant?.email || ABSENT,
      designe: Boolean(intervenant),
    });
  };
  ajouterIntervenantInterne(t("equipe.chefProjet"), projet.chefProjet);
  if (projet.conducteursTravaux.length > 0) {
    for (const ct of projet.conducteursTravaux) {
      ajouterIntervenantInterne(t("equipe.conducteurTravaux"), ct);
    }
  } else {
    ajouterIntervenantInterne(t("equipe.conducteurTravaux"), null);
  }
  for (const chef of projet.chefsChantier) {
    const precision = precisionChefChantier(chef);
    ajouterIntervenantInterne(
      precision ? t("equipe.chefChantierZone", { zone: precision }) : t("equipe.chefChantier"),
      chef.intervenant,
    );
  }
  for (const membre of projet.autresMembres) {
    ajouterIntervenantInterne(
      libelles.fonctionAutreMembre(membre.fonction),
      membre.intervenant,
    );
  }

  const blocsEquipe: BlocPdf[] = [
    {
      type: "tableau",
      vide: "",
      tableau: {
        entetes: [t("equipe.role"), t("equipe.nom"), t("equipe.telephone"), t("equipe.email")],
        largeurs: [0.22, 0.26, 0.2, 0.32],
        lignes: membres.map((m) => [
          { texte: m.role, gras: true },
          m.designe ? { texte: m.nom } : { texte: m.nom, ton: "neutre" },
          { texte: m.tel },
          { texte: m.email },
        ]),
      },
    },
  ];
  if (infos.intervenants && infos.intervenants.length > 0) {
    blocsEquipe.push({
      type: "tableau",
      vide: "",
      tableau: {
        entetes: [
          t("equipe.intervenants.role"),
          t("equipe.intervenants.org"),
          t("equipe.intervenants.lot"),
        ],
        largeurs: [0.3, 0.4, 0.3],
        lignes: infos.intervenants.map((intv) => [
          { texte: intv.role || ABSENT, gras: true },
          { texte: intv.org || ABSENT },
          { texte: intv.lot || ABSENT },
        ]),
      },
    });
  }
  if (equipes) {
    blocsEquipe.push({
      type: "paragraphe",
      texte: t("equipe.equipesChantier", {
        equipes: equipes.length,
        personnes: effectifProjet(equipes),
      }),
    });
  }

  const equipe: SectionPdf = {
    titre: t("sections.equipe"),
    blocs: blocsEquipe,
  };

  /* --- 10. Prochaines étapes --- */

  const lignesEtapesSaisies: CellulePdf[][] = (infos.etapes ?? []).map((et, idx) => [
    { texte: `E-${String(idx + 1).padStart(2, "0")}`, gras: true },
    { texte: et.etape || ABSENT },
    { texte: ABSENT },
    { texte: ABSENT },
    { texte: et.echeance ? formaterDate(et.echeance) : ABSENT },
    { texte: et.resp || ABSENT },
  ]);
  const lignesEtapesArbre: CellulePdf[][] = prochainesEtapes(lots, maintenant).map(
    ({ activite, lot }) => [
      { texte: activite.code, gras: true },
      { texte: activite.libelle },
      { texte: `${lot.code} ${lot.nom}` },
      { texte: formaterDate(activite.dateDebutPrevue) },
      { texte: formaterDate(activite.dateFinPrevue) },
      activite.equipe
        ? { texte: activite.equipe.nom }
        : { texte: t("etapes.aAffecter"), ton: "avertissement" },
    ],
  );

  const etapes: SectionPdf = {
    titre: t("sections.prochainesEtapes"),
    blocs: [
      {
        type: "tableau",
        vide: t("etapes.vide"),
        tableau: {
          entetes: [
            t("etapes.code"),
            t("etapes.activite"),
            t("etapes.lot"),
            t("etapes.debut"),
            t("etapes.fin"),
            t("etapes.equipe"),
          ],
          largeurs: [0.08, 0.34, 0.2, 0.11, 0.11, 0.16],
          lignes: [...lignesEtapesSaisies, ...lignesEtapesArbre],
        },
      },
    ],
  };

  /* --- 11. Note du chef de projet : absente si vide (F1 §9.4) --- */

  const texteNote = (note || infos.note_cp || "").trim();
  const sectionNote: SectionPdf[] = texteNote
    ? [
        {
          titre: t("sections.note"),
          accent: true,
          blocs: [
            {
              type: "encadre",
              auteur: projet.chefProjet
                ? t("note.auteur", {
                    nom: nomOuAbsent(projet.chefProjet),
                    date: formaterDate(maintenant),
                  })
                : t("note.auteurSansNom", { date: formaterDate(maintenant) }),
              texte: texteNote,
            },
          ],
        },
      ]
    : [];

  /* --- Signatures (gardées en cases, comme demandé) --- */

  const signatures: SectionPdf = {
    titre: t("sections.signatures"),
    blocs: [
      {
        type: "signatures",
        cases: [
          {
            role: t("signatures.chefProjet"),
            mention: t("signatures.signature"),
            nom: projet.chefProjet ? nomOuAbsent(projet.chefProjet) : ABSENT,
          },
          {
            role: t("signatures.directeurGeneral"),
            mention: t("signatures.signature"),
            nom: ABSENT,
          },
          {
            role: t("signatures.directeurFinancier"),
            mention: t("signatures.signature"),
            nom: financierDuProjet(projet) ? nomOuAbsent(financierDuProjet(projet)) : ABSENT,
          },
        ],
      },
    ],
  };

  /* --- Le document --- */

  const { emetteur, pied } = emetteurDocument(entreprise, marque);

  const document: DocumentPdf = {
    nomFichier: t("nomFichier", {
      reference: projet.reference,
      date: maintenant.toISOString().slice(0, 10),
    }),
    entete: {
      emetteur,
      logo,
      titre: t("titre"),
      sousTitre: t("dateGeneration", { date: genereLe }),
      reference: projet.reference,
    },
    objet: {
      titre: projet.nom,
      pastilles,
      indicateur: {
        libelle: t("sante"),
        valeur:
          projet.indiceSante === null ? ABSENT : t("santeValeur", { valeur: projet.indiceSante }),
        detail: t(`santeNiveau.${sante}`),
        ton: TON_SANTE_PDF[sante],
      },
    },
    sections: [
      identification,
      ...sectionProgramme,
      calendrierBudget,
      ...sectionFinancement,
      ...sectionFoncierEtudes,
      avancement,
      indicateurs,
      risques,
      equipe,
      etapes,
      ...sectionNote,
      signatures,
    ],
    pied: {
      gauche: pied,
      droite: (page, total) => t("pied.page", { page, total }),
    },
  };

  return appliquerDocumentsAuPdf(document, documents);
}

function libelleEcheance(t: Traduire, projet: Projet, joursRestants: number | null): string {
  if (projet.dateFinReelle) {
    return t("calendrier.termineLe", { date: formaterDate(projet.dateFinReelle) });
  }
  if (joursRestants === null) return t("calendrier.clos");
  if (joursRestants < 0)
    return t("calendrier.echeanceDepassee", { jours: Math.abs(joursRestants) });
  return t("calendrier.joursRestants", { jours: joursRestants });
}

function pointVigilance(t: Traduire, point: PointVigilance): PastillePdf {
  switch (point.code) {
    case "ECHEANCE_DEPASSEE":
      return { texte: t("vigilance.ECHEANCE_DEPASSEE", { jours: point.jours }), ton: "erreur" };
    case "RETARD_AVANCEMENT":
      return {
        texte: t("vigilance.RETARD_AVANCEMENT", { ecart: Math.abs(point.ecart) }),
        ton: "avertissement",
      };
    case "BUDGET":
      return {
        texte: t(`vigilance.BUDGET_${point.niveau}`, { ratio: point.ratio }),
        ton: point.niveau === "depassement" ? "erreur" : "avertissement",
      };
    case "LOT_EN_RETARD":
      return {
        texte: t("vigilance.LOT_EN_RETARD", { code: point.lot.code, nom: point.lot.nom }),
        ton: "erreur",
        niveau: 0,
      };
    case "ACTIVITE_EN_RETARD":
      return {
        texte: t("vigilance.ACTIVITE_EN_RETARD", {
          code: point.activite.code,
          libelle: point.activite.libelle,
          reel: formaterPourcentage(point.activite.avancement),
          theorique: formaterPourcentage(point.theorique),
          fin: formaterDate(point.activite.dateFinPrevue),
        }),
        ton: "avertissement",
        niveau: 1,
      };
  }
}

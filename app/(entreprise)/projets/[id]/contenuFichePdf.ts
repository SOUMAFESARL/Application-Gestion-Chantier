import type { IndicateursJournalProjet } from "@/features/chantier";
import type { DonneesEntreprise } from "@/features/configuration/api";
import {
  avancementLot,
  budgetLot,
  budgetRestant,
  ecartAvancement,
  echeancierProjet,
  effectifProjet,
  estEnRetard,
  niveauBudget,
  niveauConformite,
  pointsDeVigilance,
  prochainesEtapes,
  ratioConsommationBudget,
  statutLot,
  tauxRespectDelais,
} from "@/features/projets/regles";
import type { NiveauConformite, PointVigilance, StatutLot } from "@/features/projets/regles";
import type { Equipe, Intervenant, Lot, Projet } from "@/features/projets/types";
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
  CellulePdf,
  DocumentPdf,
  ImagePdf,
  PastillePdf,
  SectionPdf,
  TonPdf,
} from "@/lib/export/documentPdf";

import { TON_STATUT } from "../classes";
import { BADGE_STATUT } from "../lots-activites/classes";

/**
 * Le contenu de la fiche projet générée — F1 §9.4, ses huit sections dans
 * l'ordre de la spécification, puis les signatures de la maquette validée.
 *
 * Ce module ne dessine rien et ne calcule rien : il **traduit**. Les chiffres
 * viennent de `features/projets/regles` (les mêmes que l'écran, pour que la
 * fiche ne qualifie pas un chantier autrement que lui) ; la mise en page,
 * de `lib/export/documentPdf`.
 */

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
  /** La note libre du chef de projet ; vide, la section 8 n'apparaît pas. */
  note: string;
  /** Le nom de la plateforme : l'émetteur à défaut d'entreprise connue. */
  marque: string;
  /** Les libellés d'énumération de l'écran (type, statut, mode, bordereau). */
  libelles: {
    typeProjet: (type: NonNullable<Projet["typeProjet"]>) => string;
    statutProjet: (statut: Projet["statut"]) => string;
    modeExecution: (mode: Lot["modeExecution"]) => string;
    typeBordereau: (type: Lot["typeBordereau"]) => string;
    statutActivite: (statut: Exclude<StatutLot, "SANS_ACTIVITE">) => string;
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

/** Un taux sans valeur reste neutre : l'absence de mesure n'est ni bonne ni mauvaise. */
function tonTaux(taux: number | null | undefined): TonPdf {
  const niveau = niveauConformite(taux ?? null);
  return niveau ? TON_CONFORMITE[niveau] : "neutre";
}

const TON_BUDGET: Record<NonNullable<ReturnType<typeof niveauBudget>>, TonPdf> = {
  conforme: "succes",
  alerte: "avertissement",
  depassement: "erreur",
};

/** Un montant en francs entiers, sans devise : l'en-tête de colonne la porte. */
function francs(centimes: number | null): string {
  return centimes === null ? ABSENT : formaterMontant(centimes, { avecDevise: false });
}

/**
 * L'entreprise émettrice d'un document généré : son nom dans l'en-tête (la
 * plateforme à défaut), et la ligne de pied qui la présente avec ses
 * coordonnées. Partagé avec le rapport journalier, pour que tous les
 * documents d'une entreprise se signent de la même façon.
 */
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
  const { projet, lots, equipes, journal, entreprise, logo, note, marque, libelles, maintenant } =
    donnees;
  const genereLe = formaterDateHeure(maintenant);
  const lieu = [projet.quartier, projet.ville].filter(Boolean).join(", ");
  const nomOuAbsent = (intervenant: Intervenant | null) =>
    intervenant ? intervenant.nomComplet || intervenant.email : t("equipe.nonDesigne");

  /* --- En-tête --- */

  const sante = couleurIndiceSante(projet.indiceSante);
  const pastilles: PastillePdf[] = [
    ...(projet.typeProjet ? [{ texte: libelles.typeProjet(projet.typeProjet), ton: "neutre" as const }] : []),
    { texte: libelles.statutProjet(projet.statut), ton: TON_STATUT[projet.statut] },
  ];

  /* --- 1. Identification --- */

  const contactClient = [
    projet.client.telephone ? afficherTelephone(projet.client.telephone) : null,
    projet.client.email,
  ]
    .filter(Boolean)
    .join(" · ");

  const identification: SectionPdf = {
    titre: t("sections.identification"),
    blocs: [
      {
        type: "cles",
        elements: [
          { libelle: t("identification.client"), valeur: projet.client.raisonSociale },
          { libelle: t("identification.reference"), valeur: projet.reference },
          { libelle: t("identification.contactClient"), valeur: contactClient || ABSENT },
          {
            libelle: t("identification.type"),
            valeur: projet.typeProjet
              ? libelles.typeProjet(projet.typeProjet)
              : t("identification.nonRenseigne"),
          },
          {
            libelle: t("identification.maitreOeuvre"),
            valeur: projet.maitreOeuvre ?? t("identification.nonRenseigne"),
          },
          { libelle: t("identification.localisation"), valeur: lieu || ABSENT },
          ...(projet.description
            ? [{ libelle: t("identification.description"), valeur: projet.description, large: true }]
            : []),
        ],
      },
    ],
  };

  /* --- 2. Calendrier & budget --- */

  const echeancier = echeancierProjet(projet, maintenant);
  const ratio = ratioConsommationBudget(projet.budgetInitial, projet.budgetConsomme);
  const niveau = niveauBudget(ratio);
  const restant = budgetRestant(projet);
  const part = (centimes: number) =>
    projet.budgetInitial && projet.budgetInitial > 0
      ? t("budget.part", { valeur: Math.round((centimes / projet.budgetInitial) * 100) })
      : undefined;

  const calendrierBudget: SectionPdf = {
    titre: t("sections.calendrierBudget"),
    blocs: [
      {
        type: "cles",
        elements: [
          { libelle: t("calendrier.debutPrevu"), valeur: formaterDate(projet.dateDebutPrevue) },
          { libelle: t("calendrier.finPrevue"), valeur: formaterDate(projet.dateFinPrevue) },
          { libelle: t("calendrier.duree"), valeur: formaterDuree(echeancier.dureeJours) },
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
            ton: echeancier.joursRestants !== null && echeancier.joursRestants < 0 ? "erreur" : undefined,
          },
        ],
      },
      {
        type: "tuiles",
        tuiles: [
          {
            libelle: t("budget.initial"),
            valeur:
              projet.budgetInitial === null ? t("budget.nonDefini") : francs(projet.budgetInitial),
            detail: projet.budgetInitial === null ? undefined : "FCFA",
            ton: "secondaire",
          },
          {
            libelle: t("budget.consomme"),
            valeur: francs(projet.budgetConsomme),
            detail: part(projet.budgetConsomme),
            ton: niveau ? TON_BUDGET[niveau] : "neutre",
          },
          {
            libelle: restant !== null && restant < 0 ? t("budget.depasse") : t("budget.restant"),
            valeur: restant === null ? ABSENT : francs(Math.abs(restant)),
            detail: restant === null ? undefined : part(Math.abs(restant)),
            ton: restant !== null && restant < 0 ? "erreur" : "primaire",
          },
        ],
      },
    ],
  };

  /* --- 3. Avancement global --- */

  const ecart = ecartAvancement(projet.avancementReel, projet.avancementTheorique);
  const retard = estEnRetard(ecart);
  const ecartTexte = new Intl.NumberFormat("fr-FR", {
    signDisplay: "exceptZero",
    maximumFractionDigits: 1,
  }).format(ecart);

  const lignesLots: CellulePdf[][] = lots.map((lot) => {
    const statut = statutLot(lot, maintenant);
    const avancement = avancementLot(lot);
    const ton: TonPdf = statut === "SANS_ACTIVITE" ? "neutre" : BADGE_STATUT[statut];
    return [
      { texte: lot.code, gras: true },
      { texte: lot.nom, gras: true },
      { texte: libelles.modeExecution(lot.modeExecution) },
      { texte: libelles.typeBordereau(lot.typeBordereau) },
      avancement === null
        ? { texte: ABSENT, ton: "neutre" }
        : { texte: formaterPourcentage(avancement), gras: true, ton },
      { texte: francs(budgetLot(lot)) },
      {
        texte:
          statut === "SANS_ACTIVITE" ? t("lots.sansActivite") : libelles.statutActivite(statut),
        gras: true,
        ton,
      },
    ];
  });

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
      { type: "paragraphe", texte: t("avancement.ecart", { valeur: ecartTexte }) },
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
          largeurs: [0.06, 0.24, 0.15, 0.12, 0.16, 0.14, 0.13],
          lignes: lignesLots,
        },
      },
    ],
  };

  /* --- 4. Indicateurs clés --- */

  const respect = tauxRespectDelais(lots, maintenant);
  const indicateurs: SectionPdf = {
    titre: t("sections.indicateurs"),
    blocs: [
      {
        type: "tuiles",
        tuiles: [
          {
            libelle: t("indicateurs.respectDelais"),
            valeur: respect === null ? ABSENT : formaterPourcentage(respect),
            detail: t("indicateurs.respectDelaisDetail"),
            ton: tonTaux(respect),
          },
          {
            libelle: t("indicateurs.soumission"),
            valeur: formaterPourcentage(journal?.soumission.taux),
            detail: journal
              ? t("indicateurs.soumissionDetail", {
                  deposes: journal.soumission.deposes,
                  attendus: journal.soumission.attendus,
                })
              : t("indicateurs.journalIndisponible"),
            ton: tonTaux(journal?.soumission.taux),
          },
          {
            libelle: t("indicateurs.incidents"),
            valeur: journal ? String(journal.incidents) : ABSENT,
            detail: journal
              ? t("indicateurs.incidentsDetail", { blocages: journal.blocages })
              : t("indicateurs.journalIndisponible"),
            ton: !journal ? "neutre" : journal.incidents > 0 || journal.blocages > 0 ? "avertissement" : "succes",
          },
          {
            libelle: t("indicateurs.ecart"),
            valeur: t("indicateurs.points", { valeur: ecartTexte }),
            detail: t("indicateurs.ecartDetail", {
              reel: formaterPourcentage(projet.avancementReel),
              theorique: formaterPourcentage(projet.avancementTheorique),
            }),
            ton: retard ? "erreur" : "succes",
          },
        ],
      },
    ],
  };

  /* --- 5. Risques et vigilance --- */

  const points = pointsDeVigilance(projet, lots, maintenant).map((point) =>
    pointVigilance(t, point),
  );
  if (journal && journal.blocages > 0) {
    points.push({ texte: t("vigilance.BLOCAGES", { nombre: journal.blocages }), ton: "avertissement" });
  }
  const risques: SectionPdf = {
    titre: t("sections.risques"),
    blocs: [{ type: "liste", elements: points, vide: t("vigilance.vide") }],
  };

  /* --- 6. Équipe projet --- */

  const membres: { role: string; intervenant: Intervenant | null }[] = [
    { role: t("equipe.chefProjet"), intervenant: projet.chefProjet },
    { role: t("equipe.conducteurTravaux"), intervenant: projet.conducteurTravaux },
    ...(projet.chefsChantier.length > 0
      ? projet.chefsChantier.map((chef) => ({ role: t("equipe.chefChantier"), intervenant: chef }))
      : [{ role: t("equipe.chefChantier"), intervenant: null }]),
    { role: t("equipe.directeurFinancier"), intervenant: projet.directeurFinancier },
  ];
  const equipe: SectionPdf = {
    titre: t("sections.equipe"),
    blocs: [
      {
        type: "tableau",
        vide: "",
        tableau: {
          entetes: [t("equipe.role"), t("equipe.nom"), t("equipe.telephone"), t("equipe.email")],
          largeurs: [0.22, 0.26, 0.2, 0.32],
          lignes: membres.map(({ role, intervenant }) => [
            { texte: role, gras: true },
            intervenant
              ? { texte: nomOuAbsent(intervenant) }
              : { texte: t("equipe.nonDesigne"), ton: "neutre" },
            { texte: intervenant?.telephone ? afficherTelephone(intervenant.telephone) : ABSENT },
            { texte: intervenant?.email || ABSENT },
          ]),
        },
      },
      ...(equipes
        ? [
            {
              type: "paragraphe" as const,
              texte: t("equipe.equipesChantier", {
                equipes: equipes.length,
                personnes: effectifProjet(equipes),
              }),
            },
          ]
        : []),
    ],
  };

  /* --- 7. Prochaines étapes --- */

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
          lignes: prochainesEtapes(lots, maintenant).map(({ activite, lot }) => [
            { texte: activite.code, gras: true },
            { texte: activite.libelle },
            { texte: `${lot.code} ${lot.nom}` },
            { texte: formaterDate(activite.dateDebutPrevue) },
            { texte: formaterDate(activite.dateFinPrevue) },
            activite.equipe
              ? { texte: activite.equipe.nom }
              : { texte: t("etapes.aAffecter"), ton: "avertissement" },
          ]),
        },
      },
    ],
  };

  /* --- 8. Note du chef de projet : absente si vide (F1 §9.4) --- */

  const texteNote = note.trim();
  const sectionNote: SectionPdf[] = texteNote
    ? [
        {
          titre: t("sections.note"),
          accent: true,
          blocs: [
            {
              type: "encadre",
              auteur: projet.chefProjet
                ? t("note.auteur", { nom: nomOuAbsent(projet.chefProjet), date: formaterDate(maintenant) })
                : t("note.auteurSansNom", { date: formaterDate(maintenant) }),
              texte: texteNote,
            },
          ],
        },
      ]
    : [];

  /* --- Signatures --- */

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
          { role: t("signatures.directeurGeneral"), mention: t("signatures.signature"), nom: ABSENT },
          {
            role: t("signatures.directeurFinancier"),
            mention: t("signatures.signature"),
            nom: projet.directeurFinancier ? nomOuAbsent(projet.directeurFinancier) : ABSENT,
          },
        ],
      },
    ],
  };

  /* --- Le document --- */

  const { emetteur, pied } = emetteurDocument(entreprise, marque);

  return {
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
      calendrierBudget,
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
}

function libelleEcheance(t: Traduire, projet: Projet, joursRestants: number | null): string {
  if (projet.dateFinReelle) {
    return t("calendrier.termineLe", { date: formaterDate(projet.dateFinReelle) });
  }
  if (joursRestants === null) return t("calendrier.clos");
  if (joursRestants < 0) return t("calendrier.echeanceDepassee", { jours: Math.abs(joursRestants) });
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

import type { DonneesEntreprise } from "@/features/configuration/api";
import { appliquerDocumentsAuPdf } from "@/features/documents";
import type { DocumentsResolus } from "@/features/documents";
import {
  criteresActifs,
  niveauRetardProjet,
  syntheseRapportPortefeuille,
} from "@/features/projets/regles";
import type { CriteresProjets, NiveauRetardPlanning } from "@/features/projets/regles";
import type { Projet, StatutProjet } from "@/features/projets/types";
import type { CellulePdf, DocumentPdf, ImagePdf, SectionPdf, TonPdf } from "@/lib/export/documentPdf";
import {
  ABSENT,
  couleurIndiceSante,
  formaterDate,
  formaterDateHeure,
  formaterMontant,
  formaterPourcentage,
} from "@/lib/format";

import { TON_STATUT } from "./classes";
import { emetteurDocument } from "./[id]/contenuFichePdf";

/**
 * Le contenu du rapport d'avancement du portefeuille — SFD F3 US-03, colonnes
 * du §5.1 : projet, localisation, chef de projet, avancement physique réel,
 * avancement **temporel** à date, retard en points, indice de santé, fin
 * contractuelle, statut et, si l'utilisateur voit les montants, budget.
 *
 * Comme `contenuFicheProjet`, ce module **traduit** et ne calcule rien :
 * les avancements, le retard et l'indice sont ceux du serveur (RG-F3-04) ; les
 * tuiles viennent de `syntheseRapportPortefeuille`, le niveau de retard de
 * `niveauRetardProjet` (les seuils du planning). La mise en page est celle de
 * `lib/export/documentPdf`.
 */

/** Le traducteur de `projets.rapportPortefeuille` (next-intl). */
type Traduire = (cle: string, valeurs?: Record<string, string | number>) => string;

export interface DonneesPortefeuille {
  /** Les chantiers **exportés par l'écran** : ceux qui passent la recherche et les filtres. */
  projets: Projet[];
  /** Les filtres de l'écran, rappelés en tête du document. */
  criteres: CriteresProjets;
  /** Le nom du chef de projet filtré ; `null` quand aucun chef n'est filtré. */
  chefFiltre: string | null;
  /** La colonne « Budget » ne sort que si l'utilisateur voit les montants. */
  voitMontants: boolean;
  entreprise: DonneesEntreprise | null;
  logo: ImagePdf | null;
  /** `null` : le réglage de l'en-tête et du pied n'a pas pu être lu — le rapport sort sans mentions. */
  documents: DocumentsResolus | null;
  /** Le nom de la plateforme : l'émetteur à défaut d'entreprise connue. */
  marque: string;
  libelles: {
    statutProjet: (statut: StatutProjet) => string;
  };
  maintenant: Date;
}

const TON_RETARD: Record<NiveauRetardPlanning, TonPdf> = {
  DANS_LES_DELAIS: "succes",
  MODERE: "avertissement",
  CRITIQUE: "erreur",
};

const TON_SANTE_PDF: Record<ReturnType<typeof couleurIndiceSante>, TonPdf> = {
  vert: "succes",
  orange: "avertissement",
  rouge: "erreur",
  inconnu: "neutre",
};

const deux = (n: number) => String(n).padStart(2, "0");

/** `AAAA-MM-JJ` et `HHhMM`, à l'heure locale : celle que le document affiche. */
function horodatageFichier(maintenant: Date): { date: string; heure: string } {
  return {
    date: `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`,
    heure: `${deux(maintenant.getHours())}h${deux(maintenant.getMinutes())}`,
  };
}

/** Le retard en points, signé : positif = retard sur le temporel (convention du serveur). */
function pointsSignes(delta: number): string {
  return new Intl.NumberFormat("fr-FR", { signDisplay: "exceptZero", maximumFractionDigits: 1 }).format(delta);
}

export function contenuPortefeuille(t: Traduire, donnees: DonneesPortefeuille): DocumentPdf {
  const { projets, criteres, chefFiltre, voitMontants, entreprise, logo, documents, marque, libelles, maintenant } =
    donnees;
  const synthese = syntheseRapportPortefeuille(projets);

  /* --- Les filtres appliqués --- */

  const filtres: string[] = [];
  if (criteres.recherche.trim()) filtres.push(t("filtres.recherche", { valeur: criteres.recherche.trim() }));
  if (criteres.statut) filtres.push(t("filtres.statut", { valeur: libelles.statutProjet(criteres.statut) }));
  if (criteres.chefProjetId && chefFiltre) filtres.push(t("filtres.chefProjet", { valeur: chefFiltre }));

  const sectionFiltres: SectionPdf = {
    titre: t("sections.filtres"),
    blocs: [
      {
        type: "paragraphe",
        texte: criteresActifs(criteres) ? filtres.join(" · ") : t("filtres.aucun"),
      },
    ],
  };

  /* --- Les tuiles --- */

  const sectionSynthese: SectionPdf = {
    titre: t("sections.synthese"),
    blocs: [
      {
        type: "tuiles",
        tuiles: [
          { libelle: t("synthese.projets"), valeur: String(synthese.nombre), ton: "secondaire" },
          {
            libelle: t("synthese.avancement"),
            valeur: formaterPourcentage(synthese.avancementMoyen),
            detail: synthese.avancementMoyen === null ? undefined : t("synthese.moyenneSimple"),
            ton: "primaire",
          },
          {
            libelle: t("synthese.enRetard"),
            valeur: String(synthese.enRetard),
            ton: synthese.enRetard > 0 ? "avertissement" : "succes",
          },
          {
            libelle: t("synthese.critiques"),
            valeur: String(synthese.critiques),
            ton: synthese.critiques > 0 ? "erreur" : "succes",
          },
        ],
      },
    ],
  };

  /* --- Le tableau des projets --- */

  const lignes: CellulePdf[][] = projets.map((projet) => {
    const lieu = [projet.quartier, projet.ville].filter(Boolean).join(", ");
    const sante = couleurIndiceSante(projet.indiceSante);
    return [
      { texte: `${projet.nom}\n${projet.reference}`, gras: true },
      { texte: lieu || ABSENT },
      { texte: projet.chefProjet?.nomComplet || t("tableau.sansChefProjet") },
      { texte: formaterPourcentage(projet.avancementReel), gras: true },
      { texte: formaterPourcentage(projet.avancementTheorique) },
      projet.deltaRetard === null
        ? { texte: ABSENT, ton: "neutre" }
        : { texte: pointsSignes(projet.deltaRetard), gras: true, ton: TON_RETARD[niveauRetardProjet(projet)] },
      projet.indiceSante === null
        ? { texte: ABSENT, ton: "neutre" }
        : { texte: String(projet.indiceSante), gras: true, ton: TON_SANTE_PDF[sante] },
      { texte: formaterDate(projet.dateFinPrevue) },
      { texte: libelles.statutProjet(projet.statut), gras: true, ton: TON_STATUT[projet.statut] },
      ...(voitMontants
        ? [
            {
              texte:
                projet.budgetInitial === null
                  ? t("tableau.budgetNonDefini")
                  : formaterMontant(projet.budgetInitial, { avecDevise: false }),
            },
          ]
        : []),
    ];
  });

  const entetes = [
    t("tableau.projet"),
    t("tableau.localisation"),
    t("tableau.chefProjet"),
    t("tableau.avancementReel"),
    t("tableau.avancementTemporel"),
    t("tableau.retard"),
    t("tableau.sante"),
    t("tableau.finContractuelle"),
    t("tableau.statut"),
    ...(voitMontants ? [t("tableau.budget")] : []),
  ];
  const largeurs = voitMontants
    ? [0.17, 0.11, 0.11, 0.08, 0.09, 0.08, 0.06, 0.1, 0.1, 0.1]
    : [0.2, 0.13, 0.13, 0.09, 0.1, 0.09, 0.07, 0.11, 0.08];

  const tableau: SectionPdf = {
    titre: t("sections.projets"),
    blocs: [
      {
        type: "tableau",
        vide: t("tableau.vide"),
        tableau: { entetes, largeurs, lignes },
      },
      { type: "paragraphe", texte: t("tableau.legende") },
    ],
  };

  /* --- Le document --- */

  const { emetteur, pied } = emetteurDocument(entreprise, marque);
  const { date, heure } = horodatageFichier(maintenant);

  const document: DocumentPdf = {
    nomFichier: t("nomFichier", { date, heure }),
    entete: {
      emetteur,
      logo,
      titre: t("titre"),
      sousTitre: t("dateGeneration", { date: formaterDateHeure(maintenant) }),
    },
    objet: {
      titre: t("objet"),
      pastilles: [{ texte: t("nombreProjets", { nombre: projets.length }), ton: "secondaire" }],
    },
    sections: [sectionFiltres, sectionSynthese, tableau],
    pied: {
      gauche: pied,
      droite: (page, total) => t("pied.page", { page, total }),
    },
  };

  return appliquerDocumentsAuPdf(document, documents);
}

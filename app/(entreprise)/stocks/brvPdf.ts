import type { Livraison } from "@/features/stocks";
import type { CasePdf, CellulePdf, DocumentPdf } from "@/lib/export/documentPdf";
import { formaterDateHeure, formaterQuantite, formaterTailleFichier } from "@/lib/format";

import { emetteurDocument } from "../projets/[id]/contenuFichePdf";
import type { SourcePdf } from "../rapports/GenerationDocumentPdf";
import { TON_PDF_LIVRAISON } from "./classes";

/** Le traducteur de `stocks.receptions.pdf` (next-intl). */
type Traduire = (cle: string, valeurs?: Record<string, string | number>) => string;

export interface DonneesBrv extends SourcePdf {
  livraison: Livraison;
  projet: string;
  lot: string;
  nature: string;
  libelleMateriau: (id: string) => string;
  unite: (id: string) => string;
}

/**
 * Le bon de réception validé (BRV) imprimable — la pièce justificative
 * commune à F9 (quantités) et F7 (montants), archivée dans F6.
 *
 * Ce module ne calcule rien : il traduit la livraison telle que le serveur
 * l'a validée, avec l'empreinte SHA-256 du BL signé (RG-STK-13) et les
 * signatures du circuit — magasinier, conducteur de travaux, et chef de
 * projet pour un équipement.
 */
export function contenuBrv(t: Traduire, donnees: DonneesBrv): DocumentPdf {
  const { livraison, entreprise, logo, marque, maintenant } = donnees;
  const { emetteur, pied } = emetteurDocument(entreprise, marque);

  const lignes: CellulePdf[][] = livraison.lignes.map((ligne) => [
    { texte: donnees.libelleMateriau(ligne.materiauId), gras: true },
    { texte: donnees.unite(ligne.materiauId) },
    { texte: formaterQuantite(ligne.quantiteAttendue) },
    { texte: formaterQuantite(ligne.quantiteRecue) },
    { texte: formaterQuantite(ligne.quantiteValidee ?? 0), gras: true, ton: "succes" },
    ligne.conforme ? { texte: t("conforme"), ton: "succes" } : { texte: t("nonConforme", { motif: ligne.motif }), ton: "erreur" },
  ]);

  const signatures: CasePdf[] = [
    {
      role: t("roleMagasinier"),
      mention: t("mentionReception"),
      nom: livraison.magasinier.nom,
      detail: formaterDateHeure(livraison.recueLe),
    },
  ];
  if (livraison.validationCT) {
    signatures.push({
      role: t("roleCT"),
      mention: t("mentionValidation"),
      nom: livraison.validationCT.par.nom,
      detail: formaterDateHeure(livraison.validationCT.le),
    });
  }
  if (livraison.validationCP) {
    signatures.push({
      role: t("roleCP"),
      mention: t("mentionValidation"),
      nom: livraison.validationCP.par.nom,
      detail: formaterDateHeure(livraison.validationCP.le),
    });
  }
  signatures.push({
    role: t("roleSysteme"),
    mention: t("mentionSysteme"),
    nom: livraison.numeroBrv ?? "",
    detail: formaterDateHeure(maintenant),
    accent: true,
  });

  return {
    nomFichier: `${livraison.numeroBrv ?? livraison.reference}.pdf`,
    entete: {
      emetteur,
      logo,
      titre: t("titre"),
      sousTitre: t("genereLe", { date: formaterDateHeure(maintenant) }),
      reference: livraison.numeroBrv ?? livraison.reference,
      marque,
    },
    objet: {
      titre: t("objet", { projet: donnees.projet, lot: donnees.lot }),
      pastilles: [
        { texte: t(`statut.${livraison.statut}`), ton: TON_PDF_LIVRAISON[livraison.statut] },
        { texte: donnees.nature, ton: livraison.nature === "EQUIPEMENT" ? "secondaire" : "neutre" },
      ],
    },
    sections: [
      {
        titre: t("sectionReception"),
        blocs: [
          {
            type: "cles",
            elements: [
              { libelle: t("bonCommande"), valeur: livraison.bonCommandeReference },
              { libelle: t("livraison"), valeur: livraison.reference },
              { libelle: t("chantier"), valeur: donnees.projet },
              { libelle: t("lot"), valeur: donnees.lot },
              { libelle: t("recueLe"), valeur: formaterDateHeure(livraison.recueLe) },
              { libelle: t("photos"), valeur: String(livraison.photos.length) },
              ...(livraison.observation ? [{ libelle: t("observation"), valeur: livraison.observation, large: true }] : []),
            ],
          },
        ],
      },
      {
        titre: t("sectionLignes"),
        blocs: [
          {
            type: "tableau",
            tableau: {
              entetes: [t("article"), t("unite"), t("attendu"), t("recu"), t("valide"), t("conformite")],
              lignes,
              largeurs: [0.3, 0.08, 0.12, 0.12, 0.12, 0.26],
            },
            vide: t("aucuneLigne"),
          },
        ],
      },
      {
        titre: t("sectionJustificatif"),
        blocs: [
          livraison.justificatif
            ? {
                type: "cles",
                elements: [
                  { libelle: t("fichier"), valeur: livraison.justificatif.nom },
                  { libelle: t("taille"), valeur: formaterTailleFichier(livraison.justificatif.taille) },
                  {
                    libelle: t("deposePar"),
                    valeur: t("parLe", {
                      nom: livraison.justificatif.deposePar.nom,
                      date: formaterDateHeure(livraison.justificatif.deposeLe),
                    }),
                  },
                  { libelle: t("empreinte"), valeur: livraison.justificatif.hash, large: true },
                ],
              }
            : { type: "paragraphe", texte: t("sansJustificatif") },
        ],
      },
      { titre: t("sectionSignatures"), accent: true, blocs: [{ type: "signatures", cases: signatures }] },
    ],
    pied: {
      gauche: pied,
      centre: t("mentionPied"),
      droite: (page, total) => t("page", { page, total }),
    },
  };
}

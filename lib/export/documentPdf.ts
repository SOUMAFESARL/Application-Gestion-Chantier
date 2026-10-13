/**
 * Un document PDF mis en page — en-tête, sections numérotées, tableaux,
 * jauges, tuiles de chiffres, signatures, pied paginé — dessiné côté
 * navigateur.
 *
 * `pdf.ts` sort un tableau brut, en noir, pour être retrié ; ce module sort un
 * **document**, qu'on imprime ou qu'on envoie à un client (la fiche projet,
 * F1 §9). L'écran décrit le contenu, déjà traduit et formaté (`DocumentPdf`) ;
 * la mise en page, elle, vit ici et ne connaît aucun domaine.
 *
 * **Les couleurs sont lues dans la charte au moment de dessiner** : jsPDF ne
 * sait pas lire `styles/tokens.css`, mais le navigateur, si. Chaque teinte
 * est un jeton `--color-*` résolu sur `:root` — aucune valeur écrite ici, et
 * le document suit la charte le jour où elle change.
 *
 * jsPDF est chargé à la demande, comme pour `pdf.ts`.
 */

import type { CellHookData, RowInput } from "jspdf-autotable";

/** La teinte d'un élément, prise dans la charte. */
export type TonPdf =
  | "primaire"
  | "secondaire"
  | "succes"
  | "avertissement"
  | "erreur"
  | "information"
  | "neutre";

export interface PastillePdf {
  texte: string;
  ton: TonPdf;
  /** Le retrait dans une liste : 0 pour un élément de tête, 1 pour ses enfants. */
  niveau?: 0 | 1;
}

export interface CleValeurPdf {
  libelle: string;
  valeur: string;
  ton?: TonPdf;
  /** Sur toute la largeur : une description. */
  large?: boolean;
}

export interface TuilePdf {
  libelle: string;
  valeur: string;
  detail?: string;
  ton: TonPdf;
}

export interface JaugePdf {
  libelle: string;
  /** De 0 à 100 ; `null` : pas de barre, seulement le texte. */
  valeur: number | null;
  texte: string;
  ton: TonPdf;
}

export interface CellulePdf {
  texte: string;
  ton?: TonPdf;
  gras?: boolean;
  /** Une mini-jauge devant le texte, de 0 à 100. */
  jauge?: number | null;
}

export interface TableauPdf {
  entetes: string[];
  lignes: CellulePdf[][];
  /** La part de la largeur de chaque colonne ; absente, autoTable décide. */
  largeurs?: number[];
}

export interface CasePdf {
  role: string;
  mention: string;
  nom: string;
  detail?: string;
  /** Le cachet du système : bordé de la couleur d'accent. */
  accent?: boolean;
}

export type BlocPdf =
  /** `legeres` : les valeurs en graisse normale, la couleur suffisant à les distinguer des libellés. */
  | { type: "cles"; elements: CleValeurPdf[]; legeres?: boolean }
  | { type: "tuiles"; tuiles: TuilePdf[] }
  | { type: "jauges"; jauges: JaugePdf[] }
  | { type: "tableau"; tableau: TableauPdf; vide: string }
  | { type: "liste"; elements: PastillePdf[]; vide: string }
  | { type: "encadre"; auteur: string; texte: string }
  | { type: "paragraphe"; texte: string }
  | { type: "signatures"; cases: CasePdf[] };

export interface SectionPdf {
  titre: string;
  /** Le bandeau prend la couleur d'accent plutôt que la couleur sombre. */
  accent?: boolean;
  blocs: BlocPdf[];
}

export interface ImagePdf {
  /** Une URL `data:image/png`. */
  donnees: string;
  largeur: number;
  hauteur: number;
}

export interface DocumentPdf {
  nomFichier: string;
  entete: {
    /** L'entreprise émettrice : son logo, ou son nom à défaut. */
    emetteur: string;
    logo: ImagePdf | null;
    titre: string;
    sousTitre: string;
    /** La référence du document, en cartouche sous le titre ; absente, pas de cartouche. */
    reference?: string;
    /** La plateforme, calée à droite ; absente, l'en-tête n'en porte pas. */
    marque?: string;
  };
  /** Ce dont parle le document : son nom, ses pastilles d'état, un chiffre clé. */
  objet: {
    titre: string;
    pastilles: PastillePdf[];
    indicateur?: TuilePdf;
  };
  sections: SectionPdf[];
  pied: {
    gauche: string;
    /** Une mention sous le pied, en italique ; absente, pas de seconde ligne. */
    centre?: string;
    droite: (page: number, total: number) => string;
  };
}

/* ------------------------------------------------------------------ *
 * La charte, lue sur la page.
 * ------------------------------------------------------------------ */

type Rvb = [number, number, number];

/** `#EA580C`, `#fff` ou `rgb(234, 88, 12)` → `[234, 88, 12]`. */
function versRvb(valeur: string): Rvb | null {
  const texte = valeur.trim();
  const hexa = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(texte);
  if (hexa) {
    const brut = hexa[1].length === 3 ? [...hexa[1]].map((c) => c + c).join("") : hexa[1];
    return [0, 2, 4].map((i) => Number.parseInt(brut.slice(i, i + 2), 16)) as Rvb;
  }
  const rvb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(texte);
  if (rvb) return [Number(rvb[1]), Number(rvb[2]), Number(rvb[3])];
  return null;
}

/** Un jeton `--color-*` de la charte, résolu sur `:root`. Absent : noir. */
function jeton(nom: string): Rvb {
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(`--color-${nom}`);
  return versRvb(valeur) ?? [0, 0, 0];
}

interface Palette {
  texte: Rvb;
  attenue: Rvb;
  discret: Rvb;
  filet: Rvb;
  fondLigne: Rvb;
  blanc: Rvb;
  sombre: Rvb;
  accent: Rvb;
  accentFond: Rvb;
  tons: Record<TonPdf, { encre: Rvb; fond: Rvb }>;
}

function lirePalette(): Palette {
  return {
    texte: jeton("neutral-900"),
    attenue: jeton("neutral-600"),
    discret: jeton("neutral-400"),
    filet: jeton("neutral-200"),
    fondLigne: jeton("neutral-50"),
    blanc: jeton("neutral-0"),
    sombre: jeton("secondary-800"),
    accent: jeton("primary-600"),
    accentFond: jeton("primary-50"),
    tons: {
      primaire: { encre: jeton("primary-700"), fond: jeton("primary-50") },
      secondaire: { encre: jeton("secondary-800"), fond: jeton("secondary-100") },
      succes: { encre: jeton("semantic-success"), fond: jeton("semantic-success-bg") },
      avertissement: { encre: jeton("semantic-warning"), fond: jeton("semantic-warning-bg") },
      erreur: { encre: jeton("semantic-error"), fond: jeton("semantic-error-bg") },
      information: { encre: jeton("semantic-info"), fond: jeton("semantic-info-bg") },
      neutre: { encre: jeton("neutral-700"), fond: jeton("neutral-100") },
    },
  };
}

/* ------------------------------------------------------------------ *
 * Les images.
 * ------------------------------------------------------------------ */

/** Le délai au-delà duquel on renonce au logo plutôt que de bloquer le document. */
const DELAI_IMAGE_MS = 5000;

/**
 * Une image distante, redessinée en PNG pour jsPDF. `null` si elle ne se
 * charge pas, ou si son serveur refuse le partage entre origines (le canevas
 * est alors « souillé » et ne s'exporte plus) : le document sort sans logo
 * plutôt que de ne pas sortir.
 */
export function chargerImagePdf(url: string | null | undefined): Promise<ImagePdf | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resoudre) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const minuterie = window.setTimeout(() => resoudre(null), DELAI_IMAGE_MS);
    image.onload = () => {
      window.clearTimeout(minuterie);
      try {
        const canevas = document.createElement("canvas");
        canevas.width = image.naturalWidth;
        canevas.height = image.naturalHeight;
        canevas.getContext("2d")?.drawImage(image, 0, 0);
        resoudre({
          donnees: canevas.toDataURL("image/png"),
          largeur: image.naturalWidth,
          hauteur: image.naturalHeight,
        });
      } catch {
        resoudre(null);
      }
    };
    image.onerror = () => {
      window.clearTimeout(minuterie);
      resoudre(null);
    };
    image.src = url;
  });
}

/* ------------------------------------------------------------------ *
 * La mise en page.
 * ------------------------------------------------------------------ */

/** A4 debout, en millimètres. */
const PAGE_LARGEUR = 210;
const PAGE_HAUTEUR = 297;
const MARGE = 12;
const LARGEUR = PAGE_LARGEUR - 2 * MARGE;
const DROITE = PAGE_LARGEUR - MARGE;
/** Sous cette ordonnée commence le pied de page. */
const LIMITE_BAS = PAGE_HAUTEUR - 18;
/** Un point typographique, en millimètres. */
const POINT = 0.3528;

function interligne(taille: number): number {
  return taille * POINT * 1.3;
}

/**
 * Les polices standard de jsPDF sont en WinAnsi : l'espace fine insécable
 * que `lib/format` met entre les milliers n'y existe pas et sortirait en
 * glyphe parasite. On la ramène à une espace insécable ordinaire. La flèche
 * n'y existe pas davantage (« CC → CT » sortait en « CC !' CT ») : un chevron.
 */
function propre(texte: string): string {
  return texte.replace(/[   ]/g, " ").replace(/→/g, ">");
}

/** Télécharge le document, sous `contenu.nomFichier`. */
export async function telechargerDocumentPdf(contenu: DocumentPdf): Promise<void> {
  (await dessinerDocumentPdf(contenu)).save(contenu.nomFichier);
}

/**
 * Le PDF dessiné, sans le sortir : de quoi l'afficher en aperçu (dans un
 * cadre, par une URL `blob:`) avant que l'utilisateur ne choisisse de le
 * télécharger ou de l'imprimer. C'est le même document que les deux sorties.
 */
export async function genererDocumentPdf(contenu: DocumentPdf): Promise<Blob> {
  return (await dessinerDocumentPdf(contenu)).output("blob");
}

/** Le délai avant de libérer le PDF imprimé : la boîte d'impression doit l'avoir lu. */
const DELAI_LIBERATION_MS = 60_000;

/**
 * Imprime **le même document** que le téléchargement : le PDF est chargé
 * dans un cadre invisible et c'est lui que le navigateur imprime, pas la
 * page. Imprimer l'écran donnait un autre papier — ni l'en-tête, ni le pied
 * paginé, et des tableaux rognés.
 */
export async function imprimerDocumentPdf(contenu: DocumentPdf): Promise<void> {
  const doc = await dessinerDocumentPdf(contenu);
  const url = URL.createObjectURL(doc.output("blob"));
  const cadre = document.createElement("iframe");
  cadre.setAttribute("aria-hidden", "true");
  Object.assign(cadre.style, { position: "fixed", width: "0", height: "0", border: "0", right: "0", bottom: "0" });
  await new Promise<void>((resoudre, rejeter) => {
    cadre.onload = () => {
      try {
        cadre.contentWindow?.focus();
        cadre.contentWindow?.print();
        resoudre();
      } catch (erreur) {
        rejeter(erreur);
      }
    };
    cadre.src = url;
    document.body.appendChild(cadre);
  });
  window.setTimeout(() => {
    cadre.remove();
    URL.revokeObjectURL(url);
  }, DELAI_LIBERATION_MS);
}

async function dessinerDocumentPdf(contenu: DocumentPdf) {
  const [{ jsPDF: JsPdf }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new JsPdf({ orientation: "portrait", unit: "mm", format: "a4" });
  const palette = lirePalette();
  let y = MARGE;

  /* --- Les primitives --- */

  function police(taille: number, style: "normal" | "bold" | "italic" = "normal", couleur: Rvb = palette.texte) {
    doc.setFont("helvetica", style);
    doc.setFontSize(taille);
    doc.setTextColor(...couleur);
  }

  function ecrire(
    texte: string | string[],
    x: number,
    ordonnee: number,
    options?: { align?: "left" | "center" | "right" },
  ) {
    doc.text(Array.isArray(texte) ? texte.map(propre) : propre(texte), x, ordonnee, options);
  }

  function couper(texte: string, largeur: number): string[] {
    return doc.splitTextToSize(propre(texte), largeur) as string[];
  }

  function remplir(couleur: Rvb) {
    doc.setFillColor(...couleur);
  }

  function tracer(couleur: Rvb, epaisseur = 0.2) {
    doc.setDrawColor(...couleur);
    doc.setLineWidth(epaisseur);
  }

  /** Passe à la page suivante si `hauteur` ne tient plus sur celle-ci. */
  function assurer(hauteur: number) {
    if (y + hauteur > LIMITE_BAS) {
      doc.addPage();
      y = MARGE;
    }
  }

  function jauge(x: number, ordonnee: number, largeur: number, hauteur: number, valeur: number, couleur: Rvb) {
    remplir(palette.tons.neutre.fond);
    doc.roundedRect(x, ordonnee, largeur, hauteur, hauteur / 2, hauteur / 2, "F");
    const rempli = (Math.min(Math.max(valeur, 0), 100) / 100) * largeur;
    if (rempli > 0) {
      remplir(couleur);
      doc.roundedRect(x, ordonnee, Math.max(rempli, hauteur), hauteur, hauteur / 2, hauteur / 2, "F");
    }
  }

  /** Une pastille d'état ; renvoie sa largeur. */
  function pastille({ texte, ton }: PastillePdf, x: number, ordonnee: number): number {
    police(7.5, "bold", palette.tons[ton].encre);
    const largeur = doc.getTextWidth(propre(texte)) + 4;
    remplir(palette.tons[ton].fond);
    doc.roundedRect(x, ordonnee, largeur, 5, 1, 1, "F");
    ecrire(texte, x + 2, ordonnee + 3.5);
    return largeur;
  }

  /* --- L'en-tête --- */

  function dessinerEntete() {
    const { entete } = contenu;
    const haut = y;

    // Le logo de l'entreprise, ou son nom dans un cartouche à sa place.
    if (entete.logo) {
      const echelle = Math.min(34 / entete.logo.largeur, 16 / entete.logo.hauteur);
      const largeur = entete.logo.largeur * echelle;
      const hauteur = entete.logo.hauteur * echelle;
      doc.addImage(entete.logo.donnees, "PNG", MARGE, haut + (16 - hauteur) / 2, largeur, hauteur);
    } else {
      remplir(palette.accent);
      doc.roundedRect(MARGE, haut + 1, 34, 14, 1.5, 1.5, "F");
      police(8, "bold", palette.blanc);
      const lignes = couper(entete.emetteur, 30).slice(0, 2);
      const debut = haut + 8 - ((lignes.length - 1) * interligne(8)) / 2 + 1;
      ecrire(lignes, MARGE + 17, debut, { align: "center" });
    }

    const centre = PAGE_LARGEUR / 2;
    police(13, "bold", palette.sombre);
    ecrire(entete.titre.toUpperCase(), centre, haut + 5, { align: "center" });
    police(7.5, "normal", palette.attenue);
    ecrire(entete.sousTitre, centre, haut + 9.5, { align: "center" });

    if (entete.reference) {
      police(8, "bold", palette.blanc);
      const largeurReference = doc.getTextWidth(propre(entete.reference)) + 6;
      remplir(palette.sombre);
      doc.roundedRect(centre - largeurReference / 2, haut + 11.5, largeurReference, 5, 1, 1, "F");
      ecrire(entete.reference, centre, haut + 15, { align: "center" });
    }

    if (entete.marque) {
      police(10, "bold", palette.accent);
      ecrire(entete.marque, DROITE, haut + 7, { align: "right" });
    }

    tracer(palette.accent, 0.8);
    doc.line(MARGE, haut + 20, DROITE, haut + 20);
    y = haut + 26;
  }

  /* --- L'objet du document --- */

  function dessinerObjet() {
    const { objet } = contenu;
    const haut = y;
    const largeurTitre = objet.indicateur ? LARGEUR - 48 : LARGEUR;

    police(16, "bold");
    const lignes = couper(objet.titre, largeurTitre);
    ecrire(lignes, MARGE, haut + 5);
    let bas = haut + 5 + (lignes.length - 1) * interligne(16) + 3;

    let x = MARGE;
    for (const element of objet.pastilles) {
      x += pastille(element, x, bas) + 2;
    }
    if (objet.pastilles.length > 0) bas += 5;

    if (objet.indicateur) {
      const { libelle, valeur, detail, ton } = objet.indicateur;
      const gauche = DROITE - 42;
      remplir(palette.tons[ton].fond);
      doc.roundedRect(gauche, haut, 42, 20, 2, 2, "F");
      police(7, "bold", palette.attenue);
      ecrire(libelle.toUpperCase(), gauche + 21, haut + 4.5, { align: "center" });
      police(15, "bold", palette.tons[ton].encre);
      ecrire(valeur, gauche + 21, haut + 12, { align: "center" });
      if (detail) {
        police(7.5, "bold", palette.tons[ton].encre);
        ecrire(detail, gauche + 21, haut + 17, { align: "center" });
      }
      bas = Math.max(bas, haut + 20);
    }
    y = bas + 5;
  }

  /* --- Les sections --- */

  function titreSection(titre: string, accent: boolean) {
    // Un titre ne reste jamais seul en bas de page.
    assurer(26);
    remplir(accent ? palette.accent : palette.sombre);
    doc.rect(MARGE, y, LARGEUR, 6, "F");
    police(8.5, "bold", palette.blanc);
    ecrire(titre.toUpperCase(), MARGE + 2.5, y + 4.2);
    y += 9;
  }

  function dessinerCles(elements: CleValeurPdf[], legeres = false) {
    const graisse = legeres ? "normal" : "bold";
    const colonne = (LARGEUR - 8) / 2;
    const largeurLibelle = 32;

    // Deux paires par ligne ; une paire `large` occupe la sienne seule.
    const rangees: CleValeurPdf[][] = [];
    for (const element of elements) {
      const derniere = rangees[rangees.length - 1];
      if (!element.large && derniere && derniere.length === 1 && !derniere[0].large) {
        derniere.push(element);
      } else {
        rangees.push([element]);
      }
    }

    for (const rangee of rangees) {
      const largeurValeur = (rangee[0].large ? LARGEUR : colonne) - largeurLibelle;
      police(8.5, graisse);
      const valeurs = rangee.map((element) => couper(element.valeur, largeurValeur));
      const hauteur = Math.max(...valeurs.map((lignes) => lignes.length)) * interligne(8.5) + 2;
      assurer(hauteur);
      rangee.forEach((element, rang) => {
        const x = MARGE + rang * (colonne + 8);
        police(7.5, "normal", palette.attenue);
        ecrire(element.libelle, x, y + 3);
        police(8.5, graisse, element.ton ? palette.tons[element.ton].encre : palette.texte);
        ecrire(valeurs[rang], x + largeurLibelle, y + 3);
      });
      tracer(palette.filet);
      doc.line(MARGE, y + hauteur, DROITE, y + hauteur);
      y += hauteur + 1.5;
    }
    y += 2;
  }

  function dessinerTuiles(tuiles: TuilePdf[]) {
    const ecart = 3;
    const largeur = (LARGEUR - ecart * (tuiles.length - 1)) / tuiles.length;
    const hauteur = 21;
    assurer(hauteur);
    tuiles.forEach((tuile, rang) => {
      const x = MARGE + rang * (largeur + ecart);
      const centre = x + largeur / 2;
      remplir(palette.tons[tuile.ton].fond);
      doc.roundedRect(x, y, largeur, hauteur, 1.5, 1.5, "F");
      police(6.5, "bold", palette.attenue);
      ecrire(couper(tuile.libelle.toUpperCase(), largeur - 4).slice(0, 2), centre, y + 4.2, {
        align: "center",
      });
      police(13, "bold", palette.tons[tuile.ton].encre);
      ecrire(tuile.valeur, centre, y + 14, { align: "center" });
      if (tuile.detail) {
        police(6.5, "normal", palette.attenue);
        ecrire(couper(tuile.detail, largeur - 4)[0], centre, y + 18.5, { align: "center" });
      }
    });
    y += hauteur + 4;
  }

  function dessinerJauges(jauges: JaugePdf[]) {
    for (const element of jauges) {
      assurer(10);
      police(8, "normal");
      ecrire(element.libelle, MARGE, y + 3.5);
      police(8, "bold", palette.tons[element.ton].encre);
      ecrire(element.texte, DROITE, y + 3.5, { align: "right" });
      if (element.valeur !== null) {
        jauge(MARGE, y + 5, LARGEUR, 2.5, element.valeur, palette.tons[element.ton].encre);
      }
      y += 10;
    }
    y += 1;
  }

  function dessinerTableau({ entetes, lignes, largeurs }: TableauPdf, vide: string) {
    if (lignes.length === 0) {
      dessinerParagraphe(vide);
      return;
    }
    const LARGEUR_JAUGE = 14;
    const corps: RowInput[] = lignes.map((ligne) =>
      ligne.map((cellule) => ({
        content: propre(cellule.texte),
        styles: {
          textColor: cellule.ton ? palette.tons[cellule.ton].encre : palette.texte,
          fontStyle: cellule.gras ? "bold" : "normal",
          ...(cellule.jauge !== undefined && cellule.jauge !== null
            ? { cellPadding: { top: 1.6, bottom: 1.6, left: LARGEUR_JAUGE + 3, right: 1.6 } }
            : {}),
        },
      })),
    );

    autoTable(doc, {
      head: [entetes.map(propre)],
      body: corps,
      startY: y,
      margin: { left: MARGE, right: MARGE, top: MARGE, bottom: PAGE_HAUTEUR - LIMITE_BAS },
      theme: "plain",
      styles: { fontSize: 7.5, cellPadding: 1.6, textColor: palette.texte, valign: "middle" },
      headStyles: { fillColor: palette.sombre, textColor: palette.blanc, fontStyle: "bold" },
      alternateRowStyles: { fillColor: palette.fondLigne },
      columnStyles: Object.fromEntries(
        (largeurs ?? []).map((part, rang) => [rang, { cellWidth: part * LARGEUR }]),
      ),
      didDrawCell: (donnees: CellHookData) => {
        if (donnees.section !== "body") return;
        const cellule = lignes[donnees.row.index]?.[donnees.column.index];
        if (cellule?.jauge === undefined || cellule.jauge === null) return;
        jauge(
          donnees.cell.x + 1.6,
          donnees.cell.y + donnees.cell.height / 2 - 1,
          LARGEUR_JAUGE,
          2,
          cellule.jauge,
          cellule.ton ? palette.tons[cellule.ton].encre : palette.accent,
        );
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  function dessinerListe(elements: PastillePdf[], vide: string) {
    if (elements.length === 0) {
      dessinerParagraphe(vide);
      return;
    }
    for (const element of elements) {
      // Un enfant est décalé, marqué d'un tiret plutôt que d'une puce pleine.
      const enfant = element.niveau === 1;
      const retrait = enfant ? 8 : 0;
      police(enfant ? 7.5 : 8, enfant ? "normal" : "bold");
      const lignes = couper(element.texte, LARGEUR - 6 - retrait);
      assurer(lignes.length * interligne(8) + 1.5);
      if (enfant) {
        tracer(palette.tons[element.ton].encre, 0.4);
        doc.line(MARGE + retrait, y + 2.1, MARGE + retrait + 2, y + 2.1);
      } else {
        remplir(palette.tons[element.ton].encre);
        doc.circle(MARGE + 1.5, y + 2.1, 0.9, "F");
      }
      police(enfant ? 7.5 : 8, enfant ? "normal" : "bold");
      ecrire(lignes, MARGE + retrait + 4, y + 3);
      y += lignes.length * interligne(8) + 1.5;
    }
    y += 2.5;
  }

  function dessinerEncadre(auteur: string, texte: string) {
    police(8.5, "normal");
    let reste = couper(texte, LARGEUR - 10);
    let premier = true;
    // Une note longue se poursuit sur la page suivante, encadré compris.
    while (reste.length > 0) {
      assurer(20);
      const entete = premier ? 6 : 2;
      const place = Math.max(1, Math.floor((LIMITE_BAS - y - entete - 4) / interligne(8.5)));
      const morceau = reste.slice(0, place);
      reste = reste.slice(place);
      const hauteur = entete + morceau.length * interligne(8.5) + 3;

      remplir(palette.accentFond);
      doc.rect(MARGE, y, LARGEUR, hauteur, "F");
      remplir(palette.accent);
      doc.rect(MARGE, y, 1, hauteur, "F");
      if (premier) {
        police(7.5, "bold", palette.accent);
        ecrire(auteur.toUpperCase(), MARGE + 5, y + 4.5);
      }
      police(8.5, "normal");
      ecrire(morceau, MARGE + 5, y + entete + 3);
      y += hauteur + (reste.length > 0 ? 0 : 4);
      premier = false;
      if (reste.length > 0) {
        doc.addPage();
        y = MARGE;
      }
    }
  }

  function dessinerParagraphe(texte: string) {
    police(8, "italic", palette.attenue);
    const lignes = couper(texte, LARGEUR);
    assurer(lignes.length * interligne(8) + 2);
    ecrire(lignes, MARGE, y + 3);
    y += lignes.length * interligne(8) + 3;
  }

  function dessinerSignatures(cases: CasePdf[]) {
    const ecart = 3;
    const largeur = (LARGEUR - ecart * (cases.length - 1)) / cases.length;
    const hauteur = 30;
    assurer(hauteur);
    cases.forEach((element, rang) => {
      const x = MARGE + rang * (largeur + ecart);
      const centre = x + largeur / 2;
      tracer(element.accent ? palette.accent : palette.filet, element.accent ? 0.4 : 0.2);
      doc.roundedRect(x, y, largeur, hauteur, 1.5, 1.5, "S");
      police(7.5, "bold", element.accent ? palette.accent : palette.attenue);
      ecrire(couper(element.role, largeur - 4)[0], centre, y + 4.5, { align: "center" });
      police(7, "italic", element.accent ? palette.accent : palette.discret);
      ecrire(couper(element.mention, largeur - 4)[0], centre, y + 11, { align: "center" });
      tracer(palette.discret);
      doc.line(x + 4, y + 20, x + largeur - 4, y + 20);
      police(8, "bold", element.accent ? palette.accent : palette.sombre);
      ecrire(couper(element.nom, largeur - 4)[0], centre, y + 24, { align: "center" });
      if (element.detail) {
        police(6.5, "normal", palette.attenue);
        ecrire(couper(element.detail, largeur - 4)[0], centre, y + 27.5, { align: "center" });
      }
    });
    y += hauteur + 4;
  }

  function dessinerPied() {
    const total = doc.getNumberOfPages();
    for (let page = 1; page <= total; page += 1) {
      doc.setPage(page);
      const haut = PAGE_HAUTEUR - 13;
      tracer(palette.filet);
      doc.line(MARGE, haut, DROITE, haut);
      police(7, "bold", palette.accent);
      ecrire(couper(contenu.pied.gauche, LARGEUR - 50)[0], MARGE, haut + 4);
      police(7, "normal", palette.attenue);
      ecrire(contenu.pied.droite(page, total), DROITE, haut + 4, { align: "right" });
      if (contenu.pied.centre) {
        police(6.5, "italic", palette.tons.erreur.encre);
        ecrire(couper(contenu.pied.centre, LARGEUR)[0], PAGE_LARGEUR / 2, haut + 8, { align: "center" });
      }
    }
  }

  /* --- Le document --- */

  dessinerEntete();
  dessinerObjet();
  for (const section of contenu.sections) {
    titreSection(section.titre, section.accent ?? false);
    for (const bloc of section.blocs) {
      switch (bloc.type) {
        case "cles":
          dessinerCles(bloc.elements, bloc.legeres);
          break;
        case "tuiles":
          dessinerTuiles(bloc.tuiles);
          break;
        case "jauges":
          dessinerJauges(bloc.jauges);
          break;
        case "tableau":
          dessinerTableau(bloc.tableau, bloc.vide);
          break;
        case "liste":
          dessinerListe(bloc.elements, bloc.vide);
          break;
        case "encadre":
          dessinerEncadre(bloc.auteur, bloc.texte);
          break;
        case "paragraphe":
          dessinerParagraphe(bloc.texte);
          break;
        case "signatures":
          dessinerSignatures(bloc.cases);
          break;
      }
    }
  }
  dessinerPied();

  return doc;
}

/**
 * L'export PDF d'un tableau, côté navigateur.
 *
 * **jsPDF est chargé à la demande.** Il pèse plusieurs centaines de Ko, pour
 * un bouton qu'on presse une fois par semaine : l'importer en tête de fichier
 * le ferait payer à chaque ouverture de la liste.
 *
 * Le thème `plain` est voulu : pas de couleur écrite en dur ici (la charte
 * vit dans `styles/tokens.css`, que jsPDF ne sait pas lire). L'en-tête se
 * distingue par sa graisse, et le document s'imprime proprement en noir.
 */

interface OptionsPdf {
  titre: string;
  /** Une ligne sous le titre : date d'édition, nombre de lignes… */
  sousTitre?: string;
  entetes: string[];
  lignes: (string | number)[][];
  nomFichier: string;
}

/** Les marges de la page, en millimètres. */
const MARGE = 12;

export async function telechargerPdf({
  titre,
  sousTitre,
  entetes,
  lignes,
  nomFichier,
}: OptionsPdf): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  // Paysage : une liste de chantiers a plus de colonnes qu'un A4 debout n'en porte.
  const document = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  document.setFontSize(14);
  document.text(titre, MARGE, MARGE + 4);
  if (sousTitre) {
    document.setFontSize(9);
    document.text(sousTitre, MARGE, MARGE + 10);
  }

  autoTable(document, {
    head: [entetes],
    body: lignes.map((ligne) => ligne.map(String)),
    startY: MARGE + (sousTitre ? 15 : 9),
    margin: { left: MARGE, right: MARGE },
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fontStyle: "bold" },
  });

  document.save(nomFichier);
}

/**
 * L'export tabulaire, côté navigateur.
 *
 * **Point-virgule et BOM, pas virgule.** Le public est un Excel français :
 * il ouvre un CSV séparé par des virgules sur une seule colonne, et lit un
 * fichier UTF-8 sans BOM en Windows-1252 — « Référence » y devient
 * « RÃ©fÃ©rence ». Les deux choix sont donc des exigences, pas des goûts.
 */

const SEPARATEUR = ";";
const BOM = "﻿";

/** Une cellule, protégée dès qu'elle contient un séparateur, un guillemet ou un saut de ligne. */
function cellule(valeur: string | number): string {
  const texte = String(valeur);
  return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

export function versCsv(lignes: (string | number)[][]): string {
  return BOM + lignes.map((ligne) => ligne.map(cellule).join(SEPARATEUR)).join("\r\n");
}

/** Fait télécharger un texte sous le nom donné. */
export function telechargerCsv(contenu: string, nomFichier: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

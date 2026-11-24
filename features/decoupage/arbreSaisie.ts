/**
 * Règles pures de la vue arborescente de saisie du découpage (TableauDemarrage & EditeurModeleDecoupage).
 *
 * Ce module convertit de façon bidirectionnelle l'arbre interactif (`NoeudArbreSaisie[]`) et les
 * lignes plates attendues par le serveur (`LigneTableau[]` ou `string[][]`), afin de conserver
 * intactes les vérifications serveur (C-1 à C-7) et l'import/export Excel/CSV.
 */

import type { LigneTableau, UniteMesure } from "./types";

export interface DonneesFeuilleSaisie {
  unite: UniteMesure | null;
  quantite: number | null;
  /** En centimes. */
  montant: number | null;
  dateDebut: string | null;
  dateFin: string | null;
}

export interface NoeudArbreSaisie {
  cle: string;
  libelle: string;
  feuille: DonneesFeuilleSaisie;
  enfants: NoeudArbreSaisie[];
}

let compteurNoeud = 0;

export function nouvelleCleNoeud(): string {
  compteurNoeud += 1;
  return `noeud-${Date.now().toString(36)}-${compteurNoeud}`;
}

export function feuilleVide(): DonneesFeuilleSaisie {
  return {
    unite: null,
    quantite: null,
    montant: null,
    dateDebut: null,
    dateFin: null,
  };
}

export function nouveauNoeud(
  libelle = "",
  feuille: DonneesFeuilleSaisie = feuilleVide(),
  cle = nouvelleCleNoeud(),
): NoeudArbreSaisie {
  return {
    cle,
    libelle,
    feuille,
    enfants: [],
  };
}

function cleComparaison(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Construit un arbre interactif depuis des lignes plates (`une ligne = une feuille`).
 * Les lignes entièrement vides sont ignorées.
 */
export function lignesVersArbre(lignes: readonly LigneTableau[]): NoeudArbreSaisie[] {
  const racines: NoeudArbreSaisie[] = [];

  for (const ligne of lignes) {
    const dernierNonVide = ligne.cellules.findLastIndex((cellule) => cellule.trim() !== "");
    if (dernierNonVide === -1) continue;

    let listeCourante = racines;
    for (let niveauIndex = 0; niveauIndex <= dernierNonVide; niveauIndex += 1) {
      const libelle = (ligne.cellules[niveauIndex] ?? "").trim();
      const estDernier = niveauIndex === dernierNonVide;

      if (!estDernier) {
        let parentExistant: NoeudArbreSaisie | undefined;
        if (libelle !== "") {
          const cleTexte = cleComparaison(libelle);
          parentExistant = listeCourante.find(
            (noeud) => noeud.libelle.trim() !== "" && cleComparaison(noeud.libelle) === cleTexte,
          );
        }
        if (!parentExistant) {
          parentExistant = nouveauNoeud(libelle);
          listeCourante.push(parentExistant);
        }
        listeCourante = parentExistant.enfants;
      } else {
        listeCourante.push(
          nouveauNoeud(
            libelle,
            {
              unite: ligne.unite,
              quantite: ligne.quantite,
              montant: ligne.montant,
              dateDebut: ligne.dateDebut,
              dateFin: ligne.dateFin,
            },
            ligne.cle || nouvelleCleNoeud(),
          ),
        );
      }
    }
  }

  return racines;
}

/** Construit un arbre interactif depuis les lignes types d'un modèle (`string[][]`). */
export function cellulesVersArbre(lignes: readonly (readonly string[])[]): NoeudArbreSaisie[] {
  const converties: LigneTableau[] = lignes.map((cellules) => ({
    cle: nouvelleCleNoeud(),
    cellules: [...cellules],
    ...feuilleVide(),
  }));
  return lignesVersArbre(converties);
}

/**
 * Aplatit l'arbre en lignes (`une ligne = une feuille`) pour la vérification et l'enregistrement
 * serveur. Chaque feuille garde sa `cle` comme `LigneTableau.cle`.
 */
export function arbreVersLignes(
  racines: readonly NoeudArbreSaisie[],
  largeur: number,
): LigneTableau[] {
  const largeurEffective = Math.max(1, largeur);
  const resultat: LigneTableau[] = [];

  function parcourir(noeud: NoeudArbreSaisie, chemin: string[]) {
    const prochainChemin = [...chemin, noeud.libelle.trim()];
    if (noeud.enfants.length === 0) {
      const cellules = prochainChemin.slice(0, largeurEffective);
      while (cellules.length < largeurEffective) cellules.push("");
      resultat.push({
        cle: noeud.cle,
        cellules,
        unite: noeud.feuille.unite,
        quantite: noeud.feuille.quantite,
        montant: noeud.feuille.montant,
        dateDebut: noeud.feuille.dateDebut,
        dateFin: noeud.feuille.dateFin,
      });
      return;
    }
    for (const enfant of noeud.enfants) {
      parcourir(enfant, prochainChemin);
    }
  }

  for (const racine of racines) {
    parcourir(racine, []);
  }

  return resultat;
}

/** Aplatit l'arbre en lignes types (`string[][]`) pour l'éditeur de modèles. */
export function arbreVersCellules(
  racines: readonly NoeudArbreSaisie[],
  largeur: number,
): string[][] {
  return arbreVersLignes(racines, largeur).map((ligne) => ligne.cellules);
}

/** Associe chaque `cle` de feuille à son numéro de ligne (base 1) dans `arbreVersLignes`. */
export function indicesFeuillesParCle(racines: readonly NoeudArbreSaisie[]): Map<string, number> {
  const carte = new Map<string, number>();
  let numero = 0;

  function parcourir(noeud: NoeudArbreSaisie) {
    if (noeud.enfants.length === 0) {
      numero += 1;
      carte.set(noeud.cle, numero);
      return;
    }
    for (const enfant of noeud.enfants) {
      parcourir(enfant);
    }
  }

  for (const racine of racines) {
    parcourir(racine);
  }
  return carte;
}

export function ajouterRacineArbre(racines: readonly NoeudArbreSaisie[]): {
  racines: NoeudArbreSaisie[];
  cleCreee: string;
} {
  const cree = nouveauNoeud();
  return { racines: [...racines, cree], cleCreee: cree.cle };
}

export function ajouterEnfantArbre(
  racines: readonly NoeudArbreSaisie[],
  parentCle: string,
): { racines: NoeudArbreSaisie[]; cleCreee: string } {
  const cree = nouveauNoeud();

  function inserer(liste: readonly NoeudArbreSaisie[]): NoeudArbreSaisie[] {
    return liste.map((noeud) => {
      if (noeud.cle === parentCle) {
        return {
          ...noeud,
          feuille: feuilleVide(),
          enfants: [...noeud.enfants, cree],
        };
      }
      if (noeud.enfants.length > 0) {
        return { ...noeud, enfants: inserer(noeud.enfants) };
      }
      return noeud;
    });
  }

  return { racines: inserer(racines), cleCreee: cree.cle };
}

export function modifierNoeudArbre(
  racines: readonly NoeudArbreSaisie[],
  cle: string,
  maj: (noeud: NoeudArbreSaisie) => NoeudArbreSaisie,
): NoeudArbreSaisie[] {
  return racines.map((noeud) => {
    if (noeud.cle === cle) return maj(noeud);
    if (noeud.enfants.length > 0) {
      return { ...noeud, enfants: modifierNoeudArbre(noeud.enfants, cle, maj) };
    }
    return noeud;
  });
}

export function retirerNoeudArbre(
  racines: readonly NoeudArbreSaisie[],
  cle: string,
): NoeudArbreSaisie[] {
  return racines
    .filter((noeud) => noeud.cle !== cle)
    .map((noeud) =>
      noeud.enfants.length > 0 ? { ...noeud, enfants: retirerNoeudArbre(noeud.enfants, cle) } : noeud,
    );
}

export function aNoeudSansLibelle(racines: readonly NoeudArbreSaisie[]): boolean {
  return racines.some(
    (noeud) => noeud.libelle.trim() === "" || aNoeudSansLibelle(noeud.enfants),
  );
}

export function compterNoeudsArbre(racines: readonly NoeudArbreSaisie[]): {
  cases: number;
  feuilles: number;
} {
  let cases = 0;
  let feuilles = 0;

  function parcourir(noeud: NoeudArbreSaisie) {
    cases += 1;
    if (noeud.enfants.length === 0) {
      feuilles += 1;
      return;
    }
    for (const enfant of noeud.enfants) parcourir(enfant);
  }

  for (const racine of racines) parcourir(racine);
  return { cases, feuilles };
}

export function collecterClesParents(racines: readonly NoeudArbreSaisie[]): string[] {
  const cles: string[] = [];
  function parcourir(noeud: NoeudArbreSaisie) {
    if (noeud.enfants.length > 0) {
      cles.push(noeud.cle);
      for (const enfant of noeud.enfants) parcourir(enfant);
    }
  }
  for (const racine of racines) parcourir(racine);
  return cles;
}

export function resumeBranche(noeud: NoeudArbreSaisie): {
  feuilles: number;
  montantTotal: number;
  aMontant: boolean;
  dateDebutMin: string | null;
  dateFinMax: string | null;
} {
  let feuilles = 0;
  let montantTotal = 0;
  let aMontant = false;
  let dateDebutMin: string | null = null;
  let dateFinMax: string | null = null;

  function parcourir(courant: NoeudArbreSaisie) {
    if (courant.enfants.length === 0) {
      feuilles += 1;
      if (courant.feuille.montant !== null) {
        montantTotal += courant.feuille.montant;
        aMontant = true;
      }
      if (courant.feuille.dateDebut && (!dateDebutMin || courant.feuille.dateDebut < dateDebutMin)) {
        dateDebutMin = courant.feuille.dateDebut;
      }
      if (courant.feuille.dateFin && (!dateFinMax || courant.feuille.dateFin > dateFinMax)) {
        dateFinMax = courant.feuille.dateFin;
      }
      return;
    }
    for (const enfant of courant.enfants) parcourir(enfant);
  }

  parcourir(noeud);
  return { feuilles, montantTotal, aMontant, dateDebutMin, dateFinMax };
}

export function totalMontantArbre(racines: readonly NoeudArbreSaisie[]): number {
  return racines.reduce((somme, racine) => somme + resumeBranche(racine).montantTotal, 0);
}

export function valeursSaisiesAuNiveau(
  racines: readonly NoeudArbreSaisie[],
  profondeurCible: number,
  exclureCle?: string,
): string[] {
  const vues = new Set<string>();
  const resultat: string[] = [];

  function parcourir(noeud: NoeudArbreSaisie, profondeur: number) {
    if (profondeur === profondeurCible) {
      if (noeud.cle !== exclureCle) {
        const texte = noeud.libelle.trim();
        if (texte) {
          const cle = cleComparaison(texte);
          if (!vues.has(cle)) {
            vues.add(cle);
            resultat.push(texte);
          }
        }
      }
      return;
    }
    for (const enfant of noeud.enfants) {
      parcourir(enfant, profondeur + 1);
    }
  }

  for (const racine of racines) {
    parcourir(racine, 0);
  }
  return resultat;
}

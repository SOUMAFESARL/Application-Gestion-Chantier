/**
 * Utilitaires fiscaux et conversion des montants aux normes OHADA / SYSCOHADA.
 */

export interface TauxTVAPays {
  code: string;
  nomPays: string;
  taux: number; // en pourcentage (ex: 18 pour 18%)
  zone: "UEMOA" | "CEMAC" | "AUTRE";
  libelleTaxe: string;
}

/**
 * Table des taux normaux de TVA en vigueur dans l'espace OHADA.
 */
export const TAUX_TVA_OHADA: Record<string, TauxTVAPays> = {
  CI: { code: "CI", nomPays: "Côte d'Ivoire", taux: 18.0, zone: "UEMOA", libelleTaxe: "TVA 18% (Côte d'Ivoire)" },
  SN: { code: "SN", nomPays: "Sénégal", taux: 18.0, zone: "UEMOA", libelleTaxe: "TVA 18% (Sénégal)" },
  BF: { code: "BF", nomPays: "Burkina Faso", taux: 18.0, zone: "UEMOA", libelleTaxe: "TVA 18% (Burkina Faso)" },
  ML: { code: "ML", nomPays: "Mali", taux: 18.0, zone: "UEMOA", libelleTaxe: "TVA 18% (Mali)" },
  BJ: { code: "BJ", nomPays: "Bénin", taux: 18.0, zone: "UEMOA", libelleTaxe: "TVA 18% (Bénin)" },
  TG: { code: "TG", nomPays: "Togo", taux: 18.0, zone: "UEMOA", libelleTaxe: "TVA 18% (Togo)" },
  NE: { code: "NE", nomPays: "Niger", taux: 18.0, zone: "UEMOA", libelleTaxe: "TVA 18% (Niger)" },
  GW: { code: "GW", nomPays: "Guinée-Bissau", taux: 18.0, zone: "UEMOA", libelleTaxe: "TVA 18% (Guinée-Bissau)" },
  CM: { code: "CM", nomPays: "Cameroun", taux: 19.25, zone: "CEMAC", libelleTaxe: "TVA 19,25% (Cameroun)" },
  GA: { code: "GA", nomPays: "Gabon", taux: 18.0, zone: "CEMAC", libelleTaxe: "TVA 18% (Gabon)" },
  CG: { code: "CG", nomPays: "Congo", taux: 18.9, zone: "CEMAC", libelleTaxe: "TVA 18,9% (Congo)" },
  TD: { code: "TD", nomPays: "Tchad", taux: 18.0, zone: "CEMAC", libelleTaxe: "TVA 18% (Tchad)" },
  GN: { code: "GN", nomPays: "Guinée", taux: 18.0, zone: "AUTRE", libelleTaxe: "TVA 18% (Guinée)" },
  CD: { code: "CD", nomPays: "RDC", taux: 16.0, zone: "AUTRE", libelleTaxe: "TVA 16% (RDC)" },
};

/**
 * Récupère le taux de TVA applicable selon le code pays ISO (2 lettres).
 * Par défaut : Côte d'Ivoire (18%).
 */
export function obtenirTauxTVA(codePays?: string | null): TauxTVAPays {
  if (!codePays) return TAUX_TVA_OHADA.CI;
  const paysUpper = codePays.toUpperCase();
  return TAUX_TVA_OHADA[paysUpper] || TAUX_TVA_OHADA.CI;
}

// ---------------------------------------------------------------------------
// Conversion d'un montant numérique en toutes lettres (Français / OHADA)
// ---------------------------------------------------------------------------

const UNITES = [
  "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept",
  "dix-huit", "dix-neuf",
];

const DIZAINES = [
  "", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix",
  "quatre-vingt", "quatre-vingt-dix",
];

function convertirMoinsDeMille(n: number): string {
  if (n === 0) return "";

  const morceaux: string[] = [];

  const centaines = Math.floor(n / 100);
  const reste = n % 100;

  if (centaines > 0) {
    if (centaines === 1) {
      morceaux.push("cent");
    } else {
      morceaux.push(`${UNITES[centaines]} cent${reste === 0 ? "s" : ""}`);
    }
  }

  if (reste > 0) {
    if (reste < 20) {
      morceaux.push(UNITES[reste]);
    } else {
      const dizaine = Math.floor(reste / 10);
      const unite = reste % 10;

      if (dizaine === 7) {
        morceaux.push(`soixante-${unite === 1 ? "et-onze" : UNITES[10 + unite]}`);
      } else if (dizaine === 9) {
        morceaux.push(`quatre-vingt-${UNITES[10 + unite]}`);
      } else {
        if (unite === 1 && dizaine < 8) {
          morceaux.push(`${DIZAINES[dizaine]}-et-un`);
        } else if (unite === 0) {
          morceaux.push(dizaine === 8 ? "quatre-vingts" : DIZAINES[dizaine]);
        } else {
          morceaux.push(`${DIZAINES[dizaine]}-${UNITES[unite]}`);
        }
      }
    }
  }

  return morceaux.join(" ");
}

/**
 * Convertit un entier (en FCFA) en toutes lettres.
 * Exemple: 49000 -> "quarante-neuf mille Francs CFA"
 */
export function nombreEnLettres(n: number): string {
  if (n === 0) return "zéro Franc CFA";

  const positif = Math.abs(Math.round(n));
  if (positif === 0) return "zéro Franc CFA";

  const milliards = Math.floor(positif / 1_000_000_000);
  const millions = Math.floor((positif % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((positif % 1_000_000) / 1_000);
  const unites = positif % 1_000;

  const parties: string[] = [];

  if (milliards > 0) {
    if (milliards === 1) {
      parties.push("un milliard");
    } else {
      parties.push(`${convertirMoinsDeMille(milliards)} milliards`);
    }
  }

  if (millions > 0) {
    if (millions === 1) {
      parties.push("un million");
    } else {
      parties.push(`${convertirMoinsDeMille(millions)} millions`);
    }
  }

  if (milliers > 0) {
    if (milliers === 1) {
      parties.push("mille");
    } else {
      parties.push(`${convertirMoinsDeMille(milliers)} mille`);
    }
  }

  if (unites > 0) {
    parties.push(convertirMoinsDeMille(unites));
  }

  const texte = parties.join(" ").trim();
  // Mettre la première lettre en majuscule
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * Formule juridique de clôture de facture OHADA.
 * Ex: "Arrêtée la présente facture à la somme de : Quarante-neuf mille Francs CFA TTC."
 */
export function arreteFactureEnLettres(montantTTC: number): string {
  const montantLettres = nombreEnLettres(montantTTC);
  return `Arrêtée la présente facture à la somme de : ${montantLettres} Francs CFA TTC.`;
}

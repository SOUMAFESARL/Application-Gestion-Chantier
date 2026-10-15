import { texte } from "@/i18n/horsReact";
import {
  normaliserTelephone,
  telephoneInternationalValide,
} from "@/features/referentiels/telephone";
import type {
  DonneesEntreprise,
  LibelleTelephone,
  TelephoneEntreprise,
} from "./api";

export const TELEPHONES_MAX = 5;

export const LIBELLES_TELEPHONE: LibelleTelephone[] = [
  "MOBILE",
  "FIXE",
  "WHATSAPP",
  "STANDARD",
  "COMPTABILITE",
  "AUTRE",
];

/**
 * La liste de départ : celle du serveur ; à défaut l'ancien numéro seul ; à défaut une ligne vide principale.
 */
export function telephonesInitiaux(
  entreprise: DonneesEntreprise,
): TelephoneEntreprise[] {
  if (entreprise.telephones && entreprise.telephones.length > 0) {
    const liste = entreprise.telephones.map((t) => ({
      id: t.id ?? null,
      libelle: t.libelle,
      numero: t.numero || "",
      principal: Boolean(t.principal),
    }));
    if (!liste.some((t) => t.principal)) {
      liste[0].principal = true;
    }
    return liste;
  }

  if (entreprise.telephone_contact && entreprise.telephone_contact.trim()) {
    return [
      {
        id: null,
        libelle: "MOBILE",
        numero: entreprise.telephone_contact.trim(),
        principal: true,
      },
    ];
  }

  return [
    {
      id: null,
      libelle: "MOBILE",
      numero: "",
      principal: true,
    },
  ];
}

export function peutAjouterTelephone(liste: TelephoneEntreprise[]): boolean {
  return liste.length < TELEPHONES_MAX;
}

/**
 * Retirer le principal fait passer le premier restant principal.
 * On ne retire pas le dernier numéro.
 */
export function retirerTelephone(
  liste: TelephoneEntreprise[],
  index: number,
): TelephoneEntreprise[] {
  if (liste.length <= 1) return liste;
  const nouvelleListe = liste.filter((_, i) => i !== index);
  if (!nouvelleListe.some((t) => t.principal)) {
    nouvelleListe[0] = { ...nouvelleListe[0], principal: true };
  }
  return nouvelleListe;
}

export function definirPrincipal(
  liste: TelephoneEntreprise[],
  index: number,
): TelephoneEntreprise[] {
  return liste.map((t, i) => ({
    ...t,
    principal: i === index,
  }));
}

/**
 * Les erreurs, avant envoi, avec les mêmes règles que le serveur.
 * Clés : `telephones` (règle de liste) et `telephones.<index>.numero` (une ligne).
 * Une ligne vide ajoutée puis laissée vide est une erreur (« Saisissez ce numéro, ou retirez la ligne. »),
 * pas un numéro ignoré.
 */
export function erreursTelephones(
  liste: TelephoneEntreprise[],
  paysDefaut: string,
): Record<string, string> {
  const erreurs: Record<string, string> = {};

  if (liste.length === 0) {
    erreurs.telephones = texte("configuration.telephones.erreurAucun");
    return erreurs;
  }

  if (liste.length > TELEPHONES_MAX) {
    erreurs.telephones = texte("configuration.telephones.maximum");
  }

  const nbPrincipaux = liste.filter((t) => t.principal).length;
  if (nbPrincipaux !== 1) {
    erreurs.telephones = texte("configuration.telephones.erreurPrincipal");
  }

  const numerosVus = new Map<string, number>();

  liste.forEach((t, i) => {
    const brut = (t.numero || "").trim();
    if (!brut) {
      erreurs[`telephones.${i}.numero`] = texte(
        "configuration.telephones.erreurVide",
      );
      return;
    }

    if (!telephoneInternationalValide(brut, paysDefaut)) {
      erreurs[`telephones.${i}.numero`] = texte(
        "configuration.telephones.erreurFormat",
      );
      return;
    }

    const normalise = normaliserTelephone(brut);
    if (numerosVus.has(normalise)) {
      erreurs[`telephones.${i}.numero`] = texte(
        "configuration.telephones.erreurDoublon",
      );
    } else {
      numerosVus.set(normalise, i);
    }
  });

  return erreurs;
}

/**
 * Traduit `erreur.details.telephones` du serveur (chaîne ou tableau, §2) vers les mêmes clés.
 */
export function erreursTelephonesServeur(
  details: Record<string, unknown>,
): Record<string, string> {
  const erreurs: Record<string, string> = {};
  if (!details || !details.telephones) return erreurs;

  const brut = details.telephones;

  if (typeof brut === "string") {
    erreurs.telephones = brut;
    return erreurs;
  }

  if (Array.isArray(brut)) {
    // Si c'est un tableau de chaînes au niveau global :
    if (brut.length > 0 && typeof brut[0] === "string") {
      erreurs.telephones = brut.join(" ");
      return erreurs;
    }

    // Si c'est un tableau aligné sur les éléments :
    brut.forEach((elem, index) => {
      if (elem && typeof elem === "object") {
        const item = elem as Record<string, unknown>;
        if (item.numero) {
          erreurs[`telephones.${index}.numero`] = Array.isArray(item.numero)
            ? String(item.numero[0])
            : String(item.numero);
        }
        if (item.libelle) {
          erreurs[`telephones.${index}.libelle`] = Array.isArray(item.libelle)
            ? String(item.libelle[0])
            : String(item.libelle);
        }
      }
    });
  }

  return erreurs;
}

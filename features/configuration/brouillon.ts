"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Brouillon de l'étape en cours — T-022 §7.1.
 *
 * **Deux natures de sauvegarde, deux supports.** Une étape *validée* est
 * persistée en base sous forme de vrais objets : l'entreprise est mise à jour,
 * le projet est créé, les invitations partent. Une étape *en cours*, à moitié
 * remplie, n'a aucune existence métier — un projet sans budget ni dates n'est
 * pas un projet. Lui donner une ligne en base obligerait chaque liste, chaque
 * compteur et chaque export à se souvenir de l'exclure, et il s'en trouverait
 * toujours un pour l'oublier.
 *
 * Le support est celui que la spécification de session web §7.1 a déjà retenu,
 * avec sa clé : `ccd.brouillon.{schema}.{user_id}.{route}`. Une seule règle de
 * brouillon dans le produit, pas deux — et l'identifiant d'utilisateur dans la
 * clé évite qu'un poste partagé de bureau BTP rende la saisie du premier au
 * second.
 *
 * **Conséquence assumée** : la saisie en cours ne suit pas d'un appareil à
 * l'autre. Quelqu'un qui remplit l'étape 2 sur son téléphone et rouvre le
 * wizard sur son ordinateur retrouve l'étape 1 validée et l'étape 2 vide.
 * C'est ce que la modale d'abandon annonce, au mot près.
 */

const PREFIXE = "ccd.brouillon";

function cle(schema: string, utilisateur: string, etape: string): string {
  return `${PREFIXE}.${schema}.${utilisateur}.configuration.${etape}`;
}

export function lireBrouillon<T>(
  schema: string,
  utilisateur: string,
  etape: string,
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.sessionStorage.getItem(cle(schema, utilisateur, etape));
    return brut ? (JSON.parse(brut) as T) : null;
  } catch {
    return null;
  }
}

export function ecrireBrouillon(
  schema: string,
  utilisateur: string,
  etape: string,
  valeur: unknown,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(cle(schema, utilisateur, etape), JSON.stringify(valeur));
  } catch {
    // Quota atteint ou navigation privée : le brouillon est un confort, pas
    // une promesse. Son échec ne doit jamais empêcher la saisie.
  }
}

export function effacerBrouillon(schema: string, utilisateur: string, etape: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(cle(schema, utilisateur, etape));
  } catch {
    // sans effet
  }
}

/** Vrai si l'étape courante porte une saisie non validée — décide de la modale d'abandon. */
export function brouillonNonVide(valeur: Record<string, unknown> | null): boolean {
  if (!valeur) return false;
  return Object.values(valeur).some(
    (v) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
  );
}

// ---------------------------------------------------------------------------
// Le hook de restauration
// ---------------------------------------------------------------------------

/**
 * Restaure le brouillon d'une étape et le tient à jour à chaque frappe.
 *
 * **Pourquoi un effet, et pourquoi l'exception au lint.** `sessionStorage`
 * n'existe pas au rendu serveur : un initialiseur paresseux renverrait `null`
 * côté serveur et la valeur stockée côté client, ce qui produit un écart
 * d'hydratation sur des champs de formulaire. La lecture au montage est donc
 * exactement le cas que la règle `set-state-in-effect` décrit comme légitime —
 * « synchroniser React avec un système externe » —, mais qu'elle ne sait pas
 * distinguer.
 *
 * L'exception est posée **une fois ici**, pas trois fois dans les étapes.
 */
export function useBrouillon<T>(
  schema: string,
  utilisateur: string,
  etape: string,
  initial: T,
): [T, (valeur: T) => void, () => void] {
  const [valeur, setValeur] = useState<T>(initial);

  useEffect(() => {
    const stocke = lireBrouillon<T>(schema, utilisateur, etape);
    if (stocke !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- voir l'encadré
      setValeur(stocke);
    }
  }, [schema, utilisateur, etape]);

  const enregistrer = useCallback(
    (suite: T) => {
      setValeur(suite);
      ecrireBrouillon(schema, utilisateur, etape, suite);
    },
    [schema, utilisateur, etape],
  );

  const oublier = useCallback(() => {
    effacerBrouillon(schema, utilisateur, etape);
  }, [schema, utilisateur, etape]);

  return [valeur, enregistrer, oublier];
}

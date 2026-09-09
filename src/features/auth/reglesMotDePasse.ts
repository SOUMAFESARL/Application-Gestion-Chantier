"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

/**
 * Les règles de complexité, **servies par le serveur** — contrat §6.3.
 *
 * Les évaluer côté client est indispensable : un aller-retour par caractère est
 * exclu sur une liaison 3G. Mais deux implémentations d'une même règle
 * divergent toujours, et c'est déjà arrivé ici — la maquette M6 affichait
 * quatre coches quand le serveur n'en contrôlait qu'une (défaut D-4).
 *
 * Les motifs viennent donc de `GET /referentiels/regles-mot-de-passe/`, et
 * **un seul endroit reste à modifier** le jour où la politique change.
 *
 * **Le contrôle reste un confort, pas une sécurité.** Un mot de passe faible
 * envoyé directement à l'API est refusé par son `400`, que l'écran ait allumé
 * ses coches ou non. C'est ce qui permet de ne pas bloquer l'utilisateur quand
 * les règles n'ont pas pu être chargées : mieux vaut un formulaire qui part et
 * un refus explicite du serveur qu'un bouton grisé sans explication.
 */

/** Ce que le référentiel renvoie. Les libellés sont traduits ici, pas servis. */
interface RegleServie {
  code: string;
  motif: string;
}

export type CodeRegleMotDePasse =
  | "longueur"
  | "majuscule"
  | "chiffre"
  | "special"
  | "identiques";

export interface RegleMotDePasse {
  code: CodeRegleMotDePasse;
  satisfaite: boolean;
}

/** Le code du serveur est en capitales ; les clés de traduction en minuscules. */
const CODES: Record<string, CodeRegleMotDePasse> = {
  LONGUEUR: "longueur",
  MAJUSCULE: "majuscule",
  CHIFFRE: "chiffre",
  SPECIAL: "special",
};

/**
 * La cinquième coche de M6 **n'est pas servie, et ne peut pas l'être** : la
 * double saisie est une vérification d'interface. Le serveur ne reçoit qu'une
 * valeur — il n'a rien à comparer (contrat §5.1).
 */
function reglesDeSaisie(
  motDePasse: string,
  confirmation: string,
): RegleMotDePasse {
  return {
    code: "identiques",
    satisfaite: motDePasse.length > 0 && motDePasse === confirmation,
  };
}

export function useReglesMotDePasse(motDePasse: string, confirmation: string) {
  const [servies, setServies] = useState<RegleServie[] | null>(null);

  useEffect(() => {
    let vivant = true;
    api
      .lire<{ regles: RegleServie[] }>("/referentiels/regles-mot-de-passe/")
      .then((reponse) => {
        if (vivant) setServies(reponse.regles);
      })
      .catch(() => {
        // Référentiel injoignable : on n'affiche aucune coche plutôt que d'en
        // afficher de fausses, et l'on ne bloque pas la saisie.
        if (vivant) setServies([]);
      });
    return () => {
      vivant = false;
    };
  }, []);

  const chargees = servies !== null && servies.length > 0;

  const regles: RegleMotDePasse[] = chargees
    ? [
        ...servies
          .filter((r) => CODES[r.code])
          .map((r) => ({
            code: CODES[r.code],
            // `u` : `\p{Lu}` et `\p{Nd}` ne valent que sous ce drapeau, et
            // c'est lui qui fait qu'`É` compte comme une majuscule.
            satisfaite: new RegExp(r.motif, "u").test(motDePasse),
          })),
        reglesDeSaisie(motDePasse, confirmation),
      ]
    : [];

  // Sans règles chargées, seule la double saisie est vérifiable — et le
  // serveur reste juge du reste.
  const complet = chargees
    ? regles.every((r) => r.satisfaite)
    : reglesDeSaisie(motDePasse, confirmation).satisfaite;

  return { regles, complet, chargees };
}

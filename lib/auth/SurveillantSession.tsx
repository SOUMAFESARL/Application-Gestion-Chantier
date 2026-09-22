"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { ecrireProfilLocal } from "@/features/auth/api";
import { demarrerRenouvellementAuto, effacerJetons, EVENEMENT_SESSION_EXPIREE } from "@/lib/api";
import { sauvegarderBrouillons } from "@/lib/auth/session";

const ECRAN_CONNEXION = "/connexion";

/**
 * Chemins ou une session d'entreprise finie ne change rien.
 *
 * Les quatre premiers sont publics. `/admin` est d'une autre nature : c'est
 * **l'espace de l'administrateur de la plateforme**, qui a sa propre session,
 * ses propres jetons et son propre ecran de connexion. Sans cette ligne, une
 * session d'entreprise expiree dans un autre onglet renverrait un
 * administrateur en plein travail vers `/connexion` — l'ecran de connexion des
 * entreprises, ou son compte n'existe meme pas.
 */
const CHEMINS_EXEMPTES = [
  "/connexion",
  "/inscription",
  "/activation",
  "/mot-de-passe",
  "/admin",
];

/**
 * Surveillant de session.
 *
 * Il ne compte plus rien. Les horloges d'inactivite et de plafond ont ete
 * retirees, et avec elles la modale d'avertissement : ce composant **maintient**
 * la session au lieu de la fermer, en renouvelant le jeton d'acces avant son
 * echeance, au retour de l'onglet et au retour du reseau.
 *
 * Il ne reste qu'une porte de sortie, et elle vient du serveur : quand celui-ci
 * refuse explicitement le jeton de renouvellement, la session est reellement
 * finie — mot de passe change, compte desactive, jeton revoque. On sauvegarde
 * alors la saisie en cours avant de renvoyer vers la connexion.
 */
export function SurveillantSession() {
  const chemin = usePathname();

  // Renouvellement proactif : tant que le serveur l'accepte, la session dure.
  useEffect(() => demarrerRenouvellementAuto(), []);

  useEffect(() => {
    const estSurCheminExempte = CHEMINS_EXEMPTES.some((prefixe) => chemin?.startsWith(prefixe));

    function surSessionExpiree() {
      if (estSurCheminExempte) return;
      sauvegarderBrouillons();
      effacerJetons();
      ecrireProfilLocal(null);
      window.location.replace(`${ECRAN_CONNEXION}?session=expiree`);
    }

    window.addEventListener(EVENEMENT_SESSION_EXPIREE, surSessionExpiree);
    return () => window.removeEventListener(EVENEMENT_SESSION_EXPIREE, surSessionExpiree);
  }, [chemin]);

  return null;
}

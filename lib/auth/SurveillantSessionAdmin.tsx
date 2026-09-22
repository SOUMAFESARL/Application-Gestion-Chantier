"use client";

import { useEffect } from "react";

import {
  demarrerRenouvellementAuto,
  effacerJetons,
  EVENEMENT_SESSION_ADMIN_EXPIREE,
} from "@/lib/api";
import { ecrireProfilLocal } from "@/features/administration/adaptateur";

const ECRAN_CONNEXION_ADMIN = "/admin/connexion";

/**
 * Le pendant de `SurveillantSession` pour l'espace d'administration.
 *
 * **Un second surveillant plutot qu'un parametre sur le premier**, parce que
 * les deux especes de session ne se recoupent en rien : elles n'ont ni les
 * memes jetons, ni le meme endpoint de renouvellement, ni le meme ecran de
 * repli. Le seul comportement commun — renouveler avant l'echeance, ne se
 * fermer que sur un refus explicite du serveur — est deja dans `lib/api`, et
 * c'est la qu'il est partage.
 *
 * Il ne sauvegarde pas de brouillon : le back-office n'a pas de formulaire
 * long, et `lib/auth/session.ts` ne connait que les champs de l'espace
 * entreprise.
 *
 * Il est monte par le layout de `/admin`, et non par `Providers` : sur les
 * ecrans d'entreprise, il n'a rien a surveiller.
 */
export function SurveillantSessionAdmin() {
  // Renouvellement proactif de la session d'administration, et d'elle seule.
  useEffect(() => demarrerRenouvellementAuto("administration"), []);

  useEffect(() => {
    function surSessionExpiree() {
      effacerJetons("administration");
      ecrireProfilLocal(null);
      window.location.replace(`${ECRAN_CONNEXION_ADMIN}?session=expiree`);
    }

    window.addEventListener(EVENEMENT_SESSION_ADMIN_EXPIREE, surSessionExpiree);
    return () =>
      window.removeEventListener(EVENEMENT_SESSION_ADMIN_EXPIREE, surSessionExpiree);
  }, []);

  return null;
}

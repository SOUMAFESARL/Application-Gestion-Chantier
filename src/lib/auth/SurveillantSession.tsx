"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ModalSession } from "@/components/auth";
import { ecrireProfilLocal, seDeconnecter } from "@/features/auth/api";
import { effacerJetons, EVENEMENT_SESSION_EXPIREE, sessionOuverte } from "@/lib/api";
import {
  prolonger,
  sauvegarderBrouillons,
  useSession,
} from "@/lib/auth/session";


const ECRAN_CONNEXION = "/connexion";

// Chemins publics exemptés de la surveillance de session active
const CHEMINS_EXEMPTES = [
  "/connexion",
  "/inscription",
  "/activation",
  "/mot-de-passe",
];

/**
 * Surveillant de session web — DEV-3.
 *
 * Tient les horloges, affiche la modale d'avertissement M5 (15 min et 5 min),
 * permet la prolongation transparente, sauvegarde automatiquement les formulaires
 * en cours en cas d'expiration et redirige vers la connexion.
 */
export function SurveillantSession() {
  const router = useRouter();
  const chemin = usePathname();
  const session = useSession();

  const [estMonte, setEstMonte] = useState(false);

  useEffect(() => {
    setEstMonte(true);
  }, []);

  const estSurCheminExempte = CHEMINS_EXEMPTES.some((prefixe) =>
    chemin?.startsWith(prefixe)
  );

  const gererDeconnexion = useCallback(async () => {
    sauvegarderBrouillons();
    await seDeconnecter();
    router.replace(ECRAN_CONNEXION);
  }, [router]);

  const gererReconnexion = useCallback(() => {
    sauvegarderBrouillons();
    effacerJetons();
    ecrireProfilLocal(null);
    window.location.replace(`${ECRAN_CONNEXION}?session=expiree`);
  }, []);

  const gererProlongation = useCallback(async () => {
    return prolonger();
  }, []);

  // Écoute de l'événement bas niveau HTTP (échec de renouvellement d'API 401)
  useEffect(() => {
    function surSessionExpiree() {
      if (estSurCheminExempte) return;
      sauvegarderBrouillons();
      effacerJetons();
      ecrireProfilLocal(null);
      window.location.replace(`${ECRAN_CONNEXION}?session=expiree`);
    }

    window.addEventListener(EVENEMENT_SESSION_EXPIREE, surSessionExpiree);
    return () =>
      window.removeEventListener(EVENEMENT_SESSION_EXPIREE, surSessionExpiree);
  }, [estSurCheminExempte]);

  // Sauvegarde préventive, destruction des jetons et redirection obligatoire dès que l'horloge expire
  useEffect(() => {
    if (
      (session.etat === "expiree" || session.etat === "fin_de_session") &&
      !estSurCheminExempte
    ) {
      sauvegarderBrouillons();
      effacerJetons();
      ecrireProfilLocal(null);
      window.location.replace(`${ECRAN_CONNEXION}?session=expiree`);
    }
  }, [session.etat, estSurCheminExempte]);

  // Ne pas afficher la modale avant le montage client ou sur les écrans d'authentification publique
  if (!estMonte || estSurCheminExempte || !sessionOuverte()) {
    return null;
  }

  return (
    <ModalSession
      session={session}
      onProlonger={gererProlongation}
      onDeconnecter={gererDeconnexion}
      onReconnecter={gererReconnexion}
    />
  );
}

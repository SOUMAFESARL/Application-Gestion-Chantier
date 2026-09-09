"use client";

import { EnvelopeSimple, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { AccrocheAuth, BlocCentre, TitreAuth } from "@/components/layout/CarteAuth";
import { Alerte, Bouton, Champ } from "@/components/ui";
import { demanderReinitialisation } from "@/features/auth/api";
import { ErreurApi } from "@/lib/api";

import styles from "./page.module.css";

/**
 * Écran « Mot de passe oublié » — maquette M6, écrans 1 et 2.
 *
 * Contrat : `contrat_reinitialisation_mot_de_passe_CCD_Digital.md` §3.
 *
 * **Le serveur répond `202`, que l'adresse existe ou non.** L'écran ne peut
 * donc pas dire « adresse inconnue », et il ne cherche pas à le cacher : il
 * l'écrit. C'est la maquette elle-même qui pose la doctrine — « nous ne
 * confirmons pas si un compte existe ou non » —, et c'est ce qui transforme une
 * réponse frustrante en réponse compréhensible (Socle §5.2, « indiquer toujours
 * quoi faire »).
 */

/** Le même verrou de renvoi que M6 et M8 — un geste, un délai. */
const SECONDES_AVANT_RENVOI = 60;

type Etat =
  | { nom: "saisie" }
  | { nom: "chargement" }
  | { nom: "envoye"; email: string }
  | { nom: "erreur"; message: string; reference: string | null };

export function FormulaireOubli() {
  const t = useTranslations("motDePasseOublie");

  const [email, setEmail] = useState("");
  const [erreurEmail, setErreurEmail] = useState<string | null>(null);
  const [etat, setEtat] = useState<Etat>({ nom: "saisie" });
  const [attenteRenvoi, setAttenteRenvoi] = useState(0);

  // Le verrou s'écoule tout seul : sans cela le bouton reste désactivé
  // jusqu'à un rechargement de page.
  useEffect(() => {
    if (attenteRenvoi <= 0) return;
    const minuterie = setTimeout(() => setAttenteRenvoi((n) => n - 1), 1000);
    return () => clearTimeout(minuterie);
  }, [attenteRenvoi]);

  async function envoyer(adresse: string) {
    setEtat({ nom: "chargement" });
    try {
      await demanderReinitialisation(adresse);
      setEtat({ nom: "envoye", email: adresse });
      setAttenteRenvoi(SECONDES_AVANT_RENVOI);
    } catch (cause) {
      const erreur = cause as ErreurApi;
      setEtat({
        nom: "erreur",
        message: erreur.message ?? t("erreurTitre"),
        reference: erreur.traceId ?? null,
      });
    }
  }

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    const adresse = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) {
      setErreurEmail(t("emailInvalide"));
      return;
    }
    setErreurEmail(null);
    void envoyer(adresse);
  }

  // -------------------------------------------------------------------------
  // M6 écran 2 — « Vérifiez votre boîte mail »
  // -------------------------------------------------------------------------
  if (etat.nom === "envoye") {
    return (
      <BlocCentre pastille={<EnvelopeSimple size={32} weight="regular" />}>
        <TitreAuth>{t("confirmationTitre")}</TitreAuth>
        <AccrocheAuth>
          {t.rich("confirmationCorps", {
            fort: (morceaux) => <strong>{morceaux}</strong>,
          })}
        </AccrocheAuth>

        {/* Dire pourquoi la réponse est vague vaut mieux que la laisser vague. */}
        <Alerte type="information">{t("confidentialite")}</Alerte>

        <div className={styles.actions}>
          <Bouton
            variante="secondaire"
            pleineLargeur
            disabled={attenteRenvoi > 0}
            onClick={() => void envoyer(etat.email)}
          >
            {attenteRenvoi > 0
              ? t("renvoyerAttente", { secondes: attenteRenvoi })
              : t("renvoyer")}
          </Bouton>

          <Link className={styles.lienDiscret} href="/connexion">
            {t("retourConnexion")}
          </Link>
        </div>
      </BlocCentre>
    );
  }

  // -------------------------------------------------------------------------
  // Erreur réseau ou serveur
  // -------------------------------------------------------------------------
  if (etat.nom === "erreur") {
    return (
      <BlocCentre ton="avertissement" pastille={<WarningCircle size={32} />}>
        <TitreAuth>{t("erreurTitre")}</TitreAuth>
        <Alerte type="erreur">
          {etat.message}
          {etat.reference && (
            <span className={styles.reference}>
              {t("reference", { reference: etat.reference })}
            </span>
          )}
        </Alerte>
        <div className={styles.actions}>
          <Bouton pleineLargeur onClick={() => setEtat({ nom: "saisie" })}>
            {t("reessayer")}
          </Bouton>
        </div>
      </BlocCentre>
    );
  }

  // -------------------------------------------------------------------------
  // M6 écran 1 — la demande
  // -------------------------------------------------------------------------
  return (
    <form onSubmit={soumettre} noValidate>
      <TitreAuth>{t("titre")}</TitreAuth>
      <AccrocheAuth>{t("accroche")}</AccrocheAuth>

      <Champ
        libelle={t("champEmail")}
        type="email"
        required
        autoComplete="email"
        placeholder={t("champEmailExemple")}
        value={email}
        erreur={erreurEmail ?? undefined}
        disabled={etat.nom === "chargement"}
        onChange={(e) => {
          setEmail(e.target.value);
          if (erreurEmail) setErreurEmail(null);
        }}
      />

      <div className={styles.actions}>
        <Bouton type="submit" pleineLargeur enCours={etat.nom === "chargement"}>
          {t("envoyer")}
        </Bouton>

        <Link className={styles.lienDiscret} href="/connexion">
          {t("retourConnexion")}
        </Link>
      </div>
    </form>
  );
}

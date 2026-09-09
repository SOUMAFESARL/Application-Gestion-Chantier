"use client";

import {
  ArrowSquareOut,
  EnvelopeSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  AccrocheAuth,
  BlocCentre,
  TitreAuth,
} from "@/components/layout/CarteAuth";
import { Alerte, Bouton, Champ } from "@/components/ui";
import { ErreurApi } from "@/lib/api";
import { deriverSlug } from "@/lib/api/simulation";
import {
  PAYS,
  deposerInscription,
  renvoyerEmail,
} from "@/features/inscription/api";

import styles from "./page.module.css";
import { nomDePays } from "@/lib/format";

/** Le délai que M6 applique déjà au renvoi d'un email — même geste, même verrou (60 s). */
const SECONDES_AVANT_RENVOI = 60;

type Etat =
  | { nom: "saisie" }
  | { nom: "chargement" }
  | { nom: "envoye"; email: string }
  | { nom: "erreur"; message: string; reference: string | null };

export function FormulaireInscription() {
  const t = useTranslations("inscription");
  // Conventions A7 : l'identifiant est **fourni par le client**, engendré une
  // fois par affichage du formulaire. Un double-clic sur « Créer mon compte »
  // rejoue la même requête et ne crée pas deux demandes.
  const identifiant = useRef<string | null>(null);
  if (identifiant.current == null) identifiant.current = crypto.randomUUID();

  const [raisonSociale, setRaisonSociale] = useState("");
  const [pays, setPays] = useState("");
  const [email, setEmail] = useState("");
  const [cgu, setCgu] = useState(false);

  const [etat, setEtat] = useState<Etat>({ nom: "saisie" });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [attenteRenvoi, setAttenteRenvoi] = useState(0);

  // Le verrou de renvoi s'écoule tout seul : sans cela, le bouton reste
  // désactivé jusqu'à un rechargement de page.
  useEffect(() => {
    if (attenteRenvoi <= 0) return;
    const minuterie = setTimeout(() => setAttenteRenvoi((n) => n - 1), 1000);
    return () => clearTimeout(minuterie);
  }, [attenteRenvoi]);

  /** Une erreur disparaît dès que le champ qu'elle vise change : la laisser
   *  affichée sous une valeur corrigée, c'est afficher un chiffre faux. */
  function effacerErreur(champ: string) {
    setErreurs((precedentes) => {
      if (!(champ in precedentes)) return precedentes;
      const reste = { ...precedentes };
      delete reste[champ];
      return reste;
    });
  }

  function valider(): boolean {
    const trouvees: Record<string, string> = {};

    if (raisonSociale.trim().length < 2) {
      trouvees.raison_sociale = t("erreurNomRequis");
    } else if (!deriverSlug(raisonSociale)) {
      // T-021 §2.5 — le serveur refusera aussi, mais l'aller-retour est inutile.
      trouvees.raison_sociale =
        t("erreurNomNonLatin");
    }
    if (!pays) trouvees.pays = t("erreurPaysRequis");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      trouvees.email = t("erreurEmailInvalide");
    }
    if (!cgu) trouvees.cgu_acceptees = t("erreurCguRequis");

    setErreurs(trouvees);
    return Object.keys(trouvees).length === 0;
  }

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!valider()) return;

    setEtat({ nom: "chargement" });
    try {
      const accuse = await deposerInscription({
        id: identifiant.current ?? crypto.randomUUID(),
        raison_sociale: raisonSociale.trim(),
        pays,
        email: email.trim().toLowerCase(),
        cgu_acceptees: cgu,
      });
      setEtat({ nom: "envoye", email: accuse.email });
      setAttenteRenvoi(SECONDES_AVANT_RENVOI);
    } catch (cause) {
      if (cause instanceof ErreurApi && cause.code === "validation") {
        setErreurs(cause.erreursParChamp);
        setEtat({ nom: "saisie" });
        return;
      }
      const erreur = cause as ErreurApi;
      setEtat({
        nom: "erreur",
        message:
          erreur.message ??
          t("erreurGenerique"),
        reference: erreur.traceId ?? null,
      });
    }
  }

  async function relancerEmail() {
    setAttenteRenvoi(SECONDES_AVANT_RENVOI);
    try {
      await renvoyerEmail(identifiant.current ?? "");
    } catch {
      // Le contrat répond `202` même sur un identifiant inconnu : il n'y a
      // rien à annoncer, et surtout rien à révéler.
    }
  }

  // -------------------------------------------------------------------------
  // M8 écran 2 — « Vérifiez votre email »
  // -------------------------------------------------------------------------
  if (etat.nom === "envoye") {
    return (
      <BlocCentre pastille={<EnvelopeSimple size={32} weight="regular" />}>
        <TitreAuth>{t("emailTitre")}</TitreAuth>
        <AccrocheAuth>
          {t.rich("emailAccroche", {
            email: etat.email,
            fort: (morceaux) => <strong>{morceaux}</strong>,
          })}
        </AccrocheAuth>

        <Alerte type="information">
          {t.rich("emailValidite", { fort: (morceaux) => <strong>{morceaux}</strong> })}
        </Alerte>

        <div className={styles.actionsEmpilees}>
          <Bouton
            variante="secondaire"
            pleineLargeur
            onClick={relancerEmail}
            disabled={attenteRenvoi > 0}
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
      <BlocCentre
        ton="avertissement"
        pastille={<WarningCircle size={32} weight="regular" />}
      >
        <TitreAuth>{t("erreurTitre")}</TitreAuth>
        <Alerte type="erreur" titre={t("erreurAlerte")}>
          {etat.message}
          {etat.reference && (
            <span className={styles.reference}>
              {t("reference", { reference: etat.reference })}
            </span>
          )}
        </Alerte>
        <div className={styles.actionsEmpilees}>
          <Bouton pleineLargeur onClick={() => setEtat({ nom: "saisie" })}>
            {t("reessayer")}
          </Bouton>
        </div>
      </BlocCentre>
    );
  }

  // -------------------------------------------------------------------------
  // M8 écrans 1 et 7 — saisie, et saisie en erreur
  // -------------------------------------------------------------------------
  const enChargement = etat.nom === "chargement";
  const nombreErreurs = Object.keys(erreurs).length;

  return (
    <>
      <TitreAuth>{t("titre")}</TitreAuth>
      <AccrocheAuth>
        {t.rich("accroche", { fort: (morceaux) => <strong>{morceaux}</strong> })}
      </AccrocheAuth>

      {nombreErreurs > 0 && (
        <Alerte
          type="erreur"
          titre={t("champsIncorrects", { nombre: nombreErreurs })}
        >
          {t("champsIncorrectsAide")}
        </Alerte>
      )}

      <form className={styles.formulaire} onSubmit={soumettre} noValidate>
        <Champ
          libelle={t("champRaisonSociale")}
          required
          autoComplete="organization"
          placeholder={t("champRaisonSocialeExemple")}
          value={raisonSociale}
          erreur={erreurs.raison_sociale}
          aide={
            raisonSociale && !erreurs.raison_sociale
              ? `Votre adresse : ${deriverSlug(raisonSociale).replace(/_/g, "-")}.ccd-digital.ci`
              : undefined
          }
          disabled={enChargement}
          onChange={(e) => {
            setRaisonSociale(e.target.value);
            effacerErreur("raison_sociale");
          }}
        />

        <div className={styles.groupeSelect}>
          <label className={styles.libelleSelect} htmlFor="pays">
            {t("champPays")}
            <span className={styles.obligatoire} aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="pays"
            className={[styles.select, erreurs.pays ? styles.selectErreur : ""]
              .filter(Boolean)
              .join(" ")}
            value={pays}
            disabled={enChargement}
            aria-invalid={Boolean(erreurs.pays) || undefined}
            aria-describedby={erreurs.pays ? "pays-erreur" : undefined}
            onChange={(e) => {
              setPays(e.target.value);
              effacerErreur("pays");
            }}
          >
            <option value="">{t("champPaysChoisir")}</option>
            {PAYS.map((code) => (
              <option key={code} value={code}>
                {nomDePays(code)}
              </option>
            ))}
          </select>
          {erreurs.pays && (
            <p id="pays-erreur" className={styles.messageErreur}>
              {erreurs.pays}
            </p>
          )}
        </div>

        <Champ
          libelle={t("champEmail")}
          type="email"
          required
          autoComplete="email"
          placeholder={t("champEmailExemple")}
          value={email}
          erreur={erreurs.email}
          aide={t("champEmailAide")}
          disabled={enChargement}
          onChange={(e) => {
            setEmail(e.target.value);
            effacerErreur("email");
          }}
        />

        <div className={styles.consentement}>
          <label className={styles.caseLibelle}>
            <input
              type="checkbox"
              className={styles.case}
              checked={cgu}
              disabled={enChargement}
              aria-invalid={Boolean(erreurs.cgu_acceptees) || undefined}
              onChange={(e) => {
                setCgu(e.target.checked);
                effacerErreur("cgu_acceptees");
              }}
            />
            <span>
              {t("cguDebut")}{" "}
              <a
                className={styles.lien}
                href="/cgu"
                target="_blank"
                rel="noreferrer"
              >
                {t("cguLien")}
                <ArrowSquareOut size={12} aria-hidden="true" />
              </a>{" "}
              {t("cguEt")}{" "}
              <a
                className={styles.lien}
                href="/confidentialite"
                target="_blank"
                rel="noreferrer"
              >
                {t("confidentialiteLien")}
                <ArrowSquareOut size={12} aria-hidden="true" />
              </a>{" "}
              {t("cguFin")}
            </span>
          </label>
          {erreurs.cgu_acceptees && (
            <p className={styles.messageErreur}>{erreurs.cgu_acceptees}</p>
          )}
        </div>

        <Bouton type="submit" pleineLargeur taille="lg" enCours={enChargement}>
          {enChargement ? t("creationEnCours") : t("creer")}
        </Bouton>
      </form>

      <p className={styles.bascule}>
        {t("dejaCompte")} <Link href="/connexion">{t("seConnecter")}</Link>
      </p>
    </>
  );
}

"use client";

import { CheckCircle, Timer } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AccrocheAuth, BlocCentre, TitreAuth } from "@/components/layout/CarteAuth";
import { ChampsMotDePasse } from "@/components/metier/ChampsMotDePasse";
import { useReglesMotDePasse } from "@/features/auth/reglesMotDePasse";
import { Alerte, Bouton, EtatChargement } from "@/components/ui";
import {
  reinitialiserMotDePasse,
  verifierJetonReinitialisation,
} from "@/features/auth/api";
import type { ContenuJetonMdp } from "@/features/auth/api";
import { ErreurApi } from "@/lib/api";

import styles from "./page.module.css";

/**
 * Écran « Définir un mot de passe » — maquettes M2 et M6 écran 3.
 *
 * **Un seul écran pour les trois portes** (contrat §1). L'oubli, le blocage
 * après cinq échecs et l'invitation aboutissent ici, avec le même jeton, le
 * même endpoint et les mêmes effets. Seuls le titre et le libellé du bouton
 * changent, selon le `motif` que renvoie la vérification.
 *
 * Le jeton voyage en **fragment** (`#jeton=…`), jamais en paramètre de requête :
 * un fragment n'atteint ni les journaux du serveur, ni l'en-tête `Referer`.
 * Même règle que l'activation.
 */

type Etat =
  | { nom: "verification" }
  | {
      nom: "saisie";
      contenu: ContenuJetonMdp;
      erreurSaisie?: string | null;
      reference?: string | null;
    }
  | { nom: "expire" }
  | { nom: "succes"; email: string; urlConnexion?: string | null }
  | {
      nom: "echec";
      message: string;
      reference: string | null;
      contenu?: ContenuJetonMdp;
    };

export function EcranDefinition() {
  const t = useTranslations("motDePasseDefinir");
  const router = useRouter();

  const [etat, setEtat] = useState<Etat>({ nom: "verification" });
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [redirection, setRedirection] = useState<string>("");
  const [enCours, setEnCours] = useState(false);

  const jeton = useRef<string>("");

  // -------------------------------------------------------------------------
  // Vérifier le lien **avant** toute frappe — contrat §5bis. La vérification
  // ne consomme pas le jeton (règle R-32) : une passerelle antivirus qui suit
  // les liens d'un email le brûlerait avant son destinataire.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const valeur = fragment.get("jeton") || query.get("jeton") || "";
    const cible = fragment.get("redirection") || query.get("redirection") || "";
    jeton.current = valeur;

    let vivant = true;

    // L'absence de jeton emprunte le même chemin qu'un jeton refusé : elle
    // n'est qu'une cinquième cause pour un écran qui n'en distingue aucune.
    // Passer par la promesse évite en plus un `setState` synchrone dans un
    // effet, que `react-hooks` refuse — et sans requête inutile au serveur.
    const lecture = valeur
      ? verifierJetonReinitialisation(valeur)
      : Promise.reject(new Error("jeton absent"));

    lecture
      .then((contenu) => {
        if (vivant) {
          setEtat({ nom: "saisie", contenu });
          if (cible) setRedirection(cible);
        }
      })
      .catch(() => {
        // Un seul code pour quatre causes — expiré, consommé, invalidé,
        // inexistant (contrat §5.3). La conduite à tenir est la même.
        if (vivant) setEtat({ nom: "expire" });
      });

    return () => {
      vivant = false;
    };
  }, []);

  const { regles, complet } = useReglesMotDePasse(motDePasse, confirmation);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!complet || enCours) return;

    setEnCours(true);
    try {
      await reinitialiserMotDePasse(jeton.current, motDePasse);
      const email = etat.nom === "saisie" ? etat.contenu.email : "";
      const urlConnexion =
        etat.nom === "saisie" ? etat.contenu.url_connexion : null;
      setEtat({ nom: "succes", email, urlConnexion });
    } catch (cause) {
      const erreur = cause as ErreurApi;
      if (erreur.code === "jeton_expire") {
        setEtat({ nom: "expire" });
      } else if (etat.nom === "saisie") {
        setEtat({
          nom: "saisie",
          contenu: etat.contenu,
          erreurSaisie: erreur.message ?? t("erreurTitre"),
          reference: erreur.traceId ?? null,
        });
      } else {
        setEtat({
          nom: "echec",
          message: erreur.message ?? t("erreurTitre"),
          reference: erreur.traceId ?? null,
        });
      }
    } finally {
      setEnCours(false);
    }
  }

  if (etat.nom === "verification") {
    return <EtatChargement message={t("verification")} />;
  }

  // -------------------------------------------------------------------------
  // Lien expiré — M6 écran « lien expiré »
  // -------------------------------------------------------------------------
  if (etat.nom === "expire") {
    return (
      <BlocCentre ton="avertissement" pastille={<Timer size={32} />}>
        <TitreAuth>{t("expireTitre")}</TitreAuth>
        <AccrocheAuth>
          {t.rich("expireAccroche", { fort: (m) => <strong>{m}</strong> })}
        </AccrocheAuth>
        <div className={styles.actions}>
          <Bouton pleineLargeur onClick={() => router.push("/mot-de-passe/oublie")}>
            {t("expireAction")}
          </Bouton>
          <Link className={styles.lienDiscret} href="/connexion">
            {t("retourConnexion")}
          </Link>
        </div>
      </BlocCentre>
    );
  }

  // -------------------------------------------------------------------------
  // Succès — M6 écran 4
  // -------------------------------------------------------------------------
  if (etat.nom === "succes") {
    return (
      <BlocCentre ton="succes" pastille={<CheckCircle size={32} weight="fill" />}>
        <TitreAuth>{t("succesTitre")}</TitreAuth>
        <AccrocheAuth>{t("succesCorps")}</AccrocheAuth>
        {etat.email && (
          <Alerte type="succes">
            {t.rich("succesEmail", {
              email: etat.email,
              fort: (m) => <strong>{m}</strong>,
            })}
          </Alerte>
        )}
        <div className={styles.actions}>
          <Bouton
            pleineLargeur
            onClick={() => {
              if (etat.urlConnexion) {
                window.location.href = etat.urlConnexion;
              } else {
                router.push(
                  redirection
                    ? `/connexion?redirection=${encodeURIComponent(redirection)}`
                    : "/connexion",
                );
              }
            }}
          >
            {t("seConnecter")}
          </Bouton>
        </div>
      </BlocCentre>
    );
  }

  if (etat.nom === "echec") {
    return (
      <BlocCentre ton="avertissement" pastille={<Timer size={32} />}>
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
          {etat.contenu && (
            <Bouton
              pleineLargeur
              onClick={() => setEtat({ nom: "saisie", contenu: etat.contenu! })}
            >
              {t("reessayer")}
            </Bouton>
          )}
          <Link className={styles.lienDiscret} href="/connexion">
            {t("retourConnexion")}
          </Link>
        </div>
      </BlocCentre>
    );
  }

  // -------------------------------------------------------------------------
  // La saisie — M2 et M6 écran 3
  // -------------------------------------------------------------------------
  const invitation = etat.contenu.motif === "INVITATION";

  return (
    <form onSubmit={soumettre} noValidate>
      <TitreAuth>{invitation ? t("invitationTitre") : t("reinitTitre")}</TitreAuth>
      <AccrocheAuth>
        {invitation
          ? t("invitationAccroche")
          : t.rich("reinitAccroche", {
              email: etat.contenu.email,
              fort: (m) => <strong>{m}</strong>,
            })}
      </AccrocheAuth>

      {etat.erreurSaisie && (
        <Alerte type="erreur">
          {etat.erreurSaisie}
          {etat.reference && (
            <span className={styles.reference}>
              {t("reference", { reference: etat.reference })}
            </span>
          )}
        </Alerte>
      )}

      <ChampsMotDePasse
        motDePasse={motDePasse}
        confirmation={confirmation}
        onMotDePasse={setMotDePasse}
        onConfirmation={setConfirmation}
        disabled={enCours}
        regles={regles}
      />

      <div className={styles.actions}>
        <Bouton type="submit" pleineLargeur enCours={enCours} disabled={!complet}>
          {invitation ? t("activer") : t("enregistrer")}
        </Bouton>

        <Link className={styles.lienDiscret} href="/connexion">
          {t("retourConnexion")}
        </Link>

        <p className={styles.validite}>{t("validite")}</p>
      </div>
    </form>
  );
}

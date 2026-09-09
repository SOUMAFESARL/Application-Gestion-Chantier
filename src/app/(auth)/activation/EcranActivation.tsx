"use client";

import { Check, CheckCircle, Copy, Timer, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AccrocheAuth, BlocCentre, TitreAuth } from "@/components/layout/CarteAuth";
import { ChampsMotDePasse } from "@/components/metier/ChampsMotDePasse";
import { useReglesMotDePasse } from "@/features/auth/reglesMotDePasse";
import { Alerte, Bouton, Champ, EtatChargement } from "@/components/ui";
import { ErreurApi } from "@/lib/api";
import {
  activer,
  lireEtatProvisionnement,
  verifierJeton,
} from "@/features/inscription/api";
import type { ContenuJeton } from "@/features/inscription/api";

import styles from "./page.module.css";

/** T-021 §7.1 : deux minutes, puis on cesse d'interroger. */
const INTERVALLE_SONDE = 2000;
const SONDES_MAX = 60;

type Etat =
  | { nom: "verification" }
  | { nom: "saisie"; contenu: ContenuJeton }
  | { nom: "incomplet" }
  | { nom: "expire" }
  | { nom: "provisionnement"; suivi: string }
  | { nom: "pret"; url: string }
  | { nom: "echec"; message: string; reference: string | null };

export function EcranActivation() {
  const t = useTranslations("activation");
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ nom: "verification" });
  const [copie, setCopie] = useState(false);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Le hook vit **avant** les retours anticipés de la machine à états : appelé
  // plus bas, il ne s'exécutait pas sur les rendus qui sortent tôt, et l'ordre
  // des hooks changeait d'un rendu à l'autre — ce que React interdit.
  //
  // L'activation demande un nom en plus du mot de passe : les règles servies
  // ne couvrent que le second.
  const { regles, complet: motDePasseValide } = useReglesMotDePasse(
    motDePasse,
    confirmation,
  );
  const complet = motDePasseValide && nom.trim().length > 0;

  const jeton = useRef<string>("");

  // -------------------------------------------------------------------------
  // Le jeton voyage en **fragment**, jamais en paramètre de requête (R-84) :
  // un fragment n'atteint ni les journaux du serveur, ni les en-têtes
  // `Referer`. Il n'est lisible que côté navigateur.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const valeur = fragment.get("jeton") ?? "";
    jeton.current = valeur;

    let vivant = true;

    // L'exécution asynchrone via promesse évite un setState synchrone dans
    // l'effet, ce qui déclencherait un rendu en cascade interdit par React 19.
    const verification = valeur
      ? verifierJeton(valeur)
      : Promise.reject(new Error("fragment_absent"));

    verification
      .then((contenu) => {
        if (vivant) setEtat({ nom: "saisie", contenu });
      })
      .catch((err: Error) => {
        if (!vivant) return;
        if (err.message === "fragment_absent") {
          setEtat({ nom: "incomplet" });
        } else {
          // Expiré, consommé, révoqué ou inconnu : lien invalide.
          setEtat({ nom: "expire" });
        }
      });

    return () => {
      vivant = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Sonde d'état du provisionnement — T-021 §7.1
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (etat.nom !== "provisionnement") return;

    let tentatives = 0;
    let vivant = true;

    const interroger = async () => {
      if (!vivant) return;
      tentatives += 1;

      try {
        const reponse = await lireEtatProvisionnement(etat.suivi);
        if (!vivant) return;

        if (reponse.statut === "PRET") {
          setEtat({ nom: "pret", url: reponse.url_connexion });
          return;
        }
        if (reponse.statut === "ECHEC") {
          setEtat({ nom: "echec", message: t("echecMessage"), reference: null });
          return;
        }
      } catch (cause) {
        const erreur = cause as ErreurApi;
        if (!vivant) return;
        setEtat({ nom: "echec", message: erreur.message, reference: erreur.traceId });
        return;
      }

      // Au-delà de deux minutes, c'est un incident : interroger indéfiniment
      // ne le résout pas, cela ajoute du trafic à une plateforme en difficulté.
      if (tentatives >= SONDES_MAX) {
        setEtat({ nom: "echec", message: t("lenteurMessage"), reference: null });
        return;
      }

      minuterie = setTimeout(interroger, INTERVALLE_SONDE);
    };

    let minuterie = setTimeout(interroger, INTERVALLE_SONDE);
    return () => {
      vivant = false;
      clearTimeout(minuterie);
    };
  }, [etat, t]);

  // Redirection vers le sous-domaine du client, une fois l'espace prêt.
  useEffect(() => {
    if (etat.nom !== "pret") return;
    const minuterie = setTimeout(() => {
      window.location.href = etat.url;
    }, 1500);
    return () => clearTimeout(minuterie);
  }, [etat]);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setEnCours(true);
    try {
      const accuse = await activer({
        jeton: jeton.current,
        nom: nom.trim(),
        prenom: prenom.trim(),
        mot_de_passe: motDePasse,
      });
      setEtat({ nom: "provisionnement", suivi: accuse.suivi });
    } catch (cause) {
      const erreur = cause as ErreurApi;
      if (erreur.code === "jeton_expire") {
        setEtat({ nom: "expire" });
      } else if (erreur.code === "inscription_deja_activee") {
        setEtat({
          nom: "echec",
          message: t("dejaActifMessage"),
          reference: null,
        });
      } else {
        setEtat({ nom: "echec", message: erreur.message, reference: erreur.traceId });
      }
    } finally {
      setEnCours(false);
    }
  }

  // -------------------------------------------------------------------------
  // Chargement — vérification du jeton
  // -------------------------------------------------------------------------
  if (etat.nom === "verification") {
    return <EtatChargement message={t("verification")} />;
  }

  // -------------------------------------------------------------------------
  // Lien incomplet — fragment #jeton=... manquant
  // -------------------------------------------------------------------------
  if (etat.nom === "incomplet") {
    return (
      <BlocCentre ton="avertissement" pastille={<WarningCircle size={32} weight="regular" />}>
        <TitreAuth>{t("incompletTitre")}</TitreAuth>
        <AccrocheAuth>{t("incompletAccroche")}</AccrocheAuth>

        <Alerte type="avertissement">
          {t.rich("incompletAide", { fort: (morceaux) => <strong>{morceaux}</strong> })}
        </Alerte>

        <div className={styles.actions}>
          <Bouton pleineLargeur onClick={() => router.push("/inscription")}>
            {t("recommencer")}
          </Bouton>
          <Link className={styles.lienDiscret} href="/connexion">
            {t("retourConnexion")}
          </Link>
        </div>
      </BlocCentre>
    );
  }

  // -------------------------------------------------------------------------
  // M8 écran 6 — lien expiré
  // -------------------------------------------------------------------------
  if (etat.nom === "expire") {
    return (
      <BlocCentre ton="avertissement" pastille={<Timer size={32} weight="regular" />}>
        <TitreAuth>{t("expireTitre")}</TitreAuth>
        <AccrocheAuth>
          {t.rich("expireAccroche", { fort: (morceaux) => <strong>{morceaux}</strong> })}
        </AccrocheAuth>

        <Alerte type="avertissement">
          {t.rich("expireRien", { fort: (morceaux) => <strong>{morceaux}</strong> })}
        </Alerte>

        <div className={styles.actions}>
          <Bouton pleineLargeur onClick={() => router.push("/inscription")}>
            {t("recommencer")}
          </Bouton>
          <Link className={styles.lienDiscret} href="/connexion">
            {t("retourConnexion")}
          </Link>
        </div>
      </BlocCentre>
    );
  }

  // -------------------------------------------------------------------------
  // Attente du provisionnement — T-020 §3.2
  // -------------------------------------------------------------------------
  if (etat.nom === "provisionnement") {
    return (
      <BlocCentre pastille={<span className={styles.rotation} />}>
        <TitreAuth>{t("creationTitre")}</TitreAuth>
        <AccrocheAuth>{t("creationAccroche")}</AccrocheAuth>
        <p className={styles.patience} role="status">
          {t("creationPatience")}
        </p>
      </BlocCentre>
    );
  }

  if (etat.nom === "pret") {
    return (
      <BlocCentre ton="succes" pastille={<CheckCircle size={32} weight="fill" />}>
        <TitreAuth>{t("pretTitre")}</TitreAuth>
        <AccrocheAuth>{t("pretAccroche")}</AccrocheAuth>
        <div className={styles.actions}>
          <Bouton pleineLargeur onClick={() => window.location.assign(etat.url)}>
            {t("pretAction")}
          </Bouton>
        </div>
      </BlocCentre>
    );
  }

  if (etat.nom === "echec") {
    const copierReference = () => {
      if (!etat.reference) return;
      navigator.clipboard.writeText(etat.reference);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    };

    const sujetSupport = etat.reference
      ? t("sujetSupportAvecReference", { reference: etat.reference })
      : t("sujetSupport");
    const lienSupport = `mailto:support@ccd-digital.ci?subject=${encodeURIComponent(sujetSupport)}`;

    return (
      <BlocCentre ton="avertissement" pastille={<WarningCircle size={32} weight="regular" />}>
        <TitreAuth>{t("echecTitre")}</TitreAuth>
        <div className={styles.blocIncident}>
          <Alerte type="erreur" titre={t("echecAlerte")}>
            {etat.message}
          </Alerte>
          {etat.reference && (
            <div className={styles.blocReference}>
              <span>{t("reference", { reference: etat.reference })}</span>
              <button
                type="button"
                className={styles.btnCopier}
                onClick={copierReference}
                aria-label={t("copierReference")}
              >
                {copie ? <Check size={14} weight="bold" /> : <Copy size={14} weight="regular" />}
                <span>{copie ? t("referenceCopiee") : t("copierReference")}</span>
              </button>
            </div>
          )}
        </div>
        <div className={styles.actions}>
          <Bouton
            variante="secondaire"
            pleineLargeur
            onClick={() => window.location.assign(lienSupport)}
          >
            {t("contacterSupport")}
          </Bouton>
          <Link className={styles.lienDiscret} href="/connexion">
            {t("retourConnexion")}
          </Link>
        </div>
      </BlocCentre>
    );
  }

  // -------------------------------------------------------------------------
  // M8 écran 3 — activation du compte
  // -------------------------------------------------------------------------

  return (
    <>
      <TitreAuth>{t("activerTitre")}</TitreAuth>
      <AccrocheAuth>
        {t.rich("activerAccroche", {
          entreprise: etat.contenu.raison_sociale,
          fort: (morceaux) => <strong>{morceaux}</strong>,
        })}
      </AccrocheAuth>

      <p className={styles.compte}>
        <span className={styles.compteLibelle}>{t("compteAdministrateur")}</span>
        <span className={styles.compteEmail}>{etat.contenu.email}</span>
      </p>

      <form className={styles.formulaire} onSubmit={soumettre} noValidate>
        <div className={styles.duo}>
          <Champ
            libelle={t("champNom")}
            required
            autoComplete="family-name"
            value={nom}
            disabled={enCours}
            onChange={(e) => setNom(e.target.value)}
          />
          <Champ
            libelle={t("champPrenom")}
            autoComplete="given-name"
            value={prenom}
            disabled={enCours}
            onChange={(e) => setPrenom(e.target.value)}
          />
        </div>

        {/* Les trois portes du contrat §1 posent le même geste : le composant
            est partagé, et les cinq libellés ne vivent qu'à un endroit. */}
        <ChampsMotDePasse
          motDePasse={motDePasse}
          confirmation={confirmation}
          onMotDePasse={setMotDePasse}
          onConfirmation={setConfirmation}
          disabled={enCours}
          regles={regles}
        />

        <Bouton
          type="submit"
          pleineLargeur
          taille="lg"
          enCours={enCours}
          disabled={!complet}
        >
          {t("activerAction")}
        </Bouton>
      </form>
    </>
  );
}

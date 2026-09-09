"use client";

import { CheckCircle, Timer, UserCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AccrocheAuth, BlocCentre, TitreAuth } from "@/components/layout/CarteAuth";
import { ChampsMotDePasse } from "@/components/metier/ChampsMotDePasse";
import { Alerte, Bouton, Champ, EtatChargement } from "@/components/ui";
import { useReglesMotDePasse } from "@/features/auth/reglesMotDePasse";
import { ecrireProfilLocal } from "@/features/auth/api";
import {
  accepterInvitation,
  verifierInvitation,
} from "@/features/invitations/api";
import type { ContenuInvitation } from "@/features/invitations/api";
import { ErreurApi, ecrireJetonAcces, ecrireJetonRenouvellement } from "@/lib/api";

import styles from "./page.module.css";

type Etat =
  | { nom: "verification" }
  | { nom: "saisie"; contenu: ContenuInvitation }
  | { nom: "expire" }
  | { nom: "succes"; utilisateurNom: string; entreprise: string }
  | { nom: "echec"; message: string; reference: string | null };

export function EcranInvitation() {
  const t = useTranslations("invitation");
  const router = useRouter();

  const [etat, setEtat] = useState<Etat>({ nom: "verification" });
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);

  const jeton = useRef<string>("");

  const { regles, complet: motDePasseValide } = useReglesMotDePasse(
    motDePasse,
    confirmation,
  );
  const complet = motDePasseValide && nom.trim().length > 0;

  // Lecture du jeton depuis le fragment de l'URL (#jeton=...)
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const valeur = fragment.get("jeton") || query.get("jeton") || "";
    jeton.current = valeur;

    let vivant = true;

    const verification = valeur
      ? verifierInvitation(valeur)
      : Promise.reject(new Error("jeton_absent"));

    verification
      .then((contenu) => {
        if (vivant) {
          setEtat({ nom: "saisie", contenu });
          if (contenu.nom) {
            const parts = contenu.nom.split(" ");
            setNom(parts[0] || "");
            setPrenom(parts.slice(1).join(" ") || "");
          }
        }
      })
      .catch(() => {
        if (vivant) {
          setEtat({ nom: "expire" });
        }
      });

    return () => {
      vivant = false;
    };
  }, []);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!complet || enCours) return;

    setEnCours(true);
    setErreurSaisie(null);

    try {
      const reponse = await accepterInvitation({
        jeton: jeton.current,
        nom: nom.trim(),
        prenom: prenom.trim(),
        mot_de_passe: motDePasse,
      });

      // Stockage de la session
      ecrireJetonAcces(reponse.access);
      ecrireJetonRenouvellement(reponse.refresh);
      ecrireProfilLocal(reponse.utilisateur);

      const nomEntreprise =
        etat.nom === "saisie" ? etat.contenu.entreprise : "votre espace";

      setEtat({
        nom: "succes",
        utilisateurNom: `${prenom} ${nom}`.trim(),
        entreprise: nomEntreprise,
      });

      // Redirection vers le tableau de bord
      setTimeout(() => {
        router.push("/tableau-de-bord");
      }, 1000);
    } catch (cause) {
      const erreur = cause as ErreurApi;
      if (erreur.code === "jeton_expire") {
        setEtat({ nom: "expire" });
      } else {
        setErreurSaisie(erreur.message || t("erreurTitre"));
      }
    } finally {
      setEnCours(false);
    }
  }

  // 1. Écran de chargement
  if (etat.nom === "verification") {
    return <EtatChargement message={t("chargement")} />;
  }

  // 2. Écran lien expiré ou invalide
  if (etat.nom === "expire") {
    return (
      <BlocCentre ton="avertissement" pastille={<Timer size={32} />}>
        <TitreAuth>{t("expireTitre")}</TitreAuth>
        <AccrocheAuth>{t("expireAccroche")}</AccrocheAuth>
        <div className={styles.actions}>
          <Bouton pleineLargeur onClick={() => router.push("/connexion")}>
            {t("expireAction")}
          </Bouton>
        </div>
      </BlocCentre>
    );
  }

  // 3. Écran de confirmation de succès
  if (etat.nom === "succes") {
    return (
      <BlocCentre ton="succes" pastille={<CheckCircle size={32} weight="fill" />}>
        <TitreAuth>{t("succesTitre")}</TitreAuth>
        <AccrocheAuth>{t("succesAccroche")}</AccrocheAuth>
      </BlocCentre>
    );
  }

  // 4. Formulaire d'activation et de définition du mot de passe
  if (etat.nom !== "saisie") {
    return null;
  }

  const contenu = etat.contenu;

  return (
    <>
      <TitreAuth>{t("titre", { entreprise: contenu.entreprise })}</TitreAuth>
      <AccrocheAuth>
        {t.rich("accroche", {
          role: () => contenu.role_libelle,
          rolePropose: contenu.role_libelle,
        })}
      </AccrocheAuth>

      <div className={styles.recapitulatif}>
        <div className={styles.ligneRecap}>
          <span className={styles.labelRecap}>{t("champEmail")}</span>
          <span className={styles.badgeRole}>
            <UserCheck size={14} weight="bold" />
            {contenu.role_libelle}
          </span>
        </div>
        <div className={styles.valeurEmail}>{contenu.email}</div>
      </div>

      {erreurSaisie && <Alerte type="erreur">{erreurSaisie}</Alerte>}

      <form onSubmit={soumettre} className={styles.formulaire}>
        <div className={styles.duo}>
          <Champ
            libelle={t("champNom")}
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoComplete="family-name"
          />
          <Champ
            libelle={t("champPrenom")}
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            autoComplete="given-name"
          />
        </div>

        <ChampsMotDePasse
          motDePasse={motDePasse}
          confirmation={confirmation}
          regles={regles}
          onMotDePasse={setMotDePasse}
          onConfirmation={setConfirmation}
        />

        <div className={styles.actions}>
          <Bouton
            variante="primaire"
            pleineLargeur
            type="submit"
            disabled={!complet || enCours}
          >
            {enCours ? t("chargement") : t("boutonActiver")}
          </Bouton>

          <Link className={styles.lienDiscret} href="/connexion">
            {t("retourConnexion")}
          </Link>
        </div>
      </form>
    </>
  );
}

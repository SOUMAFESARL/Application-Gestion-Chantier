"use client";

import { ArrowClockwise, Envelope, Eye, EyeSlash } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Alerte, Bouton, Champ } from "@/components/ui";
import { demanderReinitialisation, seConnecter } from "@/features/auth/api";
import {
  compteCommeTentative,
  etatDepuisErreur,
  saisiePossible,
  TENTATIVES_MAX,
} from "@/features/auth/etats";
import type { EtatConnexion } from "@/features/auth/etats";

import styles from "./page.module.css";

import { effacerJetons } from "@/lib/api";
import { lireRouteRetour, purgerRouteRetour } from "@/lib/auth/session";
import { useQueryClient } from "@tanstack/react-query";

const DESTINATION_APRES_CONNEXION = "/configuration";

export function FormulaireConnexion() {
  const t = useTranslations("connexion");
  const router = useRouter();
  const parametres = useSearchParams();

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [emailRenvoye, setEmailRenvoye] = useState(false);

  // Le compteur des cinq essais, tenu ici : le serveur ne l'envoie plus, ses
  // cinq causes d'échec étant devenues indiscernables (contrat §6.1).
  const [tentatives, setTentatives] = useState(0);

  // La session expirée n'est pas un échec de connexion : c'est l'état dans
  // lequel on ARRIVE sur cet écran, quand le renouvellement du jeton a
  // échoué ailleurs dans l'application.
  const [etat, setEtat] = useState<EtatConnexion>(() =>
    parametres.get("session") === "expiree"
      ? { nom: "session_expiree" }
      : { nom: "saisie" },
  );

  const queryClient = useQueryClient();

  useEffect(() => {
    if (parametres.get("session") === "expiree") {
      queryClient.clear();
      effacerJetons();
    }
  }, [parametres, queryClient]);

  /**
   * Changer d'adresse remet le compteur à zéro.
   *
   * Sinon, essayer deux comptes différents ferait avancer un compteur unique,
   * et l'écran annoncerait un blocage qui ne viendra pas — parcours §5.1.
   */
  function changerEmail(valeur: string) {
    setEmail(valeur);
    setTentatives(0);
    if (etat.nom === "identifiants_invalides") setEtat({ nom: "saisie" });
  }

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setEtat({ nom: "chargement" });

    try {
      await seConnecter({ email, mot_de_passe: motDePasse, origine: "WEB" });
      setTentatives(0);
      const retour = lireRouteRetour();
      purgerRouteRetour();
      const cible =
        (retour && !retour.startsWith("/connexion") ? retour : null) ??
        parametres.get("redirection");
      const destination =
        cible && cible.startsWith("/") && !cible.startsWith("//")
          ? cible
          : DESTINATION_APRES_CONNEXION;
      router.replace(destination);
    } catch (cause) {
      // Une panne réseau et un 429 ne sont pas des mots de passe ratés.
      const total = compteCommeTentative(cause) ? tentatives + 1 : tentatives;
      setTentatives(total);
      setEtat(etatDepuisErreur(cause, total));
      // L'adresse est conservée : la retaper à chaque essai est une punition
      // sans objet, et sur un téléphone de chantier, trente secondes.
      setMotDePasse("");
    }
  }

  async function renvoyerEmailDeblocage() {
    try {
      await demanderReinitialisation(email);
    } finally {
      // Workflow T2 : le retour est identique que le compte existe ou non.
      setEmailRenvoye(true);
    }
  }

  const enChargement = etat.nom === "chargement";
  const champsActifs = saisiePossible(etat);
  const champsEnErreur = etat.nom === "identifiants_invalides";

  return (
    <form className={styles.formulaire} onSubmit={soumettre} noValidate>
      <Message etat={etat} emailRenvoye={emailRenvoye} />

      <Champ
        libelle={t("champEmail")}
        type="email"
        name="email"
        autoComplete="username"
        placeholder={t("champEmailExemple")}
        value={email}
        onChange={(e) => changerEmail(e.target.value)}
        disabled={!champsActifs}
        erreur={champsEnErreur ? " " : undefined}
        required
      />

      <Champ
        libelle={t("champMotDePasse")}
        type={motDePasseVisible ? "text" : "password"}
        name="mot_de_passe"
        autoComplete="current-password"
        placeholder="••••••••"
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        disabled={!champsActifs}
        erreur={champsEnErreur ? t("champErreur") : undefined}
        required
        actionDroite={
          <button
            type="button"
            onClick={() => setMotDePasseVisible((v) => !v)}
            aria-label={
              motDePasseVisible
                ? t("masquerMotDePasse")
                : t("afficherMotDePasse")
            }
            aria-pressed={motDePasseVisible}
            disabled={!champsActifs}
          >
            {motDePasseVisible ? <EyeSlash size={20} /> : <Eye size={20} />}
          </button>
        }
      />

      {/*
        Le lien reste visible en toute circonstance, blocage compris. Depuis que
        le blocage ne s'éteint plus seul, l'email de réinitialisation en est la
        SEULE sortie : un écran qui masquerait ce lien enfermerait le compte
        sans que rien ne le signale. Sa présence est une exigence
        fonctionnelle, pas un choix de mise en page — contrat §6.4.
      */}
      <div className={styles.lienDroite}>
        <a href="/mot-de-passe/oublie" className={styles.lien}>
          {t("motDePasseOublie")}
        </a>
      </div>

      <Bouton
        type="submit"
        taille="lg"
        pleineLargeur
        enCours={enChargement}
        disabled={!champsActifs || !email || !motDePasse}
      >
        {enChargement ? t("connexionEnCours") : t("seConnecter")}
      </Bouton>

      {etat.nom === "compte_bloque" && !emailRenvoye && (
        <Bouton
          variante="ghost"
          pleineLargeur
          iconeGauche={<Envelope size={18} />}
          onClick={renvoyerEmailDeblocage}
        >
          {t("renvoyerDeblocage")}
        </Bouton>
      )}

      {(etat.nom === "erreur_reseau" || etat.nom === "trop_de_requetes") && (
        <Bouton
          variante="secondaire"
          pleineLargeur
          iconeGauche={<ArrowClockwise size={16} />}
          onClick={() => setEtat({ nom: "saisie" })}
        >
          {t("reessayer")}
        </Bouton>
      )}

      <div className={styles.separateur}>
        <div className={styles.separateurLigne} aria-hidden="true" />
        <span className={styles.separateurTexte}>
          {t("nouveauSurPlateforme")}
        </span>
        <div className={styles.separateurLigne} aria-hidden="true" />
      </div>

      <Link href="/inscription" className={styles.boutonInscription}>
        {t("creerCompte")}
      </Link>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Message({
  etat,
  emailRenvoye,
}: {
  etat: EtatConnexion;
  emailRenvoye: boolean;
}) {
  const t = useTranslations("connexion");

  switch (etat.nom) {
    case "session_expiree":
      return (
        <Alerte type="information" titre={t("sessionExpireeTitre")}>
          {t("sessionExpireeCorps")}
        </Alerte>
      );

    case "succes":
      return (
        <Alerte type="succes" titre={t("succesTitre")}>
          {t("succesCorps")}
        </Alerte>
      );

    case "identifiants_invalides": {
      // À une tentative de la fin, on avertit au lieu de constater : le ton
      // change parce que la conséquence change. C'est le seul endroit de cet
      // écran où l'on avertit — parcours §5.2.
      const imminent = etat.tentatives === TENTATIVES_MAX - 1;

      return (
        <Alerte
          type={imminent ? "avertissement" : "erreur"}
          titre={imminent ? t("derniereTentativeTitre") : t("echecTitre")}
        >
          {imminent ? t("derniereTentativeCorps") : t("echecCorps")}
          <div className={styles.compteur}>
            {t("tentative", { faites: etat.tentatives, total: TENTATIVES_MAX })}
          </div>
        </Alerte>
      );
    }

    case "compte_bloque":
      return (
        <Alerte type="erreur" titre={t("bloqueTitre")}>
          {/*
            « Si cette adresse est enregistrée » : le compteur étant tenu par le
            client, cet écran s'atteint aussi sur une adresse qui n'existe pas —
            cinq essais sur n'importe quoi y mènent. Affirmer qu'un email est
            parti serait alors faux. La formulation est vraie dans les deux cas.

            Et le blocage n'est plus « temporaire » : l'expiration automatique à
            quinze minutes a été supprimée, l'email est la seule sortie.
          */}
          {emailRenvoye
            ? t("bloqueCorpsRenvoye", { total: TENTATIVES_MAX })
            : t("bloqueCorps", { total: TENTATIVES_MAX })}
        </Alerte>
      );

    case "trop_de_requetes":
      return (
        <Alerte type="avertissement" titre={t("tropDeRequetesTitre")}>
          {t("tropDeRequetesCorps")}
        </Alerte>
      );

    case "erreur_reseau":
      return (
        <Alerte type="avertissement" titre={t("reseauTitre")}>
          {etat.message}
        </Alerte>
      );

    case "erreur_inattendue":
      return (
        <Alerte type="erreur" titre={t("inattendueTitre")}>
          {/* Le message vient de l'API quand elle en a rédigé un — guide §9. */}
          {etat.message ?? t("inattendueCorps")}
          {etat.reference && (
            <div className={styles.compteur}>
              {t("reference")} <code>{etat.reference}</code>
            </div>
          )}
        </Alerte>
      );

    default:
      return null;
  }
}

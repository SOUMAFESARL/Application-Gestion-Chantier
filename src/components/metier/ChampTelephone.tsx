"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import {
  PAYS_TELEPHONE,
  analyserTelephone,
  composerTelephone,
  formaterNational,
  gabaritNational,
  paysTelephone,
} from "@/features/referentiels/telephone";
import { nomDePays } from "@/lib/format";

import { Drapeau } from "./Drapeau";
import styles from "./ChampTelephone.module.css";

interface Props {
  libelle: string;
  /** La valeur enregistrée — numéro international, `+2250700000000`. */
  valeur: string;
  /** Reçoit la valeur au même format. Chaîne vide quand le champ est vidé. */
  onChange: (valeur: string) => void;
  /**
   * Le pays proposé au départ — celui de l'entreprise. Il n'enferme rien :
   * une entreprise ivoirienne appelle des fournisseurs sénégalais.
   */
  paysDefaut: string;
  required?: boolean;
  erreur?: string;
  aide?: string;
  disabled?: boolean;
}

/**
 * Saisie d'un numéro de téléphone, avec indicatif et drapeau.
 *
 * **Le champ ne stocke pas ce qu'il affiche.** À l'écran, « 07 00 00 00 00 » à
 * côté d'un drapeau ivoirien ; en base, `+2250700000000`. Les espaces sont un
 * confort de lecture, l'indicatif est une information — les mélanger, c'est ce
 * qui produisait des numéros dont on ne savait plus de quel pays ils étaient.
 *
 * Le sélecteur de pays est un `<select>` **natif rendu transparent**, posé sur
 * le drapeau et l'indicatif qu'on voit. Un `<option>` ne peut pas contenir
 * d'image : la seule façon d'avoir un drapeau *et* le sélecteur du système —
 * la roue crantée sur mobile, les flèches au clavier, l'annonce par le lecteur
 * d'écran — est de superposer les deux.
 *
 * Le pays reste **limité aux neuf pays de l'inscription**, décision en cours :
 * une entreprise peut travailler ailleurs, et ce jour-là la liste s'ouvrira.
 * En attendant, la même liste sert partout, et personne ne peut saisir un
 * indicatif que le produit ne connaît pas.
 */
export function ChampTelephone({
  libelle,
  valeur,
  onChange,
  paysDefaut,
  required = false,
  erreur,
  aide,
  disabled = false,
}: Props) {
  const t = useTranslations("telephone");
  const identifiant = useId();
  const idAide = `${identifiant}-aide`;

  const { pays, national } = analyserTelephone(valeur, paysDefaut);
  const { indicatif, longueurMax } = paysTelephone(pays);
  const enErreur = Boolean(erreur);

  function auChangementDePays(code: string) {
    // Le numéro national **suit le changement de pays** : celui qui corrige
    // l'indicatif après avoir tapé le numéro ne veut pas le retaper.
    onChange(composerTelephone(code, national));
  }

  function auChangementDeNumero(saisie: string) {
    // Tout ce qui n'est pas un chiffre est écarté à la saisie — espaces,
    // points, tirets, le `+` d'un collage. La mise en forme est rendue juste
    // après, ce qui fait qu'un numéro collé depuis un email s'aligne tout seul.
    const chiffres = saisie.replace(/\D/g, "").slice(0, longueurMax);
    onChange(composerTelephone(pays, chiffres));
  }

  return (
    <div className={styles.groupe}>
      <label className={styles.libelle} htmlFor={identifiant}>
        {libelle}
        {required && (
          <span className={styles.obligatoire} aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div
        className={[
          styles.enveloppe,
          enErreur ? styles.enveloppeErreur : "",
          disabled ? styles.enveloppeDesactivee : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.pays}>
          <Drapeau code={pays} largeur={22} />
          <span className={styles.indicatif}>{indicatif}</span>
          <span className={styles.chevron} aria-hidden="true" />
          <select
            className={styles.selectPays}
            value={pays}
            onChange={(evenement) => auChangementDePays(evenement.target.value)}
            disabled={disabled}
            aria-label={t("choisirPays")}
          >
            {PAYS_TELEPHONE.map((option) => (
              <option key={option.code} value={option.code}>
                {`${nomDePays(option.code)} (${option.indicatif})`}
              </option>
            ))}
          </select>
        </div>

        <input
          id={identifiant}
          className={styles.numero}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={gabaritNational(pays)}
          value={formaterNational(pays, national)}
          onChange={(evenement) => auChangementDeNumero(evenement.target.value)}
          disabled={disabled}
          required={required}
          aria-invalid={enErreur || undefined}
          aria-required={required || undefined}
          aria-describedby={erreur || aide ? idAide : undefined}
        />
      </div>

      {(erreur || aide) && (
        <p id={idAide} className={enErreur ? styles.messageErreur : styles.messageAide}>
          {erreur ?? aide}
        </p>
      )}
    </div>
  );
}

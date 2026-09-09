"use client";

import { CheckCircle, Circle, Eye, EyeSlash } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Champ } from "@/components/ui";
import type { RegleMotDePasse } from "@/features/auth/reglesMotDePasse";

import styles from "./ChampsMotDePasse.module.css";

/**
 * La double saisie d'un mot de passe et ses cinq contrôles.
 *
 * **Trois écrans posent exactement le même geste** — l'activation d'un compte
 * (M8 écran 3), la définition après invitation (M2) et la réinitialisation
 * (M6 écran 3). Le contrat de réinitialisation §1 le dit autrement : « trois
 * portes, un seul couloir ». Ce composant est ce couloir.
 *
 * L'extraction se fait maintenant et pas avant : le guide frontend §4 place le
 * bon moment au **premier écran qui en a réellement besoin**, et nous en sommes
 * au deuxième et au troisième. Recopier une troisième fois aurait garanti que
 * les trois divergent.
 *
 * **La double saisie ne part pas au serveur.** Elle est une vérification
 * d'interface — contrat §5.1 : le serveur reçoit une seule valeur, et il n'a
 * rien à comparer.
 *
 * **Les règles ne vivent plus ici.** Elles viennent de
 * `GET /referentiels/regles-mot-de-passe/` par `useReglesMotDePasse` — contrat
 * §6.3. Ce composant les affiche ; il ne les connaît pas.
 */

interface Props {
  motDePasse: string;
  confirmation: string;
  onMotDePasse: (valeur: string) => void;
  onConfirmation: (valeur: string) => void;
  disabled?: boolean;
  /** Les règles déjà calculées par l'écran, qui s'en sert aussi pour son bouton. */
  regles: RegleMotDePasse[];
}

export function ChampsMotDePasse({
  motDePasse,
  confirmation,
  onMotDePasse,
  onConfirmation,
  disabled = false,
  regles,
}: Props) {
  const t = useTranslations("motDePasse");
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Champ
        libelle={t("champNouveau")}
        type={visible ? "text" : "password"}
        required
        autoComplete="new-password"
        value={motDePasse}
        disabled={disabled}
        onChange={(e) => onMotDePasse(e.target.value)}
        actionDroite={
          <button
            type="button"
            className={styles.oeil}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("masquer") : t("afficher")}
          >
            {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      <Champ
        libelle={t("champConfirmation")}
        type={visible ? "text" : "password"}
        required
        autoComplete="new-password"
        value={confirmation}
        disabled={disabled}
        onChange={(e) => onConfirmation(e.target.value)}
      />

      {/* La liste se met à jour à la frappe : `polite` annonce sans couper.
          Et l'état de chaque règle ne tient pas qu'à la couleur — charte §8.4,
          la coche pleine se distingue du cercle vide sans la voir en vert. */}
      <ul className={styles.controles} aria-live="polite">
        {regles.map((regle) => (
          <li
            key={regle.code}
            className={regle.satisfaite ? styles.controleValide : styles.controle}
          >
            {regle.satisfaite ? (
              <CheckCircle size={16} weight="fill" aria-hidden="true" />
            ) : (
              <Circle size={16} aria-hidden="true" />
            )}
            {t(`regle.${regle.code}`)}
          </li>
        ))}
      </ul>
    </>
  );
}

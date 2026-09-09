import { ArrowClockwise, FileDashed, WifiSlash } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import styles from "./Etats.module.css";

/**
 * Les états d'écran — convention transverse.
 *
 * Tout écran qui charge des données a **quatre** états, pas un :
 * chargement, vide, erreur, données. Les trois premiers sont ici, pour
 * qu'ils se ressemblent partout et que personne n'ait à les réinventer.
 *
 * L'oubli classique est l'état vide : un tableau sans lignes affiche un
 * cadre blanc, et l'utilisateur ne sait pas s'il attend, s'il n'a rien,
 * ou si l'application est cassée.
 */

// ---------------------------------------------------------------------------

interface PropsChargement {
  /** Charte §8.3 : au-delà de 2 s, un texte explicite accompagne l'attente. */
  message?: string;
}

export function EtatChargement({ message }: PropsChargement) {
  const t = useTranslations("etats");

  return (
    <div className={styles.etat} role="status" aria-live="polite">
      <span className={styles.indicateur} aria-hidden="true" />
      <p className={styles.message}>{message ?? t("chargement")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface PropsVide {
  titre: string;
  /** Ce que l'utilisateur peut faire. Un écran vide sans issue est un cul-de-sac. */
  description?: string;
  action?: ReactNode;
  icone?: ReactNode;
}

export function EtatVide({ titre, description, action, icone }: PropsVide) {
  return (
    <div className={styles.etat}>
      <span className={styles.icone} aria-hidden="true">
        {icone ?? <FileDashed size={40} weight="duotone" />}
      </span>
      <p className={styles.titre}>{titre}</p>
      {description && <p className={styles.message}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface PropsErreur {
  /**
   * Message destiné à l'utilisateur — celui de l'API.
   * Socle §5.2 : jamais de code HTTP ni de trace technique à l'écran.
   */
  message?: string;
  onReessayer?: () => void;
  /** Repris du `trace_id` de l'API, à communiquer au support. */
  reference?: string | null;
}

export function EtatErreur({ message, onReessayer, reference }: PropsErreur) {
  const t = useTranslations("etats");

  return (
    <div className={styles.etat} role="alert">
      <span className={styles.iconeErreur} aria-hidden="true">
        <WifiSlash size={40} weight="duotone" />
      </span>
      <p className={styles.titre}>{t("erreurTitre")}</p>
      <p className={styles.message}>{message ?? t("erreurMessage")}</p>
      {onReessayer && (
        <div className={styles.action}>
          <button type="button" className={styles.boutonReessayer} onClick={onReessayer}>
            <ArrowClockwise size={16} aria-hidden="true" />
            {t("reessayer")}
          </button>
        </div>
      )}
      {reference && (
        <p className={styles.reference}>
          {t("reference")} <code>{reference}</code>
        </p>
      )}
    </div>
  );
}

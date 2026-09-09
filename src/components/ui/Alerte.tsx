import { CheckCircle, Info, Warning, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import styles from "./Alerte.module.css";

/** Les quatre types de messages du Socle Commun §5.1. Il n'y en a pas d'autres. */
export type TypeAlerte = "succes" | "erreur" | "avertissement" | "information";

interface Props {
  type: TypeAlerte;
  titre?: string;
  children: ReactNode;
  /** Action corrective. Socle §5.2 : un message d'erreur sans action est inutile. */
  action?: ReactNode;
}

const ICONES = {
  succes: CheckCircle,
  erreur: XCircle,
  avertissement: Warning,
  information: Info,
} as const;

/** Rôle ARIA : une erreur interrompt, le reste est annoncé poliment. */
const ROLES = {
  succes: "status",
  erreur: "alert",
  avertissement: "alert",
  information: "status",
} as const;

/**
 * Alerte — charte §7.6, Socle Commun §5.
 *
 * Charte §8.4, règle absolue : une information critique n'est jamais portée
 * par la seule couleur. Chaque type a donc son icône **et** son texte.
 */
export function Alerte({ type, titre, children, action }: Props) {
  const Icone = ICONES[type];

  return (
    <div className={`${styles.alerte} ${styles[type]}`} role={ROLES[type]}>
      <Icone className={styles.icone} size={20} weight="fill" aria-hidden="true" />
      <div className={styles.contenu}>
        {titre && <p className={styles.titre}>{titre}</p>}
        <div className={styles.corps}>{children}</div>
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  );
}

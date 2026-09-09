import type { ReactNode } from "react";

import styles from "./Carte.module.css";

interface Props {
  titre?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Sans ombre — préféré sur le terrain, où les ombres se voient mal. */
  plate?: boolean;
  className?: string;
}

/** Carte — charte §7.5. */
export function Carte({ titre, actions, children, plate = false, className }: Props) {
  return (
    <section
      className={[styles.carte, plate ? styles.plate : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {(titre || actions) && (
        <header className={styles.entete}>
          {titre && <h2 className={styles.titre}>{titre}</h2>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

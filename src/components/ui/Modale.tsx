"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import { useCallback, useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import styles from "./Modale.module.css";

interface Props {
  ouverte: boolean;
  titre: string;
  taille?: "defaut" | "large";
  /** Texte du bouton de fermeture, lu par un lecteur d'écran. */
  libelleFermeture?: string;
  /** Appelé par la croix, par `Échap` et par le fond. Absent : la modale ne se ferme pas. */
  onFermer?: () => void;
  /** Boutons du pied. L'action principale se place en dernier. */
  actions?: ReactNode;
  children: ReactNode;
}

const FOCUSABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Modale — premier besoin réel : l'abandon du wizard (T-022 §7.2) et la fin
 * d'essai (T-025 §3.2).
 *
 * `window.confirm()` est interdit par le guide frontend §4 : il bloque le fil
 * d'exécution, ne se style pas, et sur un téléphone d'entrée de gamme il
 * s'affiche hors du contexte de la page.
 *
 * Trois obligations d'accessibilité, qu'une modale maison rate presque
 * toujours :
 *   · le focus **entre** dans la modale à l'ouverture et n'en sort pas ;
 *   · `Échap` ferme, comme partout ailleurs dans un navigateur ;
 *   · le focus **revient** sur l'élément qui l'a ouverte à la fermeture —
 *     sans quoi la navigation au clavier repart du début de la page.
 */
export function Modale({
  ouverte,
  titre,
  taille = "defaut",
  libelleFermeture = "Fermer",
  onFermer,
  actions,
  children,
}: Props) {
  const identifiant = useId();
  const boite = useRef<HTMLDivElement>(null);
  const origine = useRef<HTMLElement | null>(null);

  const pieger = useCallback((evenement: KeyboardEvent) => {
    if (evenement.key !== "Tab" || !boite.current) return;

    const cibles = Array.from(boite.current.querySelectorAll<HTMLElement>(FOCUSABLES));
    if (cibles.length === 0) return;

    const premier = cibles[0];
    const dernier = cibles[cibles.length - 1];
    const actif = document.activeElement;

    if (evenement.shiftKey && actif === premier) {
      evenement.preventDefault();
      dernier.focus();
    } else if (!evenement.shiftKey && actif === dernier) {
      evenement.preventDefault();
      premier.focus();
    }
  }, []);

  useEffect(() => {
    if (!ouverte) return;

    origine.current = document.activeElement as HTMLElement | null;
    boite.current?.querySelector<HTMLElement>(FOCUSABLES)?.focus();

    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape" && onFermer) {
        evenement.stopPropagation();
        onFermer();
        return;
      }
      pieger(evenement);
    };

    document.addEventListener("keydown", surTouche, true);
    const debordement = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", surTouche, true);
      document.body.style.overflow = debordement;
      origine.current?.focus();
    };
  }, [ouverte, onFermer, pieger]);

  if (!ouverte) return null;

  return (
    <div
      className={styles.fond}
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget) onFermer?.();
      }}
    >
      <div
        ref={boite}
        className={`${styles.boite} ${taille === "large" ? styles.boiteLarge : ""}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={identifiant}
      >
        <header className={styles.entete}>
          <h2 id={identifiant} className={styles.titre}>
            {titre}
          </h2>
          {onFermer && (
            <button
              type="button"
              className={styles.fermer}
              onClick={onFermer}
              aria-label={libelleFermeture}
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </header>

        <div className={styles.corps}>{children}</div>

        {actions && <footer className={styles.actions}>{actions}</footer>}
      </div>
    </div>
  );
}

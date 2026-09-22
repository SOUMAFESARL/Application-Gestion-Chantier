"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

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
      // Sur telephone la modale monte du bas : c'est le geste attendu, et le
      // pouce atteint les actions sans traverser l'ecran. Des 480 px elle se
      // recentre.
      className="fixed inset-0 z-100 flex animate-in items-end justify-center bg-neutral-900/50 fade-in duration-200 motion-reduce:animate-none sm:items-center sm:p-4"
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget) onFermer?.();
      }}
    >
      <div
        ref={boite}
        className={cn(
          "max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-t-xl bg-neutral-0 p-6 shadow-lg",
          "animate-in slide-in-from-bottom-8 duration-200 motion-reduce:animate-none",
          "sm:rounded-xl sm:p-8",
          taille === "large" && "sm:max-w-[580px]",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={identifiant}
      >
        <header className="mb-3 flex items-start justify-between gap-4">
          <h2 id={identifiant} className="text-lg leading-[1.3] font-bold text-neutral-900">
            {titre}
          </h2>
          {onFermer && (
            // La cible tactile fait 48 px quand le visuel en fait 32 — §8.2.
            <button
              type="button"
              className="relative -mt-2 -mr-2 flex size-8 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-md border-0 bg-transparent text-neutral-600 after:absolute after:-inset-2 after:content-[''] hover:bg-neutral-100 hover:text-neutral-900 focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
              onClick={onFermer}
              aria-label={libelleFermeture}
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="text-sm leading-normal text-neutral-700 [&_p+p]:mt-3">{children}</div>

        {/* Sur desktop les actions s'alignent a droite, la principale en
            dernier — sens de lecture. Sur mobile elles s'empilent, la
            principale en haut. */}
        {actions && (
          <footer className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {actions}
          </footer>
        )}
      </div>
    </div>
  );
}

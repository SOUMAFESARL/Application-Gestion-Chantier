"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Projet } from "@/features/projets/types";
import { cn } from "@/lib/utils";

import {
  BARRE_PROJET,
  BARRE_PROJET_COLLEE,
  CHIFFRE_ALERTE,
  FOND_INDICATEUR,
  type FondIndicateur,
} from "./classes";

/**
 * Les pièces communes aux écrans d'un chantier : le sélecteur de chantier,
 * les tuiles d'indicateurs et la barre d'onglets. « Lots & activités » en est
 * la référence ; « Équipes et affectations » les reprend telles quelles.
 */

/**
 * Vrai quand un élément `sticky` a atteint sa position collée.
 *
 * L'observateur rogne le haut de la fenêtre de la valeur `top` de l'élément
 * (lue dans son style calculé, pour ne pas la recopier ici) plus un pixel :
 * tant qu'il est à sa place, il est entièrement visible ; une fois collé, ce
 * pixel déborde de la zone observée.
 */
export function useEstColle(element: HTMLElement | null) {
  const [colle, setColle] = useState(false);

  useEffect(() => {
    if (!element) return;
    const haut = Number.parseFloat(getComputedStyle(element).top) || 0;
    const observateur = new IntersectionObserver(
      ([entree]) =>
        setColle(entree.intersectionRatio < 1 && entree.boundingClientRect.top <= haut + 1),
      { rootMargin: `-${haut + 1}px 0px 0px 0px`, threshold: 1 },
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [element]);

  return colle;
}

/** Le choix du chantier, collé sous l'en-tête de l'application. */
export function BarreProjet({
  projets,
  projetId,
  onChanger,
}: {
  projets: Projet[];
  projetId: string;
  onChanger: (id: string) => void;
}) {
  const t = useTranslations("projets.lotsActivites");
  const [barre, setBarre] = useState<HTMLDivElement | null>(null);
  const colle = useEstColle(barre);

  return (
    <div ref={setBarre} className={cn(BARRE_PROJET, colle && BARRE_PROJET_COLLEE, "flex items-center gap-3")}>
      <label htmlFor="choix-projet" className="shrink-0 text-sm font-medium text-neutral-700">
        {t("choixProjet")}
      </label>
      <Select value={projetId} onValueChange={onChanger}>
        <SelectTrigger
          id="choix-projet"
          className="h-[var(--input-height-md)] w-80 max-w-full bg-card max-sm:w-auto max-sm:min-w-0 max-sm:flex-1"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          {projets.map((projet) => (
            <SelectItem key={projet.id} value={projet.id}>
              {projet.nom}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Une tuile de la rangée d'indicateurs. */
export function Indicateur({
  libelle,
  valeur,
  detail,
  fond,
  alerte = false,
}: {
  libelle: string;
  valeur: string;
  detail?: string;
  fond: FondIndicateur;
  /** Le chiffre prend la teinte de la tuile (`erreur`, `avertissement`). */
  alerte?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-solid p-4 shadow-md",
        FOND_INDICATEUR[fond],
      )}
    >
      <span className="text-xs font-medium text-neutral-700">{libelle}</span>
      <span
        className={cn(
          "text-h3 font-bold tabular-nums",
          (alerte && CHIFFRE_ALERTE[fond]) || "text-neutral-900",
        )}
      >
        {valeur}
      </span>
      {detail && <span className="text-xs text-neutral-500">{detail}</span>}
    </div>
  );
}

/**
 * La barre d'onglets d'un écran. Chaque onglet commande le panneau
 * `panneau-<clé>`, qui doit porter `aria-labelledby="onglet-<clé>"`.
 */
export function Onglets<C extends string>({
  onglets,
  actif,
  onChanger,
  libelle,
  libelleOnglet,
}: {
  onglets: readonly C[];
  actif: C;
  onChanger: (onglet: C) => void;
  /** Le nom accessible de la barre. */
  libelle: string;
  libelleOnglet: (onglet: C) => string;
}) {
  return (
    <div
      role="tablist"
      aria-label={libelle}
      className="flex gap-1 border-0 border-b border-solid border-neutral-200"
    >
      {onglets.map((cle) => (
        <button
          key={cle}
          type="button"
          role="tab"
          id={`onglet-${cle}`}
          aria-selected={actif === cle}
          aria-controls={`panneau-${cle}`}
          onClick={() => onChanger(cle)}
          className={cn(
            "-mb-px cursor-pointer border-0 border-b-2 border-solid bg-transparent px-4 py-2.5 text-sm font-medium transition-colors",
            actif === cle
              ? "border-primary text-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-800",
          )}
        >
          {libelleOnglet(cle)}
        </button>
      ))}
    </div>
  );
}

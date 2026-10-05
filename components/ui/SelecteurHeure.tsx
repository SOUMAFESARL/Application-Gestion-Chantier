"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Le pas des minutes proposées : un chantier ne se pointe pas à la minute. */
const PAS_MINUTES = 5;

const deuxChiffres = (nombre: number) => String(nombre).padStart(2, "0");
const HEURES = Array.from({ length: 24 }, (_, rang) => deuxChiffres(rang));
const MINUTES = Array.from({ length: 60 / PAS_MINUTES }, (_, rang) => deuxChiffres(rang * PAS_MINUTES));

/** « 07:30 » → ["07", "30"] ; une valeur illisible → aucune heure. */
function decomposer(valeur: string): [string, string] | null {
  const morceaux = /^(\d{2}):(\d{2})$/.exec(valeur);
  return morceaux ? [morceaux[1], morceaux[2]] : null;
}

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  /** L'heure au format `HH:MM`, celui de `<input type="time">`. Chaîne vide : aucune heure. */
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder: string;
}

/**
 * Le pendant horaire de `SelecteurDate` : un bouton au gabarit des champs qui
 * ouvre, dans un `Popover`, une colonne d'heures et une colonne de minutes.
 *
 * Il remplace `<input type="time">`, dont le rendu appartient au navigateur
 * (« --:-- » et une horloge système sur Chrome, une roue sur iOS) et
 * qu'aucun jeton de la charte n'atteint. **La valeur échangée reste la
 * chaîne `HH:MM`** du champ natif : le schéma zod n'a rien à savoir du
 * changement. Une heure déjà saisie hors du pas de 5 min reste affichée et
 * sélectionnée telle quelle.
 */
export function SelecteurHeure({ valeur, onChange, placeholder, className, disabled, ...props }: Props) {
  const t = useTranslations("selecteurHeure");
  const [ouvert, setOuvert] = useState(false);
  const actuelle = decomposer(valeur);
  const [heure, minute] = actuelle ?? ["", ""];
  const minutes = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES;

  const choisir = (h: string, m: string) => onChange(`${h}:${m}`);

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-[var(--input-height)] w-full justify-start gap-2 rounded-md border-input bg-card px-[var(--input-padding-x)] text-base font-normal tabular-nums shadow-none hover:bg-card",
            "aria-invalid:border-destructive",
            !actuelle && "text-muted-foreground",
            className,
          )}
          {...props}
        >
          <Clock className="shrink-0 text-neutral-500" />
          <span className="truncate">{actuelle ? valeur : placeholder}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="flex w-auto gap-1 p-1" align="start">
        <Colonne
          libelle={t("heures")}
          valeurs={HEURES}
          choisie={heure}
          onChoisir={(h) => choisir(h, minute || MINUTES[0])}
        />
        <Colonne
          libelle={t("minutes")}
          valeurs={minutes}
          choisie={minute}
          onChoisir={(m) => {
            choisir(heure || HEURES[0], m);
            setOuvert(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function Colonne({
  libelle,
  valeurs,
  choisie,
  onChoisir,
}: {
  libelle: string;
  valeurs: readonly string[];
  choisie: string;
  onChoisir: (valeur: string) => void;
}) {
  const liste = useRef<HTMLDivElement>(null);

  // À l'ouverture, la valeur choisie est en vue plutôt qu'en bas de liste.
  useEffect(() => {
    liste.current?.querySelector<HTMLElement>("[aria-selected='true']")?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div
      ref={liste}
      role="listbox"
      aria-label={libelle}
      className="flex max-h-60 w-16 flex-col gap-0.5 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-neutral-200)_transparent]"
    >
      {valeurs.map((valeur) => {
        const choisi = valeur === choisie;
        return (
          <button
            key={valeur}
            type="button"
            role="option"
            aria-selected={choisi}
            onClick={() => onChoisir(valeur)}
            className={cn(
              "shrink-0 cursor-pointer rounded-md border-0 px-2 py-1.5 text-center text-sm tabular-nums transition-colors",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              choisi ? "bg-primary text-primary-foreground" : "bg-transparent text-neutral-800 hover:bg-neutral-100",
            )}
          >
            {valeur}
          </button>
        );
      })}
    </div>
  );
}

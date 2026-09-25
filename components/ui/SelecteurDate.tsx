"use client";

import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LOCALE_CALENDRIER } from "@/i18n/langue";
import { cn } from "@/lib/utils";

/** Le format d'échange : ISO court, celui des `<input type="date">` et du serveur. */
const FORMAT_ISO = "yyyy-MM-dd";

/** Le format lu à l'écran : « 23 septembre 2026 », selon la locale. */
const FORMAT_AFFICHAGE = "PPP";

/**
 * L'étendue de la liste des années, de part et d'autre de l'année en cours.
 * `react-day-picker` exige des bornes pour construire la liste ; elles sont
 * assez larges pour ne jamais gêner une saisie. Les bornes **métier**
 * (`auPlusTot`, `auPlusTard`) ne restreignent pas la liste : elles grisent
 * seulement les jours interdits.
 */
const ETENDUE_ANNEES = 100;

function versDate(valeur: string | undefined): Date | undefined {
  if (!valeur) return undefined;
  const date = parseISO(valeur);
  return isValid(date) ? date : undefined;
}

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  /** La date au format ISO court (`2026-09-23`). Chaîne vide : aucune date. */
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder: string;
  /** Les jours antérieurs à cette date (ISO court) ne sont pas proposés. */
  auPlusTot?: string;
  /** Les jours postérieurs à cette date (ISO court) ne sont pas proposés. */
  auPlusTard?: string;
}

/**
 * Le sélecteur de date de shadcn : un bouton qui ouvre un `Calendar` dans un
 * `Popover`.
 *
 * Il remplace `<input type="date">`, dont le rendu appartient au navigateur :
 * format « mm/dd/yyyy » sur un Chrome anglais, calendrier système sur mobile,
 * et aucune prise pour la charte. **La valeur échangée reste la chaîne ISO**
 * du champ natif, pour que le schéma zod et le serveur n'aient rien à savoir
 * du changement de composant.
 *
 * Le mois et l'année se choisissent dans deux listes déroulantes en tête du
 * calendrier : une date de fin à trois ans ne se cherche pas à coups de flèche
 * mois par mois.
 */
export function SelecteurDate({
  valeur,
  onChange,
  placeholder,
  auPlusTot,
  auPlusTard,
  className,
  disabled,
  ...props
}: Props) {
  const [ouvert, setOuvert] = useState(false);
  const date = versDate(valeur);
  const debutBorne = versDate(auPlusTot);
  const finBorne = versDate(auPlusTard);
  const anneeCourante = new Date().getFullYear();
  const premierMois = new Date(anneeCourante - ETENDUE_ANNEES, 0);
  const dernierMois = new Date(anneeCourante + ETENDUE_ANNEES, 11);
  const joursInterdits = [
    ...(debutBorne ? [{ before: debutBorne }] : []),
    ...(finBorne ? [{ after: finBorne }] : []),
  ];

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-[var(--input-height)] w-full justify-start gap-2 rounded-md border-input bg-card px-[var(--input-padding-x)] text-base font-normal shadow-none hover:bg-card",
            "aria-invalid:border-destructive",
            !date && "text-muted-foreground",
            className,
          )}
          {...props}
        >
          <CalendarIcon className="shrink-0 text-neutral-500" />
          <span className="truncate">
            {date ? format(date, FORMAT_AFFICHAGE, { locale: LOCALE_CALENDRIER }) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={premierMois}
          endMonth={dernierMois}
          selected={date}
          defaultMonth={date ?? debutBorne ?? finBorne}
          disabled={joursInterdits}
          onSelect={(jour) => {
            onChange(jour ? format(jour, FORMAT_ISO) : "");
            setOuvert(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

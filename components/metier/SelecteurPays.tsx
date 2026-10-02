"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PAYS } from "@/features/inscription/api";
import { nomDePays } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Drapeau } from "./Drapeau";

/** Les pays, dans l'ordre alphabétique de leur nom affiché. */
const PAYS_TRIES = [...PAYS].sort((a, b) =>
  nomDePays(a).localeCompare(nomDePays(b)),
);

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "id"> {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  disabled?: boolean;
  invalide?: boolean;
}

/**
 * Le pays de l'inscription — un bouton-combobox shadcn, drapeau compris.
 *
 * Un `<select>` natif ne peut pas montrer le drapeau à côté du nom : un
 * `<option>` ne contient jamais d'image (même contrainte que dans
 * `ChampTelephone`).
 *
 * Une seule liste, triée par nom, chaque pays suivi de son code ISO. Avec
 * plus de cinquante entrées, la recherche texte (« Nig ») devient le moyen
 * normal de choisir — elle porte aussi sur le code (« NG »).
 */
export function SelecteurPays({
  value,
  onChange,
  id,
  disabled,
  invalide,
  ...autresProps
}: Props) {
  const t = useTranslations("inscription");
  const [ouvert, setOuvert] = useState(false);

  function entree(code: string) {
    return (
      <CommandItem
        key={code}
        value={`${nomDePays(code)} ${code}`}
        onSelect={() => {
          onChange(code);
          setOuvert(false);
        }}
      >
        <Drapeau code={code} largeur={20} />
        {nomDePays(code)}
        <span className="ml-auto text-xs text-muted-foreground">{code}</span>
        <Check
          className={cn(
            value === code ? "opacity-100" : "opacity-0",
          )}
        />
      </CommandItem>
    );
  }

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={ouvert}
          aria-invalid={invalide || undefined}
          disabled={disabled}
          className="h-[var(--input-height)] w-full justify-between rounded-lg border-input bg-card px-[var(--input-padding-x)] font-normal shadow-none hover:bg-card"
          {...autresProps}
        >
          <span className="flex min-w-0 items-center gap-2">
            {value ? (
              <>
                <Drapeau code={value} largeur={20} />
                <span className="truncate">{nomDePays(value)}</span>
                <span className="text-xs text-muted-foreground">{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{t("champPaysChoisir")}</span>
            )}
          </span>
          <ChevronsUpDown className="shrink-0 text-primary" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t("champPaysRecherche")} />
          <CommandList>
            <CommandEmpty>{t("champPaysAucunResultat")}</CommandEmpty>
            <CommandGroup>{PAYS_TRIES.map(entree)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
 * `ChampTelephone`). La liste restant fermée aux neuf pays de M8, une
 * recherche texte est un confort, pas une nécessité — elle reste utile dès
 * qu'on tape « Sén » plutôt que de parcourir la liste au clavier.
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
              </>
            ) : (
              <span className="text-muted-foreground">{t("champPaysChoisir")}</span>
            )}
          </span>
          <ChevronsUpDown className="shrink-0 text-neutral-500" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t("champPaysRecherche")} />
          <CommandList>
            <CommandEmpty>{t("champPaysAucunResultat")}</CommandEmpty>
            <CommandGroup>
              {PAYS.map((code) => (
                <CommandItem
                  key={code}
                  value={nomDePays(code)}
                  onSelect={() => {
                    onChange(code);
                    setOuvert(false);
                  }}
                >
                  <Drapeau code={code} largeur={20} />
                  {nomDePays(code)}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === code ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type { OptionCombobox } from "@/components/ui/combobox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Props
  extends Omit<React.ComponentProps<"button">, "value" | "onChange" | "children"> {
  options: OptionCombobox[]
  valeurs: string[]
  onChange: (valeurs: string[]) => void
  placeholder: string
  placeholderRecherche: string
  aucunResultat: string
}

/**
 * Le `Combobox` à sélection multiple : même recette shadcn (`Popover` +
 * `Command`), mais la liste reste ouverte et chaque option se coche ou se
 * décoche. Le déclencheur affiche les libellés choisis, séparés par des
 * virgules.
 *
 * Comme `Combobox`, le bouton reçoit toutes les props restantes, pour que
 * `FormControl` y pose `id`, `aria-invalid` et `aria-describedby`.
 */
function ComboboxMultiple({
  options,
  valeurs,
  onChange,
  placeholder,
  placeholderRecherche,
  aucunResultat,
  className,
  disabled,
  ...props
}: Props) {
  const [ouvert, setOuvert] = React.useState(false)

  const affichage = options
    .filter((option) => valeurs.includes(option.valeur))
    .map((option) => option.libelle)
    .join(", ")

  function basculer(valeur: string) {
    onChange(
      valeurs.includes(valeur)
        ? valeurs.filter((existante) => existante !== valeur)
        : [...valeurs, valeur]
    )
  }

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={ouvert}
          disabled={disabled}
          className={cn(
            "h-[var(--input-height)] w-full justify-between rounded-md border-input bg-card px-[var(--input-padding-x)] text-base font-normal shadow-none hover:bg-card",
            "aria-invalid:border-destructive",
            className
          )}
          {...props}
        >
          <span className={cn("truncate", !affichage && "text-muted-foreground")}>
            {affichage || placeholder}
          </span>
          <ChevronsUpDownIcon className="shrink-0 text-neutral-500" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholderRecherche} />
          <CommandList>
            <CommandEmpty>{aucunResultat}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.valeur}
                  value={`${option.libelle} ${option.valeur}`}
                  onSelect={() => basculer(option.valeur)}
                >
                  {option.libelle}
                  <CheckIcon
                    className={cn(
                      "ml-auto",
                      valeurs.includes(option.valeur) ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { ComboboxMultiple }

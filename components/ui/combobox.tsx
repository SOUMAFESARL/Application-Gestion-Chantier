"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface OptionCombobox {
  valeur: string
  libelle: string
  /** Le titre du groupe sous lequel l'option se range. Absent : sans groupe. */
  groupe?: string
}

interface Props
  extends Omit<React.ComponentProps<"button">, "value" | "onChange" | "children"> {
  options: OptionCombobox[]
  valeur: string
  onChange: (valeur: string) => void
  placeholder: string
  placeholderRecherche: string
  aucunResultat: string
  /**
   * Autorise une valeur hors liste. La fonction reçoit la recherche en cours
   * et rend le libellé de l'entrée qui la valide (« Utiliser « Bingerville » »).
   * Absente, la liste est fermée.
   */
  libelleSaisieLibre?: (recherche: string) => string
}

/**
 * Le combobox de shadcn — un `Popover` qui contient un `Command` — rangé en
 * composant, parce que la recette de la documentation se recopie sinon à
 * chaque écran (voir `SelecteurPays`, qui la porte encore à la main pour
 * son drapeau).
 *
 * Le bouton déclencheur reçoit **toutes** les props restantes : `FormControl`
 * y pose l'`id`, `aria-invalid` et `aria-describedby`, et le libellé du
 * formulaire ne pointerait sur rien s'ils s'arrêtaient au composant.
 */
function Combobox({
  options,
  valeur,
  onChange,
  placeholder,
  placeholderRecherche,
  aucunResultat,
  libelleSaisieLibre,
  className,
  disabled,
  ...props
}: Props) {
  const [ouvert, setOuvert] = React.useState(false)
  const [recherche, setRecherche] = React.useState("")

  const selection = options.find((option) => option.valeur === valeur)
  // Une valeur hors liste (saisie libre) s'affiche telle quelle.
  const affichage = selection?.libelle ?? valeur

  const groupes = React.useMemo(() => {
    const ordre = new Map<string, OptionCombobox[]>()
    for (const option of options) {
      const cle = option.groupe ?? ""
      ordre.set(cle, [...(ordre.get(cle) ?? []), option])
    }
    return [...ordre.entries()]
  }, [options])

  const saisie = recherche.trim()
  const saisieProposee =
    libelleSaisieLibre !== undefined &&
    saisie !== "" &&
    !options.some(
      (option) => option.libelle.toLowerCase() === saisie.toLowerCase()
    )

  function choisir(nouvelleValeur: string) {
    onChange(nouvelleValeur)
    setRecherche("")
    setOuvert(false)
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
          <span
            className={cn(
              "truncate",
              !affichage && "text-muted-foreground"
            )}
          >
            {affichage || placeholder}
          </span>
          <ChevronsUpDownIcon className="shrink-0 text-neutral-500" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={placeholderRecherche}
            value={recherche}
            onValueChange={setRecherche}
          />
          <CommandList>
            {!saisieProposee && <CommandEmpty>{aucunResultat}</CommandEmpty>}

            {groupes.map(([groupe, membres]) => (
              <CommandGroup key={groupe} heading={groupe || undefined}>
                {membres.map((option) => (
                  <CommandItem
                    key={option.valeur}
                    value={`${option.libelle} ${option.valeur}`}
                    onSelect={() => choisir(option.valeur)}
                  >
                    {option.libelle}
                    <CheckIcon
                      className={cn(
                        "ml-auto",
                        valeur === option.valeur ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

            {saisieProposee && (
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  value={saisie}
                  onSelect={() => choisir(saisie)}
                >
                  <PlusIcon />
                  {libelleSaisieLibre(saisie)}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox }

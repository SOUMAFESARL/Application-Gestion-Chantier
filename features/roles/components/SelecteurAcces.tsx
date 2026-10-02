"use client";

import { CheckIcon, ChevronDownIcon, ChevronsUpDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { basculerAcces, rangAccesMax } from "../regles";
import { ACCES_MODULE } from "../types";
import type { AccesModule } from "../types";

/** « Aucun » en tête : il exclut les trois autres (voir `basculerAcces`). */
const OPTIONS = ["aucun", ...ACCES_MODULE] as const;

const PASTILLE = [
  "inline-flex items-center gap-1 rounded-sm border px-2 py-1",
  "text-xs font-medium whitespace-nowrap transition-all",
].join(" ");

/** Le champ de formulaire : même déclencheur que `ComboboxMultiple`. */
const CHAMP = [
  "inline-flex h-[var(--input-height)] w-full cursor-pointer items-center justify-between gap-2",
  "rounded-md border border-input bg-card px-[var(--input-padding-x)] text-base text-neutral-900",
  "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

/**
 * Le ton suit l'accès le plus élevé coché. Mêmes jetons sémantiques que
 * l'ancien sélecteur de niveau, pour que la matrice garde sa lecture.
 */
const TONS: Record<0 | 1 | 2 | 3, string> = {
  0: "border-neutral-200 bg-neutral-100 text-neutral-600",
  1: "border-secondary-200 bg-secondary-50 text-secondary-700",
  2: "border-avertissement/30 bg-avertissement-fond text-avertissement",
  3: "border-succes/30 bg-succes-fond text-succes",
};

/** Une permission redéfinie au niveau du chantier porte un filet à gauche. */
const SURCHARGE = "border-l-[3px] border-l-primary-500 font-bold";

interface Props {
  valeur: AccesModule[];
  onChange?: (acces: AccesModule[]) => void;
  /**
   * `pastille` (défaut) : cellule de matrice, accès abrégés (L · S · V).
   * `champ` : champ de formulaire pleine largeur, accès en toutes lettres.
   */
  variante?: "pastille" | "champ";
  estSurcharge?: boolean;
  libelleAria?: string;
  disabled?: boolean;
  /**
   * Classe ajoutée à la liste déroulante. Sert dans une `Modale` (`z-100`) :
   * la liste, portée hors de la modale en `z-50`, s'ouvrirait derrière elle.
   */
  classeListe?: string;
}

/**
 * Les accès d'un module, cochés dans une liste déroulante qui reste ouverte —
 * même recette que `ComboboxMultiple` (`Popover` + `Command`), sans recherche :
 * quatre options n'en ont pas besoin. Sans `onChange`, une simple pastille.
 */
export function SelecteurAcces({
  valeur,
  onChange,
  variante = "pastille",
  estSurcharge = false,
  libelleAria,
  disabled = false,
  classeListe,
}: Props) {
  const t = useTranslations("roles");
  const [ouvert, setOuvert] = useState(false);

  const estCoche = (option: (typeof OPTIONS)[number]) =>
    option === "aucun" ? valeur.length === 0 : valeur.includes(option);

  const complet = valeur.length === 0 ? t("acces.aucun") : valeur.map((a) => t(`acces.${a}`)).join(", ");
  const abrege =
    valeur.length === 0 ? t("acces.court.aucun") : valeur.map((a) => t(`acces.court.${a}`)).join(" · ");

  const pastille = cn(PASTILLE, TONS[rangAccesMax(valeur)], estSurcharge && SURCHARGE);
  const titre = estSurcharge ? `${complet} — ${t("surchargeChantier")}` : complet;

  if (!onChange) {
    return (
      <span className={pastille} title={titre}>
        {variante === "champ" ? complet : abrege}
      </span>
    );
  }

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={libelleAria}
          disabled={disabled}
          title={titre}
          className={variante === "champ" ? CHAMP : cn(pastille, "cursor-pointer")}
        >
          <span className="truncate">{variante === "champ" ? complet : abrege}</span>
          {variante === "champ" ? (
            <ChevronsUpDownIcon className="size-4 shrink-0 text-neutral-500" />
          ) : (
            <ChevronDownIcon className="size-3 shrink-0" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          "p-0",
          variante === "champ" ? "w-(--radix-popover-trigger-width)" : "w-44",
          classeListe,
        )}
        align="start"
      >
        <Command>
          <CommandList>
            <CommandGroup>
              {OPTIONS.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => onChange(basculerAcces(valeur, option, !estCoche(option)))}
                >
                  {t(`acces.${option}`)}
                  <CheckIcon className={cn("ml-auto", estCoche(option) ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * La légende de la matrice : chaque abréviation, en toutes lettres. Partagée
 * par la matrice de l'entreprise et celle du chantier.
 */
export function LegendeAcces() {
  const t = useTranslations("roles");
  const exemples: [string, AccesModule[]][] = [
    ["aucun", []],
    ...ACCES_MODULE.map((a): [string, AccesModule[]] => [a, [a]]),
  ];

  return (
    <>
      {exemples.map(([cle, acces]) => (
        <div key={cle} className="flex items-center gap-2">
          <SelecteurAcces valeur={acces} />
          <span>{t(`acces.${cle}`)}</span>
        </div>
      ))}
    </>
  );
}

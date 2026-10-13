"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  PAYS_TELEPHONE,
  analyserTelephone,
  composerTelephone,
  formaterNational,
  gabaritNational,
  paysTelephone,
} from "@/features/referentiels/telephone";
import { nomDePays } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Drapeau } from "./Drapeau";

interface Props {
  libelle: string;
  /** La valeur enregistrée — numéro international, `+2250700000000`. */
  valeur: string;
  /** Reçoit la valeur au même format. Chaîne vide quand le champ est vidé. */
  onChange: (valeur: string) => void;
  /**
   * Le pays proposé au départ — celui de l'entreprise. Il n'enferme rien :
   * une entreprise ivoirienne appelle des fournisseurs sénégalais.
   */
  paysDefaut: string;
  required?: boolean;
  erreur?: string;
  aide?: string;
  disabled?: boolean;
  /** Classes ajoutées au cadre du champ — un fond, par exemple. */
  className?: string;
}

/**
 * Saisie d'un numéro de téléphone, avec indicatif et drapeau.
 *
 * **Le champ ne stocke pas ce qu'il affiche.** À l'écran, « 07 00 00 00 00 » à
 * côté d'un drapeau ivoirien ; en base, `+2250700000000`. Les espaces sont un
 * confort de lecture, l'indicatif est une information — les mélanger, c'est ce
 * qui produisait des numéros dont on ne savait plus de quel pays ils étaient.
 *
 * Le sélecteur de pays est le **même combobox shadcn** que les autres listes
 * des formulaires (« Type de projet », la ville, le pays de l'inscription) :
 * un `Popover` qui contient un `Command`, avec recherche et drapeau dans
 * chaque entrée. L'ancien `<select>` natif rendu transparent ouvrait la liste
 * du système, d'une allure différente de tout le reste.
 *
 * Le pays reste **limité aux neuf pays de l'inscription**, décision en cours :
 * une entreprise peut travailler ailleurs, et ce jour-là la liste s'ouvrira.
 * En attendant, la même liste sert partout, et personne ne peut saisir un
 * indicatif que le produit ne connaît pas.
 */
export function ChampTelephone({
  libelle,
  valeur,
  onChange,
  paysDefaut,
  required = false,
  erreur,
  aide,
  disabled = false,
  className,
}: Props) {
  const t = useTranslations("telephone");
  const identifiant = useId();
  const [listeOuverte, setListeOuverte] = useState(false);
  const idAide = `${identifiant}-aide`;

  const { pays, national } = analyserTelephone(valeur, paysDefaut);
  const { indicatif, longueurMax } = paysTelephone(pays);
  const enErreur = Boolean(erreur);

  function auChangementDePays(code: string) {
    // Le numéro national **suit le changement de pays** : celui qui corrige
    // l'indicatif après avoir tapé le numéro ne veut pas le retaper.
    onChange(composerTelephone(code, national));
  }

  function auChangementDeNumero(saisie: string) {
    // Tout ce qui n'est pas un chiffre est écarté à la saisie — espaces,
    // points, tirets, le `+` d'un collage. La mise en forme est rendue juste
    // après, ce qui fait qu'un numéro collé depuis un email s'aligne tout seul.
    const chiffres = saisie.replace(/\D/g, "").slice(0, longueurMax);
    onChange(composerTelephone(pays, chiffres));
  }

  return (
    // `min-w-0` : sans lui, la largeur minimale du bloc pays — drapeau,
    // indicatif, chevron — remonte a la colonne de grille qui contient le
    // champ et ecrase sa voisine. Vu a l'etape 2 de l'assistant, ou « Client /
    // Maitre d'ouvrage » s'etait reduit a cinquante pixels.
    //
    // `@container` : le champ se mesure **lui-meme**, pas la fenetre. Il vit
    // dans une colonne de formulaire qui peut etre etroite sur un grand ecran.
    <div className="@container flex w-full min-w-0 flex-col gap-1">
      <Label htmlFor={identifiant}>
        {libelle}
        {required && (
          <span className="text-erreur" aria-hidden="true">
            *
          </span>
        )}
      </Label>

      {/* Le selecteur de pays et le numero forment **un seul champ** a l'oeil :
          une bordure commune, et le focus l'eclaire en entier. Deux champs cote
          a cote laisseraient croire a deux informations distinctes. */}
      <div
        data-champ=""
        className={cn(
          "flex h-[var(--input-height)] items-stretch overflow-hidden rounded-md border border-input bg-card",
          "transition-[border-color,box-shadow]",
          "focus-within:border-primary-500 focus-within:shadow-[var(--shadow-focus)]",
          enErreur && "border-erreur",
          disabled && "bg-neutral-100",
          className,
        )}
      >
        {/* Sous 260 px de champ, l'indicatif ecrit disparait : le drapeau et le
            chevron suffisent a dire quel pays est choisi, et les dix chiffres
            du numero ont besoin de toute la place. Le selecteur continue de
            l'annoncer. */}
        <Popover open={listeOuverte} onOpenChange={setListeOuverte} modal>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-expanded={listeOuverte}
              aria-label={t("choisirPays")}
              disabled={disabled}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 border-0 border-r border-solid border-input bg-neutral-50 pr-2 pl-3 outline-none disabled:cursor-not-allowed @max-[260px]:px-2"
            >
              <Drapeau code={pays} largeur={22} />
              <span className="text-base whitespace-nowrap text-neutral-900 tabular-nums @max-[260px]:hidden">
                {indicatif}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
            </button>
          </PopoverTrigger>

          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder={t("rechercherPays")} />
              <CommandList>
                <CommandEmpty>{t("aucunPays")}</CommandEmpty>
                <CommandGroup>
                  {PAYS_TELEPHONE.map((option) => (
                    <CommandItem
                      key={option.code}
                      value={`${nomDePays(option.code)} ${option.indicatif} ${option.code}`}
                      onSelect={() => {
                        auChangementDePays(option.code);
                        setListeOuverte(false);
                      }}
                    >
                      <Drapeau code={option.code} largeur={20} />
                      {nomDePays(option.code)}
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {option.indicatif}
                      </span>
                      <Check
                        className={cn(option.code === pays ? "opacity-100" : "opacity-0")}
                        aria-hidden="true"
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <input
          id={identifiant}
          className="min-w-0 flex-1 border-0 bg-transparent px-[var(--input-padding-x)] text-base tracking-[0.02em] text-neutral-900 tabular-nums outline-none disabled:cursor-not-allowed disabled:text-neutral-500"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={gabaritNational(pays)}
          value={formaterNational(pays, national)}
          onChange={(evenement) => auChangementDeNumero(evenement.target.value)}
          disabled={disabled}
          required={required}
          aria-invalid={enErreur || undefined}
          aria-required={required || undefined}
          aria-describedby={erreur || aide ? idAide : undefined}
        />
      </div>

      {(erreur || aide) && (
        <p
          id={idAide}
          className={cn("mt-0.5 text-xs", enErreur ? "text-erreur" : "text-neutral-500")}
        >
          {erreur ?? aide}
        </p>
      )}
    </div>
  );
}

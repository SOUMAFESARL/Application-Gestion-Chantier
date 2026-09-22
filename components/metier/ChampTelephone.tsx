"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

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
}

/**
 * Saisie d'un numéro de téléphone, avec indicatif et drapeau.
 *
 * **Le champ ne stocke pas ce qu'il affiche.** À l'écran, « 07 00 00 00 00 » à
 * côté d'un drapeau ivoirien ; en base, `+2250700000000`. Les espaces sont un
 * confort de lecture, l'indicatif est une information — les mélanger, c'est ce
 * qui produisait des numéros dont on ne savait plus de quel pays ils étaient.
 *
 * Le sélecteur de pays est un `<select>` **natif rendu transparent**, posé sur
 * le drapeau et l'indicatif qu'on voit. Un `<option>` ne peut pas contenir
 * d'image : la seule façon d'avoir un drapeau *et* le sélecteur du système —
 * la roue crantée sur mobile, les flèches au clavier, l'annonce par le lecteur
 * d'écran — est de superposer les deux.
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
}: Props) {
  const t = useTranslations("telephone");
  const identifiant = useId();
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
      <label
        className="flex items-center gap-1 text-[13px] font-semibold text-neutral-800"
        htmlFor={identifiant}
      >
        {libelle}
        {required && (
          <span className="text-erreur" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {/* Le selecteur de pays et le numero forment **un seul champ** a l'oeil :
          une bordure commune, et le focus l'eclaire en entier. Deux champs cote
          a cote laisseraient croire a deux informations distinctes. */}
      <div
        className={cn(
          "flex h-12 items-stretch overflow-hidden rounded-md border border-neutral-300 bg-neutral-0",
          "transition-[border-color,box-shadow]",
          "focus-within:border-primary-500 focus-within:shadow-[var(--shadow-focus)]",
          enErreur && "border-erreur",
          disabled && "bg-neutral-100",
        )}
      >
        {/* Sous 260 px de champ, l'indicatif ecrit disparait : le drapeau et le
            chevron suffisent a dire quel pays est choisi, et les dix chiffres
            du numero ont besoin de toute la place. Le selecteur continue de
            l'annoncer. */}
        <div className="relative flex shrink-0 items-center gap-1 border-r border-neutral-200 bg-neutral-50 pr-2 pl-3 @max-[260px]:px-2">
          <Drapeau code={pays} largeur={22} />
          <span className="text-[15px] whitespace-nowrap text-neutral-900 tabular-nums @max-[260px]:hidden">
            {indicatif}
          </span>
          <span
            className="size-2 shrink-0 border-r-[1.5px] border-b-[1.5px] border-neutral-500 [transform:rotate(45deg)_translate(-2px,-2px)]"
            aria-hidden="true"
          />
          {/* Invisible, mais bien **present** : c'est lui qui recoit le clavier,
              le focus et la roue crantee du selecteur natif sur mobile.
              `text-transparent` plutot qu'une opacite nulle — un element a
              opacite zero passe pour masque aupres d'une partie de l'outillage
              d'accessibilite, alors qu'il porte ici le seul libelle du choix de
              pays. Le texte disparait, le controle reste.
              `text-base` : iOS zoome sous 16 px. */}
          <select
            className="absolute inset-0 size-full cursor-pointer appearance-none border-0 bg-transparent text-base text-transparent disabled:cursor-not-allowed"
            value={pays}
            onChange={(evenement) => auChangementDePays(evenement.target.value)}
            disabled={disabled}
            aria-label={t("choisirPays")}
          >
            {PAYS_TELEPHONE.map((option) => (
              <option key={option.code} value={option.code}>
                {`${nomDePays(option.code)} (${option.indicatif})`}
              </option>
            ))}
          </select>
        </div>

        <input
          id={identifiant}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 text-[15px] tracking-[0.02em] text-neutral-900 tabular-nums outline-none disabled:cursor-not-allowed disabled:text-neutral-500"
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

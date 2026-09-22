"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { listerVilles, villeConnue } from "@/features/referentiels/villes";
import { nomDePays } from "@/lib/format";
import { cn } from "@/lib/utils";

const CODE_OPTION_AUTRE = "__autre__";

/**
 * Le select et le champ de saisie libre partagent exactement la meme allure :
 * a l'oeil, c'est le meme champ qui change de nature, pas un second champ.
 *
 * Le rouge vient de `erreur`, le jeton de la charte. L'ancienne feuille lisait
 * `--color-danger-500`, qui n'a jamais existe dans `tokens.css` : elle tombait
 * donc sur sa valeur de repli codee en dur, un rouge etranger a la palette.
 */
const CHAMP = [
  "h-12 w-full cursor-pointer rounded-md border border-neutral-300 bg-neutral-0 px-3",
  "text-[15px] text-neutral-900 outline-none transition-[border-color,box-shadow]",
  "focus:border-primary-500 focus:shadow-[var(--shadow-focus)]",
  "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
].join(" ");

const CHAMP_ERREUR = "border-erreur";

const MESSAGE = "mt-0.5 text-xs";

interface Props {
  /**
   * Le code ISO du pays qui gouverne la liste — celui de l'entreprise, choisi
   * à l'inscription. Vide tant qu'il n'est pas connu : le champ reste alors en
   * saisie libre plutôt que de proposer les villes d'un pays au hasard.
   */
  pays: string;
  valeur: string;
  onChange: (nouvelleValeur: string) => void;
  libelle?: string;
  required?: boolean;
  erreur?: string;
  disabled?: boolean;
  aide?: string;
}

/**
 * Choix d'une localité, dans le pays de l'entreprise.
 *
 * **La liste suit le pays, et le pays vient du serveur.** Une entreprise
 * sénégalaise à qui l'on propose Cocody et Yopougon n'a rien à en faire — et
 * c'est ce qu'elle voyait, la liste étant ivoirienne en dur.
 *
 * Trois cas, et le troisième est celui qu'on oublie :
 *
 * 1. le pays a une agglomération découpée en communes — Abidjan, Dakar,
 *    Conakry : deux groupes, parce que personne ne dit « Abidjan » pour situer
 *    un chantier, on dit « Cocody » ;
 * 2. le pays a une liste simple — un seul groupe ;
 * 3. **le pays n'a pas de liste du tout** : le champ devient un champ texte.
 *    Une liste déroulante vide n'a aucune sortie ; un champ texte, oui.
 *
 * L'option de saisie libre existe dans tous les cas : le référentiel porte les
 * villes et les chefs-lieux, pas le village où se monte la base-vie.
 */
export function SelecteurVille({
  pays,
  valeur,
  onChange,
  libelle,
  required = false,
  erreur,
  disabled = false,
  aide,
}: Props) {
  const t = useTranslations("referentielVilles");
  const identifiant = useId();
  const { agglomeration, communes, autres } = listerVilles(pays);
  const listeDisponible = communes.length + autres.length > 0;

  // Rétrocompatibilité : une valeur enregistrée sous la forme « Abidjan - Cocody »
  // se réconcilie avec le nom canonique de la commune.
  const valeurCanonique = valeur?.startsWith("Abidjan - ")
    ? valeur.replace(/^Abidjan\s*-\s*/i, "")
    : valeur;

  const estPredefinie = villeConnue(pays, valeurCanonique);
  const [choixAutreManuel, setChoixAutreManuel] = useState(false);

  const modePersonnalise =
    !listeDisponible || choixAutreManuel || (!estPredefinie && Boolean(valeur));
  const valeurSelect = modePersonnalise
    ? CODE_OPTION_AUTRE
    : estPredefinie
      ? valeurCanonique
      : "";

  function auChangementDeSelection(evenement: React.ChangeEvent<HTMLSelectElement>) {
    const choix = evenement.target.value;
    if (choix === CODE_OPTION_AUTRE) {
      setChoixAutreManuel(true);
      if (estPredefinie) onChange("");
      return;
    }
    setChoixAutreManuel(false);
    onChange(choix);
  }

  const libellePays = pays ? nomDePays(pays) : "";
  const messageAide = !listeDisponible
    ? libellePays
      ? t("aideSansListe", { pays: libellePays })
      : undefined
    : modePersonnalise
      ? t("aidePersonnalisee")
      : (aide ?? (libellePays ? t("aideStandard", { pays: libellePays }) : undefined));

  return (
    <div className="flex w-full flex-col gap-1">
      <label
        className="flex items-center gap-1 text-[13px] font-semibold text-neutral-800"
        htmlFor={identifiant}
      >
        <span>{libelle ?? t("libelleDefaut")}</span>
        {required && (
          <span className="text-erreur" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {listeDisponible && (
        <select
          id={identifiant}
          className={cn(CHAMP, erreur && CHAMP_ERREUR)}
          value={valeurSelect}
          onChange={auChangementDeSelection}
          disabled={disabled}
          required={required}
        >
          <option value="" disabled>
            {t("choisir")}
          </option>

          {communes.length > 0 ? (
            <>
              <optgroup label={t("groupeAgglomeration", { agglomeration })}>
                {communes.map((nom) => (
                  <option key={nom} value={nom}>
                    {nom}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t("groupeAutres")}>
                {autres.map((nom) => (
                  <option key={nom} value={nom}>
                    {nom}
                  </option>
                ))}
              </optgroup>
            </>
          ) : (
            autres.map((nom) => (
              <option key={nom} value={nom}>
                {nom}
              </option>
            ))
          )}

          <option value={CODE_OPTION_AUTRE}>{t("optionPersonnalisee")}</option>
        </select>
      )}

      {modePersonnalise && (
        <div className={listeDisponible ? "mt-2" : undefined}>
          <input
            id={listeDisponible ? undefined : identifiant}
            type="text"
            className={cn(CHAMP, erreur && CHAMP_ERREUR)}
            placeholder={t("placeholderPersonnalise")}
            value={valeur}
            onChange={(evenement) => onChange(evenement.target.value)}
            disabled={disabled}
            required={required}
          />
        </div>
      )}

      {erreur ? (
        <p className={cn(MESSAGE, "text-erreur")}>{erreur}</p>
      ) : (
        messageAide && <p className={cn(MESSAGE, "text-neutral-500")}>{messageAide}</p>
      )}
    </div>
  );
}

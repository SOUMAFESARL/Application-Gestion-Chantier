"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ComponentProps } from "react";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { Alerte, Bouton, Modale } from "@/components/ui";
import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { ErreurApi } from "@/lib/api";

import { cleTiers, creerTiers, listerTiers } from "../adaptateur";
import type { RoleTiers } from "../types";

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  /** `CLIENT_MOA` (maître d'ouvrage) ou `MAITRE_OEUVRE` (maître d'œuvre). */
  role: RoleTiers;
  /** La raison sociale retenue — le projet garde le nom, pas l'identifiant. */
  valeur: string;
  onChange: (valeur: string) => void;
  /** Le pays proposé pour le téléphone d'un tiers ajouté. */
  paysDefaut: string;
}

/**
 * Un maître d'ouvrage ou d'œuvre, choisi parmi les tiers de l'entreprise qui
 * ont ce rôle. Un nom absent de la liste s'ajoute sur place : le combobox
 * propose « Ajouter « … » », une modale demande le téléphone (obligatoire
 * pour un tiers), et le tiers créé est aussitôt proposé à tous.
 */
export function ComboboxTiers({ role, valeur, onChange, paysDefaut, ...props }: Props) {
  const t = useTranslations("tiersAjoutRapide");
  const cache = useQueryClient();
  const [aCreer, setACreer] = useState<string | null>(null);
  const [telephone, setTelephone] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: cleTiers(role),
    queryFn: ({ signal }) => listerTiers(role, signal),
  });

  const options: OptionCombobox[] = (requete.data ?? []).map((tiers) => ({
    valeur: tiers.raisonSociale,
    libelle: tiers.raisonSociale,
  }));

  const creation = useMutation({
    mutationFn: () =>
      creerTiers({ raisonSociale: aCreer ?? "", telephone, role }),
    onSuccess: (tiers) => {
      void cache.invalidateQueries({ queryKey: ["tiers"] });
      onChange(tiers.raisonSociale);
      fermer();
    },
    onError: (cause) =>
      setErreur(cause instanceof ErreurApi ? cause.message : t("erreur")),
  });

  function fermer() {
    setACreer(null);
    setTelephone("");
    setErreur(null);
  }

  function choisir(choix: string) {
    if (options.some((option) => option.valeur === choix)) {
      onChange(choix);
    } else {
      setErreur(null);
      setACreer(choix);
    }
  }

  return (
    <>
      <Combobox
        options={options}
        valeur={valeur}
        onChange={choisir}
        placeholder={t("selectionner")}
        placeholderRecherche={t("rechercher")}
        aucunResultat={t("aucun")}
        libelleSaisieLibre={(saisie) => t("ajouter", { saisie })}
        {...props}
      />

      <Modale
        ouverte={aCreer !== null}
        titre={t(`titre.${role}`)}
        onFermer={creation.isPending ? undefined : fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer} disabled={creation.isPending}>
              {t("annuler")}
            </Bouton>
            <Bouton
              disabled={!aCreer?.trim() || !telephone || creation.isPending}
              enCours={creation.isPending}
              onClick={() => creation.mutate()}
            >
              {t("creer")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tiers-raison-sociale" className="text-sm font-medium text-neutral-800">
              {t("raisonSociale")}
            </label>
            <Input
              id="tiers-raison-sociale"
              value={aCreer ?? ""}
              maxLength={200}
              disabled={creation.isPending}
              onChange={(e) => setACreer(e.target.value)}
            />
          </div>
          <ChampTelephone
            libelle={t("telephone")}
            paysDefaut={paysDefaut}
            international
            required
            valeur={telephone}
            disabled={creation.isPending}
            onChange={setTelephone}
          />
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        </div>
      </Modale>
    </>
  );
}

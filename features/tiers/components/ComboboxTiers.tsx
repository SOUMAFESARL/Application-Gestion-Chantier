"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ComponentProps } from "react";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { Alerte, Bouton, Modale } from "@/components/ui";
import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErreurApi } from "@/lib/api";

import { cleTiers, creerTiers, listerTiers } from "../adaptateur";
import { CLES_TIERS } from "../cles";
import { erreurTelephoneTiers, telephoneTiersValide } from "../regles";
import { ROLES_TIERS, type RoleTiers } from "../types";

interface Props extends Omit<ComponentProps<"button">, "value" | "onChange" | "children"> {
  /** Rôle filtré (ex. `CLIENT_MOA`, `MAITRE_OEUVRE`). Omis : tous les tiers actifs. */
  role?: RoleTiers;
  /** La raison sociale retenue — le projet garde le nom, pas l'identifiant. */
  valeur: string;
  onChange: (valeur: string) => void;
  /** Le pays proposé pour le téléphone d'un tiers ajouté. */
  paysDefaut: string;
}

/**
 * Sélecteur de tiers actif, filtré par rôle si précisé ou sur l'ensemble des
 * tiers actifs de l'entreprise. Un nom absent se crée sur place via une
 * modale avec `ChampTelephone`, puis devient immédiatement sélectionnable.
 */
export function ComboboxTiers({ role, valeur, onChange, paysDefaut, ...props }: Props) {
  const t = useTranslations("tiersAjoutRapide");
  const tRoles = useTranslations("tiers.roles");
  const cache = useQueryClient();
  const [aCreer, setACreer] = useState<string | null>(null);
  const [roleChoisi, setRoleChoisi] = useState<RoleTiers>(role ?? "SOUS_TRAITANT");
  const [telephone, setTelephone] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const numeroValide = telephoneTiersValide(telephone, paysDefaut);
  const erreurTelephone = erreurTelephoneTiers(telephone, paysDefaut);

  const requete = useQuery({
    queryKey: cleTiers(role),
    queryFn: ({ signal }) => listerTiers(role, signal),
  });

  const options: OptionCombobox[] = (requete.data ?? []).map((tiers) => ({
    valeur: tiers.raisonSociale,
    libelle: tiers.raisonSociale,
  }));

  const roleCreation = role ?? roleChoisi;

  const creation = useMutation({
    mutationFn: () =>
      creerTiers({
        raisonSociale: aCreer ?? "",
        telephone,
        role: roleCreation,
      }),
    onSuccess: (tiers) => {
      void cache.invalidateQueries({ queryKey: CLES_TIERS.tous });
      onChange(tiers.raisonSociale);
      fermer();
    },
    onError: (cause) =>
      setErreur(cause instanceof ErreurApi ? cause.message : t("erreur")),
  });

  function fermer() {
    setACreer(null);
    setRoleChoisi(role ?? "SOUS_TRAITANT");
    setTelephone("");
    setErreur(null);
  }

  function choisir(choix: string) {
    if (options.some((option) => option.valeur === choix)) {
      onChange(choix);
    } else {
      setErreur(null);
      setRoleChoisi(role ?? "SOUS_TRAITANT");
      setACreer(choix);
    }
  }

  const titreModale = role && t.has(`titre.${role}`) ? t(`titre.${role}`) : t("titreDefaut");

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
        titre={titreModale}
        onFermer={creation.isPending ? undefined : fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer} disabled={creation.isPending}>
              {t("annuler")}
            </Bouton>
            <Bouton
              disabled={!aCreer?.trim() || !numeroValide || creation.isPending}
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
          {!role && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-neutral-800">{t("role")}</span>
              <Select
                value={roleChoisi}
                onValueChange={(v) => setRoleChoisi(v as RoleTiers)}
                disabled={creation.isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_TIERS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {tRoles(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <ChampTelephone
            libelle={t("telephone")}
            paysDefaut={paysDefaut}
            international
            required
            valeur={telephone}
            erreur={erreurTelephone}
            disabled={creation.isPending}
            onChange={setTelephone}
          />
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        </div>
      </Modale>
    </>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import type { Droits } from "@/features/habilitations/types";
import type { Projet } from "@/features/projets/types";
import { AUCUN_GESTE, gestesCumules, gestesStock, indexer } from "@/features/stocks";
import type { DonneesStock, GestesStock, Materiau, OngletStock, TypeTache } from "@/features/stocks";
import { CLE_STOCK } from "@/features/stocks/cles";
import { ErreurApi } from "@/lib/api";
import { formaterQuantite } from "@/lib/format";

/**
 * Ce que tous les onglets du stock lisent : les données déjà réduites aux
 * chantiers du compte (et au chantier choisi), les gestes permis sur chacun,
 * et les libellés des références croisées. Un contexte plutôt que dix props
 * répétées dans huit onglets et autant de tiroirs.
 */

/** Ce que « À faire » demande d'ouvrir : un onglet, et la pièce à y ouvrir. */
export interface Intention {
  onglet: OngletStock;
  type: TypeTache;
  cible: string;
}

interface ValeurContexteStock {
  donnees: DonneesStock;
  /** Les chantiers du compte, réduits au chantier choisi s'il y en a un. */
  projets: Projet[];
  /** Tous les chantiers du compte — un transfert inter-chantiers peut viser l'un d'eux. */
  tousProjets: Projet[];
  droits: Droits | null;
  gestes: GestesStock;
  gestesDe: (projetId: string) => GestesStock;
  materiau: (id: string) => Materiau | undefined;
  libelleMateriau: (id: string) => string;
  libelleLot: (lotId: string) => string;
  libelleProjet: (projetId: string) => string;
  quantite: (valeur: number, materiauId: string) => string;
  actualiser: () => Promise<void>;
  /** Le message d'un échec d'écriture, en toast (jamais de bandeau dans la page). */
  signalerEchec: (erreur: unknown) => void;
  ouvrir: (intention: Intention) => void;
}

const Contexte = createContext<ValeurContexteStock | null>(null);

export function FournisseurStock({
  donnees,
  projets,
  tousProjets,
  droits,
  ouvrir,
  children,
}: {
  donnees: DonneesStock;
  projets: Projet[];
  tousProjets: Projet[];
  droits: Droits | null;
  ouvrir: (intention: Intention) => void;
  children: ReactNode;
}) {
  const t = useTranslations("stocks");
  const clientRequetes = useQueryClient();

  const valeur = useMemo<ValeurContexteStock>(() => {
    const materiaux = indexer(donnees.materiaux);
    const lots = indexer(donnees.lots);
    const projetsParId = indexer(tousProjets);
    const gestesParProjet = new Map(tousProjets.map((p) => [p.id, gestesStock(droits, p)]));
    return {
      donnees,
      projets,
      tousProjets,
      droits,
      gestes: gestesCumules(droits, projets),
      gestesDe: (projetId) => gestesParProjet.get(projetId) ?? AUCUN_GESTE,
      materiau: (id) => materiaux.get(id),
      libelleMateriau: (id) => materiaux.get(id)?.designation ?? t("articleInconnu"),
      libelleLot: (lotId) => {
        const lot = lots.get(lotId);
        return lot ? t("libelleLot", { code: lot.code, nom: lot.nom }) : t("lotInconnu");
      },
      libelleProjet: (projetId) =>
        projetsParId.get(projetId)?.nom ?? donnees.lots.find((l) => l.projetId === projetId)?.projetNom ?? t("projetInconnu"),
      quantite: (valeur, materiauId) =>
        t("quantiteUnite", { quantite: formaterQuantite(valeur), unite: materiaux.get(materiauId)?.unite ?? "" }),
      actualiser: async () => {
        await clientRequetes.invalidateQueries({ queryKey: CLE_STOCK });
      },
      signalerEchec: (erreur) =>
        toast.error(erreur instanceof ErreurApi && erreur.message ? erreur.message : t("erreurGenerique")),
      ouvrir,
    };
  }, [donnees, projets, tousProjets, droits, ouvrir, t, clientRequetes]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useStock(): ValeurContexteStock {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error("useStock hors de FournisseurStock");
  return valeur;
}

/** Une écriture : l'appel, le toast de succès, la relecture. L'échec part en toast. */
export function useEcriture() {
  const { actualiser, signalerEchec } = useStock();
  return useCallback(
    async <T,>(appel: () => Promise<T>, succes: string): Promise<T | null> => {
      try {
        const resultat = await appel();
        toast.success(succes);
        await actualiser();
        return resultat;
      } catch (erreur) {
        signalerEchec(erreur);
        return null;
      }
    },
    [actualiser, signalerEchec],
  );
}

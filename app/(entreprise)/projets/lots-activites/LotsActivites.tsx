"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { useProjetsVisibles } from "@/features/habilitations";
import { lireStatistiques, listerLots } from "@/features/projets/adaptateur";
import { CLE_LISTE_PROJETS, cleLots, cleProjet, cleStatistiques } from "@/features/projets/cles";
import { TiroirActivite } from "@/features/projets/components/TiroirActivite";
import { ModaleSuppressionActivite } from "@/features/projets/components/ModaleSuppressionActivite";
import { ModaleSuppressionLot } from "@/features/projets/components/ModaleSuppressionLot";
import { TiroirLot } from "@/features/projets/components/TiroirLot";
import {
  activiteAMontrer,
  activitesDuProjet,
  projetOuvert,
  syntheseLots,
} from "@/features/projets/regles";
import type { Activite, Lot, StatutActivite } from "@/features/projets/types";

import { BarreProjet, Indicateur, Onglets } from "../EnteteChantier";
import { PanneauActivite } from "./PanneauActivite";
import { PlanningLots } from "./PlanningLots";
import { StructureLots } from "./StructureLots";

type Onglet = "structure" | "planning";
const ONGLETS: readonly Onglet[] = ["structure", "planning"];

/**
 * L'écran « Lots & activités » : la structure d'un chantier.
 *
 * Le sélecteur de chantier, quatre chiffres dessous (lots, activités,
 * avancement pondéré, retards), puis deux vues : la **structure** — l'arbre lots →
 * activités, avec le détail de l'activité choisie — et le **planning**, les
 * mêmes activités sur une frise.
 *
 * **Aucun calcul ici.** Statut d'une activité, avancement d'un lot, période,
 * recherche : tout vient de `features/projets/regles`. Le composant ne garde
 * que ce que l'utilisateur a choisi — un chantier, un onglet, une activité.
 */
export function LotsActivites({ projetInitial }: { projetInitial?: string }) {
  const t = useTranslations("projets.lotsActivites");
  const clientRequetes = useQueryClient();

  const [projetChoisi, setProjetChoisi] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("structure");
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState<StatutActivite | "">("");
  const [activiteChoisie, setActiviteChoisie] = useState<string | null>(null);

  const [tiroirActivite, setTiroirActivite] = useState<{
    ouvert: boolean;
    activite: Activite | null;
    lotId: string;
  }>({ ouvert: false, activite: null, lotId: "" });
  const [tiroirLot, setTiroirLot] = useState<{ ouvert: boolean; lot: Lot | null }>({
    ouvert: false,
    lot: null,
  });
  const [lotASupprimer, setLotASupprimer] = useState<Lot | null>(null);
  const [activiteASupprimer, setActiviteASupprimer] = useState<Activite | null>(null);
  /**
   * Le rang de la dernière ouverture d'un tiroir, qui lui sert de `key` : il
   * est remonté à chaque fois et repart de sa saisie initiale, sans effet de
   * remise à zéro à synchroniser.
   */
  const [ouverture, setOuverture] = useState(0);

  // Hors direction, le sélecteur ne propose que ses chantiers.
  const requeteProjets = useProjetsVisibles();
  const projets = useMemo(() => requeteProjets.data ?? [], [requeteProjets.data]);
  const projetId = projetChoisi ?? projetOuvert(projets, projetInitial)?.id ?? null;

  const requeteLots = useQuery({
    queryKey: cleLots(projetId ?? ""),
    queryFn: ({ signal }) => listerLots(projetId as string, signal),
    enabled: projetId !== null,
  });
  const lots = useMemo(() => requeteLots.data ?? [], [requeteLots.data]);

  const requeteStatistiques = useQuery({
    queryKey: cleStatistiques(projetId ?? ""),
    queryFn: ({ signal }) => lireStatistiques(projetId as string, signal),
    enabled: projetId !== null,
  });
  // Les chiffres du serveur quand il les tient ; sinon, ceux des lots affichés.
  const synthese = useMemo(
    () => requeteStatistiques.data ?? syntheseLots(lots),
    [requeteStatistiques.data, lots],
  );

  /**
   * L'activité du panneau : celle qu'on a choisie si elle existe encore dans
   * ce chantier, sinon celle que les règles désignent (la première en retard).
   */
  const activite = useMemo(
    () =>
      activitesDuProjet(lots).find((candidate) => candidate.id === activiteChoisie) ??
      activiteAMontrer(lots),
    [lots, activiteChoisie],
  );
  const lotDeActivite = activite ? (lots.find((lot) => lot.id === activite.lotId) ?? null) : null;

  function changerProjet(id: string) {
    setProjetChoisi(id);
    setActiviteChoisie(null);
    setRecherche("");
    setStatut("");
  }

  /**
   * Sans lot désigné, le tiroir propose celui de l'activité affichée, sinon
   * le premier : c'est presque toujours là qu'on ajoute la suivante.
   */
  function ouvrirTiroirActivite(activite: Activite | null, lotId?: string) {
    setOuverture((rang) => rang + 1);
    setTiroirActivite({
      ouvert: true,
      activite,
      lotId: lotId || lotDeActivite?.id || lots[0]?.id || "",
    });
  }

  /**
   * Après une écriture sur les lots : les lots eux-mêmes, et le chantier, dont
   * le serveur recompte les chiffres de structure.
   */
  function rafraichirStructure(id: string) {
    void clientRequetes.invalidateQueries({ queryKey: cleLots(id) });
    void clientRequetes.invalidateQueries({ queryKey: cleStatistiques(id) });
    void clientRequetes.invalidateQueries({ queryKey: cleProjet(id) });
    void clientRequetes.invalidateQueries({ queryKey: CLE_LISTE_PROJETS });
  }

  /** Sans lot, le tiroir en ajoute ; avec, il le modifie. */
  function ouvrirTiroirLot(lot: Lot | null = null) {
    setOuverture((rang) => rang + 1);
    setTiroirLot({ ouvert: true, lot });
  }

  function surActiviteEnregistree(enregistree: Activite) {
    setActiviteChoisie(enregistree.id);
    if (projetId) rafraichirStructure(projetId);
  }

  function surLotCree(lot: Lot) {
    if (!projetId) return;
    // Le lot est posé dans le cache avant le rechargement : il apparaît au
    // moment où le tiroir se referme.
    clientRequetes.setQueryData<Lot[]>(cleLots(projetId), (anciens) => [...(anciens ?? []), lot]);
    rafraichirStructure(projetId);
  }

  function surLotModifie(modifie: Lot) {
    if (!projetId) return;
    clientRequetes.setQueryData<Lot[]>(cleLots(projetId), (anciens) =>
      (anciens ?? []).map((lot) => (lot.id === modifie.id ? modifie : lot)),
    );
    rafraichirStructure(projetId);
  }

  function surLotSupprime(supprime: Lot) {
    if (!projetId) return;
    clientRequetes.setQueryData<Lot[]>(cleLots(projetId), (anciens) =>
      (anciens ?? []).filter((lot) => lot.id !== supprime.id),
    );
    rafraichirStructure(projetId);
  }

  function surActiviteSupprimee(supprimee: Activite) {
    if (!projetId) return;
    clientRequetes.setQueryData<Lot[]>(cleLots(projetId), (anciens) =>
      (anciens ?? []).map((lot) =>
        lot.id === supprimee.lotId
          ? { ...lot, activites: lot.activites.filter((activite) => activite.id !== supprimee.id) }
          : lot,
      ),
    );
    // Le panneau passe à l'activité que les règles désignent.
    setActiviteChoisie(null);
    rafraichirStructure(projetId);
  }

  function surLotsImportes(importes: Lot[]) {
    if (!projetId) return;
    clientRequetes.setQueryData<Lot[]>(cleLots(projetId), (anciens) => [...(anciens ?? []), ...importes]);
    rafraichirStructure(projetId);
  }

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre={t("titre")} description={t("description")} />

      {requeteProjets.isPending && <EtatChargement />}
      {requeteProjets.isError && <EtatErreur onReessayer={() => void requeteProjets.refetch()} />}
      {requeteProjets.isSuccess && projets.length === 0 && (
        <EtatVide titre={t("aucunProjetTitre")} description={t("aucunProjet")} />
      )}

      {projetId && (
        <>
          <BarreProjet projets={projets} projetId={projetId} onChanger={changerProjet} />

          <section className="grid grid-cols-4 gap-4 max-lg:grid-cols-2" aria-live="polite">
            <Indicateur
              libelle={t("indicateurs.lots")}
              valeur={String(synthese.lots)}
              fond="primaire"
            />
            <Indicateur
              libelle={t("indicateurs.activites")}
              valeur={String(synthese.activites)}
              fond="secondaire"
            />
            <Indicateur
              libelle={t("indicateurs.avancement")}
              valeur={t("pourcentage", { valeur: synthese.avancement })}
              detail={t("indicateurs.avancementDetail")}
              fond="succes"
            />
            <Indicateur
              libelle={t("indicateurs.enRetard")}
              valeur={String(synthese.enRetard)}
              alerte={synthese.enRetard > 0}
              fond={synthese.enRetard > 0 ? "erreur" : "neutre"}
            />
          </section>

          <Onglets
            onglets={ONGLETS}
            actif={onglet}
            onChanger={setOnglet}
            libelle={t("onglets.libelle")}
            libelleOnglet={(cle) => t(`onglets.${cle}`)}
          />

          {requeteLots.isPending && <EtatChargement />}
          {requeteLots.isError && <EtatErreur onReessayer={() => void requeteLots.refetch()} />}

          {requeteLots.isSuccess && onglet === "structure" && (
            <div
              role="tabpanel"
              id="panneau-structure"
              aria-labelledby="onglet-structure"
              className="grid grid-cols-[minmax(0,1fr)_19rem] items-start gap-5 max-xl:grid-cols-1"
            >
              <StructureLots
                key={projetId}
                lots={lots}
                recherche={recherche}
                onRecherche={setRecherche}
                statut={statut}
                onStatut={setStatut}
                activiteChoisieId={activite?.id ?? null}
                onChoisirActivite={setActiviteChoisie}
                onAjouterLot={() => ouvrirTiroirLot()}
                onModifierLot={ouvrirTiroirLot}
                onSupprimerLot={setLotASupprimer}
                onAjouterActivite={(lotId) => ouvrirTiroirActivite(null, lotId)}
              />
              <PanneauActivite
                activite={activite}
                lot={lotDeActivite}
                lots={lots}
                onModifier={(cible) => ouvrirTiroirActivite(cible, cible.lotId)}
                onSupprimer={setActiviteASupprimer}
              />
            </div>
          )}

          {requeteLots.isSuccess && onglet === "planning" && (
            <div role="tabpanel" id="panneau-planning" aria-labelledby="onglet-planning">
              <PlanningLots lots={lots} />
            </div>
          )}

          <TiroirActivite
            key={`activite-${ouverture}`}
            ouverte={tiroirActivite.ouvert}
            onFermer={() => setTiroirActivite((etat) => ({ ...etat, ouvert: false }))}
            projetId={projetId}
            lots={lots}
            activite={tiroirActivite.activite}
            lotIdInitial={tiroirActivite.lotId}
            onEnregistree={surActiviteEnregistree}
          />
          <TiroirLot
            key={`lot-${ouverture}`}
            ouverte={tiroirLot.ouvert}
            onFermer={() => setTiroirLot((etat) => ({ ...etat, ouvert: false }))}
            projetId={projetId}
            lots={lots}
            lot={tiroirLot.lot}
            onCree={surLotCree}
            onModifie={surLotModifie}
            onImportes={surLotsImportes}
          />
          <ModaleSuppressionLot
            lot={lotASupprimer}
            onFermer={() => setLotASupprimer(null)}
            onSupprime={surLotSupprime}
          />
          <ModaleSuppressionActivite
            activite={activiteASupprimer}
            onFermer={() => setActiviteASupprimer(null)}
            onSupprimee={surActiviteSupprimee}
          />
        </>
      )}
    </div>
  );
}

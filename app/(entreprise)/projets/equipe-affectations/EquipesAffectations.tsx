"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { useProjetsVisibles } from "@/features/habilitations";
import { listerEquipes, listerLots } from "@/features/projets/adaptateur";
import { cleEquipes, cleLots } from "@/features/projets/cles";
import { TiroirAffectation } from "@/features/projets/components/TiroirAffectation";
import { TiroirEquipe } from "@/features/projets/components/TiroirEquipe";
import { projetOuvert, syntheseEquipes } from "@/features/projets/regles";
import type { Activite, Equipe } from "@/features/projets/types";

import { BarreProjet, Indicateur, Onglets } from "../EnteteChantier";
import { AffectationsProjet } from "./AffectationsProjet";
import { EquipesProjet } from "./EquipesProjet";
import { TiroirMembres } from "./TiroirMembres";

type Onglet = "equipes" | "affectations";
const ONGLETS: readonly Onglet[] = ["equipes", "affectations"];

/**
 * L'écran « Équipes et affectations » : qui travaille sur un chantier, et sur
 * quoi.
 *
 * Même gabarit que « Lots & activités » (le sélecteur de chantier collant,
 * quatre chiffres, des onglets), deux vues : les **équipes** du chantier, en
 * cartes, et les **affectations**, une ligne par activité avec son équipe.
 *
 * Une affectation n'est pas un objet à part : c'est l'équipe d'une activité.
 * Les deux vues lisent donc les mêmes lots, dans le même cache que
 * « Lots & activités » — une équipe affectée ici se voit là-bas, et
 * inversement.
 *
 * **Aucun calcul ici** : tout vient de `features/projets/regles`.
 */
export function EquipesAffectations({ projetInitial }: { projetInitial?: string }) {
  const t = useTranslations("projets.equipesAffectations");
  const clientRequetes = useQueryClient();

  const [projetChoisi, setProjetChoisi] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("equipes");

  const [tiroirAffectation, setTiroirAffectation] = useState<{
    ouvert: boolean;
    activiteId?: string;
    equipeId?: string;
  }>({ ouvert: false });
  const [tiroirEquipeOuvert, setTiroirEquipeOuvert] = useState(false);
  const [equipeMembres, setEquipeMembres] = useState<Equipe | null>(null);
  /** Le rang de la dernière ouverture d'un tiroir, qui lui sert de `key`. */
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
  const requeteEquipes = useQuery({
    queryKey: cleEquipes(projetId ?? ""),
    queryFn: ({ signal }) => listerEquipes(projetId as string, signal),
    enabled: projetId !== null,
  });
  const lots = useMemo(() => requeteLots.data ?? [], [requeteLots.data]);
  const equipes = useMemo(() => requeteEquipes.data ?? [], [requeteEquipes.data]);

  const synthese = useMemo(() => syntheseEquipes(equipes, lots), [equipes, lots]);
  const chargement = requeteLots.isPending || requeteEquipes.isPending;
  const echec = requeteLots.isError || requeteEquipes.isError;

  const ouvrirAffectation = useCallback((cible: { activiteId?: string; equipeId?: string }) => {
    setOuverture((rang) => rang + 1);
    setTiroirAffectation({ ouvert: true, ...cible });
  }, []);

  const modifierAffectation = useCallback(
    (activite: Activite) => ouvrirAffectation({ activiteId: activite.id }),
    [ouvrirAffectation],
  );

  function ouvrirConstitution() {
    setOuverture((rang) => rang + 1);
    setTiroirEquipeOuvert(true);
  }

  function surAffectee() {
    if (projetId) void clientRequetes.invalidateQueries({ queryKey: cleLots(projetId) });
  }

  function surEquipeCreee(equipe: Equipe) {
    if (!projetId) return;
    // Posée dans le cache avant le rechargement : la carte apparaît au moment
    // où le tiroir se referme.
    clientRequetes.setQueryData<Equipe[]>(cleEquipes(projetId), (anciennes) => [
      ...(anciennes ?? []),
      equipe,
    ]);
    void clientRequetes.invalidateQueries({ queryKey: cleEquipes(projetId) });
  }

  function reessayer() {
    if (requeteLots.isError) void requeteLots.refetch();
    if (requeteEquipes.isError) void requeteEquipes.refetch();
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
          <BarreProjet projets={projets} projetId={projetId} onChanger={setProjetChoisi} />

          <section className="grid grid-cols-4 gap-4 max-lg:grid-cols-2" aria-live="polite">
            <Indicateur
              libelle={t("indicateurs.equipes")}
              valeur={String(synthese.equipes)}
              fond="primaire"
            />
            <Indicateur
              libelle={t("indicateurs.effectif")}
              valeur={String(synthese.effectif)}
              detail={t("indicateurs.effectifDetail")}
              fond="secondaire"
            />
            <Indicateur
              libelle={t("indicateurs.affectees")}
              valeur={String(synthese.affectees)}
              fond="succes"
            />
            <Indicateur
              libelle={t("indicateurs.aAffecter")}
              valeur={String(synthese.aAffecter)}
              detail={t("indicateurs.aAffecterDetail")}
              alerte={synthese.aAffecter > 0}
              fond={synthese.aAffecter > 0 ? "avertissement" : "neutre"}
            />
          </section>

          <Onglets
            onglets={ONGLETS}
            actif={onglet}
            onChanger={setOnglet}
            libelle={t("onglets.libelle")}
            libelleOnglet={(cle) => t(`onglets.${cle}`)}
          />

          {chargement && !echec && <EtatChargement />}
          {echec && <EtatErreur onReessayer={reessayer} />}

          {!chargement && !echec && onglet === "equipes" && (
            <div role="tabpanel" id="panneau-equipes" aria-labelledby="onglet-equipes">
              <EquipesProjet
                equipes={equipes}
                lots={lots}
                onConstituer={ouvrirConstitution}
                onMembres={setEquipeMembres}
                onAffecter={(equipe) => ouvrirAffectation({ equipeId: equipe.id })}
              />
            </div>
          )}

          {!chargement && !echec && onglet === "affectations" && (
            <div role="tabpanel" id="panneau-affectations" aria-labelledby="onglet-affectations">
              <AffectationsProjet
                key={projetId}
                lots={lots}
                equipes={equipes}
                onNouvelle={() => ouvrirAffectation({})}
                onModifier={modifierAffectation}
              />
            </div>
          )}

          <TiroirAffectation
            key={`affectation-${ouverture}`}
            ouverte={tiroirAffectation.ouvert}
            onFermer={() => setTiroirAffectation((etat) => ({ ...etat, ouvert: false }))}
            projetId={projetId}
            lots={lots}
            equipes={equipes}
            activiteIdInitiale={tiroirAffectation.activiteId}
            equipeIdInitiale={tiroirAffectation.equipeId}
            onAffectee={surAffectee}
          />
          <TiroirEquipe
            key={`equipe-${ouverture}`}
            ouverte={tiroirEquipeOuvert}
            onFermer={() => setTiroirEquipeOuvert(false)}
            projetId={projetId}
            onCreee={surEquipeCreee}
          />
          <TiroirMembres equipe={equipeMembres} onFermer={() => setEquipeMembres(null)} />
        </>
      )}
    </div>
  );
}

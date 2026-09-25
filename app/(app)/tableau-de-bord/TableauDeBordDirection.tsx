"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge, Bouton, EtatChargement, EtatErreur } from "@/components/ui";
import { TiroirCreationProjet } from "@/features/projets/components/TiroirCreationProjet";
import { lireTableauDeBord } from "@/features/tableauDeBord/adaptateur";

import { AlertesPilotage } from "./AlertesPilotage";
import { ChantiersAttention } from "./ChantiersAttention";
import { CLE_TABLEAU_DE_BORD } from "./cles";
import { EcheancesAVenir } from "./EcheancesAVenir";
import { EnTeteDirection } from "./EnTeteDirection";
import { GraphiqueBudgets } from "./GraphiqueBudgets";
import { IndicateursDirection } from "./IndicateursDirection";
import { PanneauPortefeuille } from "./PanneauPortefeuille";
import { SyntheseQhse } from "./SyntheseQhse";
import { ValidationsEnAttente } from "./ValidationsEnAttente";

/** La liste des chantiers partage sa clé : un chantier créé ici doit y apparaître aussi. */
const CLE_LISTE_PROJETS = ["projets", "liste"] as const;

/**
 * Le tableau de bord du Directeur Général.
 *
 * Il se lit de haut en bas comme une réponse qui se précise (CDC §1.3,
 * « l'état réel de tous ses chantiers en moins de 30 secondes ») :
 *
 * 1. **la phrase de synthèse et les quatre chiffres** — l'état de l'entreprise ;
 * 2. **ce qui réclame le DG** — les chantiers qui dérivent, ce qu'il doit signer ;
 * 3. **pourquoi** — l'argent chantier par chantier, les alertes du terrain ;
 * 4. **le détail** — le portefeuille complet ;
 * 5. **ce qui vient** — les échéances, la sécurité.
 *
 * Ce qu'il ne montre plus est un choix, pas un oubli : le rapport journalier,
 * les réceptions de matériaux et les effectifs du jour sont le travail du
 * terrain (docs/PLAN_INTERFACES_DG.md §1.1).
 */
export function TableauDeBordDirection() {
  const t = useTranslations("tableauDeBord");
  const clientRequetes = useQueryClient();
  const [tiroirOuvert, setTiroirOuvert] = useState(false);

  const requete = useQuery({
    queryKey: CLE_TABLEAU_DE_BORD,
    queryFn: ({ signal }) => lireTableauDeBord(signal),
  });

  const ouvrirCreation = () => setTiroirOuvert(true);

  const tiroir = (
    <TiroirCreationProjet
      ouverte={tiroirOuvert}
      onFermer={() => setTiroirOuvert(false)}
      onProjetCree={() => {
        void clientRequetes.invalidateQueries({ queryKey: CLE_TABLEAU_DE_BORD });
        void clientRequetes.invalidateQueries({ queryKey: CLE_LISTE_PROJETS });
      }}
    />
  );

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) {
    return (
      <EtatErreur message={t("erreurChargement")} onReessayer={() => void requete.refetch()} />
    );
  }

  const donnees = requete.data;

  if (donnees.chantiers.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <EnTeteDirection donnees={donnees} onNouveauProjet={ouvrirCreation} />
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-primary-300 bg-neutral-50 px-6 py-16 text-center">
          <span className="mb-2 flex size-16 items-center justify-center rounded-full bg-primary-50 text-primary-500">
            <Building2 className="size-8" aria-hidden="true" />
          </span>
          <Badge variante="neutre">{t("emptyState.badgeSansChantier")}</Badge>
          <h2 className="text-h3 font-bold text-neutral-900">{t("emptyState.titre")}</h2>
          <p className="mb-2 max-w-[560px] text-sm text-neutral-600">{t("emptyState.description")}</p>
          <Bouton
            variante="primaire"
            taille="lg"
            iconeGauche={<Plus className="size-5" aria-hidden="true" />}
            onClick={ouvrirCreation}
          >
            {t("emptyState.actionCreer")}
          </Bouton>
        </section>
        {tiroir}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <EnTeteDirection donnees={donnees} onNouveauProjet={ouvrirCreation} />

      <IndicateursDirection chantiers={donnees.chantiers} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChantiersAttention chantiers={donnees.chantiers} />
        </div>
        <ValidationsEnAttente validations={donnees.validations} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GraphiqueBudgets chantiers={donnees.chantiers} />
        </div>
        <AlertesPilotage alertes={donnees.alertes} />
      </div>

      <PanneauPortefeuille chantiers={donnees.chantiers} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EcheancesAVenir echeances={donnees.echeances} />
        </div>
        <SyntheseQhse qhse={donnees.qhse} />
      </div>

      {tiroir}
    </div>
  );
}

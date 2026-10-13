"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Bouton, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDroits, useProjetsVisibles } from "@/features/habilitations";
import {
  alertesStock,
  chiffresStock,
  filtrerParProjet,
  gestesCumules,
  restreindreStock,
  tachesStock,
} from "@/features/stocks";
import type { OngletStock } from "@/features/stocks";
import { lireStock } from "@/features/stocks/adaptateur";
import { CLE_STOCK } from "@/features/stocks/cles";

import { Indicateur, Onglets } from "../projets/EnteteChantier";
import { FournisseurStock } from "./contexte";
import type { Intention } from "./contexte";
import { OngletAFaire } from "./OngletAFaire";
import { OngletCommandes } from "./OngletCommandes";
import { OngletDemandes } from "./OngletDemandes";
import { OngletInventaires } from "./OngletInventaires";
import { OngletMouvements } from "./OngletMouvements";
import { OngletReceptions } from "./OngletReceptions";
import { OngletReferentiel } from "./OngletReferentiel";
import { OngletStockLots } from "./OngletStockLots";

const ONGLETS: readonly OngletStock[] = [
  "afaire",
  "stock",
  // Sous-modules F9-1 à F9-6, dans l'ordre du cahier.
  "referentiel",
  "demandes",
  "commandes",
  "receptions",
  "mouvements",
  "inventaires",
];

/** Radix réserve la valeur vide : « tous les chantiers » a la sienne. */
const TOUS = "__tous__";

/**
 * Le stock de chantier — F9, le cycle DA → BC → Réception + BRV → Stock.
 *
 * Un seul écran pour tous les profils : ce qu'il propose dépend des gestes du
 * compte sur chaque chantier (`gestesStock`), jamais d'un nom de rôle. Il
 * s'ouvre sur **« À faire »** : ce que ce compte doit traiter maintenant —
 * commander pour la direction, réceptionner et compter pour le magasinier,
 * valider pour le conducteur de travaux et le chef de projet.
 */
export function GestionStock({
  ongletInitial,
  projetInitial,
}: {
  ongletInitial: OngletStock | null;
  projetInitial: string;
}) {
  const t = useTranslations("stocks");
  const router = useRouter();
  const { droits } = useDroits();
  const [projetId, setProjetId] = useState(projetInitial);
  const [onglet, setOnglet] = useState<OngletStock>(ongletInitial ?? "afaire");
  const [intention, setIntention] = useState<Intention | null>(null);

  // Hors direction, seulement ses chantiers — et leur stock.
  const requeteProjets = useProjetsVisibles();
  const sansProjet = requeteProjets.isSuccess && requeteProjets.data.length === 0;
  const requete = useQuery({
    queryKey: CLE_STOCK,
    queryFn: ({ signal }) => lireStock(signal),
    enabled: !requeteProjets.isPending && !sansProjet,
  });

  const tousProjets = useMemo(() => requeteProjets.data ?? [], [requeteProjets.data]);
  const projetChoisi = tousProjets.some((p) => p.id === projetId) ? projetId : "";
  const projets = useMemo(
    () => (projetChoisi ? tousProjets.filter((p) => p.id === projetChoisi) : tousProjets),
    [tousProjets, projetChoisi],
  );

  const donnees = useMemo(() => {
    if (!requete.data) return null;
    const visibles = restreindreStock(requete.data, new Set(tousProjets.map((p) => p.id)));
    return filtrerParProjet(visibles, projetChoisi);
  }, [requete.data, tousProjets, projetChoisi]);

  const gestes = useMemo(() => gestesCumules(droits, projets), [droits, projets]);
  const ongletsVisibles = ONGLETS.filter((cle) => cle !== "demandes" || gestes.voirDemandes);
  const ongletActif = ongletsVisibles.includes(onglet) ? onglet : "afaire";

  const taches = useMemo(() => (donnees ? tachesStock(donnees, droits, projets) : []), [donnees, droits, projets]);
  const alertes = useMemo(() => (donnees ? alertesStock(donnees) : []), [donnees]);
  const chiffres = useMemo(() => (donnees ? chiffresStock(donnees) : null), [donnees]);

  const ouvrir = useCallback((cible: Intention) => {
    setIntention(cible);
    setOnglet(cible.onglet);
  }, []);

  function changerOnglet(cle: OngletStock) {
    setIntention(null);
    setOnglet(cle);
  }

  if (sansProjet) {
    return (
      <div className="flex flex-col gap-6">
        <EnTetePage titre={t("titre")} description={t("sansProjet.resume")} />
        <EtatVide
          titre={t("sansProjet.titre")}
          description={t("sansProjet.description")}
          action={
            <Bouton
              variante="primaire"
              iconeGauche={<FolderPlus size={16} aria-hidden="true" />}
              onClick={() => router.push("/projets")}
            >
              {t("sansProjet.action")}
            </Bouton>
          }
        />
      </div>
    );
  }

  if (requeteProjets.isPending || requete.isPending) return <EtatChargement />;
  if (requete.isError || !donnees || !chiffres) {
    return <EtatErreur message={t("erreurChargement")} onReessayer={() => void requete.refetch()} />;
  }

  return (
    <FournisseurStock
      donnees={donnees}
      projets={projets}
      tousProjets={tousProjets}
      droits={droits}
      ouvrir={ouvrir}
    >
      <div className="flex flex-col gap-6">
        <EnTetePage
          titre={t("titre")}
          description={t("resume", {
            taches: taches.length,
            alertes: alertes.length,
            chantiers: projets.length,
          })}
        />

        <section aria-label={t("indicateurs.aria")} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Indicateur
            libelle={t("indicateurs.enAlerte")}
            valeur={chiffres.enAlerte + chiffres.enRupture}
            fond={chiffres.enRupture > 0 ? "erreur" : chiffres.enAlerte > 0 ? "avertissement" : "succes"}
            alerte={chiffres.enAlerte + chiffres.enRupture > 0}
            detail={t("indicateurs.detailEnAlerte", { rupture: chiffres.enRupture, articles: chiffres.articles })}
          />
          <Indicateur
            libelle={t("indicateurs.demandes")}
            valeur={chiffres.demandesACommander}
            fond="information"
            detail={t("indicateurs.detailDemandes")}
          />
          <Indicateur
            libelle={t("indicateurs.livraisons")}
            valeur={chiffres.livraisonsAttendues}
            fond="secondaire"
            detail={t("indicateurs.detailLivraisons")}
          />
          <Indicateur
            libelle={t("indicateurs.validations")}
            valeur={chiffres.enValidation}
            fond="primaire"
            detail={t("indicateurs.detailValidations", { inventaires: chiffres.inventairesAValider })}
          />
          <Indicateur
            libelle={t("indicateurs.justificatifs")}
            valeur={chiffres.sansJustificatif}
            fond={chiffres.sansJustificatif > 0 ? "avertissement" : "neutre"}
            alerte={chiffres.sansJustificatif > 0}
            detail={t("indicateurs.detailJustificatifs")}
          />
        </section>

        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="stock-chantier" className="shrink-0 text-sm font-medium text-neutral-700">
              {t("choixChantier")}
            </label>
            <Select value={projetChoisi || TOUS} onValueChange={(valeur) => setProjetId(valeur === TOUS ? "" : valeur)}>
              <SelectTrigger
                id="stock-chantier"
                className="h-[var(--input-height-md)] w-80 max-w-full bg-card max-sm:w-auto max-sm:min-w-0 max-sm:flex-1"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value={TOUS}>{t("tousChantiers", { n: tousProjets.length })}</SelectItem>
                {tousProjets.map((projet) => (
                  <SelectItem key={projet.id} value={projet.id}>
                    {projet.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="-mx-2 overflow-x-auto px-2 [scrollbar-width:none]">
            <Onglets
              onglets={ongletsVisibles}
              actif={ongletActif}
              onChanger={changerOnglet}
              libelle={t("onglets.aria")}
              libelleOnglet={(cle) =>
                cle === "afaire" && taches.length > 0 ? t("onglets.afaireNombre", { n: taches.length }) : t(`onglets.${cle}`)
              }
            />
          </div>

          <div role="tabpanel" id={`panneau-${ongletActif}`} aria-labelledby={`onglet-${ongletActif}`}>
            {ongletActif === "afaire" && <OngletAFaire taches={taches} alertes={alertes} />}
            {ongletActif === "stock" && <OngletStockLots key={intention?.cible} intention={intention} />}
            {ongletActif === "demandes" && <OngletDemandes key={intention?.cible} intention={intention} />}
            {ongletActif === "commandes" && <OngletCommandes key={intention?.cible} intention={intention} />}
            {ongletActif === "receptions" && <OngletReceptions key={intention?.cible} intention={intention} />}
            {ongletActif === "mouvements" && <OngletMouvements />}
            {ongletActif === "inventaires" && <OngletInventaires key={intention?.cible} intention={intention} />}
            {ongletActif === "referentiel" && <OngletReferentiel />}
          </div>
        </div>
      </div>
    </FournisseurStock>
  );
}

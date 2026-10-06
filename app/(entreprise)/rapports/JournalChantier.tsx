"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Bouton, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { situationDuJour, tauxSoumission, validationsEnAttente } from "@/features/chantier";
import { lireJournal } from "@/features/chantier/adaptateur";
import { CLE_JOURNAL } from "@/features/chantier/cles";
import { estRedacteurJournal, useDroits, useProjetsVisibles } from "@/features/habilitations";

import { Indicateur, Onglets } from "../projets/EnteteChantier";
import { fondSiAlerte } from "./classes";
import { FileValidation } from "./FileValidation";
import { HistoriqueRapports } from "./HistoriqueRapports";
import { SituationDuJour } from "./SituationDuJour";
import { SynthesesPeriodiques } from "./SynthesesPeriodiques";

type Onglet = "jour" | "validations" | "historique" | "syntheses";
const ONGLETS: readonly Onglet[] = ["jour", "validations", "historique", "syntheses"];

/** Le taux de remise se lit sur une semaine de chantier. */
const JOURS_TAUX = 5;

/**
 * Le journal de chantier, vu du Directeur Général (docs/PLAN_INTERFACES_DG.md §3).
 *
 * Les maquettes F2 décrivent l'écran du terrain : saisir, valider, consulter.
 * Le DG ne saisit pas et ne signe pas — le circuit est CC → CT → CP. Ce qu'il
 * lui faut, c'est savoir **si le terrain rend compte, et ce qu'il dit** :
 *
 * 1. **aujourd'hui** — chaque lot actif a-t-il son rapport, et que dit-il ;
 * 2. **le circuit** — quels rapports attendent une signature, lesquels sont
 *    hors délai (un rapport non approuvé ne compte ni dans l'avancement ni
 *    dans les bons de paiement) ;
 * 3. **l'historique** — tous les rapports, filtrables, exportables ;
 * 4. **les synthèses** — hebdomadaire, mensuelle ou personnalisée, agrégées
 *    des rapports journaliers.
 *
 * Retirés de la maquette pour ce profil : l'onglet « Saisir un rapport » et
 * les boutons Valider / Rejeter. Ajoutée : la relance, seul geste du DG ici.
 */
export function JournalChantier() {
  const t = useTranslations("journal");
  const format = useFormatter();
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>("jour");
  // Le chef de chantier rédige ; le DG, lui, n'a que la lecture et la relance.
  const peutRediger = estRedacteurJournal(useDroits().droits);

  // Pas de projet, pas de journal : sans chantier ouvert, aucun rapport ne
  // peut exister. La liste (même cache que l'écran Projets) est lue d'abord,
  // et le journal n'est demandé que s'il y a de quoi en tenir un — sinon un
  // espace neuf afficherait une erreur là où il n'y a simplement rien.
  // Hors direction, seulement ses chantiers — et le journal de ceux-là.
  const requeteProjets = useProjetsVisibles();
  const sansProjet = requeteProjets.isSuccess && requeteProjets.data.length === 0;

  const requete = useQuery({
    queryKey: CLE_JOURNAL,
    queryFn: ({ signal }) => lireJournal(signal),
    // Un échec de la liste ne bloque pas le journal : il garde sa propre erreur.
    enabled: !requeteProjets.isPending && !sansProjet,
    // Les chefs de chantier déposent tout l'après-midi : le jour se relit seul.
    refetchInterval: 60_000,
  });

  const journal = useMemo(() => {
    if (!requete.data || !requeteProjets.data) return requete.data;
    const visibles = new Set(requeteProjets.data.map((projet) => projet.id));
    return {
      ...requete.data,
      entrees: requete.data.entrees.filter((entree) => visibles.has(entree.chantier.projetId)),
    };
  }, [requete.data, requeteProjets.data]);
  const maintenant = useMemo(() => (journal ? new Date(journal.luLe) : null), [journal]);

  const chiffres = useMemo(() => {
    if (!journal || !maintenant) return null;
    const jour = situationDuJour(journal.entrees, journal.aujourdhui);
    const validations = validationsEnAttente(journal.entrees, maintenant);
    return {
      jour,
      validations: validations.length,
      horsDelai: validations.filter((validation) => validation.horsDelai).length,
      semaine: tauxSoumission(journal.entrees, journal.aujourdhui, JOURS_TAUX),
    };
  }, [journal, maintenant]);

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
  if (requete.isError || !journal || !chiffres || !maintenant) {
    return <EtatErreur message={t("erreurChargement")} onReessayer={() => void requete.refetch()} />;
  }

  const { jour, semaine } = chiffres;
  const dateDuJour = format.dateTime(new Date(`${journal.aujourdhui}T00:00:00Z`), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-6">
      <EnTetePage
        titre={t("titre")}
        description={t("resume", {
          date: dateDuJour,
          heure: format.dateTime(maintenant, { hour: "2-digit", minute: "2-digit" }),
          deposes: jour.deposes,
          attendus: jour.attendus,
          manquants: jour.manquants,
          validations: chiffres.validations,
        })}
      />

      <section
        aria-label={t("indicateurs.aria")}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
      >
        <Indicateur
          libelle={t("indicateurs.attendus")}
          valeur={jour.attendus}
          fond="secondaire"
          detail={t("indicateurs.detailAttendus", { chantiers: jour.chantiers })}
        />
        <Indicateur
          libelle={t("indicateurs.deposes")}
          valeur={jour.deposes}
          fond="information"
          detail={
            jour.taux === null ? t("indicateurs.sansAttente") : t("indicateurs.detailDeposes", { taux: jour.taux })
          }
        />
        <Indicateur
          libelle={t("indicateurs.manquants")}
          valeur={jour.manquants}
          fond={fondSiAlerte(jour.manquants, "erreur")}
          alerte={jour.manquants > 0}
          detail={t("indicateurs.detailManquants")}
        />
        <Indicateur
          libelle={t("indicateurs.validations")}
          valeur={chiffres.validations}
          fond={fondSiAlerte(chiffres.horsDelai, "avertissement")}
          alerte={chiffres.horsDelai > 0}
          detail={t("indicateurs.detailValidations", { n: chiffres.horsDelai })}
        />
        <Indicateur
          libelle={t("indicateurs.taux")}
          valeur={semaine.taux === null ? t("indicateurs.sansDonnee") : t("pourcent", { valeur: semaine.taux })}
          fond={semaine.taux !== null && semaine.taux < 90 ? "avertissement" : "succes"}
          alerte={semaine.taux !== null && semaine.taux < 90}
          detail={t("indicateurs.detailTaux", { deposes: semaine.deposes, attendus: semaine.attendus, jours: JOURS_TAUX })}
        />
      </section>

      <div className="flex flex-col gap-5">
        <div className="-mx-2 overflow-x-auto px-2 [scrollbar-width:none]">
          <Onglets
            onglets={ONGLETS}
            actif={onglet}
            onChanger={setOnglet}
            libelle={t("onglets.aria")}
            libelleOnglet={(cle) =>
              cle === "validations" && chiffres.validations > 0
                ? t("onglets.validationsNombre", { n: chiffres.validations })
                : t(`onglets.${cle}`)
            }
          />
        </div>

        <div role="tabpanel" id={`panneau-${onglet}`} aria-labelledby={`onglet-${onglet}`}>
          {onglet === "jour" && <SituationDuJour journal={journal} peutRediger={peutRediger} />}
          {onglet === "validations" && <FileValidation journal={journal} maintenant={maintenant} />}
          {onglet === "historique" && <HistoriqueRapports journal={journal} />}
          {onglet === "syntheses" && <SynthesesPeriodiques journal={journal} />}
        </div>
      </div>
    </div>
  );
}

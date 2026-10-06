"use client";

import { Check, ChevronRight, Layers, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFieldArray, useFormContext, useFormState, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  avancementLotSaisi,
  avancementSaisi,
  avancementTheoriqueLot,
  cumulSaisi,
  depassePrevu,
  heuresEffectif,
  lotsSuivisAvancement,
  SEUIL_ALERTE_PRESENCE,
  tauxPresence,
} from "@/features/chantier";
import type { ActivitePreparee, LotJournal } from "@/features/chantier";
import {
  estRenseigne,
  ligneEffectifVide,
  ligneProductionVide,
  PRESENCES_SOUS_TRAITANT,
  QUALITES_EXECUTION,
  versNombre,
  type ValeursRapport,
} from "@/features/chantier/validations";
import { ABSENT, formaterMontant, formaterQuantite, saisieEnCentimes } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  BoutonAjout,
  CarteLigne,
  CHAMP,
  ChampCompteur,
  ChampPuces,
  ChampTexte,
  PAIRE,
  Requis,
  Signal,
  SousRubrique,
  useErreurSection,
} from "./elementsSaisie";

/** Les corps de métier proposés d'un geste quand le chantier n'a pas encore d'historique. */
const CATEGORIES_COURANTES = [
  "chefEquipe",
  "macons",
  "ferrailleurs",
  "coffreurs",
  "manoeuvres",
  "electriciens",
  "plombiers",
  "conducteursEngins",
] as const;

function useUnite() {
  const tUnites = useTranslations("projets.lotsActivites.unites");
  const t = useTranslations("journal.saisie");
  return (activite: Pick<ActivitePreparee, "unite"> | undefined) =>
    activite?.unite ? tUnites(activite.unite) : t("avancement.unitePourcent");
}

/* ------------------------------------------------------------------ *
 * Les effectifs — régie directe.
 * ------------------------------------------------------------------ */

export function SectionEffectifs() {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "effectifs" });
  const valeurs = useWatch({ control, name: "effectifs" });
  const erreur = useErreurSection("effectifs");

  const totaux = valeurs.reduce(
    (total, ligne) => {
      const presents = versNombre(ligne.presents) ?? 0;
      const prevus = versNombre(ligne.prevus) ?? 0;
      return {
        prevus: total.prevus + prevus,
        presents: total.presents + presents,
        absences: total.absences + Math.max(0, prevus - presents),
        retards: total.retards + (versNombre(ligne.retards) ?? 0),
        heures: total.heures + heuresEffectif({ presents, heures: versNombre(ligne.heures) }),
      };
    },
    { prevus: 0, presents: 0, absences: 0, retards: 0, heures: 0 },
  );
  const taux = tauxPresence(totaux.presents, totaux.prevus);
  const categoriesPresentes = new Set(valeurs.map((ligne) => ligne.categorie.trim().toLowerCase()));
  const suggestions = CATEGORIES_COURANTES.map((cle) => t(`effectifs.categories.${cle}`)).filter(
    (libelle) => !categoriesPresentes.has(libelle.toLowerCase()),
  );

  return (
    <SousRubrique
      titre={t("sections.effectifs")}
      description={t("effectifs.description")}
      erreur={erreur}
    >
      {lignes.fields.map((ligne, rang) => {
        const valeur = valeurs[rang];
        const absents = Math.max(0, (versNombre(valeur?.prevus ?? "") ?? 0) - (versNombre(valeur?.presents ?? "") ?? 0));
        const retards = versNombre(valeur?.retards ?? "") ?? 0;
        return (
          <CarteLigne
            key={ligne.id}
            titre={valeur?.categorie || t("effectifs.nouvelleCategorie")}
            complement={
              absents > 0 || retards > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {absents > 0 && <Badge variante="erreur">{t("effectifs.absents", { n: absents })}</Badge>}
                  {retards > 0 && <Badge variante="avertissement">{t("effectifs.retardsBadge", { n: retards })}</Badge>}
                </span>
              ) : null
            }
            libelleSupprimer={t("effectifs.supprimer", { categorie: valeur?.categorie ?? "" })}
            onSupprimer={() => lignes.remove(rang)}
          >
            <ChampTexte name={`effectifs.${rang}.categorie`} libelle={t("effectifs.categorie")} requis />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ChampCompteur name={`effectifs.${rang}.prevus`} libelle={t("effectifs.prevus")} requis />
              <ChampCompteur name={`effectifs.${rang}.presents`} libelle={t("effectifs.presents")} requis />
              <ChampCompteur name={`effectifs.${rang}.retards`} libelle={t("effectifs.retards")} />
              <ChampTexte
                name={`effectifs.${rang}.heures`}
                libelle={t("effectifs.heures")}
                inputMode="decimal"
                suffixe={t("unites.heures")}
                requis
              />
            </div>
            <ChampTexte
              name={`effectifs.${rang}.observation`}
              libelle={absents > 0 || retards > 0 ? t("effectifs.motifAbsence") : t("effectifs.observation")}
              placeholder={t("effectifs.motifExemple")}
              requis={absents > 0 || retards > 0}
            />
          </CarteLigne>
        );
      })}

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-neutral-500">{t("effectifs.ajoutRapide")}</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((categorie) => (
              <button
                key={categorie}
                type="button"
                onClick={() => lignes.append({ ...ligneEffectifVide(), categorie })}
                className="min-h-9 cursor-pointer rounded-full border border-dashed border-neutral-300 bg-card px-3 text-sm text-neutral-700 hover:border-primary-400 hover:text-primary-700"
              >
                {t("effectifs.ajouterCategorie", { categorie })}
              </button>
            ))}
          </div>
        </div>
      )}
      <BoutonAjout onClick={() => lignes.append(ligneEffectifVide())}>{t("effectifs.ajouter")}</BoutonAjout>

      {valeurs.length > 0 && (
        <dl className="m-0 grid grid-cols-3 gap-2 rounded-lg bg-neutral-100 p-3 text-center sm:grid-cols-5">
          <div>
            <dt className="text-xs text-neutral-500">{t("effectifs.totalPresents")}</dt>
            <dd className="m-0 text-base font-semibold tabular-nums text-neutral-900">
              {t("fraction", { a: totaux.presents, b: totaux.prevus })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t("effectifs.totalAbsences")}</dt>
            <dd className="m-0 text-base font-semibold tabular-nums text-neutral-900">{totaux.absences}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t("effectifs.totalRetards")}</dt>
            <dd className="m-0 text-base font-semibold tabular-nums text-neutral-900">{totaux.retards}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t("effectifs.totalTaux")}</dt>
            <dd
              className={cn(
                "m-0 text-base font-semibold tabular-nums",
                taux !== null && taux < SEUIL_ALERTE_PRESENCE ? "text-erreur" : "text-neutral-900",
              )}
            >
              {taux === null ? ABSENT : t("pourcent", { valeur: taux })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t("effectifs.totalHeures")}</dt>
            <dd className="m-0 text-base font-semibold tabular-nums text-neutral-900">
              {t("heures", { valeur: formaterQuantite(totaux.heures) })}
            </dd>
          </div>
        </dl>
      )}
      {taux !== null && taux < SEUIL_ALERTE_PRESENCE && (
        <Signal ton="erreur" icone={<TriangleAlert />}>
          {t("effectifs.alertePresence", { seuil: SEUIL_ALERTE_PRESENCE })}
        </Signal>
      )}
    </SousRubrique>
  );
}

/* ------------------------------------------------------------------ *
 * La présence du sous-traitant — sous-traitance structurée.
 * ------------------------------------------------------------------ */

export function SectionPresenceSousTraitant() {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const presence = useWatch({ control, name: "presenceSousTraitant.presence" });
  const qualite = useWatch({ control, name: "presenceSousTraitant.qualite" });
  return (
    <SousRubrique
      titre={t("sections.equipes")}
      description={t("presence.description")}
    >
      <ChampPuces
        name="presenceSousTraitant.presence"
        libelle={t("presence.presence")}
        requis
        colonnes={3}
        options={PRESENCES_SOUS_TRAITANT.map((valeur) => ({
          valeur,
          libelle: t(`presence.presences.${valeur}`),
          ton: valeur === "PRESENT" ? "succes" : valeur === "PARTIEL" ? "avertissement" : "erreur",
        }))}
      />
      {presence === "ABSENT" ? (
        <ChampTexte name="presenceSousTraitant.motif" libelle={t("presence.motif")} requis />
      ) : (
        <ChampPuces
          name="presenceSousTraitant.qualite"
          libelle={t("presence.qualite")}
          requis
          colonnes={2}
          options={QUALITES_EXECUTION.map((valeur) => ({
            valeur,
            libelle: t(`presence.qualites.${valeur}`),
            ton: valeur === "CONFORME" ? "succes" : "erreur",
          }))}
        />
      )}
      <ChampTexte
        name="presenceSousTraitant.observation"
        libelle={t("presence.observation")}
        requis={qualite === "NON_CONFORME"}
        multiligne
        lignes={2}
      />
      {qualite === "NON_CONFORME" && presence !== "ABSENT" && (
        <Signal ton="avertissement" icone={<TriangleAlert />}>
          {t("presence.incidentQualite")}
        </Signal>
      )}
    </SousRubrique>
  );
}

/* ------------------------------------------------------------------ *
 * La production des tâcherons — sous-traitance informelle.
 * ------------------------------------------------------------------ */

export function SectionProduction({
  complement,
  activites,
  lots,
}: {
  complement: string;
  /** Les activités des lots en sous-traitance informelle seulement. */
  activites: ActivitePreparee[];
  lots: LotJournal[];
}) {
  const t = useTranslations("journal.saisie");
  const unite = useUnite();
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "production" });
  const valeurs = useWatch({ control, name: "production" });
  const erreur = useErreurSection("production");
  const parId = new Map(activites.map((activite) => [activite.activiteId, activite]));
  const total = valeurs.reduce((somme, ligne) => {
    const prix = saisieEnCentimes(ligne.prixUnitaire);
    return somme + (prix === null ? 0 : Math.round(prix * (versNombre(ligne.quantiteJour) ?? 0)));
  }, 0);

  return (
    <SousRubrique
      titre={t("sections.production")}
      complement={<Badge variante="avertissement">{complement}</Badge>}
      description={t("production.description")}
      erreur={erreur}
    >
      {activites.length === 0 && <Signal ton="avertissement">{t("avancement.aucuneActivite")}</Signal>}
      {lignes.fields.map((ligne, rang) => {
        const valeur = valeurs[rang];
        const activite = parId.get(valeur?.activiteId ?? "");
        const prix = saisieEnCentimes(valeur?.prixUnitaire ?? "");
        const quantite = versNombre(valeur?.quantiteJour ?? "") ?? 0;
        return (
          <CarteLigne
            key={ligne.id}
            titre={valeur?.intervenant || t("production.nouvelIntervenant")}
            complement={
              prix !== null && quantite > 0 ? (
                <span className="text-sm font-semibold tabular-nums text-neutral-900">
                  {formaterMontant(Math.round(prix * quantite))}
                </span>
              ) : null
            }
            libelleSupprimer={t("production.supprimer", { intervenant: valeur?.intervenant ?? "" })}
            onSupprimer={() => lignes.remove(rang)}
          >
            <ChampTexte name={`production.${rang}.intervenant`} libelle={t("production.intervenant")} requis />
            <ChampActivite name={`production.${rang}.activiteId`} activites={activites} lots={lots} />
            <div className={PAIRE}>
              <ChampTexte
                name={`production.${rang}.quantiteJour`}
                libelle={t("production.quantite")}
                inputMode="decimal"
                suffixe={unite(activite)}
                requis
              />
              <ChampTexte
                name={`production.${rang}.prixUnitaire`}
                libelle={t("production.prix")}
                inputMode="numeric"
                suffixe={t("unites.fcfa")}
              />
            </div>
          </CarteLigne>
        );
      })}
      <BoutonAjout onClick={() => lignes.append(ligneProductionVide())} disabled={activites.length === 0}>
        {t("production.ajouter")}
      </BoutonAjout>
      {total > 0 && (
        <p className="m-0 flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-2 text-sm">
          <span className="text-neutral-600">{t("production.total")}</span>
          <span className="font-semibold tabular-nums text-neutral-900">{formaterMontant(total)}</span>
        </p>
      )}
      <Signal ton="information">{t("production.validation")}</Signal>
    </SousRubrique>
  );
}

function ChampActivite({
  name,
  activites,
  lots,
}: {
  name: `production.${number}.activiteId`;
  activites: ActivitePreparee[];
  lots: LotJournal[];
}) {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const codeLot = new Map(lots.map((lot) => [lot.id, lot.code]));
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="gap-1.5">
          <FormLabel>
            {t("production.activite")} <Requis />
          </FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                <SelectValue placeholder={t("production.choisirActivite")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {activites.map((activite) => (
                <SelectItem key={activite.activiteId} value={activite.activiteId}>
                  {t("production.activiteLot", {
                    lot: codeLot.get(activite.lotId) ?? "",
                    code: activite.code,
                    libelle: activite.libelle,
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/* ------------------------------------------------------------------ *
 * L'avancement des activités.
 * ------------------------------------------------------------------ */

/**
 * L'avancement des activités suivies à la quantité, regroupées par lot. Les
 * index du formulaire suivent l'ordre de `activites` : le regroupement
 * n'en change pas l'ordre, il ne fait qu'intercaler les titres de lot.
 */
export function SectionAvancement({
  activites,
  lots,
}: {
  activites: ActivitePreparee[];
  lots: LotJournal[];
}) {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const points = useFieldArray({ control, name: "lotsTravailles", keyName: "cle" });
  const erreurLots = useErreurSection("lotsTravailles");
  const erreurActivites = useErreurSection("activites");
  const choisissables = lotsSuivisAvancement({ lots, activites });
  const choisis = new Set(points.fields.map((point) => point.lotId));

  // La sélection garde l'ordre du serveur : le rapport se lit lot après lot,
  // comme la structure du chantier.
  const basculer = (lot: LotJournal) => {
    const rang = points.fields.findIndex((point) => point.lotId === lot.id);
    if (rang >= 0) {
      points.remove(rang);
      return;
    }
    const ordre = (lotId: string) => choisissables.findIndex((candidat) => candidat.id === lotId);
    const avant = points.fields.filter((point) => ordre(point.lotId) < ordre(lot.id)).length;
    points.insert(avant, { lotId: lot.id, observation: "" }, { shouldFocus: false });
  };

  const [recherche, setRecherche] = useState(false);
  // Le lot qu'on vient d'ajouter s'ouvre ; les autres restent repliés, pour
  // qu'un chantier de vingt lots ne déroule pas vingt formulaires.
  const [ouverts, setOuverts] = useState<Set<string>>(() =>
    points.fields.length === 1 ? new Set([points.fields[0].lotId]) : new Set(),
  );
  const basculerOuvert = (lotId: string, ouvert: boolean) =>
    setOuverts((actuels) => {
      const suivants = new Set(actuels);
      if (ouvert) suivants.add(lotId);
      else suivants.delete(lotId);
      return suivants;
    });

  const choisir = (lot: LotJournal) => {
    if (!choisis.has(lot.id)) basculerOuvert(lot.id, true);
    basculer(lot);
  };

  return (
    <SousRubrique erreur={erreurLots ?? erreurActivites}>
      {activites.length === 0 && <Signal ton="avertissement">{t("avancement.aucuneActivite")}</Signal>}
      {choisissables.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-neutral-900">{t("avancement.lotsTravailles")}</span>
            <span className="text-xs text-neutral-500 tabular-nums">
              {t("avancement.lotsChoisis", { n: choisis.size, total: choisissables.length })}
            </span>
          </div>
          <SelecteurAjout
            ouvert={recherche}
            onOuvrir={setRecherche}
            libelle={t("avancement.ajouterLot")}
            recherche={t("avancement.rechercherLot")}
            aucunResultat={t("avancement.aucunLotTrouve")}
            options={choisissables.map((lot) => ({
              id: lot.id,
              titre: t("lotValeur", { code: lot.code, nom: lot.nom }),
              detail: t("avancement.nbActivites", {
                nombre: activites.filter((activite) => activite.lotId === lot.id).length,
              }),
              choisi: choisis.has(lot.id),
            }))}
            onBasculer={(id) => {
              const lot = choisissables.find((candidat) => candidat.id === id);
              if (lot) choisir(lot);
            }}
          />
        </div>
      )}
      {choisissables.length > 0 && points.fields.length === 0 && (
        <button
          type="button"
          onClick={() => setRecherche(true)}
          className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center transition-colors hover:bg-neutral-100"
        >
          <Layers className="size-5 text-neutral-400" aria-hidden="true" />
          <span className="text-sm font-medium text-neutral-700">{t("avancement.aucunLotChoisi")}</span>
          <span className="text-xs text-neutral-500">{t("avancement.aucunLotChoisiAide")}</span>
        </button>
      )}
      {points.fields.length > 0 && (
        <div className="flex flex-col gap-2">
          {points.fields.map((point, rangPoint) => {
            const lot = lots.find((candidat) => candidat.id === point.lotId);
            if (!lot) return null;
            return (
              <PointDuLot
                key={point.cle}
                lot={lot}
                rangPoint={rangPoint}
                activites={activites}
                ouvert={ouverts.has(lot.id)}
                onOuvrir={(ouvert) => basculerOuvert(lot.id, ouvert)}
                onRetirer={() => points.remove(rangPoint)}
              />
            );
          })}
        </div>
      )}
    </SousRubrique>
  );
}

/**
 * Le point d'un lot travaillé : son avancement au soir, la quantité du jour
 * de chacune de ses activités, et ce qu'il faut en retenir.
 *
 * `activites` est la liste complète des activités suivies à l'avancement : le
 * rang d'une activité y est celui de sa ligne dans le formulaire.
 */
function PointDuLot({
  lot,
  rangPoint,
  activites,
  ouvert,
  onOuvrir,
  onRetirer,
}: {
  lot: LotJournal;
  rangPoint: number;
  activites: ActivitePreparee[];
  ouvert: boolean;
  onOuvrir: (ouvert: boolean) => void;
  onRetirer: () => void;
}) {
  const t = useTranslations("journal.saisie");
  const unite = useUnite();
  const { control, getValues, setValue } = useFormContext<ValeursRapport>();
  const { errors } = useFormState({ control, name: ["activites", "lotsTravailles"] });
  const valeurs = useWatch({ control, name: "activites" });
  const duLot = activites.flatMap((activite, rang) => (activite.lotId === lot.id ? [{ activite, rang }] : []));
  const quantites = new Map(
    duLot.map(({ activite, rang }) => [activite.activiteId, versNombre(valeurs[rang]?.quantiteJour ?? "") ?? 0]),
  );
  const avancementLot = avancementLotSaisi(duLot.map(({ activite }) => activite), quantites) ?? 0;
  const theoriqueLot = avancementTheoriqueLot(duLot.map(({ activite }) => activite)) ?? 0;
  const lotEnRetard = avancementLot < theoriqueLot;
  const renseignees = duLot.filter(({ rang }) => estRenseigne(valeurs[rang]?.quantiteJour ?? "")).length;
  // Un lot replié qui porte une erreur s'ouvre : une erreur cachée ne se corrige pas.
  const enErreur =
    Boolean(errors.lotsTravailles?.[rangPoint]) || duLot.some(({ rang }) => Boolean(errors.activites?.[rang]));
  const deplie = ouvert || enErreur;

  // Seules les activités du jour s'affichent : celles déjà renseignées (un
  // brouillon rouvert), celles qu'on ajoute, et celles qui portent une erreur.
  // Un lot d'une seule activité la montre d'emblée.
  const [affichees, setAffichees] = useState<Set<string>>(() => {
    const lignes = getValues("activites");
    return new Set(
      duLot
        .filter(({ rang }) => {
          const ligne = lignes[rang];
          return (
            duLot.length === 1 ||
            (ligne !== undefined &&
              (estRenseigne(ligne.quantiteJour) || estRenseigne(ligne.localisation) || estRenseigne(ligne.observation)))
          );
        })
        .map(({ activite }) => activite.activiteId),
    );
  });
  const [ajout, setAjout] = useState(false);
  const visibles = duLot.filter(
    ({ activite, rang }) => affichees.has(activite.activiteId) || Boolean(errors.activites?.[rang]),
  );
  const visible = new Set(visibles.map(({ activite }) => activite.activiteId));

  // Retirer une activité efface sa saisie : ce qui ne s'affiche pas ne part pas.
  const basculerActivite = (activiteId: string) => {
    const cible = duLot.find(({ activite }) => activite.activiteId === activiteId);
    if (!cible) return;
    if (visible.has(activiteId)) {
      const options = { shouldDirty: true } as const;
      setValue(`activites.${cible.rang}.quantiteJour`, "", options);
      setValue(`activites.${cible.rang}.localisation`, "", options);
      setValue(`activites.${cible.rang}.observation`, "", options);
    }
    setAffichees((actuelles) => {
      const suivantes = new Set(actuelles);
      if (visible.has(activiteId)) suivantes.delete(activiteId);
      else suivantes.add(activiteId);
      return suivantes;
    });
  };

  return (
    <Collapsible
      open={deplie}
      onOpenChange={onOuvrir}
      className={cn(
        "group/lot rounded-xl border bg-card",
        enErreur ? "border-erreur" : deplie ? "border-primary-200" : "border-neutral-200",
      )}
    >
      <div className="flex items-center gap-2 p-3 sm:px-4">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
          >
            <ChevronRight
              className="size-4 shrink-0 text-neutral-400 transition-transform group-data-[state=open]/lot:rotate-90"
              aria-hidden="true"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm font-semibold text-neutral-900">
                {t("lotValeur", { code: lot.code, nom: lot.nom })}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 tabular-nums">
                <span className={cn("font-medium", lotEnRetard ? "text-avertissement" : "text-succes")}>
                  {t("pourcent", { valeur: avancementLot })}
                </span>
                <span>{t("avancement.activitesRenseignees", { n: renseignees, total: duLot.length })}</span>
              </span>
            </span>
          </button>
        </CollapsibleTrigger>
        {enErreur && <TriangleAlert className="size-4 shrink-0 text-erreur" aria-label={t("sectionEnErreur")} />}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-erreur hover:bg-erreur-fond hover:text-erreur"
          aria-label={t("avancement.retirerLot", { code: lot.code })}
          onClick={onRetirer}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <CollapsibleContent className="rounded-b-xl border-t border-neutral-100 bg-neutral-50 p-3 sm:p-4">
        <p className={cn("m-0 mb-3 text-xs font-medium tabular-nums", lotEnRetard ? "text-avertissement" : "text-succes")}>
          {t("avancement.avancementLot", { avancement: avancementLot, theorique: theoriqueLot })}
        </p>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-neutral-500 tabular-nums">
            {t("avancement.activitesDuJour", { n: visibles.length, total: duLot.length })}
          </span>
          <SelecteurAjout
            ouvert={ajout}
            onOuvrir={setAjout}
            libelle={t("avancement.ajouterActivite")}
            recherche={t("avancement.rechercherActivite")}
            aucunResultat={t("avancement.aucuneActiviteTrouvee")}
            options={duLot.map(({ activite }) => ({
              id: activite.activiteId,
              titre: t("avancement.activiteValeur", { code: activite.code, libelle: activite.libelle }),
              detail: t("avancement.activiteAvancement", {
                avancement: avancementSaisi(activite, null),
                theorique: activite.avancementTheorique,
              }),
              choisi: visible.has(activite.activiteId),
            }))}
            onBasculer={basculerActivite}
          />
        </div>
        {visibles.length === 0 && (
          <button
            type="button"
            onClick={() => setAjout(true)}
            className="mb-3 flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-neutral-300 bg-card px-4 py-5 text-center transition-colors hover:bg-neutral-100"
          >
            <span className="text-sm font-medium text-neutral-700">{t("avancement.aucuneActiviteChoisie")}</span>
            <span className="text-xs text-neutral-500">{t("avancement.aucuneActiviteChoisieAide")}</span>
          </button>
        )}
        <ul className="m-0 mb-3 flex list-none flex-col gap-3 p-0 empty:hidden">
          {visibles.map(({ activite, rang }) => {
            const quantite = versNombre(valeurs[rang]?.quantiteJour ?? "");
            const avancement = avancementSaisi(activite, quantite);
            const depasse = depassePrevu(activite, quantite);
            const enRetard = avancement < activite.avancementTheorique;
            return (
              <li key={activite.activiteId} className="rounded-lg border border-neutral-200 bg-card p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block text-xs text-neutral-500 tabular-nums">{activite.code}</span>
                    <span className="block text-sm font-semibold text-neutral-900">{activite.libelle}</span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1">
                    <span
                      className={cn("text-sm font-semibold tabular-nums", enRetard ? "text-avertissement" : "text-succes")}
                    >
                      {t("pourcent", { valeur: avancement })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-neutral-400 hover:bg-erreur-fond hover:text-erreur"
                      aria-label={t("avancement.retirerActivite", { code: activite.code })}
                      onClick={() => basculerActivite(activite.activiteId)}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </span>
                </div>
                <p className="m-0 mb-3 text-xs text-neutral-500 tabular-nums">
                  {t("avancement.repere", {
                    veille: formaterQuantite(activite.cumulVeille),
                    cumul: formaterQuantite(cumulSaisi(activite, quantite)),
                    prevu: formaterQuantite(activite.quantitePrevue),
                    unite: unite(activite),
                    theorique: activite.avancementTheorique,
                  })}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
                  <ChampTexte
                    name={`activites.${rang}.quantiteJour`}
                    libelle={t("avancement.quantiteJour")}
                    inputMode="decimal"
                    suffixe={unite(activite)}
                    placeholder="0"
                  />
                  <ChampTexte
                    name={`activites.${rang}.localisation`}
                    libelle={t("avancement.localisation")}
                    placeholder={t("avancement.localisationExemple")}
                  />
                </div>
                <div className="mt-3">
                  <ChampTexte name={`activites.${rang}.observation`} libelle={t("avancement.observation")} />
                </div>
                {depasse && (
                  <div className="mt-2">
                    <Signal ton="avertissement" icone={<TriangleAlert />}>
                      {t("avancement.depassement")}
                    </Signal>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <ChampTexte
          name={`lotsTravailles.${rangPoint}.observation`}
          libelle={t("avancement.pointLot")}
          aide={t("avancement.pointLotAide")}
          multiligne
          lignes={2}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * « + Ajouter… » : une liste à rechercher, où chaque option se coche ou se
 * décoche. Sert aux lots du jour et aux activités du jour d'un lot — sur un
 * chantier de vingt lots, une rangée de puces ne se lit plus.
 */
function SelecteurAjout({
  ouvert,
  onOuvrir,
  libelle,
  recherche,
  aucunResultat,
  options,
  onBasculer,
}: {
  ouvert: boolean;
  onOuvrir: (ouvert: boolean) => void;
  libelle: string;
  recherche: string;
  aucunResultat: string;
  options: { id: string; titre: string; detail: string; choisi: boolean }[];
  onBasculer: (id: string) => void;
}) {
  return (
    <Popover open={ouvert} onOpenChange={onOuvrir}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={ouvert}
          className="border-primary-200 bg-primary-50 text-primary-700 hover:border-primary-300 hover:bg-primary-100 hover:text-primary-800"
        >
          <Plus aria-hidden="true" />
          {libelle}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] p-0" align="end">
        <Command>
          <CommandInput placeholder={recherche} />
          <CommandList>
            <CommandEmpty>{aucunResultat}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.titre} ${option.id}`}
                  onSelect={() => onBasculer(option.id)}
                  className="items-start"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border",
                      option.choisi ? "border-primary bg-primary text-primary-foreground" : "border-neutral-300",
                    )}
                  >
                    {option.choisi && <Check className="size-3" aria-hidden="true" />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{option.titre}</span>
                    <span className="text-xs text-neutral-500">{option.detail}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

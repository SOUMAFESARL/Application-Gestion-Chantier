"use client";

import { Check, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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

export function SectionEffectifs({ complement }: { complement: string }) {
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
      complement={<Badge variante="information">{complement}</Badge>}
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

export function SectionPresenceSousTraitant({ complement }: { complement: string }) {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const presence = useWatch({ control, name: "presenceSousTraitant.presence" });
  const qualite = useWatch({ control, name: "presenceSousTraitant.qualite" });
  return (
    <SousRubrique
      titre={t("sections.equipes")}
      complement={<Badge variante="information">{complement}</Badge>}
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

  return (
    <SousRubrique erreur={erreurLots ?? erreurActivites}>
      {activites.length === 0 && <Signal ton="avertissement">{t("avancement.aucuneActivite")}</Signal>}
      {choisissables.length > 0 && (
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-medium text-neutral-900">{t("avancement.lotsTravailles")}</legend>
          <div className="flex flex-wrap gap-2">
            {choisissables.map((lot) => {
              const choisi = choisis.has(lot.id);
              const nombre = activites.filter((activite) => activite.lotId === lot.id).length;
              return (
                <button
                  key={lot.id}
                  type="button"
                  aria-pressed={choisi}
                  onClick={() => basculer(lot)}
                  className={cn(
                    "flex min-h-[var(--input-height-md)] cursor-pointer items-center gap-2 rounded-md border px-3 py-1 text-left text-sm font-medium transition-colors",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    choisi
                      ? "border-primary-500 bg-primary-50 text-primary-800"
                      : "border-neutral-200 bg-card text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  {choisi ? (
                    <Check aria-hidden="true" className="size-4 shrink-0" />
                  ) : (
                    <Plus aria-hidden="true" className="size-4 shrink-0" />
                  )}
                  <span className="flex flex-col">
                    <span>{t("lotValeur", { code: lot.code, nom: lot.nom })}</span>
                    <span className="text-xs font-normal opacity-80">{t("avancement.nbActivites", { nombre })}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {points.fields.map((point, rangPoint) => {
        const lot = lots.find((candidat) => candidat.id === point.lotId);
        if (!lot) return null;
        return (
          <PointDuLot
            key={point.cle}
            lot={lot}
            rangPoint={rangPoint}
            activites={activites}
            onRetirer={() => points.remove(rangPoint)}
          />
        );
      })}
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
  onRetirer,
}: {
  lot: LotJournal;
  rangPoint: number;
  activites: ActivitePreparee[];
  onRetirer: () => void;
}) {
  const t = useTranslations("journal.saisie");
  const unite = useUnite();
  const { control } = useFormContext<ValeursRapport>();
  const valeurs = useWatch({ control, name: "activites" });
  const duLot = activites.flatMap((activite, rang) => (activite.lotId === lot.id ? [{ activite, rang }] : []));
  const quantites = new Map(
    duLot.map(({ activite, rang }) => [activite.activiteId, versNombre(valeurs[rang]?.quantiteJour ?? "") ?? 0]),
  );
  const avancementLot = avancementLotSaisi(duLot.map(({ activite }) => activite), quantites) ?? 0;
  const theoriqueLot = avancementTheoriqueLot(duLot.map(({ activite }) => activite)) ?? 0;
  const lotEnRetard = avancementLot < theoriqueLot;

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
      <div className="mb-2 flex items-start gap-2">
        <h3 className="m-0 min-w-0 flex-1 text-sm font-semibold text-primary-800">
          {t("lotValeur", { code: lot.code, nom: lot.nom })}
        </h3>
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
      <div
        className="mb-1 h-2 overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuenow={avancementLot}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("avancement.jaugeLot", { code: lot.code })}
      >
        <div
          className={cn("h-full rounded-full", lotEnRetard ? "bg-avertissement" : "bg-succes")}
          style={{ width: `${avancementLot}%` }}
        />
      </div>
      <p className={cn("m-0 mb-3 text-xs font-medium tabular-nums", lotEnRetard ? "text-avertissement" : "text-succes")}>
        {t("avancement.avancementLot", { avancement: avancementLot, theorique: theoriqueLot })}
      </p>
      <ul className="m-0 mb-3 flex list-none flex-col gap-3 p-0">
        {duLot.map(({ activite, rang }) => {
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
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    enRetard ? "text-avertissement" : "text-succes",
                  )}
                >
                  {t("pourcent", { valeur: avancement })}
                </span>
              </div>
              <div
                className="mb-3 h-2 overflow-hidden rounded-full bg-neutral-100"
                role="progressbar"
                aria-valuenow={avancement}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("avancement.jauge", { libelle: activite.libelle })}
                title={t("avancement.niveau")}
              >
                <div
                  className={cn("h-full rounded-full", enRetard ? "bg-avertissement" : "bg-succes")}
                  style={{ width: `${avancement}%` }}
                />
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
    </div>
  );
}

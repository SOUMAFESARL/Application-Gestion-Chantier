"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge, Bouton } from "@/components/ui";
import { Separator } from "@/components/ui/separator";
import { useDroits } from "@/features/habilitations";
import { activitesDuProjet, quantiteRealisee, statutActivite } from "@/features/projets/regles";
import type { Activite, Lot } from "@/features/projets/types";
import { formaterMontant, formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BADGE_STATUT, BLOC, PANNEAU_COLLE } from "./classes";
import { Periode, Quantite } from "./StructureLots";

interface Props {
  activite: Activite | null;
  lot: Lot | null;
  lots: Lot[];
  onModifier: (activite: Activite) => void;
}

/**
 * Le détail de l'activité choisie dans l'arbre.
 *
 * Il reste en vue pendant qu'on parcourt le tableau (`sticky`) : c'est lui
 * qu'on lit en descendant la liste. Le rappel des liens avec les autres
 * modules dit d'où viennent les chiffres — l'avancement ne se saisit pas
 * ici, il remonte du journal de chantier.
 */
export function PanneauActivite({ activite, lot, lots, onModifier }: Props) {
  const t = useTranslations("projets.lotsActivites");
  const peutSaisir = useDroits().peut("projets", "saisie");

  if (!activite || !lot) {
    return (
      <aside className={cn(BLOC, "p-5 text-sm text-neutral-500", PANNEAU_COLLE)}>
        {t("panneau.aucuneSelection")}
      </aside>
    );
  }

  const statut = statutActivite(activite);
  const realisee = quantiteRealisee(activite);
  const dependance = activite.dependanceId
    ? activitesDuProjet(lots).find((candidate) => candidate.id === activite.dependanceId)
    : null;

  return (
    <aside
      className={cn(BLOC, "flex flex-col gap-4 p-5", PANNEAU_COLLE)}
      aria-labelledby="titre-activite"
    >
      <header className="flex flex-col gap-1.5">
        <span className="text-xs text-neutral-500">
          {t("panneau.enTete", { code: lot.code, nom: lot.nom })}
        </span>
        <h2 id="titre-activite" className="m-0 text-lg font-bold text-neutral-900">
          {t("libelleActivite", { code: activite.code, libelle: activite.libelle })}
        </h2>
        <span className="flex flex-wrap gap-1.5">
          <Badge variante={BADGE_STATUT[statut]}>{t(`statutActivite.${statut}`)}</Badge>
          {activite.surCheminCritique && (
            <span title={t("critiqueTitre")}>
              <Badge variante="avertissement">{t("critique")}</Badge>
            </span>
          )}
        </span>
      </header>

      <Separator />

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <Ligne libelle={t("panneau.quantitePrevue")} premiere>
          <Quantite activite={activite} />
        </Ligne>
        <Ligne libelle={t("panneau.realise")}>
          {realisee === null || activite.unite === null
            ? t("pourcentage", { valeur: activite.avancement })
            : t("panneau.realiseValeur", {
                quantite: t("quantiteAvecUnite", {
                  quantite: formaterQuantite(realisee),
                  unite: t(`unites.${activite.unite}`),
                }),
                pourcentage: activite.avancement,
              })}
        </Ligne>
        <Ligne libelle={t("panneau.periode")}>
          <Periode debut={activite.dateDebutPrevue} fin={activite.dateFinPrevue} />
        </Ligne>
        <Ligne libelle={t("panneau.budget")}>
          {activite.budget === null ? (
            <span className="text-neutral-500 italic">{t("panneau.nonDefini")}</span>
          ) : (
            formaterMontant(activite.budget)
          )}
        </Ligne>
        <Ligne libelle={t("panneau.equipe")}>
          {activite.equipe ? (
            t("libelleEquipe", { nom: activite.equipe.nom, effectif: activite.equipe.effectif })
          ) : (
            <span className="text-avertissement italic">{t("panneau.equipeAAffecter")}</span>
          )}
        </Ligne>
        <Ligne libelle={t("panneau.dependDe")}>
          {dependance
            ? t("libelleActivite", { code: dependance.code, libelle: dependance.libelle })
            : t("panneau.aucuneDependance")}
        </Ligne>
      </dl>

      <Separator />

      {peutSaisir && (
        <>
          <div className="flex flex-wrap gap-2">
            <Bouton
              variante="secondaire"
              taille="sm"
              iconeGauche={<Pencil size={16} aria-hidden="true" />}
              onClick={() => onModifier(activite)}
            >
              {t("panneau.modifier")}
            </Bouton>
          </div>

          <Separator />
        </>
      )}

      <p className="m-0 rounded-lg border border-solid border-primary-200 bg-primary-50 p-3 text-sm leading-relaxed text-neutral-700">
        <strong className="text-primary-700">{t("panneau.liensTitre")}</strong>{" "}
        {t("panneau.liensTexte")}
      </p>
    </aside>
  );
}

/**
 * Une ligne du détail. Chacune est précédée d'un filet sur toute la largeur de
 * la grille, sauf la première (`premiere`) : il sépare, il n'encadre pas.
 */
function Ligne({
  libelle,
  premiere = false,
  children,
}: {
  libelle: string;
  premiere?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {!premiere && <Separator className="col-span-2" />}
      <dt className="text-neutral-500">{libelle}</dt>
      <dd className="m-0 text-neutral-900 tabular-nums">{children}</dd>
    </>
  );
}

"use client";

import { Plus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge, Bouton, EtatVide } from "@/components/ui";
import {
  activitesEnCoursEquipe,
  compterEquipesParNature,
  filtrerEquipes,
  initiales,
  NATURES_EQUIPE,
  nomAbrege,
} from "@/features/projets/regles";
import { useDroits } from "@/features/habilitations";
import type { Equipe, Lot, NatureEquipe } from "@/features/projets/types";
import { cn } from "@/lib/utils";

import { BLOC } from "../classes";
import { AVATAR, AVATAR_CHEF, AVATAR_MEMBRE, BADGE_NATURE, pastilleEquipe } from "./classes";
import { lienFicheEquipe } from "./liens";

/** Au-delà, les membres se résument en « +n » : la rangée tient sur la carte. */
const AVATARS_VISIBLES = 5;

interface Props {
  equipes: Equipe[];
  lots: Lot[];
  onConstituer: () => void;
  onMembres: (equipe: Equipe) => void;
  onAffecter: (equipe: Equipe) => void;
}

/**
 * Les équipes du chantier, en cartes : nature, corps d'état, chef, effectif,
 * et ce sur quoi elles travaillent aujourd'hui.
 *
 * Un clic sur une carte ouvre la fiche de l'équipe (ses membres, leurs rôles).
 *
 * Le filtre par nature est une rangée de pastilles plutôt qu'un `Select` :
 * deux valeurs et « toutes », chacune avec son compte — c'est une lecture
 * autant qu'un filtre.
 */
export function EquipesProjet({ equipes, lots, onConstituer, onMembres, onAffecter }: Props) {
  const t = useTranslations("projets.equipesAffectations");
  const [nature, setNature] = useState<NatureEquipe | "">("");
  // Constituer une équipe, gérer ses membres, l'affecter : saisir dans « chantier ».
  const peutSaisir = useDroits().peut("chantier", "saisie");

  const comptes = useMemo(() => compterEquipesParNature(equipes), [equipes]);
  const visibles = useMemo(() => filtrerEquipes(equipes, nature), [equipes, nature]);

  const boutonConstituer = peutSaisir && (
    <Bouton
      variante="primaire"
      taille="sm"
      iconeGauche={<Plus size={16} aria-hidden="true" />}
      onClick={onConstituer}
    >
      {t("actionConstituer")}
    </Bouton>
  );

  if (equipes.length === 0) {
    return (
      <div className={BLOC}>
        <EtatVide
          titre={t("aucuneEquipeTitre")}
          description={t("aucuneEquipe")}
          action={boutonConstituer || undefined}
        />
      </div>
    );
  }

  const filtres: { valeur: NatureEquipe | ""; libelle: string }[] = [
    { valeur: "", libelle: t("filtreToutes", { nombre: equipes.length }) },
    ...NATURES_EQUIPE.map((valeur) => ({
      valeur,
      libelle: t(`filtreNature.${valeur}`, { nombre: comptes[valeur] }),
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t("filtreNatureLibelle")} className="flex flex-wrap gap-2">
          {filtres.map((filtre) => (
            <button
              key={filtre.valeur || "toutes"}
              type="button"
              aria-pressed={nature === filtre.valeur}
              onClick={() => setNature(filtre.valeur)}
              className={cn(
                "cursor-pointer rounded-full border border-solid px-3 py-1 text-sm font-medium transition-colors",
                nature === filtre.valeur
                  ? "border-primary bg-primary-50 text-primary-800"
                  : "border-neutral-200 bg-neutral-0 text-neutral-700 hover:bg-neutral-50",
              )}
            >
              {filtre.libelle}
            </button>
          ))}
        </div>
        <span className="flex-1 max-sm:hidden" />
        {boutonConstituer}
      </div>

      <ul className="m-0 grid list-none grid-cols-3 gap-4 p-0 max-xl:grid-cols-2 max-md:grid-cols-1">
        {visibles.map((equipe) => (
          <li key={equipe.id}>
            <CarteEquipe
              equipe={equipe}
              rang={equipes.indexOf(equipe)}
              lots={lots}
              onMembres={() => onMembres(equipe)}
              onAffecter={() => onAffecter(equipe)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CarteEquipe({
  equipe,
  rang,
  lots,
  onMembres,
  onAffecter,
}: {
  equipe: Equipe;
  /** Le rang de l'équipe dans le chantier — il fixe sa pastille. */
  rang: number;
  lots: Lot[];
  onMembres: () => void;
  onAffecter: () => void;
}) {
  const t = useTranslations("projets.equipesAffectations");
  const peutSaisir = useDroits().peut("chantier", "saisie");
  const enCours = activitesEnCoursEquipe(equipe.id, lots);
  const caches = Math.max(equipe.membres.length - AVATARS_VISIBLES, 0);

  return (
    // Toute la carte mène à la fiche de l'équipe : le lien du titre s'étend
    // sur elle (`after:inset-0`), et les boutons passent au-dessus (`z-10`).
    <article
      className={cn(
        BLOC,
        "relative flex h-full flex-col gap-3 p-5 transition-shadow hover:border-primary-200 hover:shadow-md",
      )}
      aria-labelledby={`equipe-${equipe.id}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3
            id={`equipe-${equipe.id}`}
            className="m-0 flex items-center gap-2 text-base font-bold text-neutral-900"
          >
            <span
              className={cn("size-2.5 shrink-0 rounded-full", pastilleEquipe(rang))}
              aria-hidden="true"
            />
            <Link
              href={lienFicheEquipe(equipe.projetId, equipe.id)}
              aria-label={t("actionFicheLibelle", { nom: equipe.nom })}
              className="truncate text-inherit no-underline after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:shadow-[var(--shadow-focus)]"
            >
              {equipe.nom}
            </Link>
          </h3>
          <span className="text-sm text-neutral-500">{equipe.specialite}</span>
        </div>
        <Badge variante={BADGE_NATURE[equipe.nature]}>{t(`nature.${equipe.nature}`)}</Badge>
      </header>

      <div className="flex items-center" aria-hidden="true">
        {equipe.chef && (
          <span className={cn(AVATAR, AVATAR_CHEF)} title={t("chefTitre")}>
            {initiales(equipe.chef.prenom, equipe.chef.nom)}
          </span>
        )}
        {equipe.membres.slice(0, AVATARS_VISIBLES).map((membre) => (
          <span key={membre.id} className={cn(AVATAR, AVATAR_MEMBRE)}>
            {initiales(membre.prenom, membre.nom)}
          </span>
        ))}
        {caches > 0 && (
          <span className={cn(AVATAR, "bg-neutral-100 text-neutral-600")}>
            {t("avatarsCaches", { nombre: caches })}
          </span>
        )}
      </div>

      <p className="m-0 text-sm text-neutral-800">
        {t.rich("chefEtEffectif", {
          chef: nomAbrege(equipe.chef) ?? t("chefNonDesigne"),
          nombre: equipe.effectif,
          fort: (morceau) => <strong className="font-semibold text-neutral-900">{morceau}</strong>,
        })}
      </p>

      <p className="m-0 flex-1 text-sm text-neutral-500">
        {enCours.length > 0
          ? t("actuellementSur", { codes: enCours.map((activite) => activite.code).join(", ") })
          : t("aucuneActiviteEnCours")}
      </p>

      {peutSaisir && (
      <div className="relative z-10 flex flex-wrap gap-2 self-start">
        <Bouton
          variante="secondaire"
          taille="sm"
          iconeGauche={<Users size={16} aria-hidden="true" />}
          aria-label={t("actionMembresLibelle", { nom: equipe.nom })}
          onClick={onMembres}
        >
          {t("actionMembres")}
        </Bouton>
        <Bouton
          variante="secondaire"
          taille="sm"
          iconeGauche={<UserPlus size={16} aria-hidden="true" />}
          aria-label={t("actionAffecterLibelle", { nom: equipe.nom })}
          onClick={onAffecter}
        >
          {t("actionAffecter")}
        </Bouton>
      </div>
      )}
    </article>
  );
}

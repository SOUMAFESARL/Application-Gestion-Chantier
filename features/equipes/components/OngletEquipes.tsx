"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, HardHat, Plus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import type { Projet } from "@/features/projets/types";

import { listerEquipesProjet } from "../adaptateur";
import { cleEquipesProjet } from "../cles";
import type { EquipeProjet } from "../types";
import { TiroirEquipeProjet } from "./TiroirEquipeProjet";

/**
 * L'onglet Équipes de la fiche projet (décision P12) : les équipes du projet, de notre entreprise
 * ou d'un partenaire, avec leur chef, leur effectif et les cases où elles travaillent. Une équipe
 * s'ouvre dans son tiroir : identité, membres datés pris dans le registre, cases.
 */
export function OngletEquipes({ projet, equipeOuverte = null }: { projet: Projet; equipeOuverte?: string | null }) {
  const t = useTranslations("equipes");
  const { peutSurProjet } = useDroits();
  const [ouverte, setOuverte] = useState<string | "nouvelle" | null>(equipeOuverte);
  const permis = peutSurProjet(PERMISSIONS.GERER_EQUIPES, projet);

  const requete = useQuery({
    queryKey: cleEquipesProjet(projet.id),
    queryFn: ({ signal }) => listerEquipesProjet(projet.id, signal),
  });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  const equipes = requete.data;
  const equipe = ouverte && ouverte !== "nouvelle" ? (equipes.find((e) => e.id === ouverte) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-neutral-600">{t("description")}</p>
        <BoutonPermis size="sm" permis={permis} permission={PERMISSIONS.GERER_EQUIPES} onClick={() => setOuverte("nouvelle")}>
          <Plus />
          {t("nouvelle")}
        </BoutonPermis>
      </div>

      {equipes.length === 0 ? (
        <EtatVide icone={<Users size={40} strokeWidth={1.5} />} titre={t("vide")} description={t("videDescription")} />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4 p-0">
          {equipes.map((une) => (
            <li key={une.id}>
              <CarteEquipe equipe={une} onOuvrir={() => setOuverte(une.id)} />
            </li>
          ))}
        </ul>
      )}

      {ouverte !== null && (ouverte === "nouvelle" || equipe) && (
        <TiroirEquipeProjet
          key={ouverte}
          projet={projet}
          equipe={equipe}
          onCreee={(creee) => setOuverte(creee.id)}
          onFermer={() => setOuverte(null)}
        />
      )}
    </div>
  );
}

function CarteEquipe({ equipe, onOuvrir }: { equipe: EquipeProjet; onOuvrir: () => void }) {
  const t = useTranslations("equipes");
  return (
    <button
      type="button"
      onClick={onOuvrir}
      className="flex w-full cursor-pointer flex-col gap-3 rounded-xl border border-solid border-neutral-200 bg-neutral-0 p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex flex-col">
          <span className="text-base font-semibold text-neutral-900">{equipe.nom}</span>
          {equipe.corpsEtat && <span className="text-sm text-neutral-600">{equipe.corpsEtat}</span>}
        </span>
        {!equipe.estActive && <Badge variante="neutre">{t("inactive")}</Badge>}
      </span>
      <span className="flex items-center gap-2 text-sm text-neutral-700">
        <Building2 size={16} aria-hidden="true" />
        {equipe.entreprise.interne ? t("notreEntreprise") : equipe.entreprise.nom}
      </span>
      <span className="flex items-center gap-2 text-sm text-neutral-700">
        <HardHat size={16} aria-hidden="true" />
        {equipe.chef ? equipe.chef.personne.nomComplet : t("sansChef")}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <Badge variante="primaire">{t("effectif", { nombre: equipe.effectif })}</Badge>
        <Badge variante={equipe.cases.length > 0 ? "information" : "neutre"}>
          {t("cases", { nombre: equipe.cases.length })}
        </Badge>
      </span>
    </button>
  );
}

"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { initiales, membresEquipe } from "@/features/projets/regles";
import type { Equipe, MembreEquipe } from "@/features/projets/types";
import { cn } from "@/lib/utils";

import { AVATAR_CHEF, AVATAR_MEMBRE, BADGE_NATURE } from "./classes";
import { lienFicheEquipe } from "./liens";

interface Props {
  equipe: Equipe | null;
  onFermer: () => void;
}

/**
 * La composition d'une équipe, en lecture : son chef, puis ses membres, chacun
 * avec son rôle dans l'équipe. La fiche de chaque personne (contrat, heures)
 * appartient aux Ressources humaines ; ce tiroir ne dit que qui est dans
 * l'équipe, et à quel titre. On la modifie depuis la fiche de l'équipe.
 */
export function TiroirMembres({ equipe, onFermer }: Props) {
  const t = useTranslations("projets.equipesAffectations");

  return (
    <Sheet open={equipe !== null} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        {equipe && (
          <>
            <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
              <SheetTitle className="flex items-center gap-2 text-lg text-neutral-900">
                {equipe.nom}
                <Badge variante={BADGE_NATURE[equipe.nature]}>{t(`nature.${equipe.nature}`)}</Badge>
              </SheetTitle>
              <SheetDescription>
                {t("membresSousTitre", { specialite: equipe.specialite, nombre: equipe.effectif })}
              </SheetDescription>
            </SheetHeader>

            <ul className="m-0 flex flex-1 list-none flex-col overflow-y-auto p-0 [scrollbar-width:thin]">
              {membresEquipe(equipe).map((membre) => (
                <Personne key={membre.id} membre={membre} chef={membre.id === equipe.chef?.id} />
              ))}
            </ul>

            <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
              <Button type="button" variant="outline" onClick={onFermer}>
                {t("fermer")}
              </Button>
              <Button asChild>
                <Link href={lienFicheEquipe(equipe.projetId, equipe.id)}>
                  {t("voirFiche")}
                  <ArrowRight />
                </Link>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Personne({ membre, chef = false }: { membre: MembreEquipe; chef?: boolean }) {
  const t = useTranslations("projets.equipesAffectations");
  return (
    <li className="flex items-center gap-3 border-0 border-b border-solid border-neutral-100 px-6 py-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          chef ? AVATAR_CHEF : AVATAR_MEMBRE,
        )}
        aria-hidden="true"
      >
        {initiales(membre.prenom, membre.nom)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-neutral-900">
          {t("nomComplet", { prenom: membre.prenom, nom: membre.nom })}
        </span>
        <span className="text-xs text-neutral-500">{t(`role.${membre.role}`)}</span>
      </span>
      {chef ? (
        <Badge variante="primaire">{t("chefDEquipe")}</Badge>
      ) : (
        membre.collaborateurId && <Badge variante="neutre">{t("origineCollaborateur")}</Badge>
      )}
    </li>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleX, Info, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changerRoleMembreEquipe } from "@/features/projets/adaptateur";
import { ROLE_ANCIEN_CHEF, ROLES_MEMBRE_EQUIPE } from "@/features/projets/regles";
import type { Equipe, MembreEquipe, RoleMembreEquipe } from "@/features/projets/types";
import type { ErreurApi } from "@/lib/api";

interface Props {
  /** `null` : la modale est fermée. */
  membre: MembreEquipe | null;
  onFermer: () => void;
  projetId: string;
  equipe: Equipe;
  onModifiee: (equipe: Equipe) => void;
}

/**
 * Le changement de rôle d'un membre. Nommer un chef, ou faire quitter ce rôle
 * au chef en place, touche une autre personne que celle qu'on modifie : la
 * modale le dit **avant** l'enregistrement, pas après.
 *
 * L'écran la remonte à chaque ouverture (`key`) : elle repart du rôle actuel.
 */
export function ModaleRoleMembre({ membre, onFermer, projetId, equipe, onModifiee }: Props) {
  const t = useTranslations("projets.equipesAffectations.fiche.changementRole");
  const tEcran = useTranslations("projets.equipesAffectations");
  const [role, setRole] = useState<RoleMembreEquipe | undefined>(membre?.role);

  const mutation = useMutation({
    mutationFn: (nouveau: RoleMembreEquipe) =>
      changerRoleMembreEquipe(projetId, equipe.id, (membre as MembreEquipe).id, nouveau),
    onSuccess: (modifiee) => {
      onModifiee(modifiee);
      onFermer();
    },
  });

  const nom = membre ? tEcran("nomComplet", { prenom: membre.prenom, nom: membre.nom }) : "";
  const estChef = membre !== null && equipe.chef?.id === membre.id;
  const inchange = !membre || role === membre.role;

  let consequence: string | null = null;
  if (membre && role === "CHEF_EQUIPE" && !estChef) {
    consequence = equipe.chef
      ? t("nouveauChef", {
          nom,
          ancien: tEcran("nomComplet", { prenom: equipe.chef.prenom, nom: equipe.chef.nom }),
          role: tEcran(`role.${ROLE_ANCIEN_CHEF}`),
        })
      : t("premierChef", { nom });
  } else if (estChef && role !== "CHEF_EQUIPE") {
    consequence = t("sansChef");
  }

  const erreur = mutation.error as ErreurApi | null;

  return (
    <Dialog
      open={membre !== null}
      onOpenChange={(ouvert) => !ouvert && !mutation.isPending && onFermer()}
    >
      <DialogContent className="sm:max-w-[480px]">
        {membre && (
          <>
            <DialogHeader>
              <DialogTitle>{t("titre")}</DialogTitle>
              <DialogDescription>
                {t("sousTitre", { nom, role: tEcran(`role.${membre.role}`).toLowerCase() })}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {erreur && (
                <Alert variant="erreur">
                  <CircleX />
                  <AlertDescription>{erreur.message || t("erreurGenerique")}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="nouveau-role">{t("champ")}</Label>
                <Select
                  value={role}
                  onValueChange={(valeur) => setRole(valeur as RoleMembreEquipe)}
                  disabled={mutation.isPending}
                >
                  <SelectTrigger id="nouveau-role" className="h-[var(--input-height-md)] w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_MEMBRE_EQUIPE.map((candidat) => (
                      <SelectItem key={candidat} value={candidat}>
                        {tEcran(`role.${candidat}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {consequence && (
                <Alert variant={estChef ? "avertissement" : "information"}>
                  <Info />
                  <AlertDescription>{consequence}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onFermer}
                disabled={mutation.isPending}
              >
                {t("annuler")}
              </Button>
              <Button
                type="button"
                onClick={() => role && mutation.mutate(role)}
                disabled={inchange || mutation.isPending}
                aria-busy={mutation.isPending}
              >
                {mutation.isPending && <LoaderCircle className="animate-spin" />}
                {t("enregistrer")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

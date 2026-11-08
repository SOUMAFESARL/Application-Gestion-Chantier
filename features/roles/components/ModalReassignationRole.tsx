"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alerte, Bouton } from "@/components/ui";
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
import type { RoleItem } from "../types";

interface Props {
  ouverte: boolean;
  roleASupprimer: RoleItem | null;
  rolesDisponibles: RoleItem[];
  onConfirmer: (roleCibleId: string) => Promise<void>;
  onFermer: () => void;
  enCours?: boolean;
}

export function ModalReassignationRole({
  ouverte,
  roleASupprimer,
  rolesDisponibles,
  onConfirmer,
  onFermer,
  enCours = false,
}: Props) {
  const t = useTranslations("roles");
  const [roleCibleId, setRoleCibleId] = useState<string>("");
  const [erreur, setErreur] = useState<string | null>(null);

  if (!roleASupprimer) return null;

  const rolesEligibles = rolesDisponibles.filter(
    (r) => (r.id !== roleASupprimer.id && !r.est_systeme) || (r.est_systeme && r.code !== "AD")
  );

  async function valider() {
    if (!roleCibleId) {
      setErreur(t("champRoleRemplacement"));
      return;
    }
    setErreur(null);
    await onConfirmer(roleCibleId);
  }

  return (
    <Dialog open={ouverte} onOpenChange={(visible) => !visible && !enCours && onFermer()}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="text-lg leading-[1.3] font-bold text-neutral-900">
            {t("titreSuppression", { role: roleASupprimer.libelle })}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("titreSuppression", { role: roleASupprimer.libelle })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 [&>[role=alert]]:mb-0">
          <Alerte type="avertissement">
            {roleASupprimer.nb_utilisateurs > 0
              ? t("avertissementSuppression", { n: roleASupprimer.nb_utilisateurs })
              : t("confirmationSuppressionSimple")}
          </Alerte>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-remplacement" className="font-normal leading-snug text-neutral-900">
              {t("champRoleRemplacement")}
              <span className="ml-0.5 text-erreur" aria-hidden="true">
                *
              </span>
            </Label>
            <Select
              value={roleCibleId}
              onValueChange={(valeur) => {
                setRoleCibleId(valeur);
                setErreur(null);
              }}
              disabled={enCours}
            >
              <SelectTrigger
                id="role-remplacement"
                className="w-full data-placeholder:text-neutral-400"
                aria-invalid={Boolean(erreur)}
              >
                <SelectValue placeholder={t("choisirRemplacement")} />
              </SelectTrigger>
              <SelectContent>
                {rolesEligibles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.libelle} ({r.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erreur && <span className="text-xs text-erreur">{erreur}</span>}
          </div>
        </div>

        <DialogFooter className="mt-2 gap-3 sm:flex-wrap sm:items-center sm:justify-end">
          <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Bouton>
          <Bouton
            variante="danger"
            onClick={valider}
            enCours={enCours}
            disabled={!roleCibleId || enCours}
          >
            {t("confirmerSuppression")}
          </Bouton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

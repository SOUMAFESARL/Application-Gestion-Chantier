"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bouton } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ModificationRolePayload } from "../api";
import { MODULES_CCD } from "../types";
import type { AccesModule, PermissionsModules, RoleItem } from "../types";
import { SelecteurAcces } from "./SelecteurAcces";

/** Ascenseur fin, dans le ton du contenu qu'il défile — même recette que `sidebar.tsx`. */
const ASCENSEUR_FIN = "[scrollbar-width:thin] [scrollbar-color:var(--color-neutral-300)_transparent]";

/** Des exemples, pas des valeurs : le texte indicatif s'efface devant la saisie. */
const INDICATIF_LEGER = "placeholder:font-normal placeholder:text-neutral-400";

interface Props {
  ouverte: boolean;
  role: RoleItem | null;
  rolesExistant: RoleItem[];
  onEnregistrer: (roleId: string, data: Required<ModificationRolePayload>) => Promise<void>;
  onFermer: () => void;
  enCours?: boolean;
}

/** L'astérisque des champs obligatoires. */
function Requis() {
  return (
    <span className="ml-0.5 text-erreur" aria-hidden="true">
      *
    </span>
  );
}

/**
 * Même tiroir que `ModalNouveauRole` : intitulé, description et accès par
 * module. Le code identifiant ne se modifie pas — des affectations y sont
 * rattachées.
 *
 * `role` change de valeur quand la personne clique sur un autre rôle sans
 * fermer le tiroir : `page.tsx` remonte alors ce composant via `key={role.id}`,
 * ce qui réinitialise ces `useState` sans passer par un effet.
 */
export function ModalModificationRole({
  ouverte,
  role,
  rolesExistant,
  onEnregistrer,
  onFermer,
  enCours = false,
}: Props) {
  const t = useTranslations("roles");
  const [libelle, setLibelle] = useState(role?.libelle ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<PermissionsModules>(() => ({
    ...(role?.permissions_modules ?? {}),
  }));
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  if (!role) return null;

  function changerAccesModule(module: string, acces: AccesModule[]) {
    setPermissions((prev) => ({ ...prev, [module]: acces }));
  }

  async function valider() {
    if (!role) return;
    const err: Record<string, string> = {};
    const libelleNettoye = libelle.trim();

    if (!libelleNettoye) {
      err.libelle = t("erreurIntituleRequis");
    } else if (
      libelleNettoye.toLowerCase().includes("directeur general") ||
      // eslint-disable-next-line no-restricted-syntax -- comparaison, pas affichage
      libelleNettoye.toLowerCase().includes("directeur général")
    ) {
      err.libelle = t("erreurDgUnique");
    } else if (
      rolesExistant.some(
        (r) => r.id !== role.id && r.libelle.trim().toLowerCase() === libelleNettoye.toLowerCase(),
      )
    ) {
      err.libelle = t("erreurCodeExistant");
    }

    setErreurs(err);
    if (Object.keys(err).length > 0) return;

    await onEnregistrer(role.id, {
      libelle: libelleNettoye,
      description: description.trim(),
      permissions_modules: permissions,
    });
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg font-medium text-neutral-900">
            {t("titreModification", { role: role.libelle })}
          </SheetTitle>
          <SheetDescription>{t("sousTitreModification")}</SheetDescription>
        </SheetHeader>

        <div className={`flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 ${ASCENSEUR_FIN}`}>
          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="role-modif-libelle" className="font-normal">
                {t("champIntitule")} <Requis />
              </Label>
              <Input
                id="role-modif-libelle"
                type="text"
                value={libelle}
                placeholder={t("placeholderIntitule")}
                onChange={(e) => setLibelle(e.target.value)}
                className={INDICATIF_LEGER}
                aria-invalid={Boolean(erreurs.libelle)}
              />
              {erreurs.libelle && <span className="text-xs text-erreur">{erreurs.libelle}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="role-modif-code" className="font-normal">
                {t("champCode")}
              </Label>
              <Input id="role-modif-code" type="text" value={role.code} disabled className="font-mono" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="role-modif-description" className="font-normal">
              {t("champDescription")}
            </Label>
            <Textarea
              id="role-modif-description"
              value={description}
              rows={2}
              placeholder={t("placeholderDescription")}
              onChange={(e) => setDescription(e.target.value)}
              className={INDICATIF_LEGER}
            />
          </div>

          <div>
            <Label className="mb-2 font-normal">{t("matriceDroitsTitre")}</Label>
            <div className="rounded-md border border-neutral-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="p-2 text-left font-normal text-neutral-600">{t("module")}</th>
                    <th className="w-[200px] p-2 text-left font-normal text-neutral-600">{t("colonneAcces")}</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES_CCD.map((code) => (
                    <tr key={code} className="border-t border-neutral-200">
                      <td className="p-2">
                        <span className="font-medium text-neutral-900">{t(`modules.${code}.nom`)}</span>
                        <div className="text-xs text-neutral-500">{t(`modules.${code}.description`)}</div>
                      </td>
                      <td className="p-2">
                        <SelecteurAcces
                          variante="champ"
                          valeur={permissions[code] ?? []}
                          onChange={(acces) => changerAccesModule(code, acces)}
                          libelleAria={t(`modules.${code}.nom`)}
                          disabled={enCours}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Bouton>
          <Bouton variante="primaire" onClick={valider} enCours={enCours}>
            {t("enregistrer")}
          </Bouton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

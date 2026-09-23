"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Bouton } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MODULES_CCD } from "../types";
import type { NiveauAcces, RoleItem } from "../types";
import { SelecteurNiveau } from "./SelecteurNiveau";

/** Ascenseur fin, dans le ton du contenu qu'il défile — même recette que `sidebar.tsx`. */
const ASCENSEUR_FIN = "[scrollbar-width:thin] [scrollbar-color:var(--color-neutral-300)_transparent]";

interface Props {
  ouverte: boolean;
  rolesExistant: RoleItem[];
  onEnregistrer: (data: {
    code: string;
    libelle: string;
    description: string;
    permissions_modules: Record<string, NiveauAcces>;
  }) => Promise<void>;
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

export function ModalNouveauRole({
  ouverte,
  rolesExistant,
  onEnregistrer,
  onFermer,
  enCours = false,
}: Props) {
  const t = useTranslations("roles");
  const [code, setCode] = useState("");
  const [libelle, setLibelle] = useState("");
  const [description, setDescription] = useState("");
  const [modele, setModele] = useState("");
  const [permissions, setPermissions] = useState<Record<string, NiveauAcces>>(() => {
    const init: Record<string, NiveauAcces> = {};
    for (const code of MODULES_CCD) {
      init[code] = 3;
    }
    return init;
  });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  function handleLibelleChange(nouveauLibelle: string) {
    setLibelle(nouveauLibelle);
    const slug = nouveauLibelle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .slice(0, 30);
    setCode(slug);
  }

  function copierDepuis(roleId: string) {
    setModele(roleId);
    const modele = rolesExistant.find((r) => r.id === roleId);
    if (modele) {
      setPermissions({ ...modele.permissions_modules });
    }
  }

  function changerNiveauModule(module: string, niveau: NiveauAcces) {
    setPermissions((prev) => ({ ...prev, [module]: niveau }));
  }

  async function valider() {
    const err: Record<string, string> = {};
    const codeNettoye = code.trim().toUpperCase();
    const libelleNettoye = libelle.trim();

    // Ces trois messages nommaient le **champ** au lieu de dire ce qui n'allait
    // pas : la personne lisait « Intitulé du rôle » et « Code identifiant » en
    // rouge sous les champs concernés, sans savoir s'ils étaient vides, trop
    // longs ou déjà pris — et le même libellé servait pour « vide » et pour
    // « déjà utilisé », deux causes qui n'ont pas la même correction.
    if (!libelleNettoye) {
      err.libelle = t("erreurIntituleRequis");
    } else if (
      libelleNettoye.toLowerCase().includes("directeur general") ||
      // On reconnaît ce que la personne a tapé, avec et sans accents.
      // eslint-disable-next-line no-restricted-syntax -- comparaison, pas affichage
      libelleNettoye.toLowerCase().includes("directeur général")
    ) {
      err.libelle = t("erreurDgUnique");
    }

    if (!codeNettoye) {
      err.code = t("erreurCodeRequis");
    } else if (["DG", "ADMIN", "AD"].includes(codeNettoye)) {
      err.code = t("erreurCodeReserve");
    } else if (rolesExistant.some((r) => r.code.toUpperCase() === codeNettoye)) {
      err.code = t("erreurCodeExistant");
    }

    setErreurs(err);
    if (Object.keys(err).length > 0) return;

    await onEnregistrer({
      code: codeNettoye,
      libelle: libelleNettoye,
      description: description.trim(),
      permissions_modules: permissions,
    });
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg font-medium text-neutral-900">{t("titreCreation")}</SheetTitle>
          <SheetDescription>{t("sousTitreCreation")}</SheetDescription>
        </SheetHeader>

        <div className={`flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 ${ASCENSEUR_FIN}`}>
          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="role-libelle" className="font-normal">
                {t("champIntitule")} <Requis />
              </Label>
              <Input
                id="role-libelle"
                type="text"
                value={libelle}
                placeholder={t("placeholderIntitule")}
                onChange={(e) => handleLibelleChange(e.target.value)}
                aria-invalid={Boolean(erreurs.libelle)}
              />
              {erreurs.libelle && <span className="text-xs text-erreur">{erreurs.libelle}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="role-code" className="font-normal">
                {t("champCode")} <Requis />
              </Label>
              <Input
                id="role-code"
                type="text"
                value={code}
                placeholder={t("placeholderCode")}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono"
                aria-invalid={Boolean(erreurs.code)}
              />
              {erreurs.code && <span className="text-xs text-erreur">{erreurs.code}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="role-description" className="font-normal">
              {t("champDescription")}
            </Label>
            <Textarea
              id="role-description"
              value={description}
              rows={2}
              placeholder={t("placeholderDescription")}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="role-modele" className="font-normal">
              {t("champModele")}
            </Label>
            <Select value={modele} onValueChange={copierDepuis}>
              <SelectTrigger id="role-modele" className="w-full">
                <SelectValue placeholder={t("choisirModele")} />
              </SelectTrigger>
              <SelectContent>
                {rolesExistant.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {t("copierDroitsDe", { role: r.libelle })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 font-normal">{t("matriceDroitsTitre")}</Label>
            <div className={`max-h-[320px] overflow-y-auto rounded-md border border-neutral-200 ${ASCENSEUR_FIN}`}>
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-neutral-50">
                  <tr>
                    <th className="p-2 text-left font-normal text-neutral-600">{t("role")}</th>
                    <th className="p-2 text-right font-normal text-neutral-600">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES_CCD.map((code) => (
                    <tr key={code} className="border-t border-neutral-200">
                      <td className="p-2">
                        <span className="font-medium text-neutral-900">{t(`modules.${code}.nom`)}</span>
                        <div className="text-xs text-neutral-500">{t(`modules.${code}.description`)}</div>
                      </td>
                      <td className="p-2 text-right">
                        <SelecteurNiveau
                          valeur={permissions[code] ?? 0}
                          onChange={(nouveau) => changerNiveauModule(code, nouveau)}
                          libelleAria={t(`modules.${code}.nom`)}
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
            {t("creer")}
          </Bouton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

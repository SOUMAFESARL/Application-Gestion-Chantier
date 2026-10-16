"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alerte, Bouton } from "@/components/ui";
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
import type { CreationRolePayload } from "../api";
import { codesDuRole } from "../regles";
import type { ModuleCatalogue, RoleItem } from "../types";
import { EditeurPermissions } from "./EditeurPermissions";

/** Ascenseur fin, dans le ton du contenu qu'il défile — même recette que `sidebar.tsx`. */
const ASCENSEUR_FIN = "[scrollbar-width:thin] [scrollbar-color:var(--color-neutral-300)_transparent]";

/** Des exemples, pas des valeurs : le texte indicatif s'efface devant la saisie. */
const INDICATIF_LEGER = "placeholder:font-normal placeholder:text-neutral-400";

interface Props {
  ouverte: boolean;
  catalogue: ModuleCatalogue[];
  rolesExistant: RoleItem[];
  onEnregistrer: (data: CreationRolePayload) => Promise<void>;
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
  catalogue,
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
  const [codes, setCodes] = useState<string[]>([]);
  const [nbCodesEcartes, setNbCodesEcartes] = useState(0);
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
    const roleModele = rolesExistant.find((r) => r.id === roleId);
    if (roleModele) {
      const tousCodes = codesDuRole(roleModele);
      const codesCatalogue = new Set(
        catalogue.flatMap((mod) => mod.permissions.map((p) => p.code.toLowerCase())),
      );
      const copies = tousCodes.filter((c) => codesCatalogue.has(c.toLowerCase()));
      const ecartes = tousCodes.length - copies.length;
      setCodes(copies);
      setNbCodesEcartes(ecartes);
    } else {
      setNbCodesEcartes(0);
    }
  }

  async function valider() {
    const err: Record<string, string> = {};
    const codeNettoye = code.trim().toUpperCase();
    const libelleNettoye = libelle.trim();

    if (!libelleNettoye) {
      err.libelle = t("erreurIntituleRequis");
    } else if (
      libelleNettoye.toLowerCase().includes("directeur general") ||
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
      portee: "PROJET",
      permissions: codes,
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
                className={INDICATIF_LEGER}
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
                className={`font-mono ${INDICATIF_LEGER}`}
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
              className={INDICATIF_LEGER}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="role-modele" className="font-normal">
              {t("champModele")}
            </Label>
            <Select value={modele} onValueChange={copierDepuis}>
              <SelectTrigger id="role-modele" className="w-full data-placeholder:text-neutral-400">
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
            {nbCodesEcartes > 0 && (
              <div className="mt-1">
                <Alerte type="information">
                  {t("copieFiltree", { n: nbCodesEcartes })}
                </Alerte>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label className="font-normal">{t("matriceDroitsTitre")}</Label>
            <EditeurPermissions
              catalogue={catalogue}
              codes={codes}
              onChange={setCodes}
              disabled={enCours}
            />
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

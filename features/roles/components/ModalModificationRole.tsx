"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alerte, Bouton } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useDroits } from "@/features/habilitations";
import type { ModificationRolePayload } from "../api";
import { codesDuRole, codesHorsCatalogue, peutChangerPortee } from "../regles";
import type { ModuleCatalogue, PorteeRole, RoleItem } from "../types";
import { EditeurPermissions } from "./EditeurPermissions";

/** Ascenseur fin, dans le ton du contenu qu'il défile — même recette que `sidebar.tsx`. */
const ASCENSEUR_FIN = "[scrollbar-width:thin] [scrollbar-color:var(--color-neutral-300)_transparent]";

/** Des exemples, pas des valeurs : le texte indicatif s'efface devant la saisie. */
const INDICATIF_LEGER = "placeholder:font-normal placeholder:text-neutral-400";

interface Props {
  ouverte: boolean;
  role: RoleItem | null;
  rolesExistant: RoleItem[];
  catalogue: ModuleCatalogue[];
  gestes: {
    modifiable: boolean; // intitulé, description
    matriceModifiable: boolean;
    supprimable: boolean;
    raison: "roleDg" | "roleSysteme" | "horsPerimetre" | null;
  };
  onEnregistrer: (roleId: string, data: ModificationRolePayload) => Promise<void>;
  onFermer: () => void;
  enCours?: boolean;
  /**
   * Le serveur demande de confirmer un changement de portée (409). La confirmation se fait
   * **dans** le tiroir : une `Modale` ouverte par-dessus restait sous lui, et le tiroir rend le
   * reste de la page inerte — personne ne pouvait ni confirmer ni annuler.
   */
  confirmationPortee?: { personnes: number; versEntreprise: boolean } | null;
  onConfirmerPortee?: () => void;
  onAnnulerPortee?: () => void;
}

/** L'astérisque des champs obligatoires. */
function Requis() {
  return (
    <span className="ml-0.5 text-erreur" aria-hidden="true">
      *
    </span>
  );
}

export function ModalModificationRole({
  ouverte,
  role,
  rolesExistant,
  catalogue,
  gestes,
  onEnregistrer,
  onFermer,
  enCours = false,
  confirmationPortee = null,
  onConfirmerPortee,
  onAnnulerPortee,
}: Props) {
  const t = useTranslations("roles");
  const { estDirection } = useDroits();
  const [libelle, setLibelle] = useState(role?.libelle ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [portee, setPortee] = useState<PorteeRole>(() => role?.portee ?? "PROJET");
  const [unique, setUnique] = useState(() => role?.unique_par_projet ?? false);
  const [codes, setCodes] = useState<string[]>(() => (role ? codesDuRole(role) : []));
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  if (!role) return null;

  const autoriseChangerPortee = peutChangerPortee(role, { estDirection });
  // La saisie se fige pendant l'enregistrement et pendant la confirmation de portée.
  const fige = enCours || confirmationPortee !== null;
  const codesHors = codesHorsCatalogue(codesDuRole(role), catalogue);
  const permsHorsPerimetre = role.modules
    .flatMap((m) => m.permissions)
    .filter((p) => codesHors.includes(p.code.toLowerCase()));

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

    const payload: ModificationRolePayload = {
      libelle: libelleNettoye,
      description: description.trim(),
    };

    if (gestes.matriceModifiable) {
      payload.permissions = codes;
    }

    if (portee !== role.portee) {
      payload.portee = portee;
    }

    if (unique !== role.unique_par_projet) {
      payload.unique_par_projet = unique;
    }

    await onEnregistrer(role.id, payload);
  }

  const titre = !gestes.modifiable
    ? t("titreConsultation", { role: role.libelle })
    : t("titreModification", { role: role.libelle });

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg font-medium text-neutral-900">{titre}</SheetTitle>
          <SheetDescription>
            {gestes.modifiable ? t("sousTitreModification") : t("sousTitreConsultation")}
          </SheetDescription>
        </SheetHeader>

        <div className={`flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 ${ASCENSEUR_FIN}`}>
          {/* Avertissements du rôle */}
          {role.avertissements.map((av) => {
            const cleAv = `avertissements.${av}`;
            const texte = t.has(cleAv)
              ? t(cleAv)
              : t("avertissements.inconnu", { code: av });
            return (
              <Alerte key={av} type="avertissement">
                {texte}
              </Alerte>
            );
          })}

          {/* Raison de lecture seule le cas échéant */}
          {gestes.raison && (
            <Alerte type="information">
              {t(`lectureSeule.${gestes.raison}`)}
            </Alerte>
          )}

          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="role-modif-libelle" className="font-normal">
                {t("champIntitule")} {gestes.modifiable && <Requis />}
              </Label>
              <Input
                id="role-modif-libelle"
                type="text"
                value={libelle}
                placeholder={t("placeholderIntitule")}
                onChange={(e) => setLibelle(e.target.value)}
                disabled={!gestes.modifiable || fige}
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
              disabled={!gestes.modifiable || fige}
              className={INDICATIF_LEGER}
            />
          </div>

          {autoriseChangerPortee ? (
            <div className="flex flex-col gap-2">
              <Label className="font-normal">{t("champPortee")}</Label>
              <RadioGroup
                value={portee}
                onValueChange={(val) => setPortee(val as PorteeRole)}
                disabled={fige}
                className="gap-2"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="PROJET" id="modif-role-portee-projet" className="mt-0.5" />
                  <div className="flex flex-col">
                    <Label htmlFor="modif-role-portee-projet" className="font-medium cursor-pointer">
                      {t("portee.PROJET")}
                    </Label>
                    <span className="text-xs text-neutral-500">{t("portee.aide.PROJET")}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="ENTREPRISE" id="modif-role-portee-entreprise" className="mt-0.5" />
                  <div className="flex flex-col">
                    <Label htmlFor="modif-role-portee-entreprise" className="font-medium cursor-pointer">
                      {t("portee.ENTREPRISE")}
                    </Label>
                    <span className="text-xs text-neutral-500">{t("portee.aide.ENTREPRISE")}</span>
                  </div>
                </div>
              </RadioGroup>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Label className="font-normal">{t("champPortee")}</Label>
              <div className="flex flex-col gap-0.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                <span className="text-sm font-medium text-neutral-900">{t(`portee.${role.portee}`)}</span>
                <span className="text-xs text-neutral-500">{t(`portee.aide.${role.portee}`)}</span>
              </div>
            </div>
          )}

          {portee === "PROJET" && (
            <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-800">
              <Checkbox
                checked={unique}
                onCheckedChange={(valeur) => setUnique(valeur === true)}
                disabled={!gestes.modifiable || fige}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{t("uniqueParProjet")}</span>
                <span className="text-xs text-neutral-500">{t("uniqueParProjetAide")}</span>
              </span>
            </label>
          )}

          <div className="flex flex-col gap-2">
            <Label className="font-normal">{t("matriceDroitsTitre")}</Label>
            <EditeurPermissions
              catalogue={catalogue}
              codes={codes}
              onChange={gestes.matriceModifiable && !fige ? setCodes : undefined}
              disabled={!gestes.matriceModifiable || fige}
            />
          </div>

          {/* Permissions hors périmètre de l'utilisateur le cas échéant */}
          {permsHorsPerimetre.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-4 bg-neutral-50">
              <h4 className="m-0 text-sm font-semibold text-neutral-800">{t("horsPerimetreTitre")}</h4>
              <ul className="m-0 flex flex-col gap-1 p-0 list-none">
                {permsHorsPerimetre.map((p) => (
                  <li key={p.id || p.code} className="text-xs text-neutral-600 flex items-center gap-1.5">
                    <span className="font-medium text-neutral-800">{p.libelle}</span>
                    <span className="font-mono text-neutral-400">{p.code}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {confirmationPortee ? (
          <SheetFooter className="flex-col gap-3 border-t border-neutral-200 px-6 py-4">
            <p className="m-0 text-sm font-semibold text-neutral-900">
              {t("confirmationPortee.titre", { role: libelle.trim() || role.libelle })}
            </p>
            <p className="m-0 text-sm text-neutral-700">
              {t("confirmationPortee.personnes", { n: confirmationPortee.personnes })}
            </p>
            {confirmationPortee.versEntreprise ? (
              <Alerte type="avertissement">{t("confirmationPortee.avertissementEntreprise")}</Alerte>
            ) : (
              <Alerte type="information">{t("confirmationPortee.infoProjet")}</Alerte>
            )}
            <div className="flex flex-row justify-end gap-3">
              <Bouton variante="secondaire" onClick={onAnnulerPortee} disabled={enCours}>
                {t("annuler")}
              </Bouton>
              <Bouton
                variante={confirmationPortee.versEntreprise ? "danger" : "primaire"}
                onClick={onConfirmerPortee}
                enCours={enCours}
              >
                {t("confirmationPortee.bouton")}
              </Bouton>
            </div>
          </SheetFooter>
        ) : (
          <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
            <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
              {t("annuler")}
            </Bouton>
            {gestes.modifiable && (
              <Bouton variante="primaire" onClick={valider} enCours={enCours}>
                {t("enregistrer")}
              </Bouton>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

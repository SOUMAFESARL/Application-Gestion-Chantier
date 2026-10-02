"use client";

import { Download, LoaderCircle, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SheetFooter } from "@/components/ui/sheet";
import { ZoneDepotFichiers } from "@/components/ui/zone-depot-fichiers";
import { importerLots, lireFichierLots } from "@/features/projets/adaptateur";
import {
  creationDepuisLigneImport,
  defautsManquants,
  EXTENSION_IMPORT_LOTS,
  ligneRetenueParDefaut,
  MODES_EXECUTION_LOT,
  NOMBRE_MAX_LOTS_IMPORT,
  refusFichierLots,
  TAILLE_MAX_IMPORT_LOTS,
  TYPES_BORDEREAU,
} from "@/features/projets/regles";
import type {
  CreationLotProjet,
  LigneImportLot,
  Lot,
  ModeExecutionLot,
  TypeBordereau,
} from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";
import { formaterDate, formaterMontant, formaterTailleFichier } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Le modèle à remplir, servi tel quel depuis `public/`. */
const MODELE_IMPORT = "/modeles/modele-import-lots.xlsx";

const CHAMP = "h-[var(--input-height-md)]";

interface Props {
  projetId: string;
  lots: Lot[];
  onFermer: () => void;
  onImportes: (lots: Lot[]) => void;
  onOccupe: (occupe: boolean) => void;
}

/**
 * L'import de lots depuis un fichier Excel déjà constitué.
 *
 * Trois temps, sur un seul panneau : on dépose le fichier ; on relit ce qui
 * en a été compris — une ligne par lot, cochée ou non, avec ce qui pose
 * question ; on complète ce que le fichier ne dit pas (mode d'exécution,
 * bordereau), puis on importe. La lecture et l'interprétation sont dans
 * `regles.ts` (`lireLotsImportes`) : l'écran ne fait que montrer.
 */
export function ImportLots({ projetId, lots, onFermer, onImportes, onOccupe }: Props) {
  const t = useTranslations("projets.lotsActivites.importLots");
  const tCreation = useTranslations("projets.tiroirCreation");

  const [fichiers, setFichiers] = useState<File[]>([]);
  const [lignes, setLignes] = useState<LigneImportLot[] | null>(null);
  const [retenues, setRetenues] = useState<Set<number>>(new Set());
  const [modeDefaut, setModeDefaut] = useState<ModeExecutionLot | null>(null);
  const [bordereauDefaut, setBordereauDefaut] = useState<TypeBordereau | null>(null);
  const [lecture, setLecture] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [tentative, setTentative] = useState(false);

  const choisies = useMemo(
    () => (lignes ?? []).filter((ligne) => retenues.has(ligne.ligne)),
    [lignes, retenues],
  );
  const defauts = { modeExecution: modeDefaut, typeBordereau: bordereauDefaut };
  const manquants = defautsManquants(choisies, defauts);
  const toutCoche = lignes !== null && lignes.length > 0 && choisies.length === lignes.length;

  function motifRefus(fichier: File): string | null {
    switch (refusFichierLots(fichier)) {
      case "FORMAT":
        return t("refusFormat");
      case "TAILLE":
        return t("refusTaille", { taille: formaterTailleFichier(TAILLE_MAX_IMPORT_LOTS) });
      default:
        return null;
    }
  }

  async function choisirFichier(nouveaux: File[]) {
    setFichiers(nouveaux);
    setLignes(null);
    setTentative(false);
    const fichier = nouveaux[0];
    if (!fichier) return;

    setLecture(true);
    try {
      const lues = await lireFichierLots(fichier, lots);
      if (lues.length === 0) {
        toast.error(t("aucunLotTrouve"));
        setFichiers([]);
        return;
      }
      setLignes(lues);
      setRetenues(new Set(lues.filter(ligneRetenueParDefaut).map((ligne) => ligne.ligne)));
      if (lues.length >= NOMBRE_MAX_LOTS_IMPORT) {
        toast.warning(t("maximumAtteint", { max: NOMBRE_MAX_LOTS_IMPORT }));
      }
    } catch {
      toast.error(t("erreurLecture"));
      setFichiers([]);
    } finally {
      setLecture(false);
    }
  }

  function basculer(ligne: number, coche: boolean) {
    setRetenues((avant) => {
      const apres = new Set(avant);
      if (coche) apres.add(ligne);
      else apres.delete(ligne);
      return apres;
    });
  }

  function basculerTout(coche: boolean) {
    setRetenues(coche ? new Set((lignes ?? []).map((ligne) => ligne.ligne)) : new Set());
  }

  async function importer() {
    setTentative(true);
    const creations = choisies.map((ligne) => creationDepuisLigneImport(ligne, defauts));
    if (creations.length === 0 || creations.some((creation) => creation === null)) return;

    setEnvoi(true);
    onOccupe(true);
    try {
      const crees = await importerLots(projetId, creations as CreationLotProjet[]);
      onImportes(crees);
      toast.success(t("succes", { nombre: crees.length }));
      onFermer();
    } catch (err) {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurGenerique"));
    } finally {
      setEnvoi(false);
      onOccupe(false);
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
        <div className="flex flex-col gap-2">
          <ZoneDepotFichiers
            fichiers={fichiers}
            onChange={(nouveaux) => void choisirFichier(nouveaux)}
            accept={`${EXTENSION_IMPORT_LOTS},application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`}
            refuser={motifRefus}
            consigne={t("consigne", { taille: formaterTailleFichier(TAILLE_MAX_IMPORT_LOTS) })}
            disabled={lecture || envoi}
            aria-label={t("champFichier")}
          />
          <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500">
            {t("aideModele")}
            <a
              href={MODELE_IMPORT}
              download
              className="inline-flex items-center gap-1 font-medium text-primary-600 underline-offset-2 hover:underline"
            >
              <Download className="size-3.5" aria-hidden="true" />
              {t("telechargerModele")}
            </a>
          </p>
        </div>

        {lecture && (
          <p className="m-0 flex items-center gap-2 text-sm text-neutral-600" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {t("lectureEnCours")}
          </p>
        )}

        {lignes && (
          <>
            <section className="flex flex-col gap-3">
              <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("defautsTitre")}</h3>
              <p className="m-0 text-xs text-neutral-500">{t("defautsAide")}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-[640px]:grid-cols-1">
                <ChoixDefaut
                  libelle={tCreation("colonneModeExecution")}
                  valeur={modeDefaut}
                  onChange={(valeur) => setModeDefaut(valeur as ModeExecutionLot)}
                  options={MODES_EXECUTION_LOT.map((mode) => ({
                    valeur: mode,
                    libelle: tCreation(`modeExecution.${mode}`),
                  }))}
                  placeholder={tCreation("selectionner")}
                  erreur={tentative && manquants.modeExecution ? t("erreurModeRequis") : null}
                  disabled={envoi}
                />
                <ChoixDefaut
                  libelle={tCreation("colonneTypeBordereau")}
                  valeur={bordereauDefaut}
                  onChange={(valeur) => setBordereauDefaut(valeur as TypeBordereau)}
                  options={TYPES_BORDEREAU.map((type) => ({
                    valeur: type,
                    libelle: tCreation(`typeBordereau.${type}`),
                  }))}
                  placeholder={tCreation("selectionner")}
                  erreur={tentative && manquants.typeBordereau ? t("erreurBordereauRequis") : null}
                  disabled={envoi}
                />
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 text-sm font-semibold text-neutral-900">
                  {t("apercuTitre", { retenus: choisies.length, total: lignes.length })}
                </h3>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
                  <Checkbox
                    checked={toutCoche}
                    onCheckedChange={(coche) => basculerTout(coche === true)}
                    disabled={envoi}
                  />
                  {t("toutSelectionner")}
                </label>
              </div>
              {tentative && choisies.length === 0 && (
                <p className="m-0 text-xs font-medium text-erreur" role="alert">
                  {t("erreurAucunRetenu")}
                </p>
              )}
              <ul className="m-0 flex list-none flex-col rounded-lg border border-solid border-neutral-200 p-0">
                {lignes.map((ligne) => (
                  <LigneApercu
                    key={ligne.ligne}
                    ligne={ligne}
                    cochee={retenues.has(ligne.ligne)}
                    onBasculer={(coche) => basculer(ligne.ligne, coche)}
                    modeDefaut={modeDefaut}
                    bordereauDefaut={bordereauDefaut}
                    disabled={envoi}
                  />
                ))}
              </ul>
            </section>
          </>
        )}
      </div>

      <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
        <Button type="button" variant="outline" onClick={onFermer} disabled={envoi}>
          {t("annuler")}
        </Button>
        <Button
          type="button"
          onClick={() => void importer()}
          disabled={!lignes || lecture || envoi}
          aria-busy={envoi}
        >
          {envoi && <LoaderCircle className="animate-spin" />}
          {t("importer", { nombre: choisies.length })}
        </Button>
      </SheetFooter>
    </>
  );
}

/** Un choix par défaut : un `Select` libellé, avec son message d'erreur. */
function ChoixDefaut({
  libelle,
  valeur,
  onChange,
  options,
  placeholder,
  erreur,
  disabled,
}: {
  libelle: string;
  valeur: string | null;
  onChange: (valeur: string) => void;
  options: { valeur: string; libelle: string }[];
  placeholder: string;
  erreur: string | null;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-neutral-900">{libelle}</span>
      <Select value={valeur ?? ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          className={cn(CHAMP, "w-full bg-card")}
          aria-label={libelle}
          aria-invalid={erreur !== null}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.valeur} value={option.valeur}>
              {option.libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {erreur && <p className="m-0 text-xs font-medium text-erreur">{erreur}</p>}
    </div>
  );
}

/** Une ligne du fichier : le nom, ce qui en a été lu, et ce qui pose question. */
function LigneApercu({
  ligne,
  cochee,
  onBasculer,
  modeDefaut,
  bordereauDefaut,
  disabled,
}: {
  ligne: LigneImportLot;
  cochee: boolean;
  onBasculer: (coche: boolean) => void;
  modeDefaut: ModeExecutionLot | null;
  bordereauDefaut: TypeBordereau | null;
  disabled: boolean;
}) {
  const t = useTranslations("projets.lotsActivites.importLots");
  const tCreation = useTranslations("projets.tiroirCreation");
  const id = `import-lot-${ligne.ligne}`;

  const mode = ligne.modeExecution ?? modeDefaut;
  const bordereau = ligne.typeBordereau ?? bordereauDefaut;
  const details = [
    t("numeroLigne", { numero: ligne.ligne }),
    mode ? tCreation(`modeExecution.${mode}`) : t("modeAChoisir"),
    bordereau ? tCreation(`typeBordereau.${bordereau}`) : t("bordereauAChoisir"),
    ligne.budget !== null ? formaterMontant(ligne.budget) : null,
    ligne.dateDebut || ligne.dateFin
      ? t("periode", { debut: formaterDate(ligne.dateDebut), fin: formaterDate(ligne.dateFin) })
      : null,
  ].filter((detail): detail is string => detail !== null);

  return (
    <li
      className={cn(
        "flex items-start gap-3 border-0 border-b border-solid border-neutral-100 px-3 py-2.5 last:border-b-0",
        !cochee && "bg-neutral-50",
      )}
    >
      <Checkbox
        id={id}
        checked={cochee}
        onCheckedChange={(coche) => onBasculer(coche === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className={cn("text-sm font-medium", cochee ? "text-neutral-900" : "text-neutral-500")}>
          {ligne.nom}
        </span>
        <span className="flex flex-wrap gap-x-1.5 text-xs text-neutral-500">
          {details.map((detail) => (
            <span key={detail} className="not-first:before:mr-1.5 not-first:before:content-['·']">
              {detail}
            </span>
          ))}
        </span>
        {ligne.anomalies.map((anomalie) => (
          <span key={anomalie} className="flex items-center gap-1 text-xs text-avertissement">
            <TriangleAlert className="size-3 shrink-0" aria-hidden="true" />
            {t(`anomalies.${anomalie}`)}
          </span>
        ))}
      </label>
    </li>
  );
}

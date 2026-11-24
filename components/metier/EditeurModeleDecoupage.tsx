"use client";

import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileUp,
  Layers,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Alerte, Bouton, Champ } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  basculerDefautTypeSelection,
  basculerTypeProjetSelection,
  cleListeEditeur,
  MAX_NIVEAUX,
  nettoyerLignesModele,
  normaliserLignesModele,
  normaliserTypesEtDefauts,
  SANS_LISTE,
  trouverListeEditeur,
  validerFormulaireModele,
  type DonneesFormulaireModele,
  type LibellesEditeurModele,
  type ListeOptionEditeur,
  type NiveauEditeur,
  type ResultatImportModeleEditeur,
  type TypeProjetOptionEditeur,
} from "@/features/decoupage/editeurModele";

export interface PropsEditeurModeleDecoupage {
  /** Titre principal affiché dans l'en-tête de l'éditeur. */
  titre: string;
  /** Texte d'aide sous le titre de l'en-tête. */
  sousTitre?: string;
  /** Badges affichés à côté du titre (origine, version, statut actif/inactif, usage…). */
  badges?: ReactNode;
  /** Boutons d'action à droite de l'en-tête (Personnaliser, Dupliquer, Activer/Désactiver, Supprimer…). */
  actionsEnTete?: ReactNode;
  /** Bandeaux d'information ou d'avertissement affichés sous l'en-tête (original modifié/supprimé, lecture seule…). */
  slotAlertes?: ReactNode;
  /** Message d'erreur serveur ou de validation affiché en bannière d'erreur. */
  erreur?: string | null;
  /** Valeurs initiales du formulaire (à la montée du composant ; changer `key` pour réinitialiser). */
  valeursInitiales: DonneesFormulaireModele;
  /** Listes de valeurs disponibles pour associer un niveau et alimenter les cellules Combobox. */
  listes: readonly ListeOptionEditeur[];
  /** Types de projet disponibles à cocher (associés et par défaut). */
  typesProjet: readonly TypeProjetOptionEditeur[];
  /** Affiche la case `estActif` (spécifique au Super Admin). */
  afficherEstActif?: boolean;
  /** Autorise la modification des champs et affiche les boutons d'édition/enregistrement. */
  peutEcrire: boolean;
  /** État de chargement de la sauvegarde principale. */
  enregistrementEnCours?: boolean;
  /** Callback d'enregistrement recevant les données normalisées et nettoyées. */
  onEnregistrer: (donnees: DonneesFormulaireModele) => void | Promise<void>;
  /** Affiche le bouton Annuler en pied de formulaire (ex. en mode création). */
  peutAnnuler?: boolean;
  /** Callback du bouton Annuler en pied de formulaire. */
  onAnnuler?: () => void;
  /** Callback de téléchargement du modèle Excel d'exemple dans la barre d'outils des lignes. */
  onTelechargerExemple?: () => void;
  /** État de chargement du téléchargement du modèle Excel. */
  telechargementEnCours?: boolean;
  /** Callback d'import d'un fichier Excel (.xlsx) ou CSV. S'il renvoie `{ niveaux, lignes }`, l'éditeur met à jour sa grille. */
  onImporterFichier?: (
    fichier: File,
  ) => Promise<ResultatImportModeleEditeur | void> | ResultatImportModeleEditeur | void;
  /** État de chargement de l'import Excel/CSV. */
  importEnCours?: boolean;
  /** Tous les libellés traduits injectés par le parent (aucune chaîne en dur ni `useTranslations` interne). */
  libelles: LibellesEditeurModele;
}

/**
 * Éditeur présentationnel partagé d'un modèle de découpage de projet (Entreprise & Super Admin).
 *
 * Ce composant ne dépend ni d'un client HTTP ni d'un espace de traduction `next-intl` : tous les
 * textes sont passés via `libelles` et toutes les mutations passent par callbacks.
 */
export function EditeurModeleDecoupage({
  titre,
  sousTitre,
  badges,
  actionsEnTete,
  slotAlertes,
  erreur,
  valeursInitiales,
  listes,
  typesProjet,
  afficherEstActif = false,
  peutEcrire,
  enregistrementEnCours = false,
  onEnregistrer,
  peutAnnuler = false,
  onAnnuler,
  onTelechargerExemple,
  telechargementEnCours = false,
  onImporterFichier,
  importEnCours = false,
  libelles,
}: PropsEditeurModeleDecoupage) {
  const champFichierRef = useRef<HTMLInputElement | null>(null);

  const [nom, setNom] = useState(() => valeursInitiales.nom);
  const [description, setDescription] = useState(() => valeursInitiales.description);
  const [estActif, setEstActif] = useState(() => valeursInitiales.estActif);
  const [typesChoisis, setTypesChoisis] = useState<string[]>(() =>
    normaliserTypesEtDefauts(valeursInitiales.typesProjet, valeursInitiales.parDefautPour)
      .typesProjet,
  );
  const [parDefautPour, setParDefautPour] = useState<string[]>(() =>
    normaliserTypesEtDefauts(valeursInitiales.typesProjet, valeursInitiales.parDefautPour)
      .parDefautPour,
  );
  const [niveaux, setNiveaux] = useState<NiveauEditeur[]>(() =>
    valeursInitiales.niveaux.slice(0, MAX_NIVEAUX),
  );
  const [lignes, setLignes] = useState<string[][]>(() =>
    normaliserLignesModele(valeursInitiales.lignes, valeursInitiales.niveaux.length),
  );
  const [erreurValidation, setErreurValidation] = useState<string | null>(null);

  const desactive = !peutEcrire || enregistrementEnCours;

  function basculerTypeProjet(code: string, coche: boolean) {
    const normalises = basculerTypeProjetSelection(typesChoisis, parDefautPour, code, coche);
    setTypesChoisis(normalises.typesProjet);
    setParDefautPour(normalises.parDefautPour);
  }

  function basculerDefautType(code: string, coche: boolean) {
    const normalises = basculerDefautTypeSelection(typesChoisis, parDefautPour, code, coche);
    setTypesChoisis(normalises.typesProjet);
    setParDefautPour(normalises.parDefautPour);
  }

  function modifierNiveau(index: number, partiel: Partial<NiveauEditeur>) {
    setNiveaux((courant) =>
      courant.map((niv, i) => {
        if (i === index) return { ...niv, ...partiel };
        if (partiel.alerter) return { ...niv, alerter: false };
        return niv;
      }),
    );
  }

  function ajouterColonneNiveau() {
    if (niveaux.length >= MAX_NIVEAUX) return;
    setNiveaux((courant) => [...courant, { libelle: "", liste: null, alerter: false }]);
    setLignes((courant) => courant.map((ligne) => [...ligne, ""]));
  }

  function retirerColonneNiveau(index: number) {
    if (niveaux.length <= 1) return;
    setNiveaux((courant) => courant.filter((_, i) => i !== index));
    setLignes((courant) => courant.map((ligne) => ligne.filter((_, i) => i !== index)));
  }

  function deplacerColonneNiveau(index: number, direction: -1 | 1) {
    const cible = index + direction;
    if (cible < 0 || cible >= niveaux.length) return;
    setNiveaux((courant) => {
      const copie = [...courant];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
    setLignes((courant) =>
      courant.map((ligne) => {
        const copie = [...ligne];
        [copie[index], copie[cible]] = [copie[cible], copie[index]];
        return copie;
      }),
    );
  }

  function modifierCelluleLigne(indexLigne: number, indexCol: number, valeur: string) {
    setLignes((courant) =>
      courant.map((ligne, r) =>
        r === indexLigne ? ligne.map((cellule, col) => (col === indexCol ? valeur : cellule)) : ligne,
      ),
    );
  }

  function ajouterLigneVide() {
    setLignes((courant) => [...courant, Array.from({ length: niveaux.length }, () => "")]);
  }

  function retirerLigneIndex(indexLigne: number) {
    setLignes((courant) => {
      const reste = courant.filter((_, r) => r !== indexLigne);
      return reste.length > 0 ? reste : [Array.from({ length: niveaux.length }, () => "")];
    });
  }

  async function gererImportFichier(fichier: File) {
    if (!onImporterFichier) return;
    try {
      const resultat = await onImporterFichier(fichier);
      if (resultat && Array.isArray(resultat.lignes)) {
        const prochainsNiveaux =
          resultat.niveaux.length > 0 ? resultat.niveaux.slice(0, MAX_NIVEAUX) : niveaux;
        setNiveaux(prochainsNiveaux);
        setLignes(normaliserLignesModele(resultat.lignes, prochainsNiveaux.length));
        setErreurValidation(null);
      }
    } catch {
      // L'erreur est déjà prise en charge par la mutation du composant parent.
    }
  }

  function soumettre() {
    if (desactive) return;
    const normalises = normaliserTypesEtDefauts(typesChoisis, parDefautPour);
    const candidat: DonneesFormulaireModele = {
      nom: nom.trim(),
      description: description.trim(),
      estActif,
      typesProjet: normalises.typesProjet,
      parDefautPour: normalises.parDefautPour,
      niveaux: niveaux.map((niv) => ({
        libelle: niv.libelle.trim(),
        liste: niv.liste,
        alerter: niv.alerter,
      })),
      lignes: nettoyerLignesModele(lignes, niveaux.length),
    };
    const resultat = validerFormulaireModele(candidat, libelles.messagesValidation);
    if (!resultat.valide) {
      if (libelles.messagesValidation) {
        setErreurValidation(resultat.erreur);
        return;
      }
      setErreurValidation(null);
      void onEnregistrer(candidat);
      return;
    }
    setErreurValidation(null);
    void onEnregistrer(resultat.donnees);
  }

  const erreurAffichee = erreur ?? erreurValidation;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="size-4 text-primary-700" aria-hidden="true" />
            <h3 className="text-base font-semibold text-neutral-900">{titre}</h3>
            {badges}
          </div>
          {sousTitre && <p className="mt-1 text-xs text-neutral-600">{sousTitre}</p>}
        </div>

        {actionsEnTete && <div className="flex flex-wrap items-center gap-2">{actionsEnTete}</div>}
      </div>

      {slotAlertes}
      {erreurAffichee && <Alerte type="erreur">{erreurAffichee}</Alerte>}

      {/* Identité du modèle */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ
          libelle={libelles.champNom}
          placeholder={libelles.placeholderNom}
          value={nom}
          maxLength={150}
          disabled={desactive}
          onChange={(e) => setNom(e.target.value)}
        />
        <Champ
          libelle={libelles.champDescription}
          placeholder={libelles.placeholderDescription}
          value={description}
          maxLength={300}
          disabled={desactive}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {afficherEstActif && libelles.champEstActif && (
        <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-2 text-xs font-medium text-neutral-800">
          <Checkbox
            checked={estActif}
            disabled={desactive}
            onCheckedChange={(v) => setEstActif(v === true)}
          />
          <span>{libelles.champEstActif}</span>
        </label>
      )}

      {/* Types de projet associés et par défaut */}
      {typesProjet.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-3">
          <span className="text-xs font-semibold text-neutral-800">
            {libelles.typesProjetTitre}
          </span>
          <p className="text-xs text-neutral-500">{libelles.typesProjetAide}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {typesProjet.map((tp) => {
              const associe = typesChoisis.includes(tp.code);
              const defaut = parDefautPour.includes(tp.code);
              return (
                <div
                  key={tp.code}
                  className="flex items-center justify-between gap-2 rounded-md border border-neutral-100 px-2.5 py-1.5 text-xs"
                >
                  <label className="flex items-center gap-2 font-medium text-neutral-800">
                    <Checkbox
                      checked={associe}
                      disabled={desactive}
                      onCheckedChange={(v) => basculerTypeProjet(tp.code, v === true)}
                    />
                    <span className="truncate">{tp.libelle}</span>
                  </label>
                  {associe && (
                    <label className="flex items-center gap-1.5 text-neutral-600">
                      <Checkbox
                        checked={defaut}
                        disabled={desactive}
                        onCheckedChange={(v) => basculerDefautType(tp.code, v === true)}
                      />
                      <span>{libelles.parDefautCourt}</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Niveaux du modèle (1..MAX_NIVEAUX) */}
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-neutral-900">{libelles.niveauxTitre}</h4>
            <p className="text-xs text-neutral-500">{libelles.niveauxAide}</p>
          </div>
          {peutEcrire && (
            <Bouton
              variante="secondaire"
              taille="sm"
              iconeGauche={<Plus size={15} />}
              disabled={niveaux.length >= MAX_NIVEAUX || enregistrementEnCours}
              onClick={ajouterColonneNiveau}
            >
              {libelles.ajouterNiveau}
            </Bouton>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {niveaux.map((niv, index) => {
            const valeurSelect = niv.liste ? cleListeEditeur(niv.liste) : SANS_LISTE;
            const listeActuelleAbsente =
              niv.liste !== null &&
              !listes.some((l) => cleListeEditeur(l) === cleListeEditeur(niv.liste!));
            return (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-neutral-600">
                    {libelles.niveauRang(index + 1)}
                  </span>
                  {peutEcrire && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0 || enregistrementEnCours}
                        onClick={() => deplacerColonneNiveau(index, -1)}
                        className="rounded border-0 bg-transparent p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30"
                        aria-label={libelles.deplacerGauche}
                      >
                        <ArrowLeft size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={index === niveaux.length - 1 || enregistrementEnCours}
                        onClick={() => deplacerColonneNiveau(index, 1)}
                        className="rounded border-0 bg-transparent p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30"
                        aria-label={libelles.deplacerDroite}
                      >
                        <ArrowRight size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={niveaux.length <= 1 || enregistrementEnCours}
                        onClick={() => retirerColonneNiveau(index)}
                        className="rounded border-0 bg-transparent p-1 text-neutral-500 hover:bg-erreur/10 hover:text-erreur disabled:opacity-30"
                        aria-label={libelles.retirerNiveau}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <Input
                  value={niv.libelle}
                  maxLength={60}
                  placeholder={libelles.placeholderNiveau}
                  disabled={desactive}
                  onChange={(e) => modifierNiveau(index, { libelle: e.target.value })}
                />

                <Select
                  value={valeurSelect}
                  disabled={desactive}
                  onValueChange={(val) => {
                    if (val === SANS_LISTE) {
                      modifierNiveau(index, { liste: null });
                      return;
                    }
                    const trouvee = listes.find((l) => cleListeEditeur(l) === val);
                    if (!trouvee) {
                      modifierNiveau(index, { liste: null });
                      return;
                    }
                    modifierNiveau(index, {
                      liste: trouvee.origine
                        ? {
                            origine: trouvee.origine,
                            id: trouvee.id,
                            libelle: trouvee.libelle,
                          }
                        : {
                            id: trouvee.id,
                            libelle: trouvee.libelle,
                          },
                    });
                  }}
                >
                  <SelectTrigger className="w-full bg-neutral-0 text-xs">
                    <SelectValue placeholder={libelles.sansListe} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SANS_LISTE}>{libelles.sansListe}</SelectItem>
                    {listeActuelleAbsente && niv.liste && (
                      <SelectItem value={cleListeEditeur(niv.liste)}>
                        {niv.liste.libelle}
                      </SelectItem>
                    )}
                    {listes.map((l) => {
                      const cle = cleListeEditeur(l);
                      return (
                        <SelectItem key={cle} value={cle}>
                          {l.libelle}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <label className="flex items-center gap-2 text-xs text-neutral-700">
                  <Checkbox
                    checked={niv.alerter}
                    disabled={desactive}
                    onCheckedChange={(v) => modifierNiveau(index, { alerter: v === true })}
                  />
                  <span>{libelles.alerterNiveau}</span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lignes types du modèle */}
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-neutral-900">
              {libelles.lignesTitre(lignes.length)}
            </h4>
            <p className="text-xs text-neutral-500">{libelles.lignesAide}</p>
          </div>
          {peutEcrire && (
            <div className="flex flex-wrap items-center gap-2">
              {onTelechargerExemple && libelles.telechargerModeleExcel && (
                <Bouton
                  variante="secondaire"
                  taille="sm"
                  iconeGauche={<Download size={15} />}
                  enCours={telechargementEnCours}
                  disabled={telechargementEnCours || enregistrementEnCours}
                  onClick={onTelechargerExemple}
                >
                  {libelles.telechargerModeleExcel}
                </Bouton>
              )}
              {onImporterFichier && (
                <>
                  <input
                    ref={champFichierRef}
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void gererImportFichier(f);
                    }}
                  />
                  <Bouton
                    variante="secondaire"
                    taille="sm"
                    iconeGauche={<FileUp size={15} />}
                    enCours={importEnCours}
                    disabled={importEnCours || enregistrementEnCours}
                    onClick={() => champFichierRef.current?.click()}
                  >
                    {libelles.importerExcel}
                  </Bouton>
                </>
              )}
              <Bouton
                variante="secondaire"
                taille="sm"
                iconeGauche={<Plus size={15} />}
                disabled={enregistrementEnCours}
                onClick={ajouterLigneVide}
              >
                {libelles.ajouterLigne}
              </Bouton>
            </div>
          )}
        </div>

        <div className="max-h-80 overflow-auto rounded-lg border border-neutral-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-neutral-100 text-neutral-700">
              <tr>
                <th className="w-10 px-2 py-2 text-center font-semibold" />
                {niveaux.map((niv, idx) => (
                  <th key={idx} className="min-w-44 px-2 py-2 font-semibold">
                    {niv.libelle || libelles.niveauRang(idx + 1)}
                  </th>
                ))}
                {peutEcrire && <th className="w-10 px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lignes.map((ligne, r) => (
                <tr key={r} className="hover:bg-neutral-50/60">
                  <td className="px-2 py-1.5 text-center text-neutral-500">{r + 1}</td>
                  {niveaux.map((niv, col) => (
                    <td key={col} className="px-1.5 py-1">
                      <CelluleModeleEditeur
                        valeur={ligne[col] ?? ""}
                        niveau={niv}
                        listes={listes}
                        desactive={desactive}
                        libelles={libelles}
                        onChange={(val) => modifierCelluleLigne(r, col, val)}
                      />
                    </td>
                  ))}
                  {peutEcrire && (
                    <td className="px-1.5 py-1 text-center">
                      <button
                        type="button"
                        disabled={enregistrementEnCours}
                        onClick={() => retirerLigneIndex(r)}
                        className="rounded border-0 bg-transparent p-1 text-neutral-400 hover:bg-erreur/10 hover:text-erreur disabled:opacity-30"
                        aria-label={libelles.retirerLigne}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {peutEcrire && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {peutAnnuler && onAnnuler && (
            <Bouton variante="ghost" disabled={enregistrementEnCours} onClick={onAnnuler}>
              {libelles.annuler}
            </Bouton>
          )}
          <Bouton
            iconeGauche={<Save size={16} />}
            enCours={enregistrementEnCours}
            disabled={!nom.trim() || niveaux.length === 0 || enregistrementEnCours}
            onClick={soumettre}
          >
            {libelles.enregistrer}
          </Bouton>
        </div>
      )}
    </>
  );
}

function CelluleModeleEditeur({
  valeur,
  niveau,
  listes,
  desactive,
  libelles,
  onChange,
}: {
  valeur: string;
  niveau: NiveauEditeur;
  listes: readonly ListeOptionEditeur[];
  desactive: boolean;
  libelles: LibellesEditeurModele;
  onChange: (valeur: string) => void;
}) {
  const liste = useMemo(
    () => trouverListeEditeur(listes, niveau.liste),
    [listes, niveau.liste],
  );

  const options = useMemo<OptionCombobox[]>(() => {
    if (!liste) return [];
    const opts: OptionCombobox[] = [];
    if (valeur.trim()) {
      opts.push({ valeur: "", libelle: libelles.viderCellule });
    }
    for (const v of liste.valeurs) {
      opts.push({
        valeur: v.libelle,
        libelle: v.libelle,
        groupe: v.groupe || undefined,
      });
    }
    return opts;
  }, [liste, valeur, libelles.viderCellule]);

  if (liste && !desactive) {
    return (
      <Combobox
        options={options}
        valeur={valeur}
        onChange={onChange}
        placeholder={niveau.libelle || libelles.sansValeur}
        placeholderRecherche={libelles.rechercherValeur}
        aucunResultat={libelles.aucuneValeur}
        libelleSaisieLibre={libelles.utiliserValeurLibre}
        disabled={desactive}
        className="h-8 min-w-40 px-2 text-xs font-normal"
      />
    );
  }

  return (
    <Input
      value={valeur}
      maxLength={200}
      disabled={desactive}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 min-w-40 text-xs"
    />
  );
}

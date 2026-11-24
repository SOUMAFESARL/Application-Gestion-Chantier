"use client";

import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileUp,
  Layers,
  Plus,
  Save,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Alerte, Bouton, Champ } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ajouterEnfantArbre,
  ajouterRacineArbre,
  arbreVersCellules,
  cellulesVersArbre,
  compterNoeudsArbre,
  modifierNoeudArbre,
  retirerNoeudArbre,
  type NoeudArbreSaisie,
} from "@/features/decoupage/arbreSaisie";
import {
  ArbreSaisie,
  type LibellesArbreSaisie,
} from "@/features/decoupage/components/ArbreSaisie";
import {
  basculerDefautTypeSelection,
  basculerTypeProjetSelection,
  cleListeEditeur,
  MAX_NIVEAUX,
  nettoyerLignesModele,
  normaliserTypesEtDefauts,
  SANS_LISTE,
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
  const [racines, setRacines] = useState<NoeudArbreSaisie[]>(() =>
    cellulesVersArbre(valeursInitiales.lignes),
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
  }

  function retirerColonneNiveau(index: number) {
    if (niveaux.length <= 1) return;
    const lignesCourantes = arbreVersCellules(racines, niveaux.length);
    setNiveaux((courant) => courant.filter((_, i) => i !== index));
    setRacines(cellulesVersArbre(lignesCourantes.map((ligne) => ligne.filter((_, i) => i !== index))));
  }

  function deplacerColonneNiveau(index: number, direction: -1 | 1) {
    const cible = index + direction;
    if (cible < 0 || cible >= niveaux.length) return;
    const lignesCourantes = arbreVersCellules(racines, niveaux.length);
    setNiveaux((courant) => {
      const copie = [...courant];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
    setRacines(
      cellulesVersArbre(
        lignesCourantes.map((ligne) => {
          const copie = [...ligne];
          [copie[index], copie[cible]] = [copie[cible], copie[index]];
          return copie;
        }),
      ),
    );
  }

  function ajouterRacine(): string {
    const { racines: suivantes, cleCreee } = ajouterRacineArbre(racines);
    setRacines(suivantes);
    return cleCreee;
  }

  function ajouterEnfant(parentCle: string): string {
    const { racines: suivantes, cleCreee } = ajouterEnfantArbre(racines, parentCle);
    setRacines(suivantes);
    return cleCreee;
  }

  function modifierLibelleNoeud(cle: string, libelle: string) {
    setRacines((courant) => modifierNoeudArbre(courant, cle, (noeud) => ({ ...noeud, libelle })));
  }

  function retirerNoeud(cle: string) {
    setRacines((courant) => retirerNoeudArbre(courant, cle));
  }

  async function gererImportFichier(fichier: File) {
    if (!onImporterFichier) return;
    try {
      const resultat = await onImporterFichier(fichier);
      if (resultat && Array.isArray(resultat.lignes)) {
        const prochainsNiveaux =
          resultat.niveaux.length > 0 ? resultat.niveaux.slice(0, MAX_NIVEAUX) : niveaux;
        setNiveaux(prochainsNiveaux);
        setRacines(cellulesVersArbre(resultat.lignes));
        setErreurValidation(null);
      }
    } catch {
      // L'erreur est déjà prise en charge par la mutation du composant parent.
    }
  }

  const compteursArbre = useMemo(() => compterNoeudsArbre(racines), [racines]);

  const libellesArbre = useMemo<LibellesArbreSaisie>(
    () => ({
      ajouterRacine: (niv) =>
        libelles.ajouterRacine ? libelles.ajouterRacine(niv) : libelles.ajouterLigne,
      ajouterEnfant: (niv) =>
        libelles.ajouterEnfant ? libelles.ajouterEnfant(niv) : libelles.ajouterLigne,
      retirerNoeud: libelles.retirerLigne,
      deplier: libelles.deplier ?? "+",
      replier: libelles.replier ?? "-",
      toutDeplier: libelles.toutDeplier ?? "+",
      toutReplier: libelles.toutReplier ?? "-",
      videTitre: libelles.arbreVideTitre ?? libelles.lignesTitre(0),
      videAide: libelles.arbreVideAide ?? libelles.lignesAide,
      niveauRang: libelles.niveauRang,
      placeholderIntitule: (niv) => niv,
      saisirOuChoisir: libelles.saisirOuChoisir ?? libelles.rechercherValeur,
      listeValeurs: libelles.listeValeurs ?? libelles.rechercherValeur,
      rechercherValeur: libelles.rechercherValeur,
      aucuneValeur: libelles.aucuneValeur,
      resumeFeuilles: (n) =>
        libelles.resumeFeuilles ? libelles.resumeFeuilles(n) : libelles.lignesTitre(n),
    }),
    [libelles],
  );

  function soumettre() {
    if (desactive) return;
    const normalises = normaliserTypesEtDefauts(typesChoisis, parDefautPour);
    const lignesAplaties = nettoyerLignesModele(
      arbreVersCellules(racines, niveaux.length),
      niveaux.length,
    );
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
      lignes: lignesAplaties,
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

      {/* Structure arborescente du modèle */}
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-neutral-900">
              {libelles.lignesTitre(compteursArbre.feuilles)}
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
            </div>
          )}
        </div>

        <ArbreSaisie
          racines={racines}
          niveaux={niveaux}
          listes={listes}
          desactive={desactive}
          onAjouterRacine={ajouterRacine}
          onAjouterEnfant={ajouterEnfant}
          onModifierLibelle={modifierLibelleNoeud}
          onRetirerNoeud={retirerNoeud}
          libelles={libellesArbre}
        />
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

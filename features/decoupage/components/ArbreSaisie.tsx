"use client";

import {
  CheckIcon,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleAlert,
  ListFilter,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import {
  ABSENT,
  centimesEnFrancs,
  formaterDate,
  formaterMontant,
  formaterSaisieMontant,
  saisieEnCentimes,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  collecterClesParents,
  compterNoeudsArbre,
  resumeBranche,
  valeursSaisiesAuNiveau,
  type DonneesFeuilleSaisie,
  type NoeudArbreSaisie,
} from "../arbreSaisie";
import {
  trouverListeEditeur,
  type ListeOptionEditeur,
  type NiveauEditeur,
} from "../editeurModele";
import { UNITES_MESURE, type ConstatTableau, type UniteMesure } from "../types";

const SANS_UNITE = "aucune";

export interface LibellesArbreSaisie {
  ajouterRacine: (niveau: string) => string;
  ajouterEnfant: (niveau: string) => string;
  retirerNoeud: string;
  deplier: string;
  replier: string;
  toutDeplier: string;
  toutReplier: string;
  videTitre: string;
  videAide: string;
  niveauRang: (rang: number) => string;
  placeholderIntitule: (niveau: string) => string;
  saisirOuChoisir: string;
  listeValeurs: string;
  rechercherValeur: string;
  aucuneValeur: string;
  resumeFeuilles: (n: number) => string;
  unite?: string;
  sansUnite?: string;
  libelleUnite?: (unite: UniteMesure) => string;
  quantite?: string;
  montant?: string;
  montantPlaceholder?: string;
  dateDebut?: string;
  dateFin?: string;
  choisirDate?: string;
  periode?: (debut: string, fin: string) => string;
}

export interface PropsArbreSaisie {
  racines: readonly NoeudArbreSaisie[];
  niveaux: readonly NiveauEditeur[];
  listes: readonly ListeOptionEditeur[];
  desactive?: boolean;
  afficherDonneesFeuille?: boolean;
  voitMontants?: boolean;
  constatsParCle?: Map<string, ConstatTableau[]>;
  bloquantesCles?: Set<string>;
  signalerIntitulesVides?: boolean;
  onAjouterRacine: () => string;
  onAjouterEnfant: (parentCle: string) => string;
  onModifierLibelle: (cle: string, libelle: string) => void;
  onModifierFeuille?: (cle: string, modification: Partial<DonneesFeuilleSaisie>) => void;
  onRetirerNoeud: (cle: string) => void;
  libelles: LibellesArbreSaisie;
}

/**
 * Vue arborescente interactive partagée pour la saisie du découpage (Tableau de démarrage
 * d'un projet et Éditeur de modèles Entreprise / Super Admin).
 *
 * Aucune dépendance à `next-intl` ni à l'HTTP : tous les textes passent par `libelles`.
 */
export function ArbreSaisie({
  racines,
  niveaux,
  listes,
  desactive = false,
  afficherDonneesFeuille = false,
  voitMontants = false,
  constatsParCle,
  bloquantesCles,
  signalerIntitulesVides = false,
  onAjouterRacine,
  onAjouterEnfant,
  onModifierLibelle,
  onModifierFeuille,
  onRetirerNoeud,
  libelles,
}: PropsArbreSaisie) {
  const [replie, setReplie] = useState<Record<string, boolean>>({});
  const [cleFocus, setCleFocus] = useState<string | null>(null);

  const clesParents = useMemo(() => collecterClesParents(racines), [racines]);
  const aDesParents = clesParents.length > 0;
  const toutDeplie = aDesParents && clesParents.every((cle) => !replie[cle]);
  const compteurs = useMemo(() => compterNoeudsArbre(racines), [racines]);
  const nomNiveau1 = niveaux[0]?.libelle.trim() || libelles.niveauRang(1);

  function basculerTout() {
    if (toutDeplie) {
      const toutReplie: Record<string, boolean> = {};
      for (const cle of clesParents) toutReplie[cle] = true;
      setReplie(toutReplie);
      return;
    }
    setReplie({});
  }

  function gererAjoutRacine() {
    const cleCreee = onAjouterRacine();
    setCleFocus(cleCreee);
  }

  function gererAjoutEnfant(parentCle: string) {
    setReplie((courant) => ({ ...courant, [parentCle]: false }));
    const cleCreee = onAjouterEnfant(parentCle);
    setCleFocus(cleCreee);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={desactive || niveaux.length === 0}
            onClick={gererAjoutRacine}
          >
            <Plus />
            {libelles.ajouterRacine(nomNiveau1)}
          </Button>
          {aDesParents && (
            <Button type="button" variant="ghost" size="sm" onClick={basculerTout}>
              {toutDeplie ? <ChevronsDownUp /> : <ChevronsUpDown />}
              {toutDeplie ? libelles.toutReplier : libelles.toutDeplier}
            </Button>
          )}
        </div>
        {compteurs.cases > 0 && (
          <span className="text-xs text-neutral-500 tabular-nums">
            {libelles.resumeFeuilles(compteurs.feuilles)}
          </span>
        )}
      </div>

      {racines.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-8 text-center">
          <p className="m-0 text-sm font-medium text-neutral-700">{libelles.videTitre}</p>
          <p className="m-0 max-w-md text-xs text-neutral-500">{libelles.videAide}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1"
            disabled={desactive || niveaux.length === 0}
            onClick={gererAjoutRacine}
          >
            <Plus />
            {libelles.ajouterRacine(nomNiveau1)}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {racines.map((racine, index) => (
            <BrancheNoeud
              key={racine.cle}
              noeud={racine}
              numero={String(index + 1)}
              profondeur={0}
              racines={racines}
              niveaux={niveaux}
              listes={listes}
              replie={replie}
              onBasculerPli={(cle) => setReplie((c) => ({ ...c, [cle]: !c[cle] }))}
              cleFocus={cleFocus}
              onFocusConsomme={() => setCleFocus(null)}
              desactive={desactive}
              afficherDonneesFeuille={afficherDonneesFeuille}
              voitMontants={voitMontants}
              constatsParCle={constatsParCle}
              bloquantesCles={bloquantesCles}
              signalerIntitulesVides={signalerIntitulesVides}
              onAjouterEnfant={gererAjoutEnfant}
              onModifierLibelle={onModifierLibelle}
              onModifierFeuille={onModifierFeuille}
              onRetirerNoeud={onRetirerNoeud}
              libelles={libelles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BrancheNoeud({
  noeud,
  numero,
  profondeur,
  racines,
  niveaux,
  listes,
  replie,
  onBasculerPli,
  cleFocus,
  onFocusConsomme,
  desactive,
  afficherDonneesFeuille,
  voitMontants,
  constatsParCle,
  bloquantesCles,
  signalerIntitulesVides,
  onAjouterEnfant,
  onModifierLibelle,
  onModifierFeuille,
  onRetirerNoeud,
  libelles,
}: {
  noeud: NoeudArbreSaisie;
  numero: string;
  profondeur: number;
  racines: readonly NoeudArbreSaisie[];
  niveaux: readonly NiveauEditeur[];
  listes: readonly ListeOptionEditeur[];
  replie: Record<string, boolean>;
  onBasculerPli: (cle: string) => void;
  cleFocus: string | null;
  onFocusConsomme: () => void;
  desactive: boolean;
  afficherDonneesFeuille: boolean;
  voitMontants: boolean;
  constatsParCle?: Map<string, ConstatTableau[]>;
  bloquantesCles?: Set<string>;
  signalerIntitulesVides: boolean;
  onAjouterEnfant: (parentCle: string) => void;
  onModifierLibelle: (cle: string, libelle: string) => void;
  onModifierFeuille?: (cle: string, modification: Partial<DonneesFeuilleSaisie>) => void;
  onRetirerNoeud: (cle: string) => void;
  libelles: LibellesArbreSaisie;
}) {
  const estParent = noeud.enfants.length > 0;
  const estFeuille = !estParent;
  const estReplie = Boolean(replie[noeud.cle]);
  const niveau = niveaux[profondeur];
  const niveauSuivant = niveaux[profondeur + 1];
  const peutAjouterEnfant = profondeur + 1 < niveaux.length;
  const nomNiveau = niveau?.libelle.trim() || libelles.niveauRang(profondeur + 1);
  const nomNiveauSuivant =
    niveauSuivant?.libelle.trim() || libelles.niveauRang(profondeur + 2);

  const constats = (estFeuille ? constatsParCle?.get(noeud.cle) : undefined) ?? [];
  const estBloquant = estFeuille && Boolean(bloquantesCles?.has(noeud.cle));
  const intituleManquant = signalerIntitulesVides && noeud.libelle.trim() === "";

  const synthese = useMemo(
    () => (estParent && afficherDonneesFeuille ? resumeBranche(noeud) : null),
    [estParent, afficherDonneesFeuille, noeud],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "flex flex-col gap-2.5 rounded-lg border border-solid p-2.5 transition-colors",
          profondeur === 0 ? "bg-neutral-50/70" : "bg-neutral-0",
          estBloquant || intituleManquant
            ? "border-erreur bg-erreur-fond/40"
            : constats.length > 0
              ? "border-avertissement bg-avertissement-fond/40"
              : "border-neutral-200",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {estParent ? (
            <button
              type="button"
              onClick={() => onBasculerPli(noeud.cle)}
              aria-label={estReplie ? libelles.deplier : libelles.replier}
              aria-expanded={!estReplie}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-neutral-500 hover:bg-neutral-200/70"
            >
              {estReplie ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
          ) : (
            <span className="size-7 shrink-0" aria-hidden="true" />
          )}

          <span className="font-mono text-xs font-medium text-neutral-500 tabular-nums">
            {numero}
          </span>

          <Badge variante={estParent ? "primaire" : "neutre"}>{nomNiveau}</Badge>

          <div className="min-w-48 flex-1">
            <ChampIntituleNoeud
              noeud={noeud}
              profondeur={profondeur}
              niveau={niveau}
              nomNiveau={nomNiveau}
              racines={racines}
              listes={listes}
              desactive={desactive}
              autoFocus={cleFocus === noeud.cle}
              onFocusConsomme={onFocusConsomme}
              onChange={(valeur) => onModifierLibelle(noeud.cle, valeur)}
              libelles={libelles}
            />
          </div>

          {synthese && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 tabular-nums">
              <span>{libelles.resumeFeuilles(synthese.feuilles)}</span>
              {voitMontants && synthese.aMontant && (
                <span className="font-medium text-neutral-800">
                  {formaterMontant(synthese.montantTotal)}
                </span>
              )}
              {(synthese.dateDebutMin || synthese.dateFinMax) && libelles.periode && (
                <span>
                  {libelles.periode(
                    formaterDate(synthese.dateDebutMin),
                    formaterDate(synthese.dateFinMax),
                  )}
                </span>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {peutAjouterEnfant && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={desactive}
                onClick={() => onAjouterEnfant(noeud.cle)}
              >
                <Plus />
                {libelles.ajouterEnfant(nomNiveauSuivant)}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={desactive}
              aria-label={libelles.retirerNoeud}
              title={libelles.retirerNoeud}
              className="text-neutral-400 hover:bg-erreur/10 hover:text-erreur"
              onClick={() => onRetirerNoeud(noeud.cle)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        {afficherDonneesFeuille && estFeuille && onModifierFeuille && (
          <ChampsFeuille
            noeud={noeud}
            desactive={desactive}
            voitMontants={voitMontants}
            onModifier={(modif) => onModifierFeuille(noeud.cle, modif)}
            libelles={libelles}
          />
        )}

        {constats.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 pl-9 text-xs">
            {constats.map((constat, idx) => (
              <li
                key={idx}
                className={cn(
                  "flex items-start gap-1.5",
                  estBloquant ? "text-erreur" : "text-avertissement",
                )}
              >
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{constat.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {estParent && !estReplie && (
        <div className="ml-4 flex flex-col gap-1.5 border-l-2 border-neutral-200 pl-3 sm:ml-6 sm:pl-4">
          {noeud.enfants.map((enfant, index) => (
            <BrancheNoeud
              key={enfant.cle}
              noeud={enfant}
              numero={`${numero}.${index + 1}`}
              profondeur={profondeur + 1}
              racines={racines}
              niveaux={niveaux}
              listes={listes}
              replie={replie}
              onBasculerPli={onBasculerPli}
              cleFocus={cleFocus}
              onFocusConsomme={onFocusConsomme}
              desactive={desactive}
              afficherDonneesFeuille={afficherDonneesFeuille}
              voitMontants={voitMontants}
              constatsParCle={constatsParCle}
              bloquantesCles={bloquantesCles}
              signalerIntitulesVides={signalerIntitulesVides}
              onAjouterEnfant={onAjouterEnfant}
              onModifierLibelle={onModifierLibelle}
              onModifierFeuille={onModifierFeuille}
              onRetirerNoeud={onRetirerNoeud}
              libelles={libelles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChampIntituleNoeud({
  noeud,
  profondeur,
  niveau,
  nomNiveau,
  racines,
  listes,
  desactive,
  autoFocus,
  onFocusConsomme,
  onChange,
  libelles,
}: {
  noeud: NoeudArbreSaisie;
  profondeur: number;
  niveau: NiveauEditeur | undefined;
  nomNiveau: string;
  racines: readonly NoeudArbreSaisie[];
  listes: readonly ListeOptionEditeur[];
  desactive: boolean;
  autoFocus: boolean;
  onFocusConsomme: () => void;
  onChange: (valeur: string) => void;
  libelles: LibellesArbreSaisie;
}) {
  const [ouvert, setOuvert] = useState(false);
  const liste = useMemo(
    () => trouverListeEditeur(listes, niveau?.liste),
    [listes, niveau?.liste],
  );
  const dejaSaisies = useMemo(
    () => (liste ? [] : valeursSaisiesAuNiveau(racines, profondeur, noeud.cle)),
    [liste, racines, profondeur, noeud.cle],
  );
  const groupes = useMemo(() => {
    if (!liste) return [];
    const ordre = new Map<string, typeof liste.valeurs[number][]>();
    for (const v of liste.valeurs) {
      const cle = v.groupe || "";
      ordre.set(cle, [...(ordre.get(cle) ?? []), v]);
    }
    return [...ordre.entries()];
  }, [liste]);

  function attacherFocus(element: HTMLInputElement | null) {
    if (autoFocus && element) {
      element.focus();
      onFocusConsomme();
    }
  }

  if (liste && liste.valeurs.length > 0) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          ref={attacherFocus}
          value={noeud.libelle}
          maxLength={200}
          disabled={desactive}
          placeholder={libelles.saisirOuChoisir}
          aria-label={nomNiveau}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 min-w-0 flex-1 bg-neutral-0 text-sm"
        />
        <Popover open={ouvert} onOpenChange={setOuvert} modal>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={desactive}
              className="h-8 shrink-0 px-2.5 text-xs"
            >
              <ListFilter size={14} />
              <span className="max-sm:hidden">{libelles.listeValeurs}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <Command>
              <CommandInput placeholder={libelles.rechercherValeur} />
              <CommandList>
                <CommandEmpty>{libelles.aucuneValeur}</CommandEmpty>
                {groupes.map(([groupe, entrees]) => (
                  <CommandGroup
                    key={groupe}
                    heading={groupe || undefined}
                    className="[&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-primary"
                  >
                    {entrees.map((entree, idx) => {
                      const selectionne =
                        noeud.libelle.trim().toLowerCase() === entree.libelle.toLowerCase();
                      return (
                        <CommandItem
                          key={entree.id ?? `${groupe}-${idx}-${entree.libelle}`}
                          value={entree.libelle}
                          onSelect={() => {
                            onChange(entree.libelle.slice(0, 200));
                            setOuvert(false);
                          }}
                        >
                          <span className="truncate">{entree.libelle}</span>
                          <CheckIcon
                            className={cn("ml-auto", selectionne ? "opacity-100" : "opacity-0")}
                          />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  const idDatalist = dejaSaisies.length > 0 ? `arbre-saisie-${noeud.cle}` : undefined;
  return (
    <>
      <Input
        ref={attacherFocus}
        value={noeud.libelle}
        maxLength={200}
        list={idDatalist}
        disabled={desactive}
        placeholder={libelles.placeholderIntitule(nomNiveau)}
        aria-label={nomNiveau}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 bg-neutral-0 text-sm"
      />
      {idDatalist && (
        <datalist id={idDatalist}>
          {dejaSaisies.map((texte) => (
            <option key={texte} value={texte} />
          ))}
        </datalist>
      )}
    </>
  );
}

function ChampsFeuille({
  noeud,
  desactive,
  voitMontants,
  onModifier,
  libelles,
}: {
  noeud: NoeudArbreSaisie;
  desactive: boolean;
  voitMontants: boolean;
  onModifier: (modification: Partial<DonneesFeuilleSaisie>) => void;
  libelles: LibellesArbreSaisie;
}) {
  const { feuille } = noeud;
  const valeurMontant =
    feuille.montant === null
      ? ""
      : formaterSaisieMontant(String(centimesEnFrancs(feuille.montant)));

  return (
    <div
      className={cn(
        "grid gap-2.5 pl-9 max-md:grid-cols-2 max-sm:grid-cols-1",
        voitMontants ? "md:grid-cols-5" : "md:grid-cols-4",
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">{libelles.unite}</span>
        <Select
          value={feuille.unite ?? SANS_UNITE}
          onValueChange={(v) =>
            onModifier({ unite: v === SANS_UNITE ? null : (v as UniteMesure) })
          }
          disabled={desactive}
        >
          <SelectTrigger className="h-8 w-full bg-neutral-0 text-xs" aria-label={libelles.unite}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SANS_UNITE}>{libelles.sansUnite ?? ABSENT}</SelectItem>
            {UNITES_MESURE.map((u) => (
              <SelectItem key={u} value={u}>
                {libelles.libelleUnite ? libelles.libelleUnite(u) : u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">{libelles.quantite}</span>
        <Input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={feuille.quantite === null ? "" : String(feuille.quantite)}
          aria-label={libelles.quantite}
          disabled={desactive}
          className="h-8 bg-neutral-0 text-right text-xs tabular-nums"
          onChange={(e) => {
            const texte = e.target.value;
            const nombre = texte === "" ? null : Number(texte);
            if (nombre !== null && !Number.isFinite(nombre)) return;
            onModifier({ quantite: nombre });
          }}
        />
      </div>

      {voitMontants && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">{libelles.montant}</span>
          <Input
            type="text"
            inputMode="numeric"
            value={valeurMontant}
            placeholder={libelles.montantPlaceholder}
            aria-label={libelles.montant}
            disabled={desactive}
            className="h-8 bg-neutral-0 text-right text-xs tabular-nums"
            onChange={(e) => {
              const formate = formaterSaisieMontant(e.target.value);
              onModifier({ montant: saisieEnCentimes(formate) });
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">{libelles.dateDebut}</span>
        <SelecteurDate
          valeur={feuille.dateDebut ?? ""}
          onChange={(v) => onModifier({ dateDebut: v || null })}
          auPlusTard={feuille.dateFin || undefined}
          placeholder={libelles.choisirDate ?? ""}
          aria-label={libelles.dateDebut}
          disabled={desactive}
          className="h-8 bg-neutral-0 px-2.5 text-xs"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">{libelles.dateFin}</span>
        <SelecteurDate
          valeur={feuille.dateFin ?? ""}
          onChange={(v) => onModifier({ dateFin: v || null })}
          auPlusTot={feuille.dateDebut || undefined}
          placeholder={libelles.choisirDate ?? ""}
          aria-label={libelles.dateFin}
          disabled={desactive}
          className="h-8 bg-neutral-0 px-2.5 text-xs"
        />
      </div>
    </div>
  );
}

"use client";

import {
  ChevronRight,
  Diamond,
  Filter,
  ListFilter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge, type VarianteBadge } from "@/components/ui";
import { Button } from "@/components/ui/button";
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
  aCriteresRechercheActifs,
  compterFiltresAvancesActifs,
  CRITERES_RECHERCHE_ELEMENTS_VIDES,
  extraireNiveauxDisponibles,
  extraireStatutsDisponibles,
  rechercherElements,
  type CriteresRechercheElements,
  type ElementRecherchable,
  type NatureElementRecherche,
} from "@/features/decoupage/rechercheRapide";
import { formaterDate, formaterMontant } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_RESULTATS_AFFICHES = 40;
const VALEUR_TOUS = "__tous__";

const NATURES_OPTIONS: readonly Exclude<NatureElementRecherche, "">[] = [
  "FEUILLE",
  "PARENT",
  "JALON",
];

function varianteStatut(statut: string, estActif: boolean): VarianteBadge {
  if (!estActif || statut === "DESACTIVE") return "neutre";
  if (statut === "EN_RETARD") return "erreur";
  if (statut === "CLOTURE" || statut === "TERMINE") return "succes";
  if (statut === "SUSPENDU" || statut === "BLOQUE") return "avertissement";
  if (statut === "EN_COURS") return "information";
  return "neutre";
}

export interface PropsRechercheRapideElements {
  elements: readonly ElementRecherchable[];
  criteres: CriteresRechercheElements;
  onCriteresChange: (criteres: CriteresRechercheElements) => void;
  voitMontants: boolean;
  onAccederElement: (element: ElementRecherchable) => void;
  modeFiltreVue?: boolean;
  onModeFiltreVueChange?: (actif: boolean) => void;
  resultatsPrecalcules?: readonly ElementRecherchable[];
  className?: string;
}

/**
 * Barre de recherche rapide multicritères partagée (Découpage & Planning).
 *
 * Raccourcis : `Ctrl+K` / `Cmd+K` pour cibler le champ, `↑`/`↓` + `Entrée` pour
 * localiser un élément dans l'arbre ou le Gantt (scroll + surbrillance seule),
 * `Échap` pour fermer la liste déroulante.
 */
export function RechercheRapideElements({
  elements,
  criteres,
  onCriteresChange,
  voitMontants,
  onAccederElement,
  modeFiltreVue = false,
  onModeFiltreVueChange,
  resultatsPrecalcules,
  className,
}: PropsRechercheRapideElements) {
  const t = useTranslations("rechercheElements");
  const conteneurRef = useRef<HTMLDivElement | null>(null);
  const champRef = useRef<HTMLInputElement | null>(null);
  const listeRef = useRef<HTMLDivElement | null>(null);

  const [dropdownOuvert, setDropdownOuvert] = useState(false);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [indexActif, setIndexActif] = useState(-1);

  const optionsRecherche = useMemo(() => ({ voitMontants }), [voitMontants]);

  const aCriteresActifs = useMemo(
    () => aCriteresRechercheActifs(criteres, optionsRecherche),
    [criteres, optionsRecherche],
  );

  const nbFiltresAvances = useMemo(
    () => compterFiltresAvancesActifs(criteres, optionsRecherche),
    [criteres, optionsRecherche],
  );

  const statutsDisponibles = useMemo(() => extraireStatutsDisponibles(elements), [elements]);
  const niveauxDisponibles = useMemo(() => extraireNiveauxDisponibles(elements), [elements]);

  const resultats = useMemo(
    () =>
      resultatsPrecalcules ??
      (aCriteresActifs ? rechercherElements(elements, criteres, optionsRecherche) : []),
    [aCriteresActifs, criteres, elements, optionsRecherche, resultatsPrecalcules],
  );

  const resultatsAffiches = useMemo(
    () => resultats.slice(0, MAX_RESULTATS_AFFICHES),
    [resultats],
  );

  const afficherDropdown = dropdownOuvert && aCriteresActifs;

  // Raccourci global Ctrl+K / Cmd+K pour focaliser la recherche rapide.
  useEffect(() => {
    function surToucheGlobale(evenement: KeyboardEvent) {
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === "k") {
        evenement.preventDefault();
        champRef.current?.focus();
        champRef.current?.select();
        setDropdownOuvert(true);
      }
    }
    window.addEventListener("keydown", surToucheGlobale);
    return () => window.removeEventListener("keydown", surToucheGlobale);
  }, []);

  // Fermeture du dropdown au clic en dehors du composant.
  useEffect(() => {
    if (!dropdownOuvert) return;
    function surClicExterieur(evenement: MouseEvent) {
      const cible = evenement.target as Node | null;
      if (!cible || conteneurRef.current?.contains(cible)) return;
      setDropdownOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [dropdownOuvert]);

  const mettreAJour = useCallback(
    (partiel: Partial<CriteresRechercheElements>) => {
      onCriteresChange({ ...criteres, ...partiel });
      setIndexActif(-1);
      setDropdownOuvert(true);
    },
    [criteres, onCriteresChange],
  );

  const reinitialiserTout = useCallback(() => {
    onCriteresChange(CRITERES_RECHERCHE_ELEMENTS_VIDES);
    setIndexActif(-1);
    setDropdownOuvert(false);
    onModeFiltreVueChange?.(false);
  }, [onCriteresChange, onModeFiltreVueChange]);

  const reinitialiserFiltresAvances = useCallback(() => {
    onCriteresChange({
      ...CRITERES_RECHERCHE_ELEMENTS_VIDES,
      texte: criteres.texte,
    });
    setIndexActif(-1);
  }, [criteres.texte, onCriteresChange]);

  const selectionnerElement = useCallback(
    (element: ElementRecherchable) => {
      setDropdownOuvert(false);
      setFiltresOuverts(false);
      setIndexActif(-1);
      onAccederElement(element);
    },
    [onAccederElement],
  );

  const surToucheChamp = useCallback(
    (evenement: React.KeyboardEvent<HTMLInputElement>) => {
      if (evenement.key === "Escape") {
        if (dropdownOuvert) {
          evenement.preventDefault();
          setDropdownOuvert(false);
          setIndexActif(-1);
        }
        return;
      }

      if (!afficherDropdown || resultatsAffiches.length === 0) return;

      if (evenement.key === "ArrowDown") {
        evenement.preventDefault();
        setIndexActif((prec) => {
          const suivant = prec + 1 >= resultatsAffiches.length ? 0 : prec + 1;
          listeRef.current
            ?.querySelector<HTMLElement>(`[data-resultat-index="${suivant}"]`)
            ?.scrollIntoView({ block: "nearest" });
          return suivant;
        });
      } else if (evenement.key === "ArrowUp") {
        evenement.preventDefault();
        setIndexActif((prec) => {
          const suivant = prec <= 0 ? resultatsAffiches.length - 1 : prec - 1;
          listeRef.current
            ?.querySelector<HTMLElement>(`[data-resultat-index="${suivant}"]`)
            ?.scrollIntoView({ block: "nearest" });
          return suivant;
        });
      } else if (evenement.key === "Enter") {
        evenement.preventDefault();
        const cible = resultatsAffiches[indexActif >= 0 ? indexActif : 0];
        if (cible) selectionnerElement(cible);
      }
    },
    [afficherDropdown, dropdownOuvert, indexActif, resultatsAffiches, selectionnerElement],
  );

  const libelleStatut = useCallback(
    (statut: string) => (t.has(`statuts.${statut}`) ? t(`statuts.${statut}`) : statut),
    [t],
  );

  return (
    <div ref={conteneurRef} className={cn("relative flex flex-wrap items-center gap-2", className)}>
      {/* Champ de recherche rapide avec raccourci Ctrl+K et dropdown instantané */}
      <div className="relative min-w-60 flex-1 sm:max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
        <Input
          ref={champRef}
          type="text"
          role="combobox"
          aria-expanded={afficherDropdown}
          aria-autocomplete="list"
          aria-label={t("ariaLabel")}
          placeholder={t("placeholder")}
          value={criteres.texte}
          onFocus={() => {
            if (aCriteresActifs) setDropdownOuvert(true);
          }}
          onChange={(evenement) => mettreAJour({ texte: evenement.target.value })}
          onKeyDown={surToucheChamp}
          className={cn(
            "h-[var(--button-height-sm)] bg-neutral-0 pl-9 text-sm",
            aCriteresActifs ? "pr-9" : "pr-16",
          )}
        />

        {!aCriteresActifs ? (
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-solid border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-neutral-500">
            {t("raccourciClavier")}
          </kbd>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={reinitialiserTout}
            aria-label={t("effacer")}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        )}

        {/* Liste déroulante instantanée des résultats */}
        {afficherDropdown && (
          <div className="absolute top-full left-0 z-50 mt-1.5 w-full min-w-80 overflow-hidden rounded-lg border border-solid border-neutral-200 bg-neutral-0 shadow-lg sm:w-[34rem] sm:max-w-[90vw]">
            <div className="flex items-center justify-between gap-2 border-0 border-b border-solid border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              <span className="font-medium tabular-nums">
                {resultats.length > MAX_RESULTATS_AFFICHES
                  ? t("compteurResultats", {
                      affiches: resultatsAffiches.length,
                      total: resultats.length,
                    })
                  : t("compteurTotal", { total: resultats.length })}
              </span>
              <span className="text-[11px] text-neutral-400 max-sm:hidden">
                {t("indiceNavigation")}
              </span>
            </div>

            {resultatsAffiches.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-neutral-500">
                <p className="m-0">{t("aucunResultat")}</p>
                <Button type="button" variant="outline" size="xs" onClick={reinitialiserTout}>
                  <RotateCcw className="size-3" aria-hidden="true" />
                  {t("reinitialiserFiltres")}
                </Button>
              </div>
            ) : (
              <div ref={listeRef} role="listbox" className="max-h-80 overflow-y-auto py-1">
                {resultatsAffiches.map((el, index) => {
                  const actif = index === indexActif;
                  const complet = el.acces === "COMPLET";
                  const codeDistinct = Boolean(
                    el.code.trim() && el.code.trim() !== (el.numero ?? "").trim(),
                  );
                  const aDates = complet && (el.dateDebut || el.dateFin);

                  return (
                    <button
                      key={el.id}
                      type="button"
                      role="option"
                      aria-selected={actif}
                      data-resultat-index={index}
                      onMouseEnter={() => setIndexActif(index)}
                      onClick={() => selectionnerElement(el)}
                      className={cn(
                        "flex w-full cursor-pointer flex-col gap-1 border-0 border-b border-solid border-neutral-100 bg-transparent px-3 py-2 text-left transition-colors last:border-b-0",
                        actif ? "bg-primary-50" : "hover:bg-neutral-50",
                        !el.estActif && "opacity-70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                          {el.estJalon && (
                            <Diamond
                              className="size-3 shrink-0 fill-avertissement text-avertissement"
                              aria-hidden="true"
                            />
                          )}
                          {el.numero && (
                            <span className="shrink-0 font-mono text-xs text-neutral-500 tabular-nums">
                              {el.numero}
                            </span>
                          )}
                          {codeDistinct && <Badge variante="neutre">{el.code}</Badge>}
                          <span
                            className={cn(
                              "truncate text-sm",
                              el.estFeuille
                                ? "font-medium text-neutral-900"
                                : "font-semibold text-neutral-900",
                              !el.estActif && "line-through",
                            )}
                          >
                            {el.libelle}
                          </span>
                          {!el.estActif && (
                            <Badge variante="neutre">{t("desactiveeBadge")}</Badge>
                          )}
                        </div>

                        {complet && el.statut && (
                          <Badge variante={varianteStatut(el.statut, el.estActif)}>
                            {libelleStatut(el.statut)}
                          </Badge>
                        )}
                      </div>

                      {el.filAriane.length > 0 && (
                        <div className="flex items-center gap-1 truncate text-xs text-neutral-500">
                          {el.filAriane.map((parent, idxParent) => (
                            <span
                              key={`${el.id}-parent-${idxParent}`}
                              className="inline-flex items-center gap-1 truncate"
                            >
                              {idxParent > 0 && (
                                <ChevronRight className="size-3 shrink-0 text-neutral-400" aria-hidden="true" />
                              )}
                              <span className="truncate">{parent}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {(el.niveau || aDates || (voitMontants && complet && el.montant !== null)) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-600">
                          {el.niveau && (
                            <span className="text-neutral-500">{el.niveau}</span>
                          )}
                          {aDates && (
                            <span className="tabular-nums">
                              {t("periodeElement", {
                                debut: formaterDate(el.dateDebut),
                                fin: formaterDate(el.dateFin),
                              })}
                            </span>
                          )}
                          {voitMontants && complet && el.montant !== null && (
                            <span className="font-medium text-neutral-800 tabular-nums">
                              {formaterMontant(el.montant)}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bouton Filtres + Panneau Popover multicritères */}
      <Popover
        open={filtresOuverts}
        onOpenChange={(ouvert) => {
          setFiltresOuverts(ouvert);
          if (ouvert) setDropdownOuvert(false);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={nbFiltresAvances > 0 ? "secondary" : "outline"}
            size="sm"
            aria-expanded={filtresOuverts}
            className="gap-1.5"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            <span>{t("boutonFiltres")}</span>
            {nbFiltresAvances > 0 && (
              <span className="rounded-full bg-primary-500 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-neutral-0 tabular-nums">
                {nbFiltresAvances}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-80 p-4 sm:w-96">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-neutral-900">
                {t("panneauFiltresTitre")}
              </span>
              {nbFiltresAvances > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={reinitialiserFiltresAvances}
                  className="text-neutral-600"
                >
                  <RotateCcw className="size-3" aria-hidden="true" />
                  {t("reinitialiserFiltres")}
                </Button>
              )}
            </div>

            {/* Période */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-neutral-700">{t("periodeLabel")}</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative flex items-center gap-1">
                  <SelecteurDate
                    valeur={criteres.dateDebut}
                    onChange={(valeur) => mettreAJour({ dateDebut: valeur })}
                    placeholder={t("dateDebutPlaceholder")}
                    auPlusTard={criteres.dateFin || undefined}
                    className="h-[var(--button-height-sm)] px-2.5 text-xs"
                  />
                  {criteres.dateDebut && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("effacerDate")}
                      onClick={() => mettreAJour({ dateDebut: "" })}
                      className="shrink-0 text-neutral-400 hover:text-neutral-700"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <div className="relative flex items-center gap-1">
                  <SelecteurDate
                    valeur={criteres.dateFin}
                    onChange={(valeur) => mettreAJour({ dateFin: valeur })}
                    placeholder={t("dateFinPlaceholder")}
                    auPlusTot={criteres.dateDebut || undefined}
                    className="h-[var(--button-height-sm)] px-2.5 text-xs"
                  />
                  {criteres.dateFin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("effacerDate")}
                      onClick={() => mettreAJour({ dateFin: "" })}
                      className="shrink-0 text-neutral-400 hover:text-neutral-700"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Montant Min / Max en FCFA (strictement masqué si !voitMontants) */}
            {voitMontants && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-neutral-700">{t("montantLabel")}</span>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={criteres.montantMinFcfa}
                    onChange={(evenement) =>
                      mettreAJour({
                        montantMinFcfa: evenement.target.value.replace(/[^\d\s]/g, ""),
                      })
                    }
                    placeholder={t("montantMinPlaceholder")}
                    aria-label={t("montantMinPlaceholder")}
                    className="h-[var(--button-height-sm)] px-2.5 text-sm"
                  />
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={criteres.montantMaxFcfa}
                    onChange={(evenement) =>
                      mettreAJour({
                        montantMaxFcfa: evenement.target.value.replace(/[^\d\s]/g, ""),
                      })
                    }
                    placeholder={t("montantMaxPlaceholder")}
                    aria-label={t("montantMaxPlaceholder")}
                    className="h-[var(--button-height-sm)] px-2.5 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Statut & Niveau */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-neutral-700">{t("statutLabel")}</span>
                <Select
                  value={criteres.statut || VALEUR_TOUS}
                  onValueChange={(val) =>
                    mettreAJour({ statut: val === VALEUR_TOUS ? "" : val })
                  }
                >
                  <SelectTrigger size="sm" className="w-full" aria-label={t("statutLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VALEUR_TOUS}>{t("statutTous")}</SelectItem>
                    {statutsDisponibles.map((statut) => (
                      <SelectItem key={statut} value={statut}>
                        {libelleStatut(statut)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-neutral-700">{t("niveauLabel")}</span>
                <Select
                  value={criteres.niveau || VALEUR_TOUS}
                  onValueChange={(val) =>
                    mettreAJour({ niveau: val === VALEUR_TOUS ? "" : val })
                  }
                >
                  <SelectTrigger size="sm" className="w-full" aria-label={t("niveauLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VALEUR_TOUS}>{t("niveauTous")}</SelectItem>
                    {niveauxDisponibles.map((niveau) => (
                      <SelectItem key={niveau} value={niveau}>
                        {niveau}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Nature */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-neutral-700">{t("natureLabel")}</span>
              <Select
                value={criteres.nature || VALEUR_TOUS}
                onValueChange={(val) =>
                  mettreAJour({
                    nature: (val === VALEUR_TOUS ? "" : val) as NatureElementRecherche,
                  })
                }
              >
                <SelectTrigger size="sm" className="w-full" aria-label={t("natureLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VALEUR_TOUS}>{t("natureTous")}</SelectItem>
                  {NATURES_OPTIONS.map((nature) => (
                    <SelectItem key={nature} value={nature}>
                      {t(
                        nature === "FEUILLE"
                          ? "natureFeuille"
                          : nature === "PARENT"
                            ? "natureParent"
                            : "natureJalon",
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Bascule optionnelle : Filtrer la vue */}
      {onModeFiltreVueChange && (
        <Button
          type="button"
          variant={modeFiltreVue ? "default" : "outline"}
          size="sm"
          aria-pressed={modeFiltreVue}
          aria-label={t("modeFiltreVueAria")}
          onClick={() => onModeFiltreVueChange(!modeFiltreVue)}
          className="gap-1.5"
        >
          {modeFiltreVue ? (
            <Filter className="size-3.5" aria-hidden="true" />
          ) : (
            <ListFilter className="size-3.5" aria-hidden="true" />
          )}
          <span>{t("modeFiltreVue")}</span>
        </Button>
      )}
    </div>
  );
}

"use client";

import {
  BellRing,
  Camera,
  FileText,
  History,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  escaladeBlocage,
  estDocumentAccepte,
  EXTENSIONS_DOCUMENT,
  LONGUEUR_MIN_DESCRIPTION_INCIDENT,
  PHOTOS_MAX,
  PIECES_JOINTES_MAX,
  TAILLE_MAX_PIECE_JOINTE,
} from "@/features/chantier";
import type {
  ActivitePreparee,
  BlocageOuvert,
  LotJournal,
  NatureEvenement,
  NiveauBlocage,
} from "@/features/chantier";
import { lirePieceJointe, preparerPhoto } from "@/features/chantier/photos";
import {
  blocageVide,
  DECIDEURS,
  GRAVITES,
  incidentVide,
  NATURES_BLOCAGE,
  NATURES_EVENEMENT,
  NIVEAUX_BLOCAGE,
  type ValeursRapport,
} from "@/features/chantier/validations";
import { formaterHeure, formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  BoutonAjout,
  CarteLigne,
  CHAMP,
  ChampPuces,
  ChampTexte,
  PAIRE,
  RANGEE,
  Requis,
  Signal,
  SousRubrique,
  useErreurSection,
} from "./elementsSaisie";

const OCTETS_PAR_MO = 1024 * 1024;
const AUCUN_ELEMENT = "__aucun__";

/** L'état d'une alerte immédiate, tel que l'écran le montre. */
export type EtatAlerte = "ENVOYEE" | "EN_COURS" | "ECHEC";

export function BadgeAlerte({ etat }: { etat: EtatAlerte | undefined }) {
  const t = useTranslations("journal.saisie.alertes");
  if (!etat) return null;
  if (etat === "EN_COURS") {
    return (
      <Badge variante="neutre">
        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
        {t("enCours")}
      </Badge>
    );
  }
  return etat === "ENVOYEE" ? (
    <Badge variante="erreur">
      <BellRing className="size-3" aria-hidden="true" />
      {t("envoyee")}
    </Badge>
  ) : (
    <Badge variante="avertissement">{t("echec")}</Badge>
  );
}

/* ------------------------------------------------------------------ *
 * Les événements du chantier — 6 natures distinctes, sans gravité forcée sur les visites.
 * ------------------------------------------------------------------ */

export function SectionEvenements({ alertes }: { alertes: Record<string, EtatAlerte> }) {
  const t = useTranslations("journal.saisie");
  const tEnum = useTranslations("journal.enumerations");
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "incidents" });
  const valeurs = useWatch({ control, name: "incidents" });

  return (
    <SousRubrique titre={t("sections.evenements")} description={t("incidents.description")}>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-neutral-500">{t("incidents.declarer")}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NATURES_EVENEMENT.map((nature) => (
            <button
              key={nature}
              type="button"
              onClick={() => lignes.append(incidentVide(nature))}
              className="flex min-h-[var(--input-height-md)] cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-card px-3 py-1 text-left text-sm font-medium text-neutral-700 hover:border-primary-400 hover:text-primary-700 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              {t(`incidents.natures.${nature}`)}
            </button>
          ))}
        </div>
      </div>
      {lignes.fields.map((ligne, rang) => {
        const incident = valeurs[rang];
        const longueur = incident?.description.trim().length ?? 0;
        const nature = (incident?.nature || "EVENEMENT_PARTICULIER") as NatureEvenement;
        const estVisite = nature === "VISITE_INSTRUCTION";
        const cleAlerte = incident?.cle ? `incident:${incident.cle}` : "";

        return (
          <CarteLigne
            key={ligne.id}
            titre={t("incidents.titre", { nature: t(`incidents.natures.${nature}`), rang: rang + 1 })}
            complement={cleAlerte ? <BadgeAlerte etat={alertes[cleAlerte]} /> : null}
            libelleSupprimer={t("incidents.supprimer", { rang: rang + 1 })}
            onSupprimer={() => lignes.remove(rang)}
          >
            <div className={PAIRE}>
              <ChampTexte name={`incidents.${rang}.heureDebut`} libelle={t("incidents.heureDebut")} type="time" />
              <ChampTexte name={`incidents.${rang}.heureFin`} libelle={t("incidents.heureFin")} type="time" />
            </div>
            {!estVisite && (
              <ChampPuces
                name={`incidents.${rang}.gravite`}
                libelle={t("incidents.gravite")}
                requis
                colonnes={3}
                options={GRAVITES.map((valeur) => ({
                  valeur,
                  libelle: tEnum(`gravite.${valeur}`),
                  ton: valeur === "MINEUR" ? "information" : valeur === "SIGNIFICATIF" ? "avertissement" : "erreur",
                }))}
              />
            )}
            {!estVisite && incident?.gravite === "GRAVE" && (
              <Signal ton="erreur" icone={<BellRing />}>
                {t("incidents.alerteGrave")}
              </Signal>
            )}
            <ChampTexte
              name={`incidents.${rang}.description`}
              libelle={t("incidents.descriptionChamp")}
              requis
              multiligne
              lignes={3}
              placeholder={t("incidents.descriptionExemple")}
              aide={t("incidents.compteur", { n: longueur, min: LONGUEUR_MIN_DESCRIPTION_INCIDENT })}
            />
            <ChampTexte
              name={`incidents.${rang}.action`}
              libelle={t("incidents.action")}
              requis={!estVisite && Boolean(incident?.gravite && incident.gravite !== "MINEUR")}
              placeholder={t("incidents.actionExemple")}
            />
            <ChampPuces
              name={`incidents.${rang}.decidePar`}
              libelle={t("incidents.decidePar")}
              requis
              options={DECIDEURS.map((valeur) => ({ valeur, libelle: tEnum(`decideur.${valeur}`) }))}
            />
          </CarteLigne>
        );
      })}
      {lignes.fields.length === 0 && <p className="m-0 text-sm text-neutral-500">{t("incidents.aucun")}</p>}
    </SousRubrique>
  );
}

/* ------------------------------------------------------------------ *
 * Les blocages — liste plurielle rattachée à l'arbre et à la table `Blocage`.
 * ------------------------------------------------------------------ */

export function SectionBlocages({
  blocagesOuverts,
  activites,
  lots,
  alertes,
}: {
  blocagesOuverts: BlocageOuvert[];
  activites: ActivitePreparee[];
  lots: LotJournal[];
  alertes: Record<string, EtatAlerte>;
}) {
  const t = useTranslations("journal.saisie");
  const tEnum = useTranslations("journal.enumerations");
  const tRole = useTranslations("journal.circuit.role");
  const { control, setValue } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "blocages" });
  const valeurs = useWatch({ control, name: "blocages" });
  const erreur = useErreurSection("blocages");

  const dejaRepris = new Set(valeurs.map((ligne) => ligne.blocageId).filter(Boolean));
  const ouvertsDisponibles = blocagesOuverts.filter((ouvert) => !dejaRepris.has(ouvert.id));

  const reprendreOuvert = (ouvert: BlocageOuvert) => {
    const niveau: NiveauBlocage =
      ouvert.severite === "BLOQUANT"
        ? "BLOQUANT"
        : ouvert.severite === "MINEUR"
          ? "MINEUR"
          : "SIGNIFICATIF";
    lignes.append({
      ...blocageVide(),
      blocageId: ouvert.id,
      elementId: ouvert.elementId ?? "",
      titre: ouvert.titre,
      niveau,
    });
  };

  return (
    <SousRubrique
      titre={t("sections.blocages")}
      description={t("blocages.descriptionSection")}
      erreur={erreur}
    >
      {ouvertsDisponibles.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-avertissement/30 bg-avertissement-fond p-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-avertissement">
            <History className="size-3.5 shrink-0" aria-hidden="true" />
            {t("blocages.ouvertsTitre")}
          </span>
          <div className="flex flex-wrap gap-2">
            {ouvertsDisponibles.map((ouvert) => (
              <button
                key={ouvert.id}
                type="button"
                onClick={() => reprendreOuvert(ouvert)}
                className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-avertissement/40 bg-card px-3 py-1 text-xs font-medium text-neutral-800 hover:border-avertissement"
              >
                <Plus className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{ouvert.titre}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {lignes.fields.map((ligne, rang) => {
        const courant = valeurs[rang];
        const niveau = (courant?.niveau || "SIGNIFICATIF") as NiveauBlocage;
        const escalade = escaladeBlocage(niveau);
        const longueur = courant?.description.trim().length ?? 0;
        const cleAlerte = courant?.cle ? `blocage:${courant.cle}` : "";

        return (
          <CarteLigne
            key={ligne.id}
            titre={courant?.titre.trim() || t("blocages.titre", { rang: rang + 1 })}
            complement={cleAlerte ? <BadgeAlerte etat={alertes[cleAlerte]} /> : null}
            libelleSupprimer={t("blocages.supprimer", { rang: rang + 1 })}
            onSupprimer={() => lignes.remove(rang)}
          >
            <div className={RANGEE}>
              <ChampTexte
                name={`blocages.${rang}.titre`}
                libelle={t("blocages.titreChamp")}
                placeholder={t("blocages.titreExemple")}
              />
              {(lots.length > 0 || activites.length > 0) && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-neutral-700">
                    {t("blocages.elementImpacte")}
                  </span>
                  <Select
                    value={courant?.elementId || AUCUN_ELEMENT}
                    onValueChange={(choisi) =>
                      setValue(
                        `blocages.${rang}.elementId`,
                        choisi === AUCUN_ELEMENT ? "" : choisi,
                        { shouldDirty: true },
                      )
                    }
                  >
                    <SelectTrigger className={cn(CHAMP, "w-full bg-card")}>
                      <SelectValue placeholder={t("blocages.chantierEntier")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUCUN_ELEMENT}>{t("blocages.chantierEntier")}</SelectItem>
                      {lots.map((lot) => (
                        <SelectItem key={lot.id} value={lot.id}>
                          {t("lotValeur", { code: lot.code, nom: lot.nom })}
                        </SelectItem>
                      ))}
                      {activites.map((act) => (
                        <SelectItem key={act.activiteId} value={act.activiteId}>
                          {t("avancement.activiteValeur", {
                            code: act.code,
                            libelle: act.cheminLibelle || act.libelle,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <ChampPuces
              name={`blocages.${rang}.niveau`}
              libelle={t("blocages.niveau")}
              requis
              colonnes={3}
              options={NIVEAUX_BLOCAGE.map((valeur) => ({
                valeur,
                libelle: tEnum(`niveauBlocage.${valeur}`),
                detail: t(`blocages.details.${valeur}`),
                ton:
                  valeur === "MINEUR"
                    ? "information"
                    : valeur === "SIGNIFICATIF"
                      ? "avertissement"
                      : "erreur",
              }))}
            />

            <ChampPuces
              name={`blocages.${rang}.nature`}
              libelle={t("blocages.nature")}
              requis
              options={NATURES_BLOCAGE.map((valeur) => ({
                valeur,
                libelle: tEnum(`natureBlocage.${valeur}`),
              }))}
            />

            <ChampTexte
              name={`blocages.${rang}.description`}
              libelle={t("blocages.description")}
              requis
              multiligne
              lignes={2}
              aide={t("incidents.compteur", { n: longueur, min: LONGUEUR_MIN_DESCRIPTION_INCIDENT })}
            />

            <ChampTexte
              name={`blocages.${rang}.impact`}
              libelle={t("blocages.impact")}
              requis
              placeholder={t("blocages.impactExemple")}
            />

            {escalade && (
              <Signal ton={niveau === "BLOQUANT" ? "erreur" : "avertissement"} icone={<BellRing />}>
                {niveau === "BLOQUANT"
                  ? t("blocages.alerteBloquant")
                  : t("blocages.escalade", { role: tRole(escalade) })}
              </Signal>
            )}
          </CarteLigne>
        );
      })}

      <BoutonAjout onClick={() => lignes.append(blocageVide())}>
        {t("blocages.ajouter")}
      </BoutonAjout>
    </SousRubrique>
  );
}

/* ------------------------------------------------------------------ *
 * Les photos — jusqu'à 10 par rapport, légende requise et lien optionnel à l'arbre.
 * ------------------------------------------------------------------ */

export function SectionPhotos({
  activites,
  lots,
}: {
  activites: ActivitePreparee[];
  lots: LotJournal[];
}) {
  const t = useTranslations("journal.saisie");
  const { control, setValue } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "photos", keyName: "idChamp" });
  const photos = useWatch({ control, name: "photos" });
  const erreur = useErreurSection("photos");
  const appareil = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);
  const [traitement, setTraitement] = useState(0);
  const restantes = PHOTOS_MAX - photos.length - traitement;

  const ajouter = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return;
    const retenus = Array.from(fichiers).slice(0, Math.max(0, restantes));
    if (retenus.length < fichiers.length) toast.error(t("photos.limite", { max: PHOTOS_MAX }));
    setTraitement((n) => n + retenus.length);
    for (const fichier of retenus) {
      try {
        lignes.append(await preparerPhoto(fichier));
      } catch {
        toast.error(t("photos.illisible", { nom: fichier.name }));
      } finally {
        setTraitement((n) => n - 1);
      }
    }
  };

  return (
    <SousRubrique
      titre={t("sections.photos")}
      complement={<Badge variante="neutre">{t("fraction", { a: photos.length, b: PHOTOS_MAX })}</Badge>}
      erreur={erreur}
    >
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          className="h-auto min-h-14 flex-col gap-1 py-2"
          onClick={() => appareil.current?.click()}
          disabled={restantes <= 0}
        >
          <Camera className="size-5" aria-hidden="true" />
          {t("photos.prendre")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-14 flex-col gap-1 py-2"
          onClick={() => galerie.current?.click()}
          disabled={restantes <= 0}
        >
          <ImagePlus className="size-5" aria-hidden="true" />
          {t("photos.choisir")}
        </Button>
      </div>
      <input
        ref={appareil}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(evenement) => {
          void ajouter(evenement.target.files);
          evenement.target.value = "";
        }}
      />
      <input
        ref={galerie}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(evenement) => {
          void ajouter(evenement.target.files);
          evenement.target.value = "";
        }}
      />

      {(photos.length > 0 || traitement > 0) && (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {lignes.fields.map((ligne, rang) => {
            const photo = photos[rang];
            if (!photo) return null;
            return (
              <li key={ligne.idChamp} className="overflow-hidden rounded-lg border border-neutral-200 bg-card">
                <div className="relative aspect-[4/3] bg-neutral-100">
                  {photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt={photo.legende || t("photos.alt", { rang: rang + 1 })}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-neutral-400">
                      <Camera className="size-6" aria-hidden="true" />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-1 right-1 bg-card/90"
                    aria-label={t("photos.supprimer", { rang: rang + 1 })}
                    onClick={() => lignes.remove(rang)}
                  >
                    <Trash2 className="text-erreur" aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex flex-col gap-2 p-2.5">
                  <span className="flex items-center gap-1 text-xs text-neutral-500 tabular-nums">
                    {formaterHeure(photo.priseLe)}
                    {photo.latitude !== null ? (
                      <span className="inline-flex items-center gap-0.5 font-medium text-succes">
                        <MapPin className="size-3" aria-hidden="true" />
                        {t("photos.gps")}
                      </span>
                    ) : (
                      <span className="text-avertissement">{t("photos.sansGps")}</span>
                    )}
                    <Requis />
                  </span>
                  <FormField
                    control={control}
                    name={`photos.${rang}.legende`}
                    render={({ field }) => (
                      <FormItem className="gap-1">
                        <FormControl>
                          <Input
                            {...field}
                            aria-label={t("photos.legende", { rang: rang + 1 })}
                            placeholder={t("photos.legendeExemple")}
                            className="h-9 text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {(lots.length > 0 || activites.length > 0) && (
                    <Select
                      value={photo.elementId || AUCUN_ELEMENT}
                      onValueChange={(choisi) =>
                        setValue(
                          `photos.${rang}.elementId`,
                          choisi === AUCUN_ELEMENT ? null : choisi,
                          { shouldDirty: true },
                        )
                      }
                    >
                      <SelectTrigger
                        className="h-8 w-full bg-card text-xs"
                        aria-label={t("photos.elementRattache")}
                      >
                        <SelectValue placeholder={t("photos.sansElement")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AUCUN_ELEMENT}>{t("photos.sansElement")}</SelectItem>
                        {lots.map((lot) => (
                          <SelectItem key={lot.id} value={lot.id}>
                            {t("lotValeur", { code: lot.code, nom: lot.nom })}
                          </SelectItem>
                        ))}
                        {activites.map((act) => (
                          <SelectItem key={act.activiteId} value={act.activiteId}>
                            {t("avancement.activiteValeur", {
                              code: act.code,
                              libelle: act.cheminLibelle || act.libelle,
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </li>
            );
          })}
          {Array.from({ length: traitement }, (_, rang) => (
            <li
              key={`traitement-${rang}`}
              className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-neutral-300 text-neutral-500"
            >
              <LoaderCircle className="size-5 animate-spin" aria-label={t("photos.traitement")} />
            </li>
          ))}
        </ul>
      )}
    </SousRubrique>
  );
}

/* ------------------------------------------------------------------ *
 * Les documents joints — jusqu'à 5 Mo par fichier.
 * ------------------------------------------------------------------ */

export function SectionPiecesJointes() {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "piecesJointes", keyName: "idChamp" });
  const pieces = useWatch({ control, name: "piecesJointes" });
  const erreur = useErreurSection("piecesJointes");
  const selecteur = useRef<HTMLInputElement>(null);
  const [traitement, setTraitement] = useState(0);
  const restantes = PIECES_JOINTES_MAX - pieces.length - traitement;
  const tailleMo = TAILLE_MAX_PIECE_JOINTE / OCTETS_PAR_MO;

  const ajouter = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return;
    const retenus = Array.from(fichiers).slice(0, Math.max(0, restantes));
    if (retenus.length < fichiers.length) toast.error(t("piecesJointes.limite", { max: PIECES_JOINTES_MAX }));
    for (const fichier of retenus) {
      if (!estDocumentAccepte(fichier.name)) {
        toast.error(t("piecesJointes.nonDocument", { nom: fichier.name }));
        continue;
      }
      if (fichier.size > TAILLE_MAX_PIECE_JOINTE) {
        toast.error(t("piecesJointes.tropLourd", { nom: fichier.name, taille: tailleMo }));
        continue;
      }
      setTraitement((n) => n + 1);
      try {
        lignes.append(await lirePieceJointe(fichier));
      } catch {
        toast.error(t("piecesJointes.illisible", { nom: fichier.name }));
      } finally {
        setTraitement((n) => n - 1);
      }
    }
  };

  return (
    <SousRubrique
      titre={t("sections.piecesJointes")}
      complement={<Badge variante="neutre">{t("fraction", { a: pieces.length, b: PIECES_JOINTES_MAX })}</Badge>}
      description={t("piecesJointes.description")}
      erreur={erreur}
    >
      {(pieces.length > 0 || traitement > 0) && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {lignes.fields.map((ligne, rang) => {
            const piece = pieces[rang];
            if (!piece) return null;
            return (
              <li key={ligne.idChamp} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-card p-2">
                <FileText className="size-5 shrink-0 text-neutral-500" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">{piece.nom}</span>
                  <span className="block text-xs text-neutral-500 tabular-nums">
                    {t("piecesJointes.taille", { valeur: formaterQuantite(Math.ceil(piece.taille / 1024)) })}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-erreur hover:bg-erreur-fond hover:text-erreur"
                  aria-label={t("piecesJointes.supprimer", { nom: piece.nom })}
                  onClick={() => lignes.remove(rang)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
          {traitement > 0 && (
            <li className="flex items-center justify-center rounded-lg border border-dashed border-neutral-300 p-3 text-neutral-500">
              <LoaderCircle className="size-5 animate-spin" aria-label={t("piecesJointes.traitement")} />
            </li>
          )}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed text-primary-700"
        onClick={() => selecteur.current?.click()}
        disabled={restantes <= 0}
      >
        <Paperclip aria-hidden="true" />
        {t("piecesJointes.ajouter")}
      </Button>
      <input
        ref={selecteur}
        type="file"
        accept={EXTENSIONS_DOCUMENT.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(evenement) => {
          void ajouter(evenement.target.files);
          evenement.target.value = "";
        }}
      />
    </SousRubrique>
  );
}

"use client";

import { BellRing, Camera, FileText, ImagePlus, LoaderCircle, MapPin, Paperclip, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  escaladeBlocage,
  estDocumentAccepte,
  EXTENSIONS_DOCUMENT,
  LONGUEUR_MIN_DESCRIPTION_INCIDENT,
  PHOTOS_MAX,
  PIECES_JOINTES_MAX,
  TAILLE_MAX_PIECE_JOINTE,
} from "@/features/chantier";
import type { NatureEvenement, NiveauBlocageSaisi } from "@/features/chantier";
import { lirePieceJointe, preparerPhoto } from "@/features/chantier/photos";
import {
  DECIDEURS,
  GRAVITES,
  incidentVide,
  NATURES_BLOCAGE,
  NATURES_EVENEMENT,
  NIVEAUX_BLOCAGE,
  TYPES_INCIDENT,
  type ValeursRapport,
} from "@/features/chantier/validations";
import { formaterHeure, formaterQuantite } from "@/lib/format";

import {
  CarteLigne,
  ChampPuces,
  ChampTexte,
  PAIRE,
  RANGEE,
  Signal,
  SousRubrique,
  useErreurSection,
} from "./elementsSaisie";

const OCTETS_PAR_MO = 1024 * 1024;

/** L'état d'une alerte immédiate, tel que l'écran le montre. */
export type EtatAlerte = "ENVOYEE" | "EN_COURS" | "ECHEC";

function BadgeAlerte({ etat }: { etat: EtatAlerte | undefined }) {
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
 * Les événements du chantier — déclarés d'un geste, par nature.
 * ------------------------------------------------------------------ */

export function SectionEvenements({ alertes }: { alertes: Record<string, EtatAlerte> }) {
  const t = useTranslations("journal.saisie");
  const tEnum = useTranslations("journal.enumerations");
  const tRole = useTranslations("journal.circuit.role");
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "incidents" });
  const valeurs = useWatch({ control, name: "incidents" });

  return (
    <SousRubrique titre={t("sections.evenements")} description={t("incidents.description")}>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-neutral-500">{t("incidents.declarer")}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
        const nature = (incident?.nature || "INCIDENT") as NatureEvenement;
        return (
          <CarteLigne
            key={ligne.id}
            titre={t("incidents.titre", { nature: t(`incidents.natures.${nature}`), rang: rang + 1 })}
            complement={incident ? <BadgeAlerte etat={alertes[incident.cle]} /> : null}
            libelleSupprimer={t("incidents.supprimer", { rang: rang + 1 })}
            onSupprimer={() => lignes.remove(rang)}
          >
            {nature === "INCIDENT" && (
              <ChampPuces
                name={`incidents.${rang}.type`}
                libelle={t("incidents.type")}
                requis
                options={TYPES_INCIDENT.map((valeur) => ({ valeur, libelle: tEnum(`typeIncident.${valeur}`) }))}
              />
            )}
            <div className={PAIRE}>
              <ChampTexte name={`incidents.${rang}.heureDebut`} libelle={t("incidents.heureDebut")} type="time" />
              <ChampTexte name={`incidents.${rang}.heureFin`} libelle={t("incidents.heureFin")} type="time" />
            </div>
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
            {incident?.gravite === "GRAVE" && (
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
            <div className={RANGEE}>
              <ChampTexte
                name={`incidents.${rang}.action`}
                libelle={t("incidents.action")}
                requis={incident?.gravite !== "MINEUR"}
                placeholder={t("incidents.actionExemple")}
              />
              <ChampPuces
                name={`incidents.${rang}.decidePar`}
                libelle={t("incidents.decidePar")}
                colonnes={3}
                options={DECIDEURS.map((valeur) => ({ valeur, libelle: tRole(valeur) }))}
              />
            </div>
          </CarteLigne>
        );
      })}
      {lignes.fields.length === 0 && <p className="m-0 text-sm text-neutral-500">{t("incidents.aucun")}</p>}
    </SousRubrique>
  );
}

/* ------------------------------------------------------------------ *
 * Le blocage — un choix unique, « aucun » compris.
 * ------------------------------------------------------------------ */

export function SectionBlocage({ alerte }: { alerte: EtatAlerte | undefined }) {
  const t = useTranslations("journal.saisie");
  const tEnum = useTranslations("journal.enumerations");
  const tRole = useTranslations("journal.circuit.role");
  const { control } = useFormContext<ValeursRapport>();
  const niveau = useWatch({ control, name: "blocage.niveau" });
  const escalade = escaladeBlocage(niveau as NiveauBlocageSaisi);

  return (
    <SousRubrique titre={t("sections.blocage")} complement={<BadgeAlerte etat={alerte} />}>
      <ChampPuces
        name="blocage.niveau"
        libelle={t("blocage.niveau")}
        masquerLibelle
        colonnes={4}
        options={NIVEAUX_BLOCAGE.map((valeur) => ({
          valeur,
          libelle: t(`blocage.niveaux.${valeur}`),
          detail: t(`blocage.details.${valeur}`),
          ton: valeur === "AUCUN" ? "succes" : valeur === "MINEUR" ? "information" : valeur === "SIGNIFICATIF" ? "avertissement" : "erreur",
        }))}
      />
      {niveau !== "AUCUN" && (
        <>
          <ChampPuces
            name="blocage.nature"
            libelle={t("blocage.nature")}
            requis
            options={NATURES_BLOCAGE.map((valeur) => ({ valeur, libelle: tEnum(`natureBlocage.${valeur}`) }))}
          />
          <ChampTexte name="blocage.description" libelle={t("blocage.description")} requis multiligne lignes={2} />
          <ChampTexte name="blocage.impact" libelle={t("blocage.impact")} placeholder={t("blocage.impactExemple")} />
          {escalade && (
            <Signal ton={niveau === "BLOQUANT" ? "erreur" : "avertissement"} icone={<BellRing />}>
              {niveau === "BLOQUANT" ? t("blocage.alerteBloquant") : t("blocage.escalade", { role: tRole(escalade) })}
            </Signal>
          )}
        </>
      )}
    </SousRubrique>
  );
}

/* ------------------------------------------------------------------ *
 * Les photos — appareil photo du téléphone, ou galerie.
 * ------------------------------------------------------------------ */

export function SectionPhotos() {
  const t = useTranslations("journal.saisie");
  const { control, register } = useFormContext<ValeursRapport>();
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
      description={t("photos.description")}
      erreur={erreur}
    >
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="h-auto min-h-14 flex-col gap-1 py-2" onClick={() => appareil.current?.click()} disabled={restantes <= 0}>
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
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
          {lignes.fields.map((ligne, rang) => {
            const photo = photos[rang];
            if (!photo) return null;
            return (
              <li key={ligne.idChamp} className="overflow-hidden rounded-lg border border-neutral-200 bg-card">
                <div className="relative aspect-[4/3] bg-neutral-100">
                  {photo.url ? (
                    // Une image `data:` locale : `next/image` n'a rien à optimiser.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt={photo.legende || t("photos.alt", { rang: rang + 1 })} className="size-full object-cover" />
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
                <div className="flex flex-col gap-1.5 p-2">
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
                  </span>
                  <Input
                    aria-label={t("photos.legende", { rang: rang + 1 })}
                    placeholder={t("photos.legendeExemple")}
                    className="h-9 text-sm"
                    {...register(`photos.${rang}.legende`)}
                  />
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
 * Les documents joints — pas de vidéo.
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

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { Badge } from "@/components/ui";
import type { VarianteBadge } from "@/components/ui/Badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { paysEntreprise } from "@/features/configuration/api";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

import { appliquerImport, telechargerModeleImport, verifierFichierImport, verifierLignesImport } from "../adaptateur";
import { CLE_REGISTRE } from "../cles";
import {
  compterLignesImport,
  corrigerLigneImport,
  EXTENSIONS_IMPORT,
  lignesRestantes,
  NOM_MODELE_IMPORT,
  type ChampLigneImport,
} from "../regles";
import type { BilanImport, LigneImport, PartenaireImport, StatutLigneImport } from "../types";

const INTERNE = "interne";
/** Le délai, après la dernière frappe, avant de redemander la vérification au serveur. */
const DELAI_VERIFICATION_MS = 600;

const VARIANTE_STATUT: Record<StatutLigneImport, VarianteBadge> = {
  VALIDE: "succes",
  DOUBLON: "avertissement",
  ERREUR: "erreur",
  CREEE: "succes",
};

function messageErreur(erreur: unknown, repli: string): string {
  if (erreur instanceof ErreurApi) {
    const champs = Object.values(erreur.erreursParChamp);
    if (champs.length > 0) return champs.join(" ");
    if (erreur.message) return erreur.message;
  }
  return repli;
}

/**
 * Importer plusieurs personnes dans le registre depuis un fichier Excel ou CSV (décision du
 * 31/10/2026).
 *
 * Trois temps : choisir le fichier (ou télécharger le modèle), corriger l'aperçu — toutes les
 * cellules se modifient, l'entreprise se choisit parmi les tiers partenaires —, enregistrer. Le
 * serveur ne crée que les lignes valides ; doublons et erreurs restent à l'écran avec leur raison.
 */
export function FenetreImportPersonnes({ onFermer }: { onFermer: () => void }) {
  const t = useTranslations("mainOeuvre.import");
  const client = useQueryClient();
  const fichier = useRef<HTMLInputElement>(null);
  const [lignes, setLignes] = useState<LigneImport[] | null>(null);
  const [partenaires, setPartenaires] = useState<PartenaireImport[]>([]);
  const [bilan, setBilan] = useState<BilanImport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pays, setPays] = useState("");
  // Chaque correction incrémente la version ; une vérification qui revient pour une version
  // dépassée est ignorée — l'utilisateur a retapé entre-temps.
  const [version, setVersion] = useState(0);
  const versionCourante = useRef(0);
  const [verificationEnCours, setVerificationEnCours] = useState(false);

  useEffect(() => {
    let vivant = true;
    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const lecture = useMutation({
    mutationFn: (choisi: File) => verifierFichierImport(choisi),
    onSuccess: (lu) => {
      setErreur(null);
      setBilan(null);
      setPartenaires(lu.partenaires);
      setLignes(lu.lignes);
      // Un nouveau fichier périme toute vérification encore en vol sur l'ancien.
      versionCourante.current += 1;
    },
    onError: (e) => setErreur(messageErreur(e, t("erreurLecture"))),
  });

  const modele = useMutation({
    mutationFn: telechargerModeleImport,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = NOM_MODELE_IMPORT;
      lien.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => toast.error(messageErreur(e, t("erreurModele"))),
  });

  const enregistrement = useMutation({
    mutationFn: (aEnregistrer: LigneImport[]) => appliquerImport(aEnregistrer),
    onSuccess: async (resultat) => {
      setBilan(resultat);
      setLignes(lignesRestantes(resultat.lignes));
      versionCourante.current += 1;
      if (resultat.creees > 0) toast.success(t("enregistrees", { nombre: resultat.creees }));
      await client.invalidateQueries({ queryKey: CLE_REGISTRE });
    },
    onError: (e) => setErreur(messageErreur(e, t("erreurEnregistrement"))),
  });

  // La vérification suit les corrections, une fois la frappe arrêtée.
  useEffect(() => {
    if (version === 0 || !lignes || lignes.length === 0) return;
    const minuterie = setTimeout(() => {
      const demandee = version;
      setVerificationEnCours(true);
      verifierLignesImport(lignes)
        .then((verifie) => {
          if (demandee !== versionCourante.current) return;
          setPartenaires(verifie.partenaires);
          // Seuls les verdicts sont repris : la saisie en cours n'est pas réécrite.
          setLignes((courantes) =>
            courantes
              ? courantes.map((ligne, index) => {
                  const verdict = verifie.lignes[index];
                  return verdict
                    ? { ...ligne, statut: verdict.statut, erreurs: verdict.erreurs, message: verdict.message }
                    : ligne;
                })
              : courantes,
          );
        })
        .catch((e) => setErreur(messageErreur(e, t("erreurVerification"))))
        .finally(() => setVerificationEnCours(false));
    }, DELAI_VERIFICATION_MS);
    return () => clearTimeout(minuterie);
    // `lignes` change à chaque verdict reçu : seule la version (une correction) relance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  function nouvelleVersion() {
    versionCourante.current += 1;
    setVersion(versionCourante.current);
  }

  function corriger(index: number, champ: ChampLigneImport, valeur: string | null) {
    setLignes((courantes) =>
      courantes ? courantes.map((ligne, i) => (i === index ? corrigerLigneImport(ligne, champ, valeur) : ligne)) : courantes,
    );
    nouvelleVersion();
  }

  function abandonner(index: number) {
    setLignes((courantes) => (courantes ? courantes.filter((_, i) => i !== index) : courantes));
    nouvelleVersion();
  }

  const comptes = useMemo(() => compterLignesImport(lignes ?? []), [lignes]);
  const occupe = lecture.isPending || enregistrement.isPending;
  const peutEnregistrer = comptes.VALIDE > 0 && !occupe && !verificationEnCours;

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !occupe && onFermer()}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t("titre")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fichier}
            type="file"
            accept={EXTENSIONS_IMPORT}
            className="hidden"
            onChange={(evenement) => {
              const choisi = evenement.target.files?.[0];
              evenement.target.value = "";
              if (choisi) lecture.mutate(choisi);
            }}
          />
          <Button size="sm" onClick={() => fichier.current?.click()} disabled={occupe}>
            {lecture.isPending ? <LoaderCircle className="animate-spin" /> : <FileUp />}
            {lignes ? t("autreFichier") : t("choisirFichier")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => modele.mutate()} disabled={modele.isPending}>
            {modele.isPending ? <LoaderCircle className="animate-spin" /> : <Download />}
            {t("telechargerModele")}
          </Button>
          <span className="text-sm text-neutral-500">{t("consigne")}</span>
        </div>

        {erreur && (
          <Alert variant="erreur">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}

        {bilan && (
          <Alert variant={bilan.erreurs > 0 || bilan.doublons > 0 ? "avertissement" : "succes"}>
            <AlertDescription>
              {t("bilan", { creees: bilan.creees, doublons: bilan.doublons, erreurs: bilan.erreurs })}
            </AlertDescription>
          </Alert>
        )}

        {lignes && lignes.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variante="succes">{t("comptes.VALIDE", { nombre: comptes.VALIDE })}</Badge>
              <Badge variante="avertissement">{t("comptes.DOUBLON", { nombre: comptes.DOUBLON })}</Badge>
              <Badge variante="erreur">{t("comptes.ERREUR", { nombre: comptes.ERREUR })}</Badge>
              {verificationEnCours && (
                <span className="flex items-center gap-1 text-neutral-500">
                  <LoaderCircle className="size-4 animate-spin" />
                  {t("verification")}
                </span>
              )}
            </div>
            <div className="max-h-[55vh] overflow-auto rounded-md border border-neutral-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colonnes.ligne")}</TableHead>
                    <TableHead>{t("colonnes.nom")}</TableHead>
                    <TableHead>{t("colonnes.prenom")}</TableHead>
                    <TableHead>{t("colonnes.telephone")}</TableHead>
                    <TableHead>{t("colonnes.metier")}</TableHead>
                    <TableHead>{t("colonnes.entreprise")}</TableHead>
                    <TableHead>{t("colonnes.statut")}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t("colonnes.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map((ligne, index) => (
                    <LigneApercu
                      key={`${ligne.numero ?? "x"}-${index}`}
                      ligne={ligne}
                      partenaires={partenaires}
                      pays={pays}
                      desactive={occupe}
                      onCorriger={(champ, valeur) => corriger(index, champ, valeur)}
                      onAbandonner={() => abandonner(index)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {lignes && lignes.length === 0 && bilan && <p className="text-sm text-neutral-600">{t("toutEnregistre")}</p>}

        <DialogFooter className="gap-3">
          <Button type="button" variant="outline" onClick={onFermer} disabled={occupe}>
            {bilan && (lignes?.length ?? 0) === 0 ? t("fermer") : t("annuler")}
          </Button>
          {lignes && lignes.length > 0 && (
            <Button type="button" onClick={() => enregistrement.mutate(lignes)} disabled={!peutEnregistrer}>
              {enregistrement.isPending && <LoaderCircle className="animate-spin" />}
              {t("enregistrer", { nombre: comptes.VALIDE })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LigneApercu({
  ligne,
  partenaires,
  pays,
  desactive,
  onCorriger,
  onAbandonner,
}: {
  ligne: LigneImport;
  partenaires: PartenaireImport[];
  pays: string;
  desactive: boolean;
  onCorriger: (champ: ChampLigneImport, valeur: string | null) => void;
  onAbandonner: () => void;
}) {
  const t = useTranslations("mainOeuvre.import");
  const { erreurs } = ligne;
  const entrepriseInconnue = !ligne.entreprisePartenaireId && Boolean(ligne.entrepriseSaisie);
  const valeurEntreprise = ligne.entreprisePartenaireId ?? (entrepriseInconnue ? "" : INTERNE);
  const raison = Object.values(erreurs).join(" ") || ligne.message;

  return (
    <TableRow className={cn(ligne.statut === "ERREUR" && "bg-erreur-fond", ligne.statut === "DOUBLON" && "bg-avertissement-fond")}>
      <TableCell className="text-neutral-500">{ligne.numero ?? ""}</TableCell>
      <TableCell>
        <Input
          value={ligne.nom}
          maxLength={150}
          aria-label={t("colonnes.nom")}
          aria-invalid={Boolean(erreurs.nom)}
          disabled={desactive}
          onChange={(e) => onCorriger("nom", e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Input
          value={ligne.prenom}
          maxLength={150}
          aria-label={t("colonnes.prenom")}
          aria-invalid={Boolean(erreurs.prenom)}
          disabled={desactive}
          onChange={(e) => onCorriger("prenom", e.target.value)}
        />
      </TableCell>
      <TableCell className="min-w-56">
        {pays && (
          <ChampTelephone
            valeur={ligne.telephone}
            onChange={(valeur) => onCorriger("telephone", valeur)}
            paysDefaut={pays}
            international
            erreur={erreurs.telephone}
            disabled={desactive}
          />
        )}
      </TableCell>
      <TableCell>
        <Input
          value={ligne.metier}
          maxLength={100}
          aria-label={t("colonnes.metier")}
          aria-invalid={Boolean(erreurs.metier)}
          disabled={desactive}
          onChange={(e) => onCorriger("metier", e.target.value)}
        />
      </TableCell>
      <TableCell className="min-w-48">
        <Select
          value={valeurEntreprise}
          disabled={desactive}
          onValueChange={(valeur) => onCorriger("entreprisePartenaireId", valeur === INTERNE ? null : valeur)}
        >
          <SelectTrigger className="w-full" aria-label={t("colonnes.entreprise")} aria-invalid={Boolean(erreurs.entreprise)}>
            <SelectValue placeholder={entrepriseInconnue ? t("entrepriseInconnue", { nom: ligne.entrepriseSaisie }) : undefined} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={INTERNE}>{t("notreEntreprise")}</SelectItem>
            {partenaires.map((partenaire) => (
              <SelectItem key={partenaire.id} value={partenaire.id}>
                {partenaire.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="min-w-48">
        <div className="flex flex-col gap-1">
          <Badge variante={VARIANTE_STATUT[ligne.statut]}>{t(`statuts.${ligne.statut}`)}</Badge>
          {raison && <span className="text-xs text-neutral-600">{raison}</span>}
        </div>
      </TableCell>
      <TableCell>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t("abandonner")}
          title={t("abandonner")}
          disabled={desactive}
          onClick={onAbandonner}
        >
          <X />
        </Button>
      </TableCell>
    </TableRow>
  );
}

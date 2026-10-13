"use client";

import { useMutation } from "@tanstack/react-query";
import { ChevronDown, CircleX, Download, FileSpreadsheet, LoaderCircle, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { telechargerCsv, versCsv } from "@/lib/export/csv";
import { genererPdfTableau } from "@/lib/export/pdf";
import { ABSENT, formaterDate } from "@/lib/format";

import { Alert, AlertDescription } from "./alert";
import { Bouton } from "./Bouton";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

/**
 * L'export d'un tableau en CSV et en PDF — **tout tableau du produit en a
 * un**. Le PDF passe par l'étape **« Imprimer »** : il s'ouvre d'abord en
 * aperçu, et c'est de là qu'on le télécharge ou qu'on l'imprime — on voit ce
 * qu'on sort avant de le sortir. `TableauListe` l'exige (`exporter` n'y est
 * pas facultatif) ; un tableau qui ne passe pas par lui pose `MenuExport` dans sa barre d'outils.
 *
 * L'écran ne décrit que ses colonnes : l'intitulé, et la valeur d'une ligne.
 * Le reste — le nom daté du fichier, le sous-titre du PDF, les deux formats —
 * est le même partout, et vit ici.
 */

/** Une valeur de cellule. `null` sort vide. */
export type ValeurExport = string | number | null | undefined;

export interface ColonneExport<T> {
  entete: string;
  /**
   * La valeur **brute** plutôt que celle de l'écran : un montant en francs
   * entiers et non « 10,5M », une date complète, un libellé plutôt qu'un
   * badge. Un fichier se retrie et se recalcule ; un arrondi d'affichage s'y
   * cumule.
   */
  valeur: (ligne: T) => ValeurExport;
}

export interface ExportTableau<T> {
  /** Le titre du PDF : « Liste des projets ». */
  titre: string;
  /** La base du nom de fichier, sans date ni extension : `projets`. */
  nomFichier: string;
  colonnes: ColonneExport<T>[];
}

/**
 * Une cellule vide plutôt qu'un tiret : une cellule vide se trie et se somme
 * dans un tableur, « — » non. `ABSENT` est rattrapé ici, pour les colonnes qui
 * réutilisent un formateur d'affichage.
 */
function cellule(valeur: ValeurExport): string | number {
  if (valeur === null || valeur === undefined || valeur === ABSENT) return "";
  return valeur;
}

interface Props<T> {
  exporter: ExportTableau<T>;
  /**
   * Les lignes **filtrées**, toutes pages confondues : ce que l'utilisateur a
   * sous les yeux après sa recherche, pas seulement la page courante.
   */
  lignes: T[];
  /**
   * Réduit à son icône à toutes les largeurs : pour une barre déjà pleine,
   * où le libellé ferait passer le bouton d'ajout à la ligne. Le nom reste
   * porté par `aria-label` et l'infobulle.
   */
  compact?: boolean;
}

export function MenuExport<T>({ exporter, lignes, compact = false }: Props<T>) {
  const t = useTranslations("dataTable.export");

  function preparer() {
    const aujourdhui = new Date();
    return {
      entetes: exporter.colonnes.map((colonne) => colonne.entete),
      valeurs: lignes.map((ligne) => exporter.colonnes.map((colonne) => cellule(colonne.valeur(ligne)))),
      nomFichier: t("nomFichier", {
        base: exporter.nomFichier,
        date: aujourdhui.toISOString().slice(0, 10),
      }),
      date: formaterDate(aujourdhui),
    };
  }

  function exporterCsv() {
    const { entetes, valeurs, nomFichier } = preparer();
    telechargerCsv(versCsv([entetes, ...valeurs]), `${nomFichier}.csv`);
  }

  // Les lignes sont figées au clic : l'aperçu montre le tableau tel qu'il était filtré à ce moment-là.
  const generation = useMutation({
    mutationFn: async () => {
      const { entetes, valeurs, nomFichier, date } = preparer();
      const blob = await genererPdfTableau({
        titre: exporter.titre,
        sousTitre: t("sousTitrePdf", { date, nombre: valeurs.length }),
        entetes,
        lignes: valeurs,
      });
      return {
        url: URL.createObjectURL(blob),
        nomFichier: `${nomFichier}.pdf`,
      };
    },
  });

  // L'URL `blob:` retient le PDF en mémoire : on la libère quand l'aperçu change ou se ferme.
  const url = generation.data?.url;
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const cadre = useRef<HTMLIFrameElement>(null);

  function telecharger() {
    if (!generation.data) return;
    const lien = document.createElement("a");
    lien.href = generation.data.url;
    lien.download = generation.data.nomFichier;
    lien.click();
  }

  /**
   * On imprime le PDF de l'aperçu, pas la page. Un navigateur qui refuse
   * d'imprimer le cadre (lecteur PDF externe, mobile) reçoit le PDF dans un
   * onglet, où il s'imprime.
   */
  function imprimer() {
    if (!generation.data) return;
    try {
      cadre.current?.contentWindow?.focus();
      cadre.current?.contentWindow?.print();
    } catch {
      window.open(generation.data.url, "_blank", "noopener");
    }
  }

  const apercuOuvert = generation.isPending || generation.isError || generation.isSuccess;

  // Réduit à son icône sous 640 px, comme les autres actions compactes.
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Bouton
            variante="secondaire"
            taille="sm"
            aria-label={t("action")}
            title={compact ? t("action") : undefined}
            disabled={lignes.length === 0}
            iconeGauche={<Download size={16} aria-hidden="true" />}
            iconeDroite={
              compact ? undefined : <ChevronDown size={16} aria-hidden="true" className="max-sm:hidden" />
            }
            className={compact ? "gap-0 px-3" : "max-sm:gap-0 max-sm:px-3"}
          >
            {!compact && <span className="max-sm:hidden">{t("action")}</span>}
          </Bouton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={exporterCsv}>
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            {t("csv")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => generation.mutate()}>
            <Printer className="size-4" aria-hidden="true" />
            {t("imprimer")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={apercuOuvert}
        onOpenChange={(ouvert) => !ouvert && !generation.isPending && generation.reset()}
      >
        <DialogContent
          className={generation.isSuccess ? "flex h-[90vh] flex-col sm:max-w-[960px]" : "sm:max-w-[420px]"}
          showCloseButton={!generation.isPending}
        >
          <DialogHeader>
            <DialogTitle>{exporter.titre}</DialogTitle>
            <DialogDescription>
              {generation.isPending ? t("apercu.enCours") : t("apercu.description")}
            </DialogDescription>
          </DialogHeader>

          {generation.isSuccess ? (
            <>
              <iframe
                ref={cadre}
                src={generation.data.url}
                title={t("apercu.titreCadre")}
                className="min-h-0 w-full flex-1 rounded-md border border-solid border-neutral-200 bg-neutral-100"
              />
              <DialogFooter className="gap-3">
                <Button type="button" variant="outline" onClick={() => generation.reset()}>
                  {t("apercu.fermer")}
                </Button>
                <Button type="button" variant="outline" onClick={telecharger}>
                  <Download aria-hidden="true" />
                  {t("apercu.telecharger")}
                </Button>
                <Button type="button" onClick={imprimer}>
                  <Printer aria-hidden="true" />
                  {t("apercu.imprimer")}
                </Button>
              </DialogFooter>
            </>
          ) : generation.isPending ? (
            <div className="flex justify-center py-4" role="status" aria-live="polite">
              <LoaderCircle className="size-8 animate-spin text-primary-600" aria-hidden="true" />
            </div>
          ) : (
            <>
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{t("apercu.erreur")}</AlertDescription>
              </Alert>
              <DialogFooter className="gap-3">
                <Button type="button" variant="outline" onClick={() => generation.reset()}>
                  {t("apercu.fermer")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

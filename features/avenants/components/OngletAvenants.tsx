"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, FilePlus2, LoaderCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BORD_DROIT_TABLEAU, TableauListe } from "@/components/ui/tableau-liste";
import { Textarea } from "@/components/ui/textarea";
import { cleDecoupage } from "@/features/decoupage/cles";
import { MONTANT_MASQUE } from "@/features/decoupage/components/CellulesCase";
import { SelecteurPerimetre } from "@/features/decoupage/components/SelecteurPerimetre";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import { cleProjet } from "@/features/projets/cles";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";
import { ABSENT, centimesEnFrancs, formaterDate, formaterMontant } from "@/lib/format";

import { enregistrerAvenant, listerAvenants, retirerAvenant, telechargerDocumentAvenant } from "../adaptateur";
import { cleAvenants } from "../cles";
import type { Avenant } from "../types";

const colonne = aideColonnes<Avenant>();

/**
 * L'onglet Avenants de la fiche projet (décision P9) : les avenants signés — numéro, date, objet,
 * jours accordés, montant, ce sur quoi ils portent, document joint —, en enregistrer un, en
 * retirer un enregistré par erreur (`projets.avenants_gerer`). Les jours accordés repoussent la
 * fin contractuelle du projet ou des cases visées.
 */
export function OngletAvenants({ projet }: { projet: Projet }) {
  const t = useTranslations("avenants");
  const { peutSurProjet, voitMontants } = useDroits();
  const permis = peutSurProjet(PERMISSIONS.AVENANTS_GERER, projet);
  const client = useQueryClient();
  const [creation, setCreation] = useState(false);
  const [aRetirer, setARetirer] = useState<Avenant | null>(null);

  const requete = useQuery({ queryKey: cleAvenants(projet.id), queryFn: ({ signal }) => listerAvenants(projet.id, signal) });

  const document = useMutation({
    mutationFn: async (avenant: Avenant) => {
      const fichier = await telechargerDocumentAvenant(avenant.id);
      const lien = window.document.createElement("a");
      lien.href = URL.createObjectURL(fichier);
      lien.download = avenant.document?.nom || `avenant-${avenant.numero}`;
      lien.click();
      URL.revokeObjectURL(lien.href);
    },
    onError: (e) => toast.error(e instanceof ErreurApi && e.message ? e.message : t("erreur")),
  });

  const colonnes = useMemo(
    () => [
      colonne.display({ id: "numero", header: t("colonnes.numero"), cell: ({ row }) => <span className="font-medium">{row.original.numero}</span> }),
      colonne.display({ id: "date", header: t("colonnes.date"), cell: ({ row }) => formaterDate(row.original.dateSignature) }),
      colonne.display({
        id: "objet",
        header: t("colonnes.objet"),
        cell: ({ row }) => <span className="line-clamp-2 max-w-md">{row.original.objet}</span>,
      }),
      colonne.display({
        id: "jours",
        header: t("colonnes.jours"),
        cell: ({ row }) => t("jours", { nombre: row.original.joursAccordes }),
      }),
      colonne.display({
        id: "montant",
        header: t("colonnes.montant"),
        cell: ({ row }) =>
          !voitMontants ? MONTANT_MASQUE : row.original.montant === null ? ABSENT : formaterMontant(row.original.montant),
      }),
      colonne.display({
        id: "porte",
        header: t("colonnes.porteSur"),
        cell: ({ row }) =>
          row.original.porteSur === "PROJET" ? t("projetEntier") : row.original.cases.map((c) => c.libelle).join(", "),
      }),
      colonne.display({
        id: "actions",
        header: () => <span className="sr-only">{t("colonnes.actions")}</span>,
        cell: ({ row }) => (
          <span className="flex justify-end gap-1">
            {row.original.document && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("document")}
                title={row.original.document.nom}
                onClick={() => document.mutate(row.original)}
                disabled={document.isPending}
              >
                <FileDown />
              </Button>
            )}
            <BoutonPermis
              size="icon-sm"
              variant="ghost"
              aria-label={t("retirer")}
              title={t("retirer")}
              permis={permis}
              permission={PERMISSIONS.AVENANTS_GERER}
              onClick={() => setARetirer(row.original)}
            >
              <Trash2 />
            </BoutonPermis>
          </span>
        ),
        meta: { classe: BORD_DROIT_TABLEAU },
      }),
    ],
    [t, voitMontants, permis, document],
  );

  const exporter = useMemo<ExportTableau<Avenant>>(
    () => ({
      titre: t("export.titre", { projet: projet.nom }),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        { entete: t("colonnes.numero"), valeur: (a) => a.numero },
        { entete: t("colonnes.date"), valeur: (a) => a.dateSignature },
        { entete: t("colonnes.objet"), valeur: (a) => a.objet },
        { entete: t("colonnes.jours"), valeur: (a) => a.joursAccordes },
        ...(voitMontants
          ? [{ entete: t("export.montantFrancs"), valeur: (a: Avenant) => (a.montant === null ? "" : centimesEnFrancs(a.montant)) }]
          : []),
        {
          entete: t("colonnes.porteSur"),
          valeur: (a) => (a.porteSur === "PROJET" ? t("projetEntier") : a.cases.map((c) => c.libelle).join(", ")),
        },
      ],
    }),
    [t, projet.nom, voitMontants],
  );

  async function actualiser() {
    // Les jours accordés changent la fin contractuelle du projet et des cases.
    await client.invalidateQueries({ queryKey: cleAvenants(projet.id) });
    await client.invalidateQueries({ queryKey: cleProjet(projet.id) });
    await client.invalidateQueries({ queryKey: cleDecoupage(projet.id) });
  }

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-neutral-600">
        {t("resume", {
          jours: projet.joursAccordes,
          fin: formaterDate(projet.dateFinContractuelle),
        })}
      </p>
      <TableauListe
        colonnes={colonnes}
        donnees={requete.data}
        cleLigne={(a) => a.id}
        messageVide={t("vide")}
        exporter={exporter}
        actions={
          <BoutonPermis size="sm" permis={permis} permission={PERMISSIONS.AVENANTS_GERER} onClick={() => setCreation(true)}>
            <FilePlus2 />
            {t("enregistrer")}
          </BoutonPermis>
        }
      />
      {creation && <TiroirAvenant projet={projet} onFermer={() => setCreation(false)} onEnregistre={actualiser} />}
      {aRetirer && (
        <FenetreRetrait avenant={aRetirer} onFermer={() => setARetirer(null)} onRetire={actualiser} />
      )}
    </div>
  );
}

function messageErreur(e: unknown, repli: string): string {
  if (e instanceof ErreurApi) {
    const champs = Object.values(e.erreursParChamp);
    return e.code === "validation" && champs.length > 0 ? champs.join(" ") : e.message || repli;
  }
  return repli;
}

function TiroirAvenant({ projet, onFermer, onEnregistre }: { projet: Projet; onFermer: () => void; onEnregistre: () => Promise<void> }) {
  const t = useTranslations("avenants.creation");
  const { voitMontants } = useDroits();
  const [numero, setNumero] = useState("");
  const [date, setDate] = useState("");
  const [objet, setObjet] = useState("");
  const [jours, setJours] = useState("0");
  const [montant, setMontant] = useState("");
  const [cases, setCases] = useState<string[]>([]);
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const ecriture = useMutation({
    mutationFn: () =>
      enregistrerAvenant(projet.id, {
        numero,
        dateSignature: date,
        objet,
        joursAccordes: Number.parseInt(jours || "0", 10) || 0,
        // Saisi en francs, gardé en centimes comme tout montant du domaine.
        montant: montant.trim() === "" ? null : Math.round(Number(montant) * 100),
        casesIds: cases,
        document: fichier,
      }),
    onSuccess: async (avenant) => {
      toast.success(t("succes", { numero: avenant.numero }));
      onFermer();
      await onEnregistre();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });

  const complet = numero.trim() && date && objet.trim();

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && !ecriture.isPending && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg text-neutral-900">{t("titre")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
              {t("numero")}
              <Input value={numero} maxLength={30} onChange={(e) => setNumero(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
              {t("dateSignature")}
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            {t("objet")}
            <Textarea value={objet} onChange={(e) => setObjet(e.target.value)} rows={3} />
          </label>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
              {t("joursAccordes")}
              <Input type="number" step={1} min={-3650} max={3650} value={jours} onChange={(e) => setJours(e.target.value)} />
              <span className="text-xs font-normal text-neutral-500">{t("joursAide")}</span>
            </label>
            {voitMontants && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
                {t("montant")}
                <Input type="number" step={1} value={montant} onChange={(e) => setMontant(e.target.value)} />
                <span className="text-xs font-normal text-neutral-500">{t("montantAide")}</span>
              </label>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-700">{t("porteSur")}</span>
            {projet.decoupageCree ? (
              <SelecteurPerimetre projetId={projet.id} valeur={cases} onChange={setCases} />
            ) : (
              <span className="text-sm text-neutral-500">{t("projetEntier")}</span>
            )}
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            {t("document")}
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
          </label>
          {erreur && (
            <Alert variant="erreur">
              <AlertDescription>{erreur}</AlertDescription>
            </Alert>
          )}
        </div>
        <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <Button variant="outline" onClick={onFermer} disabled={ecriture.isPending}>
            {t("annuler")}
          </Button>
          <Button onClick={() => ecriture.mutate()} disabled={ecriture.isPending || !complet}>
            {ecriture.isPending && <LoaderCircle className="animate-spin" />}
            {t("enregistrer")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FenetreRetrait({ avenant, onFermer, onRetire }: { avenant: Avenant; onFermer: () => void; onRetire: () => Promise<void> }) {
  const t = useTranslations("avenants.retrait");
  const [erreur, setErreur] = useState<string | null>(null);
  const ecriture = useMutation({
    mutationFn: () => retirerAvenant(avenant.id),
    onSuccess: async () => {
      toast.success(t("succes", { numero: avenant.numero }));
      onFermer();
      await onRetire();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !ecriture.isPending && onFermer()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("titre", { numero: avenant.numero })}</DialogTitle>
          <DialogDescription>{t("description", { jours: avenant.joursAccordes })}</DialogDescription>
        </DialogHeader>
        {erreur && (
          <Alert variant="erreur">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onFermer} disabled={ecriture.isPending}>
            {t("annuler")}
          </Button>
          <Button variant="destructive" onClick={() => ecriture.mutate()} disabled={ecriture.isPending}>
            {ecriture.isPending && <LoaderCircle className="animate-spin" />}
            {t("retirer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

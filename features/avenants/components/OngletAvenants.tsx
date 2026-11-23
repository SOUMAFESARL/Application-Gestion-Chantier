"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, FilePlus2, LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { aProlongationContractuelle } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";
import {
  ABSENT,
  centimesEnFrancs,
  formaterDate,
  formaterDureeCalendaire,
  formaterMontant,
} from "@/lib/format";

import {
  enregistrerAvenant,
  listerAvenants,
  retirerAvenant,
  telechargerDocumentAvenant,
  telechargerOrdreServiceAvenant,
} from "../adaptateur";
import { cleAvenants } from "../cles";
import type { Avenant } from "../types";

const colonne = aideColonnes<Avenant>();

function libelleProlongationAvenant(avenant: Pick<Avenant, "anneesAccordees" | "moisAccordes" | "joursAccordes">): string {
  return formaterDureeCalendaire({
    annees: avenant.anneesAccordees,
    mois: avenant.moisAccordes,
    jours: avenant.joursAccordes,
  });
}

/**
 * L'onglet Avenants de la fiche projet :
 * - exige qu'un contrat du marché soit déposé sur le projet ;
 * - exige l'avenant signé en premier puis l'ordre de service lié (public et privé) ;
 * - prolongation en années / mois / jours (>= 0) et montant (>= 0), jamais négatifs ;
 * - met à jour automatiquement la fin contractuelle et le budget contractuel du projet.
 */
export function OngletAvenants({ projet }: { projet: Projet }) {
  const t = useTranslations("avenants");
  const { peutSurProjet, voitMontants } = useDroits();
  const permis = peutSurProjet(PERMISSIONS.AVENANTS_GERER, projet);
  const aContrat = projet.contrats.length > 0;
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

  const ordreService = useMutation({
    mutationFn: async (avenant: Avenant) => {
      const fichier = await telechargerOrdreServiceAvenant(avenant.id);
      const lien = window.document.createElement("a");
      lien.href = URL.createObjectURL(fichier);
      lien.download = avenant.ordreService?.nom || `ordre-service-avenant-${avenant.numero}`;
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
        cell: ({ row }) => libelleProlongationAvenant(row.original),
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
        id: "avenant",
        header: t("colonnes.avenant"),
        cell: ({ row }) =>
          row.original.document ? (
            <button
              type="button"
              onClick={() => document.mutate(row.original)}
              disabled={document.isPending}
              title={row.original.document.nom}
              className="inline-flex max-w-44 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left text-xs font-medium text-primary-600 hover:underline"
            >
              <FileDown className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{row.original.document.nom}</span>
            </button>
          ) : (
            ABSENT
          ),
      }),
      colonne.display({
        id: "ordreService",
        header: t("colonnes.ordreService"),
        cell: ({ row }) =>
          row.original.ordreService ? (
            <button
              type="button"
              onClick={() => ordreService.mutate(row.original)}
              disabled={ordreService.isPending}
              title={row.original.ordreService.nom}
              className="inline-flex max-w-44 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left text-xs font-medium text-primary-600 hover:underline"
            >
              <FileDown className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{row.original.ordreService.nom}</span>
            </button>
          ) : (
            ABSENT
          ),
      }),
      colonne.display({
        id: "actions",
        header: () => <span className="sr-only">{t("colonnes.actions")}</span>,
        cell: ({ row }) => (
          <span className="flex justify-end gap-1">
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
    [t, voitMontants, permis, document, ordreService],
  );

  const exporter = useMemo<ExportTableau<Avenant>>(
    () => ({
      titre: t("export.titre", { projet: projet.nom }),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        { entete: t("colonnes.numero"), valeur: (a) => a.numero },
        { entete: t("colonnes.date"), valeur: (a) => a.dateSignature },
        { entete: t("colonnes.objet"), valeur: (a) => a.objet },
        { entete: t("colonnes.jours"), valeur: (a) => libelleProlongationAvenant(a) },
        ...(voitMontants
          ? [{ entete: t("export.montantFrancs"), valeur: (a: Avenant) => (a.montant === null ? "" : centimesEnFrancs(a.montant)) }]
          : []),
        {
          entete: t("colonnes.porteSur"),
          valeur: (a) => (a.porteSur === "PROJET" ? t("projetEntier") : a.cases.map((c) => c.libelle).join(", ")),
        },
        {
          entete: t("colonnes.avenant"),
          valeur: (a) => a.document?.nom ?? "",
        },
        {
          entete: t("colonnes.ordreService"),
          valeur: (a) => a.ordreService?.nom ?? "",
        },
      ],
    }),
    [t, projet.nom, voitMontants],
  );

  async function actualiser() {
    // Les prolongations et montants changent la fin contractuelle et le budget contractuel du projet.
    await client.invalidateQueries({ queryKey: cleAvenants(projet.id) });
    await client.invalidateQueries({ queryKey: cleProjet(projet.id) });
    await client.invalidateQueries({ queryKey: cleDecoupage(projet.id) });
  }

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  const aProlongation = aProlongationContractuelle(projet);
  const resumeTexte = aProlongation
    ? t("resumeContractuel", {
        prolongation: formaterDureeCalendaire({
          annees: projet.prolongationAnnees,
          mois: projet.prolongationMois,
          jours: projet.prolongationJours,
        }),
        fin: formaterDate(projet.dateFinContractuelle),
      })
    : t("resumeSansProlongation", { fin: formaterDate(projet.dateFinContractuelle) });

  return (
    <div className="flex flex-col gap-4">
      {!aContrat && (
        <Alert variant="avertissement">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertTitle>{t("contratRequisTitre")}</AlertTitle>
          <AlertDescription>{t("contratRequisDescription")}</AlertDescription>
        </Alert>
      )}
      <p className="m-0 text-sm text-neutral-600">{resumeTexte}</p>
      <TableauListe
        colonnes={colonnes}
        donnees={requete.data}
        cleLigne={(a) => a.id}
        messageVide={t("vide")}
        exporter={exporter}
        actions={
          <BoutonPermis
            size="sm"
            permis={permis}
            permission={PERMISSIONS.AVENANTS_GERER}
            disabled={!aContrat}
            onClick={() => setCreation(true)}
          >
            <FilePlus2 />
            {t("enregistrer")}
          </BoutonPermis>
        }
      />
      {creation && aContrat && (
        <TiroirAvenant projet={projet} onFermer={() => setCreation(false)} onEnregistre={actualiser} />
      )}
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
  if (e instanceof Error && e.message) {
    return e.message;
  }
  return repli;
}

function TiroirAvenant({ projet, onFermer, onEnregistre }: { projet: Projet; onFermer: () => void; onEnregistre: () => Promise<void> }) {
  const t = useTranslations("avenants.creation");
  const { voitMontants } = useDroits();
  const [numero, setNumero] = useState("");
  const [date, setDate] = useState("");
  const [objet, setObjet] = useState("");
  const [annees, setAnnees] = useState("0");
  const [mois, setMois] = useState("0");
  const [jours, setJours] = useState("0");
  const [montant, setMontant] = useState("");
  const [cases, setCases] = useState<string[]>([]);
  const [fichierAvenant, setFichierAvenant] = useState<File | null>(null);
  const [ordreServiceFichier, setOrdreServiceFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const ecriture = useMutation({
    mutationFn: () => {
      if (!fichierAvenant) {
        throw new Error(t("erreurDocumentRequis"));
      }
      if (!ordreServiceFichier) {
        throw new Error(t("erreurOrdreServiceRequis"));
      }
      const valAnnees = Number.parseInt(annees || "0", 10) || 0;
      const valMois = Number.parseInt(mois || "0", 10) || 0;
      const valJours = Number.parseInt(jours || "0", 10) || 0;
      const valMontant = montant.trim() === "" ? null : Math.round(Number(montant) * 100);
      if (valAnnees < 0 || valMois < 0 || valJours < 0 || (valMontant !== null && valMontant < 0)) {
        throw new Error(t("erreurValeurNegative"));
      }
      return enregistrerAvenant(projet.id, {
        numero,
        dateSignature: date,
        objet,
        anneesAccordees: valAnnees,
        moisAccordes: valMois,
        joursAccordes: valJours,
        montant: valMontant,
        casesIds: cases,
        document: fichierAvenant,
        ordreService: ordreServiceFichier,
      });
    },
    onSuccess: async (avenant) => {
      toast.success(t("succes", { numero: avenant.numero }));
      onFermer();
      await onEnregistre();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });

  function soumettre() {
    setErreur(null);
    if (!fichierAvenant) {
      setErreur(t("erreurDocumentRequis"));
      return;
    }
    if (!ordreServiceFichier) {
      setErreur(t("erreurOrdreServiceRequis"));
      return;
    }
    ecriture.mutate();
  }

  const champsBaseComplets = Boolean(numero.trim() && date && objet.trim());

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
              <span>
                {t("numero")}{" "}
                <span className="text-erreur" aria-hidden="true">
                  *
                </span>
              </span>
              <Input value={numero} maxLength={30} onChange={(e) => setNumero(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
              <span>
                {t("dateSignature")}{" "}
                <span className="text-erreur" aria-hidden="true">
                  *
                </span>
              </span>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            <span>
              {t("objet")}{" "}
              <span className="text-erreur" aria-hidden="true">
                *
              </span>
            </span>
            <Textarea value={objet} onChange={(e) => setObjet(e.target.value)} rows={3} />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-700">{t("prolongation")}</span>
            <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                {t("annees")}
                <Input type="number" step={1} min={0} max={100} value={annees} onChange={(e) => setAnnees(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                {t("mois")}
                <Input type="number" step={1} min={0} max={1200} value={mois} onChange={(e) => setMois(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                {t("jours")}
                <Input type="number" step={1} min={0} max={3650} value={jours} onChange={(e) => setJours(e.target.value)} />
              </label>
            </div>
            <span className="text-xs font-normal text-neutral-500">{t("prolongationAide")}</span>
          </div>
          {voitMontants && (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
              {t("montant")}
              <Input type="number" step={1} min={0} value={montant} onChange={(e) => setMontant(e.target.value)} />
              <span className="text-xs font-normal text-neutral-500">{t("montantAide")}</span>
            </label>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-700">{t("porteSur")}</span>
            {projet.decoupageCree ? (
              <SelecteurPerimetre projetId={projet.id} valeur={cases} onChange={setCases} />
            ) : (
              <span className="text-sm text-neutral-500">{t("projetEntier")}</span>
            )}
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            <span>
              {t("document")}{" "}
              <span className="text-erreur" aria-hidden="true">
                *
              </span>
            </span>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
              onChange={(e) => {
                setFichierAvenant(e.target.files?.[0] ?? null);
                setErreur(null);
              }}
            />
            <span className="text-xs font-normal text-neutral-500">{t("documentAide")}</span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            <span>
              {t("ordreService")}{" "}
              <span className="text-erreur" aria-hidden="true">
                *
              </span>
            </span>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
              onChange={(e) => {
                setOrdreServiceFichier(e.target.files?.[0] ?? null);
                setErreur(null);
              }}
            />
            <span className="text-xs font-normal text-neutral-500">{t("ordreServiceAide")}</span>
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
          <Button onClick={soumettre} disabled={ecriture.isPending || !champsBaseComplets}>
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
          <DialogDescription>{t("description")}</DialogDescription>
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

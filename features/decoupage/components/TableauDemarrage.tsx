"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Download,
  FileUp,
  ListChecks,
  LoaderCircle,
  Plus,
  Rows3,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";
import { telechargerCsv, versCsv } from "@/lib/export/csv";
import { cn } from "@/lib/utils";

import {
  appliquerTableau,
  importerFichier,
  lireTableauDemarrage,
  listerListes,
  listerModeles,
  refusTableau,
  verifierTableau,
} from "../adaptateur";
import { CLE_LISTES, cleDecoupage, cleModeles, cleTableauDemarrage } from "../cles";
import {
  ajouterNiveau,
  COLONNES_FICHIER,
  constatsGeneraux,
  constatsParLigne,
  deplacerNiveau,
  ligneVide,
  recaler,
  retirerNiveau,
  tableauEstVide,
  lignesFichier,
} from "../regles";
import type {
  ConstatTableau,
  LigneTableau,
  ListeValeurs,
  ModeleApplique,
  NiveauGabarit,
  RefusTableau,
  TableauDemarrage as Tableau,
  UniteMesure,
  VerdictTableau,
} from "../types";
import { UNITES_MESURE } from "../types";

const SANS_LISTE = "aucune";
const SANS_UNITE = "aucune";
const MODELE_DEFAUT = "defaut";

/**
 * Le tableau de démarrage d'un projet (décisions v1.2, §5 et §6 ; décision P4).
 *
 * Le projet est créé avec ses informations minimales ; son découpage se saisit ici, dans un
 * tableau **pré-rempli par le modèle de son type**. Une ligne est une tâche (une feuille) ; ses
 * cellules suivent les niveaux, dans l'ordre, et les cellules identiques se regroupent sous un
 * même parent. On peut changer de modèle, régler les niveaux, importer un fichier Excel ou CSV
 * (analysé par le serveur), exporter la saisie, faire vérifier le tableau (C-1 à C-7), puis
 * l'appliquer : l'arbre est construit et l'onglet bascule sur la vue en arbre.
 *
 * Rien n'est vérifié ici : c'est le serveur qui juge, et l'écran montre son verdict, ligne par
 * ligne. La grille est faite pour l'ordinateur et la tablette (P16).
 */
export function TableauDemarrage({ projet }: { projet: Projet }) {
  const [modele, setModele] = useState<Pick<ModeleApplique, "origine" | "id"> | null>(null);

  const requete = useQuery({
    queryKey: cleTableauDemarrage(projet.id, modele),
    queryFn: ({ signal }) => lireTableauDemarrage(projet.id, modele, signal),
    // Le tableau est une saisie : on ne la remplace pas sous les doigts de l'utilisateur.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  return (
    <EditeurTableau
      // Un autre modèle : un autre tableau, la saisie repart de lui.
      key={`${requete.data.modele?.origine ?? ""}-${requete.data.modele?.id ?? ""}`}
      projet={projet}
      initial={requete.data}
      onChangerModele={setModele}
    />
  );
}

/* ------------------------------------------------------------------ *
 * L'éditeur : l'état de la saisie, la vérification, l'application.
 * ------------------------------------------------------------------ */

interface ContexteGrille {
  tableau: Tableau;
  listes: ListeValeurs[];
  constats: Map<number, ConstatTableau[]>;
  bloquantes: Set<number>;
  desactive: boolean;
  modifierLigne: (cle: string, modification: Partial<LigneTableau>) => void;
  modifierCellule: (cle: string, index: number, valeur: string) => void;
  insererApres: (cle: string) => void;
  retirerLigne: (cle: string) => void;
}

/**
 * Les cellules lisent la saisie par ce contexte plutôt que par les définitions de colonnes :
 * TanStack rend chaque cellule comme un composant, et une définition recréée à chaque frappe
 * remonterait l'`<input>` — le curseur sortirait du champ à chaque lettre.
 */
const Grille = createContext<ContexteGrille | null>(null);

function useGrille(): ContexteGrille {
  const contexte = useContext(Grille);
  if (!contexte) throw new Error("useGrille");
  return contexte;
}

function EditeurTableau({
  projet,
  initial,
  onChangerModele,
}: {
  projet: Projet;
  initial: Tableau;
  onChangerModele: (modele: Pick<ModeleApplique, "origine" | "id"> | null) => void;
}) {
  const t = useTranslations("decoupage.tableau");
  const tUnite = useTranslations("decoupage.unites");
  const client = useQueryClient();
  const { peutSurProjet, voitMontants } = useDroits();
  const peutDecouper = peutSurProjet(PERMISSIONS.DECOUPER, projet);

  const [tableau, setTableau] = useState<Tableau>(() =>
    initial.lignes.length > 0 ? initial : { ...initial, lignes: [ligneVide(initial.niveaux.length)] },
  );
  const [modifie, setModifie] = useState(false);
  const [verdict, setVerdict] = useState<VerdictTableau | null>(null);
  const [refus, setRefus] = useState<RefusTableau | null>(null);
  const [modeleEnAttente, setModeleEnAttente] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  const requeteModeles = useQuery({
    queryKey: cleModeles(projet.typeProjet),
    queryFn: ({ signal }) => listerModeles(projet.typeProjet, signal),
  });
  const requeteListes = useQuery({
    queryKey: CLE_LISTES,
    queryFn: ({ signal }) => listerListes(signal),
  });
  const listes = useMemo(() => requeteListes.data ?? [], [requeteListes.data]);

  /** Toute modification périme le verdict : il décrivait un autre tableau. */
  function changer(suivant: (courant: Tableau) => Tableau) {
    setTableau(suivant);
    setModifie(true);
    setVerdict(null);
  }

  const verification = useMutation({
    mutationFn: () => verifierTableau(projet.id, tableau),
    onSuccess: setVerdict,
    onError: (erreur) => toast.error(messageErreur(erreur, t("erreurVerification"))),
  });

  const importation = useMutation({
    mutationFn: (choisi: File) => importerFichier(projet.id, choisi),
    onSuccess: (importe) => {
      setTableau((courant) => ({
        ...courant,
        niveaux: importe.niveaux,
        lignes: importe.lignes.length > 0 ? importe.lignes : [ligneVide(importe.niveaux.length)],
      }));
      setModifie(true);
      setVerdict(importe.verification);
      toast.success(t("importReussi", { lignes: importe.lignes.length }));
    },
    onError: (erreur) => toast.error(messageErreur(erreur, t("erreurImport"))),
  });

  const application = useMutation({
    mutationFn: (confirmer: boolean) => appliquerTableau(projet.id, tableau, confirmer),
    onSuccess: async (resultat) => {
      setRefus(null);
      toast.success(t("applique", { cases: resultat.casesCreees }));
      // Le projet porte `decoupageCree` : le relire fait basculer l'onglet sur l'arbre.
      await client.invalidateQueries({ queryKey: ["projets", projet.id] });
      await client.invalidateQueries({ queryKey: cleDecoupage(projet.id) });
    },
    onError: (erreur) => {
      const refusServeur = refusTableau(erreur);
      if (refusServeur) {
        setVerdict((courant) => ({
          bloquants: refusServeur.bloquants,
          avertissements: refusServeur.avertissements,
          apercu: courant?.apercu ?? { cases: 0, feuilles: 0, niveaux: tableau.niveaux.length },
        }));
        if (refusServeur.confirmationRequise) setRefus(refusServeur);
        else toast.error(t("refusBloquants"));
        return;
      }
      toast.error(messageErreur(erreur, t("erreurApplication")));
    },
  });

  const enCours = verification.isPending || importation.isPending || application.isPending;

  function choisirModele(valeur: string) {
    if (modifie) {
      setModeleEnAttente(valeur);
      return;
    }
    appliquerModele(valeur);
  }

  function appliquerModele(valeur: string) {
    setModeleEnAttente(null);
    if (valeur === MODELE_DEFAUT) {
      onChangerModele(null);
      return;
    }
    const [origine, id] = valeur.split(":");
    onChangerModele({ origine: origine as ModeleApplique["origine"], id });
  }

  function exporter() {
    const colonnes = COLONNES_FICHIER.filter((colonne) => voitMontants || colonne !== "montant");
    const entetes = [
      ...tableau.niveaux.map((niveau, rang) => niveau.libelle || t("niveauSansNom", { rang: rang + 1 })),
      ...colonnes.map((colonne) => t(`colonnesFichier.${colonne}`)),
    ];
    telechargerCsv(
      versCsv([entetes, ...lignesFichier(tableau, colonnes, (unite) => tUnite(unite))]),
      `decoupage-${projet.reference || projet.id}`,
    );
  }

  const constats = useMemo(
    () => constatsParLigne([...(verdict?.bloquants ?? []), ...(verdict?.avertissements ?? [])]),
    [verdict],
  );
  const bloquantes = useMemo(
    () => new Set((verdict?.bloquants ?? []).map((c) => c.ligne).filter((n): n is number => n !== null)),
    [verdict],
  );

  const contexte: ContexteGrille = {
    tableau,
    listes,
    constats,
    bloquantes,
    desactive: enCours,
    modifierLigne: (cle, modification) =>
      changer((courant) => ({
        ...courant,
        lignes: courant.lignes.map((ligne) => (ligne.cle === cle ? { ...ligne, ...modification } : ligne)),
      })),
    modifierCellule: (cle, index, valeur) =>
      changer((courant) => ({
        ...courant,
        lignes: courant.lignes.map((ligne) =>
          ligne.cle === cle
            ? { ...ligne, cellules: ligne.cellules.map((c, rang) => (rang === index ? valeur : c)) }
            : ligne,
        ),
      })),
    insererApres: (cle) =>
      changer((courant) => {
        const rang = courant.lignes.findIndex((ligne) => ligne.cle === cle);
        const nouvelle = ligneVide(courant.niveaux.length);
        // La nouvelle ligne reprend le chemin de celle du dessus, sauf sa dernière case : on
        // ajoute le plus souvent une tâche sœur.
        const source = courant.lignes[rang];
        if (source) {
          const dernier = source.cellules.findLastIndex((cellule) => cellule.trim() !== "");
          nouvelle.cellules = source.cellules.map((cellule, index) => (index < dernier ? cellule : ""));
        }
        const lignes = [...courant.lignes];
        lignes.splice(rang + 1, 0, nouvelle);
        return { ...courant, lignes };
      }),
    retirerLigne: (cle) =>
      changer((courant) => {
        const lignes = courant.lignes.filter((ligne) => ligne.cle !== cle);
        return { ...courant, lignes: lignes.length > 0 ? lignes : [ligneVide(courant.niveaux.length)] };
      }),
  };

  const valeurModele = initial.modele ? `${initial.modele.origine}:${initial.modele.id}` : MODELE_DEFAUT;
  const vide = tableauEstVide(tableau);

  return (
    <Grille.Provider value={contexte}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border border-solid border-neutral-200 bg-neutral-0 p-4 shadow-sm sm:p-5">
          <header className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-semibold text-neutral-900">{t("titre")}</h2>
            <p className="m-0 text-sm text-neutral-600">{t("description")}</p>
          </header>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-64 flex-col gap-1.5 text-sm font-medium text-neutral-700">
              {t("modele")}
              <Select value={valeurModele} onValueChange={choisirModele} disabled={enCours}>
                <SelectTrigger className="w-full min-w-64">
                  <SelectValue placeholder={t("modeleAucun")} />
                </SelectTrigger>
                <SelectContent>
                  {!initial.modele && <SelectItem value={MODELE_DEFAUT}>{t("modeleAucun")}</SelectItem>}
                  {(requeteModeles.data ?? []).map((m) => (
                    <SelectItem key={`${m.origine}:${m.id}`} value={`${m.origine}:${m.id}`}>
                      {m.nomAffiche}
                      {m.parDefaut ? ` — ${t("modeleParDefaut")}` : m.pourCeType ? ` — ${t("modelePourCeType")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="ml-auto flex flex-wrap gap-2">
              <input
                ref={fichier}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(evenement) => {
                  const choisi = evenement.target.files?.[0];
                  evenement.target.value = "";
                  if (choisi) importation.mutate(choisi);
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fichier.current?.click()} disabled={enCours}>
                {importation.isPending ? <LoaderCircle className="animate-spin" /> : <FileUp />}
                {t("importer")}
              </Button>
              <Button variant="outline" size="sm" onClick={exporter} disabled={enCours || vide}>
                <Download />
                {t("exporter")}
              </Button>
            </div>
          </div>
          <p className="m-0 text-xs text-neutral-500">{t("aideImport")}</p>
        </section>

        <ReglageNiveaux
          niveaux={tableau.niveaux}
          listes={listes}
          desactive={enCours}
          onModifier={(index, niveau) =>
            changer((courant) => ({
              ...courant,
              niveaux: courant.niveaux.map((n, rang) => (rang === index ? { ...n, ...niveau } : n)),
            }))
          }
          onAjouter={() => changer(ajouterNiveau)}
          onRetirer={(index) => changer((courant) => retirerNiveau(courant, index))}
          onDeplacer={(index, sens) => changer((courant) => deplacerNiveau(courant, index, sens))}
          constats={constatsGeneraux(verdict?.bloquants ?? [])}
        />

        <GrilleLignes voitMontants={voitMontants} />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              changer((courant) => ({
                ...courant,
                lignes: [...courant.lignes, ligneVide(courant.niveaux.length)],
              }))
            }
            disabled={enCours}
          >
            <Plus />
            {t("ajouterLigne")}
          </Button>
        </div>

        {verdict && <Verdict verdict={verdict} />}

        <div className="flex flex-wrap items-center justify-end gap-3 border-0 border-t border-solid border-neutral-200 pt-4">
          <Button
            variant="outline"
            onClick={() => verification.mutate()}
            disabled={enCours || tableau.niveaux.length === 0}
          >
            {verification.isPending ? <LoaderCircle className="animate-spin" /> : <ListChecks />}
            {t("verifier")}
          </Button>
          <BoutonPermis
            permis={peutDecouper}
            permission={PERMISSIONS.DECOUPER}
            onClick={() => application.mutate(false)}
            disabled={enCours || vide || tableau.niveaux.length === 0}
          >
            {application.isPending ? <LoaderCircle className="animate-spin" /> : <Rows3 />}
            {t("appliquer")}
          </BoutonPermis>
        </div>
      </div>

      <Dialog open={refus !== null} onOpenChange={(ouvert) => !ouvert && !application.isPending && setRefus(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t("confirmationTitre")}</DialogTitle>
            <DialogDescription>
              {t("confirmationDescription", { nombre: refus?.avertissements.length ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <ul className="m-0 flex max-h-64 list-none flex-col gap-1.5 overflow-y-auto p-0 text-sm text-neutral-700">
            {(refus?.avertissements ?? []).map((constat, rang) => (
              <li key={rang} className="flex gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-avertissement" aria-hidden="true" />
                <span>{constat.message}</span>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setRefus(null)} disabled={application.isPending}>
              {t("corriger")}
            </Button>
            <Button onClick={() => application.mutate(true)} disabled={application.isPending}>
              {application.isPending && <LoaderCircle className="animate-spin" />}
              {t("creerQuandMeme")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modeleEnAttente !== null} onOpenChange={(ouvert) => !ouvert && setModeleEnAttente(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("changerModeleTitre")}</DialogTitle>
            <DialogDescription>{t("changerModeleDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setModeleEnAttente(null)}>
              {t("garderSaisie")}
            </Button>
            <Button onClick={() => modeleEnAttente && appliquerModele(modeleEnAttente)}>
              {t("remplacer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Grille.Provider>
  );
}

function messageErreur(erreur: unknown, repli: string): string {
  return erreur instanceof ErreurApi && erreur.message ? erreur.message : repli;
}

/* ------------------------------------------------------------------ *
 * Les niveaux du gabarit.
 * ------------------------------------------------------------------ */

function ReglageNiveaux({
  niveaux,
  listes,
  desactive,
  onModifier,
  onAjouter,
  onRetirer,
  onDeplacer,
  constats,
}: {
  niveaux: NiveauGabarit[];
  listes: ListeValeurs[];
  desactive: boolean;
  onModifier: (index: number, niveau: Partial<NiveauGabarit>) => void;
  onAjouter: () => void;
  onRetirer: (index: number) => void;
  onDeplacer: (index: number, sens: -1 | 1) => void;
  constats: ConstatTableau[];
}) {
  const t = useTranslations("decoupage.tableau");

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="m-0 text-base font-semibold text-neutral-900">{t("niveaux")}</h3>
          <p className="m-0 text-sm text-neutral-600">{t("niveauxAide")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onAjouter} disabled={desactive}>
          <Plus />
          {t("ajouterNiveau")}
        </Button>
      </header>

      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3 p-0">
        {niveaux.map((niveau, index) => {
          const enErreur = constats.some((constat) => constat.niveau === index + 1);
          return (
            <li
              key={index}
              className={cn(
                "flex flex-col gap-2 rounded-lg border border-solid bg-neutral-0 p-3",
                enErreur ? "border-erreur" : "border-neutral-200",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variante="neutre">{t("niveauRang", { rang: index + 1 })}</Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("niveauAGauche")}
                    onClick={() => onDeplacer(index, -1)}
                    disabled={desactive || index === 0}
                  >
                    <ArrowLeft />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("niveauADroite")}
                    onClick={() => onDeplacer(index, 1)}
                    disabled={desactive || index === niveaux.length - 1}
                  >
                    <ArrowRight />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("retirerNiveau")}
                    onClick={() => onRetirer(index)}
                    disabled={desactive || niveaux.length === 1}
                  >
                    <X />
                  </Button>
                </div>
              </div>
              <Input
                value={niveau.libelle}
                maxLength={60}
                placeholder={t("niveauLibelle")}
                aria-label={t("niveauLibelle")}
                onChange={(evenement) => onModifier(index, { libelle: evenement.target.value })}
                disabled={desactive}
              />
              <Select
                value={niveau.liste ? `${niveau.liste.origine}:${niveau.liste.id}` : SANS_LISTE}
                onValueChange={(valeur) => {
                  if (valeur === SANS_LISTE) {
                    onModifier(index, { liste: null });
                    return;
                  }
                  const liste = listes.find((l) => `${l.origine}:${l.id}` === valeur);
                  if (liste) {
                    onModifier(index, {
                      liste: { origine: liste.origine, id: liste.id, libelle: liste.libelle },
                    });
                  }
                }}
                disabled={desactive}
              >
                <SelectTrigger className="w-full" aria-label={t("niveauListe")}>
                  <SelectValue placeholder={t("sansListe")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SANS_LISTE}>{t("sansListe")}</SelectItem>
                  {niveau.liste && !listes.some((l) => l.id === niveau.liste?.id) && (
                    <SelectItem value={`${niveau.liste.origine}:${niveau.liste.id}`}>
                      {niveau.liste.libelle}
                    </SelectItem>
                  )}
                  {listes.map((liste) => (
                    <SelectItem key={`${liste.origine}:${liste.id}`} value={`${liste.origine}:${liste.id}`}>
                      {liste.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                <Checkbox
                  checked={niveau.alerter}
                  onCheckedChange={(valeur) => onModifier(index, { alerter: valeur === true })}
                  disabled={desactive}
                />
                {t("alerter")}
              </label>
            </li>
          );
        })}
      </ol>
      {constats.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-erreur">
          {constats.map((constat, rang) => (
            <li key={rang}>{constat.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * La grille des lignes (`@tanstack/react-table`).
 * ------------------------------------------------------------------ */

/** Aucune fonctionnalité de TanStack : ni tri, ni filtre, ni pagination — l'ordre des lignes est la saisie. */
const FONCTIONNALITES = tableFeatures({});
const colonne = createColumnHelper<typeof FONCTIONNALITES, LigneTableau>();

function GrilleLignes({ voitMontants }: { voitMontants: boolean }) {
  const t = useTranslations("decoupage.tableau");
  const { tableau } = useGrille();
  const largeur = tableau.niveaux.length;

  /*
   * Les colonnes ne dépendent que du nombre de niveaux et du droit de voir les montants : leurs
   * cellules sont des composants stables qui lisent la saisie par le contexte.
   */
  const colonnes = useMemo(() => {
    const niveaux = Array.from({ length: largeur }, (_, index) =>
      colonne.display({
        id: `niveau-${index}`,
        header: () => <EnTeteNiveau index={index} />,
        cell: ({ row }) => <CelluleNiveau ligne={row.original} index={index} />,
      }),
    );
    return [
      colonne.display({
        id: "numero",
        header: () => <span className="sr-only">{t("numero")}</span>,
        cell: ({ row }) => <CelluleNumero rang={row.index + 1} />,
      }),
      ...niveaux,
      colonne.display({
        id: "unite",
        header: () => t("unite"),
        cell: ({ row }) => <CelluleUnite ligne={row.original} />,
      }),
      colonne.display({
        id: "quantite",
        header: () => t("quantite"),
        cell: ({ row }) => <CelluleNombre ligne={row.original} champ="quantite" />,
      }),
      ...(voitMontants
        ? [
            colonne.display({
              id: "montant",
              header: () => t("montant"),
              cell: ({ row }) => <CelluleNombre ligne={row.original} champ="montant" />,
            }),
          ]
        : []),
      colonne.display({
        id: "dateDebut",
        header: () => t("dateDebut"),
        cell: ({ row }) => <CelluleDate ligne={row.original} champ="dateDebut" />,
      }),
      colonne.display({
        id: "dateFin",
        header: () => t("dateFin"),
        cell: ({ row }) => <CelluleDate ligne={row.original} champ="dateFin" />,
      }),
      colonne.display({
        id: "actions",
        header: () => <span className="sr-only">{t("actionsLigne")}</span>,
        cell: ({ row }) => <CelluleActions ligne={row.original} />,
      }),
    ] as ColumnDef<typeof FONCTIONNALITES, LigneTableau>[];
  }, [largeur, voitMontants, t]);

  const lignes = useMemo(
    () => tableau.lignes.map((ligne) => recaler(ligne, largeur)),
    [tableau.lignes, largeur],
  );

  const table = useTable({
    features: FONCTIONNALITES,
    columns: colonnes,
    data: lignes,
    getRowId: (ligne) => ligne.cle,
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-solid border-neutral-200 bg-neutral-0">
      <Table className="min-w-max">
        <TableHeader>
          {table.getHeaderGroups().map((groupe) => (
            <TableRow key={groupe.id} className="hover:bg-transparent">
              {groupe.headers.map((entete) => (
                <TableHead key={entete.id} className="align-bottom whitespace-nowrap">
                  {entete.isPlaceholder ? null : <table.FlexRender header={entete} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((ligne) => (
            <LigneGrille key={ligne.id} rang={ligne.index + 1}>
              {ligne.getAllCells().map((cellule) => (
                <TableCell key={cellule.id} className="px-1.5 py-1 align-top">
                  <table.FlexRender cell={cellule} />
                </TableCell>
              ))}
            </LigneGrille>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LigneGrille({ rang, children }: { rang: number; children: ReactNode }) {
  const { constats, bloquantes } = useGrille();
  const aConstat = constats.has(rang);
  return (
    <TableRow
      className={cn(
        bloquantes.has(rang) && "bg-erreur-fond hover:bg-erreur-fond",
        !bloquantes.has(rang) && aConstat && "bg-avertissement-fond hover:bg-avertissement-fond",
      )}
    >
      {children}
    </TableRow>
  );
}

function EnTeteNiveau({ index }: { index: number }) {
  const t = useTranslations("decoupage.tableau");
  const { tableau } = useGrille();
  const niveau = tableau.niveaux[index];
  return <span>{niveau?.libelle || t("niveauSansNom", { rang: index + 1 })}</span>;
}

function CelluleNumero({ rang }: { rang: number }) {
  const { constats } = useGrille();
  const liste = constats.get(rang) ?? [];
  return (
    <span className="flex min-w-8 items-center gap-1 pt-2 text-xs text-neutral-500 tabular-nums">
      {rang}
      {liste.length > 0 && (
        <CircleAlert
          className="size-3.5 text-erreur"
          aria-label={liste.map((constat) => constat.message).join(" ")}
        >
          <title>{liste.map((constat) => constat.message).join("\n")}</title>
        </CircleAlert>
      )}
    </span>
  );
}

function CelluleNiveau({ ligne, index }: { ligne: LigneTableau; index: number }) {
  const t = useTranslations("decoupage.tableau");
  const { tableau, listes, modifierCellule, desactive } = useGrille();
  const niveau = tableau.niveaux[index];
  const liste = niveau?.liste ? listes.find((l) => l.id === niveau.liste?.id) : undefined;
  const idValeurs = liste ? `valeurs-${liste.origine}-${liste.id}` : undefined;
  return (
    <>
      <Input
        value={ligne.cellules[index] ?? ""}
        maxLength={200}
        list={idValeurs}
        aria-label={niveau?.libelle || t("niveauSansNom", { rang: index + 1 })}
        onChange={(evenement) => modifierCellule(ligne.cle, index, evenement.target.value)}
        disabled={desactive}
        className="h-9 min-w-40"
      />
      {/* Les valeurs de la liste du niveau, proposées à la saisie (C-7 avertit d'une coquille). */}
      {liste && idValeurs && (
        <datalist id={idValeurs}>
          {liste.valeurs.map((valeur) => (
            <option key={valeur.id} value={valeur.libelle} />
          ))}
        </datalist>
      )}
    </>
  );
}

function CelluleUnite({ ligne }: { ligne: LigneTableau }) {
  const t = useTranslations("decoupage.tableau");
  const tUnite = useTranslations("decoupage.unites");
  const { modifierLigne, desactive } = useGrille();
  return (
    <Select
      value={ligne.unite ?? SANS_UNITE}
      onValueChange={(valeur) =>
        modifierLigne(ligne.cle, { unite: valeur === SANS_UNITE ? null : (valeur as UniteMesure) })
      }
      disabled={desactive}
    >
      <SelectTrigger className="h-9 w-28" aria-label={t("unite")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SANS_UNITE}>{t("sansUnite")}</SelectItem>
        {UNITES_MESURE.map((unite) => (
          <SelectItem key={unite} value={unite}>
            {tUnite(unite)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Une quantité, ou un montant saisi **en francs** et gardé en centimes, comme tout montant du
 * domaine.
 */
function CelluleNombre({ ligne, champ }: { ligne: LigneTableau; champ: "quantite" | "montant" }) {
  const t = useTranslations("decoupage.tableau");
  const { modifierLigne, desactive } = useGrille();
  const valeur = ligne[champ];
  const affiche = valeur === null ? "" : String(champ === "montant" ? valeur / 100 : valeur);
  return (
    <Input
      type="number"
      min={0}
      step={champ === "montant" ? 1 : "any"}
      inputMode="decimal"
      value={affiche}
      aria-label={t(champ)}
      onChange={(evenement) => {
        const texte = evenement.target.value;
        const nombre = texte === "" ? null : Number(texte);
        if (nombre !== null && !Number.isFinite(nombre)) return;
        modifierLigne(ligne.cle, {
          [champ]: nombre === null ? null : champ === "montant" ? Math.round(nombre * 100) : nombre,
        });
      }}
      disabled={desactive}
      className="h-9 w-32 text-right tabular-nums"
    />
  );
}

function CelluleDate({ ligne, champ }: { ligne: LigneTableau; champ: "dateDebut" | "dateFin" }) {
  const t = useTranslations("decoupage.tableau");
  const { modifierLigne, desactive } = useGrille();
  return (
    <Input
      type="date"
      value={ligne[champ] ?? ""}
      aria-label={t(champ)}
      onChange={(evenement) => modifierLigne(ligne.cle, { [champ]: evenement.target.value || null })}
      disabled={desactive}
      className="h-9 w-40"
    />
  );
}

function CelluleActions({ ligne }: { ligne: LigneTableau }) {
  const t = useTranslations("decoupage.tableau");
  const { insererApres, retirerLigne, desactive } = useGrille();
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("insererLigne")}
        title={t("insererLigne")}
        onClick={() => insererApres(ligne.cle)}
        disabled={desactive}
      >
        <Plus />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("retirerLigne")}
        title={t("retirerLigne")}
        onClick={() => retirerLigne(ligne.cle)}
        disabled={desactive}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Le verdict du serveur.
 * ------------------------------------------------------------------ */

function Verdict({ verdict }: { verdict: VerdictTableau }) {
  const t = useTranslations("decoupage.tableau");
  const discrets = verdict.avertissements.filter((c) => c.discret);
  const avertissements = verdict.avertissements.filter((c) => !c.discret);

  return (
    <section className="flex flex-col gap-3" aria-live="polite">
      <p className="m-0 text-sm text-neutral-700">
        {t("apercu", {
          cases: verdict.apercu.cases,
          feuilles: verdict.apercu.feuilles,
          niveaux: verdict.apercu.niveaux,
        })}
      </p>
      {verdict.bloquants.length === 0 && verdict.avertissements.length === 0 && (
        <Alert variant="succes">
          <ListChecks />
          <AlertTitle>{t("verdictBon")}</AlertTitle>
        </Alert>
      )}
      {verdict.bloquants.length > 0 && (
        <Alert variant="erreur">
          <CircleAlert />
          <AlertTitle>{t("bloquants", { nombre: verdict.bloquants.length })}</AlertTitle>
          <AlertDescription>
            <ListeConstats constats={verdict.bloquants} />
          </AlertDescription>
        </Alert>
      )}
      {avertissements.length > 0 && (
        <Alert variant="avertissement">
          <TriangleAlert />
          <AlertTitle>{t("avertissements", { nombre: avertissements.length })}</AlertTitle>
          <AlertDescription>
            <ListeConstats constats={avertissements} />
          </AlertDescription>
        </Alert>
      )}
      {discrets.length > 0 && (
        <Alert variant="information">
          <CircleAlert />
          <AlertTitle>{t("coquilles", { nombre: discrets.length })}</AlertTitle>
          <AlertDescription>
            <ListeConstats constats={discrets} />
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}

function ListeConstats({ constats }: { constats: ConstatTableau[] }) {
  const t = useTranslations("decoupage.tableau");
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {constats.map((constat, rang) => (
        <li key={rang}>
          <span className="font-mono text-xs">{t(`regles.${regleConnue(constat.regle)}`)}</span>{" "}
          {constat.message}
        </li>
      ))}
    </ul>
  );
}

const REGLES = ["C-1", "C-2", "C-3", "C-4", "C-5", "C-6", "C-7", "SANS_EFFET"];

/** Une règle que l'écran ne connaît pas encore s'affiche sous un intitulé générique. */
function regleConnue(regle: string): string {
  return REGLES.includes(regle) ? regle.replace("-", "") : "AUTRE";
}

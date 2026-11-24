"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  TriangleAlert,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge, EtatChargement, EtatErreur } from "@/components/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import { budgetEnVigueur, sourcePlafondBudget } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";
import { telechargerCsv, versCsv } from "@/lib/export/csv";
import { formaterMontant } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  appliquerTableau,
  creerModele,
  importerFichier,
  lireTableauDemarrage,
  listerListes,
  listerModeles,
  refusTableau,
  telechargerModeleExcelProjet,
  verifierTableau,
} from "../adaptateur";
import {
  ajouterEnfantArbre,
  ajouterRacineArbre,
  aNoeudSansLibelle,
  arbreVersCellules,
  arbreVersLignes,
  indicesFeuillesParCle,
  lignesVersArbre,
  modifierNoeudArbre,
  retirerNoeudArbre,
  totalMontantArbre,
  type DonneesFeuilleSaisie,
  type NoeudArbreSaisie,
} from "../arbreSaisie";
import { CLE_LISTES, cleDecoupage, cleModeles, cleTableauDemarrage } from "../cles";
import { clePlanningGantt } from "@/features/planning/cles";
import { MAX_NIVEAUX, nettoyerLignesModele } from "../editeurModele";
import {
  COLONNES_FICHIER,
  constatsGeneraux,
  constatsParLigne,
  lignesFichier,
  niveauVide,
  tableauEstVide,
} from "../regles";
import type {
  ConstatTableau,
  ListeValeurs,
  ModeleApplique,
  NiveauGabarit,
  RefusTableau,
  TableauDemarrage as Tableau,
  VerdictTableau,
} from "../types";
import { ArbreSaisie, type LibellesArbreSaisie } from "./ArbreSaisie";

const SANS_LISTE = "aucune";
const MODELE_DEFAUT = "defaut";

/**
 * Le découpage initial d'un projet (décisions v1.2, §5 et §6 ; décision P4).
 *
 * Le projet est pré-rempli par le modèle de sa catégorie d'ouvrage. L'utilisateur édite
 * directement une **vue arborescente interactive** (ajout de racine et ajout d'enfant sous chaque
 * élément, saisie des feuilles avec unité, quantité, montant et dates), puis vérifie et applique
 * pour construire l'arbre du projet. L'import/export Excel/CSV et le réglage des niveaux restent
 * disponibles à tout moment.
 */
export function TableauDemarrage({ projet }: { projet: Projet }) {
  const [modele, setModele] = useState<Pick<ModeleApplique, "origine" | "id"> | null>(null);

  const requete = useQuery({
    queryKey: cleTableauDemarrage(projet.id, modele),
    queryFn: ({ signal }) => lireTableauDemarrage(projet.id, modele, signal),
    // La saisie en cours ne doit pas être écrasée par un rafraîchissement automatique.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  return (
    <EditeurTableau
      key={`${requete.data.modele?.origine ?? ""}-${requete.data.modele?.id ?? ""}`}
      projet={projet}
      initial={requete.data}
      onChangerModele={setModele}
    />
  );
}

/* ------------------------------------------------------------------ *
 * L'éditeur : l'état de l'arbre saisi, la vérification, l'application.
 * ------------------------------------------------------------------ */

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
  const { peutCode, peutSurProjet, voitMontants } = useDroits();
  const peutDecouper = peutSurProjet(PERMISSIONS.DECOUPER, projet);
  const peutGererModeles = peutCode(PERMISSIONS.MODELES_GERER);

  const [niveaux, setNiveaux] = useState<NiveauGabarit[]>(() => initial.niveaux);
  const [racines, setRacines] = useState<NoeudArbreSaisie[]>(() =>
    lignesVersArbre(initial.lignes),
  );
  const [modifie, setModifie] = useState(false);
  const [signalerVides, setSignalerVides] = useState(false);
  const [verdict, setVerdict] = useState<VerdictTableau | null>(null);
  const [refus, setRefus] = useState<RefusTableau | null>(null);
  const [modeleEnAttente, setModeleEnAttente] = useState<string | null>(null);
  const [modaleModeleOuverte, setModaleModeleOuverte] = useState(false);
  const [nomNouveauModele, setNomNouveauModele] = useState("");
  const [descriptionNouveauModele, setDescriptionNouveauModele] = useState("");
  const [parDefautCeType, setParDefautCeType] = useState(false);
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

  const tableauCourant = useMemo<Tableau>(
    () => ({
      modele: initial.modele,
      niveaux,
      lignes: arbreVersLignes(racines, niveaux.length),
    }),
    [initial.modele, niveaux, racines],
  );

  function marquerModifie() {
    setModifie(true);
    setVerdict(null);
  }

  const verification = useMutation({
    mutationFn: () => verifierTableau(projet.id, tableauCourant),
    onSuccess: setVerdict,
    onError: (erreur) => toast.error(messageErreur(erreur, t("erreurVerification"))),
  });

  const importation = useMutation({
    mutationFn: (choisi: File) => importerFichier(projet.id, choisi),
    onSuccess: (importe) => {
      setNiveaux(importe.niveaux);
      setRacines(lignesVersArbre(importe.lignes));
      setModifie(true);
      setSignalerVides(false);
      setVerdict(importe.verification);
      toast.success(t("importReussi", { lignes: importe.lignes.length }));
    },
    onError: (erreur) => toast.error(messageErreur(erreur, t("erreurImport"))),
  });

  const telechargementModeleExcel = useMutation({
    mutationFn: async () => {
      const blob = await telechargerModeleExcelProjet(projet.id, initial.modele);
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `modele-decoupage-${projet.reference || projet.id}.xlsx`;
      lien.click();
      URL.revokeObjectURL(url);
    },
    onError: (erreur) => toast.error(messageErreur(erreur, t("erreurImport"))),
  });

  const sauvegardeModele = useMutation({
    mutationFn: async () => {
      const lignesPropres = nettoyerLignesModele(
        arbreVersCellules(racines, niveaux.length),
        niveaux.length,
      );
      return creerModele({
        nom: nomNouveauModele,
        description: descriptionNouveauModele,
        typesProjet: projet.typeProjet ? [projet.typeProjet] : [],
        parDefautPour: parDefautCeType && projet.typeProjet ? [projet.typeProjet] : [],
        niveaux,
        lignes: lignesPropres,
      });
    },
    onSuccess: (cree) => {
      setModaleModeleOuverte(false);
      setNomNouveauModele("");
      setDescriptionNouveauModele("");
      setParDefautCeType(false);
      toast.success(t("modeleEnregistre", { nom: cree.nomAffiche }));
      void client.invalidateQueries({ queryKey: ["decoupage", "modeles"] });
      void client.invalidateQueries({ queryKey: ["projets"] });
      onChangerModele({ origine: cree.origine, id: cree.id });
    },
    onError: (erreur) => toast.error(messageErreur(erreur, t("erreurApplication"))),
  });

  const application = useMutation({
    mutationFn: (confirmer: boolean) => appliquerTableau(projet.id, tableauCourant, confirmer),
    onSuccess: async (resultat) => {
      setRefus(null);
      toast.success(t("applique", { cases: resultat.casesCreees }));
      // Le projet porte `decoupageCree` : le relire fait basculer l'onglet sur l'arbre.
      await client.invalidateQueries({ queryKey: ["projets", projet.id] });
      await client.invalidateQueries({ queryKey: cleDecoupage(projet.id) });
      await client.invalidateQueries({ queryKey: clePlanningGantt(projet.id) });
    },
    onError: (erreur) => {
      const refusServeur = refusTableau(erreur);
      if (refusServeur) {
        setVerdict((courant) => ({
          bloquants: refusServeur.bloquants,
          avertissements: refusServeur.avertissements,
          apercu: courant?.apercu ?? { cases: 0, feuilles: 0, niveaux: niveaux.length },
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
      ...niveaux.map((niveau, rang) => niveau.libelle || t("niveauSansNom", { rang: rang + 1 })),
      ...colonnes.map((colonne) => t(`colonnesFichier.${colonne}`)),
    ];
    telechargerCsv(
      versCsv([entetes, ...lignesFichier(tableauCourant, colonnes, (unite) => tUnite(unite))]),
      `decoupage-${projet.reference || projet.id}`,
    );
  }

  function ajouterRacine(): string {
    const { racines: suivantes, cleCreee } = ajouterRacineArbre(racines);
    setRacines(suivantes);
    marquerModifie();
    return cleCreee;
  }

  function ajouterEnfant(parentCle: string): string {
    const { racines: suivantes, cleCreee } = ajouterEnfantArbre(racines, parentCle);
    setRacines(suivantes);
    marquerModifie();
    return cleCreee;
  }

  function modifierLibelleNoeud(cle: string, libelle: string) {
    setRacines((courant) => modifierNoeudArbre(courant, cle, (n) => ({ ...n, libelle })));
    marquerModifie();
  }

  function modifierFeuilleNoeud(cle: string, modification: Partial<DonneesFeuilleSaisie>) {
    setRacines((courant) =>
      modifierNoeudArbre(courant, cle, (n) => ({
        ...n,
        feuille: { ...n.feuille, ...modification },
      })),
    );
    marquerModifie();
  }

  function retirerNoeud(cle: string) {
    setRacines((courant) => retirerNoeudArbre(courant, cle));
    marquerModifie();
  }

  function retirerNiveauIndex(index: number) {
    if (niveaux.length <= 1) return;
    const lignesAplaties = arbreVersLignes(racines, niveaux.length);
    setNiveaux((courant) => courant.filter((_, rang) => rang !== index));
    setRacines(
      lignesVersArbre(
        lignesAplaties.map((ligne) => ({
          ...ligne,
          cellules: ligne.cellules.filter((_, rang) => rang !== index),
        })),
      ),
    );
    marquerModifie();
  }

  function deplacerNiveauIndex(index: number, sens: -1 | 1) {
    const cible = index + sens;
    if (cible < 0 || cible >= niveaux.length) return;
    const lignesAplaties = arbreVersLignes(racines, niveaux.length);
    setNiveaux((courant) => {
      const copie = [...courant];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
    setRacines(
      lignesVersArbre(
        lignesAplaties.map((ligne) => {
          const copie = [...ligne.cellules];
          [copie[index], copie[cible]] = [copie[cible], copie[index]];
          return { ...ligne, cellules: copie };
        }),
      ),
    );
    marquerModifie();
  }

  function lancerVerification() {
    if (aNoeudSansLibelle(racines)) {
      setSignalerVides(true);
      toast.error(t("intituleNoeudRequis"));
      return;
    }
    setSignalerVides(false);
    verification.mutate();
  }

  function lancerApplication() {
    if (aNoeudSansLibelle(racines)) {
      setSignalerVides(true);
      toast.error(t("intituleNoeudRequis"));
      return;
    }
    setSignalerVides(false);
    application.mutate(false);
  }

  const constats = useMemo(
    () => constatsParLigne([...(verdict?.bloquants ?? []), ...(verdict?.avertissements ?? [])]),
    [verdict],
  );
  const bloquantes = useMemo(
    () => new Set((verdict?.bloquants ?? []).map((c) => c.ligne).filter((n): n is number => n !== null)),
    [verdict],
  );
  const indicesParCle = useMemo(() => indicesFeuillesParCle(racines), [racines]);

  const constatsParCle = useMemo(() => {
    const carte = new Map<string, ConstatTableau[]>();
    for (const [cle, num] of indicesParCle.entries()) {
      const liste = constats.get(num);
      if (liste && liste.length > 0) carte.set(cle, liste);
    }
    return carte;
  }, [indicesParCle, constats]);

  const bloquantesCles = useMemo(() => {
    const ensemble = new Set<string>();
    for (const [cle, num] of indicesParCle.entries()) {
      if (bloquantes.has(num)) ensemble.add(cle);
    }
    return ensemble;
  }, [indicesParCle, bloquantes]);

  const libellesArbre = useMemo<LibellesArbreSaisie>(
    () => ({
      ajouterRacine: (niv) => t("ajouterRacine", { niveau: niv }),
      ajouterEnfant: (niv) => t("ajouterEnfant", { niveau: niv }),
      retirerNoeud: t("retirerLigne"),
      deplier: t("deplier"),
      replier: t("replier"),
      toutDeplier: t("toutDeplier"),
      toutReplier: t("toutReplier"),
      videTitre: t("arbreVideTitre"),
      videAide: t("arbreVideAide"),
      niveauRang: (rang) => t("niveauSansNom", { rang }),
      placeholderIntitule: (niv) => t("placeholderIntitule", { niveau: niv }),
      saisirOuChoisir: t("saisirOuChoisir"),
      listeValeurs: t("listeValeurs"),
      rechercherValeur: t("rechercherValeur"),
      aucuneValeur: t("aucuneValeur"),
      resumeFeuilles: (n) => t("resumeFeuilles", { n }),
      unite: t("unite"),
      sansUnite: t("sansUnite"),
      libelleUnite: (u) => tUnite(u),
      quantite: t("quantite"),
      montant: t("montant"),
      montantPlaceholder: t("montantPlaceholder"),
      dateDebut: t("dateDebut"),
      dateFin: t("dateFin"),
      choisirDate: t("choisirDate"),
      periode: (debut, fin) => t("periode", { debut, fin }),
    }),
    [t, tUnite],
  );

  const valeurModele = initial.modele ? `${initial.modele.origine}:${initial.modele.id}` : MODELE_DEFAUT;
  const vide = racines.length === 0 || tableauEstVide(tableauCourant);
  const tousLesModeles = useMemo(() => requeteModeles.data ?? [], [requeteModeles.data]);
  const modelesEntreprise = useMemo(
    () => tousLesModeles.filter((m) => m.origine === "ENTREPRISE"),
    [tousLesModeles],
  );
  const modelesPlateforme = useMemo(
    () => tousLesModeles.filter((m) => m.origine === "PLATEFORME"),
    [tousLesModeles],
  );
  const modeleInitialPresent = useMemo(
    () =>
      !initial.modele ||
      tousLesModeles.some(
        (m) => m.origine === initial.modele?.origine && m.id === initial.modele?.id,
      ),
    [initial.modele, tousLesModeles],
  );
  const totalMontantSaisi = useMemo(() => totalMontantArbre(racines), [racines]);
  const plafondBudget = budgetEnVigueur(projet);
  const sourcePlafond = sourcePlafondBudget(projet);
  const ecartBudget =
    plafondBudget !== null && plafondBudget > 0 && totalMontantSaisi > plafondBudget
      ? totalMontantSaisi - plafondBudget
      : 0;

  return (
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
                {initial.modele && !modeleInitialPresent && (
                  <SelectItem value={valeurModele}>{initial.modele.nom}</SelectItem>
                )}
                {modelesEntreprise.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>{t("groupeModelesEntreprise")}</SelectLabel>
                    {modelesEntreprise.map((m) => (
                      <SelectItem key={`${m.origine}:${m.id}`} value={`${m.origine}:${m.id}`}>
                        {m.nomAffiche}
                        {m.niveaux.length > 0 ? t("niveauxModele", { niveaux: m.niveaux.join(" → ") }) : ""}
                        {m.parDefaut
                          ? ` — ${t("modeleParDefaut")}`
                          : m.pourCeType
                            ? ` — ${t("modelePourCeType")}`
                            : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {modelesEntreprise.length > 0 && modelesPlateforme.length > 0 && (
                  <SelectSeparator />
                )}
                {modelesPlateforme.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>{t("groupeModelesPlateforme")}</SelectLabel>
                    {modelesPlateforme.map((m) => (
                      <SelectItem key={`${m.origine}:${m.id}`} value={`${m.origine}:${m.id}`}>
                        {m.nomAffiche}
                        {m.niveaux.length > 0 ? t("niveauxModele", { niveaux: m.niveaux.join(" → ") }) : ""}
                        {m.parDefaut
                          ? ` — ${t("modeleParDefaut")}`
                          : m.pourCeType
                            ? ` — ${t("modelePourCeType")}`
                            : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => telechargementModeleExcel.mutate()}
              disabled={enCours || telechargementModeleExcel.isPending}
            >
              {telechargementModeleExcel.isPending ? <LoaderCircle className="animate-spin" /> : <Download />}
              {t("telechargerModeleExcel")}
            </Button>
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
        niveaux={niveaux}
        listes={listes}
        desactive={enCours}
        onModifier={(index, niveau) => {
          setNiveaux((courant) =>
            courant.map((n, rang) => (rang === index ? { ...n, ...niveau } : n)),
          );
          marquerModifie();
        }}
        onAjouter={() => {
          if (niveaux.length >= MAX_NIVEAUX) return;
          setNiveaux((courant) => [...courant, niveauVide()]);
          marquerModifie();
        }}
        onRetirer={retirerNiveauIndex}
        onDeplacer={deplacerNiveauIndex}
        constats={constatsGeneraux(verdict?.bloquants ?? [])}
      />

      <section className="flex flex-col gap-3 rounded-xl border border-solid border-neutral-200 bg-neutral-0 p-4 shadow-sm sm:p-5">
        <ArbreSaisie
          racines={racines}
          niveaux={niveaux}
          listes={listes}
          desactive={enCours}
          afficherDonneesFeuille
          voitMontants={voitMontants}
          constatsParCle={constatsParCle}
          bloquantesCles={bloquantesCles}
          signalerIntitulesVides={signalerVides}
          onAjouterRacine={ajouterRacine}
          onAjouterEnfant={ajouterEnfant}
          onModifierLibelle={modifierLibelleNoeud}
          onModifierFeuille={modifierFeuilleNoeud}
          onRetirerNoeud={retirerNoeud}
          libelles={libellesArbre}
        />
      </section>

      {voitMontants && ecartBudget > 0 && plafondBudget !== null && sourcePlafond !== null && (
        <Alert variant="avertissement">
          <TriangleAlert />
          <AlertDescription>
            {t(
              sourcePlafond === "CONTRACTUEL"
                ? "alerteDepassementContractuel"
                : "alerteDepassementPrevisionnel",
              {
                decoupage: formaterMontant(totalMontantSaisi),
                plafond: formaterMontant(plafondBudget),
                ecart: formaterMontant(ecartBudget),
              },
            )}
          </AlertDescription>
        </Alert>
      )}

      {verdict && <Verdict verdict={verdict} />}

      <div className="flex flex-wrap items-center justify-end gap-3 border-0 border-t border-solid border-neutral-200 pt-4">
        {peutGererModeles && (
          <Button
            variant="outline"
            onClick={() => setModaleModeleOuverte(true)}
            disabled={enCours || vide || niveaux.length === 0}
          >
            {t("enregistrerCommeModele")}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={lancerVerification}
          disabled={enCours || niveaux.length === 0}
        >
          {verification.isPending ? <LoaderCircle className="animate-spin" /> : <ListChecks />}
          {t("verifier")}
        </Button>
        <BoutonPermis
          permis={peutDecouper}
          permission={PERMISSIONS.DECOUPER}
          onClick={lancerApplication}
          disabled={enCours || vide || niveaux.length === 0}
        >
          {application.isPending ? <LoaderCircle className="animate-spin" /> : <Rows3 />}
          {t("appliquer")}
        </BoutonPermis>
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

      <Dialog
        open={modaleModeleOuverte}
        onOpenChange={(ouvert) => !ouvert && !sauvegardeModele.isPending && setModaleModeleOuverte(false)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("enregistrerCommeModeleTitre")}</DialogTitle>
            <DialogDescription>{t("enregistrerCommeModeleDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-800">
              {t("nomModele")}
              <Input
                value={nomNouveauModele}
                maxLength={150}
                placeholder={t("placeholderNomModele")}
                disabled={sauvegardeModele.isPending}
                onChange={(e) => setNomNouveauModele(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-800">
              {t("descriptionModele")}
              <Input
                value={descriptionNouveauModele}
                maxLength={300}
                placeholder={t("placeholderDescriptionModele")}
                disabled={sauvegardeModele.isPending}
                onChange={(e) => setDescriptionNouveauModele(e.target.value)}
              />
            </label>
            {projet.typeProjet && (
              <label className="flex items-center gap-2 text-xs text-neutral-700">
                <Checkbox
                  checked={parDefautCeType}
                  disabled={sauvegardeModele.isPending}
                  onCheckedChange={(v) => setParDefautCeType(v === true)}
                />
                <span>{t("parDefautPourCeType")}</span>
              </label>
            )}
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              disabled={sauvegardeModele.isPending}
              onClick={() => setModaleModeleOuverte(false)}
            >
              {t("garderSaisie")}
            </Button>
            <Button
              disabled={!nomNouveauModele.trim() || sauvegardeModele.isPending}
              onClick={() => sauvegardeModele.mutate()}
            >
              {sauvegardeModele.isPending && <LoaderCircle className="animate-spin" />}
              {t("confirmerEnregistrerModele")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
        <Button
          variant="outline"
          size="sm"
          onClick={onAjouter}
          disabled={desactive || niveaux.length >= MAX_NIVEAUX}
        >
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

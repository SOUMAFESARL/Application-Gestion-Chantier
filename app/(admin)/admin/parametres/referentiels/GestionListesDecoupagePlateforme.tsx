"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileUp,
  ListChecks,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Alerte, Badge, Bouton, Champ, EtatChargement, EtatErreur, EtatVide, Modale } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { MenuExport, type ExportTableau } from "@/components/ui/export-tableau";
import { Input } from "@/components/ui/input";
import { FiltreTableau, RechercheTableau } from "@/components/ui/tableau-liste";
import { Textarea } from "@/components/ui/textarea";
import {
  CRITERES_LISTES_DECOUPAGE_VIDES,
  criteresListesDecoupageActifs,
  filtrerListesDecoupagePlateforme,
  peutParametrerPlateforme,
  totalUtilisationsListePlateforme,
  type CriteresListesDecoupagePlateforme,
  type FiltreStatutDecoupagePlateforme,
  type ListeDecoupagePlateforme,
  type ValeurListeDecoupagePlateforme,
} from "@/features/administration";
import {
  activerListeDecoupagePlateforme,
  ajouterValeursListePlateforme,
  creerListeDecoupagePlateforme,
  desactiverListeDecoupagePlateforme,
  importerValeursListePlateforme,
  listerListesDecoupagePlateforme,
  modifierListeDecoupagePlateforme,
  modifierValeurListePlateforme,
  supprimerListeDecoupagePlateforme,
  supprimerValeurListePlateforme,
  telechargerModeleExcelListePlateforme,
} from "@/features/administration/adaptateur";
import { telechargerBlob } from "@/features/decoupage/editeurModele";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";

const LONGUEUR_MAX_GROUPE = 100;

/**
 * Gestion des listes de valeurs de découpage de la plateforme (`/admin/parametres/referentiels/listes`).
 *
 * Ces listes et leurs valeurs sont proposées à toutes les entreprises clientes pour
 * garnir n'importe quel niveau d'un modèle ou d'un projet.
 */
export function GestionListesDecoupagePlateforme() {
  const t = useTranslations("administration.parametres.listesDecoupage");
  const profil = useAdministrateur();
  const cache = useQueryClient();
  const peutAgir = peutParametrerPlateforme(profil);
  const cle = CLES_ADMINISTRATION.listesDecoupage();

  const requete = useQuery({
    queryKey: cle,
    queryFn: ({ signal }) => listerListesDecoupagePlateforme(signal),
  });

  const listes = useMemo(() => requete.data ?? [], [requete.data]);

  const [criteres, setCriteres] = useState<CriteresListesDecoupagePlateforme>(
    CRITERES_LISTES_DECOUPAGE_VIDES,
  );
  const filtresActifs = criteresListesDecoupageActifs(criteres);

  const listesFiltrees = useMemo(
    () => filtrerListesDecoupagePlateforme(listes, criteres),
    [listes, criteres],
  );

  const [idChoisi, setIdChoisi] = useState<string | null>(null);
  const [rechercheValeur, setRechercheValeur] = useState("");
  const [saisieValeur, setSaisieValeur] = useState("");
  const [groupeValeur, setGroupeValeur] = useState("");
  const [erreurValeur, setErreurValeur] = useState<string | null>(null);

  const [modaleListe, setModaleListe] = useState<
    | { mode: "creer" }
    | { mode: "modifier"; liste: ListeDecoupagePlateforme }
    | null
  >(null);
  const [libelleListe, setLibelleListe] = useState("");
  const [descriptionListe, setDescriptionListe] = useState("");
  const [estActifListe, setEstActifListe] = useState(true);
  const [valeursInitiales, setValeursInitiales] = useState("");
  const [erreurModaleListe, setErreurModaleListe] = useState<string | null>(null);

  const [modaleValeur, setModaleValeur] = useState<ValeurListeDecoupagePlateforme | null>(null);
  const [libelleValeurModif, setLibelleValeurModif] = useState("");
  const [groupeValeurModif, setGroupeValeurModif] = useState("");
  const [erreurModaleValeur, setErreurModaleValeur] = useState<string | null>(null);

  const [listeASupprimer, setListeASupprimer] = useState<ListeDecoupagePlateforme | null>(null);
  const [erreurSuppressionListe, setErreurSuppressionListe] = useState<string | null>(null);
  const [valeurASupprimer, setValeurASupprimer] = useState<ValeurListeDecoupagePlateforme | null>(null);

  const champFichierRef = useRef<HTMLInputElement | null>(null);

  const listeActive = useMemo<ListeDecoupagePlateforme | null>(() => {
    if (listes.length === 0) return null;
    if (idChoisi) {
      const dansFiltre = listesFiltrees.find((l) => l.id === idChoisi);
      if (dansFiltre) return dansFiltre;
    }
    if (listesFiltrees[0]) return listesFiltrees[0];
    if (idChoisi) {
      const trouvee = listes.find((l) => l.id === idChoisi);
      if (trouvee) return trouvee;
    }
    return listes[0] ?? null;
  }, [listes, listesFiltrees, idChoisi]);

  const groupesPresents = useMemo<OptionCombobox[]>(() => {
    if (!listeActive) return [{ valeur: "", libelle: t("groupeAucun") }];
    const distincts = [...new Set(listeActive.valeurs.map((v) => v.groupe).filter(Boolean))];
    return [
      { valeur: "", libelle: t("groupeAucun") },
      ...distincts.map((valeur) => ({ valeur, libelle: valeur })),
    ];
  }, [listeActive, t]);

  const valeursFiltrees = useMemo<ValeurListeDecoupagePlateforme[]>(() => {
    if (!listeActive) return [];
    const terme = rechercheValeur.trim().toLowerCase();
    if (!terme) return listeActive.valeurs;
    return listeActive.valeurs.filter((v) =>
      `${v.libelle} ${v.groupe}`.toLowerCase().includes(terme),
    );
  }, [listeActive, rechercheValeur]);

  const exporter = useMemo<ExportTableau<ListeDecoupagePlateforme>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        { entete: t("export.colonneLibelle"), valeur: (l) => l.libelle },
        { entete: t("export.colonneDescription"), valeur: (l) => l.description },
        {
          entete: t("export.colonneStatut"),
          valeur: (l) => (l.estActif ? t("badgeActif") : t("badgeInactif")),
        },
        { entete: t("export.colonneValeurs"), valeur: (l) => l.nombreValeurs },
        {
          entete: t("export.colonneUtilisationsPlateforme"),
          valeur: (l) => l.nombreUtilisationsPlateforme,
        },
        {
          entete: t("export.colonneUtilisationsEntreprises"),
          valeur: (l) => l.nombreUtilisationsEntreprises,
        },
      ],
    }),
    [t],
  );

  function messageErreur(cause: unknown): string {
    return cause instanceof ErreurApi && cause.message ? cause.message : t("erreur");
  }

  function ouvrirCreationListe() {
    setLibelleListe("");
    setDescriptionListe("");
    setEstActifListe(true);
    setValeursInitiales("");
    setErreurModaleListe(null);
    setModaleListe({ mode: "creer" });
  }

  function ouvrirModificationListe(liste: ListeDecoupagePlateforme) {
    setLibelleListe(liste.libelle);
    setDescriptionListe(liste.description);
    setEstActifListe(liste.estActif);
    setValeursInitiales("");
    setErreurModaleListe(null);
    setModaleListe({ mode: "modifier", liste });
  }

  function ouvrirSuppressionListe(liste: ListeDecoupagePlateforme) {
    setErreurSuppressionListe(null);
    setListeASupprimer(liste);
  }

  function ouvrirModificationValeur(valeur: ValeurListeDecoupagePlateforme) {
    setLibelleValeurModif(valeur.libelle);
    setGroupeValeurModif(valeur.groupe);
    setErreurModaleValeur(null);
    setModaleValeur(valeur);
  }

  const enregistrementListe = useMutation({
    mutationFn: async () => {
      if (!modaleListe) return null;
      if (modaleListe.mode === "creer") {
        const valeurs = valeursInitiales
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        return creerListeDecoupagePlateforme({
          libelle: libelleListe,
          description: descriptionListe,
          valeurs,
        });
      }
      return modifierListeDecoupagePlateforme(modaleListe.liste.id, {
        libelle: libelleListe.trim(),
        description: descriptionListe.trim(),
        estActif: estActifListe,
      });
    },
    onSuccess: (creeeOuModifiee) => {
      const etaitCreation = modaleListe?.mode === "creer";
      setModaleListe(null);
      setErreurModaleListe(null);
      if (creeeOuModifiee) {
        setIdChoisi(creeeOuModifiee.id);
      }
      toast.success(etaitCreation ? t("succesCreationListe") : t("succesModificationListe"));
      void cache.invalidateQueries({ queryKey: cle });
    },
    onError: (cause) => setErreurModaleListe(messageErreur(cause)),
  });

  const basculeStatutListe = useMutation({
    mutationFn: (cible: ListeDecoupagePlateforme) =>
      cible.estActif
        ? desactiverListeDecoupagePlateforme(cible.id)
        : activerListeDecoupagePlateforme(cible.id),
    onSuccess: (miseAJour) => {
      toast.success(
        miseAJour.estActif ? t("succesActivationListe") : t("succesDesactivationListe"),
      );
      setListeASupprimer(null);
      setErreurSuppressionListe(null);
      void cache.invalidateQueries({ queryKey: cle });
    },
    onError: (cause) => toast.error(messageErreur(cause)),
  });

  const suppressionListe = useMutation({
    mutationFn: (liste: ListeDecoupagePlateforme) => supprimerListeDecoupagePlateforme(liste.id),
    onSuccess: () => {
      setListeASupprimer(null);
      setErreurSuppressionListe(null);
      setIdChoisi(null);
      toast.success(t("succesSuppressionListe"));
      void cache.invalidateQueries({ queryKey: cle });
    },
    onError: (cause) => {
      setErreurSuppressionListe(messageErreur(cause));
    },
  });

  const ajoutValeur = useMutation({
    mutationFn: async (cible: ListeDecoupagePlateforme) => {
      const valeurs = saisieValeur
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter(Boolean);
      return ajouterValeursListePlateforme(cible.id, {
        valeurs,
        groupe: groupeValeur,
      });
    },
    onSuccess: (resultat) => {
      setSaisieValeur("");
      setGroupeValeur("");
      setErreurValeur(null);
      toast.success(
        t("succesAjoutValeurs", {
          ajoutees: resultat.ajoutees.length,
          ignorees: resultat.ignorees.length,
        }),
      );
      void cache.invalidateQueries({ queryKey: cle });
    },
    onError: (cause) => setErreurValeur(messageErreur(cause)),
  });

  const importFichier = useMutation({
    mutationFn: async ({ cible, fichier }: { cible: ListeDecoupagePlateforme; fichier: File }) => {
      return importerValeursListePlateforme(cible.id, fichier);
    },
    onSuccess: (resultat) => {
      setErreurValeur(null);
      toast.success(
        t("succesImportValeurs", {
          ajoutees: resultat.ajoutees.length,
          ignorees: resultat.ignorees.length,
        }),
      );
      void cache.invalidateQueries({ queryKey: cle });
    },
    onError: (cause) => setErreurValeur(messageErreur(cause)),
  });

  const telechargementModele = useMutation({
    mutationFn: async () => {
      const blob = await telechargerModeleExcelListePlateforme();
      telechargerBlob(blob, "modele-import-liste-valeurs.xlsx");
    },
    onError: (cause) => toast.error(messageErreur(cause)),
  });

  const modificationValeur = useMutation({
    mutationFn: async () => {
      if (!modaleValeur) return null;
      return modifierValeurListePlateforme(modaleValeur.id, {
        libelle: libelleValeurModif.trim(),
        groupe: groupeValeurModif.trim(),
      });
    },
    onSuccess: () => {
      setModaleValeur(null);
      setErreurModaleValeur(null);
      toast.success(t("succesModificationValeur"));
      void cache.invalidateQueries({ queryKey: cle });
    },
    onError: (cause) => setErreurModaleValeur(messageErreur(cause)),
  });

  const suppressionValeur = useMutation({
    mutationFn: (valeur: ValeurListeDecoupagePlateforme) => supprimerValeurListePlateforme(valeur.id),
    onSuccess: () => {
      setValeurASupprimer(null);
      toast.success(t("succesSuppressionValeur"));
      void cache.invalidateQueries({ queryKey: cle });
    },
    onError: (cause) => {
      setValeurASupprimer(null);
      toast.error(messageErreur(cause));
    },
  });

  const nbUtilisationsListeASupprimer = listeASupprimer
    ? totalUtilisationsListePlateforme(listeASupprimer)
    : 0;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{t("titre")}</h2>
          <p className="text-sm text-neutral-600">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MenuExport exporter={exporter} lignes={listesFiltrees} />
          {peutAgir && (
            <Bouton
              taille="sm"
              iconeGauche={<Plus size={16} />}
              onClick={ouvrirCreationListe}
            >
              {t("nouvelleListe")}
            </Bouton>
          )}
        </div>
      </div>

      {/* Barre de recherche et filtre statut */}
      {listes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
          <RechercheTableau
            valeur={criteres.recherche}
            onChangement={(recherche) => setCriteres((courant) => ({ ...courant, recherche }))}
            libelle={t("rechercherListe")}
            placeholder={t("rechercherListePlaceholder")}
          />
          <FiltreTableau<Exclude<FiltreStatutDecoupagePlateforme, "">>
            valeur={criteres.statut}
            onChangement={(statut) => setCriteres((courant) => ({ ...courant, statut }))}
            libelle={t("filtreStatut")}
            libelleTous={t("filtreStatutToutes")}
            options={[
              { valeur: "ACTIF", libelle: t("filtreStatutActives") },
              { valeur: "INACTIF", libelle: t("filtreStatutInactives") },
            ]}
          />
          {filtresActifs && (
            <Bouton
              variante="ghost"
              taille="sm"
              onClick={() => setCriteres(CRITERES_LISTES_DECOUPAGE_VIDES)}
            >
              {t("reinitialiserFiltres")}
            </Bouton>
          )}
        </div>
      )}

      {requete.isPending ? (
        <EtatChargement />
      ) : requete.isError ? (
        <EtatErreur onReessayer={() => void requete.refetch()} />
      ) : listes.length === 0 ? (
        <EtatVide titre={t("aucuneListe")} description={t("aucuneListeDescription")} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Colonne gauche : catalogue des listes plateforme */}
          <div className="flex flex-col gap-2 lg:col-span-4">
            <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              {t("catalogueListes", { n: listesFiltrees.length })}
            </span>
            {listesFiltrees.length === 0 ? (
              <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center text-xs text-neutral-500">
                {t("aucuneListeFiltre")}
              </p>
            ) : (
              <ul className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto pr-1">
                {listesFiltrees.map((liste) => {
                  const estSelectionnee = listeActive?.id === liste.id;
                  return (
                    <li key={liste.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setIdChoisi(liste.id);
                          setErreurValeur(null);
                        }}
                        className={cn(
                          "flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                          estSelectionnee
                            ? "border-primary-600 bg-primary-50/50"
                            : "border-neutral-200 bg-neutral-0 hover:bg-neutral-50",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-neutral-900">
                            {liste.libelle}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge variante={liste.estActif ? "succes" : "neutre"}>
                              {liste.estActif ? t("badgeActif") : t("badgeInactif")}
                            </Badge>
                            <Badge variante="neutre">
                              {t("nbValeursCourt", { n: liste.nombreValeurs })}
                            </Badge>
                          </div>
                        </div>
                        {liste.description && (
                          <p className="line-clamp-2 text-xs text-neutral-600">
                            {liste.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                          <span>
                            {t("compteurUtilisations", {
                              plateforme: liste.nombreUtilisationsPlateforme,
                              entreprises: liste.nombreUtilisationsEntreprises,
                            })}
                          </span>
                        </div>
                        {liste.modeles.length > 0 && (
                          <p className="truncate text-xs text-primary-700">
                            {t("utiliseeParModeles", {
                              modeles: liste.modeles.map((m) => m.nom).join(", "),
                            })}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Colonne droite : valeurs de la liste sélectionnée */}
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4 lg:col-span-8">
            {listeActive ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ListChecks className="size-4 text-primary-700" aria-hidden="true" />
                      <h3 className="text-base font-semibold text-neutral-900">
                        {listeActive.libelle}
                      </h3>
                      <Badge variante={listeActive.estActif ? "succes" : "neutre"}>
                        {listeActive.estActif ? t("badgeActif") : t("badgeInactif")}
                      </Badge>
                      <Badge variante="neutre">
                        {t("nbValeursCourt", { n: listeActive.nombreValeurs })}
                      </Badge>
                      <Badge variante="information">
                        {t("compteurUtilisations", {
                          plateforme: listeActive.nombreUtilisationsPlateforme,
                          entreprises: listeActive.nombreUtilisationsEntreprises,
                        })}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-neutral-600">
                      {listeActive.description || t("aideListePlateforme")}
                    </p>
                    {listeActive.modeles.length > 0 && (
                      <p className="mt-1 text-xs text-primary-700">
                        {t("utiliseeParModeles", {
                          modeles: listeActive.modeles.map((m) => m.nom).join(", "),
                        })}
                      </p>
                    )}
                  </div>
                  {peutAgir && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Bouton
                        variante="secondaire"
                        taille="sm"
                        iconeGauche={
                          listeActive.estActif ? <PowerOff size={15} /> : <Power size={15} />
                        }
                        enCours={basculeStatutListe.isPending}
                        disabled={basculeStatutListe.isPending}
                        onClick={() => basculeStatutListe.mutate(listeActive)}
                      >
                        {listeActive.estActif ? t("desactiverListe") : t("activerListe")}
                      </Bouton>
                      <Bouton
                        variante="ghost"
                        taille="sm"
                        iconeGauche={<Pencil size={15} />}
                        onClick={() => ouvrirModificationListe(listeActive)}
                      >
                        {t("modifierListe")}
                      </Bouton>
                      <Bouton
                        variante="ghost"
                        taille="sm"
                        className="text-erreur"
                        iconeGauche={<Trash2 size={15} />}
                        onClick={() => ouvrirSuppressionListe(listeActive)}
                      >
                        {t("supprimerListe")}
                      </Bouton>
                    </div>
                  )}
                </div>

                {peutAgir && (
                  <form
                    className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-0 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (saisieValeur.trim()) ajoutValeur.mutate(listeActive);
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-neutral-800">
                          {t("champNouvelleValeur")}
                        </label>
                        <Input
                          value={saisieValeur}
                          maxLength={200}
                          placeholder={t("placeholderNouvelleValeur")}
                          disabled={ajoutValeur.isPending}
                          onChange={(e) => setSaisieValeur(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-neutral-800">
                          {t("champGroupe")}
                        </span>
                        <Combobox
                          options={groupesPresents}
                          valeur={groupeValeur}
                          onChange={(v) => setGroupeValeur(v.slice(0, LONGUEUR_MAX_GROUPE))}
                          placeholder={t("placeholderGroupe")}
                          placeholderRecherche={t("rechercherGroupe")}
                          aucunResultat={t("aucunGroupe")}
                          libelleSaisieLibre={(saisie) => t("creerGroupe", { saisie })}
                          aria-label={t("champGroupe")}
                          className="h-[var(--input-height-md)]"
                          disabled={ajoutValeur.isPending}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Bouton
                        type="submit"
                        taille="sm"
                        iconeGauche={<Plus size={16} />}
                        disabled={!saisieValeur.trim() || ajoutValeur.isPending}
                        enCours={ajoutValeur.isPending}
                      >
                        {t("ajouterValeur")}
                      </Bouton>

                      <div className="flex flex-wrap items-center gap-2">
                        <Bouton
                          type="button"
                          variante="secondaire"
                          taille="sm"
                          iconeGauche={<Download size={15} />}
                          enCours={telechargementModele.isPending}
                          disabled={telechargementModele.isPending}
                          onClick={() => telechargementModele.mutate()}
                        >
                          {t("telechargerModeleExcel")}
                        </Bouton>
                        <input
                          ref={champFichierRef}
                          type="file"
                          accept=".xlsx,.csv"
                          className="hidden"
                          onChange={(e) => {
                            const fichier = e.target.files?.[0];
                            e.target.value = "";
                            if (fichier) importFichier.mutate({ cible: listeActive, fichier });
                          }}
                        />
                        <Bouton
                          type="button"
                          variante="secondaire"
                          taille="sm"
                          iconeGauche={<FileUp size={15} />}
                          enCours={importFichier.isPending}
                          disabled={importFichier.isPending}
                          onClick={() => champFichierRef.current?.click()}
                        >
                          {t("importerExcel")}
                        </Bouton>
                      </div>
                    </div>
                  </form>
                )}

                {erreurValeur && <Alerte type="erreur">{erreurValeur}</Alerte>}

                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
                    aria-hidden="true"
                  />
                  <Input
                    value={rechercheValeur}
                    placeholder={t("rechercherValeur")}
                    aria-label={t("rechercherValeur")}
                    className="pl-9"
                    onChange={(e) => setRechercheValeur(e.target.value)}
                  />
                </div>

                {valeursFiltrees.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-500">
                    {rechercheValeur.trim() ? t("aucuneValeurRecherche") : t("aucuneValeurDansListe")}
                  </p>
                ) : (
                  <ul className="flex max-h-80 flex-col divide-y divide-neutral-200/70 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-0 px-3">
                    {valeursFiltrees.map((valeur) => (
                      <li key={valeur.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-900">
                            {valeur.libelle}
                          </p>
                          {valeur.groupe && (
                            <p className="truncate text-xs text-neutral-500">{valeur.groupe}</p>
                          )}
                        </div>
                        {peutAgir && (
                          <div className="flex items-center gap-1">
                            <Bouton
                              variante="ghost"
                              taille="sm"
                              aria-label={t("modifierValeur")}
                              onClick={() => ouvrirModificationValeur(valeur)}
                            >
                              <Pencil size={15} aria-hidden="true" />
                            </Bouton>
                            <Bouton
                              variante="ghost"
                              taille="sm"
                              className="text-erreur"
                              aria-label={t("supprimerValeur")}
                              onClick={() => setValeurASupprimer(valeur)}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </Bouton>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Modale de création / modification d'une liste */}
      <Modale
        ouverte={modaleListe !== null}
        titre={modaleListe?.mode === "modifier" ? t("titreModifierListe") : t("titreCreerListe")}
        onFermer={enregistrementListe.isPending ? undefined : () => setModaleListe(null)}
        actions={
          <>
            <Bouton
              variante="ghost"
              onClick={() => setModaleListe(null)}
              disabled={enregistrementListe.isPending}
            >
              {t("annuler")}
            </Bouton>
            <Bouton
              enCours={enregistrementListe.isPending}
              disabled={!libelleListe.trim() || enregistrementListe.isPending}
              onClick={() => enregistrementListe.mutate()}
            >
              {t("enregistrer")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Champ
            libelle={t("champLibelleListe")}
            placeholder={t("placeholderLibelleListe")}
            value={libelleListe}
            maxLength={100}
            disabled={enregistrementListe.isPending}
            onChange={(e) => setLibelleListe(e.target.value)}
          />
          <Champ
            libelle={t("champDescriptionListe")}
            placeholder={t("placeholderDescriptionListe")}
            value={descriptionListe}
            maxLength={300}
            disabled={enregistrementListe.isPending}
            onChange={(e) => setDescriptionListe(e.target.value)}
          />
          {modaleListe?.mode === "modifier" && (
            <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-800">
              <Checkbox
                checked={estActifListe}
                disabled={enregistrementListe.isPending}
                onCheckedChange={(v) => setEstActifListe(v === true)}
              />
              <span>{t("champEstActifListe")}</span>
            </label>
          )}
          {modaleListe?.mode === "creer" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-neutral-800">
                {t("champValeursInitiales")}
              </label>
              <Textarea
                rows={4}
                value={valeursInitiales}
                placeholder={t("placeholderValeursInitiales")}
                disabled={enregistrementListe.isPending}
                onChange={(e) => setValeursInitiales(e.target.value)}
              />
              <span className="text-xs text-neutral-500">{t("aideValeursInitiales")}</span>
            </div>
          )}
          {erreurModaleListe && <Alerte type="erreur">{erreurModaleListe}</Alerte>}
        </div>
      </Modale>

      {/* Modale de modification d'une valeur */}
      <Modale
        ouverte={modaleValeur !== null}
        titre={t("titreModifierValeur")}
        onFermer={modificationValeur.isPending ? undefined : () => setModaleValeur(null)}
        actions={
          <>
            <Bouton
              variante="ghost"
              onClick={() => setModaleValeur(null)}
              disabled={modificationValeur.isPending}
            >
              {t("annuler")}
            </Bouton>
            <Bouton
              enCours={modificationValeur.isPending}
              disabled={!libelleValeurModif.trim() || modificationValeur.isPending}
              onClick={() => modificationValeur.mutate()}
            >
              {t("enregistrer")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Champ
            libelle={t("champNouvelleValeur")}
            value={libelleValeurModif}
            maxLength={200}
            disabled={modificationValeur.isPending}
            onChange={(e) => setLibelleValeurModif(e.target.value)}
          />
          <Champ
            libelle={t("champGroupe")}
            value={groupeValeurModif}
            maxLength={100}
            disabled={modificationValeur.isPending}
            onChange={(e) => setGroupeValeurModif(e.target.value)}
          />
          {erreurModaleValeur && <Alerte type="erreur">{erreurModaleValeur}</Alerte>}
        </div>
      </Modale>

      {/* Modale de suppression d'une liste */}
      <Modale
        ouverte={listeASupprimer !== null}
        titre={t("titreSupprimerListe")}
        onFermer={
          suppressionListe.isPending || basculeStatutListe.isPending
            ? undefined
            : () => {
                setListeASupprimer(null);
                setErreurSuppressionListe(null);
              }
        }
        actions={
          <>
            <Bouton
              variante="ghost"
              onClick={() => {
                setListeASupprimer(null);
                setErreurSuppressionListe(null);
              }}
              disabled={suppressionListe.isPending || basculeStatutListe.isPending}
            >
              {t("annuler")}
            </Bouton>
            {listeASupprimer && nbUtilisationsListeASupprimer > 0 && listeASupprimer.estActif && (
              <Bouton
                variante="secondaire"
                iconeGauche={<PowerOff size={15} />}
                enCours={basculeStatutListe.isPending}
                disabled={basculeStatutListe.isPending || suppressionListe.isPending}
                onClick={() => basculeStatutListe.mutate(listeASupprimer)}
              >
                {t("desactiverListe")}
              </Bouton>
            )}
            <Bouton
              variante="danger"
              enCours={suppressionListe.isPending}
              disabled={suppressionListe.isPending || basculeStatutListe.isPending}
              onClick={() => listeASupprimer && suppressionListe.mutate(listeASupprimer)}
            >
              {t("supprimerListe")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>{t("confirmationSupprimerListe", { libelle: listeASupprimer?.libelle ?? "" })}</p>
          {listeASupprimer && nbUtilisationsListeASupprimer > 0 && (
            <Alerte type="avertissement">
              {t("avertissementListeUtilisee", {
                plateforme: listeASupprimer.nombreUtilisationsPlateforme,
                entreprises: listeASupprimer.nombreUtilisationsEntreprises,
              })}
            </Alerte>
          )}
          {erreurSuppressionListe && <Alerte type="erreur">{erreurSuppressionListe}</Alerte>}
        </div>
      </Modale>

      {/* Modale de suppression d'une valeur */}
      <Modale
        ouverte={valeurASupprimer !== null}
        titre={t("titreSupprimerValeur")}
        onFermer={suppressionValeur.isPending ? undefined : () => setValeurASupprimer(null)}
        actions={
          <>
            <Bouton
              variante="ghost"
              onClick={() => setValeurASupprimer(null)}
              disabled={suppressionValeur.isPending}
            >
              {t("annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              enCours={suppressionValeur.isPending}
              disabled={suppressionValeur.isPending}
              onClick={() => valeurASupprimer && suppressionValeur.mutate(valeurASupprimer)}
            >
              {t("supprimerValeur")}
            </Bouton>
          </>
        }
      >
        <p>{t("confirmationSupprimerValeur", { libelle: valeurASupprimer?.libelle ?? "" })}</p>
      </Modale>
    </section>
  );
}

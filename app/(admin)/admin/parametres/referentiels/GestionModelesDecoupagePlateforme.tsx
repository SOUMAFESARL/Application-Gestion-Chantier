"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Copy, Plus, Power, PowerOff, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EditeurModeleDecoupage } from "@/components/metier/EditeurModeleDecoupage";
import { Alerte, Badge, Bouton, EtatChargement, EtatErreur, EtatVide, Modale } from "@/components/ui";
import { MenuExport, type ExportTableau } from "@/components/ui/export-tableau";
import { Input } from "@/components/ui/input";
import { FiltreTableau } from "@/components/ui/tableau-liste";
import {
  CRITERES_MODELES_DECOUPAGE_VIDES,
  criteresModelesDecoupageActifs,
  filtrerModelesDecoupagePlateforme,
  listesActivesPlateforme,
  peutParametrerPlateforme,
  type CriteresModelesDecoupagePlateforme,
  type DetailModeleDecoupagePlateforme,
  type EntreeReferentielPlateforme,
  type FiltreStatutDecoupagePlateforme,
  type ListeDecoupagePlateforme,
  type ResumeModeleDecoupagePlateforme,
} from "@/features/administration";
import {
  activerModeleDecoupagePlateforme,
  creerModeleDecoupagePlateforme,
  desactiverModeleDecoupagePlateforme,
  dupliquerModeleDecoupagePlateforme,
  importerFichierModelePlateforme,
  lireModeleDecoupagePlateforme,
  listerListesDecoupagePlateforme,
  listerModelesDecoupagePlateforme,
  listerReferentielPlateforme,
  modifierModeleDecoupagePlateforme,
  supprimerModeleDecoupagePlateforme,
  telechargerModeleExcelDecoupagePlateforme,
} from "@/features/administration/adaptateur";
import {
  creerDonneesInitialesModele,
  telechargerBlob,
  type DonneesFormulaireModele,
  type LibellesEditeurModele,
} from "@/features/decoupage/editeurModele";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";

/**
 * Gestion des modèles de découpage de la plateforme (`/admin/parametres/referentiels/modeles`).
 *
 * Les modèles actifs créés ou mis à jour ici sont immédiatement proposés à toutes les entreprises
 * clientes (sans copie). Lorsqu'un modèle est mis à jour, sa version augmente et les entreprises
 * ayant personnalisé ce modèle sont informées qu'une nouvelle version existe.
 */
export function GestionModelesDecoupagePlateforme() {
  const t = useTranslations("administration.parametres.modelesDecoupage");
  const profil = useAdministrateur();
  const peutAgir = peutParametrerPlateforme(profil);

  const requeteModeles = useQuery({
    queryKey: CLES_ADMINISTRATION.modelesDecoupage(),
    queryFn: ({ signal }) => listerModelesDecoupagePlateforme(signal),
  });
  const requeteListes = useQuery({
    queryKey: CLES_ADMINISTRATION.listesDecoupage(),
    queryFn: ({ signal }) => listerListesDecoupagePlateforme(signal),
  });
  const requeteTypesProjet = useQuery({
    queryKey: CLES_ADMINISTRATION.referentiels("types-projet"),
    queryFn: ({ signal }) => listerReferentielPlateforme("types-projet", signal),
  });

  const modeles = useMemo(() => requeteModeles.data ?? [], [requeteModeles.data]);
  const listes = useMemo(() => requeteListes.data ?? [], [requeteListes.data]);
  const typesProjet = useMemo(() => requeteTypesProjet.data ?? [], [requeteTypesProjet.data]);

  const [criteres, setCriteres] = useState<CriteresModelesDecoupagePlateforme>(
    CRITERES_MODELES_DECOUPAGE_VIDES,
  );
  const filtresActifs = criteresModelesDecoupageActifs(criteres);

  const modelesFiltres = useMemo(
    () => filtrerModelesDecoupagePlateforme(modeles, criteres),
    [modeles, criteres],
  );

  const [idSelectionne, setIdSelectionne] = useState<string | null>(null);
  const [enCreation, setEnCreation] = useState(false);
  const [compteurCreation, setCompteurCreation] = useState(0);

  const idEffectif = useMemo(() => {
    if (enCreation) return null;
    if (idSelectionne && modelesFiltres.some((m) => m.id === idSelectionne)) {
      return idSelectionne;
    }
    if (modelesFiltres[0]) {
      return modelesFiltres[0].id;
    }
    if (idSelectionne && modeles.some((m) => m.id === idSelectionne)) {
      return idSelectionne;
    }
    return modeles[0]?.id ?? null;
  }, [enCreation, idSelectionne, modelesFiltres, modeles]);

  const requeteDetail = useQuery({
    queryKey: CLES_ADMINISTRATION.modeleDecoupage(idEffectif ?? ""),
    queryFn: ({ signal }) => lireModeleDecoupagePlateforme(idEffectif!, signal),
    enabled: idEffectif !== null,
  });

  function messageErreur(cause: unknown): string {
    return cause instanceof ErreurApi && cause.message ? cause.message : t("erreur");
  }

  const telechargementExemple = useMutation({
    mutationFn: async () => {
      const blob = await telechargerModeleExcelDecoupagePlateforme();
      telechargerBlob(blob, "modele-decoupage-plateforme.xlsx");
    },
    onError: (cause) => toast.error(messageErreur(cause)),
  });

  function demarrerCreation() {
    setCompteurCreation((c) => c + 1);
    setEnCreation(true);
  }

  function choisirModeleCatalogue(m: ResumeModeleDecoupagePlateforme) {
    setEnCreation(false);
    setIdSelectionne(m.id);
  }

  const exporter = useMemo<ExportTableau<ResumeModeleDecoupagePlateforme>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        { entete: t("export.colonneNom"), valeur: (m) => m.nom },
        { entete: t("export.colonneDescription"), valeur: (m) => m.description },
        { entete: t("export.colonneVersion"), valeur: (m) => m.version },
        {
          entete: t("export.colonneStatut"),
          valeur: (m) => (m.estActif ? t("badgeActif") : t("badgeInactif")),
        },
        { entete: t("export.colonneNiveaux"), valeur: (m) => m.niveaux.join(" / ") },
        { entete: t("export.colonneLignes"), valeur: (m) => m.nombreLignes },
        { entete: t("export.colonneCopies"), valeur: (m) => m.nombreCopiesEntreprises },
      ],
    }),
    [t],
  );

  const detailActif = enCreation ? null : requeteDetail.data ?? null;
  const cleFormulaire = enCreation
    ? `nouveau-${compteurCreation}`
    : detailActif
      ? `${detailActif.id}:v${detailActif.version}:${detailActif.estActif}:${detailActif.niveaux.length}:${detailActif.lignes.length}`
      : "vide";

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{t("titre")}</h2>
          <p className="text-sm text-neutral-600">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MenuExport exporter={exporter} lignes={modelesFiltres} />
          {peutAgir && (
            <Bouton taille="sm" iconeGauche={<Plus size={16} />} onClick={demarrerCreation}>
              {t("nouveauModele")}
            </Bouton>
          )}
        </div>
      </div>

      {requeteModeles.isPending ? (
        <EtatChargement />
      ) : requeteModeles.isError ? (
        <EtatErreur onReessayer={() => void requeteModeles.refetch()} />
      ) : modeles.length === 0 && !enCreation ? (
        <EtatVide titre={t("aucunModele")} description={t("aucunModeleDescription")} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Colonne gauche : catalogue des modèles plateforme */}
          <div className="flex flex-col gap-2.5 lg:col-span-4">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <Input
                value={criteres.recherche}
                placeholder={t("rechercherPlaceholder")}
                aria-label={t("rechercher")}
                className="pl-9 text-xs"
                onChange={(e) =>
                  setCriteres((courant) => ({ ...courant, recherche: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {typesProjet.length > 0 && (
                <FiltreTableau<string>
                  valeur={criteres.typeProjet}
                  onChangement={(typeProjet) =>
                    setCriteres((courant) => ({ ...courant, typeProjet }))
                  }
                  libelle={t("filtreTypeProjet")}
                  libelleTous={t("filtreTypeProjetTous")}
                  options={typesProjet.map((tp) => ({ valeur: tp.code, libelle: tp.libelle }))}
                />
              )}
              <FiltreTableau<Exclude<FiltreStatutDecoupagePlateforme, "">>
                valeur={criteres.statut}
                onChangement={(statut) => setCriteres((courant) => ({ ...courant, statut }))}
                libelle={t("filtreStatut")}
                libelleTous={t("filtreStatutTous")}
                options={[
                  { valeur: "ACTIF", libelle: t("filtreStatutActifs") },
                  { valeur: "INACTIF", libelle: t("filtreStatutInactifs") },
                ]}
              />
              {filtresActifs && (
                <Bouton
                  variante="ghost"
                  taille="sm"
                  onClick={() => setCriteres(CRITERES_MODELES_DECOUPAGE_VIDES)}
                >
                  {t("reinitialiserFiltres")}
                </Bouton>
              )}
            </div>
            <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              {t("catalogueModeles", { n: modelesFiltres.length })}
            </span>
            {modelesFiltres.length === 0 ? (
              <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center text-xs text-neutral-500">
                {t("aucunModeleFiltre")}
              </p>
            ) : (
              <ul className="flex max-h-[36rem] flex-col gap-1.5 overflow-y-auto pr-1">
                {modelesFiltres.map((m) => {
                  const actif = !enCreation && idEffectif === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => choisirModeleCatalogue(m)}
                        className={cn(
                          "flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                          actif
                            ? "border-primary-600 bg-primary-50/50"
                            : "border-neutral-200 bg-neutral-0 hover:bg-neutral-50",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-neutral-900">
                            {m.nom}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge variante="neutre">{t("badgeVersion", { v: m.version })}</Badge>
                            <Badge variante={m.estActif ? "succes" : "neutre"}>
                              {m.estActif ? t("badgeActif") : t("badgeInactif")}
                            </Badge>
                          </div>
                        </div>
                        {m.niveaux.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 text-xs font-medium text-neutral-700">
                            {m.niveaux.map((niv, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1">
                                {idx > 0 && (
                                  <ArrowRight
                                    className="size-3 shrink-0 text-neutral-400"
                                    aria-hidden="true"
                                  />
                                )}
                                <span>{niv}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                          <span>{t("resumeLignes", { n: m.nombreLignes })}</span>
                          <span>{t("badgeCopiesEntreprises", { n: m.nombreCopiesEntreprises })}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Colonne droite : détail / éditeur du modèle plateforme */}
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4 lg:col-span-8">
            {!enCreation && requeteDetail.isPending ? (
              <EtatChargement />
            ) : !enCreation && requeteDetail.isError ? (
              <EtatErreur onReessayer={() => void requeteDetail.refetch()} />
            ) : enCreation || detailActif ? (
              <FormulaireModelePlateforme
                key={cleFormulaire}
                enCreation={enCreation}
                detail={detailActif}
                listes={listes}
                typesProjet={typesProjet}
                peutAgir={peutAgir}
                peutAnnulerCreation={modeles.length > 0}
                onAnnulerCreation={() => setEnCreation(false)}
                onTelechargerExemple={() => telechargementExemple.mutate()}
                telechargementEnCours={telechargementExemple.isPending}
                onSelectionnerModele={(id) => {
                  setEnCreation(false);
                  setIdSelectionne(id);
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function FormulaireModelePlateforme({
  enCreation,
  detail,
  listes,
  typesProjet,
  peutAgir,
  peutAnnulerCreation,
  onAnnulerCreation,
  onTelechargerExemple,
  telechargementEnCours,
  onSelectionnerModele,
}: {
  enCreation: boolean;
  detail: DetailModeleDecoupagePlateforme | null;
  listes: ListeDecoupagePlateforme[];
  typesProjet: EntreeReferentielPlateforme[];
  peutAgir: boolean;
  peutAnnulerCreation: boolean;
  onAnnulerCreation: () => void;
  onTelechargerExemple: () => void;
  telechargementEnCours: boolean;
  onSelectionnerModele: (id: string | null) => void;
}) {
  const t = useTranslations("administration.parametres.modelesDecoupage");
  const cache = useQueryClient();

  const [aSupprimer, setASupprimer] = useState<DetailModeleDecoupagePlateforme | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const libellesDefaut = useMemo<[string, string, string]>(
    () => [t("niveauDefaut1"), t("niveauDefaut2"), t("niveauDefaut3")],
    [t],
  );

  const valeursInitiales = useMemo(
    () => creerDonneesInitialesModele(detail, libellesDefaut),
    [detail, libellesDefaut],
  );

  const listesActives = useMemo(() => listesActivesPlateforme(listes), [listes]);

  function messageErreur(cause: unknown): string {
    return cause instanceof ErreurApi && cause.message ? cause.message : t("erreur");
  }

  function invaliderCaches(idModele?: string) {
    void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.modelesDecoupage() });
    if (idModele) {
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.modeleDecoupage(idModele) });
    }
    void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.listesDecoupage() });
  }

  const enregistrement = useMutation({
    mutationFn: async (donnees: DonneesFormulaireModele) => {
      const charge = {
        nom: donnees.nom,
        description: donnees.description,
        estActif: donnees.estActif,
        typesProjet: donnees.typesProjet,
        parDefautPour: donnees.parDefautPour,
        niveaux: donnees.niveaux.map((niv) => ({
          libelle: niv.libelle,
          alerter: niv.alerter,
          liste: niv.liste ? { id: niv.liste.id, libelle: niv.liste.libelle } : null,
        })),
        lignes: donnees.lignes,
      };
      if (enCreation) {
        return creerModeleDecoupagePlateforme(charge);
      }
      if (!detail) throw new Error("NO_DETAIL");
      return modifierModeleDecoupagePlateforme(detail.id, charge);
    },
    onSuccess: (enregistre) => {
      setErreur(null);
      toast.success(
        enCreation ? t("succesCreation") : t("succesModification", { v: enregistre.version }),
      );
      invaliderCaches(enregistre.id);
      onSelectionnerModele(enregistre.id);
    },
    onError: (cause) => setErreur(messageErreur(cause)),
  });

  const basculeStatut = useMutation({
    mutationFn: (cible: DetailModeleDecoupagePlateforme) =>
      cible.estActif
        ? desactiverModeleDecoupagePlateforme(cible.id)
        : activerModeleDecoupagePlateforme(cible.id),
    onSuccess: (misAJour) => {
      setErreur(null);
      toast.success(misAJour.estActif ? t("succesActivation") : t("succesDesactivation"));
      invaliderCaches(misAJour.id);
    },
    onError: (cause) => toast.error(messageErreur(cause)),
  });

  const duplication = useMutation({
    mutationFn: (id: string) => dupliquerModeleDecoupagePlateforme(id),
    onSuccess: (copie) => {
      setErreur(null);
      toast.success(t("succesDuplication"));
      invaliderCaches(copie.id);
      onSelectionnerModele(copie.id);
    },
    onError: (cause) => toast.error(messageErreur(cause)),
  });

  const suppression = useMutation({
    mutationFn: (cible: DetailModeleDecoupagePlateforme) =>
      supprimerModeleDecoupagePlateforme(cible.id),
    onSuccess: () => {
      setASupprimer(null);
      toast.success(t("succesSuppression"));
      invaliderCaches();
      onSelectionnerModele(null);
    },
    onError: (cause) => {
      setASupprimer(null);
      toast.error(messageErreur(cause));
    },
  });

  const importExcel = useMutation({
    mutationFn: (fichier: File) => importerFichierModelePlateforme(fichier),
    onSuccess: (importe) => {
      setErreur(null);
      toast.success(t("succesImportExcel", { lignes: importe.lignes.length }));
    },
    onError: (cause) => setErreur(messageErreur(cause)),
  });

  const libellesEditeur = useMemo<LibellesEditeurModele>(
    () => ({
      champNom: t("champNom"),
      placeholderNom: t("placeholderNom"),
      champDescription: t("champDescription"),
      placeholderDescription: t("placeholderDescription"),
      champEstActif: t("champEstActif"),
      typesProjetTitre: t("typesProjetTitre"),
      typesProjetAide: t("typesProjetAide"),
      parDefautCourt: t("parDefautCourt"),
      niveauxTitre: t("niveauxTitre"),
      niveauxAide: t("niveauxAide"),
      ajouterNiveau: t("ajouterNiveau"),
      niveauRang: (rang) => t("niveauRang", { rang }),
      deplacerGauche: t("deplacerGauche"),
      deplacerDroite: t("deplacerDroite"),
      retirerNiveau: t("retirerNiveau"),
      placeholderNiveau: t("placeholderNiveau"),
      sansListe: t("sansListe"),
      alerterNiveau: t("alerterNiveau"),
      lignesTitre: (n) => t("lignesTitre", { n }),
      lignesAide: t("lignesAide"),
      telechargerModeleExcel: t("telechargerModeleExcel"),
      importerExcel: t("importerExcel"),
      ajouterLigne: t("ajouterLigne"),
      retirerLigne: t("retirerLigne"),
      viderCellule: t("viderCellule"),
      sansValeur: t("sansValeur"),
      rechercherValeur: t("rechercherValeur"),
      aucuneValeur: t("aucuneValeur"),
      utiliserValeurLibre: (saisie) => t("utiliserValeurLibre", { saisie }),
      ajouterRacine: (niveau) => t("ajouterRacine", { niveau }),
      ajouterEnfant: (niveau) => t("ajouterEnfant", { niveau }),
      deplier: t("deplier"),
      replier: t("replier"),
      toutDeplier: t("toutDeplier"),
      toutReplier: t("toutReplier"),
      arbreVideTitre: t("arbreVideTitre"),
      arbreVideAide: t("arbreVideAide"),
      saisirOuChoisir: t("saisirOuChoisir"),
      listeValeurs: t("listeValeurs"),
      resumeFeuilles: (n) => t("resumeFeuilles", { n }),
      annuler: t("annuler"),
      enregistrer: enCreation ? t("creerModele") : t("enregistrerModele"),
    }),
    [t, enCreation],
  );

  return (
    <>
      <EditeurModeleDecoupage
        titre={enCreation ? t("titreCreation") : (detail?.nom ?? "")}
        sousTitre={enCreation ? t("aideCreation") : t("aideModification")}
        badges={
          !enCreation && detail ? (
            <>
              <Badge variante="neutre">{t("badgeVersion", { v: detail.version })}</Badge>
              <Badge variante={detail.estActif ? "succes" : "neutre"}>
                {detail.estActif ? t("badgeActif") : t("badgeInactif")}
              </Badge>
              <Badge variante="information">
                {t("badgeCopiesEntreprises", { n: detail.nombreCopiesEntreprises })}
              </Badge>
            </>
          ) : undefined
        }
        actionsEnTete={
          !enCreation && detail && peutAgir ? (
            <>
              <Bouton
                variante="secondaire"
                taille="sm"
                iconeGauche={detail.estActif ? <PowerOff size={15} /> : <Power size={15} />}
                enCours={basculeStatut.isPending}
                disabled={basculeStatut.isPending || duplication.isPending}
                onClick={() => basculeStatut.mutate(detail)}
              >
                {detail.estActif ? t("desactiver") : t("activer")}
              </Bouton>
              <Bouton
                variante="secondaire"
                taille="sm"
                iconeGauche={<Copy size={15} />}
                enCours={duplication.isPending}
                disabled={duplication.isPending || basculeStatut.isPending}
                onClick={() => duplication.mutate(detail.id)}
              >
                {t("dupliquer")}
              </Bouton>
              <Bouton
                variante="ghost"
                taille="sm"
                className="text-erreur"
                iconeGauche={<Trash2 size={15} />}
                onClick={() => setASupprimer(detail)}
              >
                {t("supprimer")}
              </Bouton>
            </>
          ) : undefined
        }
        erreur={erreur}
        valeursInitiales={valeursInitiales}
        listes={listesActives}
        typesProjet={typesProjet}
        afficherEstActif
        peutEcrire={peutAgir}
        enregistrementEnCours={enregistrement.isPending}
        onEnregistrer={(donnees) => enregistrement.mutate(donnees)}
        peutAnnuler={enCreation && peutAnnulerCreation}
        onAnnuler={onAnnulerCreation}
        onTelechargerExemple={onTelechargerExemple}
        telechargementEnCours={telechargementEnCours}
        onImporterFichier={(fichier) => importExcel.mutateAsync(fichier)}
        importEnCours={importExcel.isPending}
        libelles={libellesEditeur}
      />

      {/* Modale de suppression informée d'un modèle plateforme */}
      <Modale
        ouverte={aSupprimer !== null}
        titre={t("titreSuppression")}
        onFermer={suppression.isPending ? undefined : () => setASupprimer(null)}
        actions={
          <>
            <Bouton
              variante="ghost"
              onClick={() => setASupprimer(null)}
              disabled={suppression.isPending}
            >
              {t("annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              enCours={suppression.isPending}
              disabled={suppression.isPending}
              onClick={() => aSupprimer && suppression.mutate(aSupprimer)}
            >
              {t("supprimer")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>{t("confirmationSuppression", { nom: aSupprimer?.nom ?? "" })}</p>
          {aSupprimer && (
            <Alerte type="information">
              {t("impactSuppressionCopies", { n: aSupprimer.nombreCopiesEntreprises })}
            </Alerte>
          )}
        </div>
      </Modale>
    </>
  );
}

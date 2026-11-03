"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, ListChecks, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Alerte, Badge, Bouton, Champ, EtatChargement, EtatErreur, EtatVide, Modale } from "@/components/ui";
import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  peutParametrerPlateforme,
  type ListeDecoupagePlateforme,
  type ValeurListeDecoupagePlateforme,
} from "@/features/administration";
import {
  ajouterValeursListePlateforme,
  creerListeDecoupagePlateforme,
  importerValeursListePlateforme,
  listerListesDecoupagePlateforme,
  modifierListeDecoupagePlateforme,
  modifierValeurListePlateforme,
  supprimerListeDecoupagePlateforme,
  supprimerValeurListePlateforme,
  telechargerModeleExcelListePlateforme,
} from "@/features/administration/adaptateur";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";

const LONGUEUR_MAX_GROUPE = 100;

function telechargerFichierBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

/**
 * Gestion des listes de valeurs de découpage de la plateforme (Super Admin).
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
  const [valeursInitiales, setValeursInitiales] = useState("");
  const [erreurModaleListe, setErreurModaleListe] = useState<string | null>(null);

  const [modaleValeur, setModaleValeur] = useState<ValeurListeDecoupagePlateforme | null>(null);
  const [libelleValeurModif, setLibelleValeurModif] = useState("");
  const [groupeValeurModif, setGroupeValeurModif] = useState("");
  const [erreurModaleValeur, setErreurModaleValeur] = useState<string | null>(null);

  const [listeASupprimer, setListeASupprimer] = useState<ListeDecoupagePlateforme | null>(null);
  const [valeurASupprimer, setValeurASupprimer] = useState<ValeurListeDecoupagePlateforme | null>(null);

  const champFichierRef = useRef<HTMLInputElement | null>(null);

  const listeActive = useMemo<ListeDecoupagePlateforme | null>(() => {
    if (listes.length === 0) return null;
    if (idChoisi) {
      const trouvee = listes.find((l) => l.id === idChoisi);
      if (trouvee) return trouvee;
    }
    return listes[0] ?? null;
  }, [listes, idChoisi]);

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

  function messageErreur(cause: unknown): string {
    return cause instanceof ErreurApi && cause.message ? cause.message : t("erreur");
  }

  function ouvrirCreationListe() {
    setLibelleListe("");
    setDescriptionListe("");
    setValeursInitiales("");
    setErreurModaleListe(null);
    setModaleListe({ mode: "creer" });
  }

  function ouvrirModificationListe(liste: ListeDecoupagePlateforme) {
    setLibelleListe(liste.libelle);
    setDescriptionListe(liste.description);
    setValeursInitiales("");
    setErreurModaleListe(null);
    setModaleListe({ mode: "modifier", liste });
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

  const suppressionListe = useMutation({
    mutationFn: (liste: ListeDecoupagePlateforme) => supprimerListeDecoupagePlateforme(liste.id),
    onSuccess: () => {
      setListeASupprimer(null);
      setIdChoisi(null);
      toast.success(t("succesSuppressionListe"));
      void cache.invalidateQueries({ queryKey: cle });
    },
    onError: (cause) => {
      setListeASupprimer(null);
      toast.error(messageErreur(cause));
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
      telechargerFichierBlob(blob, "modele-import-liste-valeurs.xlsx");
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

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{t("titre")}</h2>
          <p className="text-sm text-neutral-600">{t("description")}</p>
        </div>
        {peutAgir && (
          <div className="flex flex-wrap items-center gap-2">
            <Bouton
              variante="secondaire"
              taille="sm"
              iconeGauche={<Download size={16} />}
              enCours={telechargementModele.isPending}
              disabled={telechargementModele.isPending}
              onClick={() => telechargementModele.mutate()}
            >
              {t("telechargerModeleExcel")}
            </Bouton>
            <Bouton
              taille="sm"
              iconeGauche={<Plus size={16} />}
              onClick={ouvrirCreationListe}
            >
              {t("nouvelleListe")}
            </Bouton>
          </div>
        )}
      </div>

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
              {t("catalogueListes", { n: listes.length })}
            </span>
            <ul className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto pr-1">
              {listes.map((liste) => {
                const estActive = listeActive?.id === liste.id;
                return (
                  <li key={liste.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setIdChoisi(liste.id);
                        setErreurValeur(null);
                      }}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                        estActive
                          ? "border-primary-600 bg-primary-50/50"
                          : "border-neutral-200 bg-neutral-0 hover:bg-neutral-50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-neutral-900">
                          {liste.libelle}
                        </span>
                        <Badge variante="neutre">{t("nbValeursCourt", { n: liste.nombreValeurs })}</Badge>
                      </div>
                      {liste.description && (
                        <p className="line-clamp-2 text-xs text-neutral-600">{liste.description}</p>
                      )}
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
                      <Badge variante="neutre">
                        {t("nbValeursCourt", { n: listeActive.nombreValeurs })}
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
                    <div className="flex items-center gap-1.5">
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
                        onClick={() => setListeASupprimer(listeActive)}
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
            maxLength={150}
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
        onFermer={suppressionListe.isPending ? undefined : () => setListeASupprimer(null)}
        actions={
          <>
            <Bouton
              variante="ghost"
              onClick={() => setListeASupprimer(null)}
              disabled={suppressionListe.isPending}
            >
              {t("annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              enCours={suppressionListe.isPending}
              disabled={suppressionListe.isPending}
              onClick={() => listeASupprimer && suppressionListe.mutate(listeASupprimer)}
            >
              {t("supprimerListe")}
            </Bouton>
          </>
        }
      >
        <p>{t("confirmationSupprimerListe", { libelle: listeASupprimer?.libelle ?? "" })}</p>
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

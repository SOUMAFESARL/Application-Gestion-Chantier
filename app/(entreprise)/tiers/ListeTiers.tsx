"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Eye,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Alerte, Badge, Bouton, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { paysEntreprise } from "@/features/configuration/api";
import { peutCode, useDroits } from "@/features/habilitations";
import { afficherTelephone, PAYS_TELEPHONE_DEFAUT } from "@/features/referentiels/telephone";
import {
  basculerStatutTiers,
  listerCatalogueTiers,
  supprimerTiers,
} from "@/features/tiers/adaptateur";
import { CLES_TIERS } from "@/features/tiers/cles";
import { TiroirDetailTiers } from "@/features/tiers/components/TiroirDetailTiers";
import { TiroirFormulaireTiers } from "@/features/tiers/components/TiroirFormulaireTiers";
import {
  CRITERES_TIERS_VIDES,
  criteresTiersActifs,
  filtrerTiers,
  formaterNoteEvaluation,
  initialesTiers,
  PERMISSION_TIERS_ECRIRE,
  rolesPresentsTiers,
  statutsPresentsTiers,
  typesPresentsTiers,
} from "@/features/tiers/regles";
import type { CriteresTiers, RoleTiers, Tiers, TypeTiers } from "@/features/tiers/types";
import { ErreurApi } from "@/lib/api";

const colonne = aideColonnes<Tiers>();

/**
 * Répertoire des parties prenantes et tiers de l'entreprise (`/tiers`).
 */
export function ListeTiers() {
  const t = useTranslations("tiers");
  const cache = useQueryClient();
  const { droits } = useDroits();
  const peutEcrire = peutCode(droits, PERMISSION_TIERS_ECRIRE);

  const [pays, setPays] = useState("");
  const [criteres, setCriteres] = useState<CriteresTiers>(CRITERES_TIERS_VIDES);
  const [tiersDetail, setTiersDetail] = useState<Tiers | null>(null);
  const [tiroirFormulaire, setTiroirFormulaire] = useState<
    { mode: "creer" } | { mode: "modifier"; tiers: Tiers } | null
  >(null);
  const [tiersASupprimer, setTiersASupprimer] = useState<Tiers | null>(null);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const requete = useQuery({
    queryKey: CLES_TIERS.liste(true),
    queryFn: ({ signal }) => listerCatalogueTiers({ inclureInactifs: true }, signal),
  });

  const tousTiers = useMemo(() => requete.data ?? [], [requete.data]);

  const tiersFiltres = useMemo(
    () => filtrerTiers(tousTiers, criteres),
    [tousTiers, criteres],
  );

  const filtresActifs = criteresTiersActifs(criteres);

  const rolesPresents = useMemo(() => rolesPresentsTiers(tousTiers), [tousTiers]);
  const typesPresents = useMemo(() => typesPresentsTiers(tousTiers), [tousTiers]);
  const statutsPresents = useMemo(() => statutsPresentsTiers(tousTiers), [tousTiers]);

  function messageErreur(cause: unknown): string {
    return cause instanceof ErreurApi && cause.message ? cause.message : t("erreurAction");
  }

  const basculeStatut = useMutation({
    mutationFn: (cible: Tiers) => basculerStatutTiers(cible.id, !cible.estActif),
    onSuccess: (misAJour) => {
      toast.success(
        misAJour.estActif
          ? t("detail.succesActivation", { nom: misAJour.raisonSociale })
          : t("detail.succesDesactivation", { nom: misAJour.raisonSociale }),
      );
      setTiersASupprimer(null);
      setErreurSuppression(null);
      void cache.invalidateQueries({ queryKey: CLES_TIERS.tous });
    },
    onError: (cause) => toast.error(messageErreur(cause)),
  });

  const suppression = useMutation({
    mutationFn: (cible: Tiers) => supprimerTiers(cible.id),
    onSuccess: (_res, cible) => {
      setTiersASupprimer(null);
      setErreurSuppression(null);
      toast.success(t("detail.succesSuppression", { nom: cible.raisonSociale }));
      void cache.invalidateQueries({ queryKey: CLES_TIERS.tous });
    },
    onError: (cause) => setErreurSuppression(messageErreur(cause)),
  });

  const paysEffectif = pays || PAYS_TELEPHONE_DEFAUT;

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("raisonSociale", {
          id: "raisonSociale",
          header: t("colonnes.tiers"),
          cell: ({ row }) => {
            const item = row.original;
            const IconeType = item.typeTiers === "ENTREPRISE" ? Building2 : UserRound;
            return (
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                  {initialesTiers(item.raisonSociale)}
                </div>
                <div className="flex min-w-0 flex-col">
                  <button
                    type="button"
                    onClick={() => setTiersDetail(item)}
                    className="cursor-pointer truncate border-0 bg-transparent p-0 text-left font-semibold text-neutral-900 hover:text-primary-600 hover:underline"
                  >
                    {item.raisonSociale}
                  </button>
                  <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                    <IconeType className="size-3 shrink-0" aria-hidden="true" />
                    <span>{t(`types.${item.typeTiers}`)}</span>
                  </span>
                </div>
              </div>
            );
          },
        }),
        colonne.display({
          id: "roles",
          header: t("colonnes.roles"),
          cell: ({ row }) => {
            const roles = row.original.roles;
            if (roles.length === 0) {
              return <span className="text-neutral-400">{t("sansDonnee")}</span>;
            }
            const visibles = roles.slice(0, 2);
            const reste = roles.length - visibles.length;
            return (
              <div className="flex flex-wrap items-center gap-1">
                {visibles.map((role) => (
                  <Badge key={role} variante="information">
                    {t(`roles.${role}`)}
                  </Badge>
                ))}
                {reste > 0 && (
                  <Badge variante="neutre">{t("rolesSupplementaires", { n: reste })}</Badge>
                )}
              </div>
            );
          },
        }),
        colonne.accessor("telephone", {
          id: "contact",
          header: t("colonnes.contact"),
          cell: ({ row }) => {
            const item = row.original;
            const tel = afficherTelephone(item.telephone, paysEffectif);
            return (
              <div className="flex min-w-0 flex-col">
                <span className="text-sm whitespace-nowrap text-neutral-900 tabular-nums">
                  {tel || t("sansDonnee")}
                </span>
                {item.email && (
                  <span className="truncate text-xs text-neutral-500">{item.email}</span>
                )}
              </div>
            );
          },
        }),
        colonne.accessor("ville", {
          id: "ville",
          header: t("colonnes.ville"),
          cell: ({ row }) =>
            row.original.ville || <span className="text-neutral-400">{t("sansDonnee")}</span>,
        }),
        colonne.accessor("noteEvaluation", {
          id: "noteEvaluation",
          header: t("colonnes.note"),
          meta: { classe: "tabular-nums whitespace-nowrap" },
          cell: ({ row }) => {
            const note = formaterNoteEvaluation(row.original.noteEvaluation);
            if (!note) return <span className="text-neutral-400">{t("sansDonnee")}</span>;
            return (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-neutral-800">
                <Star className="size-3.5 text-avertissement" aria-hidden="true" />
                <span>{note}</span>
              </span>
            );
          },
        }),
        colonne.accessor("estActif", {
          id: "statut",
          header: t("colonnes.statut"),
          cell: ({ row }) => (
            <Badge variante={row.original.estActif ? "succes" : "neutre"}>
              {t(`statuts.${row.original.estActif ? "ACTIF" : "INACTIF"}`)}
            </Badge>
          ),
        }),
        colonne.display({
          id: "actions",
          header: t("colonnes.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => {
            const item = row.original;
            return (
              <span className="inline-flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("actions.consulter", { nom: item.raisonSociale })}
                  title={t("actions.consulter", { nom: item.raisonSociale })}
                  onClick={() => setTiersDetail(item)}
                >
                  <Eye />
                </Button>
                {peutEcrire && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("actions.modifier", { nom: item.raisonSociale })}
                      title={t("actions.modifier", { nom: item.raisonSociale })}
                      onClick={() => setTiroirFormulaire({ mode: "modifier", tiers: item })}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={basculeStatut.isPending}
                      aria-label={
                        item.estActif
                          ? t("actions.desactiver", { nom: item.raisonSociale })
                          : t("actions.activer", { nom: item.raisonSociale })
                      }
                      title={
                        item.estActif
                          ? t("actions.desactiver", { nom: item.raisonSociale })
                          : t("actions.activer", { nom: item.raisonSociale })
                      }
                      className={
                        item.estActif
                          ? "text-avertissement hover:text-avertissement"
                          : "text-succes hover:text-succes"
                      }
                      onClick={() => basculeStatut.mutate(item)}
                    >
                      {item.estActif ? <PowerOff /> : <Power />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-erreur hover:text-erreur"
                      aria-label={t("actions.supprimer", { nom: item.raisonSociale })}
                      title={t("actions.supprimer", { nom: item.raisonSociale })}
                      onClick={() => {
                        setErreurSuppression(null);
                        setTiersASupprimer(item);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </span>
            );
          },
        }),
      ]),
    [t, paysEffectif, peutEcrire, basculeStatut],
  );

  const exporter = useMemo<ExportTableau<Tiers>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        { entete: t("export.raisonSociale"), valeur: (item) => item.raisonSociale },
        { entete: t("export.type"), valeur: (item) => t(`types.${item.typeTiers}`) },
        {
          entete: t("export.roles"),
          valeur: (item) => item.roles.map((r) => t(`roles.${r}`)).join(", "),
        },
        {
          entete: t("export.telephone"),
          valeur: (item) => afficherTelephone(item.telephone, paysEffectif),
        },
        { entete: t("export.email"), valeur: (item) => item.email },
        { entete: t("export.ville"), valeur: (item) => item.ville },
        { entete: t("export.adresse"), valeur: (item) => item.adresse },
        { entete: t("export.rccm"), valeur: (item) => item.rccm },
        { entete: t("export.nif"), valeur: (item) => item.nif },
        {
          entete: t("export.note"),
          valeur: (item) => (item.noteEvaluation !== null ? item.noteEvaluation : ""),
        },
        {
          entete: t("export.statut"),
          valeur: (item) => t(`statuts.${item.estActif ? "ACTIF" : "INACTIF"}`),
        },
      ],
    }),
    [t, paysEffectif],
  );

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre={t("titre")} description={t("sousTitre")} />

      {requete.isPending ? (
        <EtatChargement message={t("chargement")} />
      ) : requete.isError ? (
        <EtatErreur onReessayer={() => void requete.refetch()} />
      ) : (
        <TableauListe
          colonnes={colonnes}
          donnees={tiersFiltres}
          cleLigne={(item) => item.id}
          messageVide={filtresActifs ? t("aucunResultatFiltre") : t("aucunTiers")}
          exporter={exporter}
          filtresActifs={filtresActifs}
          onReinitialiser={() => setCriteres(CRITERES_TIERS_VIDES)}
          cleCriteres={`${criteres.recherche}|${criteres.role}|${criteres.typeTiers}|${criteres.statut}`}
          outils={
            <>
              <RechercheTableau
                valeur={criteres.recherche}
                onChangement={(recherche) =>
                  setCriteres((courant) => ({ ...courant, recherche }))
                }
                libelle={t("filtres.rechercheLabel")}
                placeholder={t("filtres.recherchePlaceholder")}
              />
              {rolesPresents.length > 0 && (
                <FiltreTableau<RoleTiers>
                  valeur={criteres.role}
                  onChangement={(role) => setCriteres((courant) => ({ ...courant, role }))}
                  libelle={t("filtres.roleLabel")}
                  libelleTous={t("filtres.roleTous")}
                  options={rolesPresents.map((r) => ({ valeur: r, libelle: t(`roles.${r}`) }))}
                />
              )}
              {typesPresents.length > 1 && (
                <FiltreTableau<TypeTiers>
                  valeur={criteres.typeTiers}
                  onChangement={(typeTiers) =>
                    setCriteres((courant) => ({ ...courant, typeTiers }))
                  }
                  libelle={t("filtres.typeLabel")}
                  libelleTous={t("filtres.typeTous")}
                  options={typesPresents.map((tp) => ({
                    valeur: tp,
                    libelle: t(`types.${tp}`),
                  }))}
                />
              )}
              {statutsPresents.length > 1 && (
                <FiltreTableau<"ACTIF" | "INACTIF">
                  valeur={criteres.statut}
                  onChangement={(statut) =>
                    setCriteres((courant) => ({ ...courant, statut }))
                  }
                  libelle={t("filtres.statutLabel")}
                  libelleTous={t("filtres.statutTous")}
                  options={statutsPresents.map((st) => ({
                    valeur: st,
                    libelle: t(`statuts.${st}`),
                  }))}
                />
              )}
            </>
          }
          actions={
            peutEcrire && (
              <Bouton
                variante="primaire"
                taille="sm"
                iconeGauche={<Plus size={16} aria-hidden="true" />}
                onClick={() => setTiroirFormulaire({ mode: "creer" })}
              >
                {t("boutonAjouter")}
              </Bouton>
            )
          }
        />
      )}

      {tiroirFormulaire && (
        <TiroirFormulaireTiers
          tiers={tiroirFormulaire.mode === "modifier" ? tiroirFormulaire.tiers : null}
          pays={pays}
          onFermer={() => setTiroirFormulaire(null)}
          onEnregistre={(enregistre) => {
            if (tiersDetail && tiersDetail.id === enregistre.id) {
              setTiersDetail(enregistre);
            }
          }}
        />
      )}

      {tiersDetail && (
        <TiroirDetailTiers
          tiersInitial={tiersDetail}
          pays={pays}
          peutEcrire={peutEcrire}
          onFermer={() => setTiersDetail(null)}
          onModifier={(cible) => {
            setTiersDetail(null);
            setTiroirFormulaire({ mode: "modifier", tiers: cible });
          }}
        />
      )}

      <Modale
        ouverte={tiersASupprimer !== null}
        titre={t("detail.titreSuppression")}
        onFermer={
          suppression.isPending || basculeStatut.isPending
            ? undefined
            : () => {
                setTiersASupprimer(null);
                setErreurSuppression(null);
              }
        }
        actions={
          <>
            <Bouton
              variante="ghost"
              disabled={suppression.isPending || basculeStatut.isPending}
              onClick={() => {
                setTiersASupprimer(null);
                setErreurSuppression(null);
              }}
            >
              {t("detail.annuler")}
            </Bouton>
            {tiersASupprimer?.estActif && (
              <Bouton
                variante="secondaire"
                iconeGauche={<PowerOff size={15} aria-hidden="true" />}
                enCours={basculeStatut.isPending}
                disabled={basculeStatut.isPending || suppression.isPending}
                onClick={() => tiersASupprimer && basculeStatut.mutate(tiersASupprimer)}
              >
                {t("detail.desactiverPlutot")}
              </Bouton>
            )}
            <Bouton
              variante="danger"
              enCours={suppression.isPending}
              disabled={suppression.isPending || basculeStatut.isPending}
              onClick={() => tiersASupprimer && suppression.mutate(tiersASupprimer)}
            >
              {t("detail.confirmerSuppression")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>{t("detail.messageSuppression", { nom: tiersASupprimer?.raisonSociale ?? "" })}</p>
          {erreurSuppression && <Alerte type="erreur">{erreurSuppression}</Alerte>}
        </div>
      </Modale>
    </div>
  );
}

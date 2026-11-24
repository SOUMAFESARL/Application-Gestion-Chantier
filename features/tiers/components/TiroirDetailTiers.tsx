"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ExternalLink,
  FolderKanban,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Power,
  PowerOff,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Alerte, Badge, Bouton, EtatChargement, Modale } from "@/components/ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { afficherTelephone, PAYS_TELEPHONE_DEFAUT } from "@/features/referentiels/telephone";
import { ErreurApi } from "@/lib/api";

import { basculerStatutTiers, lireTiers, supprimerTiers } from "../adaptateur";
import { CLES_TIERS } from "../cles";
import { formaterNoteEvaluation } from "../regles";
import type { Tiers } from "../types";

const SEPARATEUR_DETAIL = " \u00b7 ";

/**
 * Tiroir de détail d'un tiers : identité, coordonnées, RCCM/NIF, rôles,
 * note d'évaluation, projets liés et actions (modifier, activer/désactiver, supprimer).
 */
export function TiroirDetailTiers({
  tiersInitial,
  pays,
  peutEcrire,
  onModifier,
  onFermer,
}: {
  tiersInitial: Tiers;
  pays: string;
  peutEcrire: boolean;
  onModifier: (tiers: Tiers) => void;
  onFermer: () => void;
}) {
  const t = useTranslations("tiers.detail");
  const tTypes = useTranslations("tiers.types");
  const tRoles = useTranslations("tiers.roles");
  const tStatuts = useTranslations("tiers.statuts");
  const cache = useQueryClient();

  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  const requeteDetail = useQuery({
    queryKey: CLES_TIERS.detail(tiersInitial.id),
    queryFn: ({ signal }) => lireTiers(tiersInitial.id, signal),
    initialData: tiersInitial,
  });

  const tiers = requeteDetail.data ?? tiersInitial;
  const IconeType = tiers.typeTiers === "ENTREPRISE" ? Building2 : UserRound;

  function messageErreur(cause: unknown): string {
    return cause instanceof ErreurApi && cause.message ? cause.message : t("erreur");
  }

  const basculeStatut = useMutation({
    mutationFn: () => basculerStatutTiers(tiers.id, !tiers.estActif),
    onSuccess: (misAJour) => {
      setErreurAction(null);
      setConfirmationSuppression(false);
      toast.success(
        misAJour.estActif
          ? t("succesActivation", { nom: misAJour.raisonSociale })
          : t("succesDesactivation", { nom: misAJour.raisonSociale }),
      );
      void cache.invalidateQueries({ queryKey: CLES_TIERS.tous });
    },
    onError: (cause) => setErreurAction(messageErreur(cause)),
  });

  const suppression = useMutation({
    mutationFn: () => supprimerTiers(tiers.id),
    onSuccess: () => {
      setConfirmationSuppression(false);
      toast.success(t("succesSuppression", { nom: tiers.raisonSociale }));
      void cache.invalidateQueries({ queryKey: CLES_TIERS.tous });
      onFermer();
    },
    onError: (cause) => {
      setErreurAction(messageErreur(cause));
    },
  });

  const noteFormatee = formaterNoteEvaluation(tiers.noteEvaluation);
  const telephoneAffiche = afficherTelephone(tiers.telephone, pays || PAYS_TELEPHONE_DEFAUT);

  return (
    <>
      <Sheet open onOpenChange={(ouvert) => !ouvert && onFermer()}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <IconeType className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-lg text-neutral-900">
                  {tiers.raisonSociale}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  <span>{tTypes(tiers.typeTiers)}</span>
                  <Badge variante={tiers.estActif ? "succes" : "neutre"}>
                    {tStatuts(tiers.estActif ? "ACTIF" : "INACTIF")}
                  </Badge>
                </SheetDescription>
              </div>
            </div>

            {peutEcrire && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Bouton
                  taille="sm"
                  variante="secondaire"
                  iconeGauche={<Pencil size={14} aria-hidden="true" />}
                  onClick={() => onModifier(tiers)}
                >
                  {t("modifier")}
                </Bouton>
                <Bouton
                  taille="sm"
                  variante="secondaire"
                  iconeGauche={
                    tiers.estActif ? (
                      <PowerOff size={14} aria-hidden="true" />
                    ) : (
                      <Power size={14} aria-hidden="true" />
                    )
                  }
                  enCours={basculeStatut.isPending}
                  disabled={basculeStatut.isPending}
                  onClick={() => basculeStatut.mutate()}
                >
                  {tiers.estActif ? t("desactiver") : t("activer")}
                </Bouton>
                <Bouton
                  taille="sm"
                  variante="ghost"
                  className="text-erreur"
                  iconeGauche={<Trash2 size={14} aria-hidden="true" />}
                  onClick={() => {
                    setErreurAction(null);
                    setConfirmationSuppression(true);
                  }}
                >
                  {t("supprimer")}
                </Bouton>
              </div>
            )}
          </SheetHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            {erreurAction && !confirmationSuppression && (
              <Alerte type="erreur">{erreurAction}</Alerte>
            )}

            {/* Rôles */}
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                {t("sectionRoles")}
              </h3>
              {tiers.roles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tiers.roles.map((role) => (
                    <Badge key={role} variante="information">
                      {tRoles(role)}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">{t("aucunRole")}</p>
              )}
            </section>

            {/* Coordonnées */}
            <section className="flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
              <h3 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                {t("sectionCoordonnees")}
              </h3>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Phone className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs text-neutral-500">{t("telephone")}</dt>
                    <dd className="font-medium text-neutral-900 tabular-nums">
                      {telephoneAffiche || t("nonRenseigne")}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs text-neutral-500">{t("email")}</dt>
                    <dd className="truncate font-medium text-neutral-900">
                      {tiers.email || t("nonRenseigne")}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs text-neutral-500">{t("localisation")}</dt>
                    <dd className="font-medium text-neutral-900">
                      {[tiers.adresse, tiers.ville].filter(Boolean).join(SEPARATEUR_DETAIL) ||
                        t("nonRenseigne")}
                    </dd>
                  </div>
                </div>
              </dl>
            </section>

            {/* Informations administratives & évaluation */}
            <section className="flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-neutral-0 p-4">
              <h3 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                {t("sectionAdministratif")}
              </h3>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-neutral-500">{t("rccm")}</dt>
                  <dd className="font-medium text-neutral-900">
                    {tiers.rccm || t("nonRenseigne")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">{t("nif")}</dt>
                  <dd className="font-medium text-neutral-900">
                    {tiers.nif || t("nonRenseigne")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">{t("noteEvaluation")}</dt>
                  <dd className="inline-flex items-center gap-1 font-medium text-neutral-900 tabular-nums">
                    {noteFormatee ? (
                      <>
                        <Star className="size-4 text-avertissement" aria-hidden="true" />
                        <span>{noteFormatee}</span>
                      </>
                    ) : (
                      t("nonRenseigne")
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Projets liés */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                  {t("sectionProjetsLies", { n: tiers.projetsLies.length })}
                </h3>
              </div>
              {requeteDetail.isFetching && tiers.projetsLies.length === 0 ? (
                <EtatChargement />
              ) : tiers.projetsLies.length === 0 ? (
                <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
                  {t("aucunProjetLie")}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-neutral-0">
                  {tiers.projetsLies.map((projet) => (
                    <li
                      key={projet.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <FolderKanban
                          className="size-4 shrink-0 text-primary-600"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">
                            {projet.nom}
                          </p>
                          <p className="truncate text-xs text-neutral-500">
                            {[projet.reference, projet.ville, ...projet.relations]
                              .filter(Boolean)
                              .join(SEPARATEUR_DETAIL)}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/projets/${projet.id}`}
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                      >
                        <span>{t("ouvrirProjet")}</span>
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <Modale
        ouverte={confirmationSuppression}
        titre={t("titreSuppression")}
        onFermer={
          suppression.isPending || basculeStatut.isPending
            ? undefined
            : () => setConfirmationSuppression(false)
        }
        actions={
          <>
            <Bouton
              variante="ghost"
              disabled={suppression.isPending || basculeStatut.isPending}
              onClick={() => setConfirmationSuppression(false)}
            >
              {t("annuler")}
            </Bouton>
            {tiers.estActif && (tiers.estReference || tiers.projetsLies.length > 0 || erreurAction !== null) && (
              <Bouton
                variante="secondaire"
                iconeGauche={<PowerOff size={15} aria-hidden="true" />}
                enCours={basculeStatut.isPending}
                disabled={basculeStatut.isPending || suppression.isPending}
                onClick={() => basculeStatut.mutate()}
              >
                {t("desactiverPlutot")}
              </Bouton>
            )}
            <Bouton
              variante="danger"
              enCours={suppression.isPending}
              disabled={suppression.isPending || basculeStatut.isPending}
              onClick={() => suppression.mutate()}
            >
              {t("confirmerSuppression")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>{t("messageSuppression", { nom: tiers.raisonSociale })}</p>
          {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
        </div>
      </Modale>
    </>
  );
}

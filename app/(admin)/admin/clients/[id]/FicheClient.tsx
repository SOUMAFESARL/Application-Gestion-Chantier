"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CreditCard, Play } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alerte, Bouton, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { Input } from "@/components/ui/input";
import {
  alerteClient,
  peutAgirSurClients,
  reactivationPossible,
  suspensionPossible,
} from "@/features/administration";
import type { ClientPlateforme, CodePlan } from "@/features/administration";
import {
  changerPlan,
  lireClient,
  reactiverClient,
  suspendreClient,
} from "@/features/administration/adaptateur";
import { schemaSuspension } from "@/features/administration/validations";
import type { SaisieSuspension, ValeursSuspension } from "@/features/administration/validations";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterDate, formaterMontant, nomDePays } from "@/lib/format";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";
import {
  BADGE,
  CARTE,
  CARTE_TITRE,
  LIGNE_DEFINITION,
  LIGNE_LIBELLE,
  LIGNE_VALEUR,
  TON_ALERTE,
  TON_STATUT_ABONNEMENT,
  TON_STATUT_CLIENT,
} from "../../tons";

const PLANS: CodePlan[] = ["DECOUVERTE", "PRO", "ENTREPRISE"];

/**
 * L'identifiant qui relie le bouton du pied de modale au formulaire.
 *
 * Il est sorti du JSX pour la meme raison que `FORM_INVITER_ID` dans l'ecran
 * des collaborateurs : `no-literal-string` lit les attributs JSX et ne peut
 * pas distinguer un identifiant technique d'un libelle.
 */
const ID_FORM_SUSPENSION = "form-suspension";

/** Quelle modale est ouverte — une seule a la fois, d'ou l'union. */
type Action = "suspension" | "reactivation" | "plan" | null;

function Ligne({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className={LIGNE_DEFINITION}>
      <span className={LIGNE_LIBELLE}>{libelle}</span>
      <span className={LIGNE_VALEUR}>{valeur}</span>
    </div>
  );
}

/**
 * La fiche d'une entreprise cliente, et les trois actions du back-office.
 *
 * **Les boutons d'action disparaissent quand la regle les interdit**, plutot
 * que d'echouer au clic : `suspensionPossible` et `reactivationPossible`
 * disent la meme chose que le serveur, qui repondra `409` ou `422`. Proposer
 * une action impossible, c'est faire porter a l'utilisateur une erreur qu'on
 * pouvait lui epargner.
 *
 * Le role, lui, ne masque pas : un agent de support voit les boutons desactives
 * et lit pourquoi. Masquer lui laisserait croire que la fonction n'existe pas.
 */
export function FicheClient({ id }: { id: string }) {
  const t = useTranslations("administration");
  const profil = useAdministrateur();
  const cache = useQueryClient();

  const [action, setAction] = useState<Action>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [plan, setPlan] = useState<CodePlan>("PRO");

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.client(id),
    queryFn: () => lireClient(id),
  });

  const formulaireSuspension = useForm<SaisieSuspension, unknown, ValeursSuspension>({
    resolver: zodResolver(schemaSuspension),
    defaultValues: { motif: "" },
  });

  /** Toute mutation rafraichit la fiche **et** la liste, qui compte les statuts. */
  function apresSucces(client: ClientPlateforme) {
    cache.setQueryData(CLES_ADMINISTRATION.client(id), client);
    void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.clients() });
    setAction(null);
    setErreurAction(null);
    formulaireSuspension.reset();
  }

  function surEchec(cause: unknown) {
    setErreurAction(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
  }

  const suspension = useMutation({
    mutationFn: (valeurs: ValeursSuspension) => suspendreClient(id, valeurs.motif),
    onSuccess: apresSucces,
    onError: surEchec,
  });

  const reactivation = useMutation({
    mutationFn: () => reactiverClient(id),
    onSuccess: apresSucces,
    onError: surEchec,
  });

  const changement = useMutation({
    mutationFn: (code: CodePlan) => changerPlan(id, code),
    onSuccess: apresSucces,
    onError: surEchec,
  });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) {
    return (
      <EtatErreur
        message={t("erreurs.chargement")}
        onReessayer={() => void requete.refetch()}
      />
    );
  }

  const client = requete.data;
  const alerte = alerteClient(client);
  const peutAgir = peutAgirSurClients(profil);

  function ouvrir(suivante: Action) {
    setErreurAction(null);
    if (suivante === "plan") setPlan(client.abonnement.plan);
    setAction(suivante);
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t("fiche.retour")}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-h2 font-bold text-neutral-900">{client.nomCommercial}</h1>
          <p className="text-sm text-neutral-600">{client.raisonSociale}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${BADGE} ${TON_STATUT_CLIENT[client.statut]}`}>
              {t(`statutClient.${client.statut}`)}
            </span>
            <span className={`${BADGE} ${TON_STATUT_ABONNEMENT[client.abonnement.statut]}`}>
              {t(`statutAbonnement.${client.abonnement.statut}`)}
            </span>
            {alerte && (
              <span className={`${BADGE} ${TON_ALERTE[alerte]}`}>
                {t(`alerte.${alerte}`)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {suspensionPossible(client) && (
            <Bouton
              variante="danger"
              taille="sm"
              disabled={!peutAgir}
              iconeGauche={<Ban size={16} />}
              onClick={() => ouvrir("suspension")}
            >
              {t("fiche.suspendre")}
            </Bouton>
          )}
          {reactivationPossible(client) && (
            <Bouton
              variante="primaire"
              taille="sm"
              disabled={!peutAgir}
              iconeGauche={<Play size={16} />}
              onClick={() => ouvrir("reactivation")}
            >
              {t("fiche.reactiver")}
            </Bouton>
          )}
          <Bouton
            variante="secondaire"
            taille="sm"
            disabled={!peutAgir}
            iconeGauche={<CreditCard size={16} />}
            onClick={() => ouvrir("plan")}
          >
            {t("fiche.changerPlan")}
          </Bouton>
        </div>
      </div>

      {!peutAgir && <Alerte type="information">{t("fiche.lectureSeule")}</Alerte>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={CARTE}>
          <h2 className={CARTE_TITRE}>{t("fiche.identite")}</h2>
          <Ligne libelle={t("fiche.slug")} valeur={client.slug} />
          <Ligne libelle={t("fiche.pays")} valeur={nomDePays(client.pays)} />
          <Ligne libelle={t("fiche.ville")} valeur={client.ville || ABSENT} />
          <Ligne libelle={t("fiche.emailContact")} valeur={client.emailContact} />
          <Ligne
            libelle={t("fiche.telephoneContact")}
            valeur={client.telephoneContact || ABSENT}
          />
        </section>

        <section className={CARTE}>
          <h2 className={CARTE_TITRE}>{t("fiche.abonnement")}</h2>
          <Ligne libelle={t("fiche.plan")} valeur={t(`plan.${client.abonnement.plan}`)} />
          <Ligne
            libelle={t("fiche.montantMensuel")}
            valeur={formaterMontant(client.abonnement.montantMensuelCentimes)}
          />
          <Ligne
            libelle={t("fiche.dateFin")}
            valeur={formaterDate(client.abonnement.dateFin)}
          />
          <Ligne
            libelle={t("fiche.finEssai")}
            valeur={
              client.abonnement.finEssai
                ? formaterDate(client.abonnement.finEssai)
                : ABSENT
            }
          />
          <Ligne
            libelle={t("fiche.renouvellementAuto")}
            valeur={client.abonnement.renouvellementAuto ? t("fiche.oui") : t("fiche.non")}
          />
        </section>

        <section className={CARTE}>
          <h2 className={CARTE_TITRE}>{t("fiche.activite")}</h2>
          <Ligne libelle={t("fiche.creeLe")} valeur={formaterDate(client.creeLe)} />
          <Ligne
            libelle={t("fiche.activeLe")}
            valeur={
              client.activeLe ? formaterDate(client.activeLe) : t("fiche.jamaisActive")
            }
          />
          <Ligne libelle={t("fiche.utilisateurs")} valeur={String(client.nbUtilisateurs)} />
          <Ligne libelle={t("fiche.projets")} valeur={String(client.nbProjets)} />
        </section>
      </div>

      <Modale
        ouverte={action === "suspension"}
        titre={t("suspension.titre", { client: client.nomCommercial })}
        onFermer={() => setAction(null)}
        actions={
          <>
            <Bouton variante="ghost" onClick={() => setAction(null)}>
              {t("suspension.annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              type="submit"
              form={ID_FORM_SUSPENSION}
              enCours={suspension.isPending}
            >
              {suspension.isPending ? t("suspension.enCours") : t("suspension.confirmer")}
            </Bouton>
          </>
        }
      >
        <form
          id={ID_FORM_SUSPENSION}
          onSubmit={formulaireSuspension.handleSubmit((valeurs) =>
            suspension.mutate(valeurs),
          )}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-neutral-600">{t("suspension.description")}</p>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-800">
            {t("suspension.motif")}
            <Input
              {...formulaireSuspension.register("motif")}
              placeholder={t("suspension.motifPlaceholder")}
              disabled={suspension.isPending}
            />
          </label>
          {formulaireSuspension.formState.errors.motif && (
            <p className="text-sm text-erreur">
              {formulaireSuspension.formState.errors.motif.message}
            </p>
          )}
          {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
        </form>
      </Modale>

      <Modale
        ouverte={action === "reactivation"}
        titre={t("reactivation.titre", { client: client.nomCommercial })}
        onFermer={() => setAction(null)}
        actions={
          <>
            <Bouton variante="ghost" onClick={() => setAction(null)}>
              {t("reactivation.annuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              enCours={reactivation.isPending}
              onClick={() => reactivation.mutate()}
            >
              {reactivation.isPending
                ? t("reactivation.enCours")
                : t("reactivation.confirmer")}
            </Bouton>
          </>
        }
      >
        <p className="text-sm text-neutral-600">{t("reactivation.description")}</p>
        {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
      </Modale>

      <Modale
        ouverte={action === "plan"}
        titre={t("abonnement.titre", { client: client.nomCommercial })}
        onFermer={() => setAction(null)}
        actions={
          <>
            <Bouton variante="ghost" onClick={() => setAction(null)}>
              {t("abonnement.annuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              enCours={changement.isPending}
              onClick={() => changement.mutate(plan)}
            >
              {changement.isPending ? t("abonnement.enCours") : t("abonnement.confirmer")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">{t("abonnement.description")}</p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-neutral-800">
              {t("abonnement.plan")}
            </legend>
            {PLANS.map((code) => (
              <label
                key={code}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm has-checked:border-primary-500 has-checked:bg-primary-50"
              >
                <input
                  type="radio"
                  name="plan"
                  value={code}
                  checked={plan === code}
                  onChange={() => setPlan(code)}
                  disabled={changement.isPending}
                />
                {t(`plan.${code}`)}
              </label>
            ))}
          </fieldset>
          {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
        </div>
      </Modale>
    </div>
  );
}

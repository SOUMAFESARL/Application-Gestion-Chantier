"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  Alerte,
  Bouton,
  Champ,
  EtatChargement,
  EtatErreur,
  Modale,
} from "@/components/ui";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { peutParametrerPlateforme } from "@/features/administration";
import type {
  ChiffrementMessagerie,
  ReglageMessagerie,
  ResultatDiagnosticMessagerie,
} from "@/features/administration";
import {
  enregistrerMessagerie,
  lireMessagerie,
  reinitialiserMessagerie,
  testerMessagerie,
} from "@/features/administration/adaptateur";
import {
  schemaMessagerie,
  schemaTestMessagerie,
  type SaisieMessagerie,
  type ValeursMessagerie,
  type SaisieTestMessagerie,
  type ValeursTestMessagerie,
} from "@/features/administration/validations";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterDateHeure } from "@/lib/format";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";
import {
  BADGE,
  CARTE,
  CARTE_TITRE,
  LIGNE_DEFINITION,
  LIGNE_LIBELLE,
  LIGNE_VALEUR,
} from "../../tons";

const CHIFFREMENTS: ChiffrementMessagerie[] = ["STARTTLS", "SSL", "AUCUN"];

/** Les réglages d'un compte Gmail avec mot de passe d'application. */
const GMAIL = {
  hote: "smtp.gmail.com",
  port: 587,
  chiffrement: "STARTTLS" as ChiffrementMessagerie,
};

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className={LIGNE_DEFINITION}>
      <span className={LIGNE_LIBELLE}>{libelle}</span>
      <span className={LIGNE_VALEUR}>{valeur}</span>
    </div>
  );
}

/**
 * La messagerie de la plateforme : le serveur SMTP, et le diagnostic d'envoi.
 *
 * Le mot de passe d'application n'est jamais renvoyé par le serveur : le champ reste
 * vide, et le laisser vide conserve celui qui est enregistré. Le réglage saisi ici
 * l'emporte sur le `.env` du serveur, qui reste le repli.
 */
export function EcranMessagerie() {
  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.messagerie(),
    queryFn: lireMessagerie,
  });
  const t = useTranslations("administration");

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) {
    return (
      <EtatErreur
        message={t("erreurs.chargement")}
        onReessayer={() => void requete.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ReglageActuel reglage={requete.data} />
      <FormulaireMessagerie
        key={requete.data.saisi.modifieLe?.toISOString() ?? "initial"}
        reglage={requete.data}
      />
      <TestMessagerie />
    </div>
  );
}

function ReglageActuel({ reglage }: { reglage: ReglageMessagerie }) {
  const t = useTranslations("administration.messagerie");
  const effectif = reglage.effectif;

  return (
    <section className={CARTE}>
      <h2 className={CARTE_TITRE}>{t("actuel")}</h2>
      <div className={LIGNE_DEFINITION}>
        <span className={LIGNE_LIBELLE}>{t("origine")}</span>
        <span className={LIGNE_VALEUR}>
          <span
            className={
              effectif.source === "application"
                ? `${BADGE} border border-succes/30 bg-succes-fond text-succes`
                : `${BADGE} border border-neutral-200 bg-neutral-100 text-neutral-800`
            }
          >
            {t(`source.${effectif.source}`)}
          </span>
        </span>
      </div>
      {effectif.source === "serveur" && (
        <p className="mt-1 mb-2 text-xs text-neutral-500">
          {t("sourceServeurAide")}
        </p>
      )}
      <Ligne
        libelle={t("serveurPort")}
        valeur={`${effectif.hote}:${effectif.port}`}
      />
      <Ligne
        libelle={t("chiffrement.libelle")}
        valeur={t(`chiffrement.${effectif.chiffrement}`)}
      />
      <Ligne
        libelle={t("identifiant")}
        valeur={effectif.identifiant || ABSENT}
      />
      <Ligne
        libelle={t("expediteur")}
        valeur={effectif.expediteur || ABSENT}
      />
      <Ligne libelle={t("frontend")} valeur={reglage.frontendUrl} />
      {reglage.saisi.modifieLe && (
        <Ligne
          libelle={t("modifieLe")}
          valeur={formaterDateHeure(reglage.saisi.modifieLe)}
        />
      )}
      {reglage.frontendUrlLocale && (
        <div className="mt-3">
          <Alerte type="avertissement">{t("frontendLocale")}</Alerte>
        </div>
      )}
    </section>
  );
}

function FormulaireMessagerie({ reglage }: { reglage: ReglageMessagerie }) {
  const t = useTranslations("administration.messagerie");
  const tg = useTranslations("administration");
  const profil = useAdministrateur();
  const cache = useQueryClient();
  const peutAgir = peutParametrerPlateforme(profil);

  const [confirmationReinitialisation, setConfirmationReinitialisation] =
    useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const motDePasseRequis = !reglage.saisi.motDePasseDefini;
  const depart = reglage.saisi.hote ? reglage.saisi : reglage.effectif;

  const formulaire = useForm<SaisieMessagerie, unknown, ValeursMessagerie>({
    resolver: zodResolver(schemaMessagerie(motDePasseRequis)),
    defaultValues: {
      hote: depart.hote,
      port: depart.port,
      chiffrement: depart.chiffrement,
      identifiant: depart.identifiant,
      motDePasse: "",
      expediteur: reglage.saisi.expediteur,
    },
  });

  const enregistrement = useMutation({
    mutationFn: (donnees: ValeursMessagerie) =>
      enregistrerMessagerie({
        hote: donnees.hote.trim(),
        port: Number(donnees.port),
        chiffrement: donnees.chiffrement,
        identifiant: donnees.identifiant.trim(),
        motDePasse: donnees.motDePasse,
        expediteur: donnees.expediteur.trim(),
      }),
    onSuccess: (misAJour) => {
      cache.setQueryData(CLES_ADMINISTRATION.messagerie(), misAJour);
      setErreur(null);
      toast.success(t("succes"));
    },
    onError: (cause) => {
      if (cause instanceof ErreurApi && cause.erreursParChamp) {
        for (const [cle, message] of Object.entries(cause.erreursParChamp)) {
          const nomChamp = cle === "mot_de_passe" ? "motDePasse" : cle;
          formulaire.setError(nomChamp as keyof SaisieMessagerie, {
            message,
          });
        }
      }
      setErreur(
        cause instanceof ErreurApi ? cause.message : tg("erreurs.action"),
      );
    },
  });

  const reinitialisation = useMutation({
    mutationFn: reinitialiserMessagerie,
    onSuccess: (misAJour) => {
      cache.setQueryData(CLES_ADMINISTRATION.messagerie(), misAJour);
      setConfirmationReinitialisation(false);
      toast.success(t("reinitialisee"));
    },
    onError: (cause) => {
      setConfirmationReinitialisation(false);
      setErreur(
        cause instanceof ErreurApi ? cause.message : tg("erreurs.action"),
      );
    },
  });

  function appliquerGmail() {
    formulaire.setValue("hote", GMAIL.hote, { shouldValidate: true });
    formulaire.setValue("port", GMAIL.port, { shouldValidate: true });
    formulaire.setValue("chiffrement", GMAIL.chiffrement, {
      shouldValidate: true,
    });
  }

  const soumettre = formulaire.handleSubmit((donnees) => {
    setErreur(null);
    enregistrement.mutate(donnees);
  });

  const verrouille =
    !peutAgir || enregistrement.isPending || reinitialisation.isPending;

  return (
    <>
      <form noValidate onSubmit={soumettre} className={CARTE}>
        <h2 className={CARTE_TITRE}>{t("formulaire")}</h2>

        <Champ
          libelle={t("hote")}
          aide={t("hoteAide")}
          required
          autoComplete="off"
          {...formulaire.register("hote")}
          erreur={formulaire.formState.errors.hote?.message}
          disabled={verrouille}
        />

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Champ
            libelle={t("port")}
            required
            inputMode="numeric"
            {...formulaire.register("port")}
            erreur={formulaire.formState.errors.port?.message}
            disabled={verrouille}
          />
          <div className="mb-4 flex flex-col gap-1">
            <Label
              htmlFor="messagerie-chiffrement"
              className="text-sm font-semibold text-neutral-800"
            >
              {t("chiffrement.libelle")}
            </Label>
            <Controller
              control={formulaire.control}
              name="chiffrement"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={verrouille}
                >
                  <SelectTrigger
                    id="messagerie-chiffrement"
                    className="h-[var(--input-height)] w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHIFFREMENTS.map((code) => (
                      <SelectItem key={code} value={code}>
                        {t(`chiffrement.${code}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <Champ
          libelle={t("identifiant")}
          required
          type="email"
          autoComplete="off"
          {...formulaire.register("identifiant")}
          erreur={formulaire.formState.errors.identifiant?.message}
          disabled={verrouille}
        />

        <Champ
          libelle={t("motDePasse")}
          required={motDePasseRequis}
          type="password"
          autoComplete="new-password"
          {...formulaire.register("motDePasse")}
          aide={
            reglage.saisi.motDePasseDefini
              ? t("motDePasseDefini")
              : t("motDePasseAide")
          }
          erreur={formulaire.formState.errors.motDePasse?.message}
          disabled={verrouille}
        />

        <Champ
          libelle={t("expediteur")}
          aide={t("expediteurAide")}
          autoComplete="off"
          {...formulaire.register("expediteur")}
          disabled={verrouille}
        />

        {erreur && (
          <div className="mb-4">
            <Alerte type="erreur">{erreur}</Alerte>
          </div>
        )}

        {peutAgir && (
          <div className="mt-2 flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Bouton
                variante="ghost"
                disabled={verrouille}
                onClick={appliquerGmail}
              >
                {t("gmail")}
              </Bouton>
              {reglage.saisi.hote && (
                <Bouton
                  variante="ghost"
                  disabled={verrouille}
                  onClick={() => setConfirmationReinitialisation(true)}
                >
                  {t("reinitialiser")}
                </Bouton>
              )}
            </div>
            <Bouton
              type="submit"
              variante="primaire"
              enCours={enregistrement.isPending}
              disabled={verrouille}
            >
              {enregistrement.isPending ? t("enCours") : t("enregistrer")}
            </Bouton>
          </div>
        )}
      </form>

      <Modale
        ouverte={confirmationReinitialisation}
        titre={t("reinitialiserConfirmerTitre")}
        onFermer={() => {
          if (!reinitialisation.isPending) {
            setConfirmationReinitialisation(false);
          }
        }}
        actions={
          <>
            <Bouton
              variante="secondaire"
              disabled={reinitialisation.isPending}
              onClick={() => setConfirmationReinitialisation(false)}
            >
              {t("annuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              enCours={reinitialisation.isPending}
              onClick={() => reinitialisation.mutate()}
            >
              {t("reinitialiserConfirmerBouton")}
            </Bouton>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          {t("reinitialiserConfirmerTexte")}
        </p>
      </Modale>
    </>
  );
}

function TestMessagerie() {
  const t = useTranslations("administration.messagerie.test");
  const tg = useTranslations("administration");
  const profil = useAdministrateur();
  const peutAgir = peutParametrerPlateforme(profil);

  const [resultat, setResultat] =
    useState<ResultatDiagnosticMessagerie | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const formulaire = useForm<SaisieTestMessagerie, unknown, ValeursTestMessagerie>({
    resolver: zodResolver(schemaTestMessagerie),
    defaultValues: {
      destinataire: profil?.email ?? "",
    },
  });

  const test = useMutation({
    mutationFn: (donnees: ValeursTestMessagerie) =>
      testerMessagerie(donnees.destinataire.trim()),
    onSuccess: (diagnostic) => {
      setResultat(diagnostic);
      setErreur(null);
    },
    onError: (cause) => {
      setResultat(null);
      setErreur(
        cause instanceof ErreurApi ? cause.message : tg("erreurs.action"),
      );
    },
  });

  const soumettre = formulaire.handleSubmit((donnees) => {
    setResultat(null);
    setErreur(null);
    test.mutate(donnees);
  });

  return (
    <form noValidate onSubmit={soumettre} className={CARTE}>
      <h2 className={CARTE_TITRE}>{t("titre")}</h2>
      <p className="mb-3 text-sm text-neutral-600">{t("description")}</p>

      <Champ
        libelle={t("destinataire")}
        type="email"
        autoComplete="off"
        {...formulaire.register("destinataire")}
        erreur={formulaire.formState.errors.destinataire?.message}
        disabled={!peutAgir || test.isPending}
      />

      {erreur && (
        <div className="mb-4">
          <Alerte type="erreur">{erreur}</Alerte>
        </div>
      )}

      {resultat?.succes && (
        <div className="mb-4">
          <Alerte type="succes">{t("reussi")}</Alerte>
        </div>
      )}

      {resultat && !resultat.succes && (
        <div className="mb-4">
          <Alerte type="erreur">
            <div className="flex flex-col gap-1.5">
              <strong>
                {resultat.etape === "connexion"
                  ? t("echecConnexion")
                  : t("echecEnvoi")}
              </strong>
              {resultat.erreur && (
                <span>
                  {t("erreurServeur")} :{" "}
                  <code className="break-all">{resultat.erreur}</code>
                </span>
              )}
              {resultat.nomEhlo && (
                <span>
                  {t("nomEhlo")} :{" "}
                  <code className="break-all">{resultat.nomEhlo}</code>
                </span>
              )}
              {resultat.sonde?.etape && (
                <span>
                  {t("etapeEnEchec")} : {t(`etape.${resultat.sonde.etape}`)}
                  {resultat.sonde.detail && (
                    <code className="ml-1 break-all">
                      ({resultat.sonde.detail})
                    </code>
                  )}
                </span>
              )}
              {resultat.alternatives.map((alternative) => (
                <span key={`${alternative.port}-${alternative.chiffrement}`}>
                  {t("alternative", {
                    port: alternative.port,
                    mode: alternative.chiffrement,
                    etat: alternative.ok
                      ? t("alternativeOk")
                      : t("alternativeEchec", {
                          etape: alternative.etape
                            ? t(`etape.${alternative.etape}`)
                            : "",
                        }),
                  })}
                </span>
              ))}
              {resultat.conseil && (
                <span>
                  {t("conseil")} : {resultat.conseil}
                </span>
              )}
            </div>
          </Alerte>
        </div>
      )}

      {peutAgir && (
        <div className="mt-2 flex justify-end">
          <Bouton type="submit" variante="primaire" enCours={test.isPending}>
            {test.isPending ? t("enCours") : t("envoyer")}
          </Bouton>
        </div>
      )}
    </form>
  );
}

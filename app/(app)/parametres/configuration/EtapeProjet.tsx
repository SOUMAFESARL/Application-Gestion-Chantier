"use client";

import { CheckCircle2, Circle, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { SelecteurVille } from "@/components/metier/SelecteurVille";
import { obtenirProfilMoi } from "@/features/auth/api";
import type { ProfilUtilisateur } from "@/features/auth/api";
import {
  creerPremierProjet,
  lireRecapitulatif,
  modifierPremierProjet,
  paysEntreprise,
} from "@/features/configuration/api";
import { brouillonNonVide, useBrouillon } from "@/features/configuration/brouillon";
import { schemaCourant, utilisateurCourant } from "@/features/configuration/session";
import { telephoneValide } from "@/features/referentiels/telephone";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formaterMontant } from "@/lib/format";

import { Alerte, Bouton, Champ } from "./_ui";

interface Saisie {
  nom: string;
  client_raison_sociale: string;
  client_telephone: string;
  ville: string;
  date_debut_prevue: string;
  date_fin_prevue: string;
  /** Saisi en **francs** ; converti en centimes à l'envoi (conventions §6). Facultatif. */
  budget_francs: string;
  description: string;
  cp_nom: string;
  cp_prenom: string;
  cp_email: string;
  cp_telephone: string;
}

const VIDE: Saisie = {
  nom: "",
  client_raison_sociale: "",
  client_telephone: "",
  ville: "",
  date_debut_prevue: "",
  date_fin_prevue: "",
  budget_francs: "",
  description: "",
  cp_nom: "",
  cp_prenom: "",
  cp_email: "",
  cp_telephone: "",
};

interface Props {
  enCours: boolean;
  onSaisie: (enCours: boolean) => void;
  onRetour: () => void;
  onValide: () => void;
  onPasser: () => void;
}

function francs(valeur: string): number {
  return Number(valeur.replace(/[^\d]/g, "") || 0);
}

/**
 * Étape 2 — le premier projet (facultatif).
 *
 * En conformité avec la refonte Sprint 1 :
 *   · Étape facultative : peut être passée via onPasser ;
 *   · Budget facultatif : envoyé à null si non renseigné ;
 *   · DG non assignable comme CP : si l'utilisateur connecté est DG,
 *     il délègue à un CP (invitation) ou passe l'étape.
 */
export function EtapeProjet({ enCours, onSaisie, onRetour, onValide, onPasser }: Props) {
  const t = useTranslations("configuration.projet");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [existant, setExistant] = useState<{ projetId: string; tiersId: string } | null>(null);
  const [profil, setProfil] = useState<ProfilUtilisateur | null>(null);
  const [pays, setPays] = useState("");

  const schema = schemaCourant();
  const utilisateur = utilisateurCourant();

  useEffect(() => {
    let vivant = true;
    obtenirProfilMoi()
      .then((p) => {
        if (vivant) setProfil(p);
      })
      .catch(() => {});
    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const estDG = Boolean(profil?.is_dg || profil?.role_global === "DG");

  const [saisie, enregistrer, oublier] = useBrouillon<Saisie>(
    schema,
    utilisateur,
    "PROJET",
    VIDE,
  );

  useEffect(() => {
    lireRecapitulatif()
      .then((recap) => {
        const p = recap.projet as {
          id?: string;
          nom?: string;
          ville?: string;
          date_debut_prevue?: string;
          date_fin_prevue?: string;
          budget_initial_montant?: number | null;
          description?: string;
          client?: { id?: string; raison_sociale?: string; telephone?: string };
        } | null;

        if (p?.id && p.client?.id) {
          setExistant({ projetId: p.id, tiersId: p.client.id });
          if (!saisie.nom) {
            const suite: Saisie = {
              ...saisie,
              nom: p.nom || "",
              client_raison_sociale: p.client.raison_sociale || "",
              client_telephone: p.client.telephone || "",
              ville: p.ville || "",
              date_debut_prevue: p.date_debut_prevue || "",
              date_fin_prevue: p.date_fin_prevue || "",
              budget_francs: p.budget_initial_montant
                ? String(Math.round(p.budget_initial_montant / 100))
                : "",
              description: p.description || "",
            };
            enregistrer(suite);
            onSaisie(brouillonNonVide(suite as unknown as Record<string, unknown>));
          }
        }
      })
      .catch(() => {
        // En cas d'erreur de récupération, on garde l'état actuel
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function modifier(champ: keyof Saisie, valeur: string) {
    const suite = { ...saisie, [champ]: valeur };
    enregistrer(suite);
    onSaisie(brouillonNonVide(suite as unknown as Record<string, unknown>));
    if (champ in erreurs) {
      const reste = { ...erreurs };
      delete reste[champ];
      setErreurs(reste);
    }
  }

  const datesCoherentes =
    Boolean(saisie.date_debut_prevue) &&
    Boolean(saisie.date_fin_prevue) &&
    saisie.date_fin_prevue > saisie.date_debut_prevue;

  const controles = [
    { cle: "nom", satisfait: saisie.nom.trim().length > 0 },
    { cle: "client", satisfait: saisie.client_raison_sociale.trim().length > 0 },
    { cle: "localisation", satisfait: saisie.ville.trim().length > 0 },
    { cle: "dates", satisfait: datesCoherentes },
  ];

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();

    const trouvees: Record<string, string> = {};
    if (!saisie.nom.trim()) trouvees.nom = t("erreurNom");
    if (!saisie.client_raison_sociale.trim())
      trouvees.client_raison_sociale = t("erreurClient");
    if (!saisie.client_telephone.trim())
      trouvees.client_telephone = t("erreurClientTelephone");
    else if (!telephoneValide(saisie.client_telephone, pays))
      trouvees.client_telephone = t("erreurClientTelephoneIncomplet");
    if (saisie.cp_telephone.trim() && !telephoneValide(saisie.cp_telephone, pays))
      trouvees.cp_telephone = t("erreurCpTelephoneIncomplet");
    if (!saisie.ville.trim()) trouvees.ville = t("erreurVille");
    if (!saisie.date_debut_prevue) trouvees.date_debut_prevue = t("erreurDateDebut");
    if (!saisie.date_fin_prevue) trouvees.date_fin_prevue = t("erreurDateFin");
    else if (!datesCoherentes)
      trouvees.date_fin_prevue = t("erreurDatesIncoherentes");

    if (estDG) {
      if (!saisie.cp_nom.trim()) trouvees.cp_nom = t("erreurCpNom");
      if (!saisie.cp_prenom.trim()) trouvees.cp_prenom = t("erreurCpPrenom");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saisie.cp_email))
        trouvees.cp_email = t("erreurCpEmail");
    }

    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) return;

    setEnvoi(true);
    setEchec(null);
    try {
      const montantBudget = francs(saisie.budget_francs);
      const payload: Parameters<typeof creerPremierProjet>[0] = {
        nom: saisie.nom.trim(),
        client_raison_sociale: saisie.client_raison_sociale.trim(),
        client_telephone: saisie.client_telephone.trim(),
        ville: saisie.ville.trim(),
        date_debut_prevue: saisie.date_debut_prevue,
        date_fin_prevue: saisie.date_fin_prevue,
        budget_initial_montant: montantBudget > 0 ? montantBudget * 100 : null,
        description: saisie.description.trim(),
      };

      if (estDG) {
        const invitePayload = {
          nom: saisie.cp_nom.trim(),
          prenom: saisie.cp_prenom.trim(),
          email: saisie.cp_email.trim().toLowerCase(),
          telephone: saisie.cp_telephone.trim(),
        };
        payload.conducteur_travaux_invite = invitePayload;
        payload.chef_projet_invite = invitePayload;
      } else if (profil?.id) {
        payload.conducteur_travaux_id = profil.id;
        payload.chef_projet_id = profil.id;
      }

      if (existant?.projetId && existant?.tiersId) {
        await modifierPremierProjet(existant.projetId, existant.tiersId, payload);
      } else {
        await creerPremierProjet(payload);
      }
      oublier();
      onSaisie(false);
      onValide();
    } catch (cause) {
      setEchec((cause as ErreurApi).message);
    } finally {
      setEnvoi(false);
    }
  }

  function passer() {
    oublier();
    onSaisie(false);
    onPasser();
  }

  const apercuBudget =
    francs(saisie.budget_francs) > 0
      ? formaterMontant(francs(saisie.budget_francs) * 100)
      : undefined;

  return (
    <form className="flex flex-col gap-6" onSubmit={soumettre} noValidate>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("titre")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("accroche")}</p>
        </div>

        {echec && (
          <Alerte type="erreur" titre={t("echecTitre")}>
            {echec}
          </Alerte>
        )}

        <Champ
          libelle={t("champNom")}
          required
          placeholder={t("champNomExemple")}
          value={saisie.nom}
          erreur={erreurs.nom}
          disabled={envoi || enCours}
          onChange={(e) => modifier("nom", e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle={t("champClient")}
            required
            placeholder={t("champClientExemple")}
            value={saisie.client_raison_sociale}
            erreur={erreurs.client_raison_sociale}
            disabled={envoi || enCours}
            onChange={(e) => modifier("client_raison_sociale", e.target.value)}
          />
          <ChampTelephone
            libelle={t("champTelephone")}
            paysDefaut={pays}
            required
            aide={t("champTelephoneAide")}
            valeur={saisie.client_telephone}
            erreur={erreurs.client_telephone}
            disabled={envoi || enCours}
            onChange={(numero) => modifier("client_telephone", numero)}
          />
        </div>

        <SelecteurVille
          pays={pays}
          libelle={t("champLocalisation")}
          required
          valeur={saisie.ville}
          erreur={erreurs.ville}
          disabled={envoi || enCours}
          onChange={(nouvelleVille) => modifier("ville", nouvelleVille)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle={t("champDebut")}
            type="date"
            required
            value={saisie.date_debut_prevue}
            erreur={erreurs.date_debut_prevue}
            disabled={envoi || enCours}
            onChange={(e) => modifier("date_debut_prevue", e.target.value)}
          />
          <Champ
            libelle={t("champFin")}
            type="date"
            required
            value={saisie.date_fin_prevue}
            erreur={erreurs.date_fin_prevue}
            disabled={envoi || enCours}
            onChange={(e) => modifier("date_fin_prevue", e.target.value)}
          />
        </div>

        <Champ
          libelle={t("champBudget")}
          inputMode="numeric"
          placeholder={t("champBudgetExemple")}
          value={saisie.budget_francs}
          erreur={erreurs.budget_francs}
          aide={apercuBudget ?? t("champBudgetAide")}
          disabled={envoi || enCours}
          onChange={(e) => modifier("budget_francs", e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="description">
            {t("champDescription")}
          </label>
          <textarea
            id="description"
            className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-neutral-900 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            rows={3}
            placeholder={t("champDescriptionExemple")}
            value={saisie.description}
            disabled={envoi || enCours}
            onChange={(e) => modifier("description", e.target.value)}
          />
        </div>

        {estDG ? (
          <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">{t("sectionChefProjet")}</h3>
            <Alerte type="information">{t("delegationCpAide")}</Alerte>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ
                libelle={t("champCpNom")}
                required
                value={saisie.cp_nom}
                erreur={erreurs.cp_nom}
                disabled={envoi || enCours}
                onChange={(e) => modifier("cp_nom", e.target.value)}
              />
              <Champ
                libelle={t("champCpPrenom")}
                required
                value={saisie.cp_prenom}
                erreur={erreurs.cp_prenom}
                disabled={envoi || enCours}
                onChange={(e) => modifier("cp_prenom", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ
                libelle={t("champCpEmail")}
                type="email"
                required
                value={saisie.cp_email}
                erreur={erreurs.cp_email}
                disabled={envoi || enCours}
                onChange={(e) => modifier("cp_email", e.target.value)}
              />
              <ChampTelephone
                libelle={t("champCpTelephone")}
                paysDefaut={pays}
                aide={t("champCpTelephoneAide")}
                valeur={saisie.cp_telephone}
                erreur={erreurs.cp_telephone}
                disabled={envoi || enCours}
                onChange={(numero) => modifier("cp_telephone", numero)}
              />
            </div>
          </div>
        ) : (
          <Alerte type="information">
            {t.rich("vousSerezChef", { fort: (morceaux) => <strong>{morceaux}</strong> })}
          </Alerte>
        )}
      </div>

      <aside className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3" aria-live="polite">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("facultativeTitre")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t.rich("facultativeCorps", { fort: (morceaux) => <strong className="text-foreground">{morceaux}</strong> })}
        </p>

        <h3 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("aRenseigner")}
        </h3>
        <ul className="flex flex-col gap-1.5">
          {controles.map((controle) => (
            <li
              key={controle.cle}
              className={cn(
                "flex items-center gap-2 text-sm",
                controle.satisfait ? "text-succes" : "text-muted-foreground",
              )}
            >
              {controle.satisfait ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              {t(`controle.${controle.cle}`)}
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info size={13} aria-hidden="true" /> {t("referenceAuto")}
        </p>
      </aside>

      <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Bouton variante="secondaire" taille="lg" onClick={onRetour} disabled={envoi}>
          {t("precedent")}
        </Bouton>
        <Bouton variante="ghost" taille="lg" onClick={passer} disabled={envoi || enCours}>
          {t("passer")}
        </Bouton>
        <Bouton type="submit" taille="lg" enCours={envoi || enCours}>
          {t("continuer")}
        </Bouton>
      </footer>
    </form>
  );
}

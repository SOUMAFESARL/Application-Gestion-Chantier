"use client";

import { CheckCircle, Circle, Info } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { SelecteurVille } from "@/components/metier/SelecteurVille";
import { Alerte, Bouton, Champ } from "@/components/ui";
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
import { formaterMontant } from "@/lib/format";

import styles from "./page.module.css";

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
  // Le pays de l'entreprise gouverne la liste des villes et l'indicatif
  // proposé. Vide au premier rendu : le champ ville reste alors en saisie
  // libre le temps d'un aller-retour, ce qui est préférable à une liste
  // ivoirienne affichée par défaut chez un client togolais.
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
    // Le téléphone du chef de projet est facultatif — mais s'il est renseigné,
    // il doit être joignable : c'est la personne qu'on appelle depuis le
    // chantier.
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
    <form className={styles.etape} onSubmit={soumettre} noValidate>
      <div className={styles.colonneFormulaire}>
        <h2 className={styles.etapeTitre}>{t("titre")}</h2>
        <p className={styles.etapeAccroche}>{t("accroche")}</p>

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

        <div className={styles.duo}>
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

        <div className={styles.duo}>
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

        <div className={styles.groupeZone}>
          <label className={styles.libelleBloc} htmlFor="description">
            {t("champDescription")}
          </label>
          <textarea
            id="description"
            className={styles.zone}
            rows={3}
            placeholder={t("champDescriptionExemple")}
            value={saisie.description}
            disabled={envoi || enCours}
            onChange={(e) => modifier("description", e.target.value)}
          />
        </div>

        {estDG ? (
          <div className={styles.ajout}>
            <h3 className={styles.ajoutTitre}>{t("sectionChefProjet")}</h3>
            <Alerte type="information">{t("delegationCpAide")}</Alerte>
            <div className={styles.duo}>
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
            <div className={styles.duo}>
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

      <aside className={styles.controles} aria-live="polite">
        <h3 className={styles.controlesTitre}>{t("facultativeTitre")}</h3>
        <p className={styles.controlesNote}>
          {t.rich("facultativeCorps", { fort: (morceaux) => <strong>{morceaux}</strong> })}
        </p>

        <h3 className={styles.controlesTitre} style={{ marginTop: "1.5rem" }}>
          {t("aRenseigner")}
        </h3>
        <ul>
          {controles.map((controle) => (
            <li
              key={controle.cle}
              className={controle.satisfait ? styles.controleValide : styles.controle}
            >
              {controle.satisfait ? (
                <CheckCircle size={16} weight="fill" aria-hidden="true" />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              {t(`controle.${controle.cle}`)}
            </li>
          ))}
        </ul>
        <p className={styles.controlesNote}>
          <Info size={14} aria-hidden="true" /> {t("referenceAuto")}
        </p>
      </aside>

      <footer className={styles.actions}>
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

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { SelecteurVille } from "@/components/metier/SelecteurVille";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { Modale } from "@/components/ui/Modale";
import { paysEntreprise } from "@/features/configuration/api";
import { creerProjet } from "@/features/projets/api";
import type { CreationProjetPayload, ProjetDetail } from "@/features/projets/api";
import { api } from "@/lib/api";
import type { ErreurApi } from "@/lib/api";

import styles from "./ModalCreationProjet.module.css";

interface ClientOption {
  id: string;
  raison_sociale: string;
}

interface UtilisateurOption {
  id: string;
  nom: string;
  prenom: string;
}

const CLIENTS_INITIAUX: ClientOption[] = [
  { id: "4a180182-e35b-4c4f-9e73-b5419b165b4c", raison_sociale: "SCI Les Lagunes" },
  { id: "7a180182-e35b-4c4f-9e73-b5419b165b4d", raison_sociale: "Banque Atlantique CI" },
];

const UTILISATEURS_INITIAUX: UtilisateurOption[] = [
  { id: "77e382d5-8276-4d10-8fa8-f40409c9ba1b", nom: "Zanfack", prenom: "Manson" },
  { id: "88e382d5-8276-4d10-8fa8-f40409c9ba1c", nom: "Kouamé", prenom: "Koffi" },
];

const FORM_ID = "form-creation-projet";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  onProjetCree?: (projet: ProjetDetail) => void;
}

export function ModalCreationProjet({ ouverte, onFermer, onProjetCree }: Props) {
  const t = useTranslations("tableauDeBord.modalCreation");

  const [nom, setNom] = useState("");
  const [clientId, setClientId] = useState(CLIENTS_INITIAUX[0].id);
  const [clients, setClients] = useState<ClientOption[]>(CLIENTS_INITIAUX);
  // Vide, et non « Abidjan » : ce n'est pas une commune, aucune liste ne la
  // propose, et ce serait de toute façon faux hors de Côte d'Ivoire.
  const [ville, setVille] = useState("");
  const [pays, setPays] = useState("");
  const [quartier, setQuartier] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");

  // Mode Chef de projet : existant ou invitation express
  const [modeCp, setModeCp] = useState<"existant" | "inviter">("inviter");
  const [cpId, setCpId] = useState(UTILISATEURS_INITIAUX[0].id);
  const utilisateurs = UTILISATEURS_INITIAUX;

  // Nouveaux champs invitation express CP (avec WhatsApp)
  const [cpNom, setCpNom] = useState("");
  const [cpPrenom, setCpPrenom] = useState("");
  const [cpEmail, setCpEmail] = useState("");
  const [cpTelephone, setCpTelephone] = useState("");

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Chargement asynchrone des tiers clients existants
  useEffect(() => {
    let vivant = true;
    api
      .lire<ClientOption[]>("/tiers/")
      .then((liste) => {
        if (vivant && Array.isArray(liste) && liste.length > 0) {
          setClients(liste);
        }
      })
      .catch(() => {
        // Maintient la liste par défaut
      });

    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });

    return () => {
      vivant = false;
    };
  }, []);

  async function handleSoumettre(e: FormEvent) {
    e.preventDefault();
    if (enCours) return;

    setErreur(null);
    setEnCours(true);

    try {
      const budgetCentimes =
        budget.trim() !== "" ? Math.round(Number(budget) * 100) : null;

      const payload: CreationProjetPayload = {
        nom: nom.trim(),
        client: clientId || CLIENTS_INITIAUX[0].id,
        ville: ville.trim() || "Abidjan",
        quartier: quartier.trim() || undefined,
        date_debut_prevue: dateDebut || new Date().toISOString().split("T")[0],
        date_fin_prevue:
          dateFin ||
          new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split("T")[0],
        budget_initial_montant: budgetCentimes,
        description: description.trim() || undefined,
      };

      if (modeCp === "existant") {
        payload.conducteur_travaux_id = cpId;
        payload.chef_projet_id = cpId;
      } else {
        const invitePayload = {
          nom: cpNom.trim(),
          prenom: cpPrenom.trim(),
          email: cpEmail.trim(),
          telephone: cpTelephone.trim(),
        };
        payload.conducteur_travaux_invite = invitePayload;
        payload.chef_projet_invite = invitePayload;
      }

      const projetCree = await creerProjet(payload);
      onProjetCree?.(projetCree);
      onFermer();
    } catch (err) {
      const cause = err as ErreurApi;
      setErreur(cause.message || t("erreurGenerique"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale
      ouverte={ouverte}
      onFermer={onFermer}
      titre={t("titre")}
      actions={
        <div className={styles.actionsPied}>
          <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Bouton>
          <Bouton variante="primaire" type="submit" form={FORM_ID} disabled={enCours}>
            {t("creer")}
          </Bouton>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={handleSoumettre} className={styles.formulaire}>
        <p style={{ color: "var(--color-neutral-600, #6B6762)", fontSize: "14px", margin: 0 }}>
          {t("sousTitre")}
        </p>

        {erreur && <Alerte type="erreur">{erreur}</Alerte>}

        <Champ
          libelle={t("champNom")}
          placeholder={t("champNomPlaceholder")}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
        />

        <div className={styles.selectGroupe}>
          <label className={styles.selectLibelle} htmlFor="select-client">
            {t("champClient")} *
          </label>
          <select
            id="select-client"
            className={styles.selectInput}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raison_sociale}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.grille2}>
          <SelecteurVille
            pays={pays}
            libelle={t("champVille")}
            valeur={ville}
            onChange={setVille}
            required
          />
          <Champ
            libelle={t("champQuartier")}
            value={quartier}
            onChange={(e) => setQuartier(e.target.value)}
          />
        </div>

        <div className={styles.grille2}>
          <Champ
            libelle={t("champDateDebut")}
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            required
          />
          <Champ
            libelle={t("champDateFin")}
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            required
          />
        </div>

        <Champ
          libelle={t("champBudget")}
          type="number"
          min="0"
          step="1000"
          placeholder={t("champBudgetPlaceholder")}
          aide={t("champBudgetFacultatif")}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />

        <Champ
          libelle={t("champDescription")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className={styles.sectionCp}>
          <div className={styles.sectionTitre}>{t("sectionChefProjet")}</div>

          <div className={styles.choixCpMode}>
            <label className={styles.labelRadio}>
              <input
                type="radio"
                name="modeCp"
                value="inviter"
                checked={modeCp === "inviter"}
                onChange={() => setModeCp("inviter")}
              />
              <span>{t("optionCpInviter")}</span>
            </label>
            <label className={styles.labelRadio}>
              <input
                type="radio"
                name="modeCp"
                value="existant"
                checked={modeCp === "existant"}
                onChange={() => setModeCp("existant")}
              />
              <span>{t("optionCpExistant")}</span>
            </label>
          </div>

          {modeCp === "inviter" ? (
            <>
              <div className={styles.grille2}>
                <Champ
                  libelle={t("champCpNom")}
                  value={cpNom}
                  onChange={(e) => setCpNom(e.target.value)}
                  required
                />
                <Champ
                  libelle={t("champCpPrenom")}
                  value={cpPrenom}
                  onChange={(e) => setCpPrenom(e.target.value)}
                  required
                />
              </div>
              <div className={styles.grille2}>
                <Champ
                  libelle={t("champCpEmail")}
                  type="email"
                  value={cpEmail}
                  onChange={(e) => setCpEmail(e.target.value)}
                  required
                />
                <ChampTelephone
                  libelle={t("champCpTelephone")}
                  paysDefaut={pays}
                  valeur={cpTelephone}
                  onChange={setCpTelephone}
                  required
                />
              </div>
            </>
          ) : (
            <div className={styles.selectGroupe}>
              <label className={styles.selectLibelle} htmlFor="select-cp-existant">
                {t("optionCpExistant")}
              </label>
              <select
                id="select-cp-existant"
                className={styles.selectInput}
                value={cpId}
                onChange={(e) => setCpId(e.target.value)}
                required
              >
                {utilisateurs.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.prenom} {u.nom}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </form>
    </Modale>
  );
}

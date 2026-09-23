"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { SelecteurVille } from "@/components/metier/SelecteurVille";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { paysEntreprise } from "@/features/configuration/api";
import { creerProjet } from "@/features/projets/adaptateur";
import { datesParDefaut } from "@/features/projets/regles";
import {
  COLLABORATEURS_DEMONSTRATION,
  OPTIONS_CLIENTS_DEMONSTRATION,
} from "@/features/projets/simulationProjets";
import type { CreationProjet, InvitationIntervenant, Projet } from "@/features/projets/types";
import { listerTiers } from "@/features/tiers/adaptateur";
import type { TiersOption } from "@/features/tiers/types";
import type { ErreurApi } from "@/lib/api";
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";
import { saisieEnCentimes } from "@/lib/format";

/**
 * Les listes de repli viennent du jeu de démonstration du domaine, et non
 * d'une copie locale : c'est lui qui retrouvera la raison sociale du client
 * à partir de l'identifiant soumis ici. Deux copies, et un chantier
 * fraîchement créé s'afficherait sous un client inconnu.
 */
const CLIENTS_INITIAUX: TiersOption[] = OPTIONS_CLIENTS_DEMONSTRATION;

const UTILISATEURS_INITIAUX = COLLABORATEURS_DEMONSTRATION;

const FORM_ID = "form-creation-projet";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  onProjetCree?: (projet: Projet) => void;
}

/**
 * La création d'un chantier, dans un **tiroir** et non dans une modale.
 *
 * Le formulaire compte treize champs : dans une modale centrée, il fallait
 * lui donner son propre défilement interne (`max-h-[70vh] overflow-y-auto`)
 * et il restait à l'étroit sur un portable. Un tiroir latéral prend toute
 * la hauteur disponible, garde l'écran qu'on quitte visible derrière lui, et
 * devient plein écran sur téléphone sans changer de composant.
 *
 * Le piégeage du focus, la touche Échap et le verrouillage du défilement de
 * la page viennent de Radix (`components/ui/sheet`) — c'est le même contrat
 * d'accessibilité que `Modale` tenait à la main.
 */

export function TiroirCreationProjet({ ouverte, onFermer, onProjetCree }: Props) {
  const t = useTranslations("projets.tiroirCreation");

  const [nom, setNom] = useState("");
  const [clientId, setClientId] = useState(CLIENTS_INITIAUX[0].id);
  const [clients, setClients] = useState<TiersOption[]>(CLIENTS_INITIAUX);
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

    /**
     * Sous simulation, on **ne lit pas** les vrais tiers : le chantier créé
     * est écrit par `simulationProjets`, qui ne connaît que les clients de
     * démonstration. Un identifiant venu du serveur ne s'y retrouverait pas,
     * et la ligne s'afficherait sous une raison sociale qui n'est pas la sienne.
     */
    if (!SIMULATION_ACTIVE) {
      listerTiers()
        .then((liste) => {
          if (vivant && liste.length > 0) {
            setClients(liste);
          }
        })
        .catch(() => {
          // Maintient la liste par défaut
        });
    }

    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });

    return () => {
      vivant = false;
    };
  }, []);

  /**
   * La saisie repart à vide après une création réussie.
   *
   * Le tiroir reste monté entre deux ouvertures : sans cette remise à zéro,
   * l'utilisateur qui ouvre deux chantiers de suite retrouve le nom, les
   * dates et le conducteur de travaux du précédent — et crée un doublon
   * sans s'en apercevoir. Ce n'est **pas** fait à la fermeture : un abandon
   * involontaire ne doit pas effacer un formulaire à moitié rempli.
   */
  function reinitialiser() {
    setNom("");
    setClientId(clients[0]?.id ?? "");
    setVille("");
    setQuartier("");
    setDateDebut("");
    setDateFin("");
    setBudget("");
    setDescription("");
    setCpNom("");
    setCpPrenom("");
    setCpEmail("");
    setCpTelephone("");
    setErreur(null);
  }

  async function handleSoumettre(e: FormEvent) {
    e.preventDefault();
    if (enCours) return;

    setErreur(null);
    setEnCours(true);

    try {
      const defauts = datesParDefaut();

      const creation: CreationProjet = {
        nom: nom.trim(),
        clientId: clientId || CLIENTS_INITIAUX[0].id,
        ville: ville.trim(),
        quartier: quartier.trim() || undefined,
        dateDebutPrevue: dateDebut || defauts.debut,
        dateFinPrevue: dateFin || defauts.fin,
        // Le franc CFA n'a pas de subdivision : la conversion en centimes est
        // celle de `lib/format`, la même que sur tous les autres montants du
        // produit. La modale en tenait une copie, qui arrondissait autrement.
        budgetInitial: saisieEnCentimes(budget),
        description: description.trim() || undefined,
      };

      if (modeCp === "existant") {
        creation.conducteurTravauxId = cpId;
        creation.chefProjetId = cpId;
      } else {
        const invitation: InvitationIntervenant = {
          nom: cpNom.trim(),
          prenom: cpPrenom.trim(),
          email: cpEmail.trim(),
          telephone: cpTelephone.trim(),
        };
        creation.conducteurTravauxInvite = invitation;
        creation.chefProjetInvite = invitation;
      }

      const projetCree = await creerProjet(creation);
      reinitialiser();
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
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      {/* 560 px : les rangées à deux colonnes (ville/quartier, les deux dates)
          tiennent sans se casser. En dessous de cette largeur d'écran, le
          tiroir l'occupe entièrement. */}
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b border-neutral-200 px-6 py-5">
          <SheetTitle className="text-lg text-neutral-900">{t("titre")}</SheetTitle>
          <SheetDescription>{t("sousTitre")}</SheetDescription>
        </SheetHeader>

        {/* Seul le corps défile : l'en-tête et les deux boutons restent en vue,
            ce qui évite de chercher « Créer » au bas d'un formulaire long. */}
        <form
          id={FORM_ID}
          onSubmit={handleSoumettre}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5"
        >
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}

          <Champ
            libelle={t("champNom")}
            placeholder={t("champNomPlaceholder")}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-800" htmlFor="select-client">
              {t("champClient")} *
            </label>
            <select
              id="select-client"
              className="h-10 w-full rounded-md border border-neutral-300 bg-neutral-0 px-3 text-sm text-neutral-900 focus:border-primary-500 focus:shadow-[0_0_0_2px_var(--color-primary-100)] focus:outline-none"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raisonSociale}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
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

          <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
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

          <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <div className="mt-2 mb-1 border-b border-neutral-200 pb-1 text-sm font-semibold text-neutral-800">{t("sectionChefProjet")}</div>

            <div className="flex gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                <input
                  type="radio"
                  name="modeCp"
                  value="inviter"
                  checked={modeCp === "inviter"}
                  onChange={() => setModeCp("inviter")}
                />
                <span>{t("optionCpInviter")}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
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
                <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
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
                <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
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
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-800" htmlFor="select-cp-existant">
                  {t("optionCpExistant")}
                </label>
                <select
                  id="select-cp-existant"
                  className="h-10 w-full rounded-md border border-neutral-300 bg-neutral-0 px-3 text-sm text-neutral-900 focus:border-primary-500 focus:shadow-[0_0_0_2px_var(--color-primary-100)] focus:outline-none"
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

        <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Bouton>
          <Bouton variante="primaire" type="submit" form={FORM_ID} enCours={enCours}>
            {t("creer")}
          </Bouton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

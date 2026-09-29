"use client";

import { UserRoundPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Collaborateur } from "@/features/invitations/types";
import { cn } from "@/lib/utils";

import { ROLES_MEMBRE_SIMPLE, separerNomComplet } from "../regles";
import type { SaisieMembre } from "../validations";

const CHAMP = "h-[var(--input-height-md)]";

/** Les messages d'erreur d'une personne, champ par champ. */
export interface ErreursMembre {
  collaborateurId?: string;
  prenom?: string;
  nom?: string;
  role?: string;
}

interface Props {
  /** La base des identifiants de la ligne : `chef`, `membre-3`… */
  id: string;
  valeur: SaisieMembre;
  onChange: (valeur: SaisieMembre) => void;
  onBlur?: () => void;
  /** Les collaborateurs proposés — déjà privés de ceux qui sont pris. */
  collaborateurs: Collaborateur[];
  erreurs?: ErreursMembre;
  /** Le nom accessible du choix de la personne (« Chef d'équipe », « Membre 2 »). */
  libelle: string;
  /** Le nom accessible du choix du rôle ; absent, la ligne n'a pas de rôle à choisir (le chef). */
  libelleRole?: string;
  disabled?: boolean;
  /** Ce qui se pose au bout de la ligne : le bouton qui la retire. */
  action?: ReactNode;
}

/** Les erreurs d'une personne du formulaire, telles que `ChampMembre` les affiche. */
export function messagesMembre(
  erreurs: Partial<Record<keyof ErreursMembre, { message?: string }>> | undefined,
): ErreursMembre | undefined {
  if (!erreurs) return undefined;
  return {
    collaborateurId: erreurs.collaborateurId?.message,
    prenom: erreurs.prenom?.message,
    nom: erreurs.nom?.message,
    role: erreurs.role?.message,
  };
}

function Erreur({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="m-0 text-sm text-destructive">
      {message}
    </p>
  );
}

/**
 * Une personne d'une équipe : un collaborateur de l'entreprise, choisi dans la
 * liste, ou une personne qui n'en est pas un — un journalier, le compagnon
 * d'un sous-traitant — dont on tape le nom dans la même recherche.
 *
 * Un seul champ pour les deux gestes plutôt qu'un interrupteur « existant /
 * nouveau » : on cherche d'abord, et ce n'est qu'en ne trouvant pas qu'on
 * crée. Une personne saisie ouvre alors son prénom et son nom séparément, que
 * le premier mot tapé a préremplis, pour corriger un nom composé.
 */
export function ChampMembre({
  id,
  valeur,
  onChange,
  onBlur,
  collaborateurs,
  erreurs,
  libelle,
  libelleRole,
  disabled,
  action,
}: Props) {
  const t = useTranslations("projets.equipesAffectations.formEquipe");
  const tEcran = useTranslations("projets.equipesAffectations");

  const options = collaborateurs.map((collaborateur) => ({
    valeur: collaborateur.id,
    libelle: collaborateur.nomComplet,
    groupe: t("groupeCollaborateurs"),
  }));

  // Une personne saisie s'affiche sous son nom : le combobox montre tel quel
  // ce qui n'est pas dans sa liste.
  const choix =
    valeur.collaborateurId || (valeur.nouveau ? `${valeur.prenom} ${valeur.nom}`.trim() : "");

  function choisir(selection: string) {
    const collaborateur = collaborateurs.find((candidat) => candidat.id === selection);
    onChange(
      collaborateur
        ? {
            ...valeur,
            collaborateurId: collaborateur.id,
            nouveau: false,
            ...separerNomComplet(collaborateur.nomComplet),
          }
        : { ...valeur, collaborateurId: "", nouveau: true, ...separerNomComplet(selection) },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Combobox
            id={`${id}-personne`}
            aria-label={libelle}
            aria-invalid={Boolean(erreurs?.collaborateurId)}
            aria-describedby={erreurs?.collaborateurId ? `${id}-personne-erreur` : undefined}
            className={CHAMP}
            options={options}
            valeur={choix}
            onChange={choisir}
            onBlur={onBlur}
            placeholder={t("personnePlaceholder")}
            placeholderRecherche={t("personneRecherche")}
            aucunResultat={t("personneAucun")}
            libelleSaisieLibre={(saisie) => t("personneNouvelle", { nom: saisie })}
            disabled={disabled}
          />
          <Erreur id={`${id}-personne-erreur`} message={erreurs?.collaborateurId} />
        </div>

        {libelleRole && (
          <div className="flex w-44 shrink-0 flex-col gap-1 max-sm:w-36">
            <Select
              value={valeur.role}
              onValueChange={(role) => onChange({ ...valeur, role: role as SaisieMembre["role"] })}
              disabled={disabled}
            >
              <SelectTrigger
                aria-label={libelleRole}
                aria-invalid={Boolean(erreurs?.role)}
                className={cn(CHAMP, "w-full bg-card")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES_MEMBRE_SIMPLE.map((role) => (
                  <SelectItem key={role} value={role}>
                    {tEcran(`role.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Erreur id={`${id}-role-erreur`} message={erreurs?.role} />
          </div>
        )}

        {action}
      </div>

      {valeur.nouveau && !valeur.collaborateurId && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3">
          <p className="m-0 flex items-center gap-2 text-xs text-neutral-600">
            <UserRoundPlus size={14} aria-hidden="true" className="text-primary" />
            <span>
              {t.rich("nouvellePersonne", {
                fort: (morceau) => <strong className="font-semibold text-neutral-800">{morceau}</strong>,
              })}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1">
              <Input
                id={`${id}-prenom`}
                aria-label={t("champPrenomDe", { personne: libelle })}
                aria-invalid={Boolean(erreurs?.prenom)}
                className={CHAMP}
                placeholder={t("champPrenom")}
                value={valeur.prenom}
                onChange={(evenement) => onChange({ ...valeur, prenom: evenement.target.value })}
                onBlur={onBlur}
                disabled={disabled}
              />
              <Erreur id={`${id}-prenom-erreur`} message={erreurs?.prenom} />
            </div>
            <div className="flex flex-col gap-1">
              <Input
                id={`${id}-nom`}
                aria-label={t("champNomDe", { personne: libelle })}
                aria-invalid={Boolean(erreurs?.nom)}
                className={CHAMP}
                placeholder={t("champNomMembre")}
                value={valeur.nom}
                onChange={(evenement) => onChange({ ...valeur, nom: evenement.target.value })}
                onBlur={onBlur}
                disabled={disabled}
              />
              <Erreur id={`${id}-nom-erreur`} message={erreurs?.nom} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

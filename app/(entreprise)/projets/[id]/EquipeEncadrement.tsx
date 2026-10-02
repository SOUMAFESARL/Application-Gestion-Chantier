"use client";

import { Mail, MessageCircle, Phone, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { initiales, lienWhatsApp } from "@/features/projets/regles";
import type { FonctionProjet, Intervenant, Projet } from "@/features/projets/types";
import { afficherTelephone } from "@/features/referentiels/telephone";
import { ABSENT } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BLOC } from "../classes";

interface Props {
  projet: Projet;
  /** Désigner ou remplacer le chef de projet — la direction. */
  peutDesigner: boolean;
  /** Ajouter et retirer les autres membres — la direction et le chef de projet. */
  peutGerer: boolean;
  onAjouter: (fonction: FonctionProjet, fonctionsAutorisees: FonctionProjet[]) => void;
  onRetirer: (fonction: FonctionProjet, intervenant: Intervenant) => void;
}

/** Les places que le compte peut pourvoir, dans l'ordre de la section. */
function fonctionsAutorisees(peutDesigner: boolean, peutGerer: boolean): FonctionProjet[] {
  const autres: FonctionProjet[] = peutGerer ? ["CONDUCTEUR_TRAVAUX", "CHEF_CHANTIER", "AUTRE_MEMBRE"] : [];
  return peutDesigner ? ["CHEF_PROJET", ...autres] : autres;
}

/**
 * L'équipe d'encadrement et de gestion du projet — ses responsables, et non
 * les équipes de terrain (« Équipes & affectations »).
 *
 * Elle est vide à la création : le DG désigne d'abord **le chef de projet**,
 * seul obligatoire, puis celui-ci complète l'équipe et fixe le planning et le
 * budget. La désignation passe par « Ajouter un membre », qui propose le
 * chef de projet par défaut tant qu'il manque.
 */
export function EquipeEncadrement({ projet, peutDesigner, peutGerer, onAjouter, onRetirer }: Props) {
  const t = useTranslations("projets.encadrement");
  const autorisees = fonctionsAutorisees(peutDesigner, peutGerer);
  const chef = projet.chefProjet;
  // Sans chef de projet, c'est lui qu'il faut désigner d'abord.
  const fonctionParDefaut: FonctionProjet =
    !chef && peutDesigner
      ? "CHEF_PROJET"
      : (autorisees.find((fonction) => fonction !== "CHEF_PROJET") ?? "CHEF_PROJET");

  return (
    <section className={cn(BLOC, "flex flex-col gap-5 p-4 shadow-md sm:p-5")}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="m-0 text-base font-semibold text-neutral-900">{t("titre")}</h2>
        {autorisees.length > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={() => onAjouter(fonctionParDefaut, autorisees)}
          >
            <UserPlus aria-hidden="true" />
            {t("ajouterMembre")}
          </Button>
        )}
      </header>

      {/* Le chef de projet d'abord : seul obligatoire, et c'est lui qu'on appelle. */}
      <Groupe titre={t("fonction.CHEF_PROJET")} mention={<Badge variante="primaire">{t("obligatoire")}</Badge>}>
        {chef ? (
          <div className="flex flex-col gap-3 rounded-lg border border-solid border-primary-200 bg-primary-50 p-4">
            <div className="flex items-start justify-between gap-2">
              <Personne intervenant={chef} principal />
              {peutDesigner && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onAjouter("CHEF_PROJET", autorisees)}
                >
                  {t("changerChefProjet")}
                </Button>
              )}
            </div>
            <Coordonnees intervenant={chef} />
          </div>
        ) : (
          <p className="m-0 text-sm text-neutral-500">{t("aucun")}</p>
        )}
      </Groupe>

      <Separator />

      <Groupe titre={t("fonction.CONDUCTEUR_TRAVAUX")}>
        <Liste vide={projet.conducteursTravaux.length === 0}>
          {projet.conducteursTravaux.map((conducteur) => (
            <Ligne
              key={conducteur.id}
              intervenant={conducteur}
              onRetirer={peutGerer ? () => onRetirer("CONDUCTEUR_TRAVAUX", conducteur) : undefined}
            />
          ))}
        </Liste>
      </Groupe>

      <Separator />

      <Groupe titre={t("fonction.CHEF_CHANTIER")}>
        <Liste vide={projet.chefsChantier.length === 0}>
          {projet.chefsChantier.map(({ intervenant, zone }) => (
            <Ligne
              key={intervenant.id}
              intervenant={intervenant}
              precision={zone ?? t("toutLeChantier")}
              onRetirer={peutGerer ? () => onRetirer("CHEF_CHANTIER", intervenant) : undefined}
            />
          ))}
        </Liste>
      </Groupe>

      <Separator />

      <Groupe titre={t("fonction.AUTRE_MEMBRE")}>
        <Liste vide={projet.autresMembres.length === 0}>
          {projet.autresMembres.map(({ intervenant, fonction }) => (
            <Ligne
              key={intervenant.id}
              intervenant={intervenant}
              precision={t(`fonctionAutreMembre.${fonction}`)}
              onRetirer={peutGerer ? () => onRetirer("AUTRE_MEMBRE", intervenant) : undefined}
            />
          ))}
        </Liste>
      </Groupe>
    </section>
  );
}

function Groupe({ titre, mention, children }: { titre: string; mention?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="m-0 flex items-center gap-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        {titre}
        {mention}
      </h3>
      {children}
    </div>
  );
}

function Liste({ vide, children }: { vide: boolean; children: ReactNode }) {
  const t = useTranslations("projets.encadrement");
  if (vide) return <p className="m-0 text-sm text-neutral-500">{t("aucun")}</p>;
  return <ul className="m-0 flex list-none flex-col gap-2 p-0">{children}</ul>;
}

function Ligne({
  intervenant,
  precision,
  onRetirer,
}: {
  intervenant: Intervenant;
  /** Ce qui précise la place : la zone d'un chef de chantier, la fonction d'un autre membre. */
  precision?: string;
  onRetirer?: () => void;
}) {
  const t = useTranslations("projets.encadrement");
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-solid border-neutral-200 px-3 py-2">
      <Personne intervenant={intervenant} precision={precision} />
      {onRetirer && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-neutral-500 hover:text-erreur"
          aria-label={t("retirer", { nom: intervenant.nomComplet })}
          title={t("retirer", { nom: intervenant.nomComplet })}
          onClick={onRetirer}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

function Personne({
  intervenant,
  precision,
  principal = false,
}: {
  intervenant: Intervenant;
  precision?: string;
  principal?: boolean;
}) {
  const t = useTranslations("projets.encadrement");
  const sigle = initiales(intervenant.prenom, intervenant.nom);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-800",
          principal ? "size-11 text-base" : "size-9 text-xs",
        )}
        aria-hidden="true"
      >
        {sigle ?? ABSENT}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 truncate text-sm font-semibold text-neutral-900">
          {intervenant.nomComplet || intervenant.email}
          {intervenant.statut === "INVITE" && <Badge variante="avertissement">{t("invite")}</Badge>}
        </span>
        {precision && <span className="truncate text-xs text-neutral-500">{precision}</span>}
      </div>
    </div>
  );
}

/** L'email, le téléphone et le lien WhatsApp du chef de projet. */
function Coordonnees({ intervenant }: { intervenant: Intervenant }) {
  const t = useTranslations("projets.encadrement");
  const whatsapp = lienWhatsApp(intervenant.lienWhatsApp, intervenant.telephone);

  return (
    <>
      {(intervenant.email || intervenant.telephone) && (
        <div className="flex flex-col gap-1.5 text-xs text-neutral-700">
          {intervenant.email && (
            <a
              href={`mailto:${intervenant.email}`}
              aria-label={t("email", { nom: intervenant.nomComplet })}
              className="inline-flex items-center gap-2 text-primary-700 no-underline hover:underline"
            >
              <Mail size={14} aria-hidden="true" />
              {intervenant.email}
            </a>
          )}
          {intervenant.telephone && (
            <span className="inline-flex items-center gap-2">
              <Phone size={14} aria-hidden="true" />
              {afficherTelephone(intervenant.telephone)}
            </span>
          )}
        </div>
      )}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-whatsapp px-4 py-2.5 text-sm font-semibold text-neutral-0 no-underline transition-colors hover:bg-whatsapp-survol"
        >
          <MessageCircle size={18} aria-hidden="true" />
          <span>{t("whatsapp")}</span>
        </a>
      )}
    </>
  );
}

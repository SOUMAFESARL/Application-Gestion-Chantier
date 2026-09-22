"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BadgeEssai } from "@/components/metier/BadgeEssai";
import { Card, CardContent } from "@/components/ui/card";
import { lireRecapitulatif } from "@/features/configuration/api";
import type { Progression, Recapitulatif } from "@/features/configuration/api";
import { afficherTelephone } from "@/features/referentiels/telephone";
import { ABSENT, formaterMontant } from "@/lib/format";

import { Bouton, EtatChargement } from "./_ui";

/**
 * Écran de confirmation — M9.
 *
 * **La phrase sur les invitations est conditionnelle** (T-022 §6). « Les
 * invitations ont été envoyées » est faux quand l'étape 3 a été passée, et
 * l'email part par Celery *après* la transaction : l'invitation peut exister
 * sans que le message soit parti.
 */
export function Confirmation({ progression }: { progression: Progression }) {
  const t = useTranslations("configuration.confirmation");
  const router = useRouter();
  const [recapitulatif, setRecapitulatif] = useState<Recapitulatif | null>(null);

  useEffect(() => {
    let vivant = true;
    lireRecapitulatif()
      .then((r) => {
        if (vivant) setRecapitulatif(r);
      })
      .catch(() => {
        if (vivant) setRecapitulatif({ entreprise: null, projet: null, reference: null, invitations: 0 });
      });
    return () => {
      vivant = false;
    };
  }, []);

  if (!recapitulatif) {
    return (
      <Card className="bg-neutral-50">
        <CardContent className="pt-6">
          <EtatChargement message={t("preparation")} />
        </CardContent>
      </Card>
    );
  }

  const entreprise = recapitulatif.entreprise as { raison_sociale?: string } | null;
  const projet = recapitulatif.projet as
    | {
        nom?: string;
        budget_initial_montant?: number | null;
        conducteur_travaux?: {
          nom?: string;
          prenom?: string;
          nom_complet?: string;
          email?: string;
          telephone?: string;
        } | null;
        conducteur_travaux_invite?: {
          nom?: string;
          prenom?: string;
          email?: string;
          telephone?: string;
        } | null;
        chef_projet?: {
          nom?: string;
          prenom?: string;
          nom_complet?: string;
          email?: string;
          telephone?: string;
        } | null;
        chef_projet_invite?: {
          nom?: string;
          prenom?: string;
          email?: string;
          telephone?: string;
        } | null;
      }
    | null;
  const invitations = recapitulatif.invitations;
  const etapeEquipe = progression.etapes.find((e) => e.code === "EQUIPE");

  const cp = (projet?.conducteur_travaux ??
    projet?.conducteur_travaux_invite ??
    projet?.chef_projet ??
    projet?.chef_projet_invite) as {
    nom?: string;
    prenom?: string;
    nom_complet?: string;
    email?: string;
    telephone?: string;
  } | null | undefined;

  const chefProjetNom = cp
    ? cp.nom_complet || `${cp.prenom ?? ""} ${cp.nom ?? ""}`.trim() || cp.email || null
    : null;

  const chefProjetDetails = cp
    ? [chefProjetNom !== cp.email ? cp.email : null, afficherTelephone(cp.telephone ?? "")]
        .filter(Boolean)
        .join(" · ")
    : null;

  const messageEquipe =
    invitations > 0
      ? t("equipeInvitee")
      : etapeEquipe?.mode === "PASSEE"
        ? t("equipePassee")
        : t("equipeAucune");

  const lignes = [
    { libelle: t("ligneEntreprise"), valeur: entreprise?.raison_sociale || ABSENT },
    {
      libelle: t("ligneProjet"),
      valeur: projet?.nom ? (
        <span className="flex flex-wrap items-center gap-2">
          <span>{projet.nom}</span>
          {recapitulatif.reference && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {recapitulatif.reference}
            </span>
          )}
        </span>
      ) : (
        ABSENT
      ),
    },
    {
      libelle: t("ligneChefProjet"),
      valeur: chefProjetNom ? (
        <span className="flex flex-col">
          <span>{chefProjetNom}</span>
          {chefProjetDetails && (
            <span className="text-xs text-muted-foreground">{chefProjetDetails}</span>
          )}
        </span>
      ) : (
        ABSENT
      ),
    },
    {
      libelle: t("ligneBudget"),
      valeur:
        projet?.budget_initial_montant != null
          ? formaterMontant(projet.budget_initial_montant)
          : ABSENT,
    },
    { libelle: t("ligneCollaborateurs"), valeur: invitations },
    { libelle: t("ligneEssai"), valeur: <BadgeEssai /> },
  ];

  return (
    <Card className="bg-neutral-50">
      <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
        <span
          className="flex size-16 items-center justify-center rounded-full bg-succes-fond text-succes"
          aria-hidden="true"
        >
          <CheckCircle2 className="size-9" />
        </span>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {t("titre")}
          </h1>
          <p className="max-w-lg text-sm text-neutral-600">
            {entreprise?.raison_sociale
              ? t.rich("espacePret", {
                  entreprise: entreprise.raison_sociale,
                  fort: (morceaux) => <strong className="text-foreground">{morceaux}</strong>,
                })
              : t("espacePretSansNom")}{" "}
            {messageEquipe}
          </p>
        </div>

        <dl className="grid w-full max-w-lg grid-cols-1 divide-y divide-border rounded-lg border border-border text-left sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {lignes.map((ligne) => (
            <div key={ligne.libelle} className="flex flex-col gap-0.5 px-4 py-3">
              <dt className="text-xs font-medium text-muted-foreground">{ligne.libelle}</dt>
              <dd className="text-sm font-medium text-foreground">{ligne.valeur}</dd>
            </div>
          ))}
        </dl>

        <p className="max-w-lg text-sm text-neutral-600">
          {t.rich("prochaineEtape", { fort: (morceaux) => <strong className="text-foreground">{morceaux}</strong> })}
        </p>

        <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          <Bouton taille="lg" pleineLargeur onClick={() => router.push("/tableau-de-bord")}>
            {t("allerTableauDeBord")}
          </Bouton>
          <Bouton
            variante="secondaire"
            taille="lg"
            pleineLargeur
            onClick={() => router.push("/parametres/utilisateurs")}
          >
            {t("inviterEncore")}
          </Bouton>
        </div>
      </CardContent>
    </Card>
  );
}

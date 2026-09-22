"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Bouton, Champ, Modale } from "@/components/ui";
import { definirBudgetProjet } from "@/features/projets/adaptateur";
import { budgetRecevable } from "@/features/projets/regles";
import type { LigneChantier } from "@/features/tableauDeBord/types";
import { saisieEnCentimes } from "@/lib/format";

interface Props {
  ouverte: boolean;
  projet: LigneChantier | null;
  onFermer: () => void;
  onBudgetEnregistre: (projetId: string, nouveauBudgetCentimes: number) => void;
}

export function ModalDefinirBudget({
  ouverte,
  projet,
  onFermer,
  onBudgetEnregistre,
}: Props) {
  const t = useTranslations("tableauDeBord.chantiers");
  const tRoles = useTranslations("roles");
  const [montantSaisi, setMontantSaisi] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  if (!projet) return null;

  async function handleValider(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!projet) return;

    // Conventions §6 : les montants financiers sont stockés en centimes de
    // FCFA. La conversion est celle de `lib/format` — cette modale en tenait
    // une copie, avec sa propre façon de nettoyer la saisie.
    const montantCentimes = saisieEnCentimes(montantSaisi);

    if (!budgetRecevable(montantCentimes)) {
      setErreur(t("budgetInvalide"));
      return;
    }

    setEnCours(true);
    setErreur(null);
    try {
      await definirBudgetProjet(projet.id, montantCentimes);
      onBudgetEnregistre(projet.id, montantCentimes);
      setMontantSaisi("");
      onFermer();
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : t("budgetInvalide"));
    } finally {
      setEnCours(false);
    }
  }

  const actions = (
    <>
      <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
        {tRoles("annuler")}
      </Bouton>
      <Bouton variante="primaire" onClick={handleValider} enCours={enCours}>
        {t("enregistrerBudget")}
      </Bouton>
    </>
  );

  return (
    <Modale
      ouverte={ouverte}
      titre={t("modalBudgetTitre")}
      onFermer={enCours ? undefined : onFermer}
      actions={actions}
    >
      <form
        onSubmit={handleValider}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
      >
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-neutral-600)", margin: 0 }}>
          {t("modalBudgetDescription")}
        </p>

        <Champ
          libelle={t("champBudgetMontant")}
          type="text"
          inputMode="numeric"
          value={montantSaisi}
          placeholder={t("placeholderBudgetMontant")}
          onChange={(e) => {
            setMontantSaisi(e.target.value);
            setErreur(null);
          }}
          erreur={erreur ?? undefined}
          required
        />
      </form>
    </Modale>
  );
}

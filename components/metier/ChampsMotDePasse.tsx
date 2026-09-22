"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegleMotDePasse } from "@/features/auth/reglesMotDePasse";
import { cn } from "@/lib/utils";

/**
 * La double saisie d'un mot de passe et sa barre de robustesse.
 *
 * **Trois écrans posent exactement le même geste** — l'activation d'un compte
 * (M8 écran 3), la définition après invitation (M2) et la réinitialisation
 * (M6 écran 3). Le contrat de réinitialisation §1 le dit autrement : « trois
 * portes, un seul couloir ». Ce composant est ce couloir.
 *
 * **La double saisie ne part pas au serveur.** Elle est une vérification
 * d'interface — contrat §5.1 : le serveur reçoit une seule valeur, et il n'a
 * rien à comparer.
 *
 * **Les règles ne vivent pas ici.** Elles viennent de
 * `GET /referentiels/regles-mot-de-passe/` par `useReglesMotDePasse` — contrat
 * §6.3. Ce composant les affiche ; il ne les connaît pas.
 *
 * **La barre remplace la liste des quatre règles.** Égrener « 8 caractères,
 * 1 majuscule, 1 chiffre, 1 caractère spécial » avant même la première frappe
 * ne dit rien d'utile ; une barre qui rougit ou verdit avec la saisie, puis un
 * rappel des critères manquants une fois 8 caractères posés, est le seul
 * moment où l'information sert vraiment. Le cinquième contrôle — les deux
 * saisies identiques — n'est pas une force du mot de passe : il est signalé
 * séparément, sous le champ de confirmation.
 */

interface Props {
  motDePasse: string;
  confirmation: string;
  onMotDePasse: (valeur: string) => void;
  onConfirmation: (valeur: string) => void;
  disabled?: boolean;
  /** Les règles déjà calculées par l'écran, qui s'en sert aussi pour son bouton. */
  regles: RegleMotDePasse[];
}

/** Ordre d'affichage des critères de robustesse — `identiques` en est exclu. */
const CODES_ROBUSTESSE: ReadonlyArray<RegleMotDePasse["code"]> = [
  "longueur",
  "majuscule",
  "chiffre",
  "special",
];

export function ChampsMotDePasse({
  motDePasse,
  confirmation,
  onMotDePasse,
  onConfirmation,
  disabled = false,
  regles,
}: Props) {
  const t = useTranslations("motDePasse");
  const [visible, setVisible] = useState(false);

  const robustesse = CODES_ROBUSTESSE.map((code) =>
    regles.find((regle) => regle.code === code),
  ).filter((regle): regle is RegleMotDePasse => regle !== undefined);
  const identiques = regles.find((regle) => regle.code === "identiques");

  const total = robustesse.length;
  const satisfaites = robustesse.filter((regle) => regle.satisfaite).length;
  // Rien à montrer sur un champ vide, ni tant que le référentiel n'a pas
  // répondu (contrat §6.3 : mieux vaut aucune coche que de fausses coches).
  const afficherBarre = motDePasse.length > 0 && total > 0;
  const ton =
    satisfaites === total
      ? "succes"
      : satisfaites >= Math.ceil(total / 2)
        ? "avertissement"
        : "erreur";
  const manquantes = robustesse.filter((regle) => !regle.satisfaite);
  // Le détail des critères n'apparaît qu'à partir de 8 caractères — avant,
  // le seul retour utile est la couleur de la barre elle-même.
  const afficherManquantes = motDePasse.length >= 8 && manquantes.length > 0;

  return (
    <>
      {/* `mb-4` (et non le `gap` du formulaire parent) : ce composant est
          partagé par trois écrans dont un seul est en grille flexible, et il
          doit espacer ses propres champs quel que soit le formulaire qui
          l'accueille. */}
      <div className="mb-4 flex flex-col gap-1.5">
        <Label htmlFor="mot-de-passe-nouveau">{t("champNouveau")}</Label>
        <div className="relative">
          <Input
            id="mot-de-passe-nouveau"
            type={visible ? "text" : "password"}
            required
            autoComplete="new-password"
            value={motDePasse}
            disabled={disabled}
            onChange={(e) => onMotDePasse(e.target.value)}
            className="pr-12"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("masquer") : t("afficher")}
            aria-pressed={visible}
            disabled={disabled}
          >
            {visible ? <EyeOff /> : <Eye />}
          </Button>
        </div>

        {afficherBarre && (
          <div className="mt-1 flex flex-col gap-1.5">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={satisfaites}
              aria-label={t("champNouveau")}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  ton === "succes" && "bg-succes",
                  ton === "avertissement" && "bg-avertissement",
                  ton === "erreur" && "bg-erreur",
                )}
                style={{ width: `${(satisfaites / total) * 100}%` }}
              />
            </div>

            {/* `polite` : la liste des critères manquants se met à jour à la
                frappe sans interrompre la lecture — et la couleur n'est
                jamais seule à porter l'information (charte §8.4). */}
            <p className="min-h-4 text-xs" aria-live="polite">
              {afficherManquantes ? (
                <span className="text-neutral-600">
                  {t("ilManque", {
                    liste: manquantes
                      .map((regle) => t(`regle.${regle.code}`))
                      .join(", "),
                  })}
                </span>
              ) : satisfaites === total ? (
                <span className="font-medium text-succes">{t("robuste")}</span>
              ) : null}
            </p>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-1.5">
        <Label htmlFor="mot-de-passe-confirmation">{t("champConfirmation")}</Label>
        <Input
          id="mot-de-passe-confirmation"
          type={visible ? "text" : "password"}
          required
          autoComplete="new-password"
          value={confirmation}
          disabled={disabled}
          onChange={(e) => onConfirmation(e.target.value)}
        />
        {confirmation.length > 0 && identiques && !identiques.satisfaite && (
          <p className="text-xs font-medium text-erreur" aria-live="polite">
            {t("regle.identiques")}
          </p>
        )}
      </div>
    </>
  );
}

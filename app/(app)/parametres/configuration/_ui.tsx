"use client";

/**
 * Remplacements Tailwind/shadcn du vieux kit `@/components/ui` (CSS
 * Modules), **réservés à cet assistant** — même signature de props que
 * `Champ`, `Bouton`, `Alerte`, `EtatChargement`, pour que
 * `ConfigurationEntreprise.tsx` n'ait à changer que son import, pas sa
 * logique.
 *
 * Ce n'est pas une nouvelle couche du design system : le reste de
 * l'application garde le vieux kit tant qu'il n'a pas été repris (plan de
 * refonte, « un écran migré entièrement ou pas du tout »). Celui-ci vit
 * dans le dossier de l'écran, pas dans `components/ui`.
 */

import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Champ
// ---------------------------------------------------------------------------

interface PropsChamp extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  libelle: string;
  erreur?: string;
  aide?: string;
  iconeDroite?: ReactNode;
  actionDroite?: ReactNode;
}

export const Champ = forwardRef<HTMLInputElement, PropsChamp>(function Champ(
  { libelle, erreur, aide, iconeDroite, actionDroite, required, className, ...reste },
  ref,
) {
  const identifiant = useId();
  const idAide = `${identifiant}-aide`;
  const enErreur = Boolean(erreur);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={identifiant}>
        {libelle}
        {required && (
          <span className="text-erreur" aria-hidden="true">
            *
          </span>
        )}
      </Label>

      <div className="relative">
        <Input
          ref={ref}
          id={identifiant}
          aria-invalid={enErreur || undefined}
          aria-describedby={erreur || aide ? idAide : undefined}
          aria-required={required || undefined}
          required={required}
          className={cn(iconeDroite || actionDroite ? "pr-10" : undefined, className)}
          {...reste}
        />
        {iconeDroite && (
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
            {iconeDroite}
          </span>
        )}
        {actionDroite && (
          <span className="absolute top-1/2 right-1 -translate-y-1/2">{actionDroite}</span>
        )}
      </div>

      {(erreur || aide) && (
        <p id={idAide} className={enErreur ? "text-xs font-medium text-erreur" : "text-xs text-muted-foreground"}>
          {erreur ?? aide}
        </p>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Bouton
// ---------------------------------------------------------------------------

export type VarianteBouton = "primaire" | "secondaire" | "ghost" | "danger";
export type TailleBouton = "sm" | "md" | "lg";

const VARIANTE_VERS_SHADCN: Record<VarianteBouton, "default" | "outline" | "ghost" | "destructive"> = {
  primaire: "default",
  secondaire: "outline",
  ghost: "ghost",
  danger: "destructive",
};

const TAILLE_VERS_SHADCN: Record<TailleBouton, "sm" | "default" | "lg"> = {
  sm: "sm",
  md: "default",
  lg: "lg",
};

interface PropsBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  enCours?: boolean;
  pleineLargeur?: boolean;
  iconeGauche?: ReactNode;
  iconeDroite?: ReactNode;
}

export const Bouton = forwardRef<HTMLButtonElement, PropsBouton>(function Bouton(
  {
    variante = "primaire",
    taille = "md",
    enCours = false,
    pleineLargeur = false,
    iconeGauche,
    iconeDroite,
    disabled,
    children,
    className,
    type = "button",
    ...reste
  },
  ref,
) {
  return (
    <Button
      ref={ref}
      type={type}
      variant={VARIANTE_VERS_SHADCN[variante]}
      size={TAILLE_VERS_SHADCN[taille]}
      disabled={disabled || enCours}
      aria-busy={enCours || undefined}
      className={cn(pleineLargeur ? "w-full" : undefined, className)}
      {...reste}
    >
      {enCours ? <LoaderCircle className="animate-spin" /> : iconeGauche}
      {children}
      {!enCours && iconeDroite}
    </Button>
  );
});

// ---------------------------------------------------------------------------
// Alerte
// ---------------------------------------------------------------------------

export type TypeAlerte = "succes" | "erreur" | "avertissement" | "information";

const ICONES_ALERTE: Record<TypeAlerte, typeof CheckCircle2> = {
  succes: CheckCircle2,
  erreur: AlertCircle,
  avertissement: TriangleAlert,
  information: Info,
};

export function Alerte({
  type,
  titre,
  children,
  action,
}: {
  type: TypeAlerte;
  titre?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const Icone = ICONES_ALERTE[type];

  return (
    <Alert variant={type}>
      <Icone />
      {titre && <AlertTitle>{titre}</AlertTitle>}
      <AlertDescription>
        {children}
        {action}
      </AlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// État — chargement
// ---------------------------------------------------------------------------

export function EtatChargement({ message }: { message?: string }) {
  const t = useTranslations("etats");

  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center" role="status" aria-live="polite">
      <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message ?? t("chargement")}</p>
    </div>
  );
}

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Les quatre types de messages du Socle Commun §5.1. Il n'y en a pas d'autres. */
export type TypeAlerte = "succes" | "erreur" | "avertissement" | "information";

interface Props {
  type: TypeAlerte;
  titre?: string;
  children: ReactNode;
  /** Action corrective. Socle §5.2 : un message d'erreur sans action est inutile. */
  action?: ReactNode;
}

const ICONES = {
  succes: CheckCircle2,
  erreur: XCircle,
  avertissement: AlertTriangle,
  information: Info,
} as const;

/** Rôle ARIA : une erreur interrompt, le reste est annoncé poliment. */
const ROLES = {
  succes: "status",
  erreur: "alert",
  avertissement: "alert",
  information: "status",
} as const;

/** Fond a 8 % de la couleur du texte, filet gauche de 4 px — charte §7.6. */
const TONS: Record<TypeAlerte, string> = {
  succes: "border-l-succes bg-succes/8 text-succes",
  erreur: "border-l-erreur bg-erreur/8 text-erreur",
  avertissement: "border-l-avertissement bg-avertissement/8 text-avertissement",
  information: "border-l-information bg-information/8 text-information",
};

/**
 * Alerte — charte §7.6, Socle Commun §5.
 *
 * Charte §8.4, règle absolue : une information critique n'est jamais portée
 * par la seule couleur. Chaque type a donc son icône **et** son texte.
 */
export function Alerte({ type, titre, children, action }: Props) {
  const Icone = ICONES[type];

  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-3 rounded-md border-l-4 px-4 py-3 text-sm leading-snug",
        TONS[type],
      )}
      role={ROLES[type]}
    >
      <Icone className="mt-px shrink-0" size={20} aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        {titre && <p className="font-bold">{titre}</p>}
        <div className="font-medium">{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

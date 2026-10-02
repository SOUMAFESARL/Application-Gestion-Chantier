"use client";

import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import type { ToasterProps } from "sonner";

/** En haut à droite : loin de la barre latérale et des boutons d'action. */
const POSITION: ToasterProps["position"] = "top-right";

/**
 * Les teintes des toasts. `!` parce que `sonner` pose ses propres couleurs
 * sur `[data-sonner-toast]`, plus spécifique qu'une simple classe.
 */
const CLASSES_TOAST: NonNullable<ToasterProps["toastOptions"]>["classNames"] = {
  toast: "font-sans shadow-lg",
  success: "!border-succes !bg-succes-fond !text-succes",
  error: "!border-erreur !bg-erreur-fond !text-erreur",
};

/**
 * Le conteneur des toasts (composant `sonner` de shadcn), monté une seule
 * fois dans `app/providers.tsx`. Un écran l'utilise par `toast.success(…)`,
 * importé de `sonner`.
 *
 * Sans `next-themes` : il n'y a qu'un thème (arbitrage A3). Les teintes
 * passent par les tons sémantiques de la charte, pas par les couleurs
 * propres à `sonner`.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position={POSITION}
      closeButton
      icons={{
        success: <CircleCheck className="size-4" />,
        error: <CircleX className="size-4" />,
        info: <Info className="size-4" />,
        warning: <TriangleAlert className="size-4" />,
      }}
      toastOptions={{ classNames: CLASSES_TOAST }}
      {...props}
    />
  );
}

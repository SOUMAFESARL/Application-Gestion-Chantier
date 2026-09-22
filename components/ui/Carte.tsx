import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface Props {
  titre?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Sans ombre — préféré sur le terrain, où les ombres se voient mal. */
  plate?: boolean;
  className?: string;
}

/** Carte — charte §7.5. */
export function Carte({ titre, actions, children, plate = false, className }: Props) {
  return (
    <section
      className={cn(
        // Le rembourrage suit les jetons de carte : 24 px sur mobile, 32 px
        // des la tablette — charte §7.5, `--card-padding-*`.
        "rounded-lg border border-neutral-200 bg-neutral-0 p-6 shadow-sm md:p-8",
        plate && "shadow-none",
        className,
      )}
    >
      {(titre || actions) && (
        <header className="mb-4 flex items-center justify-between gap-4">
          {titre && <h2 className="text-lg font-semibold text-neutral-900">{titre}</h2>}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

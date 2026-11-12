import type { ReactNode } from "react";

import { ReinitialiserThemeDefaut } from "@/components/layout/ReinitialiserThemeDefaut";

/** Layout pour les pages d'authentification — garantit le thème par défaut de la plateforme. */
export default function LayoutAuth({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <ReinitialiserThemeDefaut />
      {children}
    </>
  );
}

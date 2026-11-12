import type { ReactNode } from "react";

import { ReinitialiserThemeDefaut } from "@/components/layout/ReinitialiserThemeDefaut";
import { FournisseurEspace } from "@/i18n/FournisseurEspace";

/** Les messages des pages publiques — inscription et liens de partage. */
export default function LayoutPublic({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <FournisseurEspace espace="public">
      <ReinitialiserThemeDefaut />
      {children}
    </FournisseurEspace>
  );
}

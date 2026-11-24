import type { ReactNode } from "react";

import { NavigationReferentielsPlateforme } from "./NavigationReferentielsPlateforme";

export default function LayoutReferentielsPlateforme({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <NavigationReferentielsPlateforme />
      {children}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext } from "react";
import type { ReactNode } from "react";

import { EtatChargement, EtatVide } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { listerProjets } from "@/features/projets/adaptateur";
import { CLE_LISTE_PROJETS } from "@/features/projets/cles";
import type { Projet } from "@/features/projets/types";

import { peutCode, peutSurProjet, peutVoirMontants, projetsVisibles, routeAutorisee } from "../regles";
import type { Droits } from "../types";

/**
 * `undefined` : aucun fournisseur (un écran rendu hors de la coquille).
 * `null` : les droits ne sont pas encore connus — rien ne s'ouvre d'ici là.
 */
const ContexteDroits = createContext<Droits | null | undefined>(undefined);

/**
 * Pose les droits pour toute la coquille de l'espace entreprise. D'où ils
 * viennent — le profil, ou le rôle qu'un poste de dev incarne — ne regarde
 * que `app/(entreprise)/layout.tsx` : les écrans n'en savent rien.
 */
export function FournisseurDroits({ droits, children }: { droits: Droits | null; children: ReactNode }) {
  return <ContexteDroits.Provider value={droits}>{children}</ContexteDroits.Provider>;
}

/**
 * Le **seul** point de lecture des droits pour un écran. On y demande « ai-je
 * `projets.creer` ? », jamais « suis-je chef de chantier ? » : un rôle est une
 * donnée que le DG renomme à volonté.
 */
export function useDroits() {
  const droits = useContext(ContexteDroits) ?? null;
  const peutFaireCode = useCallback((code: string) => peutCode(droits, code), [droits]);
  const peutFaireSurProjet = useCallback(
    (code: string, projet: Projet) => peutSurProjet(droits, code, projet),
    [droits],
  );
  return {
    droits,
    /** `false` tant que les droits ne sont pas connus. */
    connus: droits !== null,
    estDirection: droits?.estDirection ?? false,
    peutCode: peutFaireCode,
    peutSurProjet: peutFaireSurProjet,
    voitMontants: peutVoirMontants(droits),
  };
}

/** Ne rend son contenu que si le compte a le code. Sinon, rien : un geste interdit est masqué. */
export function SiDroit({ code, children }: { code: string; children: ReactNode }) {
  const { peutCode: peutFaireCode } = useDroits();
  return peutFaireCode(code) ? <>{children}</> : null;
}

/** L'écran montré à la place d'une page que le compte ne peut pas ouvrir. */
export function AccesNonAutorise() {
  const t = useTranslations("habilitations");
  return (
    <EtatVide
      icone={<ShieldOff size={32} aria-hidden="true" />}
      titre={t("accesRefuseTitre")}
      description={t("accesRefuseDescription")}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href="/tableau-de-bord">{t("retourAccueil")}</Link>
        </Button>
      }
    />
  );
}

/**
 * La garde de route de l'espace entreprise : une page dont le module n'est
 * pas accessible est remplacée par « Accès non autorisé ». Pas de
 * redirection silencieuse — on doit comprendre pourquoi l'écran est vide.
 *
 * Ce n'est pas une barrière : Django refuse les données de toute façon.
 */
export function GardeRoute({ children }: { children: ReactNode }) {
  const chemin = usePathname();
  const { droits, connus } = useDroits();
  if (!connus) return <EtatChargement />;
  if (!routeAutorisee(droits, chemin)) return <AccesNonAutorise />;
  return <>{children}</>;
}

/**
 * La liste des chantiers, **réduite à ceux que le compte voit** : tous pour la
 * direction, ses chantiers sinon. Le cache garde la liste entière — c'est la
 * même clé que partout — et chaque lecteur la filtre à la sortie.
 */
export function useProjetsVisibles() {
  const { droits } = useDroits();
  const filtrer = useCallback((projets: Projet[]) => projetsVisibles(projets, droits), [droits]);
  return useQuery({
    queryKey: CLE_LISTE_PROJETS,
    queryFn: ({ signal }) => listerProjets(signal),
    select: filtrer,
  });
}

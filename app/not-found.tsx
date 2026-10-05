"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { LogoCCD } from "@/components/layout/MarqueCCD";
import { Bouton } from "@/components/ui";

/**
 * Page d'erreur 404 — le logo, le nom, le message, une seule sortie.
 *
 * **« Page précédente » ne se contente pas de `router.back()`.** Une adresse
 * saisie à la main, ou ouverte depuis un lien dans un nouvel onglet, arrive
 * sans historique : `back()` n'a alors nulle part où aller et le clic ne fait
 * rien. Dans ce cas on renvoie à l'accueil de l'espace — `/admin` pour le
 * back-office, le tableau de bord pour une entreprise.
 *
 * Le quadrillage du fond évoque un plan de chantier ; il est décoratif et
 * tiré des jetons de la charte, pas d'une image.
 */
export default function NotFound() {
  const t = useTranslations("erreurs");
  const tMarque = useTranslations("marque");
  const router = useRouter();
  const chemin = usePathname();

  const accueil = chemin?.startsWith("/admin") ? "/admin" : "/tableau-de-bord";

  function revenir() {
    if (pageApplicationPrecedente()) router.back();
    else router.replace(accueil);
  }

  return (
    <div className="relative isolate flex min-h-svh flex-col bg-neutral-50">
      {/* Quadrillage « plan » estompé vers les bords. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--color-neutral-200)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-neutral-200)_1px,transparent_1px)] bg-size-[2.5rem_2.5rem] mask-[radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <div
        aria-hidden="true"
        className="absolute top-1/3 left-1/2 -z-10 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-100 opacity-60 blur-3xl"
      />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-xl flex-col items-center text-center">
          <LogoCCD taille={88} />
          <p className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">
            {tMarque("nom")}
          </p>
          <p className="mb-10 text-sm font-medium text-neutral-500">{tMarque("accroche")}</p>

          <h1 className="mb-3 text-h2 font-bold tracking-tight text-neutral-900">
            {t("titre404")}
          </h1>
          <p className="mb-8 max-w-md text-base leading-relaxed text-balance text-neutral-600">
            {t("description404")}
          </p>

          <Bouton
            variante="primaire"
            taille="lg"
            iconeGauche={<ArrowLeft size={18} />}
            onClick={revenir}
          >
            {t("pagePrecedente")}
          </Bouton>
        </div>
      </main>
    </div>
  );
}

/**
 * Y a-t-il, derrière cette page, une page **de l'application** où revenir ?
 *
 * Pas `history.length` : il compte aussi l'onglet vierge et les sites
 * externes, et `back()` y renverrait. L'API Navigation, elle, ne liste que
 * les entrées de la même origine. À défaut (navigateur ancien), un référent
 * de la même origine en tient lieu.
 */
function pageApplicationPrecedente(): boolean {
  const navigation = (window as { navigation?: { canGoBack?: boolean } }).navigation;
  if (typeof navigation?.canGoBack === "boolean") return navigation.canGoBack;

  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

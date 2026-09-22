"use client";

import { Home, Map } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Bouton } from "@/components/ui";

/**
 * Page d'erreur 404 — Conforme à la maquette 04_Conception/maquettes/M11_Erreurs_CCD_Digital.html (Écran 1).
 */
export default function NotFound() {
  const t = useTranslations("erreurs");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-100 p-8 text-center">
      <div className="flex w-full max-w-[540px] flex-col items-center rounded-xl border border-neutral-200 bg-neutral-0 px-8 py-16 shadow-[0_4px_6px_-1px_rgb(0_0_0/0.06)] max-sm:px-4 max-sm:py-8">
        <div
          className="mb-6 flex size-20 items-center justify-center rounded-full bg-primary-50 text-primary-500"
          aria-hidden="true"
        >
          <Map size={40} />
        </div>
        <div className="mb-2 text-sm font-bold tracking-[0.08em] text-primary-600 uppercase">
          {t("code404")}
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-[-0.02em] text-neutral-900">
          {t("titre404")}
        </h1>
        <p className="mb-8 max-w-[440px] text-[15px] leading-normal text-neutral-600">
          {t("description404")}
        </p>
        <div className="flex w-full justify-center gap-3 max-sm:flex-col">
          <Link href="/tableau-de-bord" className="no-underline hover:no-underline">
            <Bouton variante="primaire">
              <Home size={18} />
              <span>{t("retourTableauDeBord")}</span>
            </Bouton>
          </Link>
        </div>
      </div>
    </div>
  );
}

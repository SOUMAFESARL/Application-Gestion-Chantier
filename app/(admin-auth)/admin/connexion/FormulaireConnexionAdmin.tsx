"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IDENTIFIANTS_DEMO, seConnecter } from "@/features/administration/adaptateur";
import { schemaConnexionAdministrateur } from "@/features/administration/validations";
import type {
  SaisieConnexionAdministrateur,
  ValeursConnexionAdministrateur,
} from "@/features/administration/validations";
import { ErreurApi } from "@/lib/api";

const DESTINATION = "/admin";

/** Ce que l'ecran a a dire, une cle de message par issue. */
type Echec =
  | "identifiants"
  | "reseau"
  | "inattendu"
  | "sessionExpiree"
  | null;

function echecDepuis(cause: unknown): Echec {
  if (cause instanceof ErreurApi) {
    if (cause.code === "identifiants_invalides") return "identifiants";
    if (cause.code === "reseau_indisponible") return "reseau";
  }
  return "inattendu";
}

const CLES_ECHEC: Record<NonNullable<Echec>, string> = {
  identifiants: "echecIdentifiants",
  reseau: "echecReseau",
  inattendu: "echecInattendu",
  sessionExpiree: "sessionExpiree",
};

/**
 * La connexion au back-office de la plateforme.
 *
 * **Un ecran a part, et un endpoint a part.** Les administrateurs de la
 * plateforme vivent dans une table distincte de celle des utilisateurs des
 * entreprises : ce ne sont pas deux roles d'un meme compte. Presenter les
 * memes identifiants aux deux endpoints aurait, au mieux, produit un `401`
 * trompeur — au pire, ouvert la mauvaise session.
 *
 * Il n'y a **pas** de compteur de tentatives comme cote entreprise : le
 * blocage au cinquieme essai est une regle du Socle Commun qui porte sur les
 * comptes clients, et l'afficher ici annoncerait une politique dont rien ne
 * dit qu'elle existe pour ce back-office.
 */
export function FormulaireConnexionAdmin() {
  const t = useTranslations("administration.connexion");
  const router = useRouter();
  const parametres = useSearchParams();

  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [echec, setEchec] = useState<Echec>(() =>
    parametres.get("session") === "expiree" ? "sessionExpiree" : null,
  );
  const [enCours, setEnCours] = useState(false);

  const form = useForm<
    SaisieConnexionAdministrateur,
    unknown,
    ValeursConnexionAdministrateur
  >({
    resolver: zodResolver(schemaConnexionAdministrateur),
    // Pre-rempli tant que le back-office est simule ; `null` — donc deux
    // champs vides — des que `NEXT_PUBLIC_API_SIMULE` retombe a `0`.
    defaultValues: {
      email: IDENTIFIANTS_DEMO?.email ?? "",
      motDePasse: IDENTIFIANTS_DEMO?.motDePasse ?? "",
    },
  });

  async function soumettre(valeurs: ValeursConnexionAdministrateur) {
    setEnCours(true);
    setEchec(null);

    try {
      await seConnecter({ email: valeurs.email, motDePasse: valeurs.motDePasse });
      router.replace(DESTINATION);
    } catch (cause) {
      setEchec(echecDepuis(cause));
      setEnCours(false);
    }
  }

  return (
    <>
      {echec && (
        <Alert variant="erreur" className="mb-6">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>{t(CLES_ECHEC[echec])}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(soumettre)} className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("email")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder={t("emailPlaceholder")}
                    disabled={enCours}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="motDePasse"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("motDePasse")}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type={motDePasseVisible ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder={t("motDePassePlaceholder")}
                      disabled={enCours}
                      className="pr-11"
                      // Le mot de passe ne part jamais dans la sauvegarde de
                      // brouillon de `lib/auth/session.ts`.
                      data-sans-sauvegarde=""
                    />
                    <button
                      type="button"
                      onClick={() => setMotDePasseVisible((v) => !v)}
                      aria-label={motDePasseVisible ? t("masquer") : t("afficher")}
                      className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center border-0 bg-transparent text-neutral-500 hover:text-neutral-800"
                    >
                      {motDePasseVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/*
            Le lien reste visible en toute circonstance : c'est la seule
            sortie d'un agent qui a perdu son mot de passe, ce back-office
            n'ayant ni inscription ni compte de secours.
          */}
          <div className="-mt-1 text-right">
            <Link
              href="/admin/mot-de-passe/oublie"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
            >
              {t("motDePasseOublie")}
            </Link>
          </div>

          <Button type="submit" disabled={enCours} className="mt-1 w-full">
            {enCours && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {enCours ? t("enCours") : t("valider")}
          </Button>
        </form>
      </Form>
    </>
  );
}

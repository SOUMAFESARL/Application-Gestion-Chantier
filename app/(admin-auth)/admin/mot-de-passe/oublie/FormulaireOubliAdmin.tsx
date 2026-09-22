"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Mail, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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
import { demanderReinitialisation } from "@/features/administration/adaptateur";
import { schemaOubliAdministrateur } from "@/features/administration/validations";
import type {
  SaisieOubliAdministrateur,
  ValeursOubliAdministrateur,
} from "@/features/administration/validations";

/** Le meme verrou de renvoi que cote entreprise — un geste, un delai. */
const SECONDES_AVANT_RENVOI = 60;

type Etat =
  | { nom: "saisie" }
  | { nom: "chargement" }
  | { nom: "envoye"; email: string }
  | { nom: "erreur" };

/**
 * La demande de reinitialisation du mot de passe d'administration.
 *
 * **Le serveur repond `202`, que l'adresse existe ou non**, et l'ecran ne
 * cherche pas a le cacher : il l'ecrit. Un back-office qui confirmerait
 * quelles adresses ouvrent la porte donnerait la moitie du travail a qui la
 * cherche.
 */
export function FormulaireOubliAdmin() {
  const t = useTranslations("administration.motDePasseOublie");

  const [etat, setEtat] = useState<Etat>({ nom: "saisie" });
  const [attenteRenvoi, setAttenteRenvoi] = useState(0);

  const form = useForm<SaisieOubliAdministrateur, unknown, ValeursOubliAdministrateur>({
    resolver: zodResolver(schemaOubliAdministrateur),
    defaultValues: { email: "" },
  });

  // Le verrou s'ecoule tout seul : sans cela le bouton reste desactive
  // jusqu'a un rechargement de page.
  useEffect(() => {
    if (attenteRenvoi <= 0) return;
    const minuterie = setTimeout(() => setAttenteRenvoi((n) => n - 1), 1000);
    return () => clearTimeout(minuterie);
  }, [attenteRenvoi]);

  async function envoyer(adresse: string) {
    setEtat({ nom: "chargement" });
    try {
      await demanderReinitialisation(adresse);
      setEtat({ nom: "envoye", email: adresse });
      setAttenteRenvoi(SECONDES_AVANT_RENVOI);
    } catch {
      // Le message d'erreur du serveur n'est pas repris : il parle d'une
      // adresse, et la repeter ici dirait ce que le `202` tait.
      setEtat({ nom: "erreur" });
    }
  }

  if (etat.nom === "envoye") {
    return (
      <div className="flex flex-col items-center text-center">
        <span
          className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-700"
          aria-hidden="true"
        >
          <Mail size={24} />
        </span>
        <h1 className="text-xl leading-tight font-bold text-neutral-900">
          {t("confirmationTitre")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 [&_strong]:font-semibold [&_strong]:text-neutral-900">
          {t.rich("confirmationCorps", {
            email: etat.email,
            fort: (morceaux) => <strong>{morceaux}</strong>,
          })}
        </p>

        {/* Dire pourquoi la reponse est vague vaut mieux que la laisser vague. */}
        <Alert variant="information" className="mt-6 text-left">
          <AlertDescription>{t("confidentialite")}</AlertDescription>
        </Alert>

        <div className="mt-6 flex w-full flex-col items-center gap-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={attenteRenvoi > 0}
            onClick={() => void envoyer(etat.email)}
          >
            {attenteRenvoi > 0
              ? t("renvoyerAttente", { secondes: attenteRenvoi })
              : t("renvoyer")}
          </Button>

          <Link
            href="/admin/connexion"
            className="text-sm font-medium text-neutral-600 hover:text-primary-600 hover:underline"
          >
            {t("retourConnexion")}
          </Link>
        </div>
      </div>
    );
  }

  const enChargement = etat.nom === "chargement";

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl leading-tight font-bold tracking-tight text-neutral-900 sm:text-2xl">
          {t("titre")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t("accroche")}</p>
      </div>

      {etat.nom === "erreur" && (
        <Alert variant="erreur" className="mb-6">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>{t("erreurTitre")}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit((valeurs) => envoyer(valeurs.email))}
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("champEmail")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={t("champEmailExemple")}
                    disabled={enChargement}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" aria-busy={enChargement} disabled={enChargement}>
            {enChargement && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {enChargement ? t("enCours") : etat.nom === "erreur" ? t("reessayer") : t("envoyer")}
          </Button>

          <Link
            href="/admin/connexion"
            className="text-center text-sm font-medium text-neutral-600 hover:text-primary-600 hover:underline"
          >
            {t("retourConnexion")}
          </Link>
        </form>
      </Form>
    </>
  );
}

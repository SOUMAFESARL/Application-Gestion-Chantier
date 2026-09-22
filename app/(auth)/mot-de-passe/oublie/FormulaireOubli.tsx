"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Mail, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { EnTeteFormulaireAuth } from "@/components/layout/CadreAuthDouble";
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
import { demanderReinitialisation } from "@/features/auth/api";
import { schemaOubli } from "@/features/auth/validations";
import type { SaisieOubli, ValeursOubli } from "@/features/auth/validations";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Le même verrou de renvoi que M6 et M8 — un geste, un délai. */
const SECONDES_AVANT_RENVOI = 60;

/** Le rayon de la maquette, commun aux champs et aux boutons des écrans d'authentification. */
const RAYON = "rounded-lg";

type Etat =
  | { nom: "saisie" }
  | { nom: "chargement" }
  | { nom: "envoye"; email: string }
  | { nom: "erreur"; message: string; reference: string | null };

/**
 * Écran « Mot de passe oublié » — maquette M6, écrans 1 et 2.
 *
 * Contrat : `contrat_reinitialisation_mot_de_passe_CCD_Digital.md` §3.
 *
 * **Le serveur répond `202`, que l'adresse existe ou non.** L'écran ne peut
 * donc pas dire « adresse inconnue », et il ne cherche pas à le cacher : il
 * l'écrit. C'est la maquette elle-même qui pose la doctrine — « nous ne
 * confirmons pas si un compte existe ou non » —, et c'est ce qui transforme une
 * réponse frustrante en réponse compréhensible (Socle §5.2, « indiquer toujours
 * quoi faire »).
 */
export function FormulaireOubli() {
  const t = useTranslations("motDePasseOublie");

  const [etat, setEtat] = useState<Etat>({ nom: "saisie" });
  const [attenteRenvoi, setAttenteRenvoi] = useState(0);

  const form = useForm<SaisieOubli, unknown, ValeursOubli>({
    resolver: zodResolver(schemaOubli),
    defaultValues: { email: "" },
  });

  // Le verrou s'écoule tout seul : sans cela le bouton reste désactivé
  // jusqu'à un rechargement de page.
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
    } catch (cause) {
      const erreur = cause as ErreurApi;
      setEtat({
        nom: "erreur",
        message: erreur.message ?? t("erreurTitre"),
        reference: erreur.traceId ?? null,
      });
    }
  }

  async function soumettre(valeurs: ValeursOubli) {
    await envoyer(valeurs.email);
  }

  // -------------------------------------------------------------------------
  // M6 écran 2 — « Vérifiez votre boîte mail »
  // -------------------------------------------------------------------------
  if (etat.nom === "envoye") {
    return (
      <div className="flex flex-col items-center text-center">
        <EnTeteFormulaireAuth
          icone={<Mail size={24} />}
          titre={t("confirmationTitre")}
          description={t.rich("confirmationCorps", {
            fort: (morceaux) => <strong>{morceaux}</strong>,
          })}
        />

        {/* Dire pourquoi la réponse est vague vaut mieux que la laisser vague. */}
        <Alert variant="information" className="text-left">
          <AlertDescription>{t("confidentialite")}</AlertDescription>
        </Alert>

        <div className="mt-6 flex w-full flex-col items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={cn(RAYON, "w-full")}
            disabled={attenteRenvoi > 0}
            onClick={() => void envoyer(etat.email)}
          >
            {attenteRenvoi > 0
              ? t("renvoyerAttente", { secondes: attenteRenvoi })
              : t("renvoyer")}
          </Button>

          <Link
            href="/connexion"
            className="text-sm font-medium text-neutral-600 hover:text-primary-600 hover:underline"
          >
            {t("retourConnexion")}
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Erreur réseau ou serveur
  // -------------------------------------------------------------------------
  if (etat.nom === "erreur") {
    return (
      <div className="flex flex-col items-center text-center">
        <EnTeteFormulaireAuth
          icone={<TriangleAlert size={24} />}
          iconeTon="avertissement"
          titre={t("erreurTitre")}
        />

        <Alert variant="erreur" className="text-left">
          <AlertDescription>
            {etat.message}
            {etat.reference && (
              <span className="opacity-85">
                {t("reference", { reference: etat.reference })}
              </span>
            )}
          </AlertDescription>
        </Alert>

        <Button
          type="button"
          size="lg"
          className={cn(RAYON, "mt-6 w-full")}
          onClick={() => setEtat({ nom: "saisie" })}
        >
          <RefreshCw />
          {t("reessayer")}
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // M6 écran 1 — la demande
  // -------------------------------------------------------------------------
  const enChargement = etat.nom === "chargement";

  return (
    <>
      <EnTeteFormulaireAuth titre={t("titre")} description={t("accroche")} />

      <Form {...form}>
        <form
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit(soumettre)}
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
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={t("champEmailExemple")}
                    disabled={enChargement}
                    className={RAYON}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className={cn(RAYON, "w-full text-base font-semibold")}
            aria-busy={enChargement}
            disabled={enChargement}
          >
            {enChargement && <LoaderCircle className="animate-spin" />}
            {t("envoyer")}
          </Button>

          <Link
            href="/connexion"
            className="text-center text-sm font-medium text-neutral-600 hover:text-primary-600 hover:underline"
          >
            {t("retourConnexion")}
          </Link>
        </form>
      </Form>
    </>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CircleX,
  ExternalLink,
  LoaderCircle,
  Mail,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { EnTeteFormulaireAuth } from "@/components/layout/CadreAuthDouble";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelecteurPays } from "@/components/metier/SelecteurPays";
import { deposerInscription, renvoyerEmail } from "@/features/inscription/api";
import {
  schemaInscription,
  type SaisieInscription,
  type ValeursInscription,
} from "@/features/inscription/validations";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Le délai que M6 applique déjà au renvoi d'un email — même geste, même verrou (60 s). */
const SECONDES_AVANT_RENVOI = 60;

/** Le rayon de la maquette, commun aux champs et aux boutons de cet écran. */
const RAYON = "rounded-lg";

/** Les champs du serveur (`snake_case`) vers ceux du formulaire. */
const CHAMPS_SERVEUR: Record<string, keyof SaisieInscription> = {
  raison_sociale: "raisonSociale",
  pays: "pays",
  email: "email",
  cgu_acceptees: "cgu",
};

type Etat =
  | { nom: "saisie" }
  | { nom: "chargement" }
  | { nom: "envoye"; email: string }
  | { nom: "erreur"; message: string; reference: string | null };

export function FormulaireInscription() {
  const t = useTranslations("inscription");
  // Conventions A7 : l'identifiant est **fourni par le client**, engendré une
  // fois par affichage du formulaire. Un double-clic sur « Créer mon compte »
  // rejoue la même requête et ne crée pas deux demandes.
  const [identifiant] = useState(() => crypto.randomUUID());

  const [etat, setEtat] = useState<Etat>({ nom: "saisie" });
  const [attenteRenvoi, setAttenteRenvoi] = useState(0);

  const form = useForm<SaisieInscription, unknown, ValeursInscription>({
    resolver: zodResolver(schemaInscription),
    defaultValues: { raisonSociale: "", pays: "", email: "", cgu: false },
  });

  // Le verrou de renvoi s'écoule tout seul : sans cela, le bouton reste
  // désactivé jusqu'à un rechargement de page.
  useEffect(() => {
    if (attenteRenvoi <= 0) return;
    const minuterie = setTimeout(() => setAttenteRenvoi((n) => n - 1), 1000);
    return () => clearTimeout(minuterie);
  }, [attenteRenvoi]);

  async function soumettre(valeurs: ValeursInscription) {
    setEtat({ nom: "chargement" });
    try {
      const accuse = await deposerInscription({
        id: identifiant,
        raison_sociale: valeurs.raisonSociale,
        pays: valeurs.pays,
        email: valeurs.email,
        cgu_acceptees: valeurs.cgu,
      });
      setEtat({ nom: "envoye", email: accuse.email });
      setAttenteRenvoi(SECONDES_AVANT_RENVOI);
    } catch (cause) {
      if (cause instanceof ErreurApi && cause.code === "validation") {
        for (const [champServeur, message] of Object.entries(cause.erreursParChamp)) {
          const champ = CHAMPS_SERVEUR[champServeur];
          if (champ) form.setError(champ, { message });
        }
        setEtat({ nom: "saisie" });
        return;
      }
      const erreur = cause as ErreurApi;
      setEtat({
        nom: "erreur",
        message: erreur.message ?? t("erreurGenerique"),
        reference: erreur.traceId ?? null,
      });
    }
  }

  async function relancerEmail() {
    setAttenteRenvoi(SECONDES_AVANT_RENVOI);
    try {
      await renvoyerEmail(identifiant);
    } catch {
      // Le contrat répond `202` même sur un identifiant inconnu : il n'y a
      // rien à annoncer, et surtout rien à révéler.
    }
  }

  // -------------------------------------------------------------------------
  // M8 écran 2 — « Vérifiez votre email »
  // -------------------------------------------------------------------------
  if (etat.nom === "envoye") {
    return (
      <div className="flex flex-col items-center text-center">
        <EnTeteFormulaireAuth
          icone={<Mail size={24} />}
          titre={t("emailTitre")}
          description={t.rich("emailAccroche", {
            email: etat.email,
            fort: (morceaux) => <strong>{morceaux}</strong>,
          })}
        />

        <Alert variant="information" className="text-left">
          <AlertDescription>
            {t.rich("emailValidite", { fort: (morceaux) => <strong>{morceaux}</strong> })}
          </AlertDescription>
        </Alert>

        <div className="mt-6 flex w-full flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={cn(RAYON, "w-full")}
            onClick={relancerEmail}
            disabled={attenteRenvoi > 0}
          >
            {attenteRenvoi > 0
              ? t("renvoyerAttente", { secondes: attenteRenvoi })
              : t("renvoyer")}
          </Button>

          <Link
            href="/connexion"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
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
          <CircleX />
          <AlertTitle>{t("erreurAlerte")}</AlertTitle>
          <AlertDescription>
            {etat.message}
            {etat.reference && (
              <span className="opacity-85">{t("reference", { reference: etat.reference })}</span>
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
  // M8 écrans 1 et 7 — saisie, et saisie en erreur
  // -------------------------------------------------------------------------
  const enChargement = etat.nom === "chargement";

  return (
    <>
      <EnTeteFormulaireAuth titre={t("titre")} />

      <Form {...form}>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(soumettre)} noValidate>
          <FormField
            control={form.control}
            name="raisonSociale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("champRaisonSociale")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="organization"
                    placeholder={t("champRaisonSocialePlaceholder")}
                    disabled={enChargement}
                    className={RAYON}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("champPays")}</FormLabel>
                <FormControl>
                  <SelecteurPays
                    value={field.value}
                    onChange={field.onChange}
                    disabled={enChargement}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <FormField
            control={form.control}
            name="cgu"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(coche) => field.onChange(coche === true)}
                      disabled={enChargement}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <FormLabel className="block text-xs leading-relaxed font-normal text-neutral-600">
                    {t.rich("cgu", {
                      lienCgu: (morceaux) => (
                        <a
                          className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                          href="/cgu"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {morceaux}
                          <ExternalLink className="inline" size={11} aria-hidden="true" />
                        </a>
                      ),
                      lienConfidentialite: (morceaux) => (
                        <a
                          className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                          href="/confidentialite"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {morceaux}
                          <ExternalLink className="inline" size={11} aria-hidden="true" />
                        </a>
                      ),
                    })}
                  </FormLabel>
                </div>
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
            {enChargement ? t("creationEnCours") : t("creer")}
          </Button>
        </form>
      </Form>

      {/*
        Pied bleedé jusqu'aux bords de la carte, comme celui de la connexion
        (`(auth)/connexion/page.tsx`) : même filet `border-t` et même bande
        `neutral-100` — les deux extrémités de la carte reculent d'un ton,
        le blanc ne reste que sur la zone de saisie. Ici la carte n'a qu'un
        `CardContent`, donc le pied annule son padding (`-mx`/`-mb`) plutôt que
        d'exister comme `CardFooter` séparé — la création de compte n'est qu'un
        des quatre états de ce formulaire, contrairement à la connexion à état
        fixe.
      */}
      <div className="-mx-6 -mb-8 mt-6 border-t border-border bg-neutral-100 px-6 py-5 text-center sm:-mx-8 sm:px-8">
        <p className="text-sm text-neutral-600">
          {t("dejaCompte")}{" "}
          <Link
            href="/connexion"
            className="font-semibold text-primary-600 hover:text-primary-700 hover:underline"
          >
            {t("seConnecter")}
          </Link>
        </p>
      </div>
    </>
  );
}

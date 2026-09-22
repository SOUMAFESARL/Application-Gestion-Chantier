"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  Mail,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { demanderReinitialisation, seConnecter } from "@/features/auth/api";
import {
  compteCommeTentative,
  etatDepuisErreur,
  saisiePossible,
  TENTATIVES_MAX,
} from "@/features/auth/etats";
import type { EtatConnexion } from "@/features/auth/etats";
import { schemaConnexion } from "@/features/auth/validations";
import type { SaisieConnexion, ValeursConnexion } from "@/features/auth/validations";
import { lireProgression } from "@/features/configuration/api";
import { effacerJetons } from "@/lib/api";
import { lireRouteRetour, purgerRouteRetour } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const DESTINATION_TABLEAU_DE_BORD = "/tableau-de-bord";
const DESTINATION_CONFIGURATION = "/parametres/configuration";

/**
 * La configuration initiale n'est proposée qu'une fois — celle où les champs
 * obligatoires de l'entreprise sont encore vides. Une fois `terminee_le`
 * posé par le serveur (assistant complété lors d'une connexion précédente),
 * il n'y a plus de raison d'y repasser : direction le tableau de bord.
 *
 * Un échec de lecture (réseau, 403) retombe sur la configuration — mieux
 * vaut la proposer à tort qu'un écran blanc juste après une connexion
 * réussie.
 */
async function destinationParDefaut(): Promise<string> {
  try {
    const progression = await lireProgression();
    return progression.terminee_le ? DESTINATION_TABLEAU_DE_BORD : DESTINATION_CONFIGURATION;
  } catch {
    return DESTINATION_CONFIGURATION;
  }
}

/** Le rayon de la maquette, commun aux champs et aux boutons de cet écran. */
const RAYON = "rounded-lg";

/**
 * Le formulaire de connexion.
 *
 * **Pourquoi pas une server action** (consignes : « privilégier les server
 * actions ») : `seConnecter()` écrit le jeton d'accès *en mémoire du
 * navigateur* et le jeton de renouvellement dans `localStorage`. Une server
 * action n'a accès ni à l'un ni à l'autre. Le jour où le backend posera la
 * session en cookie `httpOnly` (demande B-001, arbitrage A4), cette fonction
 * deviendra une server action sans que le schéma zod ni le balisage ci-dessous
 * ne changent — c'est précisément pour cela que la validation vit dans
 * `features/auth/validations.ts` et non ici.
 */
export function FormulaireConnexion() {
  const t = useTranslations("connexion");
  const router = useRouter();
  const parametres = useSearchParams();
  const queryClient = useQueryClient();

  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [emailRenvoye, setEmailRenvoye] = useState(false);

  // Le compteur des cinq essais, tenu ici : le serveur ne l'envoie plus, ses
  // cinq causes d'échec étant devenues indiscernables (contrat §6.1).
  const [tentatives, setTentatives] = useState(0);

  // La session expirée n'est pas un échec de connexion : c'est l'état dans
  // lequel on ARRIVE sur cet écran, quand le renouvellement du jeton a
  // échoué ailleurs dans l'application.
  const [etat, setEtat] = useState<EtatConnexion>(() =>
    parametres.get("session") === "expiree"
      ? { nom: "session_expiree" }
      : { nom: "saisie" },
  );

  const form = useForm<SaisieConnexion, unknown, ValeursConnexion>({
    resolver: zodResolver(schemaConnexion),
    defaultValues: { email: "", motDePasse: "" },
  });

  useEffect(() => {
    if (parametres.get("session") === "expiree") {
      queryClient.clear();
      effacerJetons();
    }
  }, [parametres, queryClient]);

  /**
   * Changer d'adresse remet le compteur à zéro.
   *
   * Sinon, essayer deux comptes différents ferait avancer un compteur unique,
   * et l'écran annoncerait un blocage qui ne viendra pas — parcours §5.1.
   */
  function changerEmail() {
    setTentatives(0);
    if (etat.nom === "identifiants_invalides") setEtat({ nom: "saisie" });
    // L'erreur posée à la main après un refus du serveur ne porte sur aucun
    // des deux champs en particulier : elle disparaît dès que l'un bouge.
    form.clearErrors();
  }

  async function soumettre(valeurs: ValeursConnexion) {
    setEtat({ nom: "chargement" });

    try {
      await seConnecter({
        email: valeurs.email,
        mot_de_passe: valeurs.motDePasse,
        origine: "WEB",
      });
      setTentatives(0);
      setEtat({ nom: "succes" });

      const retour = lireRouteRetour();
      purgerRouteRetour();
      const cible =
        (retour && !retour.startsWith("/connexion") ? retour : null) ??
        parametres.get("redirection");
      const destination =
        cible && cible.startsWith("/") && !cible.startsWith("//")
          ? cible
          : await destinationParDefaut();
      router.replace(destination);
    } catch (cause) {
      // Une panne réseau et un 429 ne sont pas des mots de passe ratés.
      const total = compteCommeTentative(cause) ? tentatives + 1 : tentatives;
      const suivant = etatDepuisErreur(cause, total);
      setTentatives(total);
      setEtat(suivant);

      // L'adresse est conservée : la retaper à chaque essai est une punition
      // sans objet, et sur un téléphone de chantier, trente secondes.
      form.setValue("motDePasse", "");

      if (suivant.nom === "identifiants_invalides") {
        // Le serveur ne dit pas lequel des deux est faux — il ne le dira
        // jamais (contrat §6.1). Les deux champs sont donc marqués invalides,
        // et un seul message est écrit, sous le mot de passe : c'est le champ
        // sur lequel le focus revient.
        form.setError("email", { message: "" });
        form.setError("motDePasse", { message: t("champErreur") });
        form.setFocus("motDePasse");
      }
    }
  }

  async function renvoyerEmailDeblocage() {
    try {
      await demanderReinitialisation(form.getValues("email"));
    } finally {
      // Workflow T2 : le retour est identique que le compte existe ou non.
      setEmailRenvoye(true);
    }
  }

  const enChargement = etat.nom === "chargement";
  const champsActifs = saisiePossible(etat);
  // `useWatch` plutôt que `form.watch()` : le second rend une fonction que le
  // compilateur React ne sait pas mémoriser, et il renonce alors à optimiser
  // tout le composant. Le hook s'abonne au même état et se laisse compiler.
  const saisie = useWatch({ control: form.control });
  const rienASoumettre = !saisie.email || !saisie.motDePasse;

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(soumettre)}
        noValidate
      >
        <Message etat={etat} emailRenvoye={emailRenvoye} />

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
                  disabled={!champsActifs}
                  className={RAYON}
                  onChange={(evenement) => {
                    field.onChange(evenement);
                    changerEmail();
                  }}
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
              <FormLabel>{t("champMotDePasse")}</FormLabel>
              {/*
                `FormControl` pose l'`id`, l'`aria-invalid` et
                l'`aria-describedby` sur son enfant **direct**. L'enveloppe
                de positionnement est donc à l'extérieur : à l'intérieur, ces
                attributs atterriraient sur le `div`, le `label` désignerait
                le `div`, et cliquer sur « Mot de passe » ne donnerait plus le
                focus au champ.
              */}
              <div className="relative">
                <FormControl>
                  <Input
                    {...field}
                    type={motDePasseVisible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={!champsActifs}
                    className={cn(RAYON, "pr-12")}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                  onClick={() => setMotDePasseVisible((visible) => !visible)}
                  aria-label={
                    motDePasseVisible
                      ? t("masquerMotDePasse")
                      : t("afficherMotDePasse")
                  }
                  aria-pressed={motDePasseVisible}
                  disabled={!champsActifs}
                >
                  {motDePasseVisible ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/*
          Le lien reste visible en toute circonstance, blocage compris. Depuis
          que le blocage ne s'éteint plus seul, l'email de réinitialisation en
          est la SEULE sortie : un écran qui masquerait ce lien enfermerait le
          compte sans que rien ne le signale. Sa présence est une exigence
          fonctionnelle, pas un choix de mise en page — contrat §6.4.
        */}
        <div className="-mt-1 text-right">
          <Link
            href="/mot-de-passe/oublie"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            {t("motDePasseOublie")}
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          className={cn(RAYON, "w-full text-base font-semibold")}
          aria-busy={enChargement}
          disabled={!champsActifs || enChargement || rienASoumettre}
        >
          {enChargement && <LoaderCircle className="animate-spin" />}
          {enChargement ? t("connexionEnCours") : t("seConnecter")}
        </Button>

        {etat.nom === "compte_bloque" && !emailRenvoye && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className={cn(RAYON, "w-full")}
            onClick={renvoyerEmailDeblocage}
          >
            <Mail />
            {t("renvoyerDeblocage")}
          </Button>
        )}

        {(etat.nom === "erreur_reseau" || etat.nom === "trop_de_requetes") && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={cn(RAYON, "w-full")}
            onClick={() => setEtat({ nom: "saisie" })}
          >
            <RefreshCw />
            {t("reessayer")}
          </Button>
        )}
      </form>
    </Form>
  );
}

// ---------------------------------------------------------------------------

/**
 * Le message d'état, au-dessus des champs.
 *
 * Chaque ton est doublé d'une icône : la couleur ne porte jamais
 * l'information seule (charte §8.4).
 */
function Message({
  etat,
  emailRenvoye,
}: {
  etat: EtatConnexion;
  emailRenvoye: boolean;
}) {
  const t = useTranslations("connexion");

  switch (etat.nom) {
    case "session_expiree":
      return (
        <Alert variant="information">
          <Info />
          <AlertTitle>{t("sessionExpireeTitre")}</AlertTitle>
          <AlertDescription>{t("sessionExpireeCorps")}</AlertDescription>
        </Alert>
      );

    case "succes":
      return (
        <Alert variant="succes">
          <CircleCheck />
          <AlertTitle>{t("succesTitre")}</AlertTitle>
          <AlertDescription>{t("succesCorps")}</AlertDescription>
        </Alert>
      );

    case "identifiants_invalides": {
      // À une tentative de la fin, on avertit au lieu de constater : le ton
      // change parce que la conséquence change. C'est le seul endroit de cet
      // écran où l'on avertit — parcours §5.2.
      const imminent = etat.tentatives === TENTATIVES_MAX - 1;

      return (
        <Alert variant={imminent ? "avertissement" : "erreur"}>
          {imminent ? <TriangleAlert /> : <CircleX />}
          <AlertTitle>
            {imminent ? t("derniereTentativeTitre") : t("echecTitre")}
          </AlertTitle>
          <AlertDescription>
            {imminent ? t("derniereTentativeCorps") : t("echecCorps")}
            <span className="opacity-85">
              {t("tentative", {
                faites: etat.tentatives,
                total: TENTATIVES_MAX,
              })}
            </span>
          </AlertDescription>
        </Alert>
      );
    }

    case "compte_bloque":
      return (
        <Alert variant="erreur">
          <CircleX />
          <AlertTitle>{t("bloqueTitre")}</AlertTitle>
          <AlertDescription>
            {/*
              « Si cette adresse est enregistrée » : le compteur étant tenu par
              le client, cet écran s'atteint aussi sur une adresse qui n'existe
              pas — cinq essais sur n'importe quoi y mènent. Affirmer qu'un
              email est parti serait alors faux. La formulation est vraie dans
              les deux cas.

              Et le blocage n'est plus « temporaire » : l'expiration
              automatique à quinze minutes a été supprimée, l'email est la
              seule sortie.
            */}
            {emailRenvoye
              ? t("bloqueCorpsRenvoye", { total: TENTATIVES_MAX })
              : t("bloqueCorps", { total: TENTATIVES_MAX })}
          </AlertDescription>
        </Alert>
      );

    case "trop_de_requetes":
      return (
        <Alert variant="avertissement">
          <TriangleAlert />
          <AlertTitle>{t("tropDeRequetesTitre")}</AlertTitle>
          <AlertDescription>{t("tropDeRequetesCorps")}</AlertDescription>
        </Alert>
      );

    case "erreur_reseau":
      return (
        <Alert variant="avertissement">
          <TriangleAlert />
          <AlertTitle>{t("reseauTitre")}</AlertTitle>
          <AlertDescription>{etat.message}</AlertDescription>
        </Alert>
      );

    case "erreur_inattendue":
      return (
        <Alert variant="erreur">
          <CircleX />
          <AlertTitle>{t("inattendueTitre")}</AlertTitle>
          <AlertDescription>
            {/* Le message vient de l'API quand elle en a rédigé un — guide §9. */}
            {etat.message ?? t("inattendueCorps")}
            {etat.reference && (
              <span className="opacity-85">
                {t("reference")} <code className="font-mono">{etat.reference}</code>
              </span>
            )}
          </AlertDescription>
        </Alert>
      );

    default:
      return null;
  }
}

"use client";

import {
  Check,
  CircleCheck,
  Copy,
  LoaderCircle,
  Timer,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { CadreAuthDouble, PanneauMarqueDegrade } from "@/components/layout/CadreAuthDouble";
import { ChampsMotDePasse } from "@/components/metier/ChampsMotDePasse";
import { useReglesMotDePasse } from "@/features/auth/reglesMotDePasse";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  activer,
  lireEtatProvisionnement,
  verifierJeton,
} from "@/features/inscription/api";
import type { ContenuJeton } from "@/features/inscription/api";

/** T-021 §7.1 : deux minutes, puis on cesse d'interroger. */
const INTERVALLE_SONDE = 2000;
const SONDES_MAX = 60;

type Etat =
  | { nom: "verification" }
  | { nom: "saisie"; contenu: ContenuJeton }
  | { nom: "incomplet" }
  | { nom: "expire" }
  | { nom: "provisionnement"; suivi: string }
  | { nom: "pret"; url: string }
  | { nom: "echec"; message: string; reference: string | null };

export function EcranActivation() {
  const t = useTranslations("activation");
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ nom: "verification" });
  const [copie, setCopie] = useState(false);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Le hook vit **avant** les retours anticipés de la machine à états : appelé
  // plus bas, il ne s'exécutait pas sur les rendus qui sortent tôt, et l'ordre
  // des hooks changeait d'un rendu à l'autre — ce que React interdit.
  //
  // L'activation demande un nom en plus du mot de passe : les règles servies
  // ne couvrent que le second.
  const { regles, complet: motDePasseValide } = useReglesMotDePasse(
    motDePasse,
    confirmation,
  );
  const complet = motDePasseValide && nom.trim().length > 0;

  // Le nom de l'entreprise n'est connu qu'après vérification du jeton — le
  // panneau de gauche affiche donc un message générique jusque-là.
  const panneau = (
    <PanneauMarqueDegrade>
      {etat.nom === "saisie"
        ? t.rich("panneauBienvenue", {
            entreprise: etat.contenu.raison_sociale,
            fort: (morceaux) => <strong>{morceaux}</strong>,
          })
        : t("panneauBienvenueDefaut")}
    </PanneauMarqueDegrade>
  );

  const jeton = useRef<string>("");

  // -------------------------------------------------------------------------
  // Le jeton voyage en **fragment** (`#jeton=…`), jamais en paramètre de
  // requête (R-84) : un fragment n'atteint ni les journaux du serveur, ni les
  // en-têtes `Referer`. Il n'est lisible que côté navigateur.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const valeur = fragment.get("jeton") ?? "";
    jeton.current = valeur;

    let vivant = true;

    // L'exécution asynchrone via promesse évite un setState synchrone dans
    // l'effet, ce qui déclencherait un rendu en cascade interdit par React 19.
    const verification = valeur
      ? verifierJeton(valeur)
      : Promise.reject(new Error("fragment_absent"));

    verification
      .then((contenu) => {
        if (vivant) setEtat({ nom: "saisie", contenu });
      })
      .catch((err: Error) => {
        if (!vivant) return;
        if (err.message === "fragment_absent") {
          setEtat({ nom: "incomplet" });
        } else {
          // Expiré, consommé, révoqué ou inconnu : lien invalide.
          setEtat({ nom: "expire" });
        }
      });

    return () => {
      vivant = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Sonde d'état du provisionnement — T-021 §7.1
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (etat.nom !== "provisionnement") return;

    let tentatives = 0;
    let vivant = true;

    const interroger = async () => {
      if (!vivant) return;
      tentatives += 1;

      try {
        const reponse = await lireEtatProvisionnement(etat.suivi);
        if (!vivant) return;

        if (reponse.statut === "PRET") {
          setEtat({ nom: "pret", url: reponse.url_connexion });
          return;
        }
        if (reponse.statut === "ECHEC") {
          setEtat({ nom: "echec", message: t("echecMessage"), reference: null });
          return;
        }
      } catch (cause) {
        const erreur = cause as ErreurApi;
        if (!vivant) return;
        setEtat({ nom: "echec", message: erreur.message, reference: erreur.traceId });
        return;
      }

      // Au-delà de deux minutes, c'est un incident : interroger indéfiniment
      // ne le résout pas, cela ajoute du trafic à une plateforme en difficulté.
      if (tentatives >= SONDES_MAX) {
        setEtat({ nom: "echec", message: t("lenteurMessage"), reference: null });
        return;
      }

      minuterie = setTimeout(interroger, INTERVALLE_SONDE);
    };

    let minuterie = setTimeout(interroger, INTERVALLE_SONDE);
    return () => {
      vivant = false;
      clearTimeout(minuterie);
    };
  }, [etat, t]);

  // Redirection vers le sous-domaine du client, une fois l'espace prêt.
  useEffect(() => {
    if (etat.nom !== "pret") return;
    const minuterie = setTimeout(() => {
      window.location.href = etat.url;
    }, 1500);
    return () => clearTimeout(minuterie);
  }, [etat]);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setEnCours(true);
    try {
      const accuse = await activer({
        jeton: jeton.current,
        nom: nom.trim(),
        prenom: prenom.trim(),
        mot_de_passe: motDePasse,
      });
      setEtat({ nom: "provisionnement", suivi: accuse.suivi });
    } catch (cause) {
      const erreur = cause as ErreurApi;
      if (erreur.code === "jeton_expire") {
        setEtat({ nom: "expire" });
      } else if (erreur.code === "inscription_deja_activee") {
        setEtat({
          nom: "echec",
          message: t("dejaActifMessage"),
          reference: null,
        });
      } else {
        setEtat({ nom: "echec", message: erreur.message, reference: erreur.traceId });
      }
    } finally {
      setEnCours(false);
    }
  }

  // -------------------------------------------------------------------------
  // Chargement — vérification du jeton
  // -------------------------------------------------------------------------
  if (etat.nom === "verification") {
    return (
      <CadreAuthDouble panneau={panneau}>
        <Card className="overflow-hidden shadow-md">
          <CardContent
            className="flex flex-col items-center gap-3 px-6 py-16 text-center sm:px-8"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle className="size-8 animate-spin text-primary-500" aria-hidden="true" />
            <p className="text-base text-neutral-600">{t("verification")}</p>
          </CardContent>
        </Card>
      </CadreAuthDouble>
    );
  }

  // -------------------------------------------------------------------------
  // Lien incomplet — fragment #jeton=... manquant
  // -------------------------------------------------------------------------
  if (etat.nom === "incomplet") {
    return (
      <CadreAuthDouble panneau={panneau}>
        <Card className="overflow-hidden shadow-md">
          <BlocEtat ton="avertissement" icone={<TriangleAlert className="size-7" />} titre={t("incompletTitre")}>
            <p>{t("incompletAccroche")}</p>
            <Alert variant="avertissement" className="text-left">
              <TriangleAlert />
              <AlertDescription>
                {t.rich("incompletAide", { fort: (morceaux) => <strong>{morceaux}</strong> })}
              </AlertDescription>
            </Alert>
            <div className="flex w-full flex-col items-center gap-3">
              <Button size="lg" className="w-full" onClick={() => router.push("/inscription")}>
                {t("recommencer")}
              </Button>
              <Link href="/connexion" className="text-sm text-neutral-600 hover:text-neutral-800 hover:underline">
                {t("retourConnexion")}
              </Link>
            </div>
          </BlocEtat>
        </Card>
      </CadreAuthDouble>
    );
  }

  // -------------------------------------------------------------------------
  // M8 écran 6 — lien expiré
  // -------------------------------------------------------------------------
  if (etat.nom === "expire") {
    return (
      <CadreAuthDouble panneau={panneau}>
        <Card className="overflow-hidden shadow-md">
          <BlocEtat ton="avertissement" icone={<Timer className="size-7" />} titre={t("expireTitre")}>
            <p>
              {t.rich("expireAccroche", { fort: (morceaux) => <strong>{morceaux}</strong> })}
            </p>
            <Alert variant="avertissement" className="text-left">
              <TriangleAlert />
              <AlertDescription>
                {t.rich("expireRien", { fort: (morceaux) => <strong>{morceaux}</strong> })}
              </AlertDescription>
            </Alert>
            <div className="flex w-full flex-col items-center gap-3">
              <Button size="lg" className="w-full" onClick={() => router.push("/inscription")}>
                {t("recommencer")}
              </Button>
              <Link href="/connexion" className="text-sm text-neutral-600 hover:text-neutral-800 hover:underline">
                {t("retourConnexion")}
              </Link>
            </div>
          </BlocEtat>
        </Card>
      </CadreAuthDouble>
    );
  }

  // -------------------------------------------------------------------------
  // Attente du provisionnement — T-020 §3.2
  // -------------------------------------------------------------------------
  if (etat.nom === "provisionnement") {
    return (
      <CadreAuthDouble panneau={panneau}>
        <Card className="overflow-hidden shadow-md">
          <BlocEtat icone={<LoaderCircle className="size-7 animate-spin" />} titre={t("creationTitre")}>
            <p>{t("creationAccroche")}</p>
            <p className="text-sm text-neutral-500" role="status">
              {t("creationPatience")}
            </p>
          </BlocEtat>
        </Card>
      </CadreAuthDouble>
    );
  }

  if (etat.nom === "pret") {
    return (
      <CadreAuthDouble panneau={panneau}>
        <Card className="overflow-hidden shadow-md">
          <BlocEtat ton="succes" icone={<CircleCheck className="size-7" />} titre={t("pretTitre")}>
            <p>{t("pretAccroche")}</p>
            <Button size="lg" className="w-full" onClick={() => window.location.assign(etat.url)}>
              {t("pretAction")}
            </Button>
          </BlocEtat>
        </Card>
      </CadreAuthDouble>
    );
  }

  if (etat.nom === "echec") {
    const copierReference = () => {
      if (!etat.reference) return;
      navigator.clipboard.writeText(etat.reference);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    };

    const sujetSupport = etat.reference
      ? t("sujetSupportAvecReference", { reference: etat.reference })
      : t("sujetSupport");
    const lienSupport = `mailto:support@ccd-digital.ci?subject=${encodeURIComponent(sujetSupport)}`;

    return (
      <CadreAuthDouble panneau={panneau}>
        <Card className="overflow-hidden shadow-md">
          <BlocEtat ton="avertissement" icone={<TriangleAlert className="size-7" />} titre={t("echecTitre")}>
            <Alert variant="erreur" className="text-left">
              <TriangleAlert />
              <AlertTitle>{t("echecAlerte")}</AlertTitle>
              <AlertDescription>{etat.message}</AlertDescription>
            </Alert>
            {etat.reference && (
              <div className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-100 px-3 py-2 font-mono text-xs break-all text-neutral-800">
                <span>{t("reference", { reference: etat.reference })}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 font-sans"
                  onClick={copierReference}
                  aria-label={t("copierReference")}
                >
                  {copie ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copie ? t("referenceCopiee") : t("copierReference")}
                </Button>
              </div>
            )}
            <div className="flex w-full flex-col items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => window.location.assign(lienSupport)}
              >
                {t("contacterSupport")}
              </Button>
              <Link href="/connexion" className="text-sm text-neutral-600 hover:text-neutral-800 hover:underline">
                {t("retourConnexion")}
              </Link>
            </div>
          </BlocEtat>
        </Card>
      </CadreAuthDouble>
    );
  }

  // -------------------------------------------------------------------------
  // M8 écran 3 — activation du compte
  // -------------------------------------------------------------------------

  return (
    <CadreAuthDouble panneau={panneau}>
      <Card className="gap-0 overflow-hidden py-0 shadow-md">
        {/* Même bande `neutral-100` + filet que la connexion et l'inscription :
            l'en-tête recule d'un ton, le blanc de la carte ne reste que
            sur la zone de saisie. */}
        <CardHeader className="gap-1.5 border-b border-border bg-neutral-100 px-6 pt-8 pb-6 text-center sm:px-8">
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-neutral-900 sm:text-3xl">
            {t("activerTitre")}
          </h1>
          <p className="text-base leading-relaxed text-neutral-600">
            {t.rich("activerAccroche", {
              entreprise: etat.contenu.raison_sociale,
              fort: (morceaux) => <strong className="font-semibold text-neutral-800">{morceaux}</strong>,
            })}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 px-6 pt-8 pb-8 sm:px-8">
          <div className="flex flex-col gap-0.5 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
            <span className="text-xs font-medium text-primary-700">{t("compteAdministrateur")}</span>
            <span className="text-sm font-semibold break-all text-neutral-900">{etat.contenu.email}</span>
          </div>

          {/* `--input-height` est réduite localement (48px → 44px) pour cet
              écran seulement : le jeton reste à 48px partout ailleurs, où il
              porte la cible tactile du Socle §8. */}
          <form
            className="flex flex-col gap-5"
            style={{ "--input-height": "44px" } as React.CSSProperties}
            onSubmit={soumettre}
            noValidate
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nom">{t("champNom")}</Label>
                <Input
                  id="nom"
                  required
                  autoComplete="family-name"
                  value={nom}
                  disabled={enCours}
                  onChange={(e) => setNom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prenom">{t("champPrenom")}</Label>
                <Input
                  id="prenom"
                  autoComplete="given-name"
                  value={prenom}
                  disabled={enCours}
                  onChange={(e) => setPrenom(e.target.value)}
                />
              </div>
            </div>

            {/* Les trois portes du contrat §1 posent le même geste : le composant
                est partagé, et les cinq contrôles ne vivent qu'à un endroit. */}
            <ChampsMotDePasse
              motDePasse={motDePasse}
              confirmation={confirmation}
              onMotDePasse={setMotDePasse}
              onConfirmation={setConfirmation}
              disabled={enCours}
              regles={regles}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full text-base font-semibold"
              aria-busy={enCours}
              disabled={!complet || enCours}
            >
              {enCours && <LoaderCircle className="animate-spin" />}
              {t("activerAction")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </CadreAuthDouble>
  );
}

// ---------------------------------------------------------------------------

/**
 * Bloc centré des écrans de confirmation — M8 écrans 2, 4 et 6.
 * La pastille porte l'icône ; le texte reste lisible seul (charte §8.4).
 */
function BlocEtat({
  ton = "primaire",
  icone,
  titre,
  children,
}: {
  ton?: "primaire" | "succes" | "avertissement";
  icone: ReactNode;
  titre: ReactNode;
  children: ReactNode;
}) {
  return (
    <CardContent className="flex flex-col items-center gap-1.5 px-6 py-10 text-center sm:px-8">
      <span
        aria-hidden="true"
        className={cn(
          "mb-3 flex size-14 items-center justify-center rounded-full",
          ton === "succes" && "bg-succes-fond text-succes",
          ton === "avertissement" && "bg-avertissement-fond text-avertissement",
          ton === "primaire" && "bg-primary-50 text-primary-500",
        )}
      >
        {icone}
      </span>
      <h1 className="text-2xl leading-tight font-bold tracking-tight text-neutral-900">
        {titre}
      </h1>
      <div className="mt-1 flex w-full flex-col items-center gap-4 text-base leading-relaxed text-neutral-600">
        {children}
      </div>
    </CardContent>
  );
}

"use client";

import { CircleCheck, LoaderCircle, Timer, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { BlocEtatAuth, CadreAuthDouble, PanneauMarqueDegrade } from "@/components/layout/CadreAuthDouble";
import { ChampsMotDePasse } from "@/components/metier/ChampsMotDePasse";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useReglesMotDePasse } from "@/features/auth/reglesMotDePasse";
import {
  accepterInvitation,
  verifierInvitation,
} from "@/features/invitations/api";
import type { ContenuInvitation } from "@/features/invitations/api";
import { ErreurApi } from "@/lib/api";

/**
 * Écran « Invitation d'un collaborateur ».
 *
 * L'admin/DG a déjà saisi le nom du collaborateur en créant l'invitation
 * (`gestionCollaborateurs`) — cet écran ne redemande donc que le mot de
 * passe. Contrairement à l'activation d'entreprise (`/activation`), il ne
 * connecte pas automatiquement : le compte rejoint un espace qui existe déjà,
 * et la connexion normale reste le seul chemin qui pose une session.
 *
 * La mise en page reprend celle de l'activation d'entreprise : cadre double,
 * panneau en dégradé de marque qui nomme l'entreprise une fois le jeton
 * vérifié, carte à en-tête `neutral-100`.
 */

type Etat =
  | { nom: "verification" }
  | { nom: "saisie"; contenu: ContenuInvitation }
  | { nom: "expire" }
  | { nom: "succes" };

export function EcranInvitation() {
  const t = useTranslations("invitation");
  const router = useRouter();

  const [etat, setEtat] = useState<Etat>({ nom: "verification" });
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);

  const jeton = useRef<string>("");

  const { regles, complet } = useReglesMotDePasse(motDePasse, confirmation);

  // Le nom de l'entreprise n'est connu qu'après vérification du jeton — le
  // panneau de gauche affiche donc un message générique jusque-là.
  const panneau = (
    <PanneauMarqueDegrade>
      {etat.nom === "saisie"
        ? t.rich("panneauBienvenue", {
            entreprise: etat.contenu.entreprise,
            fort: (morceaux) => <strong>{morceaux}</strong>,
          })
        : t("panneauBienvenueDefaut")}
    </PanneauMarqueDegrade>
  );

  // Lecture du jeton depuis le fragment de l'URL (#jeton=...)
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const valeur = fragment.get("jeton") || query.get("jeton") || "";
    jeton.current = valeur;

    let vivant = true;

    const verification = valeur
      ? verifierInvitation(valeur)
      : Promise.reject(new Error("jeton_absent"));

    verification
      .then((contenu) => {
        if (vivant) setEtat({ nom: "saisie", contenu });
      })
      .catch(() => {
        if (vivant) setEtat({ nom: "expire" });
      });

    return () => {
      vivant = false;
    };
  }, []);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!complet || enCours) return;

    setEnCours(true);
    setErreurSaisie(null);

    try {
      await accepterInvitation({
        jeton: jeton.current,
        mot_de_passe: motDePasse,
      });
      setEtat({ nom: "succes" });
    } catch (cause) {
      const erreur = cause as ErreurApi;
      if (erreur.code === "jeton_expire") {
        setEtat({ nom: "expire" });
      } else {
        setErreurSaisie(erreur.message || t("erreurTitre"));
      }
    } finally {
      setEnCours(false);
    }
  }

  // 1. Chargement — vérification du jeton
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
            <p className="text-base text-neutral-600">{t("chargement")}</p>
          </CardContent>
        </Card>
      </CadreAuthDouble>
    );
  }

  // 2. Lien expiré ou invalide
  if (etat.nom === "expire") {
    return (
      <CadreAuthDouble panneau={panneau}>
        <Card className="overflow-hidden shadow-md">
          <BlocEtatAuth ton="avertissement" icone={<Timer className="size-7" />} titre={t("expireTitre")}>
            <p>{t("expireAccroche")}</p>
            <Button size="lg" className="w-full" onClick={() => router.push("/connexion")}>
              {t("expireAction")}
            </Button>
          </BlocEtatAuth>
        </Card>
      </CadreAuthDouble>
    );
  }

  // 3. Succès — vers la connexion, pas d'auto-connexion
  if (etat.nom === "succes") {
    return (
      <CadreAuthDouble panneau={panneau}>
        <Card className="overflow-hidden shadow-md">
          <BlocEtatAuth ton="succes" icone={<CircleCheck className="size-7" />} titre={t("succesTitre")}>
            <p>{t("succesAccroche")}</p>
            <Button size="lg" className="w-full" onClick={() => router.push("/connexion")}>
              {t("seConnecter")}
            </Button>
          </BlocEtatAuth>
        </Card>
      </CadreAuthDouble>
    );
  }

  // 4. Définition du mot de passe
  const contenu = etat.contenu;

  return (
    <CadreAuthDouble panneau={panneau}>
      <Card className="gap-0 overflow-hidden py-0 shadow-md">
        {/* Même bande `neutral-100` + filet que l'activation d'entreprise. */}
        <CardHeader className="gap-1.5 border-b border-border bg-neutral-100 px-6 pt-8 pb-6 text-center sm:px-8">
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-neutral-900 sm:text-3xl">
            {t("titre", { entreprise: contenu.entreprise })}
          </h1>
          <p className="text-base leading-relaxed text-neutral-600">
            {t.rich("accroche", {
              role: contenu.role_libelle,
              fort: (morceaux) => <strong className="font-semibold text-neutral-800">{morceaux}</strong>,
            })}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 px-6 pt-8 pb-8 sm:px-8">
          <div className="flex flex-col gap-0.5 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
            <span className="text-xs font-medium text-primary-700">{t("champEmail")}</span>
            <span className="text-sm font-semibold break-all text-neutral-900">{contenu.email}</span>
          </div>

          {erreurSaisie && (
            <Alert variant="erreur">
              <TriangleAlert />
              <AlertDescription>{erreurSaisie}</AlertDescription>
            </Alert>
          )}

          {/* `--input-height` réduite localement (48px → 44px), comme sur
              l'activation d'entreprise. */}
          <form
            className="flex flex-col gap-5"
            style={{ "--input-height": "44px" } as React.CSSProperties}
            onSubmit={soumettre}
            noValidate
          >
            <ChampsMotDePasse
              motDePasse={motDePasse}
              confirmation={confirmation}
              regles={regles}
              onMotDePasse={setMotDePasse}
              onConfirmation={setConfirmation}
              disabled={enCours}
            />

            <div className="flex flex-col items-center gap-3">
              <Button
                type="submit"
                size="lg"
                className="w-full text-base font-semibold"
                aria-busy={enCours}
                disabled={!complet || enCours}
              >
                {enCours && <LoaderCircle className="animate-spin" />}
                {t("boutonActiver")}
              </Button>
              <Link href="/connexion" className="text-sm text-neutral-600 hover:text-neutral-800 hover:underline">
                {t("retourConnexion")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </CadreAuthDouble>
  );
}

"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ETAPES,
  lireProgression,
  passerEtape,
  validerEtape,
} from "@/features/configuration/api";
import type { CodeEtape, Progression } from "@/features/configuration/api";

import { Bouton, EtatChargement, EtatErreur, Modale } from "./_ui";
import { Confirmation } from "./Confirmation";
import { EtapeEntreprise } from "./EtapeEntreprise";
import { EtapeEquipe } from "./EtapeEquipe";
import { EtapeProjet } from "./EtapeProjet";

const APRES_CONFIGURATION = "/tableau-de-bord";

export function Wizard() {
  const t = useTranslations("configuration.wizard");
  const tEtapes = useTranslations("configuration.etapes");
  const router = useRouter();

  const [progression, setProgression] = useState<Progression | null>(null);
  const [erreur, setErreur] = useState<ErreurApi | null>(null);
  const [etapeAffichee, setEtapeAffichee] = useState<CodeEtape | null>(null);
  const [reprisePropose, setReprisePropose] = useState(false);
  const [abandonOuvert, setAbandonOuvert] = useState(false);
  const [saisieEnCours, setSaisieEnCours] = useState(false);
  const [enCours, setEnCours] = useState(false);
  void saisieEnCours;

  const charger = useCallback(() => {
    lireProgression()
      .then((p) => {
        setErreur(null);
        setProgression(p);
        // Configuration déjà terminée : on affiche le récapitulatif, on ne
        // renvoie *pas* au tableau de bord. L'écran est atteignable depuis le
        // menu Paramètres, et une redirection immédiate y ferait rebondir
        // l'utilisateur sans rien lui montrer.
        setEtapeAffichee(p.terminee_le ? null : p.etape_courante);
        setReprisePropose(p.etapes.some((e) => e.mode !== null) && !p.terminee_le);
      })
      .catch((cause) => setErreur(cause as ErreurApi));
  }, []);

  useEffect(charger, [charger]);

  const franchir = useCallback(
    async (code: CodeEtape, mode: "VALIDEE" | "PASSEE") => {
      setEnCours(true);
      try {
        const suite = mode === "PASSEE" ? await passerEtape(code) : await validerEtape(code);
        setProgression(suite);
        setSaisieEnCours(false);
        setReprisePropose(false);
        setEtapeAffichee(suite.terminee_le ? null : suite.etape_courante);
      } catch (cause) {
        setErreur(cause as ErreurApi);
      } finally {
        setEnCours(false);
      }
    },
    [],
  );

  if (erreur) {
    return (
      <Card className="bg-neutral-50">
        <CardContent className="pt-6">
          <EtatErreur
            message={erreur.message}
            onReessayer={charger}
            reference={erreur.traceId ?? undefined}
          />
        </CardContent>
      </Card>
    );
  }

  if (!progression) {
    return (
      <Card className="bg-neutral-50">
        <CardContent className="pt-6">
          <EtatChargement message={t("chargement")} />
        </CardContent>
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Configuration terminée — écran de confirmation
  // ---------------------------------------------------------------------------
  if (progression.terminee_le || etapeAffichee === null) {
    return <Confirmation progression={progression} />;
  }

  const rangCourant = ETAPES.findIndex((e) => e.code === etapeAffichee);
  const franchies = new Set(
    progression.etapes.filter((e) => e.mode !== null).map((e) => e.code),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Colonne unique centrée : titre, puis la frise des trois étapes à
          l'horizontale, puis le formulaire. L'ancien rail latéral de 280 px
          poussait le formulaire à droite de l'écran ; la frise horizontale
          rend la position dans le parcours lisible d'un coup d'œil sans lui
          voler de largeur. */}
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">
          {t("titre")}
        </h1>
        <p className="text-sm text-neutral-600">{t("accroche")}</p>
        <p className="text-xs font-medium text-muted-foreground">
          {t("position", { rang: rangCourant + 1, total: ETAPES.length })}
        </p>
      </header>

      {/* --- Progression ----------------------------------------------------- */}
      <nav aria-label={t("progressionLibelle")}>
        <ol className="flex items-start justify-center">
          {ETAPES.map((etape, rang) => {
            const franchie = franchies.has(etape.code);
            const active = etape.code === etapeAffichee;
            return (
              <li
                key={etape.code}
                className={cn("flex items-start", rang > 0 && "min-w-8 flex-1 sm:min-w-12")}
              >
                {/* Trait de liaison : plein jusqu'à l'étape courante, sinon
                    filet gris. Aligné sur le centre des pastilles (size-9). */}
                {rang > 0 && (
                  <span
                    className={cn(
                      "mt-[18px] h-px flex-1",
                      franchie || active ? "bg-primary" : "bg-border",
                    )}
                    aria-hidden="true"
                  />
                )}
                {/* Pas de cadre autour de l'étape : la pastille et le libellé
                    suffisent à situer le parcours, un encadré de plus ajoutait
                    un niveau de boîte sans information. */}
                <button
                  type="button"
                  className={cn(
                    "flex w-24 shrink-0 flex-col items-center gap-2 px-1 text-center transition-opacity sm:w-40 sm:px-2",
                    franchie || active ? "hover:opacity-80" : "opacity-60",
                  )}
                  disabled={!franchie && !active}
                  aria-current={active ? "step" : undefined}
                  onClick={() => setEtapeAffichee(etape.code)}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      franchie
                        ? "bg-succes-fond text-succes"
                        : active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {franchie ? <Check size={16} /> : rang + 1}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      active ? "text-primary-700" : "text-foreground",
                    )}
                  >
                    {tEtapes(`${etape.code}.libelle`)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* --- Formulaire ------------------------------------------------------ */}
      <div className="flex flex-col gap-4">
        {reprisePropose && (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-information/20 bg-information-fond px-4 py-3 text-sm text-information"
            role="status"
          >
            <p>
              {t.rich("reprise", {
                etape: tEtapes(`${ETAPES[rangCourant].code}.libelle`).toLowerCase(),
                fort: (morceaux) => <strong>{morceaux}</strong>,
              })}
            </p>
            <Bouton variante="ghost" taille="sm" onClick={() => setReprisePropose(false)}>
              {t("continuer")}
            </Bouton>
          </div>
        )}

        {/* La zone de contenu de la coquille est blanche (`--color-background`
            = `neutral-0`, globals.css) : une carte `bg-card` s'y confondrait.
            Le formulaire prend donc `neutral-50`, ce qui laisse les champs —
            qui sont en `bg-card`, blancs — ressortir sur leur propre fond. */}
        <Card className="bg-neutral-50">
          <CardContent className="pt-6" aria-live="polite">
            {etapeAffichee === "ENTREPRISE" && (
              <EtapeEntreprise
                enCours={enCours}
                onSaisie={setSaisieEnCours}
                onValide={() => franchir("ENTREPRISE", "VALIDEE")}
              />
            )}
            {etapeAffichee === "PROJET" && (
              <EtapeProjet
                enCours={enCours}
                onSaisie={setSaisieEnCours}
                onRetour={() => setEtapeAffichee("ENTREPRISE")}
                onValide={() => franchir("PROJET", "VALIDEE")}
                onPasser={() => franchir("PROJET", "PASSEE")}
              />
            )}
            {etapeAffichee === "EQUIPE" && (
              <EtapeEquipe
                enCours={enCours}
                onSaisie={setSaisieEnCours}
                onRetour={() => setEtapeAffichee("PROJET")}
                onValide={() => franchir("EQUIPE", "VALIDEE")}
                onPasser={() => franchir("EQUIPE", "PASSEE")}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Modale
        ouverte={abandonOuvert}
        titre={t("abandonTitre")}
        onFermer={() => setAbandonOuvert(false)}
        actions={
          <>
            <Bouton variante="secondaire" onClick={() => setAbandonOuvert(false)}>
              {t("abandonContinuer")}
            </Bouton>
            <Bouton onClick={() => router.push(APRES_CONFIGURATION)}>{t("quitter")}</Bouton>
          </>
        }
      >
        <p>{t.rich("abandonCorps", { fort: (morceaux) => <strong>{morceaux}</strong> })}</p>
        <p className="mt-2">{t("abandonReprise")}</p>
      </Modale>
    </div>
  );
}

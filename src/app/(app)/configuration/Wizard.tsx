"use client";

import { Check } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Bouton, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { ErreurApi } from "@/lib/api";
import {
  ETAPES,
  lireProgression,
  passerEtape,
  validerEtape,
} from "@/features/configuration/api";
import type { CodeEtape, Progression } from "@/features/configuration/api";

import { Confirmation } from "./Confirmation";
import { EtapeEntreprise } from "./EtapeEntreprise";
import { EtapeEquipe } from "./EtapeEquipe";
import { EtapeProjet } from "./EtapeProjet";

import styles from "./page.module.css";

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
        if (p.terminee_le) {
          router.push(APRES_CONFIGURATION);
          return;
        }
        setProgression(p);
        setEtapeAffichee(p.etape_courante);
        // Bandeau de reprise — T-022 §7.3. Il n'a de sens que si quelque chose
        // a déjà été franchi : sur une configuration neuve, il n'apprend rien.
        setReprisePropose(p.etapes.some((e) => e.mode !== null) && !p.terminee_le);
      })
      .catch((cause) => setErreur(cause as ErreurApi));
  }, [router]);

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
      <EtatErreur
        message={erreur.message}
        onReessayer={charger}
        reference={erreur.traceId ?? undefined}
      />
    );
  }

  if (!progression) {
    return <EtatChargement message={t("chargement")} />;
  }

  // ---------------------------------------------------------------------------
  // Configuration terminée — écran de confirmation
  // ---------------------------------------------------------------------------
  if (progression.terminee_le || etapeAffichee === null) {
    return <Confirmation progression={progression} />;
  }

  const rangCourant = ETAPES.findIndex((e) => e.code === etapeAffichee);
  const definition = ETAPES[rangCourant];
  const franchies = new Set(
    progression.etapes.filter((e) => e.mode !== null).map((e) => e.code),
  );


  return (
    <div className={styles.wizard}>
      {/* --- Deux colonnes au-delà de 1024 px --------------------------------
          Maquette M9 : sur écran large, les étapes et la progression passent
          en colonne latérale et le formulaire occupe le reste. Sous 1024 px,
          la maquette mobile garde le pas-à-pas horizontal — le même DOM sert
          les deux, seule la grille change. */}
      <div className={styles.colonnes}>
        {/* --- Progression ---------------------------------------------------- */}
        <nav className={styles.progression} aria-label={t("progressionLibelle")}>
          <div className={styles.enteteFlanc}>
            <h1 className={styles.titre}>{t("titre")}</h1>
            <p className={styles.accroche}>{t("accroche")}</p>
            <p className={styles.position}>
              {t("position", { rang: rangCourant + 1, total: ETAPES.length })}
            </p>
          </div>

        <ol className={styles.pastilles}>
          {ETAPES.map((etape, rang) => {
            const franchie = franchies.has(etape.code);
            const active = etape.code === etapeAffichee;
            return (
              <li
                key={etape.code}
                className={[
                  styles.pastille,
                  franchie ? styles.pastilleFranchie : "",
                  active ? styles.pastilleActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className={styles.pastilleBouton}
                  // Revenir sur une étape franchie est permis (T-022 §7.3) ;
                  // sauter en avant ne l'est pas (R-94).
                  disabled={!franchie && !active}
                  aria-current={active ? "step" : undefined}
                  onClick={() => setEtapeAffichee(etape.code)}
                >
                  <span className={styles.pastilleRond} aria-hidden="true">
                    {franchie ? <Check size={14} weight="bold" /> : rang + 1}
                  </span>
                  <span className={styles.pastilleLibelle}>
                    {tEtapes(`${etape.code}.libelle`)}
                  </span>
                  <span className={styles.pastilleSousTitre}>
                    {tEtapes(`${etape.code}.sousTitre`)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className={styles.barreBloc}>
          <div className={styles.barreLigne}>
            <span>{t("progression")}</span>
            <strong>{progression.pourcentage} %</strong>
          </div>
          <div
            className={styles.barre}
            role="progressbar"
            aria-valuenow={progression.pourcentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("progressionLibelle")}
          >
            <span
              className={styles.barreRemplissage}
              style={{ width: `${progression.pourcentage}%` }}
            />
          </div>
        </div>
        </nav>

        {/* --- Colonne de contenu -------------------------------------------- */}
        <div className={styles.pileContenu}>
      {/* --- Reprise ---------------------------------------------------------- */}
      {reprisePropose && (
        <div className={styles.reprise} role="status">
          <p>
            {t.rich("reprise", {
              etape: tEtapes(`${definition.code}.libelle`).toLowerCase(),
              fort: (morceaux) => <strong>{morceaux}</strong>,
            })}
          </p>
          <Bouton variante="ghost" taille="sm" onClick={() => setReprisePropose(false)}>
            {t("continuer")}
          </Bouton>
        </div>
      )}

      {/* --- Étape courante --------------------------------------------------- */}
      <section className={styles.corps} aria-live="polite">
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
      </section>
        </div>
      </div>

      {/* --- Abandon ---------------------------------------------------------- */}
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
        <p>{t("abandonReprise")}</p>
      </Modale>
    </div>
  );
}

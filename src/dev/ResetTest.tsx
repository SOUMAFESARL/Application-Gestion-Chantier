/* eslint-disable i18next/no-literal-string, no-restricted-syntax --
 * Outil de développement, jamais livré : ses libellés ne doivent pas entrer
 * dans `messages/fr.json`, où ils se retrouveraient à traduire. L'exception est
 * de la même nature que celle que `eslint.config.mjs` accorde déjà à
 * `src/app/design-system/**`.
 */
"use client";

import { useState } from "react";

import { basePlateforme } from "@/lib/api";

import { useOutilsTest } from "./garde";

/**
 * « Repartir de zéro » — OUTIL DE DÉVELOPPEMENT. Ne doit jamais être livré.
 *
 * **Le problème qu'il résout.** Rejouer le parcours d'inscription sur la même
 * adresse email. Le second essai échoue aujourd'hui non pas à cause de la base
 * — le serveur n'a pas encore de table d'inscription, DEV-8 n'est pas écrit —
 * mais à cause de l'état laissé dans le navigateur par l'essai précédent :
 *
 *   · `ccd.simulation.onboarding`    la demande, son jeton, son statut ;
 *   · `ccd.simulation.configuration` le wizard. Une fois `terminee_le` posé,
 *     `franchir()` refuse toute étape en `409 configuration_terminee` ;
 *   · `ccd.jeton_renouvellement`     la session ouverte par l'essai précédent.
 *
 * Le jeton **d'accès** vit en mémoire (`lib/api/jetons.ts`) : le rechargement
 * qui suit l'effacement s'en charge.
 *
 * **Il vide aussi la base**, depuis que l'inscription y écrit vraiment. Il
 * appelle `POST /api/v1/dev/reinitialiser/` sur le domaine plateforme — une
 * route qui n'existe que sur un poste de développement, protégée par trois
 * verrous : le fichier `config/urls_dev.py` n'est pas versionné, `urls_public`
 * ne le monte que sous `DEBUG`, et la vue exige `OUTILS_TEST=1`.
 *
 * `public` et `demo` sont préservés : supprimer le premier ferait répondre 404
 * à toute requête, **y compris à la page qui porte ce bouton**.
 *
 * Si la route est absente — serveur lancé sans la variable, dépôt cloné — le
 * bouton se contente du navigateur et le dit, plutôt que d'échouer.
 *
 * **Pourquoi il ne ressemble pas au produit.** Le guide frontend §3 interdit
 * les valeurs en dur : les couleurs viennent des jetons, parce qu'une entreprise
 * cliente choisit sa teinte primaire. Cet encadré s'en écarte **volontairement**.
 * Il ne doit ressembler à aucun écran livrable — un bouton qui efface un test et
 * qui a l'air d'un bouton du produit est un bouton sur lequel on clique par
 * réflexe. C'est l'esprit du §8 : rien de simulé ne doit pouvoir passer pour réel.
 *
 * **Double garde.** Voir `garde.ts` : la variable `NEXT_PUBLIC_OUTILS_TEST` et
 * un nom d'hôte local, deux verrous indépendants qu'un déploiement accidentel
 * n'ouvre ni l'un ni l'autre.
 */

/** Préfixe commun à tout ce que l'application écrit dans le navigateur. */
const PREFIXE = "ccd.";

/** Collecte d'abord, supprime ensuite : retirer pendant l'itération décale les index. */
function vider(stockage: Storage): string[] {
  const cles: string[] = [];
  try {
    for (let i = 0; i < stockage.length; i += 1) {
      const cle = stockage.key(i);
      if (cle?.startsWith(PREFIXE)) cles.push(cle);
    }
    cles.forEach((cle) => stockage.removeItem(cle));
  } catch {
    // Navigation privée, stockage bloqué : il n'y avait rien à effacer.
  }
  return cles;
}

interface Efface {
  cles: string[];
  base: string;
}

export function ResetTest() {
  const [efface, setEfface] = useState<Efface | null>(null);
  const [enCours, setEnCours] = useState(false);
  const actif = useOutilsTest();

  if (!actif) return null;

  async function reinitialiser() {
    setEnCours(true);
    const cles = [...vider(window.sessionStorage), ...vider(window.localStorage)];

    let base: string;
    try {
      const reponse = await fetch(`${basePlateforme()}/api/v1/dev/reinitialiser/`, {
        method: "POST",
      });
      if (reponse.ok) {
        const donnees = (await reponse.json()) as {
          efface: { entreprises: number; demandes: number };
        };
        base = `${donnees.efface.entreprises} entreprise(s) et ${donnees.efface.demandes} demande(s)`;
      } else {
        base = `serveur : ${reponse.status} — route de test indisponible`;
      }
    } catch {
      base = "serveur injoignable — seul le navigateur a été vidé";
    }

    setEfface({ cles, base });
    // Le jeton d'accès est une variable de module : seul un rechargement le perd.
    window.setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <div
      style={{
        marginTop: "1.5rem",
        padding: "0.75rem 1rem",
        border: "1px dashed #b45309",
        borderRadius: "8px",
        background: "#fffbeb",
        color: "#78350f",
        fontSize: "0.8125rem",
        lineHeight: 1.5,
      }}
      role="group"
      aria-label="Outil de développement"
    >
      <strong style={{ display: "block", marginBottom: "0.5rem" }}>
        Outil de test — non livré
      </strong>
      <button
        type="button"
        disabled={enCours}
        onClick={() => void reinitialiser()}
        style={{
          minHeight: "40px",
          padding: "0 1rem",
          border: "1px solid #b45309",
          borderRadius: "6px",
          background: "#fff",
          color: "#78350f",
          font: "inherit",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Repartir de zéro (vider l’état du test)
      </button>
      {efface !== null && (
        <p style={{ margin: "0.5rem 0 0" }} role="status">
          Navigateur : {efface.cles.length} clé(s) effacée(s).
          <br />
          Base : {efface.base}. Rechargement…
        </p>
      )}
    </div>
  );
}

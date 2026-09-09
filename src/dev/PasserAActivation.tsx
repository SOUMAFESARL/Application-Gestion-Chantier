/* eslint-disable i18next/no-literal-string, no-restricted-syntax --
 * Outil de développement, jamais livré : ses libellés ne doivent pas entrer
 * dans `messages/fr.json`, où ils se retrouveraient à traduire. Même exception
 * que celle accordée à `src/app/design-system/**` dans `eslint.config.mjs`.
 */
"use client";


import { useOutilsTest } from "./garde";

/**
 * « Passer à l'activation » — OUTIL DE DÉVELOPPEMENT. Ne doit jamais être livré.
 *
 * **Le problème qu'il résout.** Après l'inscription, le parcours attend que
 * l'utilisateur clique le lien reçu par email. Aucun email n'arrive : le MVP
 * n'a **pas de SMTP configuré** — `config/settings/production.py` déclare
 * `EMAIL_HOST` et le laisse vide, et le choix du fournisseur est reporté au
 * Sprint 2. Le parcours s'arrête donc à l'écran « Vérifiez votre email », et
 * les trois écrans suivants — activation, provisionnement, espace prêt — ne
 * sont atteignables par personne.
 *
 * **Il redirige tout seul, après le décompte de renvoi.** Ce décompte est la
 * fenêtre pendant laquelle l'écran de vérification reste lisible : c'est lui qui
 * rend la bascule automatique acceptable. La règle produit le fixe à **60 s** ;
 * `FormulaireInscription` porte une valeur de test locale plus courte, qui n'a
 * pas vocation à être committée. Un délai de grâce d'une
 * seconde affiche ensuite ce qui va se passer, pour qu'un écran qui change
 * seul ne ressemble pas à un défaut.
 *
 * **Le lien manuel reste affiché.** Il sert quand la redirection ne part pas —
 * onglet en arrière-plan dont les minuteries sont ralenties, par exemple — et
 * il évite d'avoir à recommencer l'inscription pour retomber sur le raccourci.
 *
 * **Il lit le jeton, il ne le fabrique pas.** Reconstruire `sim-<id>` aurait
 * dupliqué un format appartenant à `lib/api/simulation.ts` ; le jeton réel est
 * dans l'état de la simulation, et c'est celui-là qu'on suit. Une duplication
 * de moins à corriger le jour où ce format change.
 *
 * **Ce qu'il devient quand le serveur existera.** Le jeton sera engendré côté
 * serveur et **ne reviendra jamais au client** (R-81) : ce raccourci ne pourra
 * plus le lire, et il ne redirigera donc plus. Il n'en aura pas besoin — en
 * local, `EMAIL_BACKEND` est déjà la console, et le lien s'affiche en clair
 * dans le terminal Django. C'est ce que le bloc indique alors.
 */

const ENCADRE: React.CSSProperties = {
  marginTop: "1rem",
  padding: "0.75rem 1rem",
  border: "1px dashed #b45309",
  borderRadius: "8px",
  background: "#fffbeb",
  color: "#78350f",
  fontSize: "0.8125rem",
  lineHeight: 1.5,
  textAlign: "left",
};

interface Props {
  /** `true` quand le décompte de renvoi est écoulé. */
  pret: boolean;
}

export function PasserAActivation({ pret }: Props) {
  const actif = useOutilsTest();
  // Plus de redirection : le jeton est engendré côté serveur et ne revient
  // jamais au navigateur (R-81). Le bloc dit simplement où le lire.
  if (!actif || !pret) return null;

  return (
    <div style={ENCADRE} role="group" aria-label="Outil de développement">
      <strong style={{ display: "block", marginBottom: "0.35rem" }}>
        Outil de test — non livré
      </strong>
      <p style={{ margin: 0 }}>
        Aucun email ne part : le SMTP n’est pas configuré (Sprint 2). Le lien
        d’activation est dans <strong>Mailpit</strong> —{" "}
        <code>http://localhost:8025</code> — ou dans le terminal Django si
        l’attrape-mail n’est pas lancé.
      </p>
    </div>
  );
}

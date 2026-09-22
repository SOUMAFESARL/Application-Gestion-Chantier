/* eslint-disable i18next/no-literal-string, no-restricted-syntax --
 * Outil de développement, jamais livré : ses libellés ne doivent pas entrer
 * dans `messages/fr.json`, où ils se retrouveraient à traduire. Même exception
 * que celle accordée à `src/app/design-system/**` dans `eslint.config.mjs`.
 */
"use client";

import { useOutilsTest } from "./garde";

/**
 * « Passer à la définition du mot de passe » — OUTIL DE DÉVELOPPEMENT.
 *
 * **Le même trou que pour l'inscription.** L'écran 2 de M6 attend que
 * l'utilisateur clique le lien reçu par email ; aucun email ne part tant que
 * le SMTP n'est pas configuré (Sprint 2). Sans ce bloc, rien à l'écran ne dit
 * où le lien a atterri.
 *
 * **Il n'apparaît qu'après le décompte de renvoi**, pour la même raison qu'à
 * l'inscription : le verrou de 60 s est lui-même une règle à vérifier, et un
 * raccourci affiché d'emblée le rendrait invisible.
 *
 * **Contrairement à celui de l'inscription, il ne redirige pas tout seul.**
 * L'écran 2 porte la phrase que le contrat §3.2 rend obligatoire — « nous ne
 * confirmons pas si un compte existe ou non » —, et c'est justement l'écran
 * qu'il faut pouvoir lire.
 *
 * **Les endpoints existent désormais**, et le jeton est engendré côté serveur :
 * il ne revient jamais au navigateur. Le raccourci ne peut donc plus fabriquer
 * de lien — il dit où le trouver, ce qui est tout ce qui manquait. Sa version
 * précédente lisait l'état de la simulation, qui a disparu avec elle.
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

export function PasserADefinition({ pret }: Props) {
  const actif = useOutilsTest();

  if (!actif || !pret) return null;

  return (
    <div style={ENCADRE} role="group" aria-label="Outil de développement">
      <strong style={{ display: "block", marginBottom: "0.35rem" }}>
        Outil de test — non livré
      </strong>
      <p style={{ margin: 0 }}>
        Aucun email ne part : le SMTP n’est pas configuré (Sprint 2). Le lien
        d’activation s’affiche en clair dans le terminal Django —{" "}
        <code>EMAIL_BACKEND</code> est la console en local. Le coller ici :
        <br />
        <code>/mot-de-passe/definir#jeton=…</code>
      </p>
    </div>
  );
}

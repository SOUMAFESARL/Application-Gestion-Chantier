# Lot 3 — Paramétrage et accès de l'entreprise : prompts pour l'agent d'implémentation (frontend)

Rédigé le 14/10/2026 par l'agent de cadrage (Claude), après validation du développeur. **Toutes
les décisions sont prises** : en cas de doute, s'arrêter et demander, ne jamais inventer une règle.

**Lire d'abord** `../API-Gestion-Chantier/.agents/prompts/lot3/README.md` : l'ordre d'exécution
(backend et frontend entrelacés), le prérequis (lot 2 entièrement fusionné) et le tableau des
décisions y sont. Ce dossier ne les recopie pas.

## 1. Les tâches de ce dossier

| Tâche | Après (backend) | Contenu |
|---|---|---|
| `F1_collaborateurs_reels.md` | B1 | Collaborateurs sans simulation ; messages du serveur affichés |
| `F2_renvoi_invitation.md` | B2 | Bouton « Renvoyer l'invitation » |
| `F3_roles_reels.md` | B1 | Rôles sans simulation ; suppression du composant mort des droits par projet |
| `F4_telephones_entreprise.md` | B3 | Plusieurs numéros, format international tous pays ; fiche du back-office |
| `F5_logo_telephone.md` | — | Logo de l'entreprise visible sur téléphone |
| `F6_mot_de_passe_profil.md` | — | Changer son mot de passe depuis le profil |
| `F7_controle_inscription.md` | — | Contrôle du contrat et de la chaîne d'inscription |
| `F8_cloture.md` | — | Identité de la plateforme réelle ; plan d'alignement à jour |

## 2. Règles communes

**Identiques au lot 2** : relire `../lot2/README.md` §2 (lectures obligatoires — `CLAUDE.md`,
skills `sprint-task-lifecycle`, `brancher-api`, `revue-frontend`, `features/projets/adaptateur.ts`
comme référence —, Git, `npm run lint` et `npm run typecheck` à zéro erreur, vérification à
l'écran contre le backend local à 1440 et 390 px, conventions). En résumé :

- branche `feature/lot3-<nom>` ; `git add <fichiers>` seulement ; fusion `--no-ff` ;
  **jamais `git push`** (pousser `develop` déploie le frontend en production) ;
- aucune chaîne française en dur ; règle métier dans `regles.ts` ; `fetch` seulement dans
  l'adaptateur du domaine ; Tailwind et jetons seulement ;
- **aucune exemption ESLint ajoutée**. Ce lot en **retire** deux (`simulationCollaborateurs.ts`,
  `simulationRoles.ts`) : c'est la seule modification permise de `eslint.config.mjs` ;
- les messages d'erreur du serveur sont des phrases destinées à l'utilisateur :
  `cause instanceof ErreurApi && cause.message ? cause.message : t("…erreur")`.

**Espace de ce lot : l'espace entreprise** (`app/(entreprise)/…`, client `api` de `@/lib/api`),
sauf la fiche client du back-office en F4 (`apiAdministration`). Compte de vérification : le DG
et un administrateur (AD) du schéma `demo` en local — demander les identifiants au développeur,
ne jamais les écrire dans un fichier.

## 3. Fin du lot

Compte rendu par tâche (livré, vu à l'écran ou non, à quelles largeurs), puis **s'arrêter**.

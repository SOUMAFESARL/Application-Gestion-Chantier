# F8 — Clôture du lot 3 : identité de la plateforme réelle, plan à jour (3.9, 3.10)

Branche : `feature/lot3-cloture`
Prérequis : **toutes** les tâches B1–B3 et F1–F7 fusionnées.

## 1. L'identité de la plateforme toujours réelle (3.9)

`features/plateforme/adaptateur.ts`, `lireIdentite` (l. 62-71) lit encore
`simulationParametresPublics.lireIdentite()` sous `SIMULATION_ACTIVE`. `GET /plateforme/identite/`
est servi et public (sans jeton) : garder **seulement** l'appel réel.

Dans `lib/api/simulationParametresPublics.ts` (créé au lot 2) :

- supprimer `lireIdentite` (l. ~150) et la partie `identite` de `ParametresPlateforme` (l. 39) et de
  `parametresInitiaux` (l. 103), ainsi que le type `ChargeIdentitePlateforme` s'il n'a plus
  d'usage ;
- **garder les tarifs** (`lireTarifs`, `tarifsCourants`) : ils servent à la simulation de
  l'abonnement, qui relève du lot 6 ;
- mettre à jour l'en-tête du fichier (l. 1-10) : il ne parle plus que des tarifs ;
- attention à la **clé de stockage local** : si `lireParametres` relit un objet enregistré qui porte
  encore `identite`, ce champ en trop ne doit rien casser (le type le tolère, ou il est ignoré).

`grep -rn "lireIdentite\|identite" lib/api/simulationParametresPublics.ts features/plateforme`
→ plus de branche simulée pour l'identité.

L'exemption ESLint de `lib/api/simulationParametresPublics.ts` (`eslint.config.mjs:321`) reste :
le fichier existe toujours. Ne pas y toucher.

## 2. Le plan d'alignement (3.10)

`docs/plan_alignement_api.md` (ignoré par Git : `git add -f`), section « Lot 3 » (l. ~151) :

1. Sous la liste existante, un paragraphe **« Cadrage et décisions du 14/10/2026 »** qui reprend
   le tableau de décisions de `../API-Gestion-Chantier/.agents/prompts/lot3/README.md` §3, en
   précisant :
   - « La suite de l'inscription n'était pas « jamais appelée » : elle est branchée ; contrôlée
     en F7. »
   - « **Non branchés, par décision** : l'assistant de configuration (retiré du produit ; ses routes
     `configuration/etapes/…` restent servies, sans consommateur), `/entreprise/` (doublon de
     `/parametres/configuration/`), la liste et le détail des invitations (la liste des
     collaborateurs inclut les invités). »
   - « `permissions-roles` par projet : **reporté**, MLD v1.7 §5.2.5. »
2. Un tableau des tâches du lot sur le modèle du lot 2 (§ « Lot 2 », tableau Tâche / Contenu /
   État), une ligne par tâche B1–B3, F1–F8, avec « **Fait le <date>.** » et ce qui a été vérifié
   à l'écran (reprendre les comptes rendus).
3. Une dernière ligne : « Lot 3 fusionné dans `develop` des deux dépôts le <date>, **non poussé** :
   relecture et push par le développeur. »

Mettre aussi à jour, s'ils mentionnent les simulations retirées dans ce lot :
`lib/api/README.md`, `features/invitations/README.md`, `features/roles/README.md`
(`grep -rln "simulationCollaborateurs\|simulationRoles" --include=*.md .`).

## 3. Vérifications finales

1. `npm run lint`, `npm run typecheck`, `npm run build` : verts (le build est ce que la CI de
   déploiement exécute ; s'il échoue faute de mémoire, le dire, ne pas contourner).
2. `grep -rn "SIMULATION_ACTIVE" features/invitations features/roles features/configuration features/plateforme`
   → seulement la branche des **tarifs** dans `features/plateforme/adaptateur.ts`.
3. Parcours rapide en local, compte DG de `demo` : connexion, en-tête (logo, à 1440 et 390 px),
   Paramètres > Configuration (numéros), Collaborateurs (suspendre / réactiver / renvoyer une
   invitation), Rôles, Profil (sans changer le mot de passe cette fois), déconnexion. Aucune erreur
   dans la console du navigateur.
4. Page de connexion et barre latérale : le nom et le logo de la plateforme viennent du serveur
   (onglet Réseau : `GET /plateforme/identite/`), même avec `NEXT_PUBLIC_API_SIMULE` actif.

## 4. Définition de terminé

- [ ] Identité de la plateforme toujours réelle ; tarifs simulés intacts.
- [ ] Plan d'alignement à jour (`git add -f docs/plan_alignement_api.md`) ; README à jour.
- [ ] `lint`, `typecheck`, `build` verts ; vérifications §3 faites.
- [ ] Commit : `refactor(plateforme): l'identite de la plateforme n'est plus simulee, plan du lot 3 a jour`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
- [ ] Compte rendu final du lot (README du backend, §4), puis **s'arrêter**.

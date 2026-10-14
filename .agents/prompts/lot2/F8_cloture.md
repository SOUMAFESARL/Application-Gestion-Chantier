# F8 — Clôture du lot 2 : retrait de la simulation du back-office (tâche 2.8)

Branche : `feature/lot2-cloture`
Prérequis : **toutes** les tâches B1–B5 et F1–F7 fusionnées.

## 1. Contexte

`lib/api/simulationAdministration.ts` (1 046 lignes) imite le back-office quand
`NEXT_PUBLIC_API_SIMULE` est actif. En production le back-office appelle déjà le vrai serveur ;
après F1–F7, **chaque écran du back-office a sa route réelle**. La simulation n'est plus qu'un
second comportement à maintenir, qui diverge en silence.

Elle a **une partie qui doit survivre** : `simulationParametresPublics` (l. 711-733), qui sert
l'**espace entreprise** (page de tarifs, identité de la plateforme, souscription simulée) —
consommée par `features/plateforme/adaptateur.ts` (l. 16, 41, 63) et
`features/abonnement/simulation.ts` (l. 11, 104). Ces deux domaines relèvent du **lot 6**
(abonnement) : on ne les touche pas, on déplace seulement ce dont ils dépendent.

## 2. Ce qu'il faut faire

### 2.1 Extraire les paramètres publics

1. Créer `lib/api/simulationParametresPublics.ts` et y **déplacer** depuis
   `simulationAdministration.ts` :
   - `simulationParametresPublics` ;
   - tout ce dont il dépend et **rien d'autre** : `lireParametres` (l. 656) et ce qu'il appelle
     (valeurs par défaut des tarifs et de l'identité, clé de stockage local, type
     `ParametresPlateforme`), les types `ChargeTarifPlan` et `ChargeIdentitePlateforme` (ou leur
     import s'ils viennent d'ailleurs), l'import de `attendre` depuis `./simulation`.
   Suivre les dépendances avec l'éditeur (« aller à la définition ») jusqu'à ce que le nouveau
   fichier compile seul.
2. Commentaire d'en-tête du nouveau fichier :
   ```ts
   /**
    * Les paramètres publics de la plateforme (tarifs, identité), rejoués sans serveur pour
    * l'**espace entreprise** en mode démonstration — `GET /plateforme/tarifs/` et
    * `GET /plateforme/identite/`.
    *
    * Extraits de l'ancienne simulation du back-office, supprimée au lot 2 : le back-office
    * appelle toujours le serveur. Ce fichier disparaîtra avec la simulation de l'abonnement
    * (lot 6).
    */
   ```
3. Remplacer les imports dans `features/plateforme/adaptateur.ts:16` et
   `features/abonnement/simulation.ts:11` par `@/lib/api/simulationParametresPublics`.

### 2.2 Le back-office toujours réel

Dans `features/administration/adaptateur.ts` :

1. Supprimer l'import de `simulationAdministration` / `simulationParametresPublics` (l. 36-39) et
   celui de `SIMULATION_ACTIVE` (l. 35).
2. Pour **chaque** fonction qui contient `SIMULATION_ACTIVE ? await simulationAdministration.x(...) : await apiAdministration.y(...)`
   (44 occurrences au 14/10 — `grep -n "SIMULATION_ACTIVE\|simulationAdministration" features/administration/adaptateur.ts`),
   garder **uniquement** la branche réelle. Pour les blocs `if (SIMULATION_ACTIVE) { … }`, supprimer
   le bloc.
3. Cas particuliers :
   - `lireIndicateurs` (l. ~828) : la branche simulée calculait depuis la liste ; ne garder que
     l'appel serveur. Si la fonction `indicateurs` de `regles.ts` n'a plus d'appelant, **la
     laisser** (elle peut servir ailleurs) mais le signaler dans le compte rendu.
   - `obtenirProfil` (réécrite en F1) : retirer sa branche simulée.
4. Réécrire le commentaire d'en-tête du fichier (l. 1-24) : supprimer le paragraphe « **La
   session et la lecture des clients sont réelles** … **Le reste du domaine est encore simulé** »
   et le remplacer par : « **Tout le domaine est réel** depuis le lot 2 (14/10/2026) : chaque
   fonction appelle `/api/v1/admins/…`, quel que soit `NEXT_PUBLIC_API_SIMULE`. »
5. Supprimer les fonctions **devenues sans appelant** dans `adaptateur.ts`
   (`grep -rn "<nom>" app features` pour chacune). Ne supprimer **aucune** fonction encore
   appelée.

### 2.3 Supprimer la simulation

1. `git rm lib/api/simulationAdministration.ts`.
2. `grep -rn "simulationAdministration" app features lib components` → **zéro** résultat.
3. `eslint.config.mjs` (l. ~319-321) : **remplacer** la ligne
   `"lib/api/simulationAdministration.ts",` et son commentaire (« Meme role pour le back-office…
   aucun endpoint n'existe encore ») par :
   ```js
      // Les paramètres publics rejoués pour l'espace entreprise (tarifs,
      // identité), en attendant la fin de la simulation de l'abonnement (lot 6).
      "lib/api/simulationParametresPublics.ts",
   ```
   C'est la **seule** modification permise de ce fichier : une exemption remplacée par une autre,
   plus étroite. Si `npm run lint` passe **sans** cette nouvelle exemption (le fichier ne contient
   peut-être aucune chaîne française), ne pas l'ajouter du tout : retirer simplement l'ancienne.

### 2.4 Documentation

1. `docs/plan_alignement_api.md` (fichier ignoré par Git : il se commite avec `git add -f`) —
   section « Lot 2 », tableau (l. ~137-146) : pour chaque tâche 2.2 à 2.8, remplacer « À faire »
   par « **Fait le <date>.** » suivi d'une phrase sur ce qui est livré et ce qui a été vérifié à
   l'écran (reprendre les comptes rendus des tâches). Ajouter une ligne **2.0 Droits
   superviseur / support** (B1 + F1). Sous le tableau, une ligne : « Lot 2 fusionné dans
   `develop` des deux dépôts le <date>, **non poussé** : push et vérification finale par le
   développeur. »
2. `lib/api/README.md` : s'il mentionne `simulationAdministration`, mettre à jour (le grep du
   §2.3 l'aura dit).
3. Dans `../API-Gestion-Chantier/` : rien (le backend n'a pas de simulation).

## 3. Vérifications

1. `npm run lint` et `npm run typecheck` : zéro erreur.
2. `npm run build` : doit passer (c'est ce que la CI de déploiement exécute ; s'il échoue faute
   de mémoire, le dire, ne pas contourner).
3. À l'écran, **avec `NEXT_PUBLIC_API_SIMULE` actif** (variable d'environnement locale ; demander
   au développeur comment il l'active) : le back-office appelle quand même le serveur (onglet
   Réseau) ; la page de tarifs de l'**espace entreprise** s'affiche toujours (paramètres publics
   simulés).
4. Sans le drapeau : parcours complet rapide — connexion admin, tableau de bord, liste et fiche
   client, échéance, modules, journal, messagerie, permissions, comptes, tarifs, identité,
   déconnexion. Aucune erreur dans la console du navigateur.

## 4. Définition de terminé

- [ ] `simulationAdministration.ts` supprimé ; `simulationParametresPublics.ts` extrait ;
      adaptateur du back-office sans aucune branche simulée.
- [ ] Exemption ESLint remplacée (ou retirée) ; aucune autre modification de `eslint.config.mjs`.
- [ ] Plan d'alignement à jour (`git add -f docs/plan_alignement_api.md`).
- [ ] `lint`, `typecheck`, `build` verts ; vérifications §3 faites.
- [ ] Commit : `refactor(administration): le back-office n'a plus de simulation`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
- [ ] Compte rendu final du lot (README §3), puis **s'arrêter**.

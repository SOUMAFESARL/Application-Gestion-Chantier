# F8 — Plan d'alignement à jour et compte rendu

Branche : `feature/droits-cloture`
Prérequis : B2 et F1 à F7 fusionnés.

## 1. `docs/plan_alignement_api.md`

1. **Corriger la ligne « F3 Rôles réels » du lot 3** (vers la l. 165) : elle dit « lecture et
   écriture des rôles sur le serveur » vérifiées. C'était faux — toute écriture partait avec les
   douze modules en dur et revenait en 400 « Module inconnu : 'finance' ». Remplacer son état par :
   « **Lecture faite le 15/10/2026 ; écriture cassée** (douze modules en dur, refusés par le
   serveur) **jusqu'au chantier « droits »** (16/10/2026, F4). » Ne pas réécrire le reste de
   l'historique.
2. **Ajouter une section** `### Chantier « droits » — rôles, modules, permissions (16/10/2026)`
   entre le lot 4 et le lot 5, sur le modèle des sections des lots 3 et 4 :
   - un paragraphe de cadrage (repris du §1 du README backend de ce chantier, en cinq lignes) ;
   - le tableau des décisions R0 à R11 et D1 à D5, **une ligne chacune**, avec renvoi au README ;
   - un tableau des tâches B1, garde `bf3ae8d`, B2, F1 à F7 : objet, état (« Fait le … »), et ce qui
     a été **vu à l'écran**, à quelles largeurs. B1 et la garde sont de Claude ; les autres, de
     l'agent d'implémentation : le dire ;
   - une liste « **Reste ouvert** » :
     - l'abonnement et la configuration de l'entreprise restent au DG (D4) : à rouvrir si l'AD doit
       y accéder (`administration.abonnement_voir`, `administration.factures_voir`) ;
     - les modèles de rôles (`ModeleRole`) n'ont pas d'API (R10) ;
     - l'option `supprimer_collaborateurs` de la suppression d'un rôle n'est pas exposée (R6) ;
     - les vingt fichiers du relevé de F3 : ceux où il n'y avait rien à masquer, cités ;
     - tout écart trouvé pendant le chantier et non traité, avec son fichier.

## 2. Le compte rendu (dans le chat, pas dans un fichier)

Pour **chaque** tâche (B2, F1 à F8) :

| Tâche | Livré | Vu à l'écran (comptes, largeurs) | Écarts au prompt, et pourquoi | Commit de fusion |
|---|---|---|---|---|

Puis :

- le résultat des **177 tests d'acceptation** backend lot1 à lot4, après B2 (la ligne `N passed`) ;
- le résultat de `pytest apps/platform_admin/tests apps/accounts/tests/test_droits_b1.py -q` ;
- la sortie finale de `npm run lint` et `npm run typecheck` sur `develop` ;
- `git log --oneline develop -15` des deux dépôts ;
- la liste des branches locales des deux dépôts (`git branch`) : seules `develop` et `main` doivent
  rester.

## 3. Définition de terminé

- [ ] Plan d'alignement corrigé (lot 3, F3) et complété (section du chantier).
- [ ] Commit : `docs(droits): plan d'alignement a jour, chantier droits`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
- [ ] Compte rendu donné ; **s'arrêter**. Le développeur fera relire le travail avant tout push.

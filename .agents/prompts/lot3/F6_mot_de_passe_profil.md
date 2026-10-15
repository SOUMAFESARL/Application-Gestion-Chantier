# F6 — Changer son mot de passe depuis le profil (3.7)

Branche : `feature/lot3-mot-de-passe-profil`
Prérequis : F1 à F5 fusionnées. Pas de backend : la route est servie.

## 1. Le contrat servi

```
POST /api/v1/auth/profil/mot-de-passe/
{ "ancien_mot_de_passe": "…", "nouveau_mot_de_passe": "…", "origine": "WEB" }
→ 200 { "message": "Votre mot de passe a été modifié avec succès.", "access": "…", "refresh": "…", "expire_dans": 1800 }
```

(`apps/accounts/views/profil.py:88`, service `apps/accounts/services/profil.py:~270-315`.)

**Le piège central** : le serveur **révoque tous les jetons existants** de l'utilisateur
(`revoquer_utilisateur`, l. ~295) puis en émet de nouveaux. Si l'écran n'enregistre pas
immédiatement `access` et `refresh` de la réponse, la requête suivante part avec un jeton révoqué
→ 401 → la personne est déconnectée juste après avoir réussi. Les autres sessions (autres
navigateurs, mobile) sont déconnectées, et c'est voulu.

Erreurs (400, au format du produit) :

| `erreur.code` | Message | Où l'afficher |
|---|---|---|
| `ancien_mot_de_passe_incorrect` | « L'ancien mot de passe est incorrect. » | sous le champ « Mot de passe actuel » |
| `mot_de_passe_identique` | « Le nouveau mot de passe doit être différent de l'ancien. » | sous « Nouveau mot de passe » |
| `validation` avec `details.nouveau_mot_de_passe` (règles Django) | le message du détail | sous « Nouveau mot de passe » |

## 2. Le modèle à suivre

Le back-office a déjà ce bloc : `app/(admin)/admin/profil/EcranProfil.tsx`, `BlocMotDePasse`
(l. ~370-450) — trois champs, `useReglesMotDePasse(nouveau, confirmation)`
(`features/auth/reglesMotDePasse.ts`), bouton grisé tant que les règles ne sont pas satisfaites,
champs vidés après succès. **Le recopier dans sa structure et sa présentation**, en l'adaptant à
l'espace entreprise. Si les deux blocs deviennent identiques à l'espace de noms près, les
factoriser dans `components/metier/BlocChangementMotDePasse.tsx` (une prop pour la fonction
d'envoi, une pour l'espace de noms) ; sinon, garder deux blocs.

## 3. Couche par couche

### 3.1 `features/auth/api.ts`

```ts
/**
 * Change le mot de passe de l'utilisateur connecté — `POST /auth/profil/mot-de-passe/`.
 *
 * **Les jetons sont réécrits avant tout le reste** : le serveur révoque tous ceux de
 * l'utilisateur et en renvoie de neufs. Les garder, c'est rester connecté sur ce poste ; les
 * autres sessions, elles, sont fermées — c'est le but.
 */
export async function changerMotDePasseMoi(demande: { actuel: string; nouveau: string }): Promise<void> {
  const reponse = await api.creer<{ access: string; refresh: string }>("/auth/profil/mot-de-passe/", {
    ancien_mot_de_passe: demande.actuel,
    nouveau_mot_de_passe: demande.nouveau,
    origine: "WEB",
  });
  ecrireJetonAcces(reponse.access);
  ecrireJetonRenouvellement(reponse.refresh);
}
```

(Mêmes imports que `seConnecter`, l. 204-210.) Si `profil.doit_changer_mot_de_passe` est gardé
dans le profil local (`ecrireProfilLocal`), le remettre à `false` après succès.

### 3.2 `app/(entreprise)/profil/EcranProfil.tsx`

- Nouveau bloc `BlocMotDePasse`, rendu **après** `BlocCompte` (l. 107).
- Champ « Mot de passe actuel » avec bouton afficher / masquer (comme le modèle), « Nouveau mot de
  passe », « Confirmation » ; la liste des règles sous le nouveau mot de passe, comme le modèle.
- Erreurs serveur posées sur les champs selon le tableau §1 (`cause.code`, `cause.erreursParChamp`).
- Succès : toast `profil.motDePasse.succes` (« Votre mot de passe a été modifié. Vos autres sessions
  ont été fermées. ») ; champs vidés.
- `autoComplete` : `current-password` pour l'actuel, `new-password` pour les deux autres.

### 3.3 `messages/fr.json`

Sous l'espace de noms de l'écran Profil de l'entreprise (le trouver en tête du composant), un bloc
`motDePasse` : `titre` (« Mot de passe »), `aide` (« Changer de mot de passe ferme vos autres
sessions. »), `actuel`, `nouveau`, `confirmation`, `afficher`, `masquer`, `enregistrer`
(« Changer le mot de passe »), `enCours`, `succes`, `erreur` (« Le mot de passe n’a pas pu être
changé. Réessayez. »). Reprendre les libellés du bloc du back-office quand ils existent.

## 4. Vérification à l'écran

1. Profil → changer le mot de passe (compte de test local) : succès, **on reste connecté** ;
   naviguer sur trois écrans sans être renvoyé à la connexion.
2. Se déconnecter, se reconnecter avec le **nouveau** mot de passe : OK ; avec l'ancien : refusé.
3. Ancien mot de passe faux → message sous le champ.
4. Nouveau = ancien → message sous le nouveau.
5. Une seconde session ouverte dans un autre navigateur avant le changement est déconnectée à sa
   prochaine action.
6. **Remettre le mot de passe d'origine** du compte de test à la fin.
7. 390 px.

## 5. Définition de terminé

- [ ] `changerMotDePasseMoi` réécrit les jetons ; bloc dans le profil ; erreurs sous les champs.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 7 vérifications faites.
- [ ] Commit : `feat(auth): changer son mot de passe depuis le profil`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.

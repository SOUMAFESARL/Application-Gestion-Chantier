# F1 — Le back-office lit le vrai rôle de l'agent (tâche 2.0)

Branche : `feature/lot2-role-reel`
Prérequis : backend `B1_droits_superviseur.md` fusionné.

## 1. Le défaut

`features/administration/adaptateur.ts:199` :

```ts
function versRole(charge: ChargeUtilisateurSuperAdmin): RoleAdministrateur {
  return charge.role_global === "AD" ? "SUPERVISEUR" : "SUPPORT";
}
```

**Tous** les agents de la plateforme, SUPPORT compris, ont `role_global = "AD"`. Un agent SUPPORT
est donc affiché comme SUPERVISEUR : tous les boutons lui sont proposés, et depuis B1 le
serveur les lui refuse (403) — l'écran promet des gestes qui échouent.

Le serveur envoie pourtant le vrai rôle : `role` (`"SUPERVISEUR"` | `"SUPPORT"`) et
`is_superuser`, dans la réponse de `POST /admins/connexion/` (`utilisateur`) et dans celles
de `GET` / `PATCH /admins/moi/`.

Second défaut : `obtenirProfil()` (`adaptateur.ts:410`) ne lit **que** le profil gardé dans
`localStorage`. Un profil enregistré avant ce correctif garde son rôle faux jusqu'à la
prochaine reconnexion.

## 2. Ce qu'il faut faire

### 2.1 `features/administration/adaptateur.ts`

1. Dans `interface ChargeUtilisateurSuperAdmin` (l. 99), ajouter :
   ```ts
   /** Le rôle de back-office réel : `is_superuser` côté Django. */
   role?: RoleAdministrateur;
   ```
   (facultatif : une réponse ancienne gardée en cache peut ne pas le porter).
2. Réécrire `versRole` et son commentaire :
   ```ts
   /**
    * Le rôle de back-office porté par un compte.
    *
    * Lu dans `role`, que le serveur dérive de `is_superuser`. **Pas dans `role_global`** :
    * tous les agents de la plateforme y portent `AD`, superviseurs comme support. Sans `role`
    * (réponse ancienne), `is_superuser` tranche ; sans l'un ni l'autre, `SUPPORT` — le moins
    * privilégié. Le serveur reste seul juge de toute façon.
    */
   function versRole(charge: ChargeUtilisateurSuperAdmin): RoleAdministrateur {
     if (charge.role === "SUPERVISEUR" || charge.role === "SUPPORT") return charge.role;
     return charge.is_superuser ? "SUPERVISEUR" : "SUPPORT";
   }
   ```
3. Réécrire `obtenirProfil()` pour **interroger le serveur** :
   ```ts
   /**
    * Le profil de l'agent connecté — `GET /admins/moi/`.
    *
    * Le serveur d'abord : c'est lui qui sait si un agent est passé de SUPPORT à SUPERVISEUR
    * (ou l'inverse) depuis sa connexion. Le profil gardé en local est réécrit avec la réponse.
    *
    * **Sur une panne réseau seulement**, on retombe sur le profil gardé — il se souvient, il
    * n'invente pas. Un refus du serveur (401, 403) remonte tel quel : c'est
    * `SurveillantSessionAdmin` qui renvoie vers la connexion.
    */
   export async function obtenirProfil(): Promise<ProfilAdministrateur> {
     if (SIMULATION_ACTIVE) { ...comportement actuel : profil local ou ErreurApi 401... }
     try {
       const profil = versProfil(
         await apiAdministration.lire<ChargeUtilisateurSuperAdmin>("/admins/moi/"),
       );
       ecrireProfilLocal(profil);
       return profil;
     } catch (cause) {
       const local = lireProfilLocal();
       if (cause instanceof ErreurApi && cause.code === "reseau_indisponible" && local) return local;
       throw cause;
     }
   }
   ```
   Vérifier dans `lib/api/erreurs.ts` (l. 63 et 113) le nom exact du code de panne réseau et
   s'il existe une propriété ou fonction dédiée (`estReseau`, etc.) ; l'utiliser si oui.
   Mettre à jour le commentaire d'en-tête du fichier (l. 14-20) si la phrase sur `/utilisateurs/moi/`
   « non livrée » y figure : la route `/admins/moi/` est livrée.

### 2.2 `features/administration/regles.ts`

Ajouter, à côté de `peutAgirSurClients` (l. 53) et `peutParametrerPlateforme` (l. 475) :

```ts
/**
 * Qui active ou retire un module pour un client : **les deux rôles**. C'est un geste de
 * support courant ; le reste de la fiche (forfait, échéance, suspension) est réservé au
 * superviseur. Comme les deux autres, ce test ne protège rien : il décide d'un bouton.
 */
export function peutGererModulesClient(profil: ProfilAdministrateur | null): boolean {
  return profil !== null;
}

/**
 * Qui voit l'action de suppression définitive : le superviseur seul. Contrairement aux
 * autres actions, elle est **masquée** et non grisée pour le SUPPORT : une zone de danger
 * qu'on ne peut pas utiliser n'apprend rien et inquiète.
 */
export function peutSupprimerClient(profil: ProfilAdministrateur | null): boolean {
  return profil?.role === "SUPERVISEUR";
}
```

Les exporter depuis `features/administration/index.ts` si les autres règles y sont
réexportées (vérifier comment `peutAgirSurClients` est exporté et faire pareil).

### 2.3 Rien d'autre

Les écrans utilisent déjà `peutAgirSurClients` / `peutParametrerPlateforme` : corriger
`versRole` suffit à les rendre justes. **Ne pas** toucher aux écrans dans cette tâche.

## 3. Vérification à l'écran

1. Connecté en **superviseur** : fiche d'un client → boutons Suspendre / Changer de forfait
   actifs ; Paramétrage → pas d'avis « lecture seule ».
2. Créer un compte **SUPPORT** (Paramétrage > Comptes), se déconnecter, s'y connecter :
   fiche client → boutons grisés + avis `fiche.lectureSeule` ; Paramétrage → avis
   `parametres.lectureSeule`.
3. **Profil périmé** : connecté en SUPPORT, ouvrir les outils du navigateur, modifier à la main
   `localStorage["ccd.profil_administrateur"]` pour y mettre `"role":"SUPERVISEUR"`, recharger :
   après le chargement, l'écran repasse en lecture seule (le serveur a corrigé le cache).
4. Couper le backend, recharger : l'en-tête affiche encore le nom (repli local), sans planter.

## 4. Définition de terminé

- [ ] `versRole` lit `role` puis `is_superuser` ; `obtenirProfil` interroge `/admins/moi/`.
- [ ] `peutGererModulesClient` et `peutSupprimerClient` dans `regles.ts`.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur.
- [ ] Les 4 vérifications du §3 faites (1440 px suffit pour cette tâche).
- [ ] Commit : `fix(administration): le role de l'agent vient du serveur, plus de role_global`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.

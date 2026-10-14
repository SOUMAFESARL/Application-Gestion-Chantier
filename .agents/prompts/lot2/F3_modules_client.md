# F3 — Activer et retirer les modules d'un client (tâche 2.3)

Branche : `feature/lot2-modules-client`
Prérequis : backend `B3_modules_client.md` fusionné ; F1 et F2 fusionnées.
Brouillon : `brouillons/ModulesClient.tsx.txt` (59 lignes) — **base de départ**.

## 1. Le contrat servi

- `GET /api/v1/admins/clients/{id}/` porte désormais :
  ```json
  "modules": [{"id": "uuid", "code": "projets", "libelle": "Projets", "actif": true, "desactivable": false}],
  "dirigeant": {"nom": "Awa Koné", "email": "dg@exemple.ci"} | null
  ```
- `POST /api/v1/admins/clients/{id}/modules/{module_id}/activer/` et `.../desactiver/`, corps
  `{}` → **200 : la fiche complète** (même forme que le GET). Ouvert au **SUPPORT** comme au
  superviseur.
- `desactiver` sur un module socle (`projets`) → **409**, message serveur à afficher tel quel.

## 2. Couche par couche

### 2.1 `features/administration/types.ts`

Reprendre du brouillon `brouillons/types.ts.brouillon.txt` :

- `ModuleClient` (l. 327-332), **plus** `desactivable: boolean` avec ce commentaire :
  `/** Faux pour un module socle (Projets) : le serveur refuse de le retirer. */`
- `DirigeantClient` (l. 301 et suivantes : `nom`, `email`).
- Dans `ClientPlateforme` : `modules: ModuleClient[];` et
  `dirigeant: DirigeantClient | null;` (l. 222-224 du brouillon).

### 2.2 `features/administration/adaptateur.ts`

- `interface ChargeClient` : ajouter
  `modules: { id: string; code: string; libelle: string; actif: boolean; desactivable?: boolean }[];`
  et `dirigeant: { nom: string; email: string } | null;`.
- `versClient` (l. 267) : `modules: charge.modules.map(versModuleClient)` et
  `dirigeant: charge.dirigeant`.
- Nouvelle fonction privée :
  ```ts
  function versModuleClient(charge: ChargeModuleClient): ModuleClient {
    return {
      id: charge.id,
      code: charge.code,
      libelle: charge.libelle,
      actif: charge.actif,
      // Absent d'une réponse ancienne : on le tient pour retirable, le serveur reste juge.
      desactivable: charge.desactivable ?? true,
    };
  }
  ```
  (Sortir le type de module en `interface ChargeModuleClient` privée, comme les autres `Charge*`.)
- **Attention aux simulations** : `lib/api/simulationAdministration.ts` fabrique des `ChargeClient`.
  Si `typecheck` y signale l'absence de `modules` / `dirigeant`, y ajouter `modules: []` et
  `dirigeant: null` — **sans autre changement** (le fichier disparaît en F8).
- Nouvelle fonction exportée, sur le modèle de `suspendreClient` (l. 785) mais **toujours réelle**
  (pas de branche `SIMULATION_ACTIVE` : les identifiants viennent du serveur) :
  ```ts
  /**
   * Active ou retire un module pour un client —
   * `POST /admins/clients/<id>/modules/<module>/activer|desactiver/`.
   *
   * Retirer coupe l'accès sans rien effacer : les données du module restent, et reviennent
   * telles quelles à la réactivation. La réponse est la fiche à jour.
   */
  export async function basculerModuleClient(
    clientId: string,
    moduleId: string,
    actif: boolean,
  ): Promise<ClientPlateforme> {
    const charge = await apiAdministration.creer<ChargeClient>(
      `/admins/clients/${clientId}/modules/${moduleId}/${actif ? "activer" : "desactiver"}/`,
      {},
    );
    return versClient(charge);
  }
  ```
  (La version du brouillon relisait la fiche après coup : inutile depuis B3.)

### 2.3 `features/administration/regles.ts`

```ts
/**
 * Les modules qu'on propose d'activer ou de retirer pour un client.
 *
 * « Administration » n'en fait pas partie : tout client l'a, c'est l'espace de son DG.
 * Le catalogue garde son ordre (le serveur trie par `ordre`).
 */
export function modulesProposesAuClient(client: ClientPlateforme): ModuleClient[] {
  return client.modules.filter((module) => module.code.toLowerCase() !== "administration");
}

/** Un module peut-il être retiré à ce client ? Jamais un module socle. */
export function retraitModulePossible(module: ModuleClient): boolean {
  return module.actif && module.desactivable;
}
```

### 2.4 `app/(admin)/admin/cles.ts`

Rien : la mutation écrit dans `CLES_ADMINISTRATION.client(id)` et invalide
`CLES_ADMINISTRATION.clients()`.

### 2.5 Nouveau composant `app/(admin)/admin/clients/[id]/ModulesClient.tsx`

Partir du brouillon. Changements **obligatoires** :

1. Props : `{ client: ClientPlateforme; peutAgir: boolean }` — la fiche passe
   `peutGererModulesClient(profil)` (F1), **pas** `peutAgirSurClients` : le SUPPORT gère les
   modules.
2. Liste : `modulesProposesAuClient(client)`.
3. **Une confirmation avant chaque bascule** (décisions 2.3 a et b) : cocher / décocher n'appelle
   pas le serveur, il ouvre une `Modale` (`@/components/ui`, comme les modales de `FicheClient`) :
   - **Retrait** : titre `modulesClient.retraitTitre` (« Retirer {module} à {client} ? »), texte
     `modulesClient.retraitTexte` : « Les utilisateurs de l'entreprise n'auront plus accès à ce
     module. Ses données sont conservées et reviendront telles quelles si vous le réactivez. Le
     dirigeant de l'entreprise est prévenu par courriel. » ; bouton `danger`
     `modulesClient.retraitConfirmer` (« Retirer le module »).
   - **Activation** : titre `modulesClient.activationTitre` (« Activer {module} pour
     {client} ? »), texte `modulesClient.activationTexte` : « Les rôles standards de l'entreprise
     reçoivent leurs droits par défaut sur ce module. Les rôles personnalisés n'y reçoivent
     aucun droit : le dirigeant devra les leur accorder. Le dirigeant est prévenu par
     courriel. » ; bouton primaire `modulesClient.activationConfirmer` (« Activer le module »).
   - Bouton d'annulation `modulesClient.annuler`.
   - Si le client n'a pas de dirigeant (`client.dirigeant === null`), remplacer la dernière
     phrase par `modulesClient.sansDirigeant` (« Aucun dirigeant actif : personne ne sera
     prévenu. »).
4. **Module socle** : case cochée, `disabled`, et sous le libellé une ligne
   `text-xs text-neutral-500` `modulesClient.socle` (« Module socle : il ne peut pas être
   retiré. »). Utiliser `retraitModulePossible`.
5. Les identifiants `module-client-${id}` du brouillon sont des littéraux de gabarit dans un
   attribut JSX : vérifier que `npm run lint` ne les signale pas ; s'il le fait, sortir le
   préfixe en constante (`const PREFIXE_ID_MODULE = "module-client-";`), comme
   `ID_FORM_SUSPENSION`.
6. Succès : `cache.setQueryData(CLES_ADMINISTRATION.client(client.id), misAJour)`,
   `void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.clients() })`, toast
   `modulesClient.succesActivation` / `succesRetrait` (« {module} activé pour {client}. » /
   « {module} retiré à {client}. »), fermeture de la modale.
7. Échec : toast `cause instanceof ErreurApi ? cause.message : t("erreurs.action")` ; la modale
   reste ouverte.
8. `useTranslations("administration")` et des clés sous `administration.modulesClient.*`
   (et non `administration.fiche.*` comme le brouillon).
9. Pendant la requête, toutes les cases sont désactivées (`bascule.isPending`).

### 2.6 `app/(admin)/admin/clients/[id]/FicheClient.tsx`

- Importer `peutGererModulesClient` et `ModulesClient`.
- Ajouter la carte **après** la carte « Activité » (l. 258-269), dans la même grille :
  `<ModulesClient client={client} peutAgir={peutGererModulesClient(profil)} />`.
- Dans la carte « Identité », ajouter une ligne `fiche.dirigeant` : `client.dirigeant` ?
  `${nom} — ${email}` : `fiche.aucunDirigeant` (« Aucun compte dirigeant »).

### 2.7 `messages/fr.json` — sous `administration`

Ajouter le bloc `modulesClient` avec toutes les clés citées au §2.5 (plus `titre` : « Modules »,
`aucun` : « Aucun module au catalogue. »), et dans `fiche` : `dirigeant` (« Dirigeant »),
`aucunDirigeant`. Reprendre les libellés **exactement** ; apostrophes typographiques `’`.

## 3. Vérification à l'écran

1. Superviseur, fiche d'un client (pas `demo` de préférence, mais `demo` convient en local) :
   la carte « Modules » liste le catalogue ; « Projets » est coché et grisé, avec la mention socle.
2. Décocher un autre module → modale de retrait → confirmer → toast ; **recharger** : décoché.
3. Se connecter **dans l'espace entreprise** de ce client (onglet privé, `demo.localhost:3000`,
   compte DG local) : le module n'apparaît plus dans la navigation. Revenir, le réactiver :
   il revient, avec ses données.
4. Activer un module → la modale parle des rôles personnalisés.
5. Connecté en **SUPPORT** : les cases sont actives (le SUPPORT gère les modules) ; les boutons
   Suspendre / Forfait / Échéance restent grisés.
6. Forcer le 409 : dans l'onglet Réseau, rejouer la requête `desactiver` sur `projets` (ou la
   lancer depuis la console avec le jeton) → toast avec le message serveur.
7. 390 px : la carte passe sous les autres, cases et libellés lisibles.

## 4. Définition de terminé

- [ ] `modules` et `dirigeant` dans `ClientPlateforme` ; `basculerModuleClient` réel.
- [ ] Confirmation à chaque bascule ; module socle grisé ; SUPPORT autorisé.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 7 vérifications faites.
- [ ] Commit : `feat(administration): activer et retirer les modules d'un client, avec confirmation`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.

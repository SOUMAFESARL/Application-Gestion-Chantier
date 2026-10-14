# F7 — Suppression définitive d'une entreprise (tâche 2.4, US 1.1)

Branche : `feature/lot2-suppression-entreprise`
Prérequis : backend `B5_suppression_entreprise.md` fusionné ; F1 à F6 fusionnées.
Brouillon : `brouillons/SuppressionClient.tsx.txt` (171 lignes) — bonne base ; types
`ApercuSuppression` (`types.ts.brouillon.txt` l. 312-325), `lireApercuSuppression` et
`supprimerClientDefinitivement` (`adaptateur.ts.brouillon.txt` l. 135 et l. 780-822).

> L'action la plus dangereuse du produit. Le serveur a six barrières (B5 §2.2) ; l'écran les
> **explique toutes avant** qu'on clique, pour que personne ne découvre une règle par une erreur.

## 1. Le contrat servi (B5 §2)

```
GET /admins/clients/{id}/suppression/apercu/
→ { slug, raison_sociale, protegee, suppression_activee, suspendue,
    motif_longueur_min: 20, sauvegarde_conservee_jours: 30,
    nb_utilisateurs, nb_projets, nb_paiements, adresses: [..], dirigeants: [..] }

POST /admins/clients/{id}/supprimer-definitivement/
{ "confirmation": "<slug>", "motif": "≥ 20 caractères" }
→ 200 { statut: "supprimee", id, slug, sauvegarde: "<fichier>.dump", ... }
```

Erreurs, dans l'ordre où le serveur les contrôle : 403 (SUPPORT), 404, 403
`entreprise_protegee`, 403 `suppression_desactivee`, 409 `entreprise_non_suspendue`, 400
`motif_invalide`, 400 `confirmation_invalide`, 503 `sauvegarde_impossible`. Toutes portent
`erreur.message` en français : **l'afficher tel quel**.

Vérifier la forme exacte de `dirigeants` dans
`../API-Gestion-Chantier/apps/tenants/services/suppression_definitive.py` (`_lire_schema`, l. 35-55 :
les clés lues sont `email`, `nom`, `prenom`, `is_owner`, `avatar`, `role__code`) et typer
`ChargeApercuSuppression` en conséquence ; le type d'écran ne garde que `nom` (prénom + nom) et
`email`.

## 2. Ce que l'utilisateur obtient

En bas de la fiche d'un client, **pour le superviseur seulement**, une carte « Zone dangereuse ».
Elle dit, avant tout clic :

- si l'entreprise est protégée (`demo`) → la carte l'explique, sans bouton ;
- si la suppression est coupée sur ce serveur → la carte l'explique, sans bouton ;
- si l'entreprise n'est pas suspendue → « Suspendez d'abord l'entreprise » et le bouton est
  grisé ;
- sinon, le bouton « Supprimer définitivement ».

La modale montre ce qui sera détruit (comptes, projets, paiements, adresses libérées,
dirigeants), rappelle la sauvegarde de 30 jours et l'e-mail au dirigeant, exige un **motif de
20 caractères** et le **nom technique retapé**. Après succès : retour à la liste des clients,
toast avec le nom du fichier de sauvegarde.

## 3. Couche par couche

### 3.1 `features/administration/types.ts`

`ApercuSuppression` du brouillon, plus :

```ts
  /** Seule une entreprise suspendue se supprime (règle serveur, B5). */
  suspendue: boolean;
  motifLongueurMin: number;
  sauvegardeConserveeJours: number;
```

et `ResultatSuppression { slug: string; sauvegarde: string }`.

### 3.2 `features/administration/regles.ts`

```ts
/** Pourquoi la suppression n'est pas proposée — ou `null` si elle l'est. Une raison à la fois,
 * dans l'ordre du serveur : c'est celle-là qu'il répondrait. */
export type RefusSuppression = "protegee" | "desactivee" | "nonSuspendue";

export function refusSuppression(apercu: ApercuSuppression): RefusSuppression | null {
  if (apercu.protegee) return "protegee";
  if (!apercu.suppressionActivee) return "desactivee";
  if (!apercu.suspendue) return "nonSuspendue";
  return null;
}

/** Le nom technique retapé correspond-il ? Casse et espaces de bord ignorés, comme le serveur. */
export function confirmationSuppressionValide(saisie: string, slug: string): boolean {
  return saisie.trim().toLowerCase() === slug.toLowerCase();
}
```

### 3.3 `features/administration/validations.ts`

```ts
export function schemaSuppressionClient(slug: string, motifMin: number) {
  return z.object({
    motif: chaineNonVide(texte("administration.suppressionDefinitive.erreurMotifRequis")).min(
      motifMin,
      texte("administration.suppressionDefinitive.erreurMotifCourt"),
    ),
    confirmation: z.string().refine(
      (valeur) => confirmationSuppressionValide(valeur, slug),
      texte("administration.suppressionDefinitive.erreurConfirmation"),
    ),
  });
}
```

`motifMin` vient de l'aperçu (`motifLongueurMin`) : la règle a une seule source, le serveur.

### 3.4 `features/administration/adaptateur.ts`

- `ChargeApercuSuppression` et `lireApercuSuppression` du brouillon, complétés des trois champs.
- `supprimerClientDefinitivement(id, confirmation, motif): Promise<ResultatSuppression>` :
  `apiAdministration.creer<{ slug: string; sauvegarde: string }>(…, { confirmation, motif })`.
- Commentaire : « `POST`, et non `DELETE` : un `DELETE` ne porte pas de corps, et le serveur
  exige le nom retapé et le motif. **Irréversible** côté écran ; une sauvegarde du schéma est
  conservée 30 jours côté serveur. »

### 3.5 `app/(admin)/admin/cles.ts`

`apercuSuppression: (id: string) => ["administration", "clients", id, "suppression"] as const,`
(sous `client(id)`, comme le brouillon : supprimer le client emporte son aperçu du cache).

### 3.6 Le composant `app/(admin)/admin/clients/[id]/SuppressionClient.tsx`

Depuis le brouillon. Changements :

1. L'aperçu est chargé **dès l'affichage de la carte** (pas à l'ouverture de la modale) : la
   carte en a besoin pour dire pourquoi elle refuse. `useQuery({ queryKey:
   CLES_ADMINISTRATION.apercuSuppression(client.id), queryFn: () => lireApercuSuppression(client.id) })`.
2. La carte : titre `titre`, puis selon `refusSuppression(apercu)` :
   `refus.protegee` / `refus.desactivee` (alerte `information`, pas de bouton) ou
   `refus.nonSuspendue` (alerte `avertissement` + bouton grisé), sinon `description` + bouton
   `danger` `ouvrir`.
3. Le formulaire de la modale passe par `react-hook-form` + `zodResolver(schemaSuppressionClient(apercu.slug, apercu.motifLongueurMin))`.
   Champs : **Motif** (zone de texte, compteur `{n} / {min}` sous le champ), **Nom technique**
   (`Input`, `autoComplete="off"`, libellé `saisie` qui affiche le slug en `<code>`).
4. Le bouton de confirmation (`danger`) est désactivé tant que le formulaire n'est pas valide
   (`formState.isValid`, `mode: "onChange"`).
5. Dans le corps de la modale, en plus de l'inventaire du brouillon :
   - `sauvegarde` : « Une sauvegarde de l'entreprise est faite avant la suppression et conservée
     {jours} jours sur le serveur. Si elle échoue, rien n'est supprimé. » ;
   - `courrielDirigeant` : « Le dirigeant de l'entreprise reçoit un courriel avant la suppression.
     Le motif n'y figure pas. » ;
   - `motifAide` : « Le motif est conservé au journal de la plateforme. »
6. Succès : `cache.removeQueries({ queryKey: CLES_ADMINISTRATION.client(client.id) })`,
   `invalidateQueries` clients + indicateurs, toast `succes` (« {client} a été supprimée. Sauvegarde :
   {fichier}. »), `router.replace("/admin/clients")` (`useRouter` de `next/navigation`).
7. Échec : le message serveur dans une `Alerte type="erreur"` **dans** la modale (le brouillon
   le fait, l. 66) ; la modale reste ouverte ; le motif saisi est conservé.

### 3.7 `FicheClient.tsx`

Tout en bas de la fiche, **après** les cartes :
`{peutSupprimerClient(profil) && <SuppressionClient client={client} />}` — **masqué** pour le
SUPPORT (exception assumée à « griser, pas masquer », voir F1 §2.2).

### 3.8 `messages/fr.json`

Partir de `brouillon_administration.suppressionDefinitive` (`brouillons/fr_administration.brouillon.json`),
le placer sous `administration.suppressionDefinitive`, et :

- **Modifier** `description` : retirer « Cette opération est réservée à la phase de test. » ;
  nouveau texte : « Supprime l’entreprise, tous ses comptes et toutes ses données, puis libère ses
  adresses e-mail. »
- **Ajouter** `refus.protegee` (« Cette entreprise est protégée : elle ne peut pas être
  supprimée. »), `refus.desactivee` (« La suppression définitive est coupée sur ce serveur. »),
  `refus.nonSuspendue` (« Suspendez d’abord l’entreprise : seule une entreprise suspendue peut être
  supprimée. »), `motif`, `motifPlaceholder` (« Demande écrite du client du …, contrat résilié,
  données exportées… »), `motifAide`, `motifCompteur` (« {n} / {min} caractères »),
  `erreurMotifRequis`, `erreurMotifCourt` (« Le motif doit contenir au moins 20 caractères. »),
  `erreurConfirmation` (« Le nom saisi ne correspond pas à celui de l’entreprise. »),
  `sauvegarde`, `courrielDirigeant`, et `succes` avec `{fichier}`.

## 4. Vérification à l'écran

**L'interrupteur est éteint par défaut depuis B5** : pour tester, le développeur met
`SUPPRESSION_ENTREPRISE_ACTIVEE=True` dans le `.env` **local** du backend et relance le serveur.
Et `pg_dump` doit être accessible (ou `PG_DUMP_CHEMIN` renseigné) — sinon le 503 est le
comportement attendu, à vérifier aussi.

**Ne jamais tester sur `demo`** autrement que pour voir le refus. Créer une entreprise de test
par le parcours d'inscription, ou demander au développeur laquelle utiliser.

1. Interrupteur éteint : la carte dit « coupée sur ce serveur », sans bouton.
2. Fiche de `demo` : « protégée », sans bouton.
3. Entreprise de test **active** : bouton grisé, « Suspendez d'abord ».
4. La suspendre (bouton de la fiche) : la carte propose le bouton.
5. Modale : motif de 19 caractères → bouton grisé ; nom mal retapé → grisé.
6. Sans `pg_dump` : confirmer → alerte « La sauvegarde de l'entreprise a échoué… » ; l'entreprise
   existe toujours (recharger la liste).
7. Avec `pg_dump` : confirmer → retour à la liste, toast avec le nom du fichier ; le fichier
   existe dans `sauvegardes/suppressions/` du backend ; la console du backend montre le courriel
   au dirigeant ; le journal (F5) montre la ligne avec motif et sauvegarde.
8. SUPPORT : la carte n'apparaît pas.
9. 390 px : la modale défile verticalement, les champs restent lisibles.

## 5. Définition de terminé

- [ ] Carte « Zone dangereuse » qui explique chaque refus ; motif + nom retapé ; superviseur seul.
- [ ] Succès → liste + toast avec la sauvegarde ; échec → alerte dans la modale.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 9 vérifications faites (dire
      lesquelles n'ont pas pu l'être, par exemple faute de `pg_dump`).
- [ ] Commit : `feat(administration): suppression definitive d'une entreprise suspendue, avec motif`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.

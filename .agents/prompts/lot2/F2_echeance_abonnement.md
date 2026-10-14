# F2 — Modifier l'échéance de l'abonnement d'un client (tâche 2.2)

Branche : `feature/lot2-echeance-abonnement`
Prérequis : backend `B2_echeance_abonnement.md` fusionné ; F1 fusionnée.

## 1. Contexte

La modale existe : `app/(admin)/admin/clients/ModaleFinAbonnement.tsx` (161 lignes), ouverte
depuis la liste (`ListeClients.tsx:269`). Elle appelle `modifierFinAbonnement`
(`features/administration/adaptateur.ts:775`), qui envoie
`PATCH /admins/clients/{id}/ {abonnement: {date_fin, fin_essai?}}` — **la route répondait 405**.
B2 l'a écrite, avec un contrat plus strict.

## 2. Le contrat servi (rappel de B2 §2)

```
PATCH /api/v1/admins/clients/{id}/
{ "abonnement": { "date_fin": "AAAA-MM-JJ" }, "motif": "≥ 10 caractères" }
→ 200 : la fiche client complète (même forme que GET /admins/clients/{id}/)
```

Erreurs : 400 `details.date_fin` (date passée, ou pas après le début), 400 `details.motif`,
403 (SUPPORT), 404, 409 (pas d'abonnement, abonnement résilié). Le serveur fixe lui-même
`fin_essai` pendant un essai : **le client ne l'envoie plus**.

## 3. Ce qu'il faut faire, couche par couche

### 3.1 `features/administration/types.ts`

Rien à ajouter si `ClientPlateforme` est déjà le type de retour de `lireClient` (c'est le cas).

### 3.2 `features/administration/validations.ts`

Réécrire `schemaFinAbonnement` (l. 89) et son commentaire :

```ts
/**
 * La nouvelle échéance d'un abonnement (`2026-11-05`), et pourquoi on la change.
 *
 * La date est **au plus tôt aujourd'hui** et **après le début** de l'abonnement : le serveur
 * refuse les deux autres cas (B2). Clore un abonnement à une date passée n'est plus un geste
 * du back-office : c'est la suspension. Le motif est journalisé ; il n'est pas envoyé au client.
 */
export function schemaFinAbonnement(dateDebut: string, aujourdhui: string) {
  return z.object({
    dateFin: chaineNonVide(texte("administration.finAbonnement.erreurDateRequise"))
      .refine((valeur) => valeur > dateDebut, texte("administration.finAbonnement.erreurAvantDebut"))
      .refine((valeur) => valeur >= aujourdhui, texte("administration.finAbonnement.erreurPassee")),
    motif: chaineNonVide(texte("administration.finAbonnement.erreurMotifRequis")).min(
      MOTIF_MIN,
      texte("administration.finAbonnement.erreurMotifCourt"),
    ),
  });
}
```

`MOTIF_MIN = 10` existe déjà (l. 53) : c'est la même valeur que le serveur, la réutiliser.
Les types `SaisieFinAbonnement` / `ValeursFinAbonnement` se recalculent seuls.

Pour `aujourdhui` : la date **locale** du poste au format `AAAA-MM-JJ`. Chercher dans
`lib/format` ou `lib/dates` une fonction existante (`grep -rn "toISOString().slice(0, 10)\|aujourdhuiIso\|dateLocaleIso" lib features`) ;
s'il n'y en a pas, en ajouter **une** dans `features/administration/regles.ts` :

```ts
/** Aujourd'hui, au format des dates du serveur (`2026-10-14`), **dans le fuseau du poste**. */
export function aujourdhuiIso(maintenant: Date = new Date()): string {
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}
```

(**Pas** `toISOString()` : à Abidjan c'est indifférent, mais sur un poste en UTC+1 après 23 h,
`toISOString` donne déjà le lendemain.)

### 3.3 `features/administration/adaptateur.ts`

Réécrire `modifierFinAbonnement` (l. 775) :

```ts
/**
 * Repousse ou avance l'échéance de l'abonnement d'un client — `PATCH /admins/clients/<id>/`.
 *
 * Seule `date_fin` part : pendant un essai, c'est le serveur qui aligne `fin_essai`. Le motif
 * est obligatoire et journalisé côté plateforme. La réponse est la fiche à jour.
 */
export async function modifierFinAbonnement(
  id: string,
  dateFin: string,
  motif: string,
): Promise<ClientPlateforme> {
  const charge = await apiAdministration.modifier<ChargeClient>(`/admins/clients/${id}/`, {
    abonnement: { date_fin: dateFin },
    motif,
  });
  return versClient(charge);
}
```

### 3.4 `app/(admin)/admin/clients/ModaleFinAbonnement.tsx`

- `schemaFinAbonnement(dateDebut, aujourdhuiIso())` dans le `useMemo`.
- `defaultValues: { dateFin: "", motif: "" }` ; le `reset` d'ouverture remet `motif: ""`.
- Sous le sélecteur de date, un champ **Motif** : reprendre exactement le champ de motif de la
  modale de suspension de `FicheClient.tsx` (l. 296-314 : `<label>`, `Input` ou zone de texte,
  message d'erreur `text-xs font-medium text-erreur`, `aria-invalid`, `aria-describedby`).
- `auPlusTot` du `SelecteurDate` : la plus tardive de `aujourdhuiIso()` et du lendemain de
  `dateDebut` (calcul dans `regles.ts`, fonction `premiereEcheancePossible(dateDebut, aujourdhui)`,
  pas dans le composant).
- `mutationFn: ({ cible, valeurs }) => modifierFinAbonnement(cible.id, valeurs.dateFin, valeurs.motif)`.
- `onSuccess(client)` : `cache.setQueryData(CLES_ADMINISTRATION.client(client.id), client)`, puis
  les deux invalidations actuelles (liste, indicateurs), puis le toast `succes`, puis `onFermer()`.
- `onError` : si `cause instanceof ErreurApi` et que `cause.erreursParChamp` contient `date_fin`
  ou `motif`, les poser sur le formulaire (`formulaire.setError("dateFin", { message })` /
  `"motif"`) **et** ne pas afficher de toast ; sinon le toast actuel.
- Le paragraphe de description reste ; ajouter en dessous une ligne d'aide
  `finAbonnement.aideMotif` (« Le motif reste au journal de la plateforme ; il n'est pas
  communiqué au client. Le dirigeant de l'entreprise est prévenu par courriel de la nouvelle
  date. »).
- Pendant un essai (`client.abonnement.statut === "ESSAI"`), afficher
  `finAbonnement.aideEssai` (« Pendant l'essai, la fin de l'essai suit cette date. »).

### 3.5 Ouvrir la modale depuis la fiche aussi

`app/(admin)/admin/clients/[id]/FicheClient.tsx` : ajouter un 4ᵉ bouton dans la barre d'actions
(l. 185-214), **après** « Changer de forfait », libellé `fiche.modifierEcheance`, icône
`CalendarClock` (lucide-react), `variante` identique à « Changer de forfait », `disabled={!peutAgir}`.
Il ouvre `<ModaleFinAbonnement client={echeanceOuverte ? client : null} onFermer={...} />`
(état local booléen `echeanceOuverte`). Ne pas l'ajouter à l'union `Action` : la modale gère son
propre formulaire.

### 3.6 `messages/fr.json` — sous `administration`

Dans `finAbonnement`, **ajouter** :

```json
"motif": "Motif de la modification",
"motifPlaceholder": "Geste commercial après l’incident du 10/10, paiement reçu hors délai…",
"aideMotif": "Le motif reste au journal de la plateforme ; il n’est pas communiqué au client. Le dirigeant de l’entreprise est prévenu par courriel de la nouvelle date.",
"aideEssai": "Pendant l’essai, la fin de l’essai suit cette date.",
"erreurPassee": "La date de fin ne peut pas être antérieure à aujourd’hui.",
"erreurMotifRequis": "Le motif est requis.",
"erreurMotifCourt": "Le motif doit contenir au moins 10 caractères."
```

**Modifier** `erreurAvantDebut` en : `"La date de fin doit être postérieure au début de l’abonnement."`
Dans `fiche`, ajouter `"modifierEcheance": "Modifier l’échéance"`.

(Apostrophes typographiques `’` comme le reste du fichier.)

## 4. Vérification à l'écran

1. Superviseur, liste des clients → « Modifier la fin » sur un client `ACTIF` : choisir une date
   dans 2 mois, motif « Geste commercial test » → toast de succès ; **recharger** : la date de
   fin de la liste et de la fiche est la nouvelle.
2. Même geste depuis la **fiche** (nouveau bouton).
3. Motif « court » → message sous le champ, rien n'est envoyé (onglet Réseau : aucune requête).
4. Le calendrier ne propose pas les jours passés.
5. Un client en essai : la ligne d'aide d'essai s'affiche ; après enregistrement, la fiche montre
   « fin d'essai » = nouvelle date.
6. Connecté en SUPPORT : bouton grisé.
7. Dans la console du backend (courriels en console en local), le courriel au DG apparaît, sans
   le motif.
8. 390 px : la modale tient sans défilement horizontal.

## 5. Définition de terminé

- [ ] Contrat B2 tenu ; motif obligatoire ; date ≥ aujourd'hui et > début.
- [ ] Bouton sur la fiche ; erreurs serveur posées sur les champs.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 8 vérifications faites.
- [ ] Commit : `feat(administration): modifier l'echeance d'un abonnement, avec motif`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.

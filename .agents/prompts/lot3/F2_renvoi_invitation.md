# F2 — Renvoyer l'invitation d'un collaborateur (3.2)

Branche : `feature/lot3-renvoi-invitation`
Prérequis : backend `B2_renvoi_invitation.md` fusionné ; F1 fusionnée.

## 1. Le contrat servi (B2 §2)

```
POST /api/v1/parametres/collaborateurs/{id}/renvoyer-invitation/   corps {}
→ 200 : le collaborateur (même forme que la création), avec lien_activation et email_envoye
```

409 si le compte est déjà actif, ou si une invitation vient d'être envoyée (moins d'une minute) ;
403 si un AD vise un invité AD. Messages serveur en français : les afficher tels quels.

## 2. Couche par couche

### 2.1 `features/invitations/types.ts`

```ts
/** Le résultat d'un renvoi : le collaborateur, son nouveau lien, et si le courriel est parti. */
export interface InvitationRenvoyee {
  collaborateur: Collaborateur;
  lienActivation: string | null;
  emailEnvoye: boolean;
}
```

### 2.2 `features/invitations/regles.ts`

```ts
/**
 * Une invitation se renvoie tant que le compte n'est pas activé. Mêmes limites que les autres
 * gestes (`compteGerable`) : ni le propriétaire, ni soi-même.
 */
export function renvoiInvitationPossible(collaborateur: Collaborateur, moiId: string | null): boolean {
  return collaborateur.statut === "INVITE" && compteGerable(collaborateur, moiId);
}
```

Mettre à jour le commentaire de `suspensionPossible` (l. 48-51) : « Une invitation en attente ne
se suspend pas : elle se renvoie, ou se supprime. »

### 2.3 `features/invitations/adaptateur.ts`

Ajouter `email_envoye?: boolean` à `ChargeCollaborateur`, puis :

```ts
/**
 * Émet un nouveau lien d'activation et révoque l'ancien — `POST …/{id}/renvoyer-invitation/`.
 * Le lien d'une invitation vaut 72 heures ; au-delà, c'est le seul moyen de le refaire.
 */
export async function renvoyerInvitation(id: string): Promise<InvitationRenvoyee> {
  const charge = await api.creer<ChargeCollaborateur>(`${RESSOURCE}${id}/renvoyer-invitation/`, {});
  return {
    collaborateur: versCollaborateur(charge),
    lienActivation: charge.lien_activation ?? null,
    emailEnvoye: charge.email_envoye ?? false,
  };
}
```

### 2.4 `features/invitations/components/GestionCollaborateur.tsx`

Ajouter un quatrième geste, sur le modèle des trois autres :

- `type Geste = "suspension" | "reactivation" | "suppression" | "renvoi";`
- `const renvoyer = useCallback((c: Collaborateur) => ouvrir("renvoi", c), [ouvrir]);` — à
  retourner avec les autres.
- Dans `mutationFn` : `if (geste === "renvoi") return (await renvoyerInvitation(collaborateur.id)).collaborateur;`
  — mais il faut aussi le lien et `emailEnvoye` pour le toast : faire renvoyer à la mutation un
  objet `{ collaborateur, renvoi?: InvitationRenvoyee }` et adapter `onSuccess` sans changer le
  comportement des trois autres gestes.
- Succès du renvoi : `actualiser(collaborateur)` ; toast
  - si `emailEnvoye` : `t("renvoi.succes", { nom })` (« Une nouvelle invitation a été envoyée à {nom}. ») ;
  - sinon : `toast.warning(t("renvoi.sansCourriel", { nom }))` (« Le lien a été renouvelé, mais le
    courriel n'est pas parti. Copiez le lien pour le transmettre à {nom}. »).
  - dans les deux cas, une action de toast `t("renvoi.copierLien")` qui copie
    `window.location.origin + lienActivation` dans le presse-papier
    (`navigator.clipboard.writeText`, avec un toast d'échec si le navigateur refuse). Regarder comment
    `app/(entreprise)/parametres/collaborateurs/page.tsx:148-170` présente le lien après une
    création, et rester cohérent (même libellé d'action si possible).
- Le bouton de confirmation du renvoi est `variante="primaire"` (comme la réactivation).

### 2.5 Les écrans

- `app/(entreprise)/parametres/collaborateurs/[id]/FicheCollaborateur.tsx` (l. 224-253) : un bouton
  `fiche.renvoyerInvitation` (« Renvoyer l'invitation », icône `Send` de lucide-react) quand
  `renvoiInvitationPossible(collaborateur, moiId)`, **avant** « Supprimer ».
- `app/(entreprise)/parametres/collaborateurs/page.tsx` : là où la ligne propose ses gestes
  (chercher les appels à `suspendre(` / `supprimer(`), ajouter « Renvoyer l'invitation » pour un
  invité, au même endroit et sous la même condition.

### 2.6 `messages/fr.json`

Sous `gestionCollaborateurs.gestes.renvoi` : `titre` (« Renvoyer l'invitation à {nom} ? »),
`description` (« Un nouveau lien d'activation, valable 72 heures, lui sera envoyé par courriel.
L'ancien lien cessera de fonctionner. »), `confirmer` (« Renvoyer »), `enCours` (« Envoi… »),
`succes`, `sansCourriel`, `copierLien` (« Copier le lien »), `lienCopie` (« Lien copié. »),
`copieImpossible` (« Le navigateur a refusé la copie. »). Et la clé du bouton de fiche
(`fiche.renvoyerInvitation`) dans le même espace de noms que `fiche.suspendre` (le trouver dans
`messages/fr.json`). Apostrophes typographiques `’`.

## 3. Vérification à l'écran

1. Inviter un collaborateur de test (adresse du développeur) ; sur sa ligne et sur sa fiche,
   « Renvoyer l'invitation » est proposé ; sur un compte actif, non.
2. Renvoyer → toast, courriel dans la console du backend (en local), avec un lien **différent**.
3. Ouvrir l'**ancien** lien dans une fenêtre privée : il est refusé. Le nouveau fonctionne.
4. Renvoyer deux fois de suite : le second affiche « patientez une minute » dans la modale.
5. « Copier le lien » : le presse-papier contient l'adresse complète.
6. 390 px.

## 4. Définition de terminé

- [ ] Geste « renvoi » dans le hook partagé ; bouton sur la liste et la fiche.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 6 vérifications faites.
- [ ] Commit : `feat(invitations): renvoyer l'invitation d'un collaborateur`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.

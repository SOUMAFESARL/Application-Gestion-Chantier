# F4 — Nom du projet réservé au DG et à l'AD ; vérification de la durée (US 3.2, 3.1)

Branche : `feature/lot4-nom-et-duree`
Prérequis : backend `B3_nom_projet.md` fusionné ; F3 fusionnée.

## 1. US 3.2 — le nom

Le serveur (B3) refuse en 403 le renommage hors DG / AD et expose `peut_renommer` dans le projet.

1. `features/projets/adaptateur.ts` : `peut_renommer?: boolean` dans `ChargeProjet` ;
   `peutRenommer: boolean` dans `Projet` (`types.ts`) ; `versProjet` : `charge.peut_renommer ?? false`
   (un serveur ancien ne donne aucun droit).
2. Le formulaire de modification du projet (chercher où `nom` est modifiable : tiroir ou modale
   d'édition du projet, `versModificationProjet` dans `validations.ts:~169`) : si
   `!projet.peutRenommer`, le champ **Nom** est `disabled` avec l'aide
   `projets.edition.nomReserve` (« Seuls le Directeur Général et l’administrateur de l’entreprise
   peuvent renommer un projet. ») ; et `versModificationProjet` **n'envoie pas** `nom` dans ce cas.
3. Erreur 403 du serveur → message affiché tel quel.

## 2. US 3.1 — la durée (vérification, pas de code)

La fiche affiche déjà la durée (`FicheProjet.tsx:717`, `formaterDuree(echeancier.duree)`,
`regles.ts:534` `dureeProjet` : années, mois, jours et jours ouvrés). Vérifier :

1. un projet du 01/01/2026 au 31/12/2027 affiche « 2 ans » (bornes comprises) et ses jours ouvrés ;
2. un projet de 14 mois affiche « 1 an et 2 mois » ;
3. le **PDF** de la fiche projet (`GenerationFicheProjet.tsx`, `contenuFichePdf.ts`) contient la
   même durée — s'il ne la contient pas, l'y ajouter avec `formaterDuree` (c'est le seul code permis
   par cette partie) ;
4. après une reprogrammation (F3), la durée se met à jour sans rechargement.

## 3. Vérification à l'écran

1. DG : renomme un projet → enregistré, recharger : nouveau nom.
2. CP : champ Nom grisé avec l'aide ; les autres champs restent modifiables et s'enregistrent.
3. Les quatre points de durée du §2.
4. 390 px.

## 4. Définition de terminé

- [ ] `peutRenommer` lu ; champ grisé et non envoyé hors DG / AD.
- [ ] Durée vérifiée à l'écran et dans le PDF (ajoutée au PDF si absente).
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur.
- [ ] Commit : `feat(projets): le nom du projet reserve au DG et a l'administrateur`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.

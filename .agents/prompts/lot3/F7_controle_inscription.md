# F7 — Contrôle du parcours d'inscription (3.8)

Branche : `feature/lot3-controle-inscription` (frontend), et `fix/lot3-inscription-<sujet>` côté
backend **seulement si un écart l'exige**.
Prérequis : F1 à F6 fusionnées.

## 1. Le but

Le plan disait ces routes « jamais appelées » ; elles le sont : `features/inscription/api.ts`
(l. 86-104), appelé par `app/(public)/inscription/FormulaireInscription.tsx` et
`app/(auth)/activation/EcranActivation.tsx`. La tâche est un **contrôle** : prouver que chaque
champ envoyé et lu correspond au serveur, et que la chaîne complète fonctionne en local. **On
n'écrit du code que si un écart est trouvé**, et chaque écart est corrigé du côté qui a tort
(le serveur fait foi, sauf si sa réponse contredit `04_Conception/` — alors s'arrêter et
demander).

| Fonction (frontend) | Route | Vue (backend, `apps/tenants/views/__init__.py` et `urls.py:18-40`) |
|---|---|---|
| `deposerInscription` | `POST /inscription/` | `DepotInscriptionView` |
| `renvoyerEmail` | `POST /inscription/renvoyer/` | `RenvoiActivationView` |
| `verifierJeton` | `POST /inscription/verifier/` | `VerificationJetonInscriptionView` |
| `activer` | `POST /inscription/activer/` | `ActivationView` |
| `lireEtatProvisionnement` | `GET /inscription/etat/{suivi}/` | `EtatProvisionnementView` |

Toutes passent par `apiPlateforme` (domaine principal, sans jeton).

## 2. La méthode — skill `brancher-api`, étape « lire le contrat »

Pour **chaque** ligne du tableau :

1. Lire le serializer d'entrée et de sortie côté serveur (`apps/tenants/serializers/`).
2. Lire le type TypeScript correspondant dans `features/inscription/api.ts` (`DemandeInscription`,
   `AccuseInscription`, `ContenuJeton`, `Activation`, `AccuseActivation`, `EtatProvisionnement`).
3. Remplir un tableau **champ par champ** : nom, type, obligatoire, présent des deux côtés ?
   valeurs d'énumération (statuts du provisionnement) identiques ?
4. Lire les erreurs que la vue peut renvoyer (codes, messages) et vérifier que l'écran les montre
   (message serveur ou message local équivalent), sans `{"detail"}` brut (cf. B1 : si une de ces
   vues renvoie `Response({"detail": …})`, c'est un écart backend à corriger de la même façon).

Écrire ce tableau dans le compte rendu de la tâche.

## 3. La chaîne à l'écran, en local

Prérequis : backend local ; Celery ou exécution synchrone du provisionnement selon la
configuration locale (lire `README.md` du backend, chercher `CELERY_TASK_ALWAYS_EAGER`) ; courriels
en console (`EMAIL_BACKEND` console en local).

1. `http://localhost:3000/inscription` : remplir avec une entreprise de test et une adresse du
   développeur ; accepter les CGU → écran « Vérifiez votre e-mail ».
2. « Renvoyer l'e-mail » : un second courriel apparaît dans la console du backend.
3. Ouvrir le lien du courriel (`/activation#jeton=…`) → l'écran vérifie le jeton et affiche le
   formulaire d'activation.
4. Choisir un mot de passe → provisionnement : l'écran suit l'état (`etat/{suivi}/`) jusqu'à
   « espace prêt ».
5. Se connecter sur l'espace créé (`<slug>.localhost:3000`) avec le compte DG.
6. Cas d'erreur : rejouer le **même** lien d'activation → message « lien déjà utilisé / expiré »
   lisible ; jeton inventé → idem ; adresse déjà inscrite → message lisible au dépôt.
7. 390 px pour les écrans 1, 3 et 4.

**Nettoyage** : l'entreprise de test créée doit être supprimée à la fin (back-office, suspendre
puis supprimer, interrupteur `SUPPRESSION_ENTREPRISE_ACTIVEE=True` dans le `.env` **local** —
voir lot 2, F7), ou signalée au développeur pour qu'il la supprime.

## 4. Si un écart est trouvé

- Le décrire dans le compte rendu (champ, côté fautif, conséquence visible).
- Le corriger sur une branche dédiée, avec un test (pytest côté serveur) ou une vérification à
  l'écran (côté frontend), puis fusionner comme les autres tâches.
- Un écart qui touche aux règles (CGU, slug, quotas) : **ne pas corriger**, s'arrêter et demander.

## 5. Définition de terminé

- [ ] Tableau champ par champ des cinq routes dans le compte rendu.
- [ ] Les 7 étapes de la chaîne vues à l'écran (dire lesquelles n'ont pas pu l'être et pourquoi).
- [ ] Écarts corrigés et fusionnés, ou « aucun écart » écrit explicitement.
- [ ] Entreprise de test supprimée ou signalée.
- [ ] Commit (s'il y a du code) : `fix(inscription): <écart corrigé>` ; sinon aucun commit.

# PROMPT POUR GEMINI 3.8 FLASH — Génération du Guide Complet de Tests Fonctionnels CCD Digital

> **INSTRUCTION CRITIQUE POUR TOI (GEMINI 3.8 FLASH) :**
> Tu es chargé de rédiger UN SEUL fichier Markdown ultra-complet, détaillé pas-à-pas, sur le Bureau de l'utilisateur :
> **`C:\Users\Administrator\Desktop\Guide_Tests_Fonctionnels_CCD_Digital.md`**
>
> **RÈGLES D'EXÉCUTION STRICTES (À SUIVRE À LA LETTRE) :**
> 1. **Ne modifie AUCUN fichier de code** du backend ni du frontend. Ne lance AUCUN serveur, ne lance AUCUN test pytest/playwright.
> 2. **Ne cherche pas dans tout le dépôt** : tout le savoir fonctionnel vérifié (Lots 0, 1, 2, 3, 4 et Chantier Droits par codes) est déjà résumé dans ce prompt et dans `C:\Users\Administrator\Desktop\SOUMAFE\Gestion_Chantier\05_Developpement\Application-Gestion-Chantier\docs\plan_alignement_api.md`.
> 3. **Lis uniquement** :
>    - `C:\Users\Administrator\Desktop\Comptes_tests_locaux.txt` (pour récupérer les comptes de test locaux et leur mot de passe commun afin de les inclure dans le guide sur le Bureau — ce guide reste sur le Bureau, hors Git).
>    - `C:\Users\Administrator\Desktop\SOUMAFE\Gestion_Chantier\05_Developpement\Application-Gestion-Chantier\docs\plan_alignement_api.md` (pour vérifier les détails des Lots 1 à 4 et du chantier Droits).
> 4. **Utilise l'outil `write_to_file`** avec `Overwrite: true` pour créer directement `C:\Users\Administrator\Desktop\Guide_Tests_Fonctionnels_CCD_Digital.md`.
> 5. **Sois exhaustif et ultra-concret** : Il est INTERDIT d'écrire des phrases vagues comme « Créez un projet avec des dates valides ». Tu dois écrire **chaque valeur exacte à saisir champ par champ**, le **bouton exact sur lequel cliquer**, le **résultat attendu à l'écran**, et les **cas d'erreur à tester** (ce qui doit bloquer).

---

## STRUCTURE OBLIGATOIRE DU FICHIER `C:\Users\Administrator\Desktop\Guide_Tests_Fonctionnels_CCD_Digital.md`

Ton fichier `.md` sur le Bureau DOIT contenir **exactement les 10 grandes sections suivantes**, avec des cases à cocher `- [ ]` pour chaque étape de test afin que le testeur puisse cocher au fur et à mesure.

---

### SECTION 1 : Environnements, URLs & Comptes de Test Prêts à l'Emploi

Dans cette section, présente un tableau clair avec :
1. **Les URLs d'accès** :
   - **En Local** :
     - Espace Entreprise : `http://localhost:3000/connexion`
     - Inscription Publique : `http://localhost:3000/inscription`
     - Back-Office Super Admin : `http://localhost:3000/admin/connexion`
     - API Backend / Swagger : `http://localhost:8000/api/v1/schema/`
   - **En Production** :
     - Espace Entreprise : `https://gchantier.soumafe.com/connexion`
     - Inscription Publique : `https://gchantier.soumafe.com/inscription`
     - Back-Office Super Admin : `https://gchantier.soumafe.com/admin/connexion`
     - API Backend : `https://api-chantier.soumafe.com/api/v1/schema/`
2. **Commandes de démarrage en local** (si le testeur teste en local) :
   - Backend : `.\.venv\Scripts\python.exe manage.py runserver 8000`
   - Frontend : `npm run dev`
3. **Tableau complet des comptes de l'entreprise `demo` (« Démo BTP »)** (copie les emails exacts et le mot de passe commun depuis `C:\Users\Administrator\Desktop\Comptes_tests_locaux.txt`) :
   - `test.dg@demo.ci` (DG — Directeur Général / PDG, portée ENTREPRISE, propriétaire)
   - `test.ad@demo.ci` (AD — Administrateur, portée ENTREPRISE, sans `projets.voir_montants`)
   - `test.do@demo.ci` (DO — Directeur des Opérations)
   - `test.df@demo.ci` (DF — Directeur Financier / DAF, affecté à `CHANT-2026-001` comme VI)
   - `test.cp@demo.ci` (CP — Chef de Projet, affecté à `CHANT-2026-001` comme CP)
   - `test.ct@demo.ci` (CT — Conducteur de Travaux, affecté à `CHANT-2026-001` comme CT)
   - `test.cc@demo.ci` (CC — Chef de Chantier, affecté à `CHANT-2026-001` comme CC)
   - `test.mag@demo.ci` (MAG — Magasinier, affecté à `CHANT-2026-001` comme VI)
   - `test.bai@demo.ci` (BAI — Bailleur / Client MOA, affecté à `CHANT-2026-001` comme VI)
   - `test.vi@demo.ci` (VI — Visiteur / Auditeur, affecté à `CHANT-2026-001` comme VI)
   - Comptes historiques de seed : `admin@demo.ci`, `cp@demo.ci`, `cc@demo.ci` (mot de passe `Demo1234!`)
4. **Tableau des comptes Back-Office (Super Admin)** :
   - `test.superviseur@ccd-digital.ci` (Rôle `SUPERVISEUR` — lecture + écriture complète)
   - `test.support@ccd-digital.ci` (Rôle `SUPPORT` — lecture seule stricte)
5. **Périmètre de ce qui est 100% fonctionnel (réel) vs Hors Périmètre (simulé/reporté)** :
   - **100% Réel & Branché** : Authentification, Inscription, Back-office plateforme (Lot 2), Paramétrage entreprise / Collaborateurs / Téléphones E.164 / Profil / Rôles & Permissions par codes (Lot 3 + Chantier Droits), Gestion complète des Projets / Budgets pyramidaux / Dates & Reprogrammation / Encadrement / Équipes / Indice de santé / Import Excel (Lot 4), Journal de chantier / Rapports journaliers / Circuit de validation CC→CT→CP / Relance / Synthèses périodiques (Lot 1).
   - **En attente des prochains lots (ne pas considérer comme bug si simulé)** : Stocks (aucune app backend, 100% simulé), Paiement CinetPay / Factures PDF (Lot 6), Validations d'achats/avenants/bons de paiement du Tableau de bord (Lot 5).

---

### SECTION 2 : Parcours 1 — Inscription d'une Nouvelle Entreprise de A à Z (Lot 3 - F7)

Détaille pas-à-pas la création d'une nouvelle entreprise depuis `/inscription` :
- **Valeurs exactes à saisir** :
  - Raison sociale : `Ivoire Construction Moderne SARL`
  - Nom commercial : `ICM BTP`
  - Slug / sous-domaine souhaité : `icm-btp`
  - Pays : `Côte d'Ivoire` (`CI`)
  - Ville : `Abidjan`
  - Adresse : `Cocody Riviera 3, Boulevard Arsène Usher Assouan`
  - Téléphone entreprise : `+225 07 08 09 10 11`
  - Prénom du dirigeant : `Mamadou`
  - Nom du dirigeant : `Koulibaly`
  - Email professionnel : `m.koulibaly@icm-btp.ci`
  - Mot de passe : `IcmBtp-2026!Secure`
- **Étapes à vérifier** :
  - Contrôle de disponibilité en temps réel du slug et de l'email.
  - Soumission de l'inscription → provisionnement du schéma tenant → récupération du lien d'activation (en console/logs en local ou boîte mail).
  - Connexion initiale du DG `m.koulibaly@icm-btp.ci` → vérification qu'il a le rôle `DG`, portée `ENTREPRISE`, et statut propriétaire (`is_owner`).

---

### SECTION 3 : Parcours 2 — Back-Office Super Admin : Gouvernance Plateforme (Lot 2 & Chantier Droits)

Détaille tous les tests à effectuer sur `/admin/connexion` :
1. **Test de restriction du rôle `SUPPORT` (`test.support@ccd-digital.ci`)** :
   - Se connecter → vérifier que le badge affiche bien `SUPPORT`.
   - Aller sur la fiche d'un client (`/admin/clients/[id]`), sur `/admin/parametres/modules` et `/admin/parametres/permissions` → vérifier que tous les boutons de modification/suppression sont masqués ou désactivés (lecture seule stricte).
2. **Test complet avec le rôle `SUPERVISEUR` (`test.superviseur@ccd-digital.ci`)** :
   - **Échéance d'abonnement (Lot 2 - 2.2)** : Ouvrir la fiche de l'entreprise `Démo BTP` (`demo`). Cliquer sur modifier la date de fin d'abonnement.
     - *Cas d'erreur* : saisir un motif de moins de 10 caractères (ex: `Test`) → doit bloquer.
     - *Cas passant* : saisir la date `2027-12-31` et le motif `Prolongation contrat annuel suite validation comité direction` (≥ 10 caractères) → enregistrer → vérifier le rafraîchissement immédiat.
   - **Modules d'un client (Lot 2 - 2.3 & Droits)** : Sur la fiche du client `demo`, tenter de désactiver le module `PROJETS` → doit être refusé/impossible (`module_obligatoire`). Activer/désactiver un module optionnel (s'assurer que `CHANTIER` reste bien **ACTIVÉ** pour la suite des tests !). Vérifier qu'il n'y a plus aucune mention de « niveau » ou d'« accès par défaut ».
   - **Catalogue des Modules & Permissions (Chantier Droits - B2, F6, F7)** :
     - Aller sur `/admin/parametres/modules` : vérifier l'affichage de l'ordre, de l'icône et des permissions rattachées (8 permissions sur `projets`). Modifier la description d'un module et enregistrer → vérifier que ses permissions rattachées ne sont pas perdues.
     - Aller sur `/admin/parametres/permissions` : tester la règle du préfixe (D2). Tenter de créer une permission avec un code au préfixe inconnu `inconnu.action` → création bloquée. Tester le détachement/rattachement d'une permission avec le message d'avertissement sur la révocation.
   - **Messagerie SMTP (Lot 2 - 2.5)** : Aller sur `/admin/parametres/messagerie`, vérifier la configuration SMTP et lancer un test d'envoi d'e-mail interactif vers `test.dg@demo.ci`.
   - **Journal d'audit de la plateforme (Lot 2 - 2.6)** : Aller sur `/admin/journal`, filtrer par agent (`test.superviseur@ccd-digital.ci`), par entreprise (`demo`) et par date, puis tester l'export CSV et XLSX.
   - **Suppression d'une entreprise (Lot 2 - 2.4 / US 1.1)** : Sur une entreprise de test (NE PAS supprimer `demo` ! Utiliser l'entreprise créée au Parcours 1 `icm-btp` ou tester uniquement les barrières) :
     - Vérifier que si l'entreprise n'est pas `SUSPENDUE`, la suppression est bloquée.
     - Vérifier que si le motif fait moins de 20 caractères, la suppression est bloquée.
     - Vérifier la saisie exacte du slug de confirmation.
   - **Mot de passe oublié Admin (Lot 2 - 2.1)** : Se déconnecter, aller sur `/admin/mot-de-passe/oublie`, saisir `test.superviseur@ccd-digital.ci` → vérifier la réponse 202 et le lien `/admin/mot-de-passe/definir#jeton=…`.

---

### SECTION 4 : Parcours 3 — Paramétrage de l'Entreprise, Téléphones E.164, Collaborateurs & Profil (Lot 3)

Connexion sur `/connexion` avec le Directeur Général **`test.dg@demo.ci`** :
1. **Configuration de l'entreprise & Téléphones internationaux E.164 (Lot 3 - B3, F4, F5)** :
   - Aller sur `/parametres/configuration`.
   - Ajouter 3 numéros de téléphone avec des formats internationaux différents :
     - Numéro 1 (Principal) : `+225 07 07 88 99 00` — Libellé : `Standard Direction Abidjan`
     - Numéro 2 : `+33 1 42 68 55 00` — Libellé : `Bureau de liaison Paris`
     - Numéro 3 : `+221 77 123 45 67` — Libellé : `Antenne Dakar`
   - Enregistrer et recharger la page (`F5`) → vérifier que les 3 numéros et le choix du numéro principal sont bien persistés.
   - Tester la limite : vérifier qu'on peut ajouter jusqu'à 5 numéros maximum et qu'un doublon est refusé.
   - **Logo sur mobile (F5)** : Réduire la fenêtre du navigateur à `390px` de large → vérifier que l'avatar du logo de l'entreprise reste bien visible dans l'en-tête avec son `aria-label`.
2. **Gestion des Collaborateurs : Invitation, Renvoi, Suspension, Réactivation, Suppression (Lot 3 - B1, F1, F2)** :
   - Aller sur `/parametres/collaborateurs`.
   - **Inviter un nouveau collaborateur** avec ces valeurs exactes :
     - Prénom : `Awa`
     - Nom : `Touré`
     - Email : `awa.toure@demo.ci`
     - Téléphone : `+225 05 44 33 22 11`
     - Rôle : `Conducteur de Travaux` (`CT`)
   - **Renvoyer l'invitation (F2)** : Sur la ligne de `awa.toure@demo.ci` (statut `INVITE`), cliquer sur « Renvoyer l'invitation » → vérifier le toast de confirmation.
   - **Suspendre puis Réactiver un collaborateur (F1)** : Choisir le collaborateur `test.vi@demo.ci` → cliquer sur « Suspendre » → vérifier que son statut passe à `SUSPENDU` (et qu'il ne peut plus se connecter). Cliquer ensuite sur « Réactiver » → vérifier que son statut repasse à `ACTIF`.
   - **Supprimer logiquement un collaborateur** : Créer un collaborateur temporaire `temp.suppr@demo.ci` (`Jean`, `Koffi`, rôle `VI`) puis le supprimer → vérifier qu'il disparaît de la liste active.
3. **Profil Utilisateur & Changement de Mot de Passe sans déconnexion (Lot 3 - F6 & Droits)** :
   - Aller sur `/profil`.
   - Vérifier la carte **« Mes habilitations »** : elle affiche la liste des permissions par module (et plus aucun « niveau » ni « Validation »).
   - Changer le mot de passe du compte (ex: avec un compte secondaire ou remettre le même mot de passe juste après) : vérifier la jauge de robustesse Zod, valider, et vérifier que l'utilisateur **reste connecté** sans être éjecté (jetons JWT mis à jour à la volée).

---

### SECTION 5 : Parcours 4 — Rôles, Permissions par Codes, Portée & Masquage des Montants (Chantier Droits)

Ce parcours teste la refonte majeure du 16/10/2026 (« plus aucun niveau 0-3, uniquement des codes de permission ») :
1. **Avec le Directeur Général (`test.dg@demo.ci`) sur `/parametres/roles`** :
   - Vérifier l'interface : aucune légende L/S/V, aucun sélecteur « Lecture / Saisie / Validation ». Chaque cellule de la matrice affiche uniquement `Aucune`, `1 permission` ou `N permissions`, avec la liste au survol.
   - Vérifier que le module `administration` n'apparaît jamais dans les colonnes de la matrice.
   - Vérifier que le rôle `DG` est en lecture seule pour tout le monde.
   - **Créer un rôle personnalisé** :
     - Code : `ING_ETUDES`
     - Libellé : `Ingénieur Études & Méthodes`
     - Portée initiale : `CHANTIER` (restreinte aux projets affectés)
     - Description : `Préparation technique des lots et suivi du planning`
     - Permissions à cocher dans le tiroir : `projets.lire`, `projets.ecrire`, `chantier.lire` (NE PAS cocher `projets.voir_montants`).
     - Enregistrer, recharger la page (`F5`) → vérifier que la cellule Projets affiche `2 permissions` et Chantier `1 permission`.
   - **Changement de portée avec étape de confirmation dans le tiroir (F5)** :
     - Ouvrir le rôle `ING_ETUDES`, changer sa portée de `CHANTIER` vers `ENTREPRISE`.
     - Vérifier que l'étape de confirmation s'affiche **à l'intérieur du tiroir** (et non bloquée derrière), annonçant l'impact sur les personnes affectées. Confirmer et vérifier le badge `Entreprise`.
   - **Responsive 390 px** : Passer l'écran `/parametres/roles` en largeur `390px` → vérifier l'absence de défilement horizontal de la page.
2. **Avec l'Administrateur (`test.ad@demo.ci`) — Règles D1, D4, D5 & Masquage des montants (F1, F2, F3, F4)** :
   - Se connecter avec `test.ad@demo.ci`.
   - **Accès au menu (D4)** : Vérifier que l'AD voit les menus `Collaborateurs` et `Rôles`, mais **ne voit pas** `Abonnement` ni `Configuration` (réservés au DG).
   - **Masquage intégral des montants (F3 / D5)** : L'AD n'a pas la permission `projets.voir_montants`.
     - Aller sur `/projets` : vérifier qu'aucun montant en FCFA n'est affiché (ni budget initial, ni consommé, ni « 0 FCFA » trompeur — uniquement des tirets discrets ou colonnes masquées).
     - Ouvrir la fiche de `CHANT-2026-001` : vérifier que les cartes financières, les colonnes de budget des lots/activités et les formulaires ne montrent aucun montant.
   - **Protection des rôles système et règle D1 sur `/parametres/roles`** :
     - Cliquer sur le rôle système `CP` (Chef de Projet) → vérifier qu'il s'ouvre uniquement en mode **« Consulter »** (seul le DG modifie les rôles système).
     - Ouvrir un rôle personnalisé qui possède une permission que l'AD ne détient pas (`projets.voir_montants`) → vérifier que sa matrice de cases à cocher est verrouillée en lecture seule avec un bandeau d'avertissement (D1), tandis que le libellé et la description restent modifiables (B-08).
     - Créer un rôle personnalisé avec l'AD → vérifier que dans l'éditeur de permissions, l'AD **ne voit que les permissions qu'il détient lui-même** (impossible d'accorder `projets.voir_montants`).

---

### SECTION 6 : Parcours 5 — Gestion Complète d'un Projet, Budgets Pyramidaux & Dates (Lot 4 - B1 à B3, F1 à F4)

Se reconnecter avec le Directeur Général **`test.dg@demo.ci`** :
1. **Création d'un nouveau projet de test complet** sur `/projets` (« Nouveau projet ») :
   - **Valeurs exactes à saisir** :
     - Nom du projet : `Construction Clinique Médicale Sainte-Marie`
     - Description : `Bâtiment R+3 avec bloc opératoire, imagerie et urgences`
     - Client / MOA : `SCI Les Palmiers`
     - Ville : `Abidjan`
     - Quartier : `Marcory Résidentiel`
     - Date de début prévue : `2026-03-01` (début dans le passé accepté — US 3.5)
     - Date de fin prévue : `2026-12-31` (vérifier que si on met une date de fin ≤ date de début, la saisie bloque)
     - Budget initial : `250 000 000` FCFA (250 millions FCFA)
     - Chef de projet désigné : `test.cp@demo.ci`
   - Enregistrer → ouvrir la fiche du projet créé.
   - **Durée calculée (US 3.1 / F4)** : Vérifier que la durée du projet s'affiche en mois/années sur la fiche projet ET dans l'export PDF de la fiche.
2. **Renommage sécurisé du projet (US 3.2 / B3, F4)** :
   - Avec `test.dg@demo.ci` (ou `test.ad@demo.ci`), cliquer sur l'action de renommage du projet → le renommer en `Clinique Internationale Sainte-Marie R+3` → enregistrer → vérifier que le nouveau nom s'affiche immédiatement et est tracé.
   - *Test de sécurité* : Se connecter plus tard avec `test.cp@demo.ci` (Chef de Projet) → vérifier qu'il **ne peut pas** renommer le projet (action absente / 403).
3. **Création des Lots — Contrôle des Dates Contenues (B2, F2) et Plafond Budgétaire (B1, F1)** :
   - Dans la fiche du projet `Clinique Internationale Sainte-Marie R+3` (Budget = `250 000 000 FCFA`, Dates = `01/03/2026` au `31/12/2026`) :
   - **Lot 1 — Cas passant** :
     - Code : `LOT-100`
     - Libellé : `Gros Œuvre, Fondations & Structure Béton`
     - Mode d'exécution : `Sous-traitance structurée`
     - Titulaire : `Kouamé Bâtiment SARL`
     - Date de début : `2026-03-01` | Date de fin : `2026-08-31`
     - Budget du lot : `150 000 000` FCFA
     - Enregistrer → succès (reste disponible sur le projet : `100 000 000` FCFA).
   - **Lot 2 — Test des blocages (Dates hors cadre & Dépassement de budget)** :
     - *Erreur de date* : Tenter de saisir une date de début `2026-02-15` (avant le début du projet) ou une date de fin `2027-01-15` (après la fin du projet) → vérifier que le sélecteur et la validation bloquent (US 3.6/3.7).
     - *Erreur de budget* : Tenter de saisir un budget de `120 000 000` FCFA (alors que `150 000 000` sont déjà pris sur `250 000 000`) → vérifier que le formulaire bloque en indiquant le plafond disponible exact (`100 000 000 FCFA`).
   - **Lot 2 — Cas passant** :
     - Code : `LOT-200`
     - Libellé : `Électricité CFO/CFA & Groupe Électrogène`
     - Mode d'exécution : `Régie`
     - Date de début : `2026-06-01` | Date de fin : `2026-12-15`
     - Budget du lot : `80 000 000` FCFA
     - Enregistrer → succès (total lots = `230 000 000` FCFA ≤ `250 000 000` FCFA).
4. **Création des Activités dans `LOT-100` — Cohérence Pyramidale (US 3.3, US 3.4)** :
   - Ouvrir le lot `LOT-100` (Budget = `150 000 000 FCFA`, Dates = `01/03/2026` au `31/08/2026`).
   - **Activité 1** :
     - Code : `ACT-101` | Libellé : `Fouilles, terrassement et béton de propreté`
     - Dates : `2026-03-01` au `2026-04-30`
     - Budget : `60 000 000` FCFA | Poids / Quantité prévue : saisir les valeurs.
   - **Activité 2** :
     - Code : `ACT-102` | Libellé : `Élévation voiles béton et planchers R+1 à R+3`
     - Dates : `2026-04-15` au `2026-08-31`
     - *Test de dépassement* : Tenter un budget de `100 000 000` FCFA (`60M + 100M > 150M`) → doit bloquer en affichant le disponible (`90 000 000 FCFA`).
     - *Valeur valide* : Saisir `85 000 000` FCFA → enregistrer.
   - Vérifier que la colonne **Budget** apparaît bien dans le tableau des activités ET dans l'export CSV des activités (US 3.3).
5. **Modification du Budget Projet et Plancher des Enfants (US 3.9 / B1, F1)** :
   - Revenir sur la fiche du projet, ouvrir le tiroir de modification du budget du projet.
   - *Test de plancher* : Tenter de baisser le budget du projet à `200 000 000` FCFA (inférieur à la somme des lots qui vaut `230 000 000` FCFA) → doit être refusé avec le message indiquant le plancher minimum (`230 000 000 FCFA`).
   - *Cas passant* : Passer le budget du projet à `260 000 000` FCFA → enregistrer → vérifier la mise à jour immédiate.

---

### SECTION 7 : Parcours 6 — Reprogrammation Calendaire, Encadrement, Équipes, Santé & Import Excel (Lot 4 - B4 à B6, F3, F5 à F7)

Toujours sur le projet créé (ou sur `CHANT-2026-001`) :
1. **Reprogrammation calendaire avec historique (US 3.8 / F3)** :
   - Ouvrir l'action **« Reprogrammer »** sur le projet (puis tester aussi sur un lot et sur une activité).
   - Saisir les nouvelles dates : Date de fin reportée au `2027-02-28`, choisir un motif (ex: `INTEMPERIES` ou `RETARD_APPROVISIONNEMENT`) et saisir la justification : `Fortes pluies diluviennes ayant retardé le coulage des fondations de 3 semaines`.
   - Valider → vérifier que les nouvelles dates s'appliquent et que l'entrée apparaît dans l'**historique des reprogrammations** avec l'auteur, la date, l'ancien/nouveau calendrier et la justification.
2. **Gestion de l'Équipe d'Encadrement & Retrait de Collaborateur (B4, F5)** :
   - Aller dans l'onglet / section **Encadrement** du projet.
   - Ajouter des membres par fonction :
     - Conducteur de travaux (`CT`) : `test.ct@demo.ci`
     - Chef de chantier (`CC`) : `test.cc@demo.ci` avec la **Zone** : `Bâtiment Principal Bloc A`
     - Autre membre (`VI`) : `test.df@demo.ci` avec la **Fonction** (`fonction_membre`) : `Contrôleur Budgétaire`
   - **Tester l'unicité du Chef de Projet (CP)** : Désigner un autre CP → vérifier que l'ancien CP est automatiquement remplacé (un seul CP actif par projet).
   - **Tester le retrait d'un membre** :
     - Retirer `test.df@demo.ci` du projet → vérifier qu'il disparaît immédiatement de l'encadrement.
     - Tenter de retirer le **dernier Chef de Projet (CP)** → vérifier qu'une boîte de dialogue de confirmation explicite avertit que le projet n'aura plus de Chef de Projet avant d'exécuter le retrait.
     - Vérifier la règle d'auto-retrait : se connecter avec `test.ct@demo.ci` et vérifier qu'il **ne peut pas se retirer lui-même** du projet.
3. **Équipes de Chantier & Affectation aux Activités (B5, F6)** :
   - Aller dans la gestion des **Équipes** du projet.
   - Créer une équipe en régie :
     - Nom : `Équipe Coffrage & Ferraillage Nord`
     - Nature : `INTERNE` (ou Régie)
     - Chef d'équipe : `Kouassi Yao`
   - Créer une équipe sous-traitante :
     - Nom : `Brigade Électrique Diallo`
     - Nature : `SOUS_TRAITANT`
     - Tiers rattaché : `Diallo Électricité & Plomberie`
   - Ajouter des membres à l'équipe, puis **affecter l'équipe** à l'activité `ACT-101`. Recharger la page (`F5`) → vérifier que tout est persisté en base (zéro simulation).
4. **Carte d'Indice de Santé & Import Excel des Lots (F7)** :
   - Consulter la fiche de `CHANT-2026-001` (et `CHANT-2026-003`) : vérifier la **Carte d'Indice de Santé** (score sur 100, badge coloré, décomposition des pénalités avec jauges, explication textuelle et courbe d'évolution SVG).
   - Dans l'onglet Lots & Activités, cliquer sur **« Télécharger le modèle Excel »** → vérifier le téléchargement du fichier `.xlsx`.
   - Tester l'**Import Excel de lots** : importer un fichier valide → création atomique ; importer un fichier contenant une erreur (ex: dates hors projet ou budget dépassé) → vérifier l'affichage des erreurs détaillées ligne par ligne sans création partielle.

---

### SECTION 8 : Parcours 7 — Journal de Chantier, Saisie du Rapport, Signatures (CC → CT → CP), Relance & Synthèses (Lot 1)

Ce parcours teste le cœur opérationnel démontré au Sprint 4 sur le projet **`CHANT-2026-001` (« Résidence Les Jardins d'Angré »)** :

1. **Étape 1 — Rédaction et Soumission par le Chef de Chantier (`test.cc@demo.ci`)** :
   - Se connecter avec `test.cc@demo.ci` (qui possède `chantier.rediger`).
   - Aller sur `/rapports` puis cliquer sur **« Saisir un rapport »** (`/rapports/saisie`) pour `CHANT-2026-001`.
   - Vérifier que la préparation charge les lots (`LOT-01`, `LOT-02`) et leurs activités réelles.
   - **Valeurs exactes à saisir** :
     - Météo matin : `ENSOLEILLE` | Température : `29°C`
     - Effectif régie présent : `14` | Effectif tâcherons présent : `22`
     - Avancement des activités : saisir l'avancement du jour sur les activités de `LOT-01` et `LOT-02`.
     - Observations générales : `Coulage des poteaux du R+2 achevé. Livraison de 15 tonnes de ciment Sococim réceptionnée sans réserve.`
     - Points de blocage / Incidents : ajouter un blocage de niveau moyen ou laisser vide pour le rapport à valider.
   - Cliquer d'abord sur **« Enregistrer le brouillon »** → recharger la page (`F5`) → vérifier que le brouillon est relu depuis le serveur sans perte.
   - Cliquer ensuite sur **« Soumettre le rapport »** → vérifier que le statut passe à `SOUMIS` (« En attente de validation CT »).

2. **Étape 2 — Validation ou Rejet par le Conducteur de Travaux (`test.ct@demo.ci`)** :
   - Se connecter avec `test.ct@demo.ci` (qui possède `chantier.valider` et est affecté comme CT sur `CHANT-2026-001`).
   - Aller sur `/rapports` (Journal de chantier) → ouvrir le rapport soumis par le CC.
   - Vérifier que le **bandeau de signature CT** est visible en haut du rapport.
   - **Tester le Rejet (sur un rapport, ex. celui du 13/10 ou un second rapport)** :
     - Cliquer sur « Rejeter ».
     - *Cas d'erreur* : Saisir un motif de moins de 20 caractères (`Trop court`) → vérifier que le bouton de confirmation reste désactivé.
     - *Cas passant* : Saisir `Le pointage des équipes de coffrage sur le LOT-01 ne correspond pas au bon de présence journalier` (≥ 20 caractères) → confirmer → vérifier que le statut passe à `REJETE` avec le motif affiché au CC.
   - **Tester la Validation CT (sur le rapport du jour)** :
     - Ouvrir le rapport soumis, cliquer sur **« Valider (CT) »** avec un commentaire de validation → vérifier que le statut passe à `VALIDE_CT` et que la signature horodatée du CT apparaît dans le circuit.

3. **Étape 3 — Approbation Finale par le Chef de Projet (`test.cp@demo.ci`) & Règle d'encadrement du DG** :
   - *Test de sécurité (Règle de signature Lot 1 - 1.4)* : Se connecter avec le DG `test.dg@demo.ci` et ouvrir ce rapport de `CHANT-2026-001`. Comme le DG n'est ni CT ni CP sur `CHANT-2026-001`, vérifier qu'il **ne voit pas le bandeau de signature** et ne peut pas signer à leur place !
   - Se connecter avec le Chef de Projet **`test.cp@demo.ci`** (affecté comme CP sur `CHANT-2026-001`).
   - Ouvrir le rapport validé par le CT → vérifier que le bandeau d'approbation CP est visible.
   - Cliquer sur **« Approuver définitivement (CP) »** → recharger la page (`F5`) → vérifier le badge **« Approuvé CP »** et la présence des **3 signatures horodatées** (CC, CT, CP).

4. **Étape 4 — Relance d'un rapport manquant (Lot 1 - 1.5)** :
   - Se connecter avec `test.dg@demo.ci` (ou `test.ct@demo.ci`) sur `/rapports`.
   - Repérer une ligne de journal avec rapport manquant sur `CHANT-2026-001` → cliquer sur **« Relancer »**.
   - Vérifier l'affichage immédiat de « Relancé à HH:MM », recharger la page (`F5`) → vérifier que l'état relancé est conservé et qu'une seconde relance le même jour sur la même ligne est bloquée.

5. **Étape 5 — Synthèses Périodiques : Calcul, Rédaction CT & Décision CP (Lot 1 - 1.6)** :
   - Aller sur `/rapports/synthese`.
   - **Avec le Conducteur de Travaux (`test.ct@demo.ci`)** :
     - Sélectionner une semaine close (lundi → vendredi) ou un mois clos sur `CHANT-2026-001`.
     - Vérifier les agrégats calculés par le backend (effectifs, météo, avancement, rapports).
     - Rédiger l'analyse du CT dans le panneau `CircuitSynthese` : `Avancement conforme au planning prévisionnel malgré une journée de pluie. Vigilance sur l'approvisionnement acier.`
     - Enregistrer en brouillon (vérifier que tant qu'elle est en brouillon, le CP ne peut pas la signer), puis **Signer et soumettre la synthèse (CT)** (le calcul est alors figé).
   - **Avec le Chef de Projet (`test.cp@demo.ci`)** :
     - Ouvrir la même synthèse signée par le CT.
     - Tester d'abord le **Rejet CP** avec motif → le CT la corrige et la re-signe.
     - Tester ensuite l'**Approbation CP** → vérifier que la synthèse passe à l'état final approuvé et que toute réécriture est désormais refusée.
     - Sélectionner une **période personnalisée** → vérifier qu'elle se consulte mais ne propose pas de circuit de signature (seules les semaines et mois clos se signent).

---

### SECTION 9 : Parcours 8 — Vérification de l'Isolation par Rôle Métier (Matrice de Recette Multi-Profils)

Fournis un tableau récapitulatif et une checklist rapide permettant au testeur de se connecter successivement avec les autres profils de `Comptes_tests_locaux.txt` (`test.do@demo.ci`, `test.df@demo.ci`, `test.mag@demo.ci`, `test.bai@demo.ci`, `test.vi@demo.ci`) pour vérifier :
- Quels projets ils voient (portée `ENTREPRISE` vs portée `CHANTIER` limité à `CHANT-2026-001`).
- S'ils voient ou non les montants financiers (`projets.voir_montants` : oui pour DG/DF/CP/BAI selon leurs codes, non pour AD/CC/MAG).
- S'ils peuvent saisir ou valider un rapport journalier.
- Qu'aucune erreur `MISSING_MESSAGE` (traduction i18n manquante) ni erreur 500 n'apparaît dans la console du navigateur (`F12`).

---

### SECTION 10 : Fiche Récapitulative de Recette (Sign-off)

Termine le document par un tableau de validation finale (Lot / Module | Statut Passé/Échoué | Observations du testeur | Date & Signature) pour que l'équipe puisse utiliser directement ce fichier `.md` comme procès-verbal de recette fonctionnelle avant la Sprint Review.

---

**RAPPEL FINAL POUR GEMINI 3.8 FLASH :**
1. Lis `C:\Users\Administrator\Desktop\Comptes_tests_locaux.txt`.
2. Lis `C:\Users\Administrator\Desktop\SOUMAFE\Gestion_Chantier\05_Developpement\Application-Gestion-Chantier\docs\plan_alignement_api.md`.
3. Crée immédiatement `C:\Users\Administrator\Desktop\Guide_Tests_Fonctionnels_CCD_Digital.md` avec `write_to_file` en développant intégralement chacune des 10 sections ci-dessus sans rien abréger.
4. Confirme dans le chat que le fichier est créé sur le Bureau.

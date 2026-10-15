# features/projets

Module Projets — hooks, requêtes, types, règles et composants du domaine Projets.
Miroir de `apps/projets/` côté backend.

La modification des dates après fixation passe obligatoirement par la reprogrammation journalisée (motif et justification requis pour le projet, les lots et les activités).
Les budgets respectent une contrainte d'enveloppe pyramidale stricte : la somme des budgets des activités d'un lot ne peut excéder le budget du lot, et la somme des budgets des lots ne peut excéder le budget total du projet.
Les équipes, encadrements, affectations et membres sont réels et persistés sur l'API backend.

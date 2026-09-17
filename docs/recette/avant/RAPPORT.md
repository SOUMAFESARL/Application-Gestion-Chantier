# Recette visuelle — avant

Base : http://demo.localhost:3002
Date : 2026-09-17T08:45:16.608Z
Largeurs : 1440, 768, 390

## Ecrans non captures automatiquement

**Cause unique : `admin@demo.ci` / `Demo1234!` renvoie 401 sur
`demo.localhost:8000/api/v1/auth/token/`.** Le script pilote correctement le
formulaire ; seuls les identifiants manquent. Relancer avec un compte valide
capture les 27 manquants d'un coup :

```
npm run recette:capture -- --base=http://demo.localhost:3002 --email=... --motdepasse=...
```

Le lot 0 a ete marque termine avec cette lacune assumee (voir
`docs/plan_refont.md` §8).


- 1440/09-configuration-1-entreprise : page.waitForURL: Timeout 20000ms exceeded.
- 1440/10-configuration-2-projet : page.waitForURL: Timeout 20000ms exceeded.
- 1440/11-configuration-3-equipe : page.waitForURL: Timeout 20000ms exceeded.
- 1440/12-configuration-4-confirmation : page.waitForURL: Timeout 20000ms exceeded.
- 1440/13-tableau-de-bord : page.waitForURL: Timeout 20000ms exceeded.
- 1440/14-projets : page.waitForURL: Timeout 20000ms exceeded.
- 1440/15-projet-detail : page.waitForURL: Timeout 20000ms exceeded.
- 1440/16-parametres-roles : page.waitForURL: Timeout 20000ms exceeded.
- 1440/17-parametres-utilisateurs : page.waitForURL: Timeout 20000ms exceeded.
- 768/09-configuration-1-entreprise : page.waitForURL: Timeout 20000ms exceeded.
- 768/10-configuration-2-projet : page.waitForURL: Timeout 20000ms exceeded.
- 768/11-configuration-3-equipe : page.waitForURL: Timeout 20000ms exceeded.
- 768/12-configuration-4-confirmation : page.waitForURL: Timeout 20000ms exceeded.
- 768/13-tableau-de-bord : page.waitForURL: Timeout 20000ms exceeded.
- 768/14-projets : page.waitForURL: Timeout 20000ms exceeded.
- 768/15-projet-detail : page.waitForURL: Timeout 20000ms exceeded.
- 768/16-parametres-roles : page.waitForURL: Timeout 20000ms exceeded.
- 768/17-parametres-utilisateurs : page.waitForURL: Timeout 20000ms exceeded.
- 390/09-configuration-1-entreprise : page.waitForURL: Timeout 20000ms exceeded.
- 390/10-configuration-2-projet : page.waitForURL: Timeout 20000ms exceeded.
- 390/11-configuration-3-equipe : page.waitForURL: Timeout 20000ms exceeded.
- 390/12-configuration-4-confirmation : page.waitForURL: Timeout 20000ms exceeded.
- 390/13-tableau-de-bord : page.waitForURL: Timeout 20000ms exceeded.
- 390/14-projets : page.waitForURL: Timeout 20000ms exceeded.
- 390/15-projet-detail : page.waitForURL: Timeout 20000ms exceeded.
- 390/16-parametres-roles : page.waitForURL: Timeout 20000ms exceeded.
- 390/17-parametres-utilisateurs : page.waitForURL: Timeout 20000ms exceeded.

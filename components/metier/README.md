# components/metier

Composants propres au BTP et au marché visé : ce qui ne se trouverait pas dans
une bibliothèque générique parce que la règle métier ou la géographie s'y
mélange à l'interface.

| Composant | Ce qu'il fait | Ce qu'il faut savoir |
|---|---|---|
| `BadgeEssai` | Le compteur de jours d'essai | Passe en alerte sous 7 jours |
| `ChampsMotDePasse` | Saisie et confirmation d'un mot de passe | Porte les règles du Socle §2.1 |
| `ChampTelephone` | Numéro avec indicatif et drapeau | **Stocke `+2250700000000`, affiche « 07 00 00 00 00 »** |
| `Drapeau` | Les neuf drapeaux, en SVG | Décoratif : `aria-hidden`, le nom du pays est toujours écrit à côté |
| `SelecteurVille` | Choix d'une localité dans un pays | La liste **suit le pays de l'entreprise** ; option de saisie libre toujours présente |

## Les deux règles que ces composants portent

**Un numéro de téléphone se range en international.** Un numéro local ne veut
rien dire dès qu'une entreprise travaille dans deux pays, et le lien WhatsApp
que le serveur construit (`wa.me/<chiffres>`) est un lien mort sans indicatif.
La mise en forme est un confort d'affichage — elle ne se stocke pas.

**Une liste de villes suit un pays, et ce pays vient du serveur.** Il est choisi
à l'inscription et ne se modifie pas depuis l'application. Les listes sont dans
`features/referentiels/` : `villes.ts` est **généré** depuis le référentiel
Python, `telephone.ts` est écrit à la main. Les deux sont fermés aux **neuf pays
de l'inscription** — une liste de pays qui diverge de l'autre laisse quelqu'un
devant un champ qui ne propose pas le sien.

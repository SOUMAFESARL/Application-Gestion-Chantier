import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";

import { SIMULATION_ACTIVE } from "@/lib/api/simulation";

/**
 * Bandeau « données simulées » — exigence du guide frontend §8.
 *
 * > « Un écran non branché sur de vraies données porte un bandeau visible.
 * > Aucun jeu de données d'exemple ne doit pouvoir passer pour réel en
 * > démonstration devant un prospect. »
 *
 * **Il ne reste qu'un écran dans ce cas, et il n'y est plus qu'à moitié.**
 * Depuis DEV-11 (03/09/2026), le configurateur enregistre pour de vrai son
 * avancement — `GET /configuration/`, `valider`, `passer`, `terminer`. Ce qui
 * reste simulé, ce sont les **saisies** : l'entreprise, le premier projet et
 * les invitations, dont les endpoints appartiennent aux modules métier
 * (`POST /tiers/`, `POST /projets/`, `POST /invitations/`) et au récapitulatif
 * du §7, non spécifié.
 *
 * *Le libellé du bandeau a donc changé avec le périmètre.* Un bandeau qui reste
 * en place pendant que ce qu'il décrit rétrécit devient faux sans que personne
 * ne le touche — et c'est la deuxième fois qu'il faut le reprendre.
 *
 * *Il en couvrait cinq. L'inscription, l'activation et les deux écrans de mot
 * de passe l'ont porté quelques jours de trop : leurs endpoints existent
 * désormais, et le bandeau affirmait à côté d'eux que « rien n'est enregistré,
 * aucun email n'est envoyé » — alors qu'une demande, un schéma PostgreSQL et un
 * email partaient bel et bien.*
 *
 * **Un bandeau qui ment dans ce sens-là est pire que pas de bandeau.** La règle
 * du §8 existe pour qu'aucune donnée simulée ne passe pour réelle ; laisser du
 * réel passer pour simulé fait exactement le même dégât, à l'envers — on
 * n'ajoute pas un avertissement, on retire la confiance qu'on peut lui faire.
 *
 * Le bandeau disparaît de lui-même dès que `NEXT_PUBLIC_API_SIMULE` passe à
 * `0` — il n'y a rien à retirer à la main, donc rien à oublier de retirer.
 */
/**
 * *Le bandeau du back-office a ete retire a la demande du proprietaire du
 * produit.* Il occupait le haut de chaque ecran d'administration, connexion
 * comprise, pour y repeter un fait que ces ecrans n'ont pas a porter devant
 * l'agent qui s'y connecte. Il ne reste donc qu'un seul texte, celui du
 * configurateur — et plus de prop `contexte` : un parametre a une seule
 * valeur possible ne decrit plus rien.
 */
export function BandeauSimulation() {
  const t = useTranslations("simulation");

  if (!SIMULATION_ACTIVE) return null;

  return (
    // Volontairement visible : c'est tout son interet.
    <div
      className="flex items-center justify-center gap-2 border-b border-avertissement bg-avertissement-fond px-4 py-2 text-center text-xs leading-tight text-avertissement [&_strong]:font-bold"
      role="status"
    >
      <FlaskConical size={16} aria-hidden="true" />
      <span>
        {t.rich("avertissement", { fort: (morceaux) => <strong>{morceaux}</strong> })}
      </span>
    </div>
  );
}

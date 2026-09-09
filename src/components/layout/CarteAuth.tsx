import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { MarqueCCD } from "./MarqueCCD";
import styles from "./CarteAuth.module.css";

/**
 * Le cadre commun aux écrans hors application — maquettes M1, M2, M3, M6, M8.
 *
 * Connexion, inscription, activation et réinitialisation partagent exactement
 * la même carte : marque en tête, contenu, mention de confidentialité en pied.
 * Elle était écrite une fois dans l'écran de connexion ; à partir du deuxième
 * écran, la recopier garantissait que les quatre divergeraient — c'est le
 * moment où l'extraction se justifie, pas avant (guide frontend §4).
 *
 * **Une seule structure pour les deux cadres de la maquette.** Sur téléphone,
 * la marque coiffe un écran blanc à plat ; au-delà de 1024 px elle devient une
 * barre qui surmonte un fond neutre, où la carte se détache. Le DOM ne change
 * pas — seul l'habillage change, dans la feuille de style.
 *
 * C'est ce qui évite de rendre la marque **deux fois** pour la « déplacer » :
 * deux bannières, dont une masquée en CSS, sont deux bannières pour un lecteur
 * d'écran.
 */
export function CarteAuth({ children }: { children: ReactNode }) {
  const t = useTranslations("marque");

  return (
    <div className={styles.page}>
      <header className={styles.barre}>
        <MarqueCCD taille={32} />
      </header>

      <main className={styles.zone}>
        <div className={styles.carte}>
          {children}

          <footer className={styles.pied}>
            {t("pied")}
            <br />
            {t("confidentiel")}
          </footer>
        </div>
      </main>
    </div>
  );
}

/** Titre principal de l'écran. Un seul `h1` par page. */
export function TitreAuth({ children }: { children: ReactNode }) {
  return <h1 className={styles.titre}>{children}</h1>;
}

/** Phrase d'accroche sous le titre. */
export function AccrocheAuth({ children }: { children: ReactNode }) {
  return <p className={styles.accroche}>{children}</p>;
}

/**
 * Bloc centré des écrans de confirmation — M8 écrans 2, 4 et 6.
 * La pastille porte l'icône ; le texte reste lisible seul (charte §8.4).
 */
export function BlocCentre({
  pastille,
  ton = "primaire",
  children,
}: {
  pastille: ReactNode;
  ton?: "primaire" | "succes" | "avertissement";
  children: ReactNode;
}) {
  return (
    <div className={styles.centre}>
      <span className={`${styles.pastille} ${styles[ton]}`} aria-hidden="true">
        {pastille}
      </span>
      {children}
    </div>
  );
}

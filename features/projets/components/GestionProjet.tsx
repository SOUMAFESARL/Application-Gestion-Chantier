"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { CLE_LISTE_PROJETS, cleProjet } from "@/features/projets/cles";
import type { Projet } from "@/features/projets/types";

import { ModaleSuspensionProjet } from "./ModaleSuspensionProjet";
import { TiroirCreationProjet } from "./TiroirCreationProjet";

/**
 * Les deux gestes qu'on fait sur un projet existant — le modifier, le
 * suspendre ou le reprendre — pour la liste comme pour la fiche.
 *
 * Réunis ici parce que les deux écrans doivent laisser **le même cache**
 * dans le même état après coup : le projet modifié est posé dans la liste et
 * dans sa fiche avant que le rechargement ne confirme. Deux copies de cette
 * mise à jour finiraient par n'en actualiser qu'un.
 *
 * `modaux` est à rendre une fois dans l'écran : un seul tiroir et une seule
 * modale, quel que soit le nombre de lignes qui les ouvrent.
 */
export function useGestionProjet() {
  const clientRequetes = useQueryClient();

  /**
   * `rang` sert de `key` au tiroir : il est remonté à chaque ouverture et
   * repart des valeurs actuelles du projet. `ouverte` le laisse monté le
   * temps de son animation de fermeture.
   */
  const [modification, setModification] = useState<{
    projet: Projet;
    ouverte: boolean;
    rang: number;
  } | null>(null);
  const [suspension, setSuspension] = useState<Projet | null>(null);

  const actualiser = useCallback(
    (projet: Projet) => {
      clientRequetes.setQueryData(cleProjet(projet.id), projet);
      clientRequetes.setQueryData<Projet[]>(CLE_LISTE_PROJETS, (anciens) =>
        anciens?.map((ancien) => (ancien.id === projet.id ? projet : ancien)),
      );
      void clientRequetes.invalidateQueries({ queryKey: CLE_LISTE_PROJETS });
      void clientRequetes.invalidateQueries({ queryKey: cleProjet(projet.id) });
    },
    [clientRequetes],
  );

  const modifier = useCallback((projet: Projet) => {
    setModification((courante) => ({ projet, ouverte: true, rang: (courante?.rang ?? 0) + 1 }));
  }, []);

  const basculerSuspension = useCallback((projet: Projet) => setSuspension(projet), []);

  const modaux = (
    <>
      {modification && (
        <TiroirCreationProjet
          key={modification.rang}
          projet={modification.projet}
          ouverte={modification.ouverte}
          onFermer={() => setModification((courante) => courante && { ...courante, ouverte: false })}
          onProjetModifie={actualiser}
        />
      )}
      <ModaleSuspensionProjet
        projet={suspension}
        onFermer={() => setSuspension(null)}
        onTermine={actualiser}
      />
    </>
  );

  return { modifier, basculerSuspension, modaux };
}

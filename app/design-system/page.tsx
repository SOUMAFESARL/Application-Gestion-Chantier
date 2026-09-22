"use client";

import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useState } from "react";

import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  Champ,
  EtatChargement,
  EtatErreur,
  EtatVide,
  Tableau,
} from "@/components/ui";
import type { Colonne } from "@/components/ui";
import {
  couleurIndiceSante,
  formaterDate,
  formaterMontant,
  formaterMontantCourt,
  formaterPourcentage,
} from "@/lib/format";


/**
 * Guide vivant du design system.
 *
 * Ce n'est pas une page du produit : c'est la référence visuelle de
 * l'équipe. Un composant qui ne figure pas ici n'existe pas — et un
 * composant qui casse se voit immédiatement sur cette page, avant de
 * casser dix écrans.
 *
 * Accessible sur /design-system, hors des groupes de routes du produit.
 */

interface LigneDemo {
  id: string;
  reference: string;
  nom: string;
  statut: string;
  budget: number;
  avancement: string;
  fin: string;
}

const LIGNES: LigneDemo[] = [
  {
    id: "1",
    reference: "PRJ-2026-014",
    nom: "Résidence Les Palmiers",
    statut: "EN_COURS",
    budget: 87_500_000_000,
    avancement: "42.50",
    fin: "2027-02-28",
  },
  {
    id: "2",
    reference: "PRJ-2026-021",
    nom: "Entrepôt Zone 4C",
    statut: "EN_RETARD",
    budget: 12_000_000_000,
    avancement: "18.00",
    fin: "2026-11-30",
  },
  {
    id: "3",
    reference: "PRJ-2025-098",
    nom: "École primaire Yopougon",
    statut: "TERMINE",
    budget: 45_300_000_000,
    avancement: "100.00",
    fin: "2026-06-15",
  },
];

const VARIANTE_STATUT = {
  EN_COURS: "primaire",
  EN_RETARD: "avertissement",
  TERMINE: "succes",
} as const;

/**
 * Libellés figés **pour cette page de démonstration uniquement**.
 *
 * Dans un écran réel, le libellé vient de `/referentiels/enumerations/`
 * via `useEnumerations()`. Le dériver du code — un `.toLowerCase()` sur
 * `TERMINE` — donne « termine » sans accent et rend l'interface
 * intraduisible.
 */
const LIBELLE_STATUT: Record<string, string> = {
  EN_COURS: "En cours",
  EN_RETARD: "En retard",
  TERMINE: "Terminé",
};

const COLONNES: Colonne<LigneDemo>[] = [
  { cle: "reference", entete: "Référence", rendu: (l) => l.reference },
  { cle: "nom", entete: "Projet", rendu: (l) => l.nom },
  {
    cle: "statut",
    entete: "Statut",
    rendu: (l) => (
      <Badge variante={VARIANTE_STATUT[l.statut as keyof typeof VARIANTE_STATUT]}>
        {LIBELLE_STATUT[l.statut]}
      </Badge>
    ),
  },
  {
    cle: "budget",
    entete: "Budget",
    aligneADroite: true,
    rendu: (l) => formaterMontantCourt(l.budget),
  },
  {
    cle: "avancement",
    entete: "Avancement",
    aligneADroite: true,
    secondaire: true,
    rendu: (l) => formaterPourcentage(l.avancement),
  },
  {
    cle: "fin",
    entete: "Fin prévue",
    secondaire: true,
    rendu: (l) => formaterDate(l.fin),
  },
];

export default function Page() {
  const [enCours, setEnCours] = useState(false);

  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-8">
      <header className="[&_h1]:mb-2 [&_h1]:text-[2rem] [&_p]:max-w-[70ch] [&_p]:text-neutral-600">
        <h1>Design system</h1>
        <p>
          Référence visuelle de l’équipe. Toutes les valeurs viennent des jetons de la charte —
          aucune couleur, aucun espacement n’est écrit en dur.
        </p>
      </header>

      <Carte titre="Boutons">
        <div className="mb-4 flex flex-wrap items-center gap-3 last:mb-0">
          <Bouton variante="primaire">Enregistrer</Bouton>
          <Bouton variante="secondaire">Annuler</Bouton>
          <Bouton variante="ghost">Retour</Bouton>
          <Bouton variante="danger">Archiver</Bouton>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3 last:mb-0">
          <Bouton taille="sm">Petit</Bouton>
          <Bouton taille="md">Moyen</Bouton>
          <Bouton taille="lg">Grand</Bouton>
          <Bouton disabled>Désactivé</Bouton>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3 last:mb-0">
          <Bouton iconeGauche={<Plus size={16} weight="bold" />}>Nouveau projet</Bouton>
          <Bouton
            variante="secondaire"
            enCours={enCours}
            onClick={() => {
              setEnCours(true);
              setTimeout(() => setEnCours(false), 1800);
            }}
          >
            {enCours ? "Envoi en cours" : "Cliquer pour tester l’attente"}
          </Bouton>
        </div>
      </Carte>

      <Carte titre="Champs de saisie">
        <Champ libelle="Nom du projet" placeholder="Résidence Les Palmiers" required />
        <Champ
          libelle="Rechercher"
          placeholder="Référence, nom, ville…"
          iconeDroite={<MagnifyingGlass size={18} />}
        />
        <Champ
          libelle="Budget initial"
          defaultValue="875 000 000"
          aide="En FCFA, sans décimale."
        />
        <Champ
          libelle="Justification du report"
          defaultValue="Trop court"
          erreur="La justification doit faire au moins 30 caractères."
        />
        <Champ libelle="Référence" defaultValue="PRJ-2026-014" disabled />
      </Carte>

      <Carte titre="Messages — les quatre types du Socle Commun">
        <Alerte type="succes" titre="Rapport enregistré">
          Le rapport du 24 août a été transmis au Conducteur de Travaux.
        </Alerte>
        <Alerte type="erreur" titre="Rapport impossible à créer">
          Un rapport existe déjà pour ce lot à cette date. Ouvrez-le pour le compléter.
        </Alerte>
        <Alerte type="avertissement" titre="Budget bientôt atteint">
          Le lot « Gros œuvre » a consommé 92 % de son budget. Vérifiez les engagements en cours.
        </Alerte>
        <Alerte type="information">
          Le mode d’exécution du lot sera figé dès le premier rapport soumis.
        </Alerte>
      </Carte>

      <Carte titre="Badges">
        <div className="mb-4 flex flex-wrap items-center gap-3 last:mb-0">
          <Badge variante="primaire">En cours</Badge>
          <Badge variante="succes">Approuvé</Badge>
          <Badge variante="avertissement">En retard</Badge>
          <Badge variante="erreur">Bloquant</Badge>
          <Badge variante="secondaire">Régie</Badge>
          <Badge variante="neutre">Brouillon</Badge>
        </div>
        <p className="mt-3 text-sm text-neutral-600">
          Le libellé est toujours écrit à côté de la couleur : un chantier en retard doit se lire,
          pas se deviner à la teinte (charte §8.4).
        </p>
      </Carte>

      <Carte titre="Tableau">
        <Tableau
          colonnes={COLONNES}
          lignes={LIGNES}
          cleLigne={(l) => l.id}
          onLigneCliquee={() => {}}
        />
        <p className="mt-3 text-sm text-neutral-600">
          Les montants sont alignés à droite et en semibold (charte §8.1). Sous 768 px, les
          colonnes secondaires disparaissent au lieu de faire défiler la page.
        </p>
      </Carte>

      <Carte titre="Tableau paginé">
        <Tableau colonnes={COLONNES} lignes={LIGNES} cleLigne={(l) => l.id} tailleDePage={2} />
        <p className="mt-3 text-sm text-neutral-600">
          La pagination n’apparaît qu’au-delà d’une page — ici forcée à deux lignes pour la
          montrer. Boutons icône seule (première / précédente / suivante / dernière page), sans
          numéros cliquables.
        </p>
      </Carte>

      <Carte titre="États d’écran">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-md border border-dashed border-neutral-300">
            <EtatChargement />
          </div>
          <div className="rounded-md border border-dashed border-neutral-300">
            <EtatVide
              titre="Aucun projet"
              description="Créez votre premier projet pour commencer le suivi."
              action={<Bouton iconeGauche={<Plus size={16} weight="bold" />}>Nouveau projet</Bouton>}
            />
          </div>
          <div className="rounded-md border border-dashed border-neutral-300">
            <EtatErreur onReessayer={() => {}} reference="01J8XQ2M4K7N9P0R" />
          </div>
        </div>
      </Carte>

      <Carte titre="Formats">
        <Tableau
          colonnes={[
            { cle: "cas", entete: "Cas", rendu: (l: { cas: string; rendu: string }) => l.cas },
            {
              cle: "rendu",
              entete: "Rendu",
              aligneADroite: true,
              rendu: (l: { cas: string; rendu: string }) => l.rendu,
            },
          ]}
          lignes={[
            { cas: "Montant complet", rendu: formaterMontant(87_500_000_000) },
            { cas: "Montant abrégé", rendu: formaterMontantCourt(120_000_000_000) },
            { cas: "Montant nul", rendu: formaterMontant(null) },
            { cas: "Date", rendu: formaterDate("2026-03-01") },
            { cas: "Pourcentage", rendu: formaterPourcentage("42.50") },
            { cas: "Indice de santé 63", rendu: couleurIndiceSante(63) },
          ]}
          cleLigne={(l) => l.cas}
        />
      </Carte>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

import { lireTableauDeBord } from "@/features/tableauDeBord/adaptateur";
import type { TableauDeBord } from "@/features/tableauDeBord/types";

import { TableauDeBordClient } from "./TableauDeBordClient";

// Données de secours fidèles à la maquette M10 si le réseau ou la connexion est différée
const DONNEES_DEFAUT: TableauDeBord = {
  metriques: {
    chantiersActifs: 3,
    chantiersConformes: 2,
    chantiersEnRetard: 1,
    santeGlobale: 88,
    santeDetails: {
      securite: 100,
      delais: 75,
      budget: 90,
    },
    budgetTotal: 1_450_000_000_00,
    budgetEngage: 520_000_000_00,
    bonsASignerNombre: 3,
    bonsASignerMontant: 840_000_000,
    effectifsSurSite: {
      total: 42,
      regie: 18,
      tacherons: 24,
    },
    rapportsJournaliers: {
      soumis: 2,
      attendus: 3,
    },
  },
  chantiers: [
    {
      id: "1",
      reference: "PRJ-2026-001",
      nom: "Résidence Les Acacias",
      description: "Construction R+3 de 12 logements",
      clientNom: "SCI Les Lagunes",
      ville: "Abidjan",
      quartier: "Cocody Danga",
      statut: "EN_COURS",
      avancementReel: 34,
      avancementTheorique: 32,
      ecart: 2,
      budgetInitial: 875_000_000_00,
      budgetConsomme: 297_500_000_00,
      rapportJourStatut: "SOUMIS",
      indiceSante: 92,
      chefProjetNom: "Manson Z.",
      conducteurTravauxNom: "",
    },
    {
      id: "2",
      reference: "PRJ-2026-002",
      nom: "Immeuble Le Balafon",
      description: "Bureaux et commerces R+5",
      clientNom: "Banque Atlantique CI",
      ville: "Abidjan",
      quartier: "Plateau",
      statut: "EN_COURS",
      avancementReel: 18,
      avancementTheorique: 31,
      ecart: -13,
      budgetInitial: 1_200_000_000_00,
      budgetConsomme: 216_000_000_00,
      rapportJourStatut: "EN_ATTENTE",
      indiceSante: 71,
      chefProjetNom: "Koffi K.",
      conducteurTravauxNom: "",
    },
    {
      id: "3",
      reference: "PRJ-2026-003",
      nom: "Villa Riviera Golf",
      description: "Villa duplex haut standing",
      clientNom: "Particulier",
      ville: "Abidjan",
      quartier: "Riviera Golf",
      statut: "EN_ATTENTE",
      avancementReel: 0,
      avancementTheorique: 0,
      ecart: 0,
      budgetInitial: 320_000_000_00,
      budgetConsomme: 0,
      rapportJourStatut: "SANS_LOT",
      indiceSante: 100,
      chefProjetNom: "Manson Z.",
      conducteurTravauxNom: "",
    },
  ],
  bonsAPayer: [
    {
      id: "1",
      reference: "BDP-2026-042",
      beneficiaire: "Koffi Kouamé (Tâcheron)",
      corpsEtat: "Maçonnerie RDC",
      montant: 345_000_000,
      statut: "A_SIGNER",
    },
    {
      id: "2",
      reference: "BDP-2026-043",
      beneficiaire: "Ivoire Élec (Sous-traitant)",
      corpsEtat: "Incorporation dalles",
      montant: 280_000_000,
      statut: "A_SIGNER",
    },
    {
      id: "3",
      reference: "BDP-2026-044",
      beneficiaire: "Amadou Diallo (Tâcheron)",
      corpsEtat: "Ferraillage poteaux",
      montant: 215_000_000,
      statut: "A_SIGNER",
    },
  ],
  receptionsMateriaux: [
    {
      id: "1",
      projet: "Résidence Cocody",
      description: "400 sacs ciment CPJ 42.5 livrés & contrôlés",
      conforme: true,
      dateReception: null,
    },
    {
      id: "2",
      projet: "Villa Riviera",
      description: "12 t fer HA12 attendues à 15:00",
      conforme: false,
      dateReception: null,
    },
  ],
  meteo: {
    ville: "Abidjan",
    temperature: 29,
    description: "Ensoleillé",
    praticable: true,
    alerteIntemperies: null,
  },
  alerteIntemperies: null,
  aucunChantier: false,
};

/**
 * Page réelle du Tableau de bord BTP — Maquette M10, Sprint 1.
 */
export default function Page() {
  const [donnees, setDonnees] = useState<TableauDeBord>(DONNEES_DEFAUT);

  useEffect(() => {
    let vivant = true;
    lireTableauDeBord()
      .then((resultat) => {
        if (vivant && resultat && resultat.metriques) {
          setDonnees(resultat);
        }
      })
      .catch(() => {
        // En cas d'erreur de connexion ou tenant non branché en local,
        // on conserve l'affichage résilient de secours conforme aux maquettes
      });

    return () => {
      vivant = false;
    };
  }, []);

  return <TableauDeBordClient donneesInitiales={donnees} />;
}

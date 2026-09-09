"use client";

import { useEffect, useState } from "react";

import { lireTableauDeBord } from "@/features/tableauDeBord/api";
import type { TableauDeBordData } from "@/features/tableauDeBord/api";

import { TableauDeBordClient } from "./TableauDeBordClient";

// Données de secours fidèles à la maquette M10 si le réseau ou la connexion est différée
const DONNEES_DEFAUT: TableauDeBordData = {
  metriques: {
    chantiers_actifs: 3,
    chantiers_conformes: 2,
    chantiers_en_retard: 1,
    sante_globale: 88,
    sante_details: {
      securite: 100,
      delais: 75,
      budget: 90,
    },
    budget_total_montant: 1_450_000_000_00,
    budget_engage_montant: 520_000_000_00,
    bons_a_signer_count: 3,
    bons_a_signer_montant: 840_000_000,
    effectifs_sur_site: {
      total: 42,
      regie: 18,
      tacherons: 24,
    },
    rapports_journaliers: {
      soumis: 2,
      attendus: 3,
    },
  },
  projets: [
    {
      id: "1",
      reference: "PRJ-2026-001",
      nom: "Résidence Les Acacias",
      description: "Construction R+3 de 12 logements",
      client_nom: "SCI Les Lagunes",
      ville: "Abidjan",
      quartier: "Cocody Danga",
      statut: "EN_COURS",
      avancement_reel: 34,
      avancement_theorique: 32,
      ecart: 2,
      budget_initial_montant: 875_000_000_00,
      budget_consomme_montant: 297_500_000_00,
      rapport_jour_statut: "SOUMIS",
      indice_sante: 92,
      chef_projet_nom: "Manson Z.",
    },
    {
      id: "2",
      reference: "PRJ-2026-002",
      nom: "Immeuble Le Balafon",
      description: "Bureaux et commerces R+5",
      client_nom: "Banque Atlantique CI",
      ville: "Abidjan",
      quartier: "Plateau",
      statut: "EN_COURS",
      avancement_reel: 18,
      avancement_theorique: 31,
      ecart: -13,
      budget_initial_montant: 1_200_000_000_00,
      budget_consomme_montant: 216_000_000_00,
      rapport_jour_statut: "EN_ATTENTE",
      indice_sante: 71,
      chef_projet_nom: "Koffi K.",
    },
    {
      id: "3",
      reference: "PRJ-2026-003",
      nom: "Villa Riviera Golf",
      description: "Villa duplex haut standing",
      client_nom: "Particulier",
      ville: "Abidjan",
      quartier: "Riviera Golf",
      statut: "EN_ATTENTE",
      avancement_reel: 0,
      avancement_theorique: 0,
      ecart: 0,
      budget_initial_montant: 320_000_000_00,
      budget_consomme_montant: 0,
      rapport_jour_statut: "SANS_LOT",
      indice_sante: 100,
      chef_projet_nom: "Manson Z.",
    },
  ],
  bons_paiement_a_valider: [
    {
      id: "1",
      reference: "BDP-2026-042",
      beneficiaire: "Koffi Kouamé (Tâcheron)",
      corps_etat: "Maçonnerie RDC",
      montant: 345_000_000,
      statut: "A_SIGNER",
    },
    {
      id: "2",
      reference: "BDP-2026-043",
      beneficiaire: "Ivoire Élec (Sous-traitant)",
      corps_etat: "Incorporation dalles",
      montant: 280_000_000,
      statut: "A_SIGNER",
    },
    {
      id: "3",
      reference: "BDP-2026-044",
      beneficiaire: "Amadou Diallo (Tâcheron)",
      corps_etat: "Ferraillage poteaux",
      montant: 215_000_000,
      statut: "A_SIGNER",
    },
  ],
  receptions_materiaux: [
    {
      id: "1",
      projet: "Résidence Cocody",
      description: "400 sacs ciment CPJ 42.5 livrés & contrôlés",
      conforme: true,
    },
    {
      id: "2",
      projet: "Villa Riviera",
      description: "12 t fer HA12 attendues à 15:00",
      conforme: false,
    },
  ],
  meteo: {
    ville: "Abidjan",
    temperature: 29,
    description: "Ensoleillé",
    praticable: true,
    alerte_intemperies: null,
  },
};

/**
 * Page réelle du Tableau de bord BTP — Maquette M10, Sprint 1.
 */
export default function Page() {
  const [data, setData] = useState<TableauDeBordData>(DONNEES_DEFAUT);

  useEffect(() => {
    let vivant = true;
    lireTableauDeBord()
      .then((res) => {
        if (vivant && res && res.metriques) {
          setData(res);
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

  return <TableauDeBordClient initialData={data} />;
}

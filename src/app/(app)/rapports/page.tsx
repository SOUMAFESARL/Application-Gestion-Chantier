"use client";

import {
  Calendar,
  CaretDown,
  CheckCircle,
  Clock,
  CloudLightning,
  CloudRain,
  CloudSun,
  DownloadSimple,
  Eye,
  FileText,
  HardHat,
  Info,
  Package,
  Plus,
  Printer,
  Sparkle,
  Sun,
  Thermometer,
  Trash,
  Users,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import {
  enregistrerRapportJournalier,
  obtenirProjetsChantier,
  obtenirRapportsJournaliers,
} from "@/features/rapports/api";
import {
  ImpactMeteo,
  LigneMateriau,
  LignePresence,
  MeteoType,
  RapportJournalierData,
} from "@/features/rapports/types";
import { ProjetOption } from "@/features/rapports/mockData";

import styles from "./page.module.css";

export default function PageJournalChantier() {
  const [vue, setVue] = useState<"SAISIE" | "HISTORIQUE">("SAISIE");
  const [projets, setProjets] = useState<ProjetOption[]>([]);
  const [rapports, setRapports] = useState<RapportJournalierData[]>([]);
  const [rapportSelectionne, setRapportSelectionne] = useState<RapportJournalierData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // --- Formulaire de Saisie Quotidienne ---
  const [projetId, setProjetId] = useState("");
  const [lotId, setLotId] = useState("");
  const [dateRapport, setDateRapport] = useState(new Date().toISOString().split("T")[0]);
  const [auteurNom, setAuteurNom] = useState("Mamadou Traoré");
  const [auteurRole, setAuteurRole] = useState("Chef de Chantier");

  // Météo
  const [conditionMeteo, setConditionMeteo] = useState<MeteoType>("ENSOLEILLE");
  const [temperature, setTemperature] = useState(30);
  const [impactMeteo, setImpactMeteo] = useState<ImpactMeteo>("AUCUN");
  const [heuresIntemperies, setHeuresIntemperies] = useState(0);
  const [commentaireMeteo, setCommentaireMeteo] = useState("");

  // Présences
  const [presences, setPresences] = useState<LignePresence[]>([
    {
      id: "p-1",
      categorie: "REGIE",
      corpsMetier: "Maçons & Coffreurs",
      effectif: 12,
      heuresTravaillees: 8,
      remarques: "Coulage poteaux et voiles",
    },
    {
      id: "p-2",
      categorie: "REGIE",
      corpsMetier: "Ferrailleurs",
      effectif: 6,
      heuresTravaillees: 8,
      remarques: "Ferraillage poutres plancher haut",
    },
    {
      id: "p-3",
      categorie: "SOUS_TRAITANT",
      corpsMetier: "Plombiers",
      entrepriseSousTraitante: "SANIBAT CI",
      effectif: 3,
      heuresTravaillees: 7,
      remarques: "Passage tuyauteries évacuations",
    },
    {
      id: "p-4",
      categorie: "ENCADREMENT",
      corpsMetier: "Chef de Chantier",
      effectif: 1,
      heuresTravaillees: 8,
    },
  ]);

  // Matériaux
  const [materiaux, setMateriaux] = useState<LigneMateriau[]>([
    {
      id: "m-1",
      designation: "Ciment CPJ 42.5",
      quantite: 120,
      unite: "Sacs (50kg)",
      fournisseur: "CIMAF Côte d'Ivoire",
      numeroBL: "BL-2026-883",
      etatConformite: "CONFORME",
      heureReception: "08:15",
    },
    {
      id: "m-2",
      designation: "Sable fin lagunaire",
      quantite: 15,
      unite: "m³",
      fournisseur: "Carrière Lagunaire Bassam",
      numeroBL: "BL-CLB-914",
      etatConformite: "CONFORME",
      heureReception: "10:30",
    },
  ]);

  // Travaux & Remarques
  const [travauxRealises, setTravauxRealises] = useState(
    "Coulage de 8 poteaux en béton armé sur la zone nord. Ferraillage des poutres principales du plancher R+2. Réception du ferraillage par le contrôleur technique."
  );
  const [remarquesGenerales, setRemarquesGenerales] = useState(
    "Visite inopinée du client Maître d'ouvrage à 11h : RAS. Livraison ciment réceptionnée dans les délais."
  );
  const [aUnIncident, setAUnIncident] = useState(false);
  const [incidentTitre, setIncidentTitre] = useState("");
  const [incidentDesc, setIncidentDesc] = useState("");

  // Filtre historique
  const [filtreProjetHistorique, setFiltreProjetHistorique] = useState("TOUS");

  // Initialisation
  useEffect(() => {
    obtenirProjetsChantier().then((p) => {
      setProjets(p);
      if (p.length > 0 && !projetId) {
        setProjetId(p[0].id);
        if (p[0].lots.length > 0) setLotId(p[0].lots[0].id);
      }
    });

    obtenirRapportsJournaliers().then(setRapports);
  }, []);

  // Calcul du projet sélectionné et de ses lots
  const projetActuel = useMemo(() => {
    return projets.find((p) => p.id === projetId) || projets[0];
  }, [projets, projetId]);

  // Calcul automatique du total de l'effectif
  const effectifTotal = useMemo(() => {
    return presences.reduce((acc, ligne) => acc + (Number(ligne.effectif) || 0), 0);
  }, [presences]);

  // Actions d'ajout de ligne
  const ajouterLignePresence = () => {
    const nouvelle: LignePresence = {
      id: `p-${Date.now()}`,
      categorie: "REGIE",
      corpsMetier: "Ouvriers polyvalents",
      effectif: 2,
      heuresTravaillees: 8,
    };
    setPresences([...presences, nouvelle]);
  };

  const supprimerLignePresence = (id: string) => {
    setPresences(presences.filter((p) => p.id !== id));
  };

  const modifierLignePresence = (id: string, modifs: Partial<LignePresence>) => {
    setPresences(presences.map((p) => (p.id === id ? { ...p, ...modifs } : p)));
  };

  const ajouterLigneMateriau = () => {
    const nouveau: LigneMateriau = {
      id: `m-${Date.now()}`,
      designation: "Acier HA 12",
      quantite: 1,
      unite: "Tonne",
      fournisseur: "Fournisseur local",
      numeroBL: `BL-${Math.floor(1000 + Math.random() * 9000)}`,
      etatConformite: "CONFORME",
      heureReception: "14:00",
    };
    setMateriaux([...materiaux, nouveau]);
  };

  const supprimerLigneMateriau = (id: string) => {
    setMateriaux(materiaux.filter((m) => m.id !== id));
  };

  const modifierLigneMateriau = (id: string, modifs: Partial<LigneMateriau>) => {
    setMateriaux(materiaux.map((m) => (m.id === id ? { ...m, ...modifs } : m)));
  };

  // Soumission
  const soumettreRapport = async (statut: "BROUILLON" | "SOUMIS") => {
    const nomLot = projetActuel?.lots.find((l) => l.id === lotId)?.nom;

    const incidents = aUnIncident && incidentTitre ? [
      {
        id: `inc-${Date.now()}`,
        gravite: "MAJEUR" as const,
        categorie: "TECHNIQUE" as const,
        titre: incidentTitre,
        description: incidentDesc,
      },
    ] : [];

    const nouveauRapport: RapportJournalierData = {
      id: `rap-${dateRapport}-${Math.floor(100 + Math.random() * 900)}`,
      projetId: projetActuel?.id || "proj-001",
      nomProjet: projetActuel?.nom || "Chantier en cours",
      lotId,
      nomLot,
      dateRapport,
      auteurNom,
      auteurRole,
      statut,
      meteo: {
        condition: conditionMeteo,
        temperatureC: temperature,
        impactTravaux: impactMeteo,
        heuresIntemperies,
        commentaireMeteo,
      },
      presences,
      materiaux,
      travauxRealises,
      incidents,
      remarquesGenerales,
    };

    const enregistre = await enregistrerRapportJournalier(nouveauRapport);
    setRapports((prev) => [enregistre, ...prev.filter((r) => r.id !== enregistre.id)]);

    setNotification(
      statut === "SOUMIS"
        ? "Le journal de chantier du jour a été transmis avec succès pour approbation !"
        : "Le brouillon du rapport journalier a été sauvegardé avec succès."
    );
    setTimeout(() => setNotification(null), 5000);

    setVue("HISTORIQUE");
  };

  // Téléchargement / Impression du journal en PDF
  const exporterPdfRapport = (rap: RapportJournalierData) => {
    const contenu = `
====================================================================
               CCD DIGITAL — JOURNAL DE CHANTIER QUOTIDIEN
====================================================================
Projet / Chantier : ${rap.nomProjet}
Lot :              ${rap.nomLot || "Tous lots confondus"}
Date du rapport :   ${rap.dateRapport}
Auteur :           ${rap.auteurNom} (${rap.auteurRole})
Statut :           ${rap.statut}

--------------------------------------------------------------------
1. CONDITIONS METEOROLOGIQUES
--------------------------------------------------------------------
Condition :        ${rap.meteo.condition} (${rap.meteo.temperatureC}°C)
Impact travaux :   ${rap.meteo.impactTravaux}
Heures intempérie : ${rap.meteo.heuresIntemperies}h
Observations :     ${rap.meteo.commentaireMeteo || "Conditions normales"}

--------------------------------------------------------------------
2. EFFECTIFS ET MAIN-D'ŒUVRE (TOTAL : ${rap.presences.reduce((a, b) => a + Number(b.effectif), 0)} personnes)
--------------------------------------------------------------------
${rap.presences
  .map(
    (p) =>
      `• [${p.categorie}] ${p.corpsMetier} : ${p.effectif} pers. (${p.heuresTravaillees}h) ${
        p.entrepriseSousTraitante ? `- Sté ${p.entrepriseSousTraitante}` : ""
      } ${p.remarques ? `· ${p.remarques}` : ""}`
  )
  .join("\n")}

--------------------------------------------------------------------
3. RECEPTION DES MATERIAUX
--------------------------------------------------------------------
${
  rap.materiaux.length > 0
    ? rap.materiaux
        .map(
          (m) =>
            `• ${m.designation} : ${m.quantite} ${m.unite} (Fournisseur : ${m.fournisseur}, BL : ${m.numeroBL}, Contrôle : ${m.etatConformite})`
        )
        .join("\n")
    : "Aucune réception de matériau enregistrée ce jour."
}

--------------------------------------------------------------------
4. TRAVAUX EXECUTES DANS LA JOURNEE
--------------------------------------------------------------------
${rap.travauxRealises}

--------------------------------------------------------------------
5. REMARQUES GENERALES & INCIDENTS
--------------------------------------------------------------------
Remarques : ${rap.remarquesGenerales}
${
  rap.incidents.length > 0
    ? `Incidents constatés : ${rap.incidents.map((i) => `[${i.gravite}] ${i.titre} - ${i.description}`).join("; ")}`
    : "Aucun incident ou blocage critique à signaler."
}

Rapport certifié et archivé dans le système CCD Digital.
====================================================================
    `;

    const el = document.createElement("a");
    const blob = new Blob([contenu], { type: "text/plain" });
    el.href = URL.createObjectURL(blob);
    el.download = `Journal_Chantier_${rap.dateRapport}_${rap.id}.txt`;
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);

    setNotification("Le journal de chantier a été téléchargé.");
    setTimeout(() => setNotification(null), 4000);
  };

  const rapportsFiltres = rapports.filter((r) => {
    if (filtreProjetHistorique === "TOUS") return true;
    return r.projetId === filtreProjetHistorique;
  });

  return (
    <div className={styles.conteneur}>
      {/* Barre d'en-tête & Onglets */}
      <header className={styles.enTetePage}>
        <div>
          <h1 className={styles.titreModule}>
            <HardHat size={32} weight="duotone" style={{ color: "var(--color-primary-500)" }} />
            <span>Journal de Chantier</span>
          </h1>
          <p className={styles.sousTitreModule}>
            Saisie quotidienne terrain : météo, main-d&apos;œuvre, approvisionnements et faits marquants.
          </p>
        </div>

        <nav className={styles.barreOnglets} aria-label="Modes du journal">
          <button
            type="button"
            className={`${styles.ongletBtn} ${vue === "SAISIE" ? styles.ongletActif : ""}`}
            onClick={() => setVue("SAISIE")}
          >
            <Plus size={16} weight="bold" />
            <span>Saisie du jour</span>
          </button>
          <button
            type="button"
            className={`${styles.ongletBtn} ${vue === "HISTORIQUE" ? styles.ongletActif : ""}`}
            onClick={() => setVue("HISTORIQUE")}
          >
            <Calendar size={16} weight="bold" />
            <span>Historique ({rapports.length})</span>
          </button>
        </nav>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div
          style={{
            padding: "12px 20px",
            background: "var(--color-semantic-success-bg, #DCFCE7)",
            color: "var(--color-semantic-success, #166534)",
            border: "1px solid var(--color-semantic-success)",
            borderRadius: "12px",
            marginBottom: "20px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle size={20} weight="fill" />
          <span>{notification}</span>
        </div>
      )}

      {/* ================================================================
          VUE 1 : SAISIE QUOTIDIENNE DU RAPPORT
          ================================================================ */}
      {vue === "SAISIE" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            soumettreRapport("SOUMIS");
          }}
          className={styles.formulaire}
        >
          {/* Cartouche d'en-tête (Projet, Date, Rédacteur) */}
          <div className={styles.blocCartouche}>
            <div className={styles.grilleCartouche}>
              <div className={styles.champItem}>
                <label className={styles.champLabel}>Chantier / Projet en cours</label>
                <select
                  className={styles.champSelect}
                  value={projetId}
                  onChange={(e) => {
                    setProjetId(e.target.value);
                    const sel = projets.find((p) => p.id === e.target.value);
                    if (sel && sel.lots.length > 0) setLotId(sel.lots[0].id);
                  }}
                >
                  {projets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} ({p.lieu})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.champItem}>
                <label className={styles.champLabel}>Lot concerné</label>
                <select
                  className={styles.champSelect}
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                >
                  {projetActuel?.lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.champItem}>
                <label className={styles.champLabel}>Date de travail</label>
                <input
                  type="date"
                  required
                  className={styles.champInput}
                  value={dateRapport}
                  onChange={(e) => setDateRapport(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SECTION 1 : METEO DU CHANTIER */}
          <section className={styles.sectionCadre}>
            <div className={styles.sectionEntete}>
              <div className={styles.sectionTitreGroupe}>
                <Sun size={22} weight="duotone" className={styles.sectionIcone} />
                <h2 className={styles.sectionTitre}>1. Conditions Météorologiques</h2>
              </div>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)" }}>
                Impact direct sur les cadences et la sécurité
              </span>
            </div>

            <div className={styles.grilleMeteo}>
              {/* Choix visuel de la météo */}
              <div>
                <label className={styles.champLabel} style={{ marginBottom: "8px", display: "block" }}>
                  Météo dominante constatée sur site
                </label>
                <div className={styles.choixConditions}>
                  <button
                    type="button"
                    className={`${styles.tuileMeteo} ${conditionMeteo === "ENSOLEILLE" ? styles.tuileMeteoActive : ""}`}
                    onClick={() => setConditionMeteo("ENSOLEILLE")}
                  >
                    <Sun size={28} weight={conditionMeteo === "ENSOLEILLE" ? "fill" : "duotone"} color="#D97706" />
                    <span className={styles.tuileMeteoLabel}>Ensoleillé</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.tuileMeteo} ${conditionMeteo === "NUAGEUX" ? styles.tuileMeteoActive : ""}`}
                    onClick={() => setConditionMeteo("NUAGEUX")}
                  >
                    <CloudSun size={28} weight={conditionMeteo === "NUAGEUX" ? "fill" : "duotone"} color="#D97706" />
                    <span className={styles.tuileMeteoLabel}>Nuageux</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.tuileMeteo} ${conditionMeteo === "PLUIE" ? styles.tuileMeteoActive : ""}`}
                    onClick={() => setConditionMeteo("PLUIE")}
                  >
                    <CloudRain size={28} weight={conditionMeteo === "PLUIE" ? "fill" : "duotone"} color="#2563EB" />
                    <span className={styles.tuileMeteoLabel}>Pluie</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.tuileMeteo} ${conditionMeteo === "ORAGE" ? styles.tuileMeteoActive : ""}`}
                    onClick={() => setConditionMeteo("ORAGE")}
                  >
                    <CloudLightning size={28} weight={conditionMeteo === "ORAGE" ? "fill" : "duotone"} color="#DC2626" />
                    <span className={styles.tuileMeteoLabel}>Orage</span>
                  </button>
                </div>
              </div>

              {/* Détails météo */}
              <div className={styles.detailsMeteo}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className={styles.champItem}>
                    <label className={styles.champLabel}>Température moyenne</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="number"
                        className={styles.champInput}
                        value={temperature}
                        onChange={(e) => setTemperature(Number(e.target.value))}
                      />
                      <span style={{ position: "absolute", right: 12, top: 10, color: "var(--color-neutral-400)", fontWeight: 700 }}>
                        °C
                      </span>
                    </div>
                  </div>

                  <div className={styles.champItem}>
                    <label className={styles.champLabel}>Incidence chantier</label>
                    <select
                      className={styles.champSelect}
                      value={impactMeteo}
                      onChange={(e) => setImpactMeteo(e.target.value as ImpactMeteo)}
                    >
                      <option value="AUCUN">Aucun retard</option>
                      <option value="RALENTISSEMENT">Ralentissement</option>
                      <option value="ARRET_PARTIEL">Arrêt partiel</option>
                      <option value="ARRET_TOTAL">Arrêt total intempérie</option>
                    </select>
                  </div>
                </div>

                {impactMeteo !== "AUCUN" && (
                  <div className={styles.champItem}>
                    <label className={styles.champLabel}>Nombre d&apos;heures d&apos;intempéries / arrêt</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      className={styles.champInput}
                      placeholder="Ex : 2.5"
                      value={heuresIntemperies}
                      onChange={(e) => setHeuresIntemperies(Number(e.target.value))}
                    />
                  </div>
                )}

                <div className={styles.champItem}>
                  <label className={styles.champLabel}>Observations météo (facultatif)</label>
                  <input
                    type="text"
                    className={styles.champInput}
                    placeholder="Ex : Sol boueux après forte pluie matinale, drainage effectué"
                    value={commentaireMeteo}
                    onChange={(e) => setCommentaireMeteo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2 : EFFECTIFS ET PRESENCES */}
          <section className={styles.sectionCadre}>
            <div className={styles.sectionEntete}>
              <div className={styles.sectionTitreGroupe}>
                <Users size={22} weight="duotone" className={styles.sectionIcone} />
                <h2 className={styles.sectionTitre}>2. Présences & Main-d&apos;Œuvre</h2>
              </div>
              <div className={styles.badgeTotalEffectif}>
                <HardHat size={18} weight="fill" />
                <span>Total effectif présent : {effectifTotal} ouvriers</span>
              </div>
            </div>

            <table className={styles.tableauPresences}>
              <thead>
                <tr>
                  <th style={{ width: "20%" }}>Type d&apos;équipe</th>
                  <th style={{ width: "25%" }}>Corps de métier / Sous-traitant</th>
                  <th style={{ width: "12%" }}>Effectif</th>
                  <th style={{ width: "12%" }}>Heures</th>
                  <th>Remarques / Tâches assignées</th>
                  <th style={{ width: "40px" }} />
                </tr>
              </thead>
              <tbody>
                {presences.map((ligne) => (
                  <tr key={ligne.id}>
                    <td>
                      <select
                        className={styles.champSelect}
                        value={ligne.categorie}
                        onChange={(e) =>
                          modifierLignePresence(ligne.id, {
                            categorie: e.target.value as "REGIE" | "SOUS_TRAITANT" | "ENCADREMENT",
                          })
                        }
                      >
                        <option value="REGIE">Régie directe</option>
                        <option value="SOUS_TRAITANT">Sous-traitant</option>
                        <option value="ENCADREMENT">Encadrement</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        required
                        className={styles.champInput}
                        placeholder="Ex : Maçons, Plombiers..."
                        value={ligne.corpsMetier}
                        onChange={(e) => modifierLignePresence(ligne.id, { corpsMetier: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        required
                        className={styles.champInput}
                        value={ligne.effectif}
                        onChange={(e) => modifierLignePresence(ligne.id, { effectif: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="24"
                        className={styles.champInput}
                        value={ligne.heuresTravaillees}
                        onChange={(e) => modifierLignePresence(ligne.id, { heuresTravaillees: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className={styles.champInput}
                        placeholder="Précisions sur la zone d'intervention..."
                        value={ligne.remarques || ""}
                        onChange={(e) => modifierLignePresence(ligne.id, { remarques: e.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnLigneSuppr}
                        onClick={() => supprimerLignePresence(ligne.id)}
                        title="Supprimer cette équipe"
                      >
                        <Trash size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button type="button" onClick={ajouterLignePresence} className={styles.btnAjouterLigne}>
              <Plus size={16} weight="bold" />
              <span>Ajouter une équipe ou un corps de métier</span>
            </button>
          </section>

          {/* SECTION 3 : MATERIAUX & LIVRAISONS */}
          <section className={styles.sectionCadre}>
            <div className={styles.sectionEntete}>
              <div className={styles.sectionTitreGroupe}>
                <Package size={22} weight="duotone" className={styles.sectionIcone} />
                <h2 className={styles.sectionTitre}>3. Approvisionnements & Matériaux Réceptionnés</h2>
              </div>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)" }}>
                Contrôle quantitatif et qualitatif sur site
              </span>
            </div>

            <table className={styles.tableauPresences}>
              <thead>
                <tr>
                  <th style={{ width: "24%" }}>Désignation matériau</th>
                  <th style={{ width: "12%" }}>Quantité</th>
                  <th style={{ width: "14%" }}>Unité</th>
                  <th style={{ width: "20%" }}>Fournisseur</th>
                  <th style={{ width: "14%" }}>N° Bon Livraison</th>
                  <th style={{ width: "12%" }}>Conformité</th>
                  <th style={{ width: "40px" }} />
                </tr>
              </thead>
              <tbody>
                {materiaux.map((mat) => (
                  <tr key={mat.id}>
                    <td>
                      <input
                        type="text"
                        required
                        className={styles.champInput}
                        placeholder="Ex : Ciment CPJ 42.5"
                        value={mat.designation}
                        onChange={(e) => modifierLigneMateriau(mat.id, { designation: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        className={styles.champInput}
                        value={mat.quantite}
                        onChange={(e) => modifierLigneMateriau(mat.id, { quantite: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <select
                        className={styles.champSelect}
                        value={mat.unite}
                        onChange={(e) => modifierLigneMateriau(mat.id, { unite: e.target.value })}
                      >
                        <option value="Sacs (50kg)">Sacs (50kg)</option>
                        <option value="Tonnes">Tonnes</option>
                        <option value="m³">m³</option>
                        <option value="Unités">Unités</option>
                        <option value="Voyages">Voyages camion</option>
                        <option value="Fardeaux">Fardeaux</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className={styles.champInput}
                        placeholder="Ex : CIMAF, Lafarge..."
                        value={mat.fournisseur}
                        onChange={(e) => modifierLigneMateriau(mat.id, { fournisseur: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className={styles.champInput}
                        placeholder="BL-..."
                        value={mat.numeroBL}
                        onChange={(e) => modifierLigneMateriau(mat.id, { numeroBL: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className={styles.champSelect}
                        value={mat.etatConformite}
                        onChange={(e) =>
                          modifierLigneMateriau(mat.id, {
                            etatConformite: e.target.value as "CONFORME" | "NON_CONFORME" | "AVEC_RESERVES",
                          })
                        }
                      >
                        <option value="CONFORME">Conforme</option>
                        <option value="AVEC_RESERVES">Réserves</option>
                        <option value="NON_CONFORME">Non conforme</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnLigneSuppr}
                        onClick={() => supprimerLigneMateriau(mat.id)}
                        title="Supprimer cette livraison"
                      >
                        <Trash size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button type="button" onClick={ajouterLigneMateriau} className={styles.btnAjouterLigne}>
              <Plus size={16} weight="bold" />
              <span>Ajouter une réception de matériau</span>
            </button>
          </section>

          {/* SECTION 4 : TRAVAUX REALISES ET REMARQUES */}
          <section className={styles.sectionCadre}>
            <div className={styles.sectionEntete}>
              <div className={styles.sectionTitreGroupe}>
                <FileText size={22} weight="duotone" className={styles.sectionIcone} />
                <h2 className={styles.sectionTitre}>4. Travaux Réalisés & Remarques du Chef de Chantier</h2>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className={styles.champItem}>
                <label className={styles.champLabel}>Avancement & Travaux exécutés dans la journée *</label>
                <textarea
                  rows={3}
                  required
                  className={styles.textareaChamp}
                  placeholder="Détaillez les ouvrages coulés, posés ou façonnés aujourd'hui..."
                  value={travauxRealises}
                  onChange={(e) => setTravauxRealises(e.target.value)}
                />
              </div>

              <div className={styles.champItem}>
                <label className={styles.champLabel}>Remarques générales, visites & consignes de sécurité</label>
                <textarea
                  rows={2}
                  className={styles.textareaChamp}
                  placeholder="Visite du client, bureau de contrôle SOCOTEC, incidents matériels légers..."
                  value={remarquesGenerales}
                  onChange={(e) => setRemarquesGenerales(e.target.value)}
                />
              </div>

              {/* Option d'incident bloquant */}
              <div style={{ paddingTop: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={aUnIncident}
                    onChange={(e) => setAUnIncident(e.target.checked)}
                  />
                  <span>Signaler un blocage ou incident critique nécessitant une alerte</span>
                </label>

                {aUnIncident && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "16px",
                      background: "var(--color-semantic-error-bg, #FEE2E2)",
                      border: "1px solid var(--color-semantic-error)",
                      borderRadius: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-semantic-error)" }}>
                      <WarningCircle size={20} weight="fill" />
                      <strong>Détail de l&apos;incident bloquant :</strong>
                    </div>
                    <input
                      type="text"
                      className={styles.champInput}
                      placeholder="Titre de l'incident (ex : Panne grue mobile)"
                      value={incidentTitre}
                      onChange={(e) => setIncidentTitre(e.target.value)}
                    />
                    <textarea
                      rows={2}
                      className={styles.textareaChamp}
                      placeholder="Description du blocage et mesures prises..."
                      value={incidentDesc}
                      onChange={(e) => setIncidentDesc(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Barre d'action finale */}
          <div className={styles.barreActions}>
            <button
              type="button"
              className={styles.btnBrouillon}
              onClick={() => soumettreRapport("BROUILLON")}
            >
              <span>Enregistrer en Brouillon</span>
            </button>
            <button type="submit" className={styles.btnSoumettre}>
              <CheckCircle size={20} weight="bold" />
              <span>Soumettre le Journal de Chantier</span>
            </button>
          </div>
        </form>
      )}

      {/* ================================================================
          VUE 2 : HISTORIQUE DES RAPPORTS & CONSULTATION
          ================================================================ */}
      {vue === "HISTORIQUE" && (
        <section className={styles.grilleHistorique}>
          <div className={styles.filtresHistorique}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-neutral-700)" }}>
              Filtrer par chantier :
            </label>
            <select
              className={styles.champSelect}
              style={{ width: "auto", minWidth: "260px" }}
              value={filtreProjetHistorique}
              onChange={(e) => setFiltreProjetHistorique(e.target.value)}
            >
              <option value="TOUS">Tous les chantiers ({rapports.length})</option>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </div>

          {rapportsFiltres.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", background: "#fff", borderRadius: "16px" }}>
              <p style={{ color: "var(--color-neutral-500)", marginBottom: "16px" }}>
                Aucun rapport journalier pour ce filtre.
              </p>
              <button type="button" onClick={() => setVue("SAISIE")} className={styles.btnSoumettre}>
                <Plus size={16} weight="bold" />
                <span>Créer le premier journal de chantier</span>
              </button>
            </div>
          ) : (
            rapportsFiltres.map((rap) => {
              const effectifTotalRap = rap.presences.reduce((acc, p) => acc + (Number(p.effectif) || 0), 0);

              return (
                <article key={rap.id} className={styles.carteRapport}>
                  <div className={styles.carteRapportEntete}>
                    <div>
                      <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-neutral-900)" }}>
                        {rap.nomProjet}
                      </h3>
                      <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)" }}>
                        {rap.nomLot ? `${rap.nomLot} · ` : ""}Date : <strong>{rap.dateRapport}</strong> · Rédigé par{" "}
                        {rap.auteurNom}
                      </span>
                    </div>

                    <div>
                      {rap.statut === "APPROUVE" && (
                        <span className={`${styles.badgeStatut} ${styles.statutApprouve}`}>
                          <CheckCircle size={14} weight="fill" />
                          <span>Validé par Conducteur</span>
                        </span>
                      )}
                      {rap.statut === "SOUMIS" && (
                        <span className={`${styles.badgeStatut} ${styles.statutSoumis}`}>
                          <Clock size={14} weight="fill" />
                          <span>En attente validation</span>
                        </span>
                      )}
                      {rap.statut === "BROUILLON" && (
                        <span className={`${styles.badgeStatut} ${styles.statutBrouillon}`}>
                          <span>Brouillon</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Résumé des indicateurs */}
                  <div className={styles.resumeLigne}>
                    <div className={styles.resumeItem}>
                      <Sun size={16} weight="duotone" style={{ color: "#D97706" }} />
                      <span>
                        Météo : {rap.meteo.condition} ({rap.meteo.temperatureC}°C)
                      </span>
                    </div>
                    <div className={styles.resumeItem}>
                      <Users size={16} weight="duotone" style={{ color: "var(--color-primary-600)" }} />
                      <span>
                        <strong>{effectifTotalRap}</strong> ouvriers sur site
                      </span>
                    </div>
                    <div className={styles.resumeItem}>
                      <Package size={16} weight="duotone" style={{ color: "var(--color-neutral-600)" }} />
                      <span>{rap.materiaux.length} réceptions de matériaux</span>
                    </div>
                    {rap.incidents.length > 0 && (
                      <div className={styles.resumeItem} style={{ color: "var(--color-semantic-error)" }}>
                        <Warning size={16} weight="fill" />
                        <span>{rap.incidents.length} incident(s)</span>
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)", marginBottom: "16px" }}>
                    <strong>Travaux réalisés :</strong> {rap.travauxRealises}
                  </p>

                  <div className={styles.actionsRapport}>
                    <button
                      type="button"
                      className={styles.btnBrouillon}
                      style={{ padding: "6px 14px", fontSize: "0.8125rem" }}
                      onClick={() => setRapportSelectionne(rap)}
                    >
                      <Eye size={16} weight="bold" />
                      <span>Consulter le détail</span>
                    </button>
                    <button
                      type="button"
                      className={styles.btnBrouillon}
                      style={{ padding: "6px 14px", fontSize: "0.8125rem" }}
                      onClick={() => exporterPdfRapport(rap)}
                    >
                      <DownloadSimple size={16} weight="bold" />
                      <span>Exporter (PDF / Texte)</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      {/* MODALE DE CONSULTATION RAPIDE D'UN RAPPORT */}
      {rapportSelectionne && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setRapportSelectionne(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                  Détail du Journal — {rapportSelectionne.dateRapport}
                </h2>
                <span style={{ fontSize: "0.875rem", color: "var(--color-neutral-600)" }}>
                  {rapportSelectionne.nomProjet} ({rapportSelectionne.nomLot || "Lot principal"})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRapportSelectionne(null)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "0.875rem" }}>
              {/* Météo */}
              <div style={{ background: "var(--color-neutral-50)", padding: "12px", borderRadius: "8px" }}>
                <strong>☀️ Météo :</strong> {rapportSelectionne.meteo.condition} · {rapportSelectionne.meteo.temperatureC}°C · Impact : {rapportSelectionne.meteo.impactTravaux}
                {rapportSelectionne.meteo.commentaireMeteo && (
                  <p style={{ marginTop: "4px", color: "var(--color-neutral-600)" }}>
                    {rapportSelectionne.meteo.commentaireMeteo}
                  </p>
                )}
              </div>

              {/* Présences */}
              <div>
                <strong>👷 Effectifs présents :</strong>
                <ul style={{ marginTop: "6px", paddingLeft: "20px" }}>
                  {rapportSelectionne.presences.map((p) => (
                    <li key={p.id}>
                      [{p.categorie}] {p.corpsMetier} : <strong>{p.effectif} personnes</strong> ({p.heuresTravaillees}h)
                      {p.remarques ? ` - ${p.remarques}` : ""}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Matériaux */}
              <div>
                <strong>🧱 Approvisionnements reçus :</strong>
                {rapportSelectionne.materiaux.length > 0 ? (
                  <ul style={{ marginTop: "6px", paddingLeft: "20px" }}>
                    {rapportSelectionne.materiaux.map((m) => (
                      <li key={m.id}>
                        {m.designation} : <strong>{m.quantite} {m.unite}</strong> (Fournisseur : {m.fournisseur}, BL : {m.numeroBL} - {m.etatConformite})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: "var(--color-neutral-500)", fontStyle: "italic" }}>Aucun matériau livré ce jour.</p>
                )}
              </div>

              {/* Travaux & Remarques */}
              <div>
                <strong>📋 Travaux exécutés :</strong>
                <p style={{ marginTop: "4px", whiteSpace: "pre-wrap" }}>{rapportSelectionne.travauxRealises}</p>
              </div>

              <div>
                <strong>💬 Remarques & faits marquants :</strong>
                <p style={{ marginTop: "4px", whiteSpace: "pre-wrap" }}>{rapportSelectionne.remarquesGenerales}</p>
              </div>

              {rapportSelectionne.validePar && (
                <div style={{ padding: "10px", background: "#DCFCE7", color: "#166534", borderRadius: "8px" }}>
                  ✓ Validé par <strong>{rapportSelectionne.validePar}</strong> le {rapportSelectionne.valideLe}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
              <button
                type="button"
                className={styles.btnBrouillon}
                onClick={() => exporterPdfRapport(rapportSelectionne)}
              >
                <DownloadSimple size={16} weight="bold" />
                <span>Télécharger le rapport</span>
              </button>
              <button
                type="button"
                className={styles.btnSoumettre}
                onClick={() => setRapportSelectionne(null)}
              >
                <span>Fermer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

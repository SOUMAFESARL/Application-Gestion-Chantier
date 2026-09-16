"use client";

import {
  ArrowUpRight,
  ArrowsClockwise,
  Buildings,
  CheckCircle,
  CurrencyCircleDollar,
  DownloadSimple,
  Eye,
  FileText,
  Funnel,
  HardHat,
  MagnifyingGlass,
  ShieldCheck,
  Sparkle,
  TrendUp,
  UserCheck,
  Users,
  Warning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import {
  modifierEntrepriseCliente,
  obtenirEntreprisesClientes,
  obtenirStatsSuperAdmin,
} from "@/features/super-admin/api";
import {
  CodePlanSuperAdmin,
  EntrepriseCliente,
  StatsSuperAdmin,
  StatutEntrepriseClient,
} from "@/features/super-admin/types";

import styles from "./page.module.css";

export default function PageSuperAdmin() {
  const [stats, setStats] = useState<StatsSuperAdmin | null>(null);
  const [entreprises, setEntreprises] = useState<EntrepriseCliente[]>([]);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("TOUS");
  const [filtrePlan, setFiltrePlan] = useState<string>("TOUS");
  const [entrepriseSelectionnee, setEntrepriseSelectionnee] = useState<EntrepriseCliente | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    obtenirStatsSuperAdmin().then(setStats);
    obtenirEntreprisesClientes().then(setEntreprises);
  }, []);

  const formatFcfa = (montant: number) => {
    return new Intl.NumberFormat("fr-FR").format(montant) + " FCFA";
  };

  // Filtrage réactif des entreprises
  const entreprisesFiltrees = useMemo(() => {
    return entreprises.filter((e) => {
      const correspondRecherche =
        e.nomCommercial.toLowerCase().includes(recherche.toLowerCase()) ||
        e.raisonSociale.toLowerCase().includes(recherche.toLowerCase()) ||
        e.contactEmail.toLowerCase().includes(recherche.toLowerCase()) ||
        e.pays.toLowerCase().includes(recherche.toLowerCase());

      const correspondStatut = filtreStatut === "TOUS" || e.statut === filtreStatut;
      const correspondPlan = filtrePlan === "TOUS" || e.planActuel.code === filtrePlan;

      return correspondRecherche && correspondStatut && correspondPlan;
    });
  }, [entreprises, recherche, filtreStatut, filtrePlan]);

  // Actions d'administration
  const changerStatutEntreprise = async (id: string, nouveauStatut: StatutEntrepriseClient) => {
    const maj = await modifierEntrepriseCliente(id, { statut: nouveauStatut });
    setEntreprises(maj);
    if (entrepriseSelectionnee?.id === id) {
      setEntrepriseSelectionnee({ ...entrepriseSelectionnee, statut: nouveauStatut });
    }
    setNotification(`Le statut de l'entreprise a été mis à jour sur « ${nouveauStatut} ».`);
    setTimeout(() => setNotification(null), 4000);
  };

  const changerPlanEntreprise = async (
    id: string,
    codePlan: CodePlanSuperAdmin,
    libelle: string,
    montantFcfa: number
  ) => {
    const maj = await modifierEntrepriseCliente(id, {
      planActuel: {
        code: codePlan,
        libelle,
        cycle: "MENSUEL",
        montantFcfa,
      },
      statut: "ACTIF", // Le passage à un forfait payant active automatiquement le compte
      joursEssaiRestants: undefined,
    });
    setEntreprises(maj);
    if (entrepriseSelectionnee?.id === id) {
      setEntrepriseSelectionnee({
        ...entrepriseSelectionnee,
        planActuel: { code: codePlan, libelle, cycle: "MENSUEL", montantFcfa },
        statut: "ACTIF",
      });
    }
    setNotification(`La formule de l'entreprise a été surclassée vers « ${libelle} » avec succès !`);
    setTimeout(() => setNotification(null), 4000);
  };

  const exporterCsv = () => {
    const entetes = "ID;Raison Sociale;Nom Commercial;Pays;Ville;Email;Tel;Forfait;Cycle;Montant FCFA;Statut;Chantiers;Utilisateurs;Prochaine Echeance\n";
    const lignes = entreprises
      .map(
        (e) =>
          `"${e.id}";"${e.raisonSociale}";"${e.nomCommercial}";"${e.pays}";"${e.ville}";"${e.contactEmail}";"${e.contactTel}";"${e.planActuel.libelle}";"${e.planActuel.cycle}";"${e.planActuel.montantFcfa}";"${e.statut}";"${e.nombreChantiers}";"${e.nombreUtilisateurs}";"${e.prochaineEcheance}"`
      )
      .join("\n");

    const blob = new Blob([entetes + lignes], { type: "text/csv;charset=utf-8;" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = `Entreprises_Clientes_CCD_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);

    setNotification("L'export CSV des entreprises a été généré avec succès.");
    setTimeout(() => setNotification(null), 4000);
  };

  // Répartition des plans
  const totalMaitreOeuvre = entreprises.filter((e) => e.planActuel.code === "MAITRE_OEUVRE" && e.statut === "ACTIF").length;
  const totalPromoteur = entreprises.filter((e) => e.planActuel.code === "PROMOTEUR" && e.statut === "ACTIF").length;
  const totalBatisseur = entreprises.filter((e) => e.planActuel.code === "BATISSEUR" && e.statut === "ACTIF").length;
  const totalEssai = entreprises.filter((e) => e.statut === "ESSAI").length;

  return (
    <div className={styles.conteneur}>
      {/* En-tête */}
      <header className={styles.enTete}>
        <div className={styles.titreBloc}>
          <span className={styles.badgeSuperAdmin}>
            <ShieldCheck size={14} weight="fill" />
            <span>Console Super Administrateur</span>
          </span>
          <h1 className={styles.titre}>Vue d&apos;ensemble des Entreprises & Abonnements</h1>
          <p className={styles.sousTitre}>
            Gestion centrale des entreprises clientes du SaaS BTP, contrôle des souscriptions CinetPay et indicateurs de performance.
          </p>
        </div>

        <button type="button" onClick={exporterCsv} className={styles.btnExport}>
          <DownloadSimple size={16} weight="bold" />
          <span>Exporter CSV</span>
        </button>
      </header>

      {/* Toast Notification */}
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

      {/* 1. KPIs PRINCIPAUX DE LA PLATEFORME */}
      {stats && (
        <section className={styles.grilleKpi}>
          <div className={styles.carteKpi}>
            <div className={styles.kpiEntete}>
              <span>Revenu Mensuel (MRR)</span>
              <CurrencyCircleDollar size={22} weight="duotone" className={styles.kpiIcone} />
            </div>
            <div className={styles.kpiValeur} style={{ color: "var(--color-primary-600)" }}>
              {formatFcfa(stats.mrrFcfa)}
            </div>
            <div className={styles.kpiSousTexte}>ARR estimé : {formatFcfa(stats.arrFcfa)} / an</div>
          </div>

          <div className={styles.carteKpi}>
            <div className={styles.kpiEntete}>
              <span>Entreprises Clientes</span>
              <Buildings size={22} weight="duotone" className={styles.kpiIcone} />
            </div>
            <div className={styles.kpiValeur}>{stats.totalEntreprises}</div>
            <div className={styles.kpiSousTexte}>
              <strong style={{ color: "var(--color-semantic-success)" }}>{stats.entreprisesActives} payantes</strong> · {stats.entreprisesEssai} en essai
            </div>
          </div>

          <div className={styles.carteKpi}>
            <div className={styles.kpiEntete}>
              <span>Chantiers Actifs Suivis</span>
              <HardHat size={22} weight="duotone" className={styles.kpiIcone} />
            </div>
            <div className={styles.kpiValeur}>{stats.totalChantiersPlateforme}</div>
            <div className={styles.kpiSousTexte}>{stats.totalUtilisateursPlateforme} conducteurs & ouvriers actifs</div>
          </div>

          <div className={styles.carteKpi}>
            <div className={styles.kpiEntete}>
              <span>Conversion Essai → Payant</span>
              <TrendUp size={22} weight="duotone" className={styles.kpiIcone} />
            </div>
            <div className={styles.kpiValeur}>{stats.tauxConversionEssai}%</div>
            <div className={styles.kpiSousTexte}>Moyenne secteur BTP Afrique : 42%</div>
          </div>
        </section>
      )}

      {/* 2. REPARTITION PAR FORMULE BTP */}
      <section className={styles.grilleForfaitsSynth}>
        <div className={styles.carteForfaitSynth}>
          <span className={styles.forfaitNomSynth}>Maître d&apos;Œuvre</span>
          <span className={styles.forfaitChiffre}>{totalMaitreOeuvre} clients</span>
          <span className={styles.forfaitDetails}>79 000 FCFA/m · 58% du CA</span>
        </div>
        <div className={styles.carteForfaitSynth}>
          <span className={styles.forfaitNomSynth}>Promoteur</span>
          <span className={styles.forfaitChiffre}>{totalPromoteur} clients</span>
          <span className={styles.forfaitDetails}>189 000 FCFA/m · Grands comptes</span>
        </div>
        <div className={styles.carteForfaitSynth}>
          <span className={styles.forfaitNomSynth}>Bâtisseur</span>
          <span className={styles.forfaitChiffre}>{totalBatisseur} clients</span>
          <span className={styles.forfaitDetails}>29 000 FCFA/m · Artisans & MOE</span>
        </div>
        <div className={styles.carteForfaitSynth}>
          <span className={styles.forfaitNomSynth}>Essai Gratuit 14j</span>
          <span className={styles.forfaitChiffre}>{totalEssai} entreprises</span>
          <span className={styles.forfaitDetails}>En phase de test terrain</span>
        </div>
      </section>

      {/* 3. TABLEAU DETAILLE DES ENTREPRISES */}
      <section className={styles.sectionTableau}>
        <div className={styles.barreFiltres}>
          <div style={{ position: "relative", width: "100%", maxWidth: "380px" }}>
            <MagnifyingGlass
              size={18}
              style={{ position: "absolute", left: 12, top: 11, color: "var(--color-neutral-400)" }}
            />
            <input
              type="text"
              className={styles.rechercheInput}
              style={{ paddingLeft: "36px" }}
              placeholder="Rechercher une entreprise, email, pays..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          <div className={styles.groupesFiltres}>
            <select
              className={styles.selectFiltre}
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value)}
            >
              <option value="TOUS">Tous les statuts</option>
              <option value="ACTIF">Abonnés Actifs</option>
              <option value="ESSAI">Période d&apos;Essai 14j</option>
              <option value="IMPAYE">Impayés</option>
              <option value="SUSPENDU">Suspendus</option>
            </select>

            <select
              className={styles.selectFiltre}
              value={filtrePlan}
              onChange={(e) => setFiltrePlan(e.target.value)}
            >
              <option value="TOUS">Toutes les formules</option>
              <option value="MAITRE_OEUVRE">Maître d&apos;Œuvre</option>
              <option value="PROMOTEUR">Promoteur</option>
              <option value="BATISSEUR">Bâtisseur</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className={styles.tableConteneur}>
          <table className={styles.tableEntreprises}>
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Contact Dirigeant</th>
                <th>Formule souscrite</th>
                <th>Statut</th>
                <th>Chantiers / Utilisateurs</th>
                <th>Échéance & Facturation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entreprisesFiltrees.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--color-neutral-500)" }}>
                    Aucune entreprise cliente trouvée pour ces critères de recherche.
                  </td>
                </tr>
              ) : (
                entreprisesFiltrees.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <strong style={{ color: "var(--color-neutral-900)" }}>{e.nomCommercial}</strong>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-neutral-500)" }}>
                          {e.raisonSociale} · {e.pays} ({e.ville})
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span>{e.contactNom}</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-neutral-500)" }}>
                          {e.contactEmail}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {e.planActuel.code === "MAITRE_OEUVRE" && (
                          <span className={`${styles.badgePlan} ${styles.planMaitreOeuvre}`}>
                            <Sparkle size={12} weight="fill" />
                            <span>Maître d&apos;Œuvre</span>
                          </span>
                        )}
                        {e.planActuel.code === "PROMOTEUR" && (
                          <span className={`${styles.badgePlan} ${styles.planPromoteur}`}>
                            <span>Promoteur VIP</span>
                          </span>
                        )}
                        {e.planActuel.code === "BATISSEUR" && (
                          <span className={`${styles.badgePlan} ${styles.planBatisseur}`}>
                            <span>Bâtisseur</span>
                          </span>
                        )}
                        <span style={{ fontSize: "0.75rem", color: "var(--color-neutral-500)" }}>
                          {formatFcfa(e.planActuel.montantFcfa)} / {e.planActuel.cycle.toLowerCase()}
                        </span>
                      </div>
                    </td>

                    <td>
                      {e.statut === "ACTIF" && (
                        <span className={`${styles.badgeStatut} ${styles.statutActif}`}>
                          <CheckCircle size={14} weight="fill" />
                          <span>Actif</span>
                        </span>
                      )}
                      {e.statut === "ESSAI" && (
                        <span className={`${styles.badgeStatut} ${styles.statutEssai}`}>
                          <span>Essai ({e.joursEssaiRestants}j restants)</span>
                        </span>
                      )}
                      {e.statut === "IMPAYE" && (
                        <span className={`${styles.badgeStatut} ${styles.statutImpaye}`}>
                          <Warning size={14} weight="fill" />
                          <span>Impayé CinetPay</span>
                        </span>
                      )}
                      {e.statut === "SUSPENDU" && (
                        <span className={`${styles.badgeStatut} ${styles.statutSuspendu}`}>
                          <span>Suspendu</span>
                        </span>
                      )}
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span title="Chantiers actifs">🏗️ {e.nombreChantiers} chantiers</span>
                        <span>·</span>
                        <span title="Utilisateurs">👥 {e.nombreUtilisateurs} pers.</span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{e.prochaineEcheance}</span>
                        {e.derniereFactureRef && (
                          <span style={{ fontSize: "0.75rem", color: "var(--color-primary-600)" }}>
                            Réf : {e.derniereFactureRef}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <button
                        type="button"
                        className={styles.btnActionTable}
                        onClick={() => setEntrepriseSelectionnee(e)}
                      >
                        <Eye size={16} weight="bold" />
                        <span>Gérer</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. MODALE FICHE ENTREPRISE & GESTION SUPER ADMIN */}
      {entrepriseSelectionnee && (
        <div className={styles.modaleOverlay} onClick={() => setEntrepriseSelectionnee(null)}>
          <div className={styles.modaleBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modaleEntete}>
              <div>
                <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--color-neutral-900)" }}>
                  {entrepriseSelectionnee.nomCommercial}
                </h2>
                <span style={{ fontSize: "0.875rem", color: "var(--color-neutral-500)" }}>
                  Raison sociale : {entrepriseSelectionnee.raisonSociale}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEntrepriseSelectionnee(null)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Infos complètes */}
            <div className={styles.grilleInfosFiche}>
              <div className={styles.infoBloc}>
                <span className={styles.infoLabel}>Localisation & Siège</span>
                <span className={styles.infoValeur}>
                  {entrepriseSelectionnee.pays} · {entrepriseSelectionnee.ville}
                </span>
              </div>

              <div className={styles.infoBloc}>
                <span className={styles.infoLabel}>Date d&apos;inscription</span>
                <span className={styles.infoValeur}>{entrepriseSelectionnee.dateInscription}</span>
              </div>

              <div className={styles.infoBloc}>
                <span className={styles.infoLabel}>Contact Principal</span>
                <span className={styles.infoValeur}>
                  {entrepriseSelectionnee.contactNom} ({entrepriseSelectionnee.contactTel})
                </span>
              </div>

              <div className={styles.infoBloc}>
                <span className={styles.infoLabel}>Email officiel</span>
                <span className={styles.infoValeur}>{entrepriseSelectionnee.contactEmail}</span>
              </div>

              <div className={styles.infoBloc}>
                <span className={styles.infoLabel}>Formule actuelle</span>
                <span className={styles.infoValeur}>
                  {entrepriseSelectionnee.planActuel.libelle} ({formatFcfa(entrepriseSelectionnee.planActuel.montantFcfa)})
                </span>
              </div>

              <div className={styles.infoBloc}>
                <span className={styles.infoLabel}>Statut plateforme</span>
                <span className={styles.infoValeur}>
                  {entrepriseSelectionnee.statut === "ACTIF" && "✓ Actif et à jour"}
                  {entrepriseSelectionnee.statut === "ESSAI" && `Essai gratuit (${entrepriseSelectionnee.joursEssaiRestants}j)`}
                  {entrepriseSelectionnee.statut === "IMPAYE" && "⚠️ Échéance CinetPay impayée"}
                  {entrepriseSelectionnee.statut === "SUSPENDU" && "🚫 Compte suspendu"}
                </span>
              </div>
            </div>

            {/* Actions Super Admin */}
            <div className={styles.zoneActionsAdmin}>
              <strong style={{ fontSize: "0.875rem", color: "var(--color-neutral-800)" }}>
                Actions Super Administrateur sur le compte :
              </strong>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button
                  type="button"
                  className={styles.btnActionTable}
                  onClick={() => changerPlanEntreprise(entrepriseSelectionnee.id, "MAITRE_OEUVRE", "Maître d'Œuvre", 79000)}
                >
                  <Sparkle size={14} weight="fill" />
                  <span>Surclasser en Maître d&apos;Œuvre</span>
                </button>

                <button
                  type="button"
                  className={styles.btnActionTable}
                  onClick={() => changerPlanEntreprise(entrepriseSelectionnee.id, "PROMOTEUR", "Promoteur", 189000)}
                >
                  <ArrowUpRight size={14} weight="bold" />
                  <span>Surclasser en Promoteur (Illimité)</span>
                </button>

                {entrepriseSelectionnee.statut === "SUSPENDU" ? (
                  <button
                    type="button"
                    className={styles.btnActionTable}
                    style={{ borderColor: "var(--color-semantic-success)", color: "var(--color-semantic-success)" }}
                    onClick={() => changerStatutEntreprise(entrepriseSelectionnee.id, "ACTIF")}
                  >
                    <UserCheck size={14} weight="bold" />
                    <span>Réactiver le compte</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.btnActionTable}
                    style={{ borderColor: "var(--color-semantic-error)", color: "var(--color-semantic-error)" }}
                    onClick={() => changerStatutEntreprise(entrepriseSelectionnee.id, "SUSPENDU")}
                  >
                    <WarningCircle size={14} weight="bold" />
                    <span>Suspendre l&apos;accès</span>
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                type="button"
                className={styles.btnActionTable}
                onClick={() => setEntrepriseSelectionnee(null)}
              >
                <span>Fermer la fiche</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

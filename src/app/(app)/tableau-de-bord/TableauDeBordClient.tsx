"use client";

import {
  ArrowRight,
  BuildingOffice,
  CheckCircle,
  ClockCountdown,
  CurrencyCircleDollar,
  FileText,
  HardHat,
  Plus,
  SquaresFour,
  Table,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alerte } from "@/components/ui/Alerte";
import { Badge } from "@/components/ui/Badge";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Tableau } from "@/components/ui/Tableau";
import type { Colonne } from "@/components/ui/Tableau";
import type { ProjetDetail } from "@/features/projets/api";
import {
  signerBonPaiement,
  type BonPaiementDashboard,
  type ProjetDashboard,
  type TableauDeBordData,
} from "@/features/tableauDeBord/api";
import { formaterMontant, formaterMontantCourt } from "@/lib/format";

import { ModalCreationProjet } from "./ModalCreationProjet";
import { ModalDefinirBudget } from "./ModalDefinirBudget";
import styles from "./TableauDeBord.module.css";

interface TableauDeBordClientProps {
  initialData: TableauDeBordData;
}

export function TableauDeBordClient({ initialData }: TableauDeBordClientProps) {
  const t = useTranslations("tableauDeBord");
  const [data, setData] = useState<TableauDeBordData>(initialData);
  const [modalCreationOuverte, setModalCreationOuverte] = useState(false);
  const [projetPourBudget, setProjetPourBudget] = useState<ProjetDashboard | null>(null);
  const [bdpSignes, setBdpSignes] = useState<Record<string, boolean>>({});
  const [enCoursSignature, setEnCoursSignature] = useState<Record<string, boolean>>({});
  const [messageSignature, setMessageSignature] = useState<{
    type: "succes" | "erreur";
    texte: string;
  } | null>(null);
  const [modeVue, setModeVue] = useState<"auto" | "tableau" | "cartes">("auto");

  const handleSignerBdp = async (bdp: BonPaiementDashboard) => {
    if (bdpSignes[bdp.id] || bdp.statut === "SIGNE" || enCoursSignature[bdp.id]) {
      return;
    }

    setEnCoursSignature((prev) => ({ ...prev, [bdp.id]: true }));
    setMessageSignature(null);

    try {
      const res = await signerBonPaiement(bdp.id);
      if (res.succes || res.statut === "SIGNE") {
        setBdpSignes((prev) => ({ ...prev, [bdp.id]: true }));
        setData((prev) => ({
          ...prev,
          metriques: {
            ...prev.metriques,
            bons_a_signer_count: Math.max(0, (prev.metriques.bons_a_signer_count || 1) - 1),
            bons_a_signer_montant: Math.max(
              0,
              (prev.metriques.bons_a_signer_montant || bdp.montant) - bdp.montant,
            ),
          },
          bons_paiement_a_valider: prev.bons_paiement_a_valider.map((item) =>
            item.id === bdp.id ? { ...item, statut: "SIGNE" } : item,
          ),
        }));
        setMessageSignature({
          type: "succes",
          texte: t("bdp.succesSignature"),
        });
      }
    } catch (err: unknown) {
      const messageErreur = err instanceof Error ? err.message : String(err);
      setMessageSignature({
        type: "erreur",
        texte: t("bdp.erreurSignature", { erreur: messageErreur }),
      });
    } finally {
      setEnCoursSignature((prev) => ({ ...prev, [bdp.id]: false }));
    }
  };

  const handleProjetCree = (nouveau: ProjetDetail) => {
    setData((prev) => {
      const nouveauProjetDashboard: ProjetDashboard = {
        id: nouveau.id,
        reference: nouveau.reference,
        nom: nouveau.nom,
        description: nouveau.description || "",
        client_nom: nouveau.client?.raison_sociale || "Client",
        ville: nouveau.ville,
        quartier: nouveau.quartier || "",
        statut: nouveau.statut || "EN_ATTENTE",
        avancement_reel: nouveau.avancement_reel ?? 0,
        avancement_theorique: nouveau.avancement_theorique ?? 0,
        ecart: 0,
        budget_initial_montant: nouveau.budget_initial_montant,
        budget_consomme_montant: 0,
        rapport_jour_statut: "EN_ATTENTE",
        indice_sante: 100,
        chef_projet_nom: nouveau.chef_projet
          ? `${nouveau.chef_projet.prenom} ${nouveau.chef_projet.nom}`
          : "",
      };

      return {
        ...prev,
        aucun_chantier: false,
        metriques: {
          ...prev.metriques,
          chantiers_actifs: prev.metriques.chantiers_actifs + 1,
          chantiers_conformes: prev.metriques.chantiers_conformes + 1,
        },
        projets: [nouveauProjetDashboard, ...prev.projets],
      };
    });
  };

  const handleBudgetEnregistre = (projetId: string, nouveauBudgetCentimes: number) => {
    setData((prev) => ({
      ...prev,
      projets: prev.projets.map((p) =>
        p.id === projetId
          ? { ...p, budget_initial_montant: nouveauBudgetCentimes }
          : p,
      ),
    }));
  };

  const { metriques, projets, bons_paiement_a_valider, receptions_materiaux } = data;
  const estSansChantier = Boolean(data.aucun_chantier || projets.length === 0);

  const colonnesChantiers: Colonne<ProjetDashboard>[] = [
    {
      cle: "projet",
      entete: t("chantiers.colProjet"),
      figee: true,
      largeurMinimale: "220px",
      rendu: (p) => (
        <div>
          <Link href={`/projets/${p.id}`} className={styles.projetNom}>
            {p.nom}
          </Link>
          <div className={styles.projetDetail}>
            {t("chantiers.detailProjet", {
              client: p.client_nom,
              ville: p.ville,
              quartier: p.quartier || t("chantiers.villeDefaut"),
            })}
          </div>
        </div>
      ),
    },
    {
      cle: "statut",
      entete: t("chantiers.colStatut"),
      largeurMinimale: "125px",
      rendu: (p) => {
        const estRetard = p.ecart < -5;
        return (
          <Badge variante={estRetard ? "avertissement" : "succes"}>
            {p.statut === "EN_COURS" ? t("chantiers.enCours") : t("chantiers.rapportEnAttente")}
          </Badge>
        );
      },
    },
    {
      cle: "avancement",
      entete: t("chantiers.colAvancement"),
      largeurMinimale: "185px",
      rendu: (p) => {
        const ecartSigne = p.ecart >= 0 ? `+${p.ecart}` : `${p.ecart}`;
        const estRetard = p.ecart < -5;
        return (
          <Link
            href={`/projets/${p.id}/avancement`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
            title="Consulter le suivi d'avancement détaillé et les photos de preuve"
          >
            <div className={styles.gaugeCell}>
              <div className={styles.gaugeLegend}>
                <span style={{ fontWeight: 600 }}>{t("chantiers.reel", { taux: p.avancement_reel })}</span>
                <span style={{ color: "var(--color-neutral-500, #8A8680)" }}>
                  {t("chantiers.prevu", { taux: p.avancement_theorique, ecart: ecartSigne })}
                </span>
              </div>
              <div className={styles.gaugeTrack}>
                <div
                  className={`${styles.gaugeFill} ${estRetard ? styles.gaugeFillDelay : ""}`}
                  style={{ width: `${Math.min(p.avancement_reel, 100)}%` }}
                />
                <div
                  className={styles.gaugeTarget}
                  style={{ left: `${Math.min(p.avancement_theorique, 100)}%` }}
                  title={t("chantiers.prevu", { taux: p.avancement_theorique, ecart: ecartSigne })}
                />
              </div>
            </div>
          </Link>
        );
      },
    },
    {
      cle: "budget",
      entete: t("chantiers.colBudget"),
      largeurMinimale: "165px",
      rendu: (p) => {
        if (p.budget_initial_montant === null || p.budget_initial_montant === undefined) {
          return (
            <div className={styles.budgetNonDefiniCell}>
              <span className={styles.budgetNonDefiniTexte}>
                {t("chantiers.budgetNonDefini")}
              </span>
              <button
                type="button"
                className={styles.btnDefinirBudget}
                onClick={() => setProjetPourBudget(p)}
              >
                {t("chantiers.definirBudget")}
              </button>
            </div>
          );
        }

        const initial = p.budget_initial_montant;
        const consomme = p.budget_consomme_montant ?? 0;
        const ratio = initial > 0 ? Math.round((consomme / initial) * 100) : 0;
        const estCritique = ratio > 100;
        const estAlerte = ratio > 80 && ratio <= 100;
        const classeBadge = estCritique
          ? styles.budgetRatioCritique
          : estAlerte
            ? styles.budgetRatioAlerte
            : styles.budgetRatioConforme;

        return (
          <div className={styles.budgetCell}>
            <div className={styles.budgetMontants}>
              <span className={styles.montantTab}>{formaterMontantCourt(consomme)}</span>
              <span className={styles.projetDetail}>/ {formaterMontantCourt(initial)}</span>
            </div>
            <span className={`${styles.budgetRatioBadge} ${classeBadge}`}>
              {estCritique
                ? t("chantiers.ratioDepassement", { taux: ratio })
                : t("chantiers.ratioConsommation", { taux: ratio })}
            </span>
          </div>
        );
      },
    },
    {
      cle: "rapport",
      entete: t("chantiers.colRapport"),
      largeurMinimale: "145px",
      rendu: (p) => (
        p.rapport_jour_statut === "SOUMIS" ? (
          <Badge variante="succes">
            <CheckCircle size={12} weight="bold" />
            <span>{t("chantiers.rapportSoumis", { heure: "17:30" })}</span>
          </Badge>
        ) : (
          <Badge variante="avertissement">
            <ClockCountdown size={12} weight="bold" />
            <span>{t("chantiers.rapportEnAttente")}</span>
          </Badge>
        )
      ),
    },
    {
      cle: "sante",
      entete: t("chantiers.colSante"),
      largeurMinimale: "90px",
      rendu: (p) => (
        <Badge variante="succes">
          <span>{p.indice_sante}/100</span>
        </Badge>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      {/* En-tête de pilotage & Actions rapides */}
      <header className={styles.entete}>
        <div>
          <h1 className={styles.titre}>{t("titre")}</h1>
          <p className={styles.sousTitre}>{t("sousTitre")}</p>
        </div>
        <div className={styles.actionsRapides}>
          <Link href="/rapports" style={{ textDecoration: "none" }}>
            <Bouton
              variante="secondaire"
              iconeGauche={<FileText size={16} weight="bold" />}
            >
              {t("actionRapport")}
            </Bouton>
          </Link>
          <Link href="/finance/bons-paiement" style={{ textDecoration: "none" }}>
            <Bouton
              variante="secondaire"
              iconeGauche={<CheckCircle size={16} weight="bold" />}
            >
              {t("actionMetres")}
            </Bouton>
          </Link>
          <Bouton
            variante="primaire"
            iconeGauche={<Plus size={16} weight="bold" />}
            onClick={() => setModalCreationOuverte(true)}
          >
            {t("actionNouveauProjet")}
          </Bouton>
        </div>
      </header>

      {/* Empty State valorisant — T-S1-04 */}
      {estSansChantier && (
        <Carte className={styles.emptyStateCarte}>
          <div className={styles.emptyStateIcone}>
            <BuildingOffice size={40} weight="duotone" style={{ color: "var(--color-primary-500, #D4652A)" }} />
          </div>
          <Badge variante="neutre">{t("emptyState.badgeSansChantier")}</Badge>
          <h2 className={styles.emptyStateTitre}>{t("emptyState.titre")}</h2>
          <p className={styles.emptyStateDescription}>{t("emptyState.description")}</p>
          <Bouton
            variante="primaire"
            taille="lg"
            iconeGauche={<Plus size={20} weight="bold" />}
            onClick={() => setModalCreationOuverte(true)}
          >
            {t("emptyState.actionCreer")}
          </Bouton>
        </Carte>
      )}

      {/* Alerte Intempéries dynamique (RG-12) */}
      {(() => {
        const alerte = data.alerte_intemperies || data.meteo?.alerte_intemperies;
        if (!alerte) return null;
        const conditionCle = (alerte as { condition?: string }).condition || "VARIABLE";
        const conditionTraduit = t(`navigation.meteo.condition.${conditionCle}`);
        const villeAlerte = (alerte as { ville?: string }).ville || data.meteo?.ville || "";

        return (
          <div style={{ marginBottom: "20px" }}>
            <Alerte
              type="avertissement"
              titre={t("alertes.intemperiesTitre", { projet: alerte.projet })}
              action={
                <Link href="/rapports" style={{ textDecoration: "none" }}>
                  <Bouton variante="secondaire" taille="sm">
                    {t("alertes.voirRapport")}
                  </Bouton>
                </Link>
              }
            >
              {t("alertes.intemperiesCorps", {
                projet: alerte.projet,
                ville: villeAlerte,
                condition: conditionTraduit,
              })}
            </Alerte>
          </div>
        );
      })()}

      {/* 4 Indicateurs clés (KPIs) BTP */}
      <section className={styles.grilleMetriques} aria-label={t("kpis.indicateursCles")}>
        {/* Tuile 1 : Chantiers en cours */}
        <Carte className={styles.metricCard}>
          <div className={styles.metricLabel}>
            <span>{t("kpis.chantiersActifs")}</span>
            <BuildingOffice size={18} style={{ color: "var(--color-primary-500, #D4652A)" }} />
          </div>
          <div className={styles.metricValue}>{metriques.chantiers_actifs}</div>
          <div className={styles.metricSub}>
            <Badge variante="succes">{t("kpis.conforme", { n: metriques.chantiers_conformes })}</Badge>
            {metriques.chantiers_en_retard > 0 ? (
              <Badge variante="avertissement">
                {t("kpis.retard", {
                  n: metriques.chantiers_en_retard,
                  jours: Math.max(
                    1,
                    Math.round(
                      Math.abs(projets.find((p) => p.ecart < -5)?.ecart ?? 10) / 2,
                    ),
                  ),
                })}
              </Badge>
            ) : null}
          </div>
        </Carte>

        {/* Tuile 2 : Santé moyenne portefeuille (D8) */}
        <Carte className={styles.metricCard}>
          <div className={styles.metricLabel}>
            <span>{t("kpis.santeMoyenne")}</span>
            <HardHat size={18} style={{ color: "var(--color-semantic-success, #166534)" }} />
          </div>
          <div className={styles.metricValue}>
            <span style={{ color: "var(--color-semantic-success, #166534)" }}>{metriques.sante_globale}</span>
            <span className={styles.metricValueTotal}>{t("kpis.surCent")}</span>
          </div>
          <div className={styles.metricSub}>
            <span>{t("kpis.securite", { taux: metriques.sante_details.securite })}</span>
            <span>-</span>
            <span>{t("kpis.delais", { taux: metriques.sante_details.delais })}</span>
            <span>-</span>
            <span>{t("kpis.budget", { taux: metriques.sante_details.budget })}</span>
          </div>
        </Carte>

        {/* Tuile 3 : Budget engagé vs total */}
        <Carte className={styles.metricCard}>
          <div className={styles.metricLabel}>
            <span>{t("kpis.budgetEngage")}</span>
            <CurrencyCircleDollar size={18} style={{ color: "var(--color-neutral-700, #4F4C47)" }} />
          </div>
          <div className={styles.metricValue}>
            <span>{formaterMontantCourt(metriques.budget_engage_montant)}</span>
            <span className={styles.metricValueTotal}>
              {" "}
              / {formaterMontantCourt(metriques.budget_total_montant)}
            </span>
          </div>
          {metriques.bons_a_signer_count > 0 ? (
            <div className={`${styles.metricSub} ${styles.alerteBdp}`}>
              <Warning size={14} weight="fill" />
              <span>
                {t("kpis.bonsASignerAlerte", {
                  n: metriques.bons_a_signer_count,
                  montant: formaterMontantCourt(metriques.bons_a_signer_montant),
                })}
              </span>
            </div>
          ) : null}
        </Carte>

        {/* Tuile 4 : Effectifs chantiers & Rapports */}
        <Carte className={styles.metricCard}>
          <div className={styles.metricLabel}>
            <span>{t("kpis.effectifs")}</span>
            <UsersThree size={18} style={{ color: "var(--color-neutral-700, #4F4C47)" }} />
          </div>
          <div className={styles.metricValue}>
            <span>{metriques.effectifs_sur_site.total}</span>
            <span className={styles.metricValueTotal}> {t("kpis.ouvriers")}</span>
          </div>
          <div className={styles.metricSub}>
            <span>
              {t("kpis.repartitionEffectifs", {
                regie: metriques.effectifs_sur_site.regie,
                tacherons: metriques.effectifs_sur_site.tacherons,
              })}
            </span>
            <span>-</span>
            <Badge variante="neutre">
              {t("kpis.rapportsTransmis", {
                soumis: metriques.rapports_journaliers.soumis,
                attendus: metriques.rapports_journaliers.attendus,
              })}
            </Badge>
          </div>
        </Carte>
      </section>

      {/* Grille principale 2 colonnes */}
      <div className={styles.grillePanneaux}>
        {/* Colonne gauche : Tableau de suivi d'avancement (Responsive Desktop + Mobile) */}
        <Carte
          className={`${styles.panneauTable} ${
            modeVue === "tableau"
              ? styles.forceTableau
              : modeVue === "cartes"
                ? styles.forceCartes
                : ""
          }`}
        >
          <div className={styles.tableHeader}>
            <div className={styles.tableHeaderInfo}>
              <div className={styles.tableTitle}>{t("chantiers.titre")}</div>
              <div className={styles.tableSub}>{t("chantiers.sousTitre")}</div>
            </div>
            <div className={styles.tableHeaderActions}>
              <Badge variante="neutre">
                {t("chantiers.compteur", { n: projets.length })}
              </Badge>
              <div className={styles.selecteurVue} role="group" aria-label={t("chantiers.titre")}>
                <button
                  type="button"
                  className={`${styles.btnVue} ${styles.btnVueTableau} ${
                    modeVue === "tableau" ? styles.btnVueActif : ""
                  }`}
                  onClick={() => setModeVue("tableau")}
                  title={t("chantiers.vueTableau")}
                  aria-pressed={modeVue === "tableau"}
                >
                  <Table size={15} weight={modeVue === "tableau" ? "bold" : "regular"} />
                  <span className={styles.btnVueTexte}>{t("chantiers.vueTableau")}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.btnVue} ${styles.btnVueCartes} ${
                    modeVue === "cartes" ? styles.btnVueActif : ""
                  }`}
                  onClick={() => setModeVue("cartes")}
                  title={t("chantiers.vueCartes")}
                  aria-pressed={modeVue === "cartes"}
                >
                  <SquaresFour size={15} weight={modeVue === "cartes" ? "bold" : "regular"} />
                  <span className={styles.btnVueTexte}>{t("chantiers.vueCartes")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Affichage Tableau (Tablette et Bureau par défaut) */}
          <div className={styles.tableauBureau}>
            <Tableau<ProjetDashboard>
              colonnes={colonnesChantiers}
              lignes={projets}
              cleLigne={(p) => p.id}
              sansBordure
            />
          </div>

          {/* Affichage Cartes Chantiers (Mobile par défaut) */}
          <div className={styles.listeChantiersMobile}>
            {projets.map((p) => {
              const estRetard = p.ecart < -5;
              const ecartSigne = p.ecart >= 0 ? `+${p.ecart}` : `${p.ecart}`;
              const initial = p.budget_initial_montant;
              const consomme = p.budget_consomme_montant ?? 0;
              const ratio = initial && initial > 0 ? Math.round((consomme / initial) * 100) : 0;
              const estCritique = ratio > 100;
              const estAlerte = ratio > 80 && ratio <= 100;
              const classeBadge = estCritique
                ? styles.budgetRatioCritique
                : estAlerte
                  ? styles.budgetRatioAlerte
                  : styles.budgetRatioConforme;

              return (
                <div key={p.id} className={styles.carteMobile}>
                  <div className={styles.carteMobileEntete}>
                    <div className={styles.carteMobileTitreBloc}>
                      <Link href={`/projets/${p.id}`} className={styles.carteMobileTitre}>
                        {p.nom}
                      </Link>
                      <span className={styles.carteMobileLocalisation}>
                        {t("chantiers.detailProjet", {
                          client: p.client_nom,
                          ville: p.ville,
                          quartier: p.quartier || t("chantiers.villeDefaut"),
                        })}
                      </span>
                    </div>
                    <div className={styles.carteMobileBadges}>
                      <Badge variante={estRetard ? "avertissement" : "succes"}>
                        {p.statut === "EN_COURS" ? t("chantiers.enCours") : t("chantiers.rapportEnAttente")}
                      </Badge>
                      <Badge variante="succes">
                        <span>{p.indice_sante}/100</span>
                      </Badge>
                    </div>
                  </div>

                  <div className={styles.carteMobileSectionAvancement}>
                    <div className={styles.carteMobileSectionHeader}>
                      <span className={styles.carteMobileSectionLabel}>{t("chantiers.labelAvancement")}</span>
                      <div className={styles.carteMobileAvancementChiffres}>
                        <span style={{ fontWeight: 600 }}>{t("chantiers.reel", { taux: p.avancement_reel })}</span>
                        <span style={{ color: "var(--color-neutral-500, #8A8680)" }}>
                          {t("chantiers.prevu", { taux: p.avancement_theorique, ecart: ecartSigne })}
                        </span>
                      </div>
                    </div>
                    <div className={styles.gaugeTrack}>
                      <div
                        className={`${styles.gaugeFill} ${estRetard ? styles.gaugeFillDelay : ""}`}
                        style={{ width: `${Math.min(p.avancement_reel, 100)}%` }}
                      />
                      <div
                        className={styles.gaugeTarget}
                        style={{ left: `${Math.min(p.avancement_theorique, 100)}%` }}
                        title={t("chantiers.prevu", { taux: p.avancement_theorique, ecart: ecartSigne })}
                      />
                    </div>
                  </div>

                  <div className={styles.carteMobileGrille}>
                    <div className={styles.carteMobileBloc}>
                      <span className={styles.carteMobileBlocLabel}>{t("chantiers.labelBudget")}</span>
                      {p.budget_initial_montant === null || p.budget_initial_montant === undefined ? (
                        <div className={styles.budgetNonDefiniCell}>
                          <span className={styles.budgetNonDefiniTexte}>
                            {t("chantiers.budgetNonDefini")}
                          </span>
                          <button
                            type="button"
                            className={styles.btnDefinirBudget}
                            onClick={() => setProjetPourBudget(p)}
                          >
                            {t("chantiers.definirBudget")}
                          </button>
                        </div>
                      ) : (
                        <div className={styles.budgetCell}>
                          <div className={styles.budgetMontants}>
                            <span className={styles.montantTab}>{formaterMontantCourt(consomme)}</span>
                            <span className={styles.projetDetail}>/ {formaterMontantCourt(initial)}</span>
                          </div>
                          <span className={`${styles.budgetRatioBadge} ${classeBadge}`}>
                            {estCritique
                              ? t("chantiers.ratioDepassement", { taux: ratio })
                              : t("chantiers.ratioConsommation", { taux: ratio })}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className={styles.carteMobileBloc}>
                      <span className={styles.carteMobileBlocLabel}>{t("chantiers.labelRapport")}</span>
                      {p.rapport_jour_statut === "SOUMIS" ? (
                        <Badge variante="succes">
                          <CheckCircle size={12} weight="bold" />
                          <span>{t("chantiers.rapportSoumis", { heure: "17:30" })}</span>
                        </Badge>
                      ) : (
                        <Badge variante="avertissement">
                          <ClockCountdown size={12} weight="bold" />
                          <span>{t("chantiers.rapportEnAttente")}</span>
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Link href={`/projets/${p.id}`} className={styles.carteMobilePied}>
                    <span>{t("chantiers.consulterChantier")}</span>
                    <ArrowRight size={14} weight="bold" />
                  </Link>
                </div>
              );
            })}
          </div>
        </Carte>

        {/* Colonne droite : Bons de paiement tâcherons & Matériaux */}
        <div className={styles.colonneDroite}>
          {/* Carte Bons de paiement à signer */}
          <Carte>
            <div className={styles.carteEntete}>
              <div className={styles.carteTitre}>
                <CurrencyCircleDollar size={18} style={{ color: "var(--color-primary-500, #D4652A)" }} />
                <span>{t("bdp.titre")}</span>
              </div>
              <Badge variante="avertissement">
                {t("bdp.compteur", {
                  n:
                    metriques.bons_a_signer_count ??
                    bons_paiement_a_valider.filter(
                      (b) => b.statut !== "SIGNE" && !bdpSignes[b.id],
                    ).length,
                })}
              </Badge>
            </div>
            <p style={{ fontSize: "12px", color: "var(--color-neutral-500, #8A8680)", marginBottom: "12px" }}>
              {t("bdp.sousTitre")}
            </p>

            {messageSignature && (
              <div style={{ marginBottom: "12px" }}>
                <Alerte type={messageSignature.type === "succes" ? "succes" : "erreur"}>
                  {messageSignature.texte}
                </Alerte>
              </div>
            )}

            <div>
              {bons_paiement_a_valider.map((bdp: BonPaiementDashboard) => {
                const estSigne = !!bdpSignes[bdp.id] || bdp.statut === "SIGNE";
                const enCours = !!enCoursSignature[bdp.id];

                return (
                  <div key={bdp.id} className={styles.bdpItem}>
                    <div>
                      <div className={styles.bdpNom}>{bdp.beneficiaire}</div>
                      <div className={styles.bdpLot}>
                        {t("bdp.detailLot", { lot: bdp.corps_etat, ref: bdp.reference })}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className={styles.bdpMontant}>{formaterMontant(bdp.montant)}</span>
                      <Bouton
                        variante={estSigne ? "ghost" : "secondaire"}
                        taille="sm"
                        iconeGauche={estSigne ? <CheckCircle size={14} weight="bold" /> : undefined}
                        disabled={estSigne || enCours}
                        onClick={() => handleSignerBdp(bdp)}
                      >
                        {enCours
                          ? t("bdp.signatureEnCours")
                          : estSigne
                            ? t("bdp.signe")
                            : t("bdp.actionSigner")}
                      </Bouton>
                    </div>
                  </div>
                );
              })}
            </div>
          </Carte>

          {/* Carte Réceptions de matériaux */}
          <Carte>
            <div className={styles.carteEntete}>
              <div className={styles.carteTitre}>
                <HardHat size={18} style={{ color: "var(--color-neutral-700, #4F4C47)" }} />
                <span>{t("materiaux.titre")}</span>
              </div>
            </div>
            <ul className={styles.listeMateriaux}>
              {receptions_materiaux.map((mat) => (
                <li key={mat.id} className={styles.materiauItem}>
                  {mat.conforme ? (
                    <CheckCircle size={16} weight="fill" style={{ color: "var(--color-semantic-success, #166534)" }} />
                  ) : (
                    <ClockCountdown size={16} weight="fill" style={{ color: "var(--color-semantic-warning, #B45309)" }} />
                  )}
                  <span>
                    <strong>{mat.projet} :</strong> {mat.description}
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        </div>
      </div>

      <ModalCreationProjet
        ouverte={modalCreationOuverte}
        onFermer={() => setModalCreationOuverte(false)}
        onProjetCree={handleProjetCree}
      />
      <ModalDefinirBudget
        ouverte={Boolean(projetPourBudget)}
        projet={projetPourBudget}
        onFermer={() => setProjetPourBudget(null)}
        onBudgetEnregistre={handleBudgetEnregistre}
      />
    </div>
  );
}

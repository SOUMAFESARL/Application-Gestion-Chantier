"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bank,
  Buildings,
  Check,
  CheckCircle,
  Clock,
  CreditCard,
  DeviceMobile,
  DownloadSimple,
  Eye,
  FileText,
  HardDrive,
  Info,
  Lock,
  Printer,
  Receipt,
  ShieldCheck,
  Sparkle,
  Tag,
  Users,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ClientOHADA,
  FactureLegaleData,
  ModalFacture,
} from "@/components/facture";
import { obtenirTauxTVA, TAUX_TVA_OHADA } from "@/lib/format/taxesEtChiffres";

import {
  ForfaitBTP,
  FORFAITS_BTP,
  MOYENS_PAIEMENT,
  MoyenPaiementId,
  OptionPaiement,
  TransactionPaiement,
} from "@/features/abonnement/mockData";
import {
  InitiationPaiementPayload,
  obtenirCataloguePlans,
  simulerPaiement,
} from "@/features/abonnement/api";

import styles from "./page.module.css";

type EtapeFlux = "TARIFS" | "PAIEMENT" | "CONFIRMATION";

export default function PageAbonnement() {
  const [etape, setEtape] = useState<EtapeFlux>("TARIFS");
  const [cycle, setCycle] = useState<"MENSUEL" | "ANNUEL">("MENSUEL");
  const [plans, setPlans] = useState<ForfaitBTP[]>(FORFAITS_BTP);
  const [planSelectionne, setPlanSelectionne] = useState<ForfaitBTP>(FORFAITS_BTP[1]); // Maître d'Œuvre par défaut
  const [moyenChoisi, setMoyenChoisi] = useState<MoyenPaiementId>("WAVE");

  // Formulaire de paiement
  const [indicatif, setIndicatif] = useState("+225");
  const [telephone, setTelephone] = useState("07 48 92 10 33");
  const [nomTitulaire, setNomTitulaire] = useState("Amadou Kouassi");
  const [numeroCarte, setNumeroCarte] = useState("4152 8900 1234 5678");
  const [dateExp, setDateExp] = useState("09/28");
  const [cvv, setCvv] = useState("382");
  const [nomEntreprise, setNomEntreprise] = useState("SOUMAFE BTP Sarl");
  const [emailFacturation, setEmailFacturation] = useState("direction@soumafe-btp.ci");

  // État de transaction
  const [chargementPaiement, setChargementPaiement] = useState(false);
  const [transaction, setTransaction] = useState<TransactionPaiement | null>(null);
  const [messageToast, setMessageToast] = useState<string | null>(null);

  // Informations fiscales & facture OHADA
  const [modalFactureOuverte, setModalFactureOuverte] = useState(false);
  const [rccmClient, setRccmClient] = useState("CI-ABJ-2024-B-12984");
  const [nifClient, setNifClient] = useState("2412890 A");
  const [adresseClient, setAdresseClient] = useState("Cocody Riviera 3, Boulevard de Marseille");
  const [paysClient, setPaysClient] = useState("CI");

  useEffect(() => {
    obtenirCataloguePlans().then((data) => {
      setPlans(data);
      // Réaligner le plan sélectionné si disponible
      const courant = data.find((p) => p.code === planSelectionne.code);
      if (courant) setPlanSelectionne(courant);
    });
  }, []);

  const formatFcfa = (montant: number) => {
    return new Intl.NumberFormat("fr-FR").format(montant) + " FCFA";
  };

  const gererChoixPlan = (forfait: ForfaitBTP) => {
    setPlanSelectionne(forfait);
    setEtape("PAIEMENT");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const executerPaiement = async (e: React.FormEvent) => {
    e.preventDefault();
    setChargementPaiement(true);

    const payload: InitiationPaiementPayload = {
      planCode: planSelectionne.code,
      cycle,
      moyenPaiementId: moyenChoisi,
      telephone: `${indicatif} ${telephone}`,
      nomTitulaire,
      numeroCarte,
      dateExp,
      cvv,
      nomEntreprise,
      emailFacturation,
    };

    try {
      const res = await simulerPaiement(payload);
      setTransaction(res);
      setEtape("CONFIRMATION");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      alert("Une erreur est survenue lors de l'initiation du paiement.");
    } finally {
      setChargementPaiement(false);
    }
  };

  const montantActuel = cycle === "ANNUEL" ? planSelectionne.prixAnnuelFcfa : planSelectionne.prixMensuelFcfa;
  const economieAnnuelle = (planSelectionne.prixMensuelFcfa * 12) - planSelectionne.prixAnnuelFcfa;

  // TVA dynamique selon le pays sélectionné
  const infoTva = obtenirTauxTVA(paysClient);
  const montantHtActuel = Math.round(montantActuel / (1 + infoTva.taux / 100));
  const montantTvaActuel = montantActuel - montantHtActuel;

  // Données de facture officielle OHADA
  const donneesFacture: FactureLegaleData | null = transaction
    ? (() => {
        const totalTtc = transaction.montantTotalFcfa;
        const totalHt = Math.round(totalTtc / (1 + infoTva.taux / 100));
        const montantTva = totalTtc - totalHt;
        return {
          numero: transaction.referenceFacture,
          dateEmission: transaction.datePaiement.split(" à ")[0] || "17 septembre 2026",
          dateEcheance: "Comptant (Acquittée)",
          periodeDebut: "17/09/2026",
          periodeFin: cycle === "ANNUEL" ? "16/09/2027" : "16/10/2026",
          statut: "ACQUITTEE" as const,
          referenceTransaction: transaction.idTransaction,
          moyenPaiementNom: transaction.moyenPaiement.nom,
          datePaiementEffectif: transaction.datePaiement,
          lignes: [
            {
              code: `SUB-${transaction.forfait.code.slice(0, 3)}`,
              designation: `Abonnement CCD Digital — Forfait ${transaction.forfait.libelle}`,
              descriptionDetaillee: `Licence logicielle BTP (${cycle === "ANNUEL" ? "Cycle Annuel" : "Cycle Mensuel"}). Accès illimité aux modules chantiers selon quotas souscrits.`,
              quantite: 1,
              prixUnitaireHtFcfa: totalHt,
              totalHtFcfa: totalHt,
            },
          ],
          sousTotalHtFcfa: totalHt,
          tauxTvaPourcent: infoTva.taux,
          libelleTva: infoTva.libelleTaxe,
          montantTvaFcfa: montantTva,
          totalTtcFcfa: totalTtc,
        };
      })()
    : null;

  const coordonneesClient: ClientOHADA = {
    raisonSociale: nomEntreprise,
    rccm: rccmClient,
    nif: nifClient,
    adresse: adresseClient,
    ville: "Abidjan",
    pays: infoTva.nomPays,
    codePays: paysClient,
    emailContact: emailFacturation,
    telephoneContact: `${indicatif} ${telephone}`,
  };

  const telechargerFacture = () => {
    setModalFactureOuverte(true);
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.print();
      }
    }, 300);
  };

  return (
    <div className={styles.conteneur}>
      {/* 1. Stepper d'avancement */}
      <nav className={styles.stepper} aria-label="Progression du paiement">
        <div
          className={`${styles.stepItem} ${etape === "TARIFS" ? styles.stepActive : styles.stepPast}`}
          onClick={() => setEtape("TARIFS")}
          style={{ cursor: "pointer" }}
        >
          <span className={styles.stepNumero}>{etape !== "TARIFS" ? <Check size={14} weight="bold" /> : "1"}</span>
          <span>Formule & Tarifs</span>
        </div>
        <div className={styles.stepSeparateur} />
        <div
          className={`${styles.stepItem} ${
            etape === "PAIEMENT" ? styles.stepActive : etape === "CONFIRMATION" ? styles.stepPast : ""
          }`}
          onClick={() => {
            if (etape === "CONFIRMATION") setEtape("PAIEMENT");
          }}
          style={{ cursor: etape === "CONFIRMATION" ? "pointer" : "default" }}
        >
          <span className={styles.stepNumero}>
            {etape === "CONFIRMATION" ? <Check size={14} weight="bold" /> : "2"}
          </span>
          <span>Paiement CinetPay</span>
        </div>
        <div className={styles.stepSeparateur} />
        <div className={`${styles.stepItem} ${etape === "CONFIRMATION" ? styles.stepActive : ""}`}>
          <span className={styles.stepNumero}>3</span>
          <span>Confirmation</span>
        </div>
      </nav>

      {/* ================================================================
          ETAPE 1 : GRILLE DES TARIFS
          ================================================================ */}
      {etape === "TARIFS" && (
        <section>
          <header className={styles.entete}>
            <div className={styles.badgeHeader}>
              <Sparkle size={14} weight="fill" />
              <span>Forfaits Spécialisés BTP & Travaux Publics</span>
            </div>
            <h1 className={styles.titre}>Choisissez l&apos;abonnement adapté à votre entreprise</h1>
            <p className={styles.sousTitre}>
              Digitalisez le suivi de vos chantiers en temps réel. Sans engagement de durée, changez ou résiliez à
              tout moment en 1 clic.
            </p>

            {/* Commutateur Mensuel / Annuel */}
            <div className={styles.togglePeriode}>
              <span
                className={`${styles.toggleLabel} ${cycle === "MENSUEL" ? styles.toggleLabelActif : ""}`}
                onClick={() => setCycle("MENSUEL")}
              >
                Facturation mensuelle
              </span>
              <button
                type="button"
                className={`${styles.switch} ${cycle === "ANNUEL" ? styles.switchAnnuel : ""}`}
                onClick={() => setCycle(cycle === "MENSUEL" ? "ANNUEL" : "MENSUEL")}
                aria-label="Basculer entre facturation mensuelle et annuelle"
              >
                <span className={styles.switchPoignee} />
              </button>
              <span
                className={`${styles.toggleLabel} ${cycle === "ANNUEL" ? styles.toggleLabelActif : ""}`}
                onClick={() => setCycle("ANNUEL")}
              >
                Facturation annuelle
              </span>
              <span className={styles.badgeEconomie}>
                <Tag size={12} weight="bold" /> 2 mois offerts (-15%)
              </span>
            </div>
          </header>

          {/* Grille des 3 forfaits */}
          <div className={styles.grilleForfaits}>
            {plans.map((forfait) => {
              const estPopulaire = forfait.code === "MAITRE_OEUVRE";
              const prix = cycle === "ANNUEL" ? forfait.prixAnnuelFcfa : forfait.prixMensuelFcfa;
              const equivalentMois = cycle === "ANNUEL" ? Math.round(forfait.prixAnnuelFcfa / 12) : forfait.prixMensuelFcfa;

              return (
                <article
                  key={forfait.code}
                  className={`${styles.carteForfait} ${estPopulaire ? styles.cartePopulaire : ""}`}
                >
                  {forfait.badge && <div className={styles.badgePopulaire}>{forfait.badge}</div>}

                  <h2 className={styles.forfaitNom}>{forfait.libelle}</h2>
                  <p className={styles.forfaitDescription}>{forfait.description}</p>

                  <div className={styles.prixBloc}>
                    <span className={styles.prixMontant}>{formatFcfa(prix)}</span>
                    <span className={styles.prixUnite}>/ {cycle === "ANNUEL" ? "an" : "mois"}</span>
                  </div>
                  <div className={styles.prixSousTexte}>
                    {cycle === "ANNUEL" ? (
                      <span>Soit ~{formatFcfa(equivalentMois)} / mois (facturé annuellement)</span>
                    ) : (
                      <span>Facturation mensuelle sans engagement</span>
                    )}
                  </div>

                  {/* Quotas clés */}
                  <div className={styles.quotasResume}>
                    <div className={styles.quotaItem}>
                      <Buildings size={16} weight="duotone" className={styles.quotaIcone} />
                      <span>{forfait.limiteChantiers ? `${forfait.limiteChantiers} chantiers` : "Chantiers illimités"}</span>
                    </div>
                    <div className={styles.quotaItem}>
                      <Users size={16} weight="duotone" className={styles.quotaIcone} />
                      <span>{forfait.limiteUtilisateurs ? `${forfait.limiteUtilisateurs} utilisateurs` : "Utilisateurs illimités"}</span>
                    </div>
                    <div className={styles.quotaItem}>
                      <HardDrive size={16} weight="duotone" className={styles.quotaIcone} />
                      <span>{forfait.limiteStockageGo} Go stockage</span>
                    </div>
                    <div className={styles.quotaItem}>
                      <Sparkle size={16} weight="duotone" className={styles.quotaIcone} />
                      <span>{forfait.accesIA ? "Module IA inclus" : "Sans module IA"}</span>
                    </div>
                  </div>

                  {/* Liste des fonctionnalités */}
                  <ul className={styles.listeFonctionnalites}>
                    {forfait.caracteristiques.map((item, idx) => (
                      <li key={idx} className={styles.itemFonctionnalite}>
                        <Check size={16} weight="bold" className={styles.iconeCheck} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className={`${styles.btnChoisir} ${estPopulaire ? styles.btnChoisirPopulaire : ""}`}
                    onClick={() => gererChoixPlan(forfait)}
                  >
                    <span>Passer au forfait {forfait.libelle}</span>
                    <ArrowRight size={16} weight="bold" />
                  </button>
                </article>
              );
            })}
          </div>

          {/* Section Réassurance */}
          <div className={styles.reassuranceSection}>
            <div className={styles.reassuranceItem}>
              <ShieldCheck size={28} weight="duotone" className={styles.reassuranceIcone} />
              <div>
                <h3 className={styles.reassuranceTitre}>Passerelle CinetPay 100% Sécurisée</h3>
                <p className={styles.reassuranceTexte}>
                  Agrément BCEAO, chiffrement bancaire SSL 256-bits. Vos transactions Mobile Money et cartes sont
                  protégées.
                </p>
              </div>
            </div>
            <div className={styles.reassuranceItem}>
              <Receipt size={28} weight="duotone" className={styles.reassuranceIcone} />
              <div>
                <h3 className={styles.reassuranceTitre}>Facture Fiscale Déductible</h3>
                <p className={styles.reassuranceTexte}>
                  Facture conforme émise automatiquement avec mentions de votre entreprise (NCC / RCCM) pour votre
                  comptabilité.
                </p>
              </div>
            </div>
            <div className={styles.reassuranceItem}>
              <Clock size={28} weight="duotone" className={styles.reassuranceIcone} />
              <div>
                <h3 className={styles.reassuranceTitre}>Activation & Prise en main directe</h3>
                <p className={styles.reassuranceTexte}>
                  Votre compte et vos nouveaux quotas sont actualisés instantanément dès confirmation du paiement.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          ETAPE 2 : CHOIX DU MOYEN DE PAIEMENT & FORMULAIRE
          ================================================================ */}
      {etape === "PAIEMENT" && (
        <section className={styles.layoutPaiement}>
          <div className={styles.colonnePaiement}>
            <button
              type="button"
              className={styles.btnRetourForfaits}
              onClick={() => setEtape("TARIFS")}
              style={{ justifyContent: "flex-start", padding: 0 }}
            >
              <ArrowLeft size={16} weight="bold" />
              <span>Modifier le forfait choisi</span>
            </button>

            {/* Carte de sélection des moyens */}
            <div className={styles.carteSection}>
              <h2 className={styles.sectionTitre}>
                <CreditCard size={22} weight="duotone" />
                <span>Sélectionnez votre moyen de règlement</span>
              </h2>
              <p className={styles.sectionDescription}>
                Réglez par Mobile Money (Orange, Wave, MTN, Moov), Carte Bancaire ou Virement d&apos;entreprise.
              </p>

              {/* Tuiles de moyens de paiement */}
              <div className={styles.grilleMoyens}>
                {MOYENS_PAIEMENT.map((moyen) => {
                  const estActif = moyenChoisi === moyen.id;
                  return (
                    <button
                      key={moyen.id}
                      type="button"
                      className={`${styles.tuileMoyen} ${estActif ? styles.tuileMoyenActive : ""}`}
                      onClick={() => setMoyenChoisi(moyen.id)}
                    >
                      <div className={styles.tuileEntete}>
                        <span className={styles.badgeMoyen}>
                          {moyen.categorie === "MOBILE_MONEY" && <DeviceMobile size={18} weight="duotone" />}
                          {moyen.categorie === "CARTE" && <CreditCard size={18} weight="duotone" />}
                          {moyen.categorie === "VIREMENT" && <Bank size={18} weight="duotone" />}
                          {moyen.nom}
                        </span>
                        {moyen.id === "WAVE" && <span className={`${styles.tagMoyen} ${styles.tagWave}`}>Wave</span>}
                        {moyen.id === "ORANGE_MONEY" && <span className={`${styles.tagMoyen} ${styles.tagOrange}`}>Orange</span>}
                        {moyen.id === "MTN_MOMO" && <span className={`${styles.tagMoyen} ${styles.tagMtn}`}>MTN</span>}
                        {moyen.id === "MOOV_MONEY" && <span className={`${styles.tagMoyen} ${styles.tagMoov}`}>Moov</span>}
                      </div>
                      <span className={styles.tuileDesc}>{moyen.description}</span>
                    </button>
                  );
                })}
              </div>

              {/* Formulaire dynamique selon moyen choisi */}
              <form onSubmit={executerPaiement} className={styles.formulairePaiement}>
                {/* 1. Cas Mobile Money */}
                {(moyenChoisi === "WAVE" ||
                  moyenChoisi === "ORANGE_MONEY" ||
                  moyenChoisi === "MTN_MOMO" ||
                  moyenChoisi === "MOOV_MONEY") && (
                  <>
                    <div className={styles.champGroupe}>
                      <label className={styles.champLabel}>Numéro de téléphone du compte Mobile Money</label>
                      <div className={styles.champLigneTel}>
                        <select
                          className={styles.selectIndicatif}
                          value={indicatif}
                          onChange={(e) => setIndicatif(e.target.value)}
                        >
                          <option value="+225">CI (+225)</option>
                          <option value="+221">SN (+221)</option>
                          <option value="+223">ML (+223)</option>
                          <option value="+226">BF (+226)</option>
                          <option value="+229">BJ (+229)</option>
                          <option value="+228">TG (+228)</option>
                        </select>
                        <input
                          type="tel"
                          required
                          className={styles.champInput}
                          placeholder="Ex : 07 08 09 10 11"
                          value={telephone}
                          onChange={(e) => setTelephone(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={styles.aideTerrain}>
                      <Info size={20} weight="duotone" className={styles.aideIcone} />
                      <div>
                        <strong>Validation instantanée sur mobile :</strong> Dès que vous cliquerez sur Payer, une
                        invitation de paiement sera envoyée sur votre téléphone {indicatif} {telephone}. Saisissez votre code
                        secret pour valider.
                      </div>
                    </div>
                  </>
                )}

                {/* 2. Cas Carte Bancaire */}
                {moyenChoisi === "CARTE_BANCAIRE" && (
                  <>
                    <div className={styles.champGroupe}>
                      <label className={styles.champLabel}>Nom sur la carte</label>
                      <input
                        type="text"
                        required
                        className={styles.champInput}
                        placeholder="Ex : KOUASSI AMADOU"
                        value={nomTitulaire}
                        onChange={(e) => setNomTitulaire(e.target.value)}
                      />
                    </div>
                    <div className={styles.champGroupe}>
                      <label className={styles.champLabel}>Numéro de carte Visa ou Mastercard</label>
                      <input
                        type="text"
                        required
                        className={styles.champInput}
                        placeholder="4152 •••• •••• 5678"
                        value={numeroCarte}
                        onChange={(e) => setNumeroCarte(e.target.value)}
                      />
                    </div>
                    <div className={styles.champLigneDouble}>
                      <div className={styles.champGroupe}>
                        <label className={styles.champLabel}>Date expiration (MM/AA)</label>
                        <input
                          type="text"
                          required
                          className={styles.champInput}
                          placeholder="12/28"
                          value={dateExp}
                          onChange={(e) => setDateExp(e.target.value)}
                        />
                      </div>
                      <div className={styles.champGroupe}>
                        <label className={styles.champLabel}>Cryptogramme (CVV)</label>
                        <input
                          type="password"
                          maxLength={4}
                          required
                          className={styles.champInput}
                          placeholder="123"
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* 3. Cas Virement Bancaire */}
                {moyenChoisi === "VIREMENT" && (
                  <div className={styles.virementBox}>
                    <p style={{ fontWeight: 600, color: "var(--color-neutral-900)" }}>
                      Coordonnées bancaires pour virement d&apos;entreprise :
                    </p>
                    <div className={styles.virementLigne}>
                      <span className={styles.virementLabel}>Banque partenaire :</span>
                      <span className={styles.virementValeur}>Société Générale CI</span>
                    </div>
                    <div className={styles.virementLigne}>
                      <span className={styles.virementLabel}>Titulaire du compte :</span>
                      <span className={styles.virementValeur}>CCD DIGITAL SAS</span>
                    </div>
                    <div className={styles.virementLigne}>
                      <span className={styles.virementLabel}>IBAN / Compte :</span>
                      <span className={styles.virementValeur}>CI058 01001 002345678901 44</span>
                    </div>
                    <div className={styles.virementLigne}>
                      <span className={styles.virementLabel}>Référence obligatoire :</span>
                      <span className={styles.virementValeur}>VIR-SOUMAFE-{planSelectionne.code}</span>
                    </div>
                  </div>
                )}

                {/* Coordonnées de facturation */}
                <h3 className={styles.sectionTitre} style={{ marginTop: "var(--space-3)", fontSize: "1rem" }}>
                  <Receipt size={18} weight="duotone" />
                  <span>Informations de facturation (Normes OHADA)</span>
                </h3>

                <div className={styles.champLigneDouble}>
                  <div className={styles.champGroupe}>
                    <label className={styles.champLabel}>Nom / Raison sociale de l&apos;entreprise</label>
                    <input
                      type="text"
                      required
                      className={styles.champInput}
                      value={nomEntreprise}
                      onChange={(e) => setNomEntreprise(e.target.value)}
                    />
                  </div>
                  <div className={styles.champGroupe}>
                    <label className={styles.champLabel}>Email pour envoi de la facture</label>
                    <input
                      type="email"
                      required
                      className={styles.champInput}
                      value={emailFacturation}
                      onChange={(e) => setEmailFacturation(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.champLigneDouble}>
                  <div className={styles.champGroupe}>
                    <label className={styles.champLabel}>Pays fiscal (Taux TVA applicable)</label>
                    <select
                      className={styles.champInput}
                      value={paysClient}
                      onChange={(e) => setPaysClient(e.target.value)}
                    >
                      {Object.values(TAUX_TVA_OHADA).map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.nomPays} — {p.taux}% ({p.zone})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.champGroupe}>
                    <label className={styles.champLabel}>Adresse du siège social</label>
                    <input
                      type="text"
                      className={styles.champInput}
                      value={adresseClient}
                      onChange={(e) => setAdresseClient(e.target.value)}
                      placeholder="Ex: Cocody, Bd de Marseille"
                    />
                  </div>
                </div>

                <div className={styles.champLigneDouble}>
                  <div className={styles.champGroupe}>
                    <label className={styles.champLabel}>Numéro RCCM (facultatif si en cours)</label>
                    <input
                      type="text"
                      className={styles.champInput}
                      value={rccmClient}
                      onChange={(e) => setRccmClient(e.target.value)}
                      placeholder="Ex: CI-ABJ-2024-B-12984"
                    />
                  </div>
                  <div className={styles.champGroupe}>
                    <label className={styles.champLabel}>Numéro NIF / NCC</label>
                    <input
                      type="text"
                      className={styles.champInput}
                      value={nifClient}
                      onChange={(e) => setNifClient(e.target.value)}
                      placeholder="Ex: 2412890 A"
                    />
                  </div>
                </div>

                <button type="submit" disabled={chargementPaiement} className={styles.btnPayer}>
                  {chargementPaiement ? (
                    <span>Traitement sécurisé CinetPay en cours...</span>
                  ) : (
                    <>
                      <Lock size={18} weight="bold" />
                      <span>Régler {formatFcfa(montantActuel)} en toute sécurité</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Colonne latérale récapitulatif */}
          <aside className={styles.recapitulatifSticky}>
            <div className={styles.carteSection}>
              <h2 className={styles.sectionTitre}>
                <Receipt size={20} weight="duotone" />
                <span>Récapitulatif de la commande</span>
              </h2>

              <div className={styles.recapLigne}>
                <span>Forfait souscrit</span>
                <strong>{planSelectionne.libelle}</strong>
              </div>
              <div className={styles.recapLigne}>
                <span>Périodicité</span>
                <span>{cycle === "ANNUEL" ? "Annuelle (12 mois)" : "Mensuelle (1 mois)"}</span>
              </div>
              <div className={styles.recapLigne}>
                <span>Mode sélectionné</span>
                <span>
                  {MOYENS_PAIEMENT.find((m) => m.id === moyenChoisi)?.nom.split("(")[0]}
                </span>
              </div>

              {cycle === "ANNUEL" && (
                <div className={styles.recapLigne} style={{ color: "var(--color-semantic-success)" }}>
                  <span>Remise annuelle (2 mois offerts)</span>
                  <strong>- {formatFcfa(economieAnnuelle)}</strong>
                </div>
              )}

              <div className={styles.recapLigne}>
                <span>Sous-total HT</span>
                <span>{formatFcfa(montantHtActuel)}</span>
              </div>

              <div className={styles.recapLigne}>
                <span>{infoTva.libelleTaxe} ({infoTva.taux}%)</span>
                <span>{formatFcfa(montantTvaActuel)}</span>
              </div>

              <div className={styles.recapTotal}>
                <span className={styles.recapTotalLabel}>Total TTC à régler</span>
                <span className={styles.recapTotalMontant}>{formatFcfa(montantActuel)}</span>
              </div>

              {/* Inclus immédiatement */}
              <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-neutral-200)" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-neutral-800)", display: "block", marginBottom: "var(--space-2)" }}>
                  Inclus dès confirmation :
                </span>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li className={styles.itemFonctionnalite} style={{ fontSize: "0.8125rem", marginBottom: "6px" }}>
                    <Check size={14} weight="bold" className={styles.iconeCheck} />
                    <span>{planSelectionne.limiteChantiers ? `${planSelectionne.limiteChantiers} chantiers simultanés` : "Chantiers illimités"}</span>
                  </li>
                  <li className={styles.itemFonctionnalite} style={{ fontSize: "0.8125rem", marginBottom: "6px" }}>
                    <Check size={14} weight="bold" className={styles.iconeCheck} />
                    <span>{planSelectionne.limiteUtilisateurs ? `${planSelectionne.limiteUtilisateurs} collaborateurs` : "Collaborateurs illimités"}</span>
                  </li>
                  <li className={styles.itemFonctionnalite} style={{ fontSize: "0.8125rem", marginBottom: "6px" }}>
                    <Check size={14} weight="bold" className={styles.iconeCheck} />
                    <span>{planSelectionne.limiteStockageGo} Go stockage documents & photos</span>
                  </li>
                  {planSelectionne.accesIA && (
                    <li className={styles.itemFonctionnalite} style={{ fontSize: "0.8125rem" }}>
                      <Check size={14} weight="bold" className={styles.iconeCheck} />
                      <span>Module IA & assistance rédactionnelle</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </aside>
        </section>
      )}

      {/* ================================================================
          ETAPE 3 : CONFIRMATION & REÇU
          ================================================================ */}
      {etape === "CONFIRMATION" && transaction && (
        <section className={styles.conteneurConfirmation}>
          <div className={styles.carteConfirmation}>
            <div className={styles.iconeSuccesAnim}>
              <CheckCircle size={44} weight="fill" />
            </div>

            <h1 className={styles.titreConfirmation}>Paiement réussi avec succès !</h1>
            <p className={styles.texteConfirmation}>
              Félicitations, votre compte est désormais actif sur la formule{" "}
              <strong>{transaction.forfait.libelle}</strong>. Vos nouveaux quotas et fonctionnalités sont
              immédiatement débloqués pour toute votre équipe.
            </p>

            {/* Reçu officiel */}
            <div className={styles.recuFacture}>
              <div className={styles.recuEntete}>
                <span className={styles.recuTitre}>Bordereau de transaction CinetPay</span>
                <span className={styles.recuBadgeStatut}>
                  <Check size={12} weight="bold" /> Paiement validé
                </span>
              </div>

              <div className={styles.grilleRecu}>
                <div className={styles.recuItem}>
                  <span className={styles.recuItemLabel}>Référence transaction</span>
                  <span className={styles.recuItemValeur}>{transaction.idTransaction}</span>
                </div>
                <div className={styles.recuItem}>
                  <span className={styles.recuItemLabel}>Numéro de facture</span>
                  <span className={styles.recuItemValeur}>{transaction.referenceFacture}</span>
                </div>
                <div className={styles.recuItem}>
                  <span className={styles.recuItemLabel}>Date et heure</span>
                  <span className={styles.recuItemValeur}>{transaction.datePaiement}</span>
                </div>
                <div className={styles.recuItem}>
                  <span className={styles.recuItemLabel}>Mode de paiement</span>
                  <span className={styles.recuItemValeur}>{transaction.moyenPaiement.nom}</span>
                </div>
                <div className={styles.recuItem}>
                  <span className={styles.recuItemLabel}>Entreprise titulaire</span>
                  <span className={styles.recuItemValeur}>{nomEntreprise}</span>
                </div>
                <div className={styles.recuItem}>
                  <span className={styles.recuItemLabel}>Montant débité</span>
                  <span className={`${styles.recuItemValeur} ${styles.recuItemMontant}`}>
                    {formatFcfa(transaction.montantTotalFcfa)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.actionsConfirmation}>
              <button
                type="button"
                onClick={() => setModalFactureOuverte(true)}
                className={styles.btnDashboard}
                style={{ background: "var(--color-primary-600)", gap: "8px" }}
              >
                <FileText size={18} weight="bold" />
                <span>Voir la facture officielle OHADA</span>
              </button>
              <button
                type="button"
                onClick={telechargerFacture}
                className={styles.btnTelechargerFacture}
                style={{ gap: "8px" }}
              >
                <Printer size={18} weight="bold" />
                <span>Imprimer / Enregistrer en PDF</span>
              </button>
            </div>

            <div style={{ marginTop: "var(--space-3)", display: "flex", justifyContent: "center" }}>
              <Link href="/tableau-de-bord" className={styles.btnDashboard} style={{ background: "var(--color-neutral-800)" }}>
                <span>Accéder au tableau de bord</span>
                <ArrowRight size={16} weight="bold" />
              </Link>
            </div>

            {messageToast && <div className={styles.toastFacture}>{messageToast}</div>}

            <div style={{ marginTop: "var(--space-6)" }}>
              <button
                type="button"
                className={styles.btnRetourForfaits}
                onClick={() => setEtape("TARIFS")}
              >
                <span>Changer ou tester un autre forfait</span>
              </button>
            </div>

            {/* Modale d'affichage de la facture officielle OHADA */}
            {donneesFacture && (
              <ModalFacture
                ouvert={modalFactureOuverte}
                onFermer={() => setModalFactureOuverte(false)}
                facture={donneesFacture}
                client={coordonneesClient}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

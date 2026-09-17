"use client";

import {
  CheckCircle,
  Clock,
  Printer,
  ShieldCheck,
  XCircle,
} from "@phosphor-icons/react";
import React from "react";

import { arreteFactureEnLettres, obtenirTauxTVA } from "@/lib/format/taxesEtChiffres";

import styles from "./FactureLegaleOHADA.module.css";
import {
  ClientOHADA,
  EMETTEUR_CCD_DIGITAL_PAR_DEFAUT,
  EmetteurOHADA,
  FactureLegaleData,
} from "./types";

export interface FactureLegaleOHADAProps {
  facture: FactureLegaleData;
  emetteur?: EmetteurOHADA;
  client: ClientOHADA;
  afficherBarreOutils?: boolean;
  surFermer?: () => void;
}

export function FactureLegaleOHADA({
  facture,
  emetteur = EMETTEUR_CCD_DIGITAL_PAR_DEFAUT,
  client,
  afficherBarreOutils = true,
  surFermer,
}: FactureLegaleOHADAProps) {
  // Calcul ou réconciliation de la TVA dynamique selon le pays
  const infoTvaPays = obtenirTauxTVA(client.codePays || client.pays);
  const tauxTvaEffectif = facture.tauxTvaPourcent ?? infoTvaPays.taux;
  const libelleTvaEffectif = facture.libelleTva || infoTvaPays.libelleTaxe;

  const formaterFcfa = (valeur: number) => {
    return new Intl.NumberFormat("fr-FR").format(Math.round(valeur)) + " FCFA";
  };

  const handleImprimer = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className={styles.conteneurGlobal}>
      {/* 1. Barre d'outils supérieure (Masquée à l'impression) */}
      {afficherBarreOutils && (
        <header className={styles.barreOutils} aria-label="Actions sur la facture">
          <div className={styles.outilsGauche}>
            <span className={styles.badgeConforme}>
              <ShieldCheck size={16} weight="bold" />
              <span>Conforme Normes OHADA & FNE</span>
            </span>
          </div>
          <div className={styles.outilsActions}>
            <button
              type="button"
              onClick={handleImprimer}
              className={`${styles.btnAction} ${styles.btnActionPrimaire}`}
              title="Ouvre l'aperçu avant impression ou enregistrement en PDF"
            >
              <Printer size={16} weight="bold" />
              <span>Imprimer / Enregistrer en PDF</span>
            </button>
            {surFermer && (
              <button
                type="button"
                onClick={surFermer}
                className={styles.btnAction}
                aria-label="Fermer l'aperçu"
              >
                Fermer
              </button>
            )}
          </div>
        </header>
      )}

      {/* 2. Feuille A4 Normée */}
      <article className={styles.feuilleA4} id={`facture-${facture.numero}`}>
        <div>
          {/* En-tête : Émetteur et Titre de la Pièce */}
          <header className={styles.enteteFacture}>
            <div className={styles.emetteurBloc}>
              <div className={styles.emetteurLogoMarque}>
                <span className={styles.logoBadge}>{emetteur.sigle || "CCD"}</span>
                <div>
                  <h1 className={styles.emetteurNom}>{emetteur.nom}</h1>
                  <div className={styles.emetteurForme}>
                    {emetteur.formeJuridique} · Capital : {emetteur.capitalFcfa}
                  </div>
                </div>
              </div>

              <div className={styles.emetteurDetails}>
                <div>{emetteur.adresse}</div>
                <div>{emetteur.ville}, {emetteur.pays}</div>
                <div>Tél : {emetteur.telephone} · Email : {emetteur.email}</div>
              </div>

              <div className={styles.emetteurIdentifiants}>
                <div><strong>RCCM :</strong> {emetteur.rccm}</div>
                <div><strong>NIF / NCC :</strong> {emetteur.nif} ({emetteur.regimeFiscal})</div>
                {emetteur.centreImpots && <div><strong>Centre fiscal :</strong> {emetteur.centreImpots}</div>}
              </div>
            </div>

            <div className={styles.pieceBloc}>
              <div className={styles.titrePiece}>Facture</div>
              <div className={styles.numeroFacture}>N° {facture.numero}</div>

              {facture.statut === "ACQUITTEE" && (
                <div className={`${styles.badgeStatutFacture} ${styles.statutAcquittee}`}>
                  <CheckCircle size={14} weight="fill" />
                  <span>Facture Acquittée</span>
                </div>
              )}
              {facture.statut === "EN_ATTENTE" && (
                <div className={`${styles.badgeStatutFacture} ${styles.statutEnAttente}`}>
                  <Clock size={14} weight="fill" />
                  <span>En attente de paiement</span>
                </div>
              )}
              {facture.statut === "ANNULEE" && (
                <div className={`${styles.badgeStatutFacture} ${styles.statutAnnulee}`}>
                  <XCircle size={14} weight="fill" />
                  <span>Annulée / Sans effet</span>
                </div>
              )}
            </div>
          </header>

          {/* Destinataire Client et Métadonnées de dates */}
          <section className={styles.sectionInfos}>
            <div className={styles.carteClient}>
              <div className={styles.carteClientTitre}>Facturé à (Client preneur)</div>
              <div className={styles.clientRaisonSociale}>{client.raisonSociale}</div>
              {client.nomCommercial && client.nomCommercial !== client.raisonSociale && (
                <div style={{ fontSize: "0.78125rem", color: "var(--color-neutral-600)" }}>
                  Enseigne : {client.nomCommercial}
                </div>
              )}
              <div className={styles.clientDetails}>
                <div>{client.adresse || "Adresse du siège non renseignée"}</div>
                <div>{client.ville || "Abidjan"}, {client.pays || "Côte d'Ivoire"}</div>
                {client.emailContact && <div>Email : {client.emailContact}</div>}
              </div>

              <div className={styles.clientFisc}>
                <div><strong>RCCM Client :</strong> {client.rccm || "En cours d'immatriculation"}</div>
                <div><strong>NIF / NCC Client :</strong> {client.nif || "Non assujetti / En attente"}</div>
              </div>
            </div>

            <div className={styles.carteDates}>
              <div className={styles.ligneDate}>
                <span className={styles.ligneDateLabel}>Date d&apos;émission :</span>
                <span className={styles.ligneDateValeur}>{facture.dateEmission}</span>
              </div>
              <div className={styles.ligneDate}>
                <span className={styles.ligneDateLabel}>Date d&apos;échéance :</span>
                <span className={styles.ligneDateValeur}>{facture.dateEcheance}</span>
              </div>
              {facture.periodeDebut && facture.periodeFin && (
                <div className={styles.ligneDate}>
                  <span className={styles.ligneDateLabel}>Période couverte :</span>
                  <span className={styles.ligneDateValeur}>
                    Du {facture.periodeDebut} au {facture.periodeFin}
                  </span>
                </div>
              )}
              {facture.referenceTransaction && (
                <div className={styles.ligneDate}>
                  <span className={styles.ligneDateLabel}>Réf. Transaction :</span>
                  <span className={styles.ligneDateValeur} style={{ fontFamily: "monospace" }}>
                    {facture.referenceTransaction}
                  </span>
                </div>
              )}
              <div className={styles.ligneDate}>
                <span className={styles.ligneDateLabel}>Devise légale :</span>
                <span className={styles.ligneDateValeur}>Franc CFA (XOF / XAF)</span>
              </div>
            </div>
          </section>

          {/* Tableau des lignes de facturation */}
          <section className={styles.tableauSection}>
            <table className={styles.tableauFacture}>
              <thead>
                <tr>
                  <th style={{ width: "12%" }}>Réf</th>
                  <th style={{ width: "48%" }}>Désignation des prestations</th>
                  <th className={styles.colCentree} style={{ width: "8%" }}>Qté</th>
                  <th className={styles.colDroitee} style={{ width: "16%" }}>P.U. HT (FCFA)</th>
                  <th className={styles.colDroitee} style={{ width: "16%" }}>Montant HT (FCFA)</th>
                </tr>
              </thead>
              <tbody>
                {facture.lignes.map((ligne, index) => (
                  <tr key={`${ligne.code}-${index}`}>
                    <td>
                      <span className={styles.ligneCode}>{ligne.code}</span>
                    </td>
                    <td>
                      <div className={styles.ligneDesignation}>{ligne.designation}</div>
                      {ligne.descriptionDetaillee && (
                        <div className={styles.ligneDescription}>{ligne.descriptionDetaillee}</div>
                      )}
                    </td>
                    <td className={styles.colCentree}>{ligne.quantite}</td>
                    <td className={styles.colDroitee}>{formaterFcfa(ligne.prixUnitaireHtFcfa)}</td>
                    <td className={styles.colDroitee}>
                      <strong>{formaterFcfa(ligne.totalHtFcfa)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Décompte fiscal & Arrêté en lettres */}
          <section className={styles.sectionTotauxEtReglement}>
            <div className={styles.blocArreteEtReglement}>
              <div className={styles.encadreArrete}>
                <div className={styles.titreArrete}>Arrêté de compte légal OHADA</div>
                <div className={styles.texteArrete}>
                  {arreteFactureEnLettres(facture.totalTtcFcfa)}
                </div>
              </div>

              {facture.moyenPaiementNom && (
                <div className={styles.encadreReglement}>
                  <div className={styles.titreReglement}>Mode de règlement & encaissement</div>
                  <div>
                    Règlement effectué via <strong>{facture.moyenPaiementNom}</strong> (Passerelle CinetPay certifiée).
                  </div>
                  {facture.datePaiementEffectif && (
                    <div>Horodatage certifié : {facture.datePaiementEffectif}</div>
                  )}
                </div>
              )}

              {emetteur.coordonneesBancaires && (
                <div className={styles.encadreReglement} style={{ fontSize: "0.75rem" }}>
                  <div className={styles.titreReglement}>Coordonnées Bancaires de l&apos;Éditeur</div>
                  <div>Banque : {emetteur.coordonneesBancaires.banque}</div>
                  <div>IBAN UEMOA : <code>{emetteur.coordonneesBancaires.ibanUemoa}</code></div>
                  {emetteur.coordonneesBancaires.bicSwift && (
                    <div>Code BIC / SWIFT : <code>{emetteur.coordonneesBancaires.bicSwift}</code></div>
                  )}
                </div>
              )}
            </div>

            {/* Totaux financiers */}
            <div>
              <table className={styles.tableauTotaux}>
                <tbody>
                  <tr>
                    <td className={styles.totauxLabel}>Total Brut Hors Taxes (HT) :</td>
                    <td className={styles.totauxValeur}>{formaterFcfa(facture.sousTotalHtFcfa)}</td>
                  </tr>
                  {facture.remiseGlobaleFcfa && facture.remiseGlobaleFcfa > 0 ? (
                    <tr>
                      <td className={styles.totauxLabel}>Remise accordée :</td>
                      <td className={styles.totauxValeur} style={{ color: "#b91c1c" }}>
                        - {formaterFcfa(facture.remiseGlobaleFcfa)}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className={styles.totauxLabel}>Net Commercial HT :</td>
                    <td className={styles.totauxValeur}>
                      {formaterFcfa(facture.sousTotalHtFcfa - (facture.remiseGlobaleFcfa || 0))}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.totauxLabel}>
                      {libelleTvaEffectif} ({tauxTvaEffectif}%) :
                    </td>
                    <td className={styles.totauxValeur}>{formaterFcfa(facture.montantTvaFcfa)}</td>
                  </tr>
                  <tr className={styles.ligneTotaleTTC}>
                    <td>TOTAL NET À PAYER (TTC) :</td>
                    <td className={`${styles.totauxValeur} ${styles.valeurTTC}`}>
                      {formaterFcfa(facture.totalTtcFcfa)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Tampon d'acquittement et QR Code */}
          <section className={styles.blocTamponEtQR}>
            {facture.statut === "ACQUITTEE" && (
              <div className={styles.tamponAcquitte}>
                <div className={styles.tamponTitre}>★ FACTURE ACQUITTÉE ★</div>
                <div className={styles.tamponSousTitre}>
                  Payée le {facture.datePaiementEffectif || facture.dateEmission}
                </div>
                <div className={styles.tamponSousTitre} style={{ fontSize: "0.625rem" }}>
                  Plateforme certifiée CinetPay & BCEAO
                </div>
              </div>
            )}

            <div className={styles.blocQRCode}>
              {/* QR Code vectoriel stylisé */}
              <div className={styles.qrVisuel}>
                <svg viewBox="0 0 33 33" width="100%" height="100%" fill="currentColor" aria-hidden="true">
                  <rect x="0" y="0" width="11" height="11" fill="#1E1D1B" />
                  <rect x="2" y="2" width="7" height="7" fill="#ffffff" />
                  <rect x="4" y="4" width="3" height="3" fill="#1E1D1B" />

                  <rect x="22" y="0" width="11" height="11" fill="#1E1D1B" />
                  <rect x="24" y="2" width="7" height="7" fill="#ffffff" />
                  <rect x="26" y="4" width="3" height="3" fill="#1E1D1B" />

                  <rect x="0" y="22" width="11" height="11" fill="#1E1D1B" />
                  <rect x="2" y="24" width="7" height="7" fill="#ffffff" />
                  <rect x="4" y="26" width="3" height="3" fill="#1E1D1B" />

                  <rect x="14" y="2" width="4" height="4" fill="#1E1D1B" />
                  <rect x="14" y="8" width="4" height="4" fill="#1E1D1B" />
                  <rect x="14" y="14" width="5" height="5" fill="#D4652A" />
                  <rect x="2" y="14" width="4" height="4" fill="#1E1D1B" />
                  <rect x="8" y="14" width="4" height="4" fill="#1E1D1B" />
                  <rect x="20" y="14" width="4" height="4" fill="#1E1D1B" />
                  <rect x="26" y="14" width="5" height="5" fill="#1E1D1B" />
                  <rect x="14" y="22" width="4" height="4" fill="#1E1D1B" />
                  <rect x="22" y="22" width="4" height="4" fill="#1E1D1B" />
                  <rect x="26" y="26" width="5" height="5" fill="#1E1D1B" />
                </svg>
              </div>
              <div className={styles.qrTexte}>
                <div className={styles.qrTitre}>Contrôle & Authenticité</div>
                <div>Réf: {facture.numero}</div>
                <div>Vérification en ligne / DGI FNE</div>
              </div>
            </div>
          </section>
        </div>

        {/* Pied de page légal */}
        <footer className={styles.piedDePageLegal}>
          <div className={styles.piedMentions}>
            {emetteur.nom} · {emetteur.formeJuridique} au capital de {emetteur.capitalFcfa} · RCCM {emetteur.rccm} · NIF {emetteur.nif}
          </div>
          <div className={styles.piedTribunal}>
            Dispositions conformes à l&apos;Acte Uniforme OHADA portant Droit Commercial Général (AUDCG).
            Pénalités de retard : taux de refinancement de la BCEAO majoré de 5 points de pourcentage.
            En cas de contestation, compétence expresse attribuée au Tribunal de Commerce d&apos;Abidjan.
          </div>
        </footer>
      </article>
    </div>
  );
}

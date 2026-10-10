"use client";

import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { ChampTelephone } from "@/components/metier/ChampTelephone";
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  Champ,
  EtatChargement,
  EtatErreur,
} from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MODES_MOBILE_MONEY,
  PAYS_FISCAUX,
  PLANS_DISPONIBLES,
  souscrireAbonnement,
} from "@/features/abonnement/api";
import type {
  CodePlan,
  DefinitionPlan,
  DemandeSouscription,
  InformationsFacturation,
  ModePaiement,
  Periodicite,
  RecuPaiement,
} from "@/features/abonnement/api";
import { decomposerTva, prixPeriode } from "@/features/abonnement/regles";
import { lireEntreprise, paysEntreprise } from "@/features/configuration/api";
import { BasculePeriodicite, CadreForfait } from "@/features/abonnement/components/CadreForfait";
import { catalogueAuxTarifs, tarifDuPlan } from "@/features/plateforme";
import type { TarifPlan } from "@/features/plateforme";
import { useLibellePlan, useTarifsPlateforme } from "@/features/plateforme/hooks";
import { telephoneValide } from "@/features/referentiels/telephone";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterDateHeure, formaterMontant } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONE_MODE: Record<ModePaiement, typeof Smartphone> = {
  WAVE: Smartphone,
  ORANGE_MONEY: Smartphone,
  MTN_MOMO: Smartphone,
  CARTE_BANCAIRE: CreditCard,
};

/** Un repère visuel par mode — la couleur n'est jamais seule (icône + libellé la doublent déjà). */
const TON_MODE: Record<ModePaiement, string> = {
  WAVE: "border-information/30 bg-information-fond text-information",
  ORANGE_MONEY: "border-avertissement/30 bg-avertissement-fond text-avertissement",
  MTN_MOMO: "border-avertissement/30 bg-avertissement-fond text-avertissement",
  CARTE_BANCAIRE: "border-secondary-300 bg-secondary-50 text-secondary-700",
};

const FACTURATION_VIDE: InformationsFacturation = {
  raison_sociale: "",
  email: "",
  pays_fiscal: "",
  adresse: "",
  rccm: "",
  nif: "",
};

function CartePlan({
  plan,
  tarif,
  periodicite,
  onChoisir,
}: {
  plan: DefinitionPlan;
  /**
   * Le tarif publié au back-office : il porte la remise annuelle et les
   * avantages (les non inclus s'affichent barrés sous la liste).
   */
  tarif: TarifPlan | undefined;
  periodicite: Periodicite;
  onChoisir: (code: CodePlan) => void;
}) {
  const t = useTranslations("abonnement.tarifs");
  const tPlans = useTranslations("abonnement.plan");
  const libelle = tarif?.libelle || tPlans(`${plan.code}.libelle`);
  const populaire = plan.etiquette === "POPULAIRE";
  const avantages = tarif?.avantages ?? [];
  const remise = tarif?.remiseAnnuellePourcent ?? 0;

  const incluses = [
    plan.limite_chantiers === null
      ? t("chantiersIllimites")
      : t("chantiersLimite", { n: plan.limite_chantiers }),
    plan.limite_utilisateurs === null
      ? t("utilisateursIllimites")
      : t("utilisateursLimite", { n: plan.limite_utilisateurs }),
    t("stockage", { go: plan.limite_stockage_go }),
    ...avantages.filter((avantage) => avantage.inclus).map((avantage) => avantage.libelle),
  ];
  const absentes = avantages
    .filter((avantage) => !avantage.inclus)
    .map((avantage) => avantage.libelle);

  return (
    <CadreForfait populaire={populaire} libellePopulaire={t("populaire")}>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-neutral-600">{libelle}</h3>
          {plan.etiquette === "GRANDS_COMPTES" && (
            <Badge variante="secondaire">{t("grandsComptes")}</Badge>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight text-neutral-900">
            {formaterMontant(prixPeriode(plan, periodicite))}
          </span>
          <span className="text-xs text-neutral-600">
            {periodicite === "ANNUELLE" ? t("parAn") : t("parMois")}
          </span>
        </div>
        {remise > 0 && (
          <p className="mt-2 inline-flex rounded-full border border-succes/30 bg-succes-fond px-2 py-0.5 text-xs font-medium text-succes">
            {t("remiseAnnuelle", { valeur: remise })}
          </p>
        )}
        <p className="mt-2 text-sm text-neutral-700">{tPlans(`${plan.code}.accroche`)}</p>
      </div>

      <Bouton
        type="button"
        variante="primaire"
        taille="sm"
        pleineLargeur
        className="font-medium"
        iconeDroite={<ArrowRight size={14} aria-hidden="true" />}
        onClick={() => onChoisir(plan.code)}
      >
        {t("choisir", { plan: libelle })}
      </Bouton>

      <ul className="flex flex-col gap-2.5">
        {incluses.map((texte, rang) => (
          <li key={`${rang}-${texte}`} className="flex items-start gap-2.5 text-sm text-neutral-800">
            <Check size={16} className="mt-0.5 shrink-0 text-neutral-700" aria-hidden="true" />
            <span>{texte}</span>
          </li>
        ))}
        {absentes.map((texte, rang) => (
          <li key={`${rang}-${texte}`} className="flex items-start gap-2.5 text-sm text-neutral-400">
            <X size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <span className="sr-only">{t("nonInclus")}</span>
              {texte}
            </span>
          </li>
        ))}
      </ul>
    </CadreForfait>
  );
}

/**
 * L'assistant en trois étapes : formule, paiement CinetPay, confirmation —
 * calqué sur le parcours de la maquette `01_paiement_abonnement`.
 *
 * `POST /abonnement/souscription/` n'existe pas encore côté Django (T-025) :
 * tant que `NEXT_PUBLIC_API_SIMULE` reste actif, `souscrireAbonnement`
 * rejoue un reçu simulé — l'écran se parcourt en entier sans backend.
 */
export function AssistantAbonnement() {
  const router = useRouter();
  const t = useTranslations("abonnement.tarifs");
  const tPaiement = useTranslations("abonnement.paiement");
  const tConfirmation = useTranslations("abonnement.confirmation");
  const tMode = useTranslations("abonnement.mode");
  const tModeDescription = useTranslations("abonnement.modeDescription");
  const libellePlan = useLibellePlan();

  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const [periodicite, setPeriodicite] = useState<Periodicite>("MENSUELLE");
  const [planCode, setPlanCode] = useState<CodePlan | null>(null);

  // Les prix et les avantages viennent de la plateforme, qui les paramètre
  // au back-office ; les quotas restent ceux du catalogue.
  const requeteTarifs = useTarifsPlateforme();
  const plans = useMemo(
    () => catalogueAuxTarifs(PLANS_DISPONIBLES, requeteTarifs.data ?? []),
    [requeteTarifs.data],
  );
  const [modePaiement, setModePaiement] = useState<ModePaiement | null>(null);
  const [telephonePaiement, setTelephonePaiement] = useState("");
  const [pays, setPays] = useState("");
  const [facturation, setFacturation] = useState<InformationsFacturation>(FACTURATION_VIDE);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [recu, setRecu] = useState<RecuPaiement | null>(null);

  useEffect(() => {
    let vivant = true;
    paysEntreprise().then((code) => {
      if (!vivant) return;
      setPays(code);
      if (PAYS_FISCAUX.some((p) => p.code === code)) {
        setFacturation((precedent) => ({
          ...precedent,
          pays_fiscal: precedent.pays_fiscal || code,
        }));
      }
    });
    lireEntreprise()
      .then((entreprise) => {
        if (!vivant) return;
        setFacturation((precedent) => ({
          ...precedent,
          raison_sociale: precedent.raison_sociale || entreprise.raison_sociale || "",
          email: precedent.email || entreprise.email_contact || "",
          adresse: precedent.adresse || entreprise.adresse || "",
        }));
      })
      .catch(() => {
        // Le formulaire reste modifiable même si l'entreprise n'a pas pu être relue.
      });
    return () => {
      vivant = false;
    };
  }, []);

  const plan = planCode ? plans.find((p) => p.code === planCode) : undefined;
  const paysFiscal = PAYS_FISCAUX.find((p) => p.code === facturation.pays_fiscal);
  const montantTtc = plan ? prixPeriode(plan, periodicite) : 0;
  const { ht, tva } = decomposerTva(montantTtc, paysFiscal?.taux_tva ?? 18);

  function modifierFacturation(champ: keyof InformationsFacturation, valeur: string) {
    setFacturation((precedent) => ({ ...precedent, [champ]: valeur }));
    if (champ in erreurs) {
      const reste = { ...erreurs };
      delete reste[champ];
      setErreurs(reste);
    }
  }

  function choisirPlan(code: CodePlan) {
    setPlanCode(code);
    setEtape(2);
  }

  function validerEtape2(): boolean {
    const trouvees: Record<string, string> = {};

    if (!modePaiement) trouvees.mode_paiement = tPaiement("erreurModeRequis");
    if (modePaiement && MODES_MOBILE_MONEY.includes(modePaiement)) {
      if (!telephonePaiement.trim()) trouvees.telephone_paiement = tPaiement("erreurTelephoneRequis");
      else if (!telephoneValide(telephonePaiement, pays))
        trouvees.telephone_paiement = tPaiement("erreurTelephoneIncomplet");
    }
    if (facturation.raison_sociale.trim().length < 2)
      trouvees.raison_sociale = tPaiement("erreurRaisonSocialeRequise");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(facturation.email))
      trouvees.email = tPaiement("erreurEmailInvalide");
    if (!facturation.pays_fiscal) trouvees.pays_fiscal = tPaiement("erreurPaysFiscalRequis");
    if (!facturation.adresse.trim()) trouvees.adresse = tPaiement("erreurAdresseRequise");
    if (!facturation.nif?.trim()) trouvees.nif = tPaiement("erreurNifRequis");

    setErreurs(trouvees);
    return Object.keys(trouvees).length === 0;
  }

  async function soumettrePaiement(evenement: FormEvent) {
    evenement.preventDefault();
    if (!plan || !modePaiement || !validerEtape2()) return;

    const demande: DemandeSouscription = {
      plan: plan.code,
      periodicite,
      mode_paiement: modePaiement,
      telephone_paiement: MODES_MOBILE_MONEY.includes(modePaiement) ? telephonePaiement : undefined,
      facturation,
    };

    setEnvoi(true);
    setEchec(null);
    try {
      const reponse = await souscrireAbonnement(demande);
      setRecu(reponse);
      setEtape(3);
    } catch (cause) {
      setEchec((cause as ErreurApi).message);
    } finally {
      setEnvoi(false);
    }
  }

  function recommencer() {
    setEtape(1);
    setPlanCode(null);
    setModePaiement(null);
    setTelephonePaiement("");
    setRecu(null);
    setEchec(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {etape === 1 && (
        <>
          <EnTetePage titre={t("titre")} description={t("accroche")} />

          {/* Seule la grille des forfaits reste centrée : le titre, lui, suit
              la gouttière commune à tous les écrans. */}
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 text-center">
            <BasculePeriodicite<Periodicite>
              valeur={periodicite}
              onChange={setPeriodicite}
              options={[
                { valeur: "MENSUELLE", libelle: t("facturationMensuelle") },
                { valeur: "ANNUELLE", libelle: t("facturationAnnuelle") },
              ]}
            />

            <div className="grid w-full gap-5 text-left lg:grid-cols-3 lg:items-start lg:pt-9">
              {/* Pas de repli sur les prix du catalogue en cas d'échec : afficher
                  un prix que la plateforme a peut-être changé serait vendre à un
                  tarif qui n'existe plus. */}
              {requeteTarifs.isPending && (
                <div className="lg:col-span-3">
                  <EtatChargement />
                </div>
              )}
              {requeteTarifs.isError && (
                <div className="lg:col-span-3">
                  <EtatErreur onReessayer={() => void requeteTarifs.refetch()} />
                </div>
              )}
              {requeteTarifs.isSuccess &&
                plans.map((planCatalogue) => (
                  <CartePlan
                    key={planCatalogue.code}
                    plan={planCatalogue}
                    tarif={tarifDuPlan(requeteTarifs.data, planCatalogue.code)}
                    periodicite={periodicite}
                    onChoisir={choisirPlan}
                  />
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-neutral-600">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} aria-hidden="true" />
                {t("cinetpaySecurise")}
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={14} aria-hidden="true" />
                {t("factureDeductible")}
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={14} aria-hidden="true" />
                {t("activationDirecte")}
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={14} aria-hidden="true" />
                {t("sansEngagement")}
              </span>
            </div>
          </div>
        </>
      )}

      {etape === 2 && plan && (
        <form className="flex flex-col gap-6" onSubmit={soumettrePaiement} noValidate>
          <EnTetePage
            titre={tPaiement("selectionnerMode")}
            actions={
              <button
                type="button"
                className="text-sm font-medium text-primary-600 hover:underline"
                onClick={() => setEtape(1)}
              >
                {t("modifierForfait")}
              </button>
            }
          />

          {echec && (
            <Alerte type="erreur" titre={tPaiement("echecTitre")}>
              {echec}
            </Alerte>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["WAVE", "ORANGE_MONEY", "MTN_MOMO", "CARTE_BANCAIRE"] as ModePaiement[]).map(
                  (mode) => {
                    const Icone = ICONE_MODE[mode];
                    const selectionne = modePaiement === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={selectionne}
                        onClick={() => setModePaiement(mode)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                          selectionne
                            ? "border-primary-500 bg-primary-50"
                            : "border-neutral-200 hover:bg-neutral-50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full border",
                            TON_MODE[mode],
                          )}
                        >
                          <Icone size={18} aria-hidden="true" />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-semibold text-neutral-900">
                            {tMode(mode)}
                          </span>
                          <span className="text-xs text-neutral-600">{tModeDescription(mode)}</span>
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
              {erreurs.mode_paiement && (
                <p className="-mt-3 text-xs font-medium text-erreur">{erreurs.mode_paiement}</p>
              )}

              {modePaiement && MODES_MOBILE_MONEY.includes(modePaiement) && (
                <ChampTelephone
                  libelle={tPaiement("champTelephonePaiement")}
                  paysDefaut={pays}
                  required
                  valeur={telephonePaiement}
                  erreur={erreurs.telephone_paiement}
                  disabled={envoi}
                  onChange={setTelephonePaiement}
                />
              )}

              {modePaiement === "CARTE_BANCAIRE" && (
                <Alerte type="information">{tPaiement("modeCarteInfo")}</Alerte>
              )}

              <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <Building2 size={16} aria-hidden="true" />
                  {tPaiement("informationsFacturation")}
                </h2>

                <div className="grid gap-x-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Champ
                      libelle={tPaiement("champRaisonSociale")}
                      value={facturation.raison_sociale}
                      disabled={envoi}
                      erreur={erreurs.raison_sociale}
                      onChange={(e) => modifierFacturation("raison_sociale", e.target.value)}
                    />
                  </div>

                  <Champ
                    libelle={tPaiement("champEmailFacture")}
                    type="email"
                    value={facturation.email}
                    disabled={envoi}
                    erreur={erreurs.email}
                    onChange={(e) => modifierFacturation("email", e.target.value)}
                  />

                  <div className="mb-4 flex flex-col gap-1">
                    <label
                      className="text-sm font-semibold text-neutral-800"
                      htmlFor="facturation-pays-fiscal"
                    >
                      {tPaiement("champPaysFiscal")}
                    </label>
                    <Select
                      value={facturation.pays_fiscal}
                      onValueChange={(valeur) => modifierFacturation("pays_fiscal", valeur)}
                      disabled={envoi}
                    >
                      <SelectTrigger id="facturation-pays-fiscal" className="w-full">
                        <SelectValue placeholder={tPaiement("champPaysFiscalPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYS_FISCAUX.map((paysOption) => (
                          <SelectItem key={paysOption.code} value={paysOption.code}>
                            {`${paysOption.code} — ${paysOption.taux_tva}% (${paysOption.zone})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {erreurs.pays_fiscal && (
                      <p className="text-xs font-medium text-erreur">{erreurs.pays_fiscal}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Champ
                      libelle={tPaiement("champAdresseSiege")}
                      value={facturation.adresse}
                      disabled={envoi}
                      erreur={erreurs.adresse}
                      onChange={(e) => modifierFacturation("adresse", e.target.value)}
                    />
                  </div>

                  <Champ
                    libelle={tPaiement("champRccm")}
                    value={facturation.rccm}
                    disabled={envoi}
                    onChange={(e) => modifierFacturation("rccm", e.target.value)}
                  />

                  <Champ
                    libelle={tPaiement("champNif")}
                    value={facturation.nif}
                    disabled={envoi}
                    erreur={erreurs.nif}
                    onChange={(e) => modifierFacturation("nif", e.target.value)}
                  />
                </div>
              </div>

              <Bouton type="button" variante="ghost" className="w-fit" onClick={() => setEtape(1)}>
                {tPaiement("retour")}
              </Bouton>
            </div>

            <Carte className="h-fit" titre={tPaiement("recapitulatif")}>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">{tPaiement("forfaitSouscrit")}</span>
                  <span className="font-medium text-neutral-900">{libellePlan(plan.code)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">{tPaiement("periodicite")}</span>
                  <span className="font-medium text-neutral-900">
                    {periodicite === "ANNUELLE"
                      ? tPaiement("periodiciteAnnuelle")
                      : tPaiement("periodiciteMensuelle")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">{tPaiement("modeSelectionne")}</span>
                  <span className="font-medium text-neutral-900">
                    {modePaiement ? tMode(modePaiement) : ABSENT}
                  </span>
                </div>

                <div className="my-1 border-t border-neutral-200" />

                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">{tPaiement("sousTotalHt")}</span>
                  <span className="tabular-nums text-neutral-900">{formaterMontant(ht)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">
                    {tPaiement("tva", { taux: paysFiscal?.taux_tva ?? 18 })}
                  </span>
                  <span className="tabular-nums text-neutral-900">{formaterMontant(tva)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold">
                  <span className="text-neutral-900">{tPaiement("totalTtc")}</span>
                  <span className="tabular-nums text-neutral-900">{formaterMontant(montantTtc)}</span>
                </div>

                <Bouton type="submit" taille="lg" pleineLargeur enCours={envoi} className="mt-2">
                  {tPaiement("regler", { montant: formaterMontant(montantTtc) })}
                </Bouton>
              </div>
            </Carte>
          </div>
        </form>
      )}

      {etape === 3 && recu && plan && (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-succes-fond text-succes">
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-h3 font-bold text-neutral-900">{tConfirmation("titre")}</h1>
            <p className="mt-1 text-sm text-neutral-600">
              {tConfirmation("sousTitre", { plan: libellePlan(plan.code) })}
            </p>
          </div>

          <Carte className="w-full text-left" titre={tConfirmation("titreBordereau")}>
            <div className="flex flex-col gap-3 text-sm">
              {(
                [
                  [tConfirmation("referenceTransaction"), recu.reference_transaction],
                  [tConfirmation("numeroFacture"), recu.numero_facture],
                  [tConfirmation("dateHeure"), formaterDateHeure(recu.date_heure)],
                  [tConfirmation("modePaiement"), tMode(recu.mode_paiement)],
                  [tConfirmation("entrepriseTitulaire"), recu.entreprise],
                ] as [string, string][]
              ).map(([libelle, valeur]) => (
                <div key={libelle} className="flex items-center justify-between gap-4">
                  <span className="text-neutral-600">{libelle}</span>
                  <span className="truncate font-medium text-neutral-900">{valeur}</span>
                </div>
              ))}
              <div className="border-t border-neutral-200 pt-3">
                <div className="flex items-center justify-between text-base font-semibold">
                  <span className="text-neutral-900">{tConfirmation("montantDebite")}</span>
                  <span className="tabular-nums text-neutral-900">
                    {formaterMontant(recu.montant_centimes)}
                  </span>
                </div>
              </div>
            </div>
          </Carte>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Bouton variante="secondaire" onClick={() => router.push("/abonnement/historique")}>
              {tConfirmation("voirFacture")}
            </Bouton>
            <Bouton variante="ghost" onClick={recommencer}>
              {tConfirmation("changerForfait")}
            </Bouton>
            <Bouton variante="primaire" onClick={() => router.push("/tableau-de-bord")}>
              {tConfirmation("retourAccueil")}
            </Bouton>
          </div>
        </div>
      )}
    </div>
  );
}

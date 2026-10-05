"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { unitesProposees } from "@/features/chantier";
import type { MateriauDisponible } from "@/features/chantier";
import {
  besoinVide,
  CONFORMITES,
  ETATS_EQUIPEMENT,
  ligneEquipementVide,
  ligneLivraisonVide,
  ligneMateriauVide,
  NATURES_BESOIN,
  PROPRIETES_EQUIPEMENT,
  type ValeursRapport,
} from "@/features/chantier/validations";

import {
  BoutonAjout,
  CarteLigne,
  ChampPuces,
  ChampTexte,
  PAIRE,
  RANGEE,
  Signal,
  SousRubrique,
  useErreurSection,
} from "./elementsSaisie";

function heureCourante(): string {
  const maintenant = new Date();
  return `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ *
 * Les matériaux consommés — saisis librement. Les désignations du stock
 * du chantier et les unités courantes sont proposées, jamais imposées.
 * ------------------------------------------------------------------ */

export function SectionMateriaux({ materiaux }: { materiaux: MateriauDisponible[] }) {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "materiaux" });
  const valeurs = useWatch({ control, name: "materiaux" });
  const erreur = useErreurSection("materiaux");
  const idDesignations = useId();
  const idUnites = useId();

  return (
    <SousRubrique
      titre={t("sections.materiaux")}
      description={t("materiaux.description")}
      erreur={erreur}
    >
      <datalist id={idDesignations}>
        {materiaux.map((materiau) => (
          <option key={materiau.materiauId} value={materiau.designation} />
        ))}
      </datalist>
      <datalist id={idUnites}>
        {unitesProposees(materiaux).map((unite) => (
          <option key={unite} value={unite} />
        ))}
      </datalist>
      {lignes.fields.map((ligne, rang) => (
        <CarteLigne
          key={ligne.id}
          titre={valeurs[rang]?.designation || t("materiaux.titre", { rang: rang + 1 })}
          libelleSupprimer={t("materiaux.supprimer", { rang: rang + 1 })}
          onSupprimer={() => lignes.remove(rang)}
        >
          <ChampTexte
            name={`materiaux.${rang}.designation`}
            libelle={t("materiaux.designation")}
            placeholder={t("materiaux.designationExemple")}
            list={idDesignations}
            autoComplete="off"
            requis
          />
          <div className={PAIRE}>
            <ChampTexte
              name={`materiaux.${rang}.quantite`}
              libelle={t("materiaux.consomme")}
              inputMode="decimal"
              placeholder="0"
              requis
            />
            <ChampTexte
              name={`materiaux.${rang}.unite`}
              libelle={t("materiaux.unite")}
              placeholder={t("materiaux.uniteExemple")}
              list={idUnites}
              autoComplete="off"
              requis
            />
          </div>
        </CarteLigne>
      ))}
      <BoutonAjout onClick={() => lignes.append(ligneMateriauVide())}>{t("materiaux.ajouter")}</BoutonAjout>
    </SousRubrique>
  );
}

/* ------------------------------------------------------------------ *
 * Les livraisons reçues — déclaratives : elles ne créent pas de bon de
 * réception dans le stock (SFD §5.2).
 * ------------------------------------------------------------------ */

export function SectionLivraisons() {
  const t = useTranslations("journal.saisie");
  const tEnum = useTranslations("journal.enumerations");
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "livraisons" });
  const valeurs = useWatch({ control, name: "livraisons" });

  return (
    <SousRubrique
      titre={t("sections.livraisons")}
      description={t("livraisons.description")}
    >
      {lignes.fields.map((ligne, rang) => {
        const conformite = valeurs[rang]?.conformite;
        return (
          <CarteLigne
            key={ligne.id}
            titre={valeurs[rang]?.designation || t("livraisons.titre", { rang: rang + 1 })}
            libelleSupprimer={t("livraisons.supprimer", { rang: rang + 1 })}
            onSupprimer={() => lignes.remove(rang)}
          >
            <div className={RANGEE}>
              <ChampTexte name={`livraisons.${rang}.designation`} libelle={t("livraisons.designation")} requis />
              <ChampTexte name={`livraisons.${rang}.fournisseur`} libelle={t("livraisons.fournisseur")} requis />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ChampTexte
                name={`livraisons.${rang}.quantite`}
                libelle={t("livraisons.quantite")}
                placeholder={t("livraisons.quantiteExemple")}
                requis
              />
              <ChampTexte name={`livraisons.${rang}.heure`} libelle={t("livraisons.heure")} type="time" />
              <ChampTexte
                className="col-span-2 sm:col-span-1"
                name={`livraisons.${rang}.bonLivraison`}
                libelle={t("livraisons.bon")}
              />
            </div>
            <ChampPuces
              name={`livraisons.${rang}.conformite`}
              libelle={t("livraisons.conformite")}
              colonnes={3}
              options={CONFORMITES.map((valeur) => ({
                valeur,
                libelle: tEnum(`conformite.${valeur}`),
                ton: valeur === "CONFORME" ? "succes" : valeur === "PARTIELLE" ? "avertissement" : "erreur",
              }))}
            />
            {conformite !== "CONFORME" && (
              <ChampTexte
                name={`livraisons.${rang}.observation`}
                libelle={t("livraisons.anomalie")}
                placeholder={t("livraisons.anomalieExemple")}
                requis
              />
            )}
          </CarteLigne>
        );
      })}
      <BoutonAjout onClick={() => lignes.append(ligneLivraisonVide(heureCourante()))}>{t("livraisons.ajouter")}</BoutonAjout>
    </SousRubrique>
  );
}

/* ------------------------------------------------------------------ *
 * Les engins et équipements.
 * ------------------------------------------------------------------ */

export function SectionEquipements() {
  const t = useTranslations("journal.saisie");
  const tEnum = useTranslations("journal.enumerations");
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "equipements" });
  const valeurs = useWatch({ control, name: "equipements" });

  return (
    <SousRubrique
      titre={t("sections.equipements")}
      description={t("equipements.description")}
    >
      {lignes.fields.map((ligne, rang) => {
        const etat = valeurs[rang]?.etat;
        return (
          <CarteLigne
            key={ligne.id}
            titre={valeurs[rang]?.designation || t("equipements.titre", { rang: rang + 1 })}
            complement={
              etat && etat !== "BON" ? (
                <Badge variante={etat === "PANNE" ? "erreur" : "avertissement"}>{t(`equipements.etats.${etat}`)}</Badge>
              ) : null
            }
            libelleSupprimer={t("equipements.supprimer", { rang: rang + 1 })}
            onSupprimer={() => lignes.remove(rang)}
          >
            <div className={RANGEE}>
              <ChampTexte
                name={`equipements.${rang}.designation`}
                libelle={t("equipements.designation")}
                placeholder={t("equipements.designationExemple")}
                requis
              />
              <ChampTexte name={`equipements.${rang}.reference`} libelle={t("equipements.reference")} />
            </div>
            <div className={RANGEE}>
              <ChampTexte
                name={`equipements.${rang}.utilisation`}
                libelle={t("equipements.utilisation")}
                placeholder={t("equipements.utilisationExemple")}
                inputMode="decimal"
                suffixe={t("unites.heures")}
              />
              <ChampTexte name={`equipements.${rang}.operateur`} libelle={t("equipements.operateur")} />
            </div>
            <ChampPuces
              name={`equipements.${rang}.propriete`}
              libelle={t("equipements.propriete")}
              colonnes={2}
              options={PROPRIETES_EQUIPEMENT.map((valeur) => ({ valeur, libelle: tEnum(`propriete.${valeur}`) }))}
            />
            <ChampPuces
              name={`equipements.${rang}.etat`}
              libelle={t("equipements.etat")}
              colonnes={3}
              options={ETATS_EQUIPEMENT.map((valeur) => ({
                valeur,
                libelle: t(`equipements.etats.${valeur}`),
                ton: valeur === "BON" ? "succes" : valeur === "ENTRETIEN" ? "avertissement" : "erreur",
              }))}
            />
            {etat && etat !== "BON" && (
              <ChampTexte
                name={`equipements.${rang}.dureeArret`}
                libelle={t("equipements.dureeArret")}
                placeholder={t("equipements.dureeArretExemple")}
                inputMode="decimal"
                suffixe={t("unites.heures")}
                requis
              />
            )}
            <ChampTexte
              name={`equipements.${rang}.observation`}
              libelle={etat === "PANNE" ? t("equipements.panne") : t("equipements.observation")}
              placeholder={etat === "BON" ? undefined : t("equipements.panneExemple")}
              requis={etat === "PANNE"}
            />
            {etat === "PANNE" && (
              <Signal ton="avertissement" icone={<TriangleAlert />}>
                {t("equipements.panneNotification")}
              </Signal>
            )}
          </CarteLigne>
        );
      })}
      <BoutonAjout onClick={() => lignes.append(ligneEquipementVide())}>{t("equipements.ajouter")}</BoutonAjout>
    </SousRubrique>
  );
}

/* ------------------------------------------------------------------ *
 * Les ruptures de stock et les besoins urgents.
 * ------------------------------------------------------------------ */

export function SectionBesoins() {
  const t = useTranslations("journal.saisie");
  const { control } = useFormContext<ValeursRapport>();
  const lignes = useFieldArray({ control, name: "besoins" });
  const valeurs = useWatch({ control, name: "besoins" });

  return (
    <SousRubrique titre={t("sections.besoins")} description={t("besoins.description")}>
      {lignes.fields.map((ligne, rang) => {
        const nature = valeurs[rang]?.nature === "URGENT" ? "URGENT" : "RUPTURE";
        return (
          <CarteLigne
            key={ligne.id}
            titre={t("besoins.titre", { nature: t(`besoins.natures.${nature}`), rang: rang + 1 })}
            libelleSupprimer={t("besoins.supprimer", { rang: rang + 1 })}
            onSupprimer={() => lignes.remove(rang)}
          >
            <ChampPuces
              name={`besoins.${rang}.nature`}
              libelle={t("besoins.nature")}
              masquerLibelle
              colonnes={2}
              options={NATURES_BESOIN.map((valeur) => ({
                valeur,
                libelle: t(`besoins.natures.${valeur}`),
                ton: valeur === "RUPTURE" ? "erreur" : "avertissement",
              }))}
            />
            <div className={RANGEE}>
              <ChampTexte name={`besoins.${rang}.designation`} libelle={t("besoins.designation")} requis />
              <ChampTexte
                name={`besoins.${rang}.quantite`}
                libelle={t("besoins.quantite")}
                placeholder={t("besoins.quantiteExemple")}
                requis={nature === "URGENT"}
              />
            </div>
            <ChampTexte
              name={`besoins.${rang}.observation`}
              libelle={t("besoins.observation")}
              placeholder={t("besoins.observationExemple")}
            />
          </CarteLigne>
        );
      })}
      <div className={PAIRE}>
        {NATURES_BESOIN.map((nature) => (
          <BoutonAjout key={nature} onClick={() => lignes.append(besoinVide(nature))}>
            {t(`besoins.natures.${nature}`)}
          </BoutonAjout>
        ))}
      </div>
    </SousRubrique>
  );
}

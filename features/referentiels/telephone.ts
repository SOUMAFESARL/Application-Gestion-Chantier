/**
 * Indicatifs téléphoniques des neuf pays où une entreprise peut s'inscrire.
 *
 * **Ce qui est enregistré, c'est le numéro international** — `+2250700000000`,
 * sans espace. Trois raisons, et la troisième est la plus concrète :
 *
 * 1. un numéro sans indicatif ne veut rien dire dès qu'un client travaille
 *    dans deux pays, et la même suite de chiffres existe dans plusieurs ;
 * 2. la mise en forme est une affaire d'affichage : la stocker, c'est stocker
 *    des espaces et devoir les enlever partout ;
 * 3. **le lien WhatsApp du serveur repose dessus.** `lien_whatsapp` retire les
 *    caractères non numériques et compose `wa.me/<chiffres>` : sur un numéro
 *    local, il produit un lien mort, silencieusement.
 *
 * La liste est **fermée aux neuf pays de l'inscription** — c'est la décision
 * prise pour les villes, et pour la même raison : deux listes de pays qui
 * divergent laissent quelqu'un devant un champ qui ne propose pas le sien.
 */

export interface PaysTelephone {
  /** Code ISO à deux lettres. */
  code: string;
  /** Indicatif international, avec le `+`. */
  indicatif: string;
  /**
   * Découpage d'affichage du numéro national — `[2, 2, 2, 2, 2]` donne
   * « 07 00 00 00 00 ». Ce qui dépasse le motif continue par paires.
   */
  groupes: number[];
  /**
   * Nombre de chiffres accepté, borne incluse.
   *
   * **Volontairement tolérant là où le plan de numérotation a bougé
   * récemment.** Le Bénin est passé à dix chiffres, le Gabon à huit, la Côte
   * d'Ivoire à dix en 2021 : une borne trop serrée refuse un numéro valable,
   * ce qui est bien pire qu'accepter un numéro un peu court. À confirmer par
   * pays quand la Direction aura une source à jour.
   */
  longueurMin: number;
  longueurMax: number;
}

export const PAYS_TELEPHONE: PaysTelephone[] = [
  { code: "CI", indicatif: "+225", groupes: [2, 2, 2, 2, 2], longueurMin: 8, longueurMax: 10 },
  { code: "SN", indicatif: "+221", groupes: [2, 3, 2, 2], longueurMin: 9, longueurMax: 9 },
  { code: "CM", indicatif: "+237", groupes: [1, 2, 2, 2, 2], longueurMin: 8, longueurMax: 9 },
  { code: "BF", indicatif: "+226", groupes: [2, 2, 2, 2], longueurMin: 8, longueurMax: 8 },
  { code: "ML", indicatif: "+223", groupes: [2, 2, 2, 2], longueurMin: 8, longueurMax: 8 },
  { code: "TG", indicatif: "+228", groupes: [2, 2, 2, 2], longueurMin: 8, longueurMax: 8 },
  { code: "BJ", indicatif: "+229", groupes: [2, 2, 2, 2, 2], longueurMin: 8, longueurMax: 10 },
  { code: "GN", indicatif: "+224", groupes: [3, 2, 2, 2], longueurMin: 8, longueurMax: 9 },
  { code: "GA", indicatif: "+241", groupes: [2, 2, 2, 2], longueurMin: 7, longueurMax: 9 },
];

const PAR_CODE = new Map(PAYS_TELEPHONE.map((p) => [p.code, p]));

/** Le pays par défaut quand rien ne le dit — celui du gros du parc installé. */
export const PAYS_TELEPHONE_DEFAUT = "CI";

export function paysTelephone(code: string): PaysTelephone {
  return PAR_CODE.get((code || "").trim().toUpperCase()) ?? PAR_CODE.get(PAYS_TELEPHONE_DEFAUT)!;
}

/** Les codes ISO, du plus long indicatif au plus court — l'ordre de reconnaissance. */
const CODES_PAR_INDICATIF_DECROISSANT = [...PAYS_TELEPHONE].sort(
  (a, b) => b.indicatif.length - a.indicatif.length,
);

export interface TelephoneAnalyse {
  /** Le pays reconnu, ou celui proposé par défaut. */
  pays: string;
  /** Les chiffres du numéro national, sans indicatif ni séparateur. */
  national: string;
  /** L'indicatif a-t-il été **lu dans la valeur**, ou seulement supposé. */
  indicatifExplicite: boolean;
}

/**
 * Décompose une valeur enregistrée en pays + numéro national.
 *
 * Elle doit accepter **ce qui est déjà en base**, où rien n'imposait de format :
 * `+225 07 00 00 00 00`, `0022507000000 00`, ou un simple `0700000000` saisi
 * avant que ce champ existe. Le dernier cas est le seul où le pays est supposé.
 */
export function analyserTelephone(valeur: string, paysDefaut: string): TelephoneAnalyse {
  const defaut = paysTelephone(paysDefaut).code;
  const brut = (valeur || "").replace(/[\s().\-/]/g, "");

  if (!brut) return { pays: defaut, national: "", indicatifExplicite: false };

  // `00` est la forme internationale composée depuis un poste fixe africain ;
  // elle arrive telle quelle dans les carnets d'adresses.
  const international = brut.startsWith("00") ? `+${brut.slice(2)}` : brut;

  if (international.startsWith("+")) {
    for (const pays of CODES_PAR_INDICATIF_DECROISSANT) {
      if (international.startsWith(pays.indicatif)) {
        return {
          pays: pays.code,
          national: international.slice(pays.indicatif.length).replace(/\D/g, ""),
          indicatifExplicite: true,
        };
      }
    }
    // Indicatif hors des neuf pays : on garde les chiffres pour ne rien
    // perdre, et le champ affichera le pays par défaut. La valeur n'est pas
    // détruite — elle est simplement à corriger par celui qui la relit.
    return {
      pays: defaut,
      national: international.replace(/\D/g, ""),
      indicatifExplicite: false,
    };
  }

  return { pays: defaut, national: brut.replace(/\D/g, ""), indicatifExplicite: false };
}

/** Recompose la valeur à enregistrer. Vide si aucun chiffre n'a été saisi. */
export function composerTelephone(pays: string, national: string): string {
  const chiffres = (national || "").replace(/\D/g, "");
  return chiffres ? `${paysTelephone(pays).indicatif}${chiffres}` : "";
}

/** Met le numéro national en forme selon le découpage du pays. */
export function formaterNational(pays: string, national: string): string {
  const chiffres = (national || "").replace(/\D/g, "");
  if (!chiffres) return "";

  const morceaux: string[] = [];
  let reste = chiffres;
  for (const taille of paysTelephone(pays).groupes) {
    if (!reste) break;
    morceaux.push(reste.slice(0, taille));
    reste = reste.slice(taille);
  }
  // Ce qui dépasse le motif se poursuit par paires : mieux vaut un numéro plus
  // long lisible qu'un bloc de chiffres collés.
  while (reste) {
    morceaux.push(reste.slice(0, 2));
    reste = reste.slice(2);
  }
  return morceaux.join(" ");
}

/**
 * Le gabarit de saisie, **calculé** depuis le découpage.
 *
 * Il n'est pas dans le catalogue de traduction, et ce n'est pas un oubli : ce
 * n'est pas une phrase mais un motif de chiffres, identique dans toutes les
 * langues. Le dériver du découpage évite en plus qu'il le contredise.
 */
export function gabaritNational(pays: string): string {
  return paysTelephone(pays)
    .groupes.map((taille) => "0".repeat(taille))
    .join(" ");
}

/** Le numéro est-il complet pour son pays. Une valeur vide n'est pas valide. */
export function telephoneValide(valeur: string, paysDefaut: string): boolean {
  const { pays, national } = analyserTelephone(valeur, paysDefaut);
  const { longueurMin, longueurMax } = paysTelephone(pays);
  return national.length >= longueurMin && national.length <= longueurMax;
}

/** Affichage en lecture : « +225 07 00 00 00 00 ». Chaîne vide si rien. */
export function afficherTelephone(valeur: string, paysDefaut = PAYS_TELEPHONE_DEFAUT): string {
  const { pays, national } = analyserTelephone(valeur, paysDefaut);
  if (!national) return "";
  return `${paysTelephone(pays).indicatif} ${formaterNational(pays, national)}`;
}

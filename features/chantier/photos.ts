/**
 * La prise de vue du rapport journalier — compression et géolocalisation.
 *
 * SFD F2 §5.1 : la photo est compressée **avant l'envoi** (1 200 px au plus,
 * qualité 70 %), horodatée en UTC et géolocalisée. Sur un chantier en région,
 * une photo de 6 Mo prise au téléphone ne passerait pas la connexion ; et le
 * hachage d'intégrité se calcule au serveur, jamais ici (RG-F2-10).
 *
 * Code de navigateur, sans React : il ne s'appelle que depuis un geste.
 */

import { nouvelleCle } from "./validations";
import type { PhotoSaisie, PieceJointe } from "./types";

const COTE_MAX = 1200;
const QUALITE = 0.7;
/** Le GPS d'un téléphone met parfois longtemps à se fixer : on n'attend pas la photo pour lui. */
const DELAI_GPS_MS = 8000;

function lireImage(fichier: File): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resoudre(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error("image_illisible"));
    };
    image.src = url;
  });
}

/** L'image ramenée à 1 200 px sur son grand côté, en JPEG 70 %. */
export async function compresserPhoto(fichier: File): Promise<string> {
  const image = await lireImage(fichier);
  const echelle = Math.min(1, COTE_MAX / Math.max(image.naturalWidth, image.naturalHeight));
  const toile = document.createElement("canvas");
  toile.width = Math.round(image.naturalWidth * echelle);
  toile.height = Math.round(image.naturalHeight * echelle);
  const contexte = toile.getContext("2d");
  if (!contexte) throw new Error("canvas_indisponible");
  contexte.drawImage(image, 0, 0, toile.width, toile.height);
  return toile.toDataURL("image/jpeg", QUALITE);
}

/** La position du téléphone, ou `null` si elle est refusée, absente ou trop lente. */
export function positionActuelle(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resoudre) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resoudre({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resoudre(null),
      { enableHighAccuracy: true, timeout: DELAI_GPS_MS, maximumAge: 60_000 },
    );
  });
}

/** Une photo prête pour le rapport : compressée, horodatée, géolocalisée si possible. */
export async function preparerPhoto(fichier: File): Promise<PhotoSaisie> {
  const [url, position] = await Promise.all([compresserPhoto(fichier), positionActuelle()]);
  return {
    cle: nouvelleCle(),
    url,
    legende: "",
    priseLe: new Date().toISOString(),
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
  };
}

/**
 * Un document joint, tel quel : pas de compression, mais une
 * limite de poids (`TAILLE_MAX_PIECE_JOINTE`) que l'écran vérifie avant.
 */
export function lirePieceJointe(fichier: File): Promise<PieceJointe> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () =>
      resoudre({
        cle: nouvelleCle(),
        nom: fichier.name,
        type: fichier.type,
        taille: fichier.size,
        url: String(lecteur.result),
      });
    lecteur.onerror = () => rejeter(new Error("fichier_illisible"));
    lecteur.readAsDataURL(fichier);
  });
}

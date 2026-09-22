/**
 * Gestion du thème dynamique et personnalisation de la couleur primaire (White-Label).
 *
 * Spécification : Charte Graphique CCD Digital §10.
 * Calcule l'échelle 50→900 à partir d'une couleur hexadécimale de base (500)
 * et injecte dynamiquement les variables CSS correspondantes sur le document.
 */

export const COULEUR_TERRE_CUITE_DEFAUT = "#D4652A";

export interface TeintePalette {
  id: string;
  hex: string;
}

/**
 * Les six teintes de marque proposées au white-label — charte §10.
 *
 * **Aucun libellé ici.** Le nom et la description de chaque teinte sont du
 * texte affiché : ils vivent dans `messages/fr.json`, sous
 * `configuration.entreprise.palette.<id>`, et l'écran les lit par
 * l'identifiant. Ils étaient écrits dans ce tableau, en français, dans un
 * module que la règle `no-literal-string` ne regarde pas — elle ne voit que
 * le JSX (Socle Commun §1.1).
 */
export const PALETTE_OFFICIELLE: TeintePalette[] = [
  { id: "primary-terracotta", hex: COULEUR_TERRE_CUITE_DEFAUT },
  { id: "primary-slate", hex: "#475569" },
  { id: "primary-forest", hex: "#2D6A4F" },
  { id: "primary-ocean", hex: "#1E6091" },
  { id: "primary-burgundy", hex: "#7C2D41" },
  { id: "primary-gold", hex: "#B48A3E" },
];

// ---------------------------------------------------------------------------
// Conversions colorimétriques
// ---------------------------------------------------------------------------

export function hexVersRgb(hex: string): { r: number; g: number; b: number } | null {
  const propre = hex.replace(/^#/, "").trim();
  if (propre.length === 3) {
    return {
      r: parseInt(propre[0] + propre[0], 16),
      g: parseInt(propre[1] + propre[1], 16),
      b: parseInt(propre[2] + propre[2], 16),
    };
  }
  if (propre.length === 6) {
    return {
      r: parseInt(propre.substring(0, 2), 16),
      g: parseInt(propre.substring(2, 4), 16),
      b: parseInt(propre.substring(4, 6), 16),
    };
  }
  return null;
}

export function rgbVersHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

export function rgbVersHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / delta + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslVersRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hNorm = (h % 360) / 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  if (sNorm === 0) {
    const v = Math.round(lNorm * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1 / 2) return q;
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  const r = Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hNorm) * 255);
  const b = Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255);

  return { r, g, b };
}

export function hslVersHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslVersRgb(h, s, l);
  return rgbVersHex(r, g, b);
}

// ---------------------------------------------------------------------------
// Génération des nuances 50→900 selon §10.3 de la charte
// ---------------------------------------------------------------------------

export function genererNuancesPrimaire(hexBase: string): Record<string, string> {
  const rgb = hexVersRgb(hexBase) ?? hexVersRgb(COULEUR_TERRE_CUITE_DEFAUT)!;
  const { h, s, l } = rgbVersHsl(rgb.r, rgb.g, rgb.b);

  return {
    "50": hslVersHex(h, Math.min(s, 50), 97),
    "100": hslVersHex(h, Math.max(s - 25, 20), 92), // Surface
    "200": hslVersHex(h, Math.max(s - 15, 25), 82),
    "300": hslVersHex(h, Math.max(s - 10, 30), 70),
    "400": hslVersHex(h, s, Math.min(l + 10, 62)),
    "500": hexBase, // Base
    "600": hslVersHex(h, s, Math.max(l - 8, 15)), // Hover (-10% environ)
    "700": hslVersHex(h, s, Math.max(l - 16, 12)), // Active (-20% environ)
    "800": hslVersHex(h, s, Math.max(l - 24, 9)),
    "900": hslVersHex(h, s, Math.max(l - 32, 6)),
  };
}

/**
 * Applique l'échelle primaire calculée sur le document HTML (`:root`).
 */
export function appliquerCouleurPrimaire(hex?: string | null): void {
  if (typeof document === "undefined") return;

  const hexValide = hex && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim())
    ? hex.trim()
    : COULEUR_TERRE_CUITE_DEFAUT;

  const nuances = genererNuancesPrimaire(hexValide);
  const racine = document.documentElement;

  for (const [palier, valeur] of Object.entries(nuances)) {
    racine.style.setProperty(`--color-primary-${palier}`, valeur);
  }
}

// ---------------------------------------------------------------------------
// Extraction de couleur dominante à partir d'un fichier image (Canvas)
// ---------------------------------------------------------------------------

export function extraireCouleurDominante(fichier: File): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(COULEUR_TERRE_CUITE_DEFAUT);
      return;
    }

    const lecteur = new FileReader();
    lecteur.onload = (e) => {
      const url = e.target?.result as string;
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        try {
          const taille = 64;
          const canvas = document.createElement("canvas");
          canvas.width = taille;
          canvas.height = taille;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            resolve(COULEUR_TERRE_CUITE_DEFAUT);
            return;
          }

          ctx.drawImage(img, 0, 0, taille, taille);
          const donnees = ctx.getImageData(0, 0, taille, taille).data;

          // Recherche des pixels représentatifs
          let totalR = 0;
          let totalG = 0;
          let totalB = 0;
          let poidsTotal = 0;

          // Meilleur candidat très saturé
          let meilleurScore = -1;
          let meilleureCouleur = COULEUR_TERRE_CUITE_DEFAUT;

          for (let i = 0; i < donnees.length; i += 4) {
            const r = donnees[i];
            const g = donnees[i + 1];
            const b = donnees[i + 2];
            const a = donnees[i + 3];

            // Ignore les pixels transparents
            if (a < 128) continue;

            // Ignore les fonds blancs ou quasi-blancs
            if (r > 240 && g > 240 && b > 240) continue;
            // Ignore les noirs complets
            if (r < 25 && g < 25 && b < 25) continue;

            const { s, l } = rgbVersHsl(r, g, b);

            // Privilégier les couleurs avec une saturation visible
            const score = (s / 100) * (1 - Math.abs(l - 50) / 50);

            if (score > meilleurScore) {
              meilleurScore = score;
              meilleureCouleur = rgbVersHex(r, g, b);
            }

            const poids = Math.max(1, s);
            totalR += r * poids;
            totalG += g * poids;
            totalB += b * poids;
            poidsTotal += poids;
          }

          if (meilleurScore > 0.15) {
            resolve(meilleureCouleur);
          } else if (poidsTotal > 0) {
            resolve(
              rgbVersHex(
                totalR / poidsTotal,
                totalG / poidsTotal,
                totalB / poidsTotal
              )
            );
          } else {
            resolve(COULEUR_TERRE_CUITE_DEFAUT);
          }
        } catch {
          resolve(COULEUR_TERRE_CUITE_DEFAUT);
        }
      };

      img.onerror = () => resolve(COULEUR_TERRE_CUITE_DEFAUT);
      img.src = url;
    };

    lecteur.onerror = () => resolve(COULEUR_TERRE_CUITE_DEFAUT);
    lecteur.readAsDataURL(fichier);
  });
}

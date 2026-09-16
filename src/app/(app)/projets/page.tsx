"use client";

import {
  ArrowRight,
  Buildings,
  Calendar,
  Eye,
  HardHat,
  MagnifyingGlass,
  MapPin,
  TrendUp,
  Users,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { obtenirProjetsAvancement } from "@/features/avancement/api";
import { ProjetAvancement } from "@/features/avancement/types";

import styles from "./page.module.css";

export default function PageListeProjets() {
  const [projets, setProjets] = useState<ProjetAvancement[]>([]);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("TOUS");

  useEffect(() => {
    obtenirProjetsAvancement().then(setProjets);
  }, []);

  const projetsFiltres = useMemo(() => {
    return projets.filter((p) => {
      const correspondTexte =
        p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
        p.code.toLowerCase().includes(recherche.toLowerCase()) ||
        p.localisation.toLowerCase().includes(recherche.toLowerCase()) ||
        p.clientMOA.toLowerCase().includes(recherche.toLowerCase());

      return correspondTexte;
    });
  }, [projets, recherche]);

  return (
    <div className={styles.conteneur}>
      <header className={styles.enTete}>
        <div>
          <h1 className={styles.titre}>
            <Buildings size={32} weight="duotone" style={{ color: "var(--color-primary-500)" }} />
            <span>Chantiers & Projets</span>
          </h1>
          <p className={styles.sousTitre}>
            Supervision de l&apos;ensemble de vos chantiers, avancement physique et gestion technique.
          </p>
        </div>

        <Link href="/tableau-de-bord" className={styles.btnLienSecondaire}>
          <span>Retour au tableau de bord</span>
        </Link>
      </header>

      {/* Barre de recherche et filtres */}
      <div className={styles.barreFiltres}>
        <div style={{ position: "relative", width: "100%", maxWidth: "380px" }}>
          <MagnifyingGlass
            size={18}
            style={{ position: "absolute", left: 12, top: 11, color: "var(--color-neutral-400)" }}
          />
          <input
            type="text"
            className={styles.champRecherche}
            style={{ paddingLeft: "36px" }}
            placeholder="Rechercher un chantier, code, ville..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <select
            className={styles.selectFiltre}
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value)}
          >
            <option value="TOUS">Tous les chantiers ({projets.length})</option>
            <option value="EN_COURS">En cours de travaux</option>
            <option value="LIVRE">Livrés</option>
          </select>
        </div>
      </div>

      {/* Grille des chantiers */}
      <div className={styles.grilleChantiers}>
        {projetsFiltres.map((p) => {
          const ecart = p.avancementReelGlobal - p.avancementTheoriqueGlobal;

          return (
            <article key={p.id} className={styles.carteChantier}>
              <div className={styles.carteHaut}>
                <div className={styles.ligneCodeStatut}>
                  <span className={styles.badgeCode}>{p.code}</span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: ecart >= 0 ? "var(--color-semantic-success)" : "var(--color-semantic-error)",
                    }}
                  >
                    {ecart >= 0 ? `+${ecart}% d'avance` : `${ecart}% retard`}
                  </span>
                </div>

                <h2 className={styles.nomChantier}>{p.nom}</h2>

                <div className={styles.metasChantier}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <MapPin size={14} /> {p.localisation}
                  </span>
                  <span>Maître d&apos;Ouvrage : {p.clientMOA}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Calendar size={14} /> Livraison : {p.dateFinPrevue}
                  </span>
                </div>
              </div>

              {/* Jauge d'avancement */}
              <div className={styles.blocAvancement}>
                <div className={styles.avancementLigne}>
                  <span>Avancement réel constaté</span>
                  <span className={styles.tauxReel}>{p.avancementReelGlobal}%</span>
                </div>
                <div className={styles.barreFond}>
                  <div className={styles.barrePleine} style={{ width: `${p.avancementReelGlobal}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--color-neutral-500)" }}>
                  <span>{p.lots.length} lots techniques</span>
                  <span>{p.photos.length} photos de preuve</span>
                </div>
              </div>

              {/* Boutons d'accès direct */}
              <div className={styles.carteActions}>
                <Link href={`/projets/${p.id}`} className={styles.btnLienSecondaire}>
                  <Eye size={16} />
                  <span>Fiche Chantier</span>
                </Link>

                <Link href={`/projets/${p.id}/avancement`} className={styles.btnLienPrimaire}>
                  <TrendUp size={16} weight="bold" />
                  <span>Avancement & Photos</span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

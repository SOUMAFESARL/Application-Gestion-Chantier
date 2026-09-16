"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  Camera,
  Check,
  CheckCircle,
  Clock,
  DownloadSimple,
  Eye,
  FileText,
  Funnel,
  HardHat,
  Image as ImageIcon,
  MapPin,
  Plus,
  Sliders,
  Sparkle,
  TrendUp,
  UploadSimple,
  User,
  Warning,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  ajouterPhotoPreuve,
  enregistrerMiseAJourProjet,
  obtenirProjetAvancementParId,
  obtenirProjetsAvancement,
} from "@/features/avancement/api";
import { LotAvancement, PhotoPreuve, ProjetAvancement } from "@/features/avancement/types";

import styles from "./page.module.css";

const IMAGES_DEMO_PREUVE = [
  "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=800&q=80",
];

export default function PageAvancementProjet() {
  const params = useParams();
  const rawId = typeof params?.id === "string" ? params.id : "proj-001";

  const [tousProjets, setTousProjets] = useState<ProjetAvancement[]>([]);
  const [projet, setProjet] = useState<ProjetAvancement | null>(null);
  const [vueActive, setVueActive] = useState<"LOTS" | "PHOTOS">("LOTS");
  const [filtreLotPhoto, setFiltreLotPhoto] = useState<string>("TOUS");
  const [photoZoom, setPhotoZoom] = useState<PhotoPreuve | null>(null);
  const [modaleAjoutPhoto, setModaleAjoutPhoto] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Formulaire d'ajout de photo de preuve
  const [nouvellePhotoTitre, setNouvellePhotoTitre] = useState("");
  const [nouvellePhotoLotId, setNouvellePhotoLotId] = useState("");
  const [nouvellePhotoUrl, setNouvellePhotoUrl] = useState(IMAGES_DEMO_PREUVE[0]);
  const [nouvellePhotoPourcent, setNouvellePhotoPourcent] = useState(70);
  const [nouvellePhotoLocalisation, setNouvellePhotoLocalisation] = useState("Zone Bâtiment B - Trame Sud");
  const [nouvellePhotoCommentaire, setNouvellePhotoCommentaire] = useState("");

  useEffect(() => {
    obtenirProjetsAvancement().then((liste) => {
      setTousProjets(liste);
      const sel = liste.find((p) => p.id === rawId) || liste[0];
      setProjet(sel);
      if (sel && sel.lots.length > 0) {
        setNouvellePhotoLotId(sel.lots[0].id);
      }
    });
  }, [rawId]);

  // Recalcul de l'avancement global en fonction des lots
  const avancementGlobalCalcule = useMemo(() => {
    if (!projet || projet.lots.length === 0) return 0;
    const somme = projet.lots.reduce((acc, lot) => acc + lot.avancementReel, 0);
    return Math.round(somme / projet.lots.length);
  }, [projet]);

  const ecartPourcentage = projet ? projet.avancementReelGlobal - projet.avancementTheoriqueGlobal : 0;

  // Mise à jour du pourcentage d'un lot
  const modifierAvancementLot = (lotId: string, valeur: number) => {
    if (!projet) return;
    const lotsMaj = projet.lots.map((lot) => {
      if (lot.id === lotId) {
        return { ...lot, avancementReel: valeur };
      }
      return lot;
    });

    const nouvelleMoyenne = Math.round(lotsMaj.reduce((acc, l) => acc + l.avancementReel, 0) / lotsMaj.length);

    const projetMaj: ProjetAvancement = {
      ...projet,
      lots: lotsMaj,
      avancementReelGlobal: nouvelleMoyenne,
    };

    setProjet(projetMaj);
    enregistrerMiseAJourProjet(projetMaj);
  };

  // Mise à jour de sous-tâche
  const modifierSousTache = (lotId: string, sousTacheId: string, valeur: number) => {
    if (!projet) return;
    const lotsMaj = projet.lots.map((lot) => {
      if (lot.id === lotId) {
        const sousTachesMaj = lot.sousTaches.map((st) => {
          if (st.id === sousTacheId) return { ...st, avancement: valeur };
          return st;
        });
        // Calcul pondéré
        const moyLot = Math.round(
          sousTachesMaj.reduce((acc, st) => acc + (st.avancement * (st.poidsPourcentage / 100)), 0)
        );
        return { ...lot, sousTaches: sousTachesMaj, avancementReel: moyLot };
      }
      return lot;
    });

    const nouvelleMoyenne = Math.round(lotsMaj.reduce((acc, l) => acc + l.avancementReel, 0) / lotsMaj.length);

    const projetMaj: ProjetAvancement = {
      ...projet,
      lots: lotsMaj,
      avancementReelGlobal: nouvelleMoyenne,
    };

    setProjet(projetMaj);
    enregistrerMiseAJourProjet(projetMaj);
  };

  // Envoi de nouvelle photo de preuve
  const soumettrePhotoPreuve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projet) return;

    const lot = projet.lots.find((l) => l.id === nouvellePhotoLotId);
    const nomLot = lot ? lot.nom : "Lot général";

    const now = new Date();
    const dateFormatted = `${now.toISOString().split("T")[0]} ${now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const photoCreee = await ajouterPhotoPreuve(projet.id, {
      url: nouvellePhotoUrl,
      titre: nouvellePhotoTitre,
      lotId: nouvellePhotoLotId,
      nomLot,
      datePrise: dateFormatted,
      auteurNom: "Mamadou Traoré",
      auteurRole: "Chef de Chantier",
      localisation: nouvellePhotoLocalisation,
      pourcentageAssocie: nouvellePhotoPourcent,
      statutConformite: "VERIFIEE",
      commentaire: nouvellePhotoCommentaire,
    });

    setProjet((prev) => (prev ? { ...prev, photos: [photoCreee, ...prev.photos] } : prev));
    setModaleAjoutPhoto(false);
    setNotification("La photo de preuve a été ajoutée et certifiée avec succès !");
    setTimeout(() => setNotification(null), 4000);

    // Réinitialiser champs
    setNouvellePhotoTitre("");
    setNouvellePhotoCommentaire("");
  };

  // Exportation Fiche d'avancement
  const exporterPvAvancement = () => {
    if (!projet) return;
    const contenu = `
====================================================================
          CCD DIGITAL — PROCÈS-VERBAL D'AVANCEMENT DES TRAVAUX
====================================================================
Chantier :           ${projet.nom} (${projet.code})
Client MOA :         ${projet.clientMOA}
Localisation :       ${projet.localisation}
Date du PV :         ${new Date().toLocaleDateString("fr-FR")}
Période :            Du ${projet.dateDebut} au ${projet.dateFinPrevue}

--------------------------------------------------------------------
AVANCEMENT GLOBAL DES OUVRAGES
--------------------------------------------------------------------
Avancement Réel :     ${projet.avancementReelGlobal}%
Avancement Prévu :    ${projet.avancementTheoriqueGlobal}%
Écart Planning :      ${ecartPourcentage >= 0 ? `+${ecartPourcentage}% d'avance` : `${ecartPourcentage}% de retard`}

--------------------------------------------------------------------
DÉTAIL D'AVANCEMENT PAR LOT TECHNIQUE
--------------------------------------------------------------------
${projet.lots
  .map(
    (lot) =>
      `• [Lot ${lot.numeroLot}] ${lot.nom} : ${lot.avancementReel}% (Prévu : ${lot.avancementTheorique}%)\n` +
      lot.sousTaches.map((st) => `   - ${st.libelle} : ${st.avancement}%`).join("\n")
  )
  .join("\n\n")}

--------------------------------------------------------------------
PREUVES PHOTOGRAPHIQUES ASSOCIÉES (${projet.photos.length} photos enregistrées)
--------------------------------------------------------------------
${projet.photos
  .map(
    (p) =>
      `• [${p.datePrise}] ${p.titre} (${p.nomLot}) - Avancement : ${p.pourcentageAssocie}%\n  Lieu : ${p.localisation} · Statut : ${p.statutConformite}`
  )
  .join("\n\n")}

Document certifié généré par la plateforme CCD Digital.
====================================================================
    `;

    const el = document.createElement("a");
    const blob = new Blob([contenu], { type: "text/plain" });
    el.href = URL.createObjectURL(blob);
    el.download = `PV_Avancement_${projet.code}_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);

    setNotification("La fiche de synthèse d'avancement a été téléchargée.");
    setTimeout(() => setNotification(null), 4000);
  };

  const photosAffichees = useMemo(() => {
    if (!projet) return [];
    if (filtreLotPhoto === "TOUS") return projet.photos;
    return projet.photos.filter((p) => p.lotId === filtreLotPhoto);
  }, [projet, filtreLotPhoto]);

  if (!projet) return null;

  return (
    <div className={styles.conteneur}>
      {/* En-tête */}
      <header className={styles.enTete}>
        <div className={styles.titreBloc}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Link href="/projets" style={{ fontSize: "0.875rem", color: "var(--color-neutral-500)", display: "flex", alignItems: "center", gap: "4px" }}>
              <ArrowLeft size={14} />
              <span>Chantiers</span>
            </Link>
            <span style={{ color: "var(--color-neutral-300)" }}>/</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-primary-600)" }}>
              {projet.code}
            </span>
          </div>
          <h1 className={styles.titre}>
            <TrendUp size={30} weight="duotone" style={{ color: "var(--color-primary-500)" }} />
            <span>Suivi d&apos;Avancement & Photos de Preuve</span>
          </h1>
          <p className={styles.sousTitre}>
            {projet.nom} · {projet.clientMOA} · {projet.localisation}
          </p>
        </div>

        {/* Sélecteur rapide de projet et bouton export */}
        <div className={styles.actionsHaut}>
          <select
            className={styles.champSelect}
            style={{ width: "auto", minWidth: "220px", padding: "8px 12px" }}
            value={projet.id}
            onChange={(e) => {
              const p = tousProjets.find((proj) => proj.id === e.target.value);
              if (p) setProjet(p);
            }}
          >
            {tousProjets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>

          <button type="button" onClick={exporterPvAvancement} className={styles.btnSecondaire}>
            <DownloadSimple size={16} weight="bold" />
            <span>Export PV</span>
          </button>
        </div>
      </header>

      {/* Notification Toast */}
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

      {/* 1. BANDEAU DE SYNTHESE GLOBALE (POURCENTAGE & GAUGE) */}
      <section className={styles.bandeauSynthese}>
        <div className={styles.jaugeAvancementSection}>
          <div className={styles.jaugeLignePourcent}>
            <div>
              <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-600)", fontWeight: 700, textTransform: "uppercase" }}>
                Avancement Réel Réalisé
              </span>
              <div className={styles.grandPourcentage}>{projet.avancementReelGlobal}%</div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div className={styles.pourcentageTheorique}>Objectif prévu : {projet.avancementTheoriqueGlobal}%</div>
              {ecartPourcentage >= 0 ? (
                <span className={`${styles.badgeEcart} ${styles.ecartAvance}`}>
                  <TrendUp size={14} weight="bold" />
                  <span>+{ecartPourcentage}% d&apos;avance</span>
                </span>
              ) : (
                <span className={`${styles.badgeEcart} ${styles.ecartRetard}`}>
                  <Warning size={14} weight="bold" />
                  <span>{ecartPourcentage}% de retard</span>
                </span>
              )}
            </div>
          </div>

          {/* Double barre de progression */}
          <div className={styles.barreDoubleFond}>
            <div className={styles.barreReelle} style={{ width: `${projet.avancementReelGlobal}%` }} />
            <div
              className={styles.repereTheorique}
              style={{ left: `${projet.avancementTheoriqueGlobal}%` }}
              title={`Objectif prévu : ${projet.avancementTheoriqueGlobal}%`}
            />
          </div>

          <div className={styles.legendeJauge}>
            <div>
              <span className={styles.pastilleLegende} style={{ background: "var(--color-primary-500)" }} />
              <span>Avancement réel constaté sur site</span>
            </div>
            <div>
              <span className={styles.pastilleLegende} style={{ background: "var(--color-neutral-900)" }} />
              <span>Cible planning contractuel</span>
            </div>
          </div>
        </div>

        {/* Repères calendaires */}
        <div className={styles.planningInfos}>
          <div className={styles.planningItem}>
            <span className={styles.planningLabel}>Date de démarrage</span>
            <span className={styles.planningValeur}>{projet.dateDebut}</span>
          </div>
          <div className={styles.planningItem}>
            <span className={styles.planningLabel}>Livraison prévue</span>
            <span className={styles.planningValeur}>{projet.dateFinPrevue}</span>
          </div>
          <div className={styles.planningItem}>
            <span className={styles.planningLabel}>Lots suivis</span>
            <span className={styles.planningValeur}>{projet.lots.length} corps d&apos;état</span>
          </div>
          <div className={styles.planningItem}>
            <span className={styles.planningLabel}>Preuves visuelles</span>
            <span className={styles.planningValeur}>{projet.photos.length} photos certifiées</span>
          </div>
        </div>
      </section>

      {/* 2. ONGLETS DE VUE (AVANCEMENT PAR LOTS / GALERIE PHOTOS) */}
      <nav className={styles.barreOnglets} aria-label="Navigation avancement">
        <button
          type="button"
          className={`${styles.ongletBtn} ${vueActive === "LOTS" ? styles.ongletActif : ""}`}
          onClick={() => setVueActive("LOTS")}
        >
          <Sliders size={16} weight="bold" />
          <span>Pourcentages par Lot ({projet.lots.length})</span>
        </button>
        <button
          type="button"
          className={`${styles.ongletBtn} ${vueActive === "PHOTOS" ? styles.ongletActif : ""}`}
          onClick={() => setVueActive("PHOTOS")}
        >
          <Camera size={16} weight="bold" />
          <span>Photos de Preuve ({projet.photos.length})</span>
        </button>
      </nav>

      {/* ================================================================
          VUE 1 : AVANCEMENT DETAILLE PAR LOTS ET SOUS-TACHES
          ================================================================ */}
      {vueActive === "LOTS" && (
        <section className={styles.grilleLots}>
          {projet.lots.map((lot) => (
            <article key={lot.id} className={styles.carteLot}>
              <div className={styles.lotEntete}>
                <div className={styles.lotTitreGroupe}>
                  <span className={styles.badgeNumeroLot}>Lot {lot.numeroLot}</span>
                  <div>
                    <h2 className={styles.lotNom}>{lot.nom}</h2>
                    <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)" }}>
                      Responsable : {lot.responsableNom} · Prévu planning : {lot.avancementTheorique}%
                    </span>
                  </div>
                </div>

                <div className={styles.lotControlePourcentage}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={lot.avancementReel}
                    className={styles.inputSlider}
                    onChange={(e) => modifierAvancementLot(lot.id, Number(e.target.value))}
                    aria-label={`Pourcentage pour ${lot.nom}`}
                  />
                  <span className={styles.lotPourcentageAffiche}>{lot.avancementReel}%</span>
                </div>
              </div>

              {/* Sous-tâches détaillées avec curseurs */}
              <div className={styles.listeSousTaches}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-neutral-600)", textTransform: "uppercase" }}>
                  Ouvrages & Tâches composant ce lot :
                </span>

                {lot.sousTaches.map((st) => (
                  <div key={st.id} className={styles.ligneSousTache}>
                    <div className={styles.sousTacheLibelle}>
                      <span>{st.libelle}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-neutral-400)", marginLeft: "6px" }}>
                        (Poids : {st.poidsPourcentage}%)
                      </span>
                    </div>

                    <div className={styles.sousTacheCurseur}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={st.avancement}
                        className={styles.inputSlider}
                        style={{ width: "100%" }}
                        onChange={(e) => modifierSousTache(lot.id, st.id, Number(e.target.value))}
                      />
                    </div>

                    <div className={styles.sousTachePourcent}>{st.avancement}%</div>
                  </div>
                ))}
              </div>

              {/* Photos associées à ce lot */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid var(--color-neutral-100)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem", color: "var(--color-neutral-600)" }}>
                  <Camera size={16} />
                  <span>
                    {projet.photos.filter((p) => p.lotId === lot.id).length} photo(s) de preuve associée(s)
                  </span>
                </div>

                <button
                  type="button"
                  className={styles.btnSecondaire}
                  style={{ padding: "6px 12px", fontSize: "0.8125rem" }}
                  onClick={() => {
                    setNouvellePhotoLotId(lot.id);
                    setNouvellePhotoPourcent(lot.avancementReel);
                    setModaleAjoutPhoto(true);
                  }}
                >
                  <Plus size={14} weight="bold" />
                  <span>Ajouter une preuve photo</span>
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* ================================================================
          VUE 2 : GALERIE DES PHOTOS DE PREUVE
          ================================================================ */}
      {vueActive === "PHOTOS" && (
        <section className={styles.sectionPhotos}>
          <div className={styles.barreActionsPhotos}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-neutral-700)" }}>
                Filtrer par lot :
              </label>
              <select
                className={styles.champSelect}
                style={{ width: "auto", minWidth: "220px" }}
                value={filtreLotPhoto}
                onChange={(e) => setFiltreLotPhoto(e.target.value)}
              >
                <option value="TOUS">Tous les corps d&apos;état ({projet.photos.length})</option>
                {projet.lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    Lot {l.numeroLot} - {l.nom}
                  </option>
                ))}
              </select>
            </div>

            <button type="button" onClick={() => setModaleAjoutPhoto(true)} className={styles.btnAction}>
              <Camera size={18} weight="bold" />
              <span>Prendre / Téléverser une photo</span>
            </button>
          </div>

          {photosAffichees.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", background: "#fff", borderRadius: "16px" }}>
              <Camera size={44} weight="light" style={{ color: "var(--color-neutral-400)", marginBottom: "12px" }} />
              <p style={{ color: "var(--color-neutral-600)", marginBottom: "16px" }}>
                Aucune photo de preuve enregistrée pour ce filtre.
              </p>
              <button type="button" onClick={() => setModaleAjoutPhoto(true)} className={styles.btnAction}>
                <Plus size={16} weight="bold" />
                <span>Ajouter la première photo de preuve</span>
              </button>
            </div>
          ) : (
            <div className={styles.grillePhotosPreuves}>
              {photosAffichees.map((photo) => (
                <article
                  key={photo.id}
                  className={styles.cartePhotoPreuve}
                  onClick={() => setPhotoZoom(photo)}
                >
                  <div className={styles.photoImageWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.titre} className={styles.photoImage} />
                    <span className={styles.badgePourcentPhoto}>{photo.pourcentageAssocie}% exécuté</span>
                  </div>

                  <div className={styles.photoCorps}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-primary-600)" }}>
                        {photo.nomLot}
                      </span>
                      <span className={`${styles.badgeCertif} ${photo.statutConformite === "VERIFIEE" ? styles.certifVerifiee : styles.certifAttente}`}>
                        {photo.statutConformite === "VERIFIEE" ? "✓ Certifiée" : "En attente"}
                      </span>
                    </div>

                    <h3 className={styles.photoTitre}>{photo.titre}</h3>

                    <div className={styles.photoMetas}>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <MapPin size={13} /> {photo.localisation}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={13} /> {photo.datePrise} · Par {photo.auteurNom}
                      </span>
                    </div>

                    {photo.commentaire && <p className={styles.photoCommentaire}>{photo.commentaire}</p>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. MODALE D'AJOUT DE PHOTO DE PREUVE */}
      {modaleAjoutPhoto && (
        <div className={styles.modaleOverlay} onClick={() => setModaleAjoutPhoto(false)}>
          <div className={styles.modaleBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modaleEntete}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Camera size={24} weight="duotone" style={{ color: "var(--color-primary-500)" }} />
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Ajouter une Photo de Preuve d&apos;Avancement</h2>
              </div>
              <button
                type="button"
                onClick={() => setModaleAjoutPhoto(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={soumettrePhotoPreuve} className={styles.formulairePhoto}>
              {/* Choix visuel de l'image */}
              <div className={styles.champItem}>
                <label className={styles.champLabel}>Sélectionnez ou capturez une photo de chantier *</label>
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px" }}>
                  {IMAGES_DEMO_PREUVE.map((img, idx) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={idx}
                      src={img}
                      alt={`Preuve ${idx}`}
                      style={{
                        width: "80px",
                        height: "60px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        cursor: "pointer",
                        border: nouvellePhotoUrl === img ? "3px solid var(--color-primary-500)" : "1px solid #ccc",
                      }}
                      onClick={() => setNouvellePhotoUrl(img)}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.champItem}>
                <label className={styles.champLabel}>Titre / Désignation de l&apos;ouvrage *</label>
                <input
                  type="text"
                  required
                  className={styles.champInput}
                  placeholder="Ex : Ferraillage poteau P8 avant coulage R+2"
                  value={nouvellePhotoTitre}
                  onChange={(e) => setNouvellePhotoTitre(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className={styles.champItem}>
                  <label className={styles.champLabel}>Lot technique rattaché</label>
                  <select
                    className={styles.champSelect}
                    value={nouvellePhotoLotId}
                    onChange={(e) => setNouvellePhotoLotId(e.target.value)}
                  >
                    {projet.lots.map((l) => (
                      <option key={l.id} value={l.id}>
                        Lot {l.numeroLot} - {l.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.champItem}>
                  <label className={styles.champLabel}>Pourcentage d&apos;avancement attesté</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      className={styles.champInput}
                      value={nouvellePhotoPourcent}
                      onChange={(e) => setNouvellePhotoPourcent(Number(e.target.value))}
                    />
                    <span style={{ fontWeight: 700 }}>%</span>
                  </div>
                </div>
              </div>

              <div className={styles.champItem}>
                <label className={styles.champLabel}>Localisation précise sur site</label>
                <input
                  type="text"
                  required
                  className={styles.champInput}
                  placeholder="Ex : Étage R+2, Façade Sud-Ouest"
                  value={nouvellePhotoLocalisation}
                  onChange={(e) => setNouvellePhotoLocalisation(e.target.value)}
                />
              </div>

              <div className={styles.champItem}>
                <label className={styles.champLabel}>Commentaires et observations techniques</label>
                <textarea
                  rows={3}
                  className={styles.champTextarea}
                  placeholder="Détails du contrôle : enrobage, respect des plans, état des coffrages..."
                  value={nouvellePhotoCommentaire}
                  onChange={(e) => setNouvellePhotoCommentaire(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
                <button
                  type="button"
                  className={styles.btnSecondaire}
                  onClick={() => setModaleAjoutPhoto(false)}
                >
                  <span>Annuler</span>
                </button>
                <button type="submit" className={styles.btnAction}>
                  <Check size={18} weight="bold" />
                  <span>Enregistrer la preuve certifiée</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODALE PLEIN ECRAN ZOOM PHOTO */}
      {photoZoom && (
        <div className={styles.modaleOverlay} onClick={() => setPhotoZoom(null)}>
          <div className={styles.modaleBox} style={{ maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modaleEntete}>
              <div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700 }}>{photoZoom.titre}</h3>
                <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-500)" }}>
                  {photoZoom.nomLot} · Avancement attesté : <strong>{photoZoom.pourcentageAssocie}%</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPhotoZoom(null)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoZoom.url}
              alt={photoZoom.titre}
              style={{ width: "100%", maxHeight: "450px", objectFit: "contain", borderRadius: "12px", background: "#111" }}
            />

            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.875rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span><strong>Lieu :</strong> {photoZoom.localisation}</span>
                <span><strong>Date :</strong> {photoZoom.datePrise}</span>
              </div>
              <div>
                <strong>Auteur du cliché :</strong> {photoZoom.auteurNom} ({photoZoom.auteurRole})
              </div>
              {photoZoom.commentaire && (
                <div style={{ padding: "10px", background: "var(--color-neutral-50)", borderRadius: "8px" }}>
                  <strong>Note de contrôle :</strong> {photoZoom.commentaire}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button type="button" className={styles.btnAction} onClick={() => setPhotoZoom(null)}>
                <span>Fermer la vue</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

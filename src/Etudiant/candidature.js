const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { verifyToken } = require('../middlewares/auth');

// Helper function to fetch and package status summary
async function handleSummaryFetch(etudiantId, res) {
  try {
    // 1. Statistiques globales calculées directement en SQL pour plus de précision
    const [statsResult] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut IN ('En attente', 'Vue') THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN statut = 'Acceptée' THEN 1 ELSE 0 END) as acceptes,
        SUM(CASE WHEN statut = 'Refusée' THEN 1 ELSE 0 END) as refuses,
        SUM(CASE WHEN date_candidature >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as recent_activity
      FROM candidature 
      WHERE id_etudiant = ?
    `, [etudiantId]);

    // 2. Récupérer toutes les candidatures avec détails (Jointures optimisées et complètes)
    const [candidatures] = await pool.query(`
      SELECT 
        c.id, c.statut, c.date_candidature, c.cv_fichier, c.lettre_motivation as autre_fichier,
        c.date_entretien, c.commentaire_entreprise,
        o.titre as offre_titre,
        o.description as offre_desc,
        o.duree,
        o.date_debut,
        o.date_fin,
        e.nom as entreprise_nom,
        u.nom as universite_nom,
        COALESCE(e.commune, 'Campus Académique') as lieu,
        COALESCE(e.telephone, u.telephone) as entreprise_phone,
        COALESCE(e.email, u.email) as entreprise_email
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      LEFT JOIN entreprise e ON o.id_entreprise = e.id
      LEFT JOIN universite u ON o.id_universite = u.id
      WHERE c.id_etudiant = ?
      ORDER BY c.date_candidature DESC
    `, [etudiantId]);

    // 3. Récupérer les interactions (Likes et Commentaires) de manière robuste
    const [likesResult] = await pool.query('SELECT COUNT(*) as likes_count FROM aime WHERE id_etudiant = ?', [etudiantId]);
    const [commentsResult] = await pool.query('SELECT COUNT(*) as comments_count FROM commentaire WHERE id_etudiant = ?', [etudiantId]);

    const likes_count = likesResult[0]?.likes_count || 0;
    const comments_count = commentsResult[0]?.comments_count || 0;

    const s = statsResult[0] || {};
    const stats = {
      total: parseInt(s.total) || 0,
      en_attente: parseInt(s.en_attente) || 0,
      acceptes: parseInt(s.acceptes) || 0,
      refuses: parseInt(s.refuses) || 0,
      recent: parseInt(s.recent_activity) || 0,
      interactions: {
        likes: likes_count,
        commentaires: comments_count
      }
    };

    // 4. Déterminer le "Stage Actuel" à partir d'une candidature Acceptée (Avec détails complets)
    const [stageActuelResult] = await pool.query(`
        SELECT 
          c.id as candidature_id,
          c.statut,
          c.date_candidature,
          c.date_entretien,
          c.commentaire_entreprise,
          o.titre as offre_titre, 
          o.description as offre_desc,
          o.date_debut,
          o.date_fin,
          o.duree,
          e.nom as entreprise_nom,
          u.nom as universite_nom,
          COALESCE(e.commune, 'Campus Académique') as lieu,
          COALESCE(e.telephone, u.telephone) as entreprise_phone,
          COALESCE(e.email, u.email) as entreprise_email
        FROM candidature c
        JOIN offre_stage o ON c.id_offre_stage = o.id
        LEFT JOIN entreprise e ON o.id_entreprise = e.id
        LEFT JOIN universite u ON o.id_universite = u.id
        WHERE c.id_etudiant = ? AND c.statut = 'Acceptée'
        ORDER BY c.date_candidature DESC
        LIMIT 1
    `, [etudiantId]);

    return res.json({
      success: true,
      data: {
        stats,
        candidatures,
        stageActuel: stageActuelResult[0] || null
      }
    });

  } catch (error) {
    console.error('Erreur détaillée summary status:', error);
    return res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
  }
}

// GET /api/etudiants/status/summary - Résout l'étudiant connecté via JWT
router.get('/summary', verifyToken, async (req, res) => {
  const etudiantId = req.user.id;
  await handleSummaryFetch(etudiantId, res);
});

// GET /api/etudiants/status/summary/:etudiantId - Reste disponible pour compatibilité administrative
router.get('/summary/:etudiantId', async (req, res) => {
  const { etudiantId } = req.params;
  await handleSummaryFetch(etudiantId, res);
});

module.exports = router;

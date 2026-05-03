const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// GET /api/etudiants/status/summary/:etudiantId
router.get('/summary/:etudiantId', async (req, res) => {
  const { etudiantId } = req.params;

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

    // 2. Récupérer toutes les candidatures avec détails (Jointures optimisées)
    const [candidatures] = await pool.query(`
      SELECT 
        c.id, c.statut, c.date_candidature, c.cv_fichier,
        o.titre as offre_titre,
        e.nom as entreprise_nom,
        CONCAT(u.prenom, ' ', u.nom) as universite_nom
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      LEFT JOIN entreprise e ON o.id_entreprise = e.id
      LEFT JOIN universite u ON o.id_universite = u.id
      WHERE c.id_etudiant = ?
      ORDER BY c.date_candidature DESC
    `, [etudiantId]);

    // 3. Récupérer les interactions (Likes et Commentaires)
    const [[{ likes_count }]] = await pool.query('SELECT COUNT(*) as likes_count FROM aime WHERE id_etudiant = ?', [etudiantId]);
    const [[{ comments_count }]] = await pool.query('SELECT COUNT(*) as comments_count FROM commentaire WHERE id_etudiant = ?', [etudiantId]);

    const s = statsResult[0];
    const stats = {
      total: s.total || 0,
      en_attente: s.en_attente || 0,
      acceptes: s.acceptes || 0,
      refuses: s.refuses || 0,
      recent: s.recent_activity || 0,
      interactions: {
        likes: likes_count || 0,
        commentaires: comments_count || 0
      }
    };

    // 4. Déterminer le "Stage Actuel" à partir d'une candidature Acceptée
    const [stageActuelResult] = await pool.query(`
        SELECT 
          c.id as candidature_id,
          o.titre as offre_titre, 
          e.nom as entreprise_nom,
          u.nom as universite_nom,
          o.date_debut,
          o.date_fin,
          o.duree
        FROM candidature c
        JOIN offre_stage o ON c.id_offre_stage = o.id
        LEFT JOIN entreprise e ON o.id_entreprise = e.id
        LEFT JOIN universite u ON o.id_universite = u.id
        WHERE c.id_etudiant = ? AND c.statut = 'Acceptée'
        ORDER BY c.date_candidature DESC
        LIMIT 1
    `, [etudiantId]);

    res.json({
      success: true,
      data: {
        stats,
        candidatures,
        stageActuel: stageActuelResult[0] || null
      }
    });

  } catch (error) {
    console.error('Erreur détaillée summary status:', error);
    res.status(500).json({ success: false, message: "Erreur serveur", error: error.message });
  }
});

module.exports = router;

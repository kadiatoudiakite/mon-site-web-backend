const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const jwt = require('jsonwebtoken');

// Middleware d'authentification JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'stagetrack_secret_key_2024', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// ==================== GESTION DES CANDIDATURES ====================

// 1. Récupérer toutes les candidatures reçues par l'entreprise (Détails enrichis + Filtrage par offre)
router.get('/recues', authenticateToken, async (req, res) => {
  const entrepriseId = req.user.id;
  const { offreId } = req.query;

  let query = `
    SELECT 
      c.id AS id,
      c.date_candidature,
      c.statut,
      c.lettre_motivation,
      c.cv_fichier,
      c.commentaire_entreprise,
      o.titre AS poste,
      o.id AS offre_id,
      e.id AS etudiant_id,
      CONCAT(e.nom, ' ', e.prenom) AS nom,
      e.email,
      e.telephone,
      e.photo,
      e.sexe,
      e.matricule,
      e.commune,
      e.quartier,
      f.nom AS filiere,
      n.libelle AS niveau
    FROM candidature c
    JOIN offre_stage o ON c.id_offre_stage = o.id
    JOIN etudiant e ON c.id_etudiant = e.id
    LEFT JOIN filiere f ON e.id_filiere = f.id
    LEFT JOIN niveau n ON e.id_niveau = n.id
    WHERE o.id_entreprise = ?
  `;

  const params = [entrepriseId];

  if (offreId) {
    query += ` AND o.id = ?`;
    params.push(offreId);
  }

  query += ` ORDER BY c.date_candidature DESC`;

  try {
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Marquer une candidature comme "Vue"
router.put('/marquer-vue/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // On ne marque "Vue" que si c'était "En attente"
    await pool.query(
      "UPDATE candidature SET statut = 'Vue' WHERE id = ? AND statut = 'En attente'",
      [id]
    );
    res.json({ success: true, message: 'Candidature consultée' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Mettre à jour le statut d'une candidature (Acceptée/Refusée)
router.put('/statut/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { statut, commentaire } = req.body; 

  // Validation des statuts autorisés par l'ENUM
  const validStatus = ['En attente', 'Vue', 'Acceptée', 'Refusée'];
  if (!validStatus.includes(statut)) {
    return res.status(400).json({ success: false, message: 'Statut invalide' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE candidature SET statut = ?, commentaire_entreprise = ? WHERE id = ?',
      [statut, commentaire || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Candidature non trouvée' });
    }

    res.json({ success: true, message: `Candidature mise à jour : ${statut}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Récupérer la liste des stagiaires (candidatures acceptées)
router.get('/stagiaires', authenticateToken, async (req, res) => {
  const entrepriseId = req.user.id;
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.id AS id,
        CONCAT(e.nom, ' ', e.prenom) AS nom,
        o.titre AS poste,
        e.email,
        e.telephone,
        o.date_debut AS dateDebut,
        o.date_fin AS dateFin,
        'En cours' AS statut,
        'Tuteur non assigné' AS tuteur,
        5.0 AS evaluation
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      JOIN etudiant e ON c.id_etudiant = e.id
      WHERE o.id_entreprise = ? AND c.statut = 'Accepté'
      ORDER BY o.date_debut DESC
    `, [entrepriseId]);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Analyse complète pour le dashboard (Charts & Stats)
router.get('/analyse', authenticateToken, async (req, res) => {
  const entrepriseId = req.user.id;
  try {
    // 1. Statistiques globales (Total, Acceptés, En attente, Refusés)
    const [globalStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN c.statut = 'Acceptée' THEN 1 ELSE 0 END) as acceptes,
        SUM(CASE WHEN c.statut IN ('En attente', 'Vue') THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN c.statut = 'Refusée' THEN 1 ELSE 0 END) as refuses
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      WHERE o.id_entreprise = ?
    `, [entrepriseId]);

    // Candidatures par mois (pour le line chart)
    const [candidaturesParMois] = await pool.query(`
      SELECT 
        DATE_FORMAT(c.date_candidature, '%b') as mois,
        COUNT(*) as total
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      WHERE o.id_entreprise = ?
      GROUP BY mois
      ORDER BY FIELD(mois, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
    `, [entrepriseId]);

    // Top 5 des offres les plus populaires
    const [topOffres] = await pool.query(`
      SELECT 
        o.titre,
        COUNT(c.id) as total
      FROM offre_stage o
      LEFT JOIN candidature c ON o.id = c.id_offre_stage
      WHERE o.id_entreprise = ?
      GROUP BY o.id
      ORDER BY total DESC
      LIMIT 5
    `, [entrepriseId]);

    // Distribution par Domaine
    const [domaines] = await pool.query(`
      SELECT 
        d.nom,
        COUNT(o.id) as total_offres
      FROM domaine d
      JOIN offre_stage o ON d.id = o.id_domaine
      WHERE o.id_entreprise = ?
      GROUP BY d.id
    `, [entrepriseId]);

    res.json({
      success: true,
      data: {
        global: globalStats[0],
        evolution: candidaturesParMois,
        topOffres: topOffres,
        domaines: domaines
      }
    });
  } catch (error) {
    console.error('💥 Erreur analyse:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

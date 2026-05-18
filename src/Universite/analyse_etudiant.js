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

// ==================== GESTION DES ANALYSES ÉTUDIANTS (Rattaché à l'Université) ====================

router.get('/statistiques', authenticateToken, async (req, res) => {
  try {
    const universiteId = req.user.id;

    // 1. Répartition par Filière (Global car les étudiants n'ont pas d'id_universite direct)
    const [filieres] = await pool.query(`
      SELECT f.nom as label, COUNT(e.id) as value
      FROM filiere f
      JOIN etudiant e ON f.id = e.id_filiere
      GROUP BY f.id
    `);

    // 2. Répartition par Niveau (Global car les étudiants n'ont pas d'id_universite direct)
    const [niveaux] = await pool.query(`
      SELECT n.libelle as label, COUNT(e.id) as value
      FROM niveau n
      JOIN etudiant e ON n.id = e.id_niveau
      GROUP BY n.id
    `);

    // 3. Stats Candidatures (Filtre par les offres de CETTE Université + Mappage des statuts pour le frontend)
    const [candidatures] = await pool.query(`
      SELECT 
        CASE 
          WHEN c.statut = 'Acceptée' THEN 'Accepté'
          WHEN c.statut = 'Refusée' THEN 'Refusé'
          ELSE c.statut
        END as label, 
        COUNT(c.id) as value
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      WHERE o.id_universite = ?
      GROUP BY label
    `, [universiteId]);

    res.json({
      success: true,
      data: {
        filieres,
        niveaux,
        candidatures
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/liste-complete', authenticateToken, async (req, res) => {
  try {
    const [students] = await pool.query(`
      SELECT 
        e.id,
        e.nom,
        e.prenom,
        e.email,
        e.telephone,
        f.nom as filiere,
        n.libelle as niveau,
        (SELECT COUNT(*) FROM candidature WHERE id_etudiant = e.id) as nb_candidatures,
        (SELECT COUNT(*) FROM candidature WHERE id_etudiant = e.id AND statut IN ('Accepté', 'Acceptée')) as nb_stages
      FROM etudiant e
      LEFT JOIN filiere f ON e.id_filiere = f.id
      LEFT JOIN niveau n ON e.id_niveau = n.id
      ORDER BY e.nom ASC
    `);

    res.json({
      success: true,
      data: students
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

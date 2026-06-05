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

    // 1. Répartition par Filière (étudiants ayant candidaté aux offres de cette université)
    const [filieres] = await pool.query(`
      SELECT f.nom as label, COUNT(DISTINCT e.id) as value
      FROM filiere f
      JOIN etudiant e ON f.id = e.id_filiere
      JOIN candidature c ON e.id = c.id_etudiant
      JOIN offre_stage o ON c.id_offre_stage = o.id
      WHERE o.id_universite = ?
      GROUP BY f.id
    `, [universiteId]);

    // 2. Répartition par Niveau (idem)
    const [niveaux] = await pool.query(`
      SELECT n.libelle as label, COUNT(DISTINCT e.id) as value
      FROM niveau n
      JOIN etudiant e ON n.id = e.id_niveau
      JOIN candidature c ON e.id = c.id_etudiant
      JOIN offre_stage o ON c.id_offre_stage = o.id
      WHERE o.id_universite = ?
      GROUP BY n.id
    `, [universiteId]);

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
    console.error('Erreur statistiques étudiants:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/liste-complete', authenticateToken, async (req, res) => {
  try {
    const universiteId = req.user.id;
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
        (SELECT COUNT(*) FROM candidature WHERE id_etudiant = e.id AND statut = 'Acceptée') as nb_stages
      FROM etudiant e
      LEFT JOIN filiere f ON e.id_filiere = f.id
      LEFT JOIN niveau n ON e.id_niveau = n.id
      WHERE EXISTS (
        SELECT 1 FROM candidature c
        JOIN offre_stage o ON c.id_offre_stage = o.id
        WHERE c.id_etudiant = e.id AND o.id_universite = ?
      )
      ORDER BY e.nom ASC
    `, [universiteId]);

    res.json({
      success: true,
      data: students
    });
  } catch (error) {
    console.error('Erreur liste étudiants:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
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

// ==================== ANALYSES POUR L'UNIVERSITÉ (MODE SYSTÈME UNIQUE) ====================
// Note: Comme tout le système est pour une seule université, nous récupérons les données globales.

router.get('/globale', authenticateToken, async (req, res) => {
  try {
    // 1. ANALYSE ENTREPRISES (Toutes les entreprises du système)
    const [entreprises] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        (SELECT COUNT(DISTINCT d.id) FROM domaine d JOIN entreprise e ON d.id = e.domaine_id) as total_domaines
      FROM entreprise
    `);

    const [domainesEntreprise] = await pool.query(`
      SELECT d.nom, COUNT(e.id) as count
      FROM domaine d
      JOIN entreprise e ON d.id = e.domaine_id
      GROUP BY d.id
    `);

    // 2. ANALYSE ÉTUDIANTS (Tous les étudiants du système)
    const [etudiants] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN sexe = 'M' THEN 1 ELSE 0 END) as hommes,
        SUM(CASE WHEN sexe = 'F' THEN 1 ELSE 0 END) as femmes
      FROM etudiant
    `);

    const [placements] = await pool.query(`
      SELECT 
        COUNT(DISTINCT id_etudiant) as etudiants_places
      FROM candidature 
      WHERE statut = 'Accepté'
    `);

    const [filieresStats] = await pool.query(`
      SELECT f.nom, COUNT(e.id) as total
      FROM filiere f
      JOIN etudiant e ON f.id = e.id_filiere
      GROUP BY f.id
    `);

    // 3. ANALYSE OFFRES (Toutes les offres du système)
    const [offres] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN id_entreprise IS NOT NULL THEN 1 ELSE 0 END) as offres_entreprises,
        SUM(CASE WHEN id_universite IS NOT NULL THEN 1 ELSE 0 END) as offres_universites
      FROM offre_stage
    `);

    const [offresMois] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%b') as mois, COUNT(*) as total
      FROM offre_stage
      GROUP BY mois
      ORDER BY FIELD(mois, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
    `);

    res.json({
      success: true,
      data: {
        entreprises: {
          total: entreprises[0].total,
          domaines: domainesEntreprise,
          nbDomaines: entreprises[0].total_domaines
        },
        etudiants: {
          total: etudiants[0].total,
          hommes: etudiants[0].hommes,
          femmes: etudiants[0].femmes,
          placements: placements[0].etudiants_places,
          filieres: filieresStats
        },
        offres: {
          total: offres[0].total,
          parType: { entreprise: offres[0].offres_entreprises, universite: offres[0].offres_universites },
          evolution: offresMois
        }
      }
    });

  } catch (error) {
    console.error('💥 Erreur analyse globale université:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Nouvelle route pour récupérer toutes les candidatures avec détails
router.get('/candidatures-globales', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.date_candidature,
        c.statut,
        c.cv_fichier,
        c.lettre_motivation,
        CONCAT(e.nom, ' ', e.prenom) as nom,
        e.email as email,
        e.id as etudiant_id,
        f.nom as filiere,
        o.titre as poste,
        d.nom as domaine_nom,
        COALESCE(ent.nom, 'Université (Interne)') as entreprise_nom,
        ent.id as entreprise_id
      FROM candidature c
      JOIN etudiant e ON c.id_etudiant = e.id
      JOIN offre_stage o ON c.id_offre_stage = o.id
      LEFT JOIN filiere f ON e.id_filiere = f.id
      LEFT JOIN domaine d ON o.id_domaine = d.id
      LEFT JOIN entreprise ent ON o.id_entreprise = ent.id
      ORDER BY c.date_candidature DESC
    `);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('💥 Erreur récupération candidatures globales:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// Middleware de simulation d'ID Université (ID 1 pour les tests)
const getUniversiteId = (req) => req.query.universiteId || 1;

// ==================== SUPERVISION & GESTION UNIVERSITÉ ====================

// 1. Voir toutes les candidatures pour les offres de CETTE université
router.get('/mes-candidatures', async (req, res) => {
  const univId = getUniversiteId(req);
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.id AS candidature_id,
        c.date_candidature,
        c.statut,
        c.lettre_motivation,
        c.cv_fichier,
        o.titre AS offre_titre,
        e.nom AS etudiant_nom,
        e.prenom AS etudiant_prenom,
        e.email AS etudiant_email,
        f.nom AS filiere,
        n.libelle AS niveau
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      JOIN etudiant e ON c.id_etudiant = e.id
      LEFT JOIN filiere f ON e.id_filiere = f.id
      LEFT JOIN niveau n ON e.id_niveau = n.id
      WHERE o.id_universite = ?
      ORDER BY c.date_candidature DESC
    `, [univId]);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Accepter/Refuser une candidature (pour les offres de l'université)
router.put('/candidature/:id/statut', async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;
  try {
    await pool.query('UPDATE candidature SET statut = ? WHERE id = ?', [statut, id]);
    res.json({ success: true, message: `Statut mis à jour : ${statut}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Vue Globale (Supervision de tout le système)
// Permet à l'université de voir TOUTES les offres (Entreprises + Universités)
router.get('/vue-globale/offres', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        o.id, o.titre, o.created_at,
        COALESCE(e.nom, u.nom) AS publie_par,
        CASE WHEN e.id IS NOT NULL THEN 'Entreprise' ELSE 'Université' END AS type_editeur,
        (SELECT COUNT(*) FROM candidature WHERE id_offre_stage = o.id) AS nb_postulants
      FROM offre_stage o
      LEFT JOIN entreprise e ON o.id_entreprise = e.id
      LEFT JOIN universite u ON o.id_universite = u.id
      ORDER BY o.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Statistiques de Supervision pour l'Université
router.get('/vue-globale/stats', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM etudiant) AS total_etudiants,
        (SELECT COUNT(*) FROM offre_stage) AS total_offres,
        (SELECT COUNT(*) FROM candidature) AS total_candidatures,
        (SELECT COUNT(*) FROM candidature WHERE statut = 'Acceptée') AS stages_en_cours
    `);
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

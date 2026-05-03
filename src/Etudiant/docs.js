const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// ==================== DOCUMENTS DE L'ÉTUDIANT ====================

// Récupérer les documents de l'étudiant (CV, lettres de motivation, etc.)
router.get('/:etudiantId', async (req, res) => {
  const { etudiantId } = req.params;

  // Validation de l'ID
  if (!etudiantId || isNaN(etudiantId)) {
    return res.status(400).json({
      success: false,
      message: "ID étudiant invalide"
    });
  }

  try {
    const [rows] = await pool.query(`
      SELECT 
        DISTINCT 
        cv_fichier AS name,
        'CV' AS type,
        date_candidature AS date_upload,
        cv_fichier AS url   -- À adapter selon ton système de stockage (ex: chemin ou URL complète)
      FROM candidature 
      WHERE id_etudiant = ? 
        AND cv_fichier IS NOT NULL

      UNION ALL

      -- Tu pourras ajouter ici les lettres de motivation quand la colonne existera
      -- SELECT lm_fichier AS name, 'Lettre de motivation' AS type, date_candidature AS date_upload, lm_fichier AS url
      -- FROM candidature 
      -- WHERE id_etudiant = ? AND lm_fichier IS NOT NULL
    `, [etudiantId]);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des documents:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des documents"
    });
  }
});

module.exports = router;
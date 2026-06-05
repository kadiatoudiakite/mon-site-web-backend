const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { verifyToken } = require('../middlewares/auth');

// ==================== GESTION DES CANDIDATURES UNIVERSITÉ ====================

// 1. Récupérer toutes les candidatures reçues par l'université (Détails enrichis + Filtrage par offre)
router.get('/recues', verifyToken, async (req, res) => {
  const universiteId = req.user.id;
  const { offreId } = req.query;

  let query = `
    SELECT
      c.id AS id,
      c.date_candidature,
      c.statut,
      c.lettre_motivation,
      c.cv_fichier,
      c.commentaire_entreprise,
      c.date_entretien,
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
      c.date_entretien,
      c.description_mission,
      f.nom AS filiere,
      n.libelle AS niveau
    FROM candidature c
    JOIN offre_stage o ON c.id_offre_stage = o.id
    JOIN etudiant e ON c.id_etudiant = e.id
    LEFT JOIN filiere f ON e.id_filiere = f.id
    LEFT JOIN niveau n ON e.id_niveau = n.id
    WHERE o.id_universite = ?
  `;

  const params = [universiteId];

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
router.put('/marquer-vue/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const universiteId = req.user.id;
  try {
    const [result] = await pool.query(
      `UPDATE candidature c
       JOIN offre_stage o ON c.id_offre_stage = o.id
       SET c.statut = 'Vue'
       WHERE c.id = ?
         AND c.statut = 'En attente'
         AND o.id_universite = ?`,
      [id, universiteId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Candidature non trouvée ou non autorisée' });
    }

    // Notification pour l'étudiant
    try {
      const [details] = await pool.query(`
        SELECT 
          c.id_etudiant,
          o.titre as job_title,
          u.nom as universite_name
        FROM candidature c
        JOIN offre_stage o ON c.id_offre_stage = o.id
        JOIN universite u ON o.id_universite = u.id
        WHERE c.id = ?
      `, [id]);

      if (details.length > 0) {
        const { id_etudiant, job_title, universite_name } = details[0];
        const { createStudentNotification } = require('../utils/notifications');

        await createStudentNotification({
          id_etudiant: id_etudiant,
          id_universite: universiteId,
          titre: 'Candidature consultée',
          message: `Votre candidature pour "${job_title}" a été vue par ${universite_name}.`,
          type: 'candidature'
        });
      }
    } catch (notifError) {
      console.error('Erreur notification vue université:', notifError);
    }

    res.json({ success: true, message: 'Candidature consultée' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Mettre à jour le statut d'une candidature (Acceptée/Refusée)
router.put('/statut/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { statut, commentaire, date_entretien } = req.body;

  const validStatus = ['En attente', 'Vue', 'Acceptée', 'Refusée'];
  if (!validStatus.includes(statut)) {
    return res.status(400).json({ success: false, message: 'Statut invalide' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT c.statut
       FROM candidature c
       JOIN offre_stage o ON c.id_offre_stage = o.id
       WHERE c.id = ?
         AND o.id_universite = ?`,
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Candidature non trouvée ou non autorisée' });
    }

    const currentStatus = rows[0].statut;
    if (currentStatus === 'Acceptée' || currentStatus === 'Refusée') {
      return res.status(400).json({
        success: false,
        message: 'Cette candidature a déjà été traitée et sa décision est finale.'
      });
    }

    const [result] = await pool.query(
      `UPDATE candidature c
       JOIN offre_stage o ON c.id_offre_stage = o.id
       SET c.statut = ?, c.commentaire_entreprise = ?, c.date_entretien = ?, c.description_mission = ?
       WHERE c.id = ?
         AND o.id_universite = ?`,
      [statut, commentaire || null, date_entretien || null, req.body.description_mission || null, id, req.user.id]
    );

    res.json({ success: true, message: `Candidature mise à jour : ${statut}` });

    // Notifications
    try {
      const [details] = await pool.query(`
        SELECT 
          c.id_etudiant,
          CONCAT(et.nom, ' ', et.prenom) as student_name,
          o.titre as job_title,
          o.id_entreprise,
          u.nom as universite_name
        FROM candidature c
        JOIN etudiant et ON c.id_etudiant = et.id
        JOIN offre_stage o ON c.id_offre_stage = o.id
        LEFT JOIN universite u ON o.id_universite = u.id
        WHERE c.id = ?
      `, [id]);

      if (details.length > 0) {
        const { id_etudiant, student_name, job_title, id_entreprise, universite_name } = details[0];
        const { createStudentNotification } = require('../utils/notifications');

        if (id_entreprise) {
          await createStudentNotification({
            id_entreprise: id_entreprise,
            id_universite: req.user.id,
            id_etudiant: id_etudiant,
            titre: 'Décision sur une candidature',
            message: `${universite_name || 'L\'université'} a marqué la candidature de ${student_name} (${job_title}) comme "${statut}".`,
            type: 'candidature'
          });
        }

        await createStudentNotification({
          id_etudiant: id_etudiant,
          id_universite: req.user.id,
          id_entreprise: id_entreprise || null,
          titre: 'Mise à jour de votre candidature',
          message: `Votre candidature pour le poste "${job_title}" chez ${universite_name || 'l\'université'} a été mise à jour : Statut "${statut}".`,
          type: 'candidature'
        });
      }
    } catch (notifError) {
      console.error('Erreur notification décision université:', notifError);
    }

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Récupérer la liste des stagiaires (candidatures acceptées)
router.get('/stagiaires', verifyToken, async (req, res) => {
  const universiteId = req.user.id;
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
      WHERE o.id_universite = ? AND c.statut = 'Acceptée'
      ORDER BY o.date_debut DESC
    `, [universiteId]);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Analyse complète pour le dashboard (Charts & Stats)
router.get('/analyse', verifyToken, async (req, res) => {
  const universiteId = req.user.id;
  try {
    const [globalStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN c.statut = 'Acceptée' THEN 1 ELSE 0 END) as acceptes,
        SUM(CASE WHEN c.statut IN ('En attente', 'Vue') THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN c.statut = 'Refusée' THEN 1 ELSE 0 END) as refuses
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      WHERE o.id_universite = ?
    `, [universiteId]);

    const [candidaturesParMois] = await pool.query(`
      SELECT
        DATE_FORMAT(c.date_candidature, '%b') as mois,
        COUNT(*) as total
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      WHERE o.id_universite = ?
      GROUP BY mois
      ORDER BY FIELD(mois, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
    `, [universiteId]);

    const [topOffres] = await pool.query(`
      SELECT
        o.titre,
        COUNT(c.id) as total
      FROM offre_stage o
      LEFT JOIN candidature c ON o.id = c.id_offre_stage
      WHERE o.id_universite = ?
      GROUP BY o.id
      ORDER BY total DESC
      LIMIT 5
    `, [universiteId]);

    const [domaines] = await pool.query(`
      SELECT
        d.nom,
        COUNT(o.id) as total_offres
      FROM domaine d
      JOIN offre_stage o ON d.id = o.id_domaine
      WHERE o.id_universite = ?
      GROUP BY d.id
    `, [universiteId]);

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
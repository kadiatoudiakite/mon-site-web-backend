const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const jwt = require('jsonwebtoken');
const { createStudentNotification } = require('../utils/notifications'); // ← Mise à jour du chemin

// Middleware d'authentification
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

// 1. Récupérer toutes les candidatures
router.get('/recues', authenticateToken, async (req, res) => {
  const entrepriseId = req.user.id;
  const { offreId } = req.query;

  let query = `
    SELECT 
      c.id, c.date_candidature, c.statut, c.lettre_motivation, c.cv_fichier,
      c.commentaire_entreprise, c.date_entretien,
      o.titre AS poste, o.id AS offre_id,
      e.id AS etudiant_id, CONCAT(e.nom, ' ', e.prenom) AS nom,
      e.email, e.telephone, e.photo, e.sexe, e.matricule, e.commune, e.quartier,
      f.nom AS filiere, n.libelle AS niveau
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
  const entrepriseId = req.user.id;

  try {
    const [result] = await pool.query(
      "UPDATE candidature SET statut = 'Vue' WHERE id = ? AND statut = 'En attente'",
      [id]
    );

    if (result.affectedRows > 0) {
      const [details] = await pool.query(`
        SELECT 
          c.id_etudiant,
          o.titre as job_title,
          ent.nom as entreprise_name,
          o.id_universite
        FROM candidature c
        JOIN offre_stage o ON c.id_offre_stage = o.id
        JOIN entreprise ent ON o.id_entreprise = ent.id
        WHERE c.id = ?
      `, [id]);

      if (details.length > 0) {
        const { id_etudiant, job_title, entreprise_name, id_universite } = details[0];

        await createStudentNotification({
          id_etudiant,
          id_entreprise: entrepriseId,
          id_universite,
          titre: 'Candidature consultée',
          message: `Votre candidature pour "${job_title}" a été vue par ${entreprise_name}.`,
          type: 'candidature'
        });
      }
    }

    res.json({ success: true, message: 'Candidature marquée comme vue' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Mettre à jour le statut + date d'entretien (la plus importante)
router.put('/statut/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { statut, commentaire, date_entretien } = req.body;
  const entrepriseId = req.user.id;

  const validStatus = ['En attente', 'Vue', 'Acceptée', 'Refusée'];
  if (!validStatus.includes(statut)) {
    return res.status(400).json({ success: false, message: 'Statut invalide' });
  }

  try {
    // Vérification du statut actuel
    const [current] = await pool.query('SELECT statut FROM candidature WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Candidature non trouvée' });
    }
    if (['Acceptée', 'Refusée'].includes(current[0].statut)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cette candidature a déjà une décision finale.' 
      });
    }

    // Mise à jour
    const [result] = await pool.query(
      `UPDATE candidature 
       SET statut = ?, commentaire_entreprise = ?, date_entretien = ? 
       WHERE id = ?`,
      [statut, commentaire || null, date_entretien || null, id]
    );

    if (result.affectedRows > 0) {
      // Récupération des informations pour la notification
      const [details] = await pool.query(`
        SELECT 
          c.id_etudiant,
          CONCAT(et.nom, ' ', et.prenom) as student_name,
          o.titre as job_title,
          ent.nom as entreprise_name,
          o.id_universite,
          c.date_entretien
        FROM candidature c
        JOIN etudiant et ON c.id_etudiant = et.id
        JOIN offre_stage o ON c.id_offre_stage = o.id
        JOIN entreprise ent ON o.id_entreprise = ent.id
        WHERE c.id = ?
      `, [id]);

      if (details.length > 0) {
        const { id_etudiant, job_title, entreprise_name, id_universite, date_entretien: newDate } = details[0];

        let titre = 'Mise à jour de candidature';
        let message = `Votre candidature pour "${job_title}" chez ${entreprise_name} est maintenant "${statut}".`;

        if (statut === 'Acceptée') {
          titre = 'Candidature acceptée 🎉';
          message = `Félicitations ! Votre candidature pour "${job_title}" a été acceptée par ${entreprise_name}.`;
        } else if (statut === 'Refusée') {
          titre = 'Candidature refusée';
          message = `Votre candidature pour "${job_title}" a malheureusement été refusée par ${entreprise_name}.`;
        } else if (newDate) {
          titre = 'Entretien programmé 📅';
          message = `Un entretien pour "${job_title}" a été programmé le ${new Date(newDate).toLocaleDateString('fr-FR')}.`;
        }

        await createStudentNotification({
          id_etudiant,
          id_entreprise: entrepriseId,
          id_universite,
          titre,
          message,
          type: 'candidature'
        });
      }
    }

    res.json({ success: true, message: `Statut mis à jour : ${statut}` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Liste des stagiaires
router.get('/stagiaires', authenticateToken, async (req, res) => {
  const entrepriseId = req.user.id;
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        CONCAT(e.nom, ' ', e.prenom) AS nom,
        o.titre AS poste,
        e.email, e.telephone,
        o.date_debut AS dateDebut,
        o.date_fin AS dateFin,
        'En cours' AS statut
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      JOIN etudiant e ON c.id_etudiant = e.id
      WHERE o.id_entreprise = ? AND c.statut = 'Acceptée'
      ORDER BY o.date_debut DESC
    `, [entrepriseId]);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Analyse dashboard
router.get('/analyse', authenticateToken, async (req, res) => {
  const entrepriseId = req.user.id;
  try {
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

    const [candidaturesParMois] = await pool.query(`
      SELECT DATE_FORMAT(c.date_candidature, '%b') as mois, COUNT(*) as total
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      WHERE o.id_entreprise = ?
      GROUP BY mois
      ORDER BY FIELD(mois, 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec')
    `, [entrepriseId]);

    const [topOffres] = await pool.query(`
      SELECT o.titre, COUNT(c.id) as total
      FROM offre_stage o
      LEFT JOIN candidature c ON o.id = c.id_offre_stage
      WHERE o.id_entreprise = ?
      GROUP BY o.id
      ORDER BY total DESC LIMIT 5
    `, [entrepriseId]);

    const [domaines] = await pool.query(`
      SELECT d.nom, COUNT(o.id) as total_offres
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
        topOffres,
        domaines
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
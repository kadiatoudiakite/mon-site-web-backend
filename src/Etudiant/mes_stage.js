const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration multer pour l'upload de documents (CV et Lettre)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// ==================== ROUTES ====================

// POST /api/etudiants/stages/postuler - Soumettre une candidature
router.post('/postuler', upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'lettre', maxCount: 1 }
]), async (req, res) => {
  const { id_etudiant, id_offre_stage, lettre_motivation_texte } = req.body;
  const cv_fichier = req.files['cv'] ? `/uploads/${req.files['cv'][0].filename}` : null;
  const lettre_motivation_fichier = req.files['lettre'] ? `/uploads/${req.files['lettre'][0].filename}` : null;

  if (!id_etudiant || !id_offre_stage) {
    return res.status(400).json({ success: false, message: "Données manquantes (étudiant ou offre)" });
  }

  try {
    // 1. Vérifier si l'étudiant a déjà postulé à CETTE offre spécifique
    const [existing] = await pool.query(
      'SELECT id FROM candidature WHERE id_etudiant = ? AND id_offre_stage = ?',
      [id_etudiant, id_offre_stage]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Vous avez déjà postulé à cette offre de stage." 
      });
    }

    // 2. Insérer la candidature
    // Note: on utilise cv_fichier pour CV et lettre_motivation pour le fichier ou texte selon le schéma
    await pool.query(
      `INSERT INTO candidature (id_etudiant, id_offre_stage, cv_fichier, lettre_motivation, date_candidature, statut) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'En attente')`,
      [id_etudiant, id_offre_stage, cv_fichier, lettre_motivation_fichier || lettre_motivation_texte]
    );

    // 3. Notification pour le créateur de l'offre
    try {
      const [details] = await pool.query(`
        SELECT 
          CONCAT(e.nom, ' ', e.prenom) as student_name,
          o.titre as job_title,
          o.id_entreprise,
          o.id_universite
        FROM etudiant e, offre_stage o
        WHERE e.id = ? AND o.id = ?
      `, [id_etudiant, id_offre_stage]);

      if (details.length > 0) {
        const { student_name, job_title, id_entreprise, id_universite } = details[0];
        const notificationModule = require('../Entreprise/notificationentreprise');
        
        await notificationModule.createNotification({
          id_entreprise: id_entreprise,
          id_universite: id_universite,
          titre: 'Nouvelle candidature reçue',
          message: `${student_name} a postulé pour le poste : ${job_title}`,
          type: 'candidature'
        });
      }
    } catch (notifError) {
      console.error('Erreur notification candidature:', notifError);
    }

    res.json({ 
      success: true, 
      message: "Votre candidature a été envoyée avec succès !" 
    });

  } catch (error) {
    console.error('Erreur lors de la postulation:', error);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de l'envoi de la candidature" 
    });
  }
});

// Récupérer le suivi des candidatures d'un étudiant
router.get('/candidatures/:etudiantId', async (req, res) => {
  const { etudiantId } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.*,
        o.titre AS offre_titre,
        e.nom AS entreprise_nom,
        e.logo AS entreprise_logo,
        u.nom AS universite_nom,
        u.logo AS universite_logo
      FROM candidature c
      JOIN offre_stage o ON c.id_offre_stage = o.id
      LEFT JOIN entreprise e ON o.id_entreprise = e.id
      LEFT JOIN universite u ON o.id_universite = u.id
      WHERE c.id_etudiant = ?
      ORDER BY c.date_candidature DESC
    `, [etudiantId]);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Récupérer le stage actuel
router.get('/actuel/:etudiantId', async (req, res) => {
  const { etudiantId } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.*,
        o.titre AS offre_titre,
        e.nom AS entreprise_nom
      FROM stages s
      JOIN offre_stage o ON s.offre_id = o.id
      JOIN entreprise e ON o.id_entreprise = e.id
      WHERE s.etudiant_id = ? AND s.statut = 'en_cours'
      LIMIT 1
    `, [etudiantId]);

    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

module.exports = router;
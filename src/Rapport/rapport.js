const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const multer = require('multer');
const path = require('path');
const { verifyToken } = require('../middlewares/auth');

// Configuration de multer pour les rapports (PDF uniquement recommandé)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/rapports/');
  },
  filename: (req, file, cb) => {
    cb(null, `rapport_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) return cb(null, true);
    cb(new Error('Seuls les fichiers PDF et Word sont acceptés.'));
  }
});

// --- ROUTES ÉTUDIANT ---

// Soumettre un rapport
router.post('/soumettre', verifyToken, upload.single('rapport'), async (req, res) => {
  const { id_entreprise, id_universite, id_offre_stage, titre, description, encadreur_entreprise, encadreur_universite, date_debut_stage, date_fin_stage } = req.body;
  const id_etudiant = req.user.id;

  if (!req.file) return res.status(400).json({ success: false, message: 'Fichier rapport manquant.' });

  try {
    // Proactivement récupérer les dates de début et fin depuis l'offre de stage s'ils ne sont pas spécifiés par le client
    let resolvedDateDebut = date_debut_stage || null;
    let resolvedDateFin = date_fin_stage || null;

    if (id_offre_stage && (!resolvedDateDebut || !resolvedDateFin)) {
      const [offreRows] = await pool.query(
        'SELECT date_debut, date_fin FROM offre_stage WHERE id = ?',
        [id_offre_stage]
      );
      if (offreRows.length > 0) {
        if (!resolvedDateDebut) resolvedDateDebut = offreRows[0].date_debut;
        if (!resolvedDateFin) resolvedDateFin = offreRows[0].date_fin;
      }
    }

    const [result] = await pool.query(
      `INSERT INTO rapport (id_etudiant, id_entreprise, id_universite, id_offre_stage, titre, description, fichier_rapport, encadreur_entreprise, encadreur_universite, date_debut_stage, date_fin_stage, statut) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'soumis')`,
      [
        id_etudiant, 
        id_entreprise && id_entreprise !== 'null' && id_entreprise !== '0' ? id_entreprise : null,
        id_universite && id_universite !== 'null' && id_universite !== '0' ? id_universite : null,
        id_offre_stage || null, 
        titre, 
        description, 
        req.file.path, 
        encadreur_entreprise, 
        encadreur_universite, 
        resolvedDateDebut, 
        resolvedDateFin
      ]
    );

    res.json({ success: true, message: 'Rapport soumis avec succès !', id: result.insertId });
  } catch (err) {
    console.error('Erreur lors de la soumission du rapport:', err);
    res.status(500).json({ success: false, message: 'Erreur lors de la soumission.' });
  }
});

// Modifier un rapport existant
router.put('/modifier/:id', verifyToken, upload.single('rapport'), async (req, res) => {
  const { id } = req.params;
  const { id_entreprise, id_universite, id_offre_stage, titre, description, encadreur_entreprise, encadreur_universite, date_debut_stage, date_fin_stage } = req.body;
  const id_etudiant = req.user.id;

  try {
    // 1. Vérifier si le rapport existe et appartient bien à l'étudiant connecté
    const [existing] = await pool.query(
      'SELECT * FROM rapport WHERE id = ? AND id_etudiant = ?',
      [id, id_etudiant]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Rapport non trouvé ou non autorisé.' });
    }

    // Un rapport ne peut généralement être modifié que s'il n'est pas encore validé ('valide') par l'université
    if (existing[0].statut === 'valide') {
      return res.status(400).json({ success: false, message: 'Un rapport déjà validé ne peut plus être modifié.' });
    }

    // 2. Déterminer le fichier rapport (nouveau fichier ou conservation de l'ancien)
    const fichier_rapport = req.file ? req.file.path : existing[0].fichier_rapport;

    // 3. Récupérer les dates de l'offre si non spécifiées et si l'offre a changé
    let resolvedDateDebut = date_debut_stage || existing[0].date_debut_stage;
    let resolvedDateFin = date_fin_stage || existing[0].date_fin_stage;

    if (id_offre_stage && id_offre_stage !== existing[0].id_offre_stage && (!date_debut_stage || !date_fin_stage)) {
      const [offreRows] = await pool.query(
        'SELECT date_debut, date_fin FROM offre_stage WHERE id = ?',
        [id_offre_stage]
      );
      if (offreRows.length > 0) {
        resolvedDateDebut = offreRows[0].date_debut;
        resolvedDateFin = offreRows[0].date_fin;
      }
    }

    // 4. Mettre à jour en base de données
    await pool.query(
      `UPDATE rapport 
       SET id_entreprise = ?, 
           id_universite = ?, 
           id_offre_stage = ?, 
           titre = ?, 
           description = ?, 
           fichier_rapport = ?, 
           encadreur_entreprise = ?, 
           encadreur_universite = ?, 
           date_debut_stage = ?, 
           date_fin_stage = ?, 
           statut = 'soumis' -- Repasse en statut soumis pour revalidation
       WHERE id = ? AND id_etudiant = ?`,
      [
        id_entreprise && id_entreprise !== 'null' && id_entreprise !== '0' ? id_entreprise : null,
        id_universite && id_universite !== 'null' && id_universite !== '0' ? id_universite : null,
        id_offre_stage || null, 
        titre || existing[0].titre, 
        description || existing[0].description, 
        fichier_rapport, 
        encadreur_entreprise !== undefined ? encadreur_entreprise : existing[0].encadreur_entreprise, 
        encadreur_universite !== undefined ? encadreur_universite : existing[0].encadreur_universite, 
        resolvedDateDebut, 
        resolvedDateFin,
        id,
        id_etudiant
      ]
    );

    res.json({ success: true, message: 'Rapport mis à jour avec succès !' });
  } catch (err) {
    console.error('Erreur lors de la modification du rapport:', err);
    res.status(500).json({ success: false, message: 'Erreur lors de la modification.' });
  }
});

// Récupérer les stages acceptés (pour lier au rapport)
router.get('/mes-stages', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        c.id_offre_stage, 
        o.id_entreprise, 
        o.id_universite, 
        o.titre as titre_offre, 
        COALESCE(e.nom, u.nom, 'Organisme inconnu') as nom_entreprise
       FROM candidature c
       JOIN offre_stage o ON c.id_offre_stage = o.id
       LEFT JOIN entreprise e ON o.id_entreprise = e.id
       LEFT JOIN universite u ON o.id_universite = u.id
       WHERE c.id_etudiant = ? AND c.statut = 'Acceptée'`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur SQL mes-stages:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// Récupérer mes rapports (Étudiant)
router.get('/mes-rapports', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        r.*, 
        COALESCE(e.nom, u.nom, e_off.nom, u_off.nom, 'Organisme non spécifié') as nom_entreprise 
       FROM rapport r
       LEFT JOIN entreprise e ON r.id_entreprise = e.id
       LEFT JOIN universite u ON r.id_universite = u.id
       LEFT JOIN offre_stage o ON r.id_offre_stage = o.id
       LEFT JOIN entreprise e_off ON o.id_entreprise = e_off.id
       LEFT JOIN universite u_off ON o.id_universite = u_off.id
       WHERE r.id_etudiant = ? 
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur SQL mes-rapports:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// --- ROUTES ENTREPRISE ---

// Récupérer les rapports reçus par l'entreprise (direct ou indirect via l'offre)
router.get('/entreprise/recus', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        r.*, 
        et.nom, 
        et.prenom,
        o.titre as offre_titre
       FROM rapport r
       JOIN etudiant et ON r.id_etudiant = et.id
       LEFT JOIN offre_stage o ON r.id_offre_stage = o.id
       WHERE r.id_entreprise = ? 
          OR o.id_entreprise = ?
       ORDER BY r.created_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur SQL rapport entreprise/recus:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// Valider/Commenter un rapport (Entreprise)
router.put('/entreprise/valider/:id', verifyToken, async (req, res) => {
  const { statut, commentaire_validation } = req.body;
  try {
    // Vérifier si le rapport est déjà validé
    const [existing] = await pool.query(
      'SELECT statut FROM rapport WHERE id = ?',
      [req.params.id]
    );

    if (existing.length > 0 && existing[0].statut === 'valide') {
      return res.status(400).json({
        success: false,
        message: 'Ce rapport a déjà été validé et ne peut plus être modifié.'
      });
    }

    const [result] = await pool.query(
      `UPDATE rapport SET statut = ?, commentaire_validation = ? WHERE id = ? AND id_entreprise = ?`,
      [statut, commentaire_validation, req.params.id, req.user.id]
    );

    if (result.affectedRows > 0) {
      // Notifier l'étudiant
      const [details] = await pool.query(
        `SELECT r.id_etudiant, r.titre, e.nom as entreprise_nom 
         FROM rapport r 
         JOIN entreprise e ON r.id_entreprise = e.id 
         WHERE r.id = ?`,
        [req.params.id]
      );
      if (details.length > 0) {
        const { id_etudiant, titre, entreprise_nom } = details[0];
        const { createStudentNotification } = require('../utils/notifications');
        await createStudentNotification({
          id_etudiant,
          id_entreprise: req.user.id,
          titre: 'Rapport évalué par l\'entreprise 📝',
          message: `${entreprise_nom} a mis à jour le statut de votre rapport "${titre}" à "${statut}".`,
          type: 'alerte'
        });
      }
    }

    res.json({ success: true, message: 'Rapport mis à jour.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la validation.' });
  }
});

// --- ROUTES UNIVERSITÉ ---

// Récupérer les rapports des étudiants de l'université
router.get('/universite/tous', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        r.*, 
        et.nom as etudiant_nom, 
        et.prenom as etudiant_prenom, 
        COALESCE(e.nom, u.nom, e_off.nom, u_off.nom, 'Organisme non spécifié') as entreprise_nom,
        o.titre as offre_titre
       FROM rapport r
       JOIN etudiant et ON r.id_etudiant = et.id
       LEFT JOIN entreprise e ON r.id_entreprise = e.id
       LEFT JOIN universite u ON r.id_universite = u.id
       LEFT JOIN offre_stage o ON r.id_offre_stage = o.id
       LEFT JOIN entreprise e_off ON o.id_entreprise = e_off.id
       LEFT JOIN universite u_off ON o.id_universite = u_off.id
       ORDER BY r.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('❌ Erreur SQL Rapports Université:', err);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement des rapports.' });
  }
});

// Noter un rapport (Université)
router.put('/universite/noter/:id', verifyToken, async (req, res) => {
  const { note, commentaire_validation, statut } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE rapport SET note = ?, commentaire_validation = ?, statut = ? WHERE id = ?`,
      [note, commentaire_validation, statut || 'valide', req.params.id]
    );

    if (result.affectedRows > 0) {
      // Notifier l'étudiant
      const [details] = await pool.query(
        `SELECT r.id_etudiant, r.titre, u.nom as universite_nom 
         FROM rapport r 
         JOIN etudiant et ON r.id_etudiant = et.id
         LEFT JOIN universite u ON et.id_universite = u.id
         WHERE r.id = ?`,
        [req.params.id]
      );
      if (details.length > 0) {
        const { id_etudiant, titre, universite_nom } = details[0];
        const { createStudentNotification } = require('../utils/notifications');
        
        let msg = `Votre université a noté et validé votre rapport "${titre}".`;
        if (note) msg += ` Note obtenue: ${note}/20.`;

        await createStudentNotification({
          id_etudiant,
          id_universite: req.user.id,
          titre: 'Rapport noté par l\'université 🎓',
          message: msg,
          type: 'alerte'
        });
      }
    }

    res.json({ success: true, message: 'Rapport noté et validé.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de la notation.' });
  }
});

module.exports = router;

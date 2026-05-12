const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middlewares/auth');

// Configuration multer pour l'upload de la photo de profil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Seules les images (jpg, jpeg, png) sont autorisées"));
  }
});

// ==================== PROFIL ÉTUDIANT ====================

// Route SÉCURISÉE : Récupérer mon profil (utilisateur connecté)
router.get('/me', verifyToken, async (req, res) => {
  const etudiantId = req.user.id;

  try {
    const [rows] = await pool.query(`
      SELECT 
        e.id,
        e.matricule,
        e.nom,
        e.prenom,
        e.email,
        e.photo,
        e.sexe,
        e.telephone,
        e.commune,
        e.quartier,
        e.nom_pere,
        e.nom_mere,
        e.id_filiere,
        e.id_niveau,
        f.nom AS filiere_nom,
        n.libelle AS niveau_libelle,
        d.nom AS departement_nom
      FROM etudiant e
      LEFT JOIN filiere f ON e.id_filiere = f.id
      LEFT JOIN niveau n ON e.id_niveau = n.id
      LEFT JOIN departement d ON f.departement_id = d.id
      WHERE e.id = ?
    `, [etudiantId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Profil non trouvé" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Récupérer le profil complet d'un étudiant (route publique pour l'APP)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(`
      SELECT 
        e.*, 
        f.nom AS filiere_nom,
        n.libelle AS niveau_libelle,
        d.nom AS departement_nom
      FROM etudiant e
      LEFT JOIN filiere f ON e.id_filiere = f.id
      LEFT JOIN niveau n ON e.id_niveau = n.id
      LEFT JOIN departement d ON f.departement_id = d.id
      WHERE e.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Étudiant non trouvé" });
    }

    const { mot_de_passe, ...profil } = rows[0];
    res.json({ success: true, data: profil });

  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Mettre à jour la photo de profil (SÉCURISÉ)
router.put('/me/photo', verifyToken, upload.single('photo'), async (req, res) => {
  const etudiantId = req.user.id;
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Aucun fichier envoyé" });
  }

  const photoPath = `/uploads/profiles/${req.file.filename}`;

  try {
    // Optionnel : Supprimer l'ancienne photo si elle existe
    const [old] = await pool.query('SELECT photo FROM etudiant WHERE id = ?', [etudiantId]);
    if (old[0] && old[0].photo && old[0].photo.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '../../', old[0].photo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await pool.query('UPDATE etudiant SET photo = ? WHERE id = ?', [photoPath, etudiantId]);
    res.json({ success: true, message: "Photo mise à jour", photo: photoPath });
  } catch (error) {
    console.error('Erreur MAJ photo:', error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Mettre à jour les informations textuelles du profil (SÉCURISÉ)
router.put('/me', verifyToken, async (req, res) => {
  const etudiantId = req.user.id;
  const { nom, prenom, telephone, commune, quartier, nom_pere, nom_mere, id_filiere, id_niveau } = req.body;

  try {
    await pool.query(`
      UPDATE etudiant 
      SET nom = ?, prenom = ?, telephone = ?, commune = ?, quartier = ?, 
          nom_pere = ?, nom_mere = ?, id_filiere = ?, id_niveau = ?
      WHERE id = ?
    `, [nom, prenom, telephone, commune, quartier, nom_pere, nom_mere, id_filiere, id_niveau, etudiantId]);

    res.json({ success: true, message: "Profil mis à jour" });
  } catch (error) {
    console.error('Erreur MAJ profil:', error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

module.exports = router;
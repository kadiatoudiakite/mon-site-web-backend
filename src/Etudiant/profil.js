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
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    // Accepter tous les types MIME d'image courants
    const acceptedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const acceptedExts = /\.(jpg|jpeg|png|gif|webp)$/i;
    
    const mimeOk = acceptedMimes.includes(file.mimetype);
    const extOk = acceptedExts.test(path.extname(file.originalname));
    
    if (mimeOk && extOk) {
      return cb(null, true);
    }
    
    cb(new Error("Seules les images (jpg, jpeg, png, gif, webp) sont autorisées"));
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
  
  try {
    // Vérifier que le fichier a bien été uploadé
    if (!req.file) {
      console.error('Aucun fichier reçu pour l\'étudiant', etudiantId);
      return res.status(400).json({ 
        success: false, 
        message: "Aucun fichier envoyé" 
      });
    }

    console.log('Upload de photo pour étudiant', etudiantId, '- Fichier:', req.file.filename);

    const photoPath = `/uploads/profiles/${req.file.filename}`;

    // Récupérer l'ancienne photo avant mise à jour
    const [old] = await pool.query(
      'SELECT photo FROM etudiant WHERE id = ?', 
      [etudiantId]
    );

    // Supprimer l'ancienne photo si elle existe
    if (old && old.length > 0 && old[0].photo && old[0].photo.startsWith('/uploads/')) {
      try {
        const oldPath = path.join(__dirname, '../../', old[0].photo);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          console.log('Ancienne photo supprimée:', oldPath);
        }
      } catch (deleteError) {
        console.warn('Erreur lors de la suppression de l\'ancienne photo:', deleteError);
        // Ne pas bloquer le processus si la suppression échoue
      }
    }

    // Mettre à jour la photo dans la base de données
    const [result] = await pool.query(
      'UPDATE etudiant SET photo = ? WHERE id = ?', 
      [photoPath, etudiantId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Étudiant non trouvé" 
      });
    }

    console.log('Photo mise à jour avec succès pour étudiant', etudiantId);
    
    res.json({ 
      success: true, 
      message: "Photo de profil mise à jour avec succès", 
      photo: photoPath 
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la photo:', error);
    
    // Si c'est une erreur multer
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: "Le fichier est trop volumineux (max 5MB)" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || "Erreur serveur lors de la mise à jour de la photo" 
    });
  }
});

// Mettre à jour les informations textuelles du profil (SÉCURISÉ)
router.put('/me', verifyToken, async (req, res) => {
  const etudiantId = req.user.id;
  const { nom, prenom, telephone, commune, quartier, nom_pere, nom_mere, id_filiere, id_niveau } = req.body;

  // Convertir les chaînes vides en null pour éviter les erreurs SQL (surtout pour les clés étrangères comme id_filiere)
  const safeStr = (val) => (val === '' || val === undefined) ? null : val;
  const safeInt = (val) => (val === '' || val === undefined || val === null) ? null : parseInt(val, 10);

  try {
    await pool.query(`
      UPDATE etudiant 
      SET nom = ?, prenom = ?, telephone = ?, commune = ?, quartier = ?, 
          nom_pere = ?, nom_mere = ?, id_filiere = ?, id_niveau = ?
      WHERE id = ?
    `, [
      safeStr(nom), 
      safeStr(prenom), 
      safeStr(telephone), 
      safeStr(commune), 
      safeStr(quartier), 
      safeStr(nom_pere), 
      safeStr(nom_mere), 
      safeInt(id_filiere), 
      safeInt(id_niveau), 
      etudiantId
    ]);

    res.json({ success: true, message: "Profil mis à jour" });
  } catch (error) {
    console.error('Erreur MAJ profil:', error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

module.exports = router;
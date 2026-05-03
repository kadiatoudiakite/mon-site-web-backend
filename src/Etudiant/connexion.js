const express = require('express');
// bcrypt supprimé selon demande client
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

const router = express.Router();

console.log('Etudiant routes loaded');

// Route de connexion pour les étudiants
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation des champs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    // Recherche de l'étudiant par email
    const [rows] = await pool.query(
      'SELECT id, matricule, nom, prenom, email, mot_de_passe, id_filiere, id_niveau FROM etudiant WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const etudiant = rows[0];

    // Vérification du mot de passe (Comparaison directe sans bcrypt)
    if (password !== etudiant.mot_de_passe) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Création du token JWT
    const token = jwt.sign(
      {
        id: etudiant.id,
        email: etudiant.email,
        type: 'etudiant'
      },
      process.env.JWT_SECRET || 'stagetrack_secret_key_2024',
      { expiresIn: '7d' }
    );

    // Retourner les données de l'étudiant sans le mot de passe
    const { mot_de_passe, ...etudiantData } = etudiant;

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        token,
        user: etudiantData
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Route pour vérifier le token (middleware pour les routes protégées)
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Récupérer les données à jour de l'étudiant
    const [rows] = await pool.query(
      'SELECT id, matricule, nom, prenom, email, id_filiere, id_niveau FROM etudiant WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        user: rows[0]
      }
    });

  } catch (error) {
    console.error('Erreur lors de la vérification du token:', error);
    res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
});

// Route pour récupérer les filières
router.get('/filieres', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT f.id, f.nom, f.departement_id, d.nom as departement_nom
      FROM filiere f
      JOIN departement d ON f.departement_id = d.id
      ORDER BY d.nom, f.nom
    `);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des filières:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Route pour récupérer les niveaux
router.get('/niveaux', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, libelle FROM niveau ORDER BY id');

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des niveaux:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Route d'inscription pour les étudiants
router.post('/register', async (req, res) => {
  try {
    const { matricule, nom, prenom, email, mot_de_passe, id_filiere, id_niveau, sexe } = req.body;

    // Validation des champs requis
    if (!matricule || !nom || !prenom || !email || !mot_de_passe || !id_filiere || !id_niveau || !sexe) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis (y compris le sexe)'
      });
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide'
      });
    }

    // Validation de la longueur du mot de passe
    if (mot_de_passe.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Vérifier si l'email existe déjà
    const [existingEmail] = await pool.query(
      'SELECT id FROM etudiant WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Vérifier si le matricule existe déjà
    const [existingMatricule] = await pool.query(
      'SELECT id FROM etudiant WHERE matricule = ?',
      [matricule]
    );

    if (existingMatricule.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Ce matricule est déjà utilisé'
      });
    }

    // Vérifier si la filière existe
    const [filiereExists] = await pool.query(
      'SELECT id FROM filiere WHERE id = ?',
      [id_filiere]
    );

    if (filiereExists.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Filière invalide'
      });
    }

    // Vérifier si le niveau existe
    const [niveauExists] = await pool.query(
      'SELECT id FROM niveau WHERE id = ?',
      [id_niveau]
    );

    if (niveauExists.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Niveau invalide'
      });
    }

    // Pas de hash (Demande client)
    const hashedPassword = mot_de_passe;

    // Insertion de l'étudiant
    const [result] = await pool.query(
      'INSERT INTO etudiant (matricule, nom, prenom, email, mot_de_passe, id_filiere, id_niveau, sexe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [matricule, nom, prenom, email, hashedPassword, id_filiere, id_niveau, sexe]
    );

    console.log('Étudiant inséré avec succès, ID:', result.insertId);

    res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      data: {
        id: result.insertId,
        matricule,
        nom,
        prenom,
        email,
        id_filiere,
        id_niveau
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);

    // Gestion des erreurs spécifiques MySQL
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Email ou matricule déjà utilisé'
      });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Filière ou niveau invalide'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

module.exports = router;
const express = require('express');
// bcrypt supprimé selon demande client
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const { sendVerificationCodeMail } = require('../../config/mailercreation_etudiant');

const router = express.Router();

console.log('Etudiant routes loaded');

// Initialisation de la table temporaire de vérification
pool.query(`
  CREATE TABLE IF NOT EXISTS \`etudiant_verification\` (
    \`email\` varchar(255) NOT NULL,
    \`code\` varchar(6) NOT NULL,
    \`data\` text NOT NULL,
    \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`email\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`).then(() => {
  console.log('✅ Table etudiant_verification opérationnelle');
}).catch(err => {
  console.error('❌ Erreur lors de la création de la table etudiant_verification:', err);
});

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'stagetrack_secret_key_2024');


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

// Demande d'inscription : validation et envoi du code par email
router.post('/register-request', async (req, res) => {
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

    // Vérifier si l'email existe déjà dans etudiant
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

    // Vérifier si le matricule existe déjà dans etudiant
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

    // Générer un code de vérification à 6 chiffres
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Enregistrer le code et les données d'inscription temporaires
    const registrationData = JSON.stringify({
      matricule,
      nom,
      prenom,
      email,
      mot_de_passe,
      id_filiere,
      id_niveau,
      sexe
    });

    // Insérer ou mettre à jour la demande de vérification
    await pool.query(
      `INSERT INTO etudiant_verification (email, code, data) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE code = ?, data = ?, created_at = CURRENT_TIMESTAMP`,
      [email, verificationCode, registrationData, verificationCode, registrationData]
    );

    // Envoyer le code de vérification par e-mail
    await sendVerificationCodeMail(email, verificationCode);

    res.json({
      success: true,
      message: 'Code de vérification envoyé sur votre adresse e-mail'
    });

  } catch (error) {
    console.error('Erreur demande inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la demande d\'inscription'
    });
  }
});

// Validation du code et finalisation de l'inscription
router.post('/register-verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email et code requis'
      });
    }

    // Récupérer la demande de vérification
    const [rows] = await pool.query(
      'SELECT code, data, created_at FROM etudiant_verification WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune demande d\'inscription trouvée pour cet e-mail'
      });
    }

    const { code: dbCode, data: serializedData, created_at: createdAt } = rows[0];

    // Vérifier si le code correspond
    if (dbCode !== code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Code de vérification incorrect'
      });
    }

    // Vérifier la validité du code (15 minutes)
    const isExpired = (Date.now() - new Date(createdAt).getTime()) > 15 * 60 * 1000;
    if (isExpired) {
      return res.status(410).json({
        success: false,
        message: 'Ce code a expiré (validité 15 minutes). Veuillez demander un nouveau code.'
      });
    }

    // Désérialiser les informations de l'étudiant
    const etudiant = JSON.parse(serializedData);

    // Procéder à l'insertion finale dans la table etudiant
    const [result] = await pool.query(
      'INSERT INTO etudiant (matricule, nom, prenom, email, mot_de_passe, id_filiere, id_niveau, sexe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        etudiant.matricule,
        etudiant.nom,
        etudiant.prenom,
        etudiant.email,
        etudiant.mot_de_passe,
        etudiant.id_filiere,
        etudiant.id_niveau,
        etudiant.sexe
      ]
    );

    // Supprimer la ligne de vérification temporaire
    await pool.query(
      'DELETE FROM etudiant_verification WHERE email = ?',
      [email]
    );

    console.log('Étudiant validé et inséré avec succès, ID:', result.insertId);

    res.status(201).json({
      success: true,
      message: 'Votre compte a été vérifié et créé avec succès !',
      data: {
        id: result.insertId,
        matricule: etudiant.matricule,
        nom: etudiant.nom,
        prenom: etudiant.prenom,
        email: etudiant.email
      }
    });

  } catch (error) {
    console.error('Erreur lors de la vérification de l\'inscription:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Le matricule ou l\'email a été utilisé par une autre session d\'inscription terminée.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la validation du code'
    });
  }
});

module.exports = router;
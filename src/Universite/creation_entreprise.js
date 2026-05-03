// src/Universite/entrepriseRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');

console.log('Entreprise routes loaded');

// Récupérer le pool depuis l'app
const getDbPool = (req) => req.app.get('dbPool');

// ====================== CRÉER UNE NOUVELLE ENTREPRISE ======================
router.post('/', verifyToken, async (req, res) => {
  const { nom, email, domaine_id } = req.body;
  const id_universite = req.user.id; // Récupération automatique de l'université connectée

  console.log('🏢 [ENTREPRISE] Création d\'une nouvelle entreprise');
  console.log('   Nom:', nom);
  console.log('   Email:', email);
  console.log('   Domaine ID:', domaine_id);
  console.log('   Université ID:', id_universite);

  // Validation
  if (!nom || !email || !domaine_id) {
    console.warn('⚠️ [ENTREPRISE] Champs manquants');
    return res.status(400).json({
      success: false,
      message: 'Les champs nom, email et domaine_id sont obligatoires'
    });
  }

  try {
    const pool = getDbPool(req);

    // Vérifier si l'email ou le nom existe déjà
    console.log('🔍 [ENTREPRISE] Vérification des doublons...');
    const [existing] = await pool.execute(
      'SELECT id FROM entreprise WHERE email = ? OR nom = ?',
      [email.toLowerCase(), nom]
    );

    if (existing.length > 0) {
      console.warn('⚠️ [ENTREPRISE] Entreprise déjà existante');
      return res.status(409).json({
        success: false,
        message: 'Une entreprise avec ce nom ou cet email existe déjà'
      });
    }

    // ====================== GÉNÉRATION AUTOMATIQUE DU MOT DE PASSE ======================
    const generatePassword = (length = 12) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let password = '';
      for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const plainPassword = generatePassword(12);
    console.log('🔑 [ENTREPRISE] Mot de passe généré automatiquement :', plainPassword);

    // ====================== INSERTION EN BASE ======================
    console.log('💾 [ENTREPRISE] Insertion en base de données...');
    
    const [result] = await pool.execute(
      `INSERT INTO entreprise (nom, email, mot_de_passe, domaine_id, id_universite)
       VALUES (?, ?, ?, ?, ?)`,
      [nom, email.toLowerCase(), plainPassword, domaine_id, id_universite]
    );

    console.log('✅ [ENTREPRISE] Entreprise créée avec succès - ID:', result.insertId);

    // Réponse avec le mot de passe en clair
    res.status(201).json({
      success: true,
      message: 'Entreprise créée avec succès',
      entreprise: {
        id: result.insertId,
        nom,
        email: email.toLowerCase(),
        mot_de_passe: plainPassword,     // Mot de passe visible
        domaine_id: parseInt(domaine_id),
        id_universite: id_universite     // ID université enregistré
      }
    });

  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur création entreprise:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création de l\'entreprise'
    });
  }
});

// ====================== RÉCUPÉRER TOUTES LES ENTREPRISES ======================
router.get('/', async (req, res) => {
  console.log('📋 [ENTREPRISE] Récupération de toutes les entreprises');

  try {
    const pool = getDbPool(req);
    const [entreprises] = await pool.execute(`
      SELECT
        e.id,
        e.nom,
        e.sigle,
        e.logo,
        e.commune,
        e.quartier,
        e.telephone,
        e.email,
        e.description,
        e.domaine_id,
        e.id_universite,
        d.nom as domaine_nom,
        (SELECT COUNT(*) FROM offre_stage WHERE id_entreprise = e.id) as nb_publications,
        e.created_at
      FROM entreprise e
      LEFT JOIN domaine d ON e.domaine_id = d.id
      ORDER BY e.created_at DESC
    `);

    console.log('✅ [ENTREPRISE] Récupérées:', entreprises.length, 'entreprises');
    res.status(200).json({
      success: true,
      data: entreprises
    });
  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur récupération entreprises:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des entreprises'
    });
  }
});

// ====================== RÉCUPÉRER LES DOMAINES ======================
router.get('/domaines/all', async (req, res) => {
  console.log('📂 [ENTREPRISE] Récupération des domaines');

  try {
    const pool = getDbPool(req);
    const [domaines] = await pool.execute('SELECT * FROM domaine ORDER BY nom');

    console.log('✅ [ENTREPRISE] Domaines récupérés:', domaines.length);
    res.status(200).json({
      success: true,
      data: domaines
    });
  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur récupération domaines:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des domaines'
    });
  }
});

// ====================== RÉCUPÉRER UNE ENTREPRISE PAR ID ======================
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  console.log('🔍 [ENTREPRISE] Récupération entreprise ID:', id);

  try {
    const pool = getDbPool(req);
    const [rows] = await pool.execute(`
      SELECT
        e.id,
        e.nom,
        e.sigle,
        e.logo,
        e.commune,
        e.quartier,
        e.telephone,
        e.email,
        e.description,
        e.domaine_id,
        e.id_universite,
        d.nom as domaine_nom,
        e.created_at
      FROM entreprise e
      LEFT JOIN domaine d ON e.domaine_id = d.id
      WHERE e.id = ?
    `, [id]);

    if (rows.length === 0) {
      console.warn('⚠️ [ENTREPRISE] Entreprise non trouvée - ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Entreprise non trouvée'
      });
    }

    console.log('✅ [ENTREPRISE] Entreprise trouvée:', rows[0].nom);
    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur récupération entreprise:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// ====================== METTRE À JOUR UNE ENTREPRISE ======================
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    nom, sigle, logo, commune, quartier, telephone,
    email, description, domaine_id, id_universite
  } = req.body;

  console.log('✏️ [ENTREPRISE] Mise à jour entreprise ID:', id);

  try {
    const pool = getDbPool(req);

    const [existing] = await pool.execute('SELECT id FROM entreprise WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Entreprise non trouvée'
      });
    }

    await pool.execute(`
      UPDATE entreprise SET
        nom = ?, sigle = ?, logo = ?, commune = ?, quartier = ?,
        telephone = ?, email = ?, description = ?, domaine_id = ?, id_universite = ?
      WHERE id = ?
    `, [nom, sigle, logo, commune, quartier, telephone, email, description, domaine_id, id_universite, id]);

    console.log('✅ [ENTREPRISE] Entreprise mise à jour - ID:', id);
    res.status(200).json({
      success: true,
      message: 'Entreprise mise à jour avec succès'
    });

  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur mise à jour entreprise:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour'
    });
  }
});

// ====================== SUPPRIMER UNE ENTREPRISE ======================
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  console.log('🗑️ [ENTREPRISE] Suppression entreprise ID:', id);

  try {
    const pool = getDbPool(req);

    const [result] = await pool.execute('DELETE FROM entreprise WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Entreprise non trouvée'
      });
    }

    console.log('✅ [ENTREPRISE] Entreprise supprimée - ID:', id);
    res.status(200).json({
      success: true,
      message: 'Entreprise supprimée avec succès'
    });

  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur suppression entreprise:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression'
    });
  }
});

// ====================== RÉCUPÉRER LES OFFRES D'UNE ENTREPRISE ======================
router.get('/:id/offres', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getDbPool(req);
    const [offres] = await pool.execute(`
      SELECT o.*, d.nom as domaine_nom 
      FROM offre_stage o
      LEFT JOIN domaine d ON o.id_domaine = d.id
      WHERE o.id_entreprise = ?
      ORDER BY o.created_at DESC
    `, [id]);
    
    res.status(200).json({ success: true, data: offres });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

console.log('Router exported');

module.exports = router;
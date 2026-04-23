// src/Universite/universiteRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Récupérer le pool depuis l'app
const getDbPool = (req) => req.app.get('dbPool');

// ====================== RÉCUPÉRER TOUS LES DOMAINES ======================
router.get('/domaines', async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [domaines] = await pool.execute('SELECT id, nom FROM domaine ORDER BY nom ASC');
    
    console.log(`✅ [DOMAINES] ${domaines.length} domaines récupérés`);
    res.status(200).json(domaines);
  } catch (error) {
    console.error('❌ [DOMAINES] Erreur lors de la récupération des domaines:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des domaines'
    });
  }
});

// ====================== CONNEXION UNIVERSITÉ ======================
router.post('/login', async (req, res) => {
  const { email, motDePasse } = req.body;

  console.log('📝 [LOGIN] Tentative de connexion université');
  console.log('   Email:', email);

  if (!email || !motDePasse) {
    console.warn('⚠️ [LOGIN] Paramètres manquants - Email ou mot de passe vide');
    return res.status(400).json({
      success: false,
      message: 'Email et mot de passe sont obligatoires'
    });
  }

  try {
    const pool = getDbPool(req);

    console.log('🔍 [LOGIN] Recherche utilisateur dans la base de données...');
    const [rows] = await pool.execute(
      'SELECT id, nom, prenom, email, mot_de_passe FROM universite WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      console.warn('❌ [LOGIN] Utilisateur non trouvé pour l\'email:', email);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const user = rows[0];
    console.log('✅ [LOGIN] Utilisateur trouvé:', user.nom, user.prenom);

    // === VÉRIFICATION SIMPLE DU MOT DE PASSE (SANS BCRYPT) ===
    if (motDePasse !== user.mot_de_passe) {
      console.warn('❌ [LOGIN] Mot de passe incorrect pour:', email);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const userData = {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email
    };

    // Génération du token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'votre_secret_jwt_ici',
      { expiresIn: '24h' }
    );

    console.log('🎉 [LOGIN] Connexion réussie -', userData.nom, userData.prenom, `(ID: ${userData.id})`);
    res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      user: userData,
      token: token
    });

  } catch (error) {
    console.error('💥 [LOGIN] Erreur de connexion université:', error.message);
    console.error('   Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur. Veuillez réessayer plus tard.'
    });
  }
});

// ====================== RÉCUPÉRER STATISTIQUES DASHBOARD ======================
router.get('/dashboard/stats/:universiteId', async (req, res) => {
  const { universiteId } = req.params;

  console.log('📊 [DASHBOARD STATS] Requête pour les statistiques - Université ID:', universiteId);

  try {
    const pool = getDbPool(req);

    console.log('🔍 [DASHBOARD STATS] Récupération des données...');
    
    let stats = {
      stagiaires: 0,
      offres: 0,
      placements: 0
    };

    try {
      const [etudiants] = await pool.execute(
        'SELECT COUNT(*) as count FROM etudiants WHERE universite_id = ?',
        [universiteId]
      );
      stats.stagiaires = etudiants[0].count;
    } catch {
      console.warn('⚠️ [DASHBOARD STATS] Table etudiants non trouvée, valeur par défaut: 0');
    }

    try {
      const [offres] = await pool.execute(
        'SELECT COUNT(*) as count FROM offres_stage WHERE universite_id = ?',
        [universiteId]
      );
      stats.offres = offres[0].count;
    } catch {
      console.warn('⚠️ [DASHBOARD STATS] Table offres_stage non trouvée, valeur par défaut: 0');
    }

    try {
      const [placements] = await pool.execute(
        'SELECT COUNT(*) as count FROM stages WHERE universite_id = ? AND statut = ?',
        [universiteId, 'accepté']
      );
      stats.placements = placements[0].count;
    } catch {
      console.warn('⚠️ [DASHBOARD STATS] Table stages non trouvée, valeur par défaut: 0');
    }

    console.log('✅ [DASHBOARD STATS] Données récupérées avec succès:', stats);
    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('💥 [DASHBOARD STATS] Erreur critique:', error.message);
    res.status(200).json({
      success: true,
      data: {
        stagiaires: 0,
        offres: 0,
        placements: 0
      }
    });
  }
});

module.exports = router;
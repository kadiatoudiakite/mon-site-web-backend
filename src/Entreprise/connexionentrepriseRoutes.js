
// src/Entreprise/connexionentrepriseRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

console.log('Entreprise routes loaded');

// Récupérer le pool depuis l'app
const getDbPool = (req) => req.app.get('dbPool');

// ====================== CONNEXION ENTREPRISE ======================
router.post('/login', async (req, res) => {
  const { email, motDePasse } = req.body;

  console.log('📝 [LOGIN ENTREPRISE] Tentative de connexion entreprise');
  console.log('   Email:', email);

  if (!email || !motDePasse) {
    console.warn('⚠️ [LOGIN ENTREPRISE] Paramètres manquants - Email ou mot de passe vide');
    return res.status(400).json({
      success: false,
      message: 'Email et mot de passe sont obligatoires'
    });
  }

  try {
    const pool = getDbPool(req);

    console.log('🔍 [LOGIN ENTREPRISE] Recherche entreprise dans la base de données...');
    const [rows] = await pool.execute(
      'SELECT id, nom, email, mot_de_passe, domaine_id FROM entreprise WHERE email = ?',
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      console.warn('❌ [LOGIN ENTREPRISE] Entreprise non trouvée pour l\'email:', email);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const entreprise = rows[0];
    console.log('✅ [LOGIN ENTREPRISE] Entreprise trouvée:', entreprise.nom);

    // Vérification du mot de passe en texte clair
    if (entreprise.mot_de_passe !== motDePasse) {
      console.warn('❌ [LOGIN ENTREPRISE] Mot de passe incorrect pour:', email);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const entrepriseData = {
      id: entreprise.id,
      nom: entreprise.nom,
      email: entreprise.email,
      domaine_id: entreprise.domaine_id
    };

    // Génération du token JWT
    const token = jwt.sign(
      { id: entreprise.id, email: entreprise.email, role: 'entreprise' },
      process.env.JWT_SECRET || 'stagetrack_secret_key_2024',
      { expiresIn: '24h' }
    );

    console.log('🎉 [LOGIN ENTREPRISE] Connexion réussie -', entrepriseData.nom, `(ID: ${entrepriseData.id})`);
    res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      entreprise: entrepriseData,
      token: token
    });

  } catch (error) {
    console.error('💥 [LOGIN ENTREPRISE] Erreur de connexion entreprise:', error.message);
    console.error('   Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur. Veuillez réessayer plus tard.'
    });
  }
});

// Test route
router.get('/test', (req, res) => {
  console.log('Test route called');
  res.json({ message: 'Test route works' });
});

module.exports = router;

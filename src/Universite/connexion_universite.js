const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middlewares/auth');
const router = express.Router();

console.log('Universite routes loaded');

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
// Exemple de login
router.post('/login', async (req, res) => {
  const { email, motDePasse } = req.body;
  const password = motDePasse; // Pour garder la suite du code compatible
  const pool = req.app.get('dbPool');
  const [rows] = await pool.execute('SELECT * FROM universite WHERE email = ?', [email]);
  if (rows.length === 0) return res.status(401).json({ success: false, message: 'Identifiants invalides' });

  const user = rows[0];
  const valid = (password === user.mot_de_passe); // Comparaison directe sans bcrypt
  if (!valid) return res.status(401).json({ success: false, message: 'Identifiants invalides' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'stagetrack_secret_key_2024',
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role
    }
  });
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
        'SELECT COUNT(*) as count FROM etudiant WHERE id_universite = ?',
        [universiteId]
      );
      stats.stagiaires = etudiants[0].count;
    } catch (err) {
      console.warn('⚠️ [DASHBOARD STATS] Erreur etudiant:', err.message);
    }

    try {
      const [offres] = await pool.execute(
        'SELECT COUNT(*) as count FROM offre_stage WHERE id_universite = ?',
        [universiteId]
      );
      stats.offres = offres[0].count;
    } catch (err) {
      console.warn('⚠️ [DASHBOARD STATS] Erreur offre_stage:', err.message);
    }

    try {
      const [placements] = await pool.execute(
        'SELECT COUNT(*) as count FROM candidature c JOIN offre_stage o ON c.id_offre_stage = o.id WHERE o.id_universite = ? AND c.statut = ?',
        [universiteId, 'Acceptée']
      );
      stats.placements = placements[0].count;
    } catch (err) {
      console.warn('⚠️ [DASHBOARD STATS] Erreur candidatures:', err.message);
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

// ====================== RÉCUPÉRER LE PROFIL ======================
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [rows] = await pool.execute(
      'SELECT id, nom, prenom, email, telephone, role FROM universite WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Profil non trouvé' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ====================== METTRE À JOUR LE PROFIL ======================
router.put('/profile', verifyToken, async (req, res) => {
  const { nom, prenom, email, telephone } = req.body;
  try {
    const pool = getDbPool(req);
    await pool.execute(
      'UPDATE universite SET nom = ?, prenom = ?, email = ?, telephone = ? WHERE id = ?',
      [nom, prenom, email, telephone, req.user.id]
    );
    res.json({ success: true, message: 'Profil mis à jour' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ====================== CHANGER LE MOT DE PASSE ======================
router.post('/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const pool = getDbPool(req);
    const [rows] = await pool.execute('SELECT mot_de_passe FROM universite WHERE id = ?', [req.user.id]);
    
    if (rows[0].mot_de_passe !== currentPassword) {
      return res.status(400).json({ success: false, message: 'Ancien mot de passe incorrect' });
    }

    await pool.execute('UPDATE universite SET mot_de_passe = ? WHERE id = ?', [newPassword, req.user.id]);
    res.json({ success: true, message: 'Mot de passe modifié' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
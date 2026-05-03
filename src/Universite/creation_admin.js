const express = require('express');
const { verifyToken, requireSuperAdmin } = require('../middlewares/auth');
const router = express.Router();

const getDbPool = (req) => req.app.get('dbPool');

// ====================== RÉCUPÉRER TOUS LES ADMINS ======================
router.get('/', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [rows] = await pool.execute(
      'SELECT id, nom, prenom, email, telephone, role, created_at FROM universite ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('❌ [ADMIN] Erreur récupération admins:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération' });
  }
});

// ====================== CRÉER UN NOUVEL ADMIN ======================
router.post('/', verifyToken, requireSuperAdmin, async (req, res) => {
  const { nom, prenom, email, telephone, role } = req.body;

  if (!nom || !prenom || !email) {
    return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
  }

  try {
    const pool = getDbPool(req);

    // Vérifier si l'email existe déjà
    const [existing] = await pool.execute('SELECT id FROM universite WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });
    }

    // Génération d'un mot de passe temporaire simple
    const plainPassword = Math.random().toString(36).slice(-8);

    const [result] = await pool.execute(
      `INSERT INTO universite (nom, prenom, telephone, email, mot_de_passe, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nom, prenom, telephone || null, email, plainPassword, role || 'university_admin']
    );

    res.status(201).json({
      success: true,
      message: 'Administrateur créé avec succès',
      data: {
        id: result.insertId,
        nom,
        prenom,
        email,
        mot_de_passe_temporaire: plainPassword
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Erreur création admin:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la création' });
  }
});

// ====================== SUPPRIMER UN ADMIN ======================
router.delete('/:id', verifyToken, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;

  // Empêcher de se supprimer soi-même
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
  }

  try {
    const pool = getDbPool(req);
    
    // Vérifier si c'est le dernier super admin (sécurité optionnelle)
    const [superAdmins] = await pool.execute('SELECT id FROM universite WHERE role = "super_admin"');
    const [target] = await pool.execute('SELECT role FROM universite WHERE id = ?', [id]);
    
    if (target.length > 0 && target[0].role === 'super_admin' && superAdmins.length <= 1) {
      return res.status(400).json({ success: false, message: 'Impossible de supprimer le dernier Super Administrateur' });
    }

    const [result] = await pool.execute('DELETE FROM universite WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Administrateur non trouvé' });
    }

    res.json({ success: true, message: 'Administrateur supprimé avec succès' });
  } catch (error) {
    console.error('❌ [ADMIN] Erreur suppression admin:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la suppression' });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { verifyToken } = require('../middlewares/auth');

// ==================== COMPTER LES NOTIFICATIONS NON LUES ====================
router.get('/unread-count', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const field = userRole === 'universite' ? 'id_universite' : 'id_entreprise';
        const createdByField = userRole === 'universite' ? 'universite' : 'entreprise';
        const [rows] = await pool.query(
            `SELECT COUNT(*) as count FROM notification WHERE ${field} = ? AND statut = 'non_lu' AND (created_by IS NULL OR created_by != ?)`,
            [userId, createdByField]
        );
        res.json({ success: true, count: rows[0].count });
    } catch (error) {
        console.error('💥 Erreur unread-count notifications:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== RÉCUPÉRER TOUTES LES NOTIFICATIONS ====================
router.get('/', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    const field = userRole === 'universite' ? 'n.id_universite' : 'n.id_entreprise';
    const createdByField = userRole === 'universite' ? 'universite' : 'entreprise';
    try {
        const [rows] = await pool.query(
            `SELECT n.*, u.nom AS universite_nom, e.nom AS entreprise_nom,
                    CONCAT(et.nom, ' ', et.prenom) AS etudiant_nom
             FROM notification n
             LEFT JOIN universite u ON n.id_universite = u.id
             LEFT JOIN entreprise e ON n.id_entreprise = e.id
             LEFT JOIN etudiant et ON n.id_etudiant = et.id
             WHERE ${field} = ? AND (n.created_by IS NULL OR n.created_by != ?)
             ORDER BY n.created_at DESC`,
            [userId, createdByField]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('💥 Erreur récupération notifications:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== MARQUER COMME LU ====================
router.put('/marquer-lu/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const field = userRole === 'universite' ? 'id_universite' : 'id_entreprise';
        const [check] = await pool.query(
            `SELECT id FROM notification WHERE id = ? AND ${field} = ?`,
            [id, userId]
        );
        if (check.length === 0) {
            return res.status(403).json({ success: false, message: 'Non autorisé' });
        }

        await pool.query('UPDATE notification SET statut = "lu" WHERE id = ?', [id]);
        res.json({ success: true, message: 'Notification marquée comme lue' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== SUPPRIMER UNE NOTIFICATION ====================
router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const field = userRole === 'universite' ? 'id_universite' : 'id_entreprise';
        const [check] = await pool.query(
            `SELECT id FROM notification WHERE id = ? AND ${field} = ?`,
            [id, userId]
        );
        if (check.length === 0) {
            return res.status(403).json({ success: false, message: 'Non autorisé' });
        }

        await pool.query('DELETE FROM notification WHERE id = ?', [id]);
        res.json({ success: true, message: 'Notification supprimée' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== MARQUER TOUTES COMME LUES ====================
router.put('/marquer-tout-lu', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const field = userRole === 'universite' ? 'id_universite' : 'id_entreprise';
        await pool.query(
            `UPDATE notification SET statut = 'lu' WHERE ${field} = ? AND statut = 'non_lu'`,
            [userId]
        );
        res.json({ success: true, message: 'Toutes les notifications ont été marquées comme lues' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== FONCTION UTILITAIRE POUR CRÉER UNE NOTIFICATION ====================
// Types supportés: candidature, partenariat, offre, message, alerte, info
// created_by: type de l'utilisateur qui a créé la notification (entreprise, universite, etudiant, systeme)
const createNotification = async ({ id_universite, id_entreprise, id_etudiant, titre, message, type, created_by }) => {
    try {
        await pool.query(
            'INSERT INTO notification (id_universite, id_entreprise, id_etudiant, titre, message, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id_universite || null, id_entreprise || null, id_etudiant || null, titre, message, type || 'info', created_by || 'systeme']
        );
        return true;
    } catch (error) {
        console.error('💥 Erreur création notification:', error.message);
        return false;
    }
};

// Attache createNotification au router ET comme propriété nommée sur l'export
// Les deux formes fonctionnent :
//   const notifModule = require('./notificationentreprise');
//   notifModule.createNotification(...)          ← via router property
//   const { createNotification } = require(...) ← via named export
router.createNotification = createNotification;
module.exports = router;
module.exports.createNotification = createNotification;

const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { verifyToken } = require('../middlewares/auth');

// ==================== COMPTER LES NOTIFICATIONS NON LUES ====================
router.get('/unread-count', verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const [rows] = await pool.query(
            `SELECT COUNT(*) as count FROM notification 
             WHERE (id_etudiant = ? OR target = 'all_students') AND statut = 'non_lu'
             AND (created_by IS NULL OR created_by != 'etudiant')
             AND (created_by_type IS NULL OR created_by_type != 'etudiant')
             AND (target IS NULL OR target NOT IN ('entreprise', 'universite', 'all_companies', 'all_universities'))`,
            [userId]
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
    try {
        const [rows] = await pool.query(
            `SELECT n.id, n.id_etudiant, n.id_entreprise, n.id_universite,
                    n.titre, n.message, n.type, n.statut, n.created_at,
                    e.nom AS entreprise_nom, u.nom AS universite_nom
             FROM notification n
             LEFT JOIN entreprise e ON n.id_entreprise = e.id
             LEFT JOIN universite u ON n.id_universite = u.id
             WHERE (n.id_etudiant = ? OR n.target = 'all_students')
             AND (n.created_by IS NULL OR n.created_by != 'etudiant')
             AND (n.created_by_type IS NULL OR n.created_by_type != 'etudiant')
             AND (n.target IS NULL OR n.target NOT IN ('entreprise', 'universite', 'all_companies', 'all_universities'))
             ORDER BY n.created_at DESC`,
            [userId]
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
    try {
        const [check] = await pool.query(
            `SELECT id FROM notification WHERE id = ? AND id_etudiant = ?`,
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

// ==================== MARQUER TOUT COMME LU ====================
router.put('/marquer-tout-lu', verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(
            `UPDATE notification SET statut = 'lu' 
             WHERE id_etudiant = ? AND statut = 'non_lu'
             AND (created_by IS NULL OR created_by != 'etudiant')
             AND (created_by_type IS NULL OR created_by_type != 'etudiant')
             AND (target IS NULL OR target NOT IN ('entreprise', 'universite', 'all_companies', 'all_universities'))`,
            [userId]
        );
        res.json({ success: true, message: 'Toutes les notifications ont été marquées comme lues' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== SUPPRIMER UNE NOTIFICATION ====================
router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const [check] = await pool.query(
            `SELECT id FROM notification WHERE id = ? AND id_etudiant = ?`,
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

module.exports = router;

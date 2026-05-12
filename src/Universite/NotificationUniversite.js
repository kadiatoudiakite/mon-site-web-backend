const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { verifyToken } = require('../middlewares/auth');

// ==================== COMPTER LES NOTIFICATIONS NON LUES ====================
router.get('/unread-count', verifyToken, async (req, res) => {
    const universiteId = req.user.id;
    try {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM notification WHERE id_universite = ? AND statut = "non_lu"',
            [universiteId]
        );
        res.json({ success: true, count: rows[0].count });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== RÉCUPÉRER LES NOTIFICATIONS DE L'UNIVERSITÉ ====================
router.get('/', verifyToken, async (req, res) => {
    const universiteId = req.user.id;
    try {
        const [rows] = await pool.query(
            'SELECT * FROM notification WHERE id_universite = ? ORDER BY created_at DESC',
            [universiteId]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('💥 Erreur notifications université:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== MARQUER COMME LU ====================
router.put('/marquer-lu/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const universiteId = req.user.id;
    try {
        const [result] = await pool.query(
            'UPDATE notification SET statut = "lu" WHERE id = ? AND id_universite = ?',
            [id, universiteId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Notification non trouvée' });
        }
        
        res.json({ success: true, message: 'Marquée comme lue' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== SUPPRIMER UNE NOTIFICATION ====================
router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const universiteId = req.user.id;
    try {
        const [result] = await pool.query(
            'DELETE FROM notification WHERE id = ? AND id_universite = ?',
            [id, universiteId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Notification non trouvée' });
        }
        
        res.json({ success: true, message: 'Supprimée' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;

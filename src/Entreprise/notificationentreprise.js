const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { verifyToken } = require('../middlewares/auth');

// ==================== RÉCUPÉRER TOUTES LES NOTIFICATIONS ====================
router.get('/', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role; // 'universite' ou 'entreprise'

    let query = 'SELECT * FROM notification WHERE ';
    let params = [];

    if (userRole === 'universite') {
        query += 'id_universite = ? ';
        params.push(userId);
    } else {
        query += 'id_entreprise = ? ';
        params.push(userId);
    }

    query += 'ORDER BY created_at DESC';

    try {
        const [rows] = await pool.query(query, params);
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
        let checkQuery = 'SELECT id FROM notification WHERE id = ? AND ';
        if (userRole === 'universite') {
            checkQuery += 'id_universite = ?';
        } else {
            checkQuery += 'id_entreprise = ?';
        }

        const [check] = await pool.query(checkQuery, [id, userId]);
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
        let checkQuery = 'SELECT id FROM notification WHERE id = ? AND ';
        if (userRole === 'universite') {
            checkQuery += 'id_universite = ?';
        } else {
            checkQuery += 'id_entreprise = ?';
        }

        const [check] = await pool.query(checkQuery, [id, userId]);
        if (check.length === 0) {
            return res.status(403).json({ success: false, message: 'Non autorisé' });
        }

        await pool.query('DELETE FROM notification WHERE id = ?', [id]);
        res.json({ success: true, message: 'Notification supprimée' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== FONCTION UTILITAIRE POUR CRÉER UNE NOTIFICATION ====================
// Cette fonction peut être importée dans d'autres fichiers (ex: lors d'une nouvelle candidature)
const createNotification = async ({ id_universite, id_entreprise, titre, message, type }) => {
    try {
        await pool.query(
            'INSERT INTO notification (id_universite, id_entreprise, titre, message, type) VALUES (?, ?, ?, ?, ?)',
            [id_universite || null, id_entreprise || null, titre, message, type || 'info']
        );
        return true;
    } catch (error) {
        console.error('💥 Erreur création notification:', error.message);
        return false;
    }
};

router.createNotification = createNotification;

module.exports = router;

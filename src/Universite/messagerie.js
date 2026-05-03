const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

// Middleware d'authentification JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'stagetrack_secret_key_2024', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// Storage configuration for multer (uploads folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

// GET /api/messagerie/conversations - list conversations for logged-in user
router.get('/conversations', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  let query = '';
  let params = [];

  const isUniversity = (userRole === 'university_admin' || userRole === 'super_admin');

  if (isUniversity) {
    // Si c'est une université, on cherche les conversations liées à son ID
    query = `
      SELECT c.id, c.id_entreprise, c.id_universite, e.nom AS counterpart_name, e.logo AS counterpart_logo,
             (SELECT contenu FROM message WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS lastMessage,
             (SELECT created_at FROM message WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS lastMessageAt,
             (SELECT COUNT(*) FROM message WHERE conversation_id = c.id AND expediteur_type = 'ENTREPRISE' AND est_lu = 0) AS unread
      FROM conversation c
      JOIN entreprise e ON c.id_entreprise = e.id
      WHERE c.id_universite = ?
      ORDER BY lastMessageAt DESC`;
    params = [userId];
  } else {
    // Si c'est une entreprise
    query = `
      SELECT c.id, c.id_entreprise, c.id_universite, u.nom AS counterpart_name,
             (SELECT contenu FROM message WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS lastMessage,
             (SELECT created_at FROM message WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS lastMessageAt,
             (SELECT COUNT(*) FROM message WHERE conversation_id = c.id AND expediteur_type = 'UNIVERSITE' AND est_lu = 0) AS unread
      FROM conversation c
      JOIN universite u ON c.id_universite = u.id
      WHERE c.id_entreprise = ?
      ORDER BY lastMessageAt DESC`;
    params = [userId];
  }

  try {
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Erreur fetch conversations', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/messagerie/:convId/messages - fetch messages for a conversation
router.get('/:convId/messages', authenticateToken, async (req, res) => {
  const { convId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT id, conversation_id, expediteur_type, contenu, fichier, est_lu, created_at
       FROM message
       WHERE conversation_id = ?
       ORDER BY created_at ASC`, [convId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur fetch messages', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/messagerie/message - create new text message
router.post('/message', authenticateToken, async (req, res) => {
  const { conversation_id, expediteur_type, contenu } = req.body;
  if (!conversation_id || !expediteur_type || !contenu) {
    return res.status(400).json({ success: false, message: 'Données manquantes' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO message (conversation_id, expediteur_type, contenu, fichier, est_lu)
       VALUES (?, ?, ?, NULL, 0)`, [conversation_id, expediteur_type, contenu]
    );
    const [msgRows] = await pool.query('SELECT * FROM message WHERE id = ?', [result.insertId]);
    res.status(201).json(msgRows[0]);
  } catch (err) {
    console.error('Erreur création message', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/messagerie/upload - upload file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  const { conversation_id, expediteur_type } = req.body;
  if (!req.file || !conversation_id || !expediteur_type) {
    return res.status(400).json({ success: false, message: 'Fichier ou données manquantes' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  try {
    const [result] = await pool.query(
      `INSERT INTO message (conversation_id, expediteur_type, contenu, fichier, est_lu)
       VALUES (?, ?, '', ?, 0)`, [conversation_id, expediteur_type, fileUrl]
    );
    const [msgRows] = await pool.query('SELECT * FROM message WHERE id = ?', [result.insertId]);
    res.status(201).json(msgRows[0]);
  } catch (err) {
    console.error('Erreur upload message', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/messagerie/read - mark messages as read
router.post('/read', authenticateToken, async (req, res) => {
  const { conversation_id } = req.body;
  const userRole = req.user.role;
  const isUniversity = (userRole === 'university_admin' || userRole === 'super_admin');
  const counterpartType = isUniversity ? 'ENTREPRISE' : 'UNIVERSITE';

  if (!conversation_id) return res.status(400).json({ success: false, message: 'ID de conversation manquant' });
  try {
    await pool.query(
      `UPDATE message SET est_lu = 1 WHERE conversation_id = ? AND expediteur_type = ?`, [conversation_id, counterpartType]
    );
    res.json({ success: true, message: 'Messages marqués comme lus' });
  } catch (err) {
    console.error('Erreur marquage lecture', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/messagerie/contacts - list all potential contacts
router.get('/contacts', authenticateToken, async (req, res) => {
  const userRole = req.user.role;
  const isUniversity = (userRole === 'university_admin' || userRole === 'super_admin');
  
  let query = '';
  if (isUniversity) {
    query = 'SELECT id, nom AS name, logo FROM entreprise ORDER BY nom ASC';
  } else {
    // Utilisation de CONCAT_WS pour éviter les noms NULL
    query = "SELECT id, CONCAT_WS(' ', nom, prenom) AS name FROM universite ORDER BY nom ASC";
  }

  try {
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Erreur fetch contacts', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/messagerie/conversation/get-or-create - ensure a conversation exists
router.post('/conversation/get-or-create', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { counterpartId } = req.body;

  if (!counterpartId) return res.status(400).json({ success: false, message: 'ID du destinataire manquant' });

  const isUniversity = (userRole === 'university_admin' || userRole === 'super_admin');
  
  let id_entreprise, id_universite;
  if (isUniversity) {
    id_universite = userId;
    id_entreprise = counterpartId;
  } else {
    id_entreprise = userId;
    id_universite = counterpartId;
  }

  try {
    // Vérifier si la conversation existe déjà
    const [rows] = await pool.query(
      'SELECT id FROM conversation WHERE id_entreprise = ? AND id_universite = ?',
      [id_entreprise, id_universite]
    );

    if (rows.length > 0) {
      return res.json({ id: rows[0].id });
    }

    // Créer une nouvelle conversation
    const [result] = await pool.query(
      'INSERT INTO conversation (id_entreprise, id_universite) VALUES (?, ?)',
      [id_entreprise, id_universite]
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Erreur get-or-create conversation', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});



// GET /api/messagerie/unread-count - get total unread messages count
router.get('/unread-count', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const isUniversity = (userRole === 'university_admin' || userRole === 'super_admin');
  const counterpartType = isUniversity ? 'ENTREPRISE' : 'UNIVERSITE';

  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM message m
       JOIN conversation c ON m.conversation_id = c.id
       WHERE m.est_lu = 0 
       AND m.expediteur_type = ?
       AND (c.id_universite = ? OR c.id_entreprise = ?)`,
      [counterpartType, userId, userId]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error('Erreur fetch unread count', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;


const pool = require('../../config/db');

async function createNotification({
  target = 'system',
  id_universite = null,
  id_entreprise = null,
  id_etudiant = null,
  titre,
  message,
  type = 'info',
  created_by_type = 'system',
  created_by_id = null
}) {
  if (!titre || !message) throw new Error('titre et message requis');

  const sql = `
    INSERT INTO notification
      (id_universite, id_entreprise, id_etudiant, target, titre, message, type, statut, created_by_type, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'non_lu', ?, ?)
  `;
  const params = [
    id_universite || null,
    id_entreprise || null,
    id_etudiant || null,
    target,
    titre,
    message,
    type || 'info',
    created_by_type || 'system',
    created_by_id || null
  ];

  await pool.query(sql, params);
  return true;
}

module.exports = { createNotification };

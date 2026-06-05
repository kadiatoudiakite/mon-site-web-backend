// Script de correction des chemins photo dans la table etudiant
const pool = require('../config/db');

async function fixPhotos() {
  // 1. Remplace les antislashs par des slashs
  await pool.query("UPDATE etudiant SET photo = REPLACE(photo, '\\\\', '/') WHERE photo LIKE '%\\\\%'");
  // 2. Enlève le slash ou antislash de début si présent
  await pool.query("UPDATE etudiant SET photo = SUBSTRING(photo, 2) WHERE LEFT(photo, 1) = '/' OR LEFT(photo, 1) = '\\\\'");
  // 3. Ajoute le préfixe 'uploads/profiles/' si le champ ne le contient pas déjà
  const [rows] = await pool.query("SELECT id, photo FROM etudiant WHERE photo IS NOT NULL AND photo <> ''");
  for (const etu of rows) {
    if (!etu.photo.startsWith('uploads/profiles/')) {
      let newPhoto = etu.photo;
      if (newPhoto.startsWith('profiles/')) newPhoto = 'uploads/' + newPhoto;
      else if (!newPhoto.startsWith('uploads/')) newPhoto = 'uploads/profiles/' + newPhoto;
      await pool.query('UPDATE etudiant SET photo = ? WHERE id = ?', [newPhoto, etu.id]);
    }
  }
  console.log('Correction terminée.');
  process.exit(0);
}

fixPhotos().catch(e => { console.error(e); process.exit(1); });

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'stagetrack_secret_key_2024';

module.exports = { JWT_SECRET };

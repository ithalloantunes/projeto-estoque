#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

import { sanitizeText } from '../lib/utils.js';
import { seedUsersFromFile as importUsersFromSeed } from '../lib/user-seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const usersFile = path.join(projectRoot, 'data', 'users.json');

const connectionString = sanitizeText(process.env.DATABASE_URL) || sanitizeText(process.env.POSTGRES_URL);

if (!connectionString) {
  console.error('A variável de ambiente DATABASE_URL (ou POSTGRES_URL) é obrigatória para sincronizar os administradores.');
  process.exit(1);
}

const parseConnection = raw => {
  try {
    return new URL(raw);
  } catch (error) {
    console.warn('Não foi possível interpretar a URL do banco. Prosseguindo sem heurísticas de SSL:', error?.message);
    return null;
  }
};

const parsedConnection = parseConnection(connectionString);
const sslPreference = sanitizeText(process.env.DATABASE_SSL).toLowerCase();
const isRenderHost = parsedConnection?.hostname?.endsWith('.render.com');

const shouldUseSSL = () => {
  if (sslPreference === 'disable') return false;
  if (sslPreference === 'require') return true;
  if (isRenderHost) return true;
  return process.env.NODE_ENV === 'production';
};

const sslEnabled = shouldUseSSL();

if (sslPreference !== 'disable' && isRenderHost && !sslPreference) {
  console.info('Host do Render detectado. SSL habilitado automaticamente para a sincronização.');
}

if (!sslEnabled && isRenderHost) {
  console.warn('Você está desativando o SSL para um host Render. Isso normalmente não é recomendado.');
}

const pool = new Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
});

const query = (text, params = []) => pool.query(text, params);

const mapUserRow = row => ({
  id: row.id,
  username: row.username,
  usernameLower: row.username_lower,
  passwordHash: row.password_hash,
  role: row.role,
  approved: row.approved,
  photo: row.photo,
});

const ensureUsersTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      username TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      approved BOOLEAN NOT NULL DEFAULT FALSE,
      photo TEXT
    )
  `);

  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(username_lower)');
};

const getUserByUsernameLower = async usernameLower => {
  const { rows } = await query(
    'SELECT id, username, username_lower, password_hash, role, approved, photo FROM users WHERE username_lower = $1 LIMIT 1',
    [usernameLower]
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
};

const insertUser = async user => {
  await query(
    `INSERT INTO users (id, username, username_lower, password_hash, role, approved, photo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      user.id,
      user.username,
      user.usernameLower,
      user.passwordHash,
      user.role,
      user.approved,
      user.photo,
    ]
  );
};

const updateUserFromSeed = async (id, user) => {
  await query(
    `UPDATE users
        SET username = $2,
            username_lower = $3,
            password_hash = $4,
            role = $5,
            approved = $6,
            photo = $7
      WHERE id = $1`,
    [
      id,
      user.username,
      user.usernameLower,
      user.passwordHash,
      user.role,
      user.approved,
      user.photo,
    ]
  );
};

const filterAdmins = entry => (entry.role || '').toLowerCase() === 'admin';

const run = async () => {
  await ensureUsersTable();
  const result = await importUsersFromSeed({
    usersFile,
    getUserByUsernameLower,
    insertUser,
    updateUser: updateUserFromSeed,
    filter: filterAdmins,
    logger: console,
  });
  console.log(`Sincronização finalizada: ${result.inserted} administradores inseridos, ${result.updated} atualizados, ${result.skipped} ignorados.`);
};

run()
  .catch(error => {
    const connectionHints = new Set(['ENOTFOUND', 'ENETUNREACH', 'ECONNREFUSED']);
    if (connectionHints.has(error?.code)) {
      console.error(
        'Não foi possível conectar ao banco. Verifique se a variável DATABASE_URL aponta para um host acessível. '
          + 'Quando executar fora da infraestrutura do Render, utilize a External Database URL (terminada em .render.com).'
      );
    }
    console.error('Falha ao sincronizar administradores:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end().catch(() => {});
  });

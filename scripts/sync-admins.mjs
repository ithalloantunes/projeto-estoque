#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

import { sanitizeText } from '../lib/utils.js';
import { seedUsersFromFile as importUsersFromSeed } from '../lib/user-seed.js';
import { DEFAULT_DATABASE_URL, DEFAULT_DATABASE_URL_EXTERNAL } from '../lib/db-defaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const usersFile = path.join(projectRoot, 'data', 'users.json');

const normalizeConnectionString = value => sanitizeText(value) || '';

const primaryCandidates = [];
const fallbackCandidates = [];
const registeredConnections = new Set();

const registerCandidate = (label, value, type) => {
  const normalized = normalizeConnectionString(value);
  if (!normalized || registeredConnections.has(normalized)) {
    return;
  }
  registeredConnections.add(normalized);
  const candidate = { label, value: normalized, type };
  if (type === 'fallback') {
    fallbackCandidates.push(candidate);
  } else {
    primaryCandidates.push(candidate);
  }
};

registerCandidate('DATABASE_URL', process.env.DATABASE_URL, 'primary');
registerCandidate('POSTGRES_URL', process.env.POSTGRES_URL, 'primary');
registerCandidate('DEFAULT_DATABASE_URL', DEFAULT_DATABASE_URL, 'primary');
registerCandidate('DATABASE_URL_EXTERNAL', process.env.DATABASE_URL_EXTERNAL, 'fallback');
registerCandidate('RENDER_EXTERNAL_DATABASE_URL', process.env.RENDER_EXTERNAL_DATABASE_URL, 'fallback');
registerCandidate('DEFAULT_DATABASE_URL_EXTERNAL', DEFAULT_DATABASE_URL_EXTERNAL, 'fallback');

const allCandidates = [...primaryCandidates, ...fallbackCandidates];

if (!allCandidates.length) {
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

const isPrivateHost = host => {
  if (!host) return false;
  const normalized = host.toLowerCase();
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
    return false;
  }
  if (normalized.endsWith('.internal')) {
    return true;
  }
  if (/^10\./.test(normalized) || /^192\.168\./.test(normalized)) {
    return true;
  }
  const match = normalized.match(/^172\.(\d{1,3})\./);
  if (match) {
    const secondOctet = Number.parseInt(match[1], 10);
    if (Number.isInteger(secondOctet) && secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }
  return false;
};

const formatLabel = candidate => candidate?.label || 'DATABASE_URL';

let pool = null;

const createPoolInstance = (connectionString, sslEnabled) => new Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
});

const connectToDatabase = async () => {
  if (pool) return pool;

  let lastError = null;

  for (const candidate of allCandidates) {
    const parsedConnection = parseConnection(candidate.value);
    const sslPreference = sanitizeText(process.env.DATABASE_SSL).toLowerCase();
    const isRenderHost = parsedConnection?.hostname?.endsWith('.render.com');

    const shouldUseSSL = () => {
      if (sslPreference === 'disable') return false;
      if (sslPreference === 'require') return true;
      if (isRenderHost) return true;
      return process.env.NODE_ENV === 'production';
    };

    const sslEnabled = shouldUseSSL();

    if (sslPreference !== 'disable' && isRenderHost && !sslPreference && candidate.type === 'primary') {
      console.info('Host do Render detectado. SSL habilitado automaticamente para a sincronização.');
    }

    if (!sslEnabled && isRenderHost) {
      console.warn('Você está desativando o SSL para um host Render. Isso normalmente não é recomendado.');
    }

    const instance = createPoolInstance(candidate.value, sslEnabled);

    try {
      await instance.query('SELECT 1');
      pool = instance;

      if (candidate.type === 'fallback') {
        console.warn(`Conexão principal indisponível. Utilizando ${formatLabel(candidate)}.`);
      } else if (isPrivateHost(parsedConnection?.hostname) && !process.env.RENDER) {
        console.warn(
          `Aviso: ${formatLabel(candidate)} aponta para um host privado (${parsedConnection?.hostname}). ` +
            'Fora do Render utilize a variável `DATABASE_URL_EXTERNAL` com a URL externa do banco.'
        );
      }

      return pool;
    } catch (error) {
      await instance.end().catch(() => {});
      lastError = { candidate, error };

      if (candidate.type === 'primary' && fallbackCandidates.length) {
        const host = parsedConnection?.hostname;
        if (host && isPrivateHost(host)) {
          console.warn(
            `Falha ao conectar ao host interno "${host}" definido em ${formatLabel(candidate)}. ` +
              'Tentando utilizar as variáveis de fallback...'
          );
        } else {
          console.warn(`Falha ao conectar usando ${formatLabel(candidate)}: ${error.message}`);
        }
      } else {
        console.warn(`Falha ao conectar usando ${formatLabel(candidate)}: ${error.message}`);
      }
    }
  }

  if (lastError) {
    const { candidate, error } = lastError;
    const host = parseConnection(candidate?.value)?.hostname;
    if (error?.code === 'ECONNREFUSED' && host && isPrivateHost(host)) {
      console.error(
        `Não foi possível conectar ao host interno "${host}" definido em ${formatLabel(candidate)}. ` +
          'Esse endereço costuma estar acessível apenas dentro do Render. Configure `DATABASE_URL_EXTERNAL` com a URL externa ou utilize um Postgres local.'
      );
    }
    throw error;
  }

  throw new Error('Não foi possível estabelecer conexão com o banco de dados.');
};

const query = (text, params = []) => {
  if (!pool) {
    throw new Error('Pool de conexões não inicializado.');
  }
  return pool.query(text, params);
};

const mapUserRow = row => ({
  id: row.id,
  username: row.username,
  usernameLower: row.username_lower,
  passwordHash: row.password_hash,
  role: row.role,
  approved: row.approved,
  photo: row.photo,
  photoMime: row.photo_mime,
  recoveryCodeHash: row.recovery_code_hash,
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
      photo TEXT,
      photo_mime TEXT,
      photo_data BYTEA,
      recovery_code_hash TEXT
    ) TABLESPACE pg_default
  `);

  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_mime TEXT');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_data BYTEA');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_hash TEXT');
  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(username_lower) TABLESPACE pg_default');
};

const getUserByUsernameLower = async usernameLower => {
  const { rows } = await query(
    'SELECT id, username, username_lower, password_hash, role, approved, photo, photo_mime, recovery_code_hash FROM users WHERE username_lower = $1 LIMIT 1',
    [usernameLower]
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
};

const insertUser = async user => {
  await query(
    `INSERT INTO users (id, username, username_lower, password_hash, role, approved, photo, photo_mime, photo_data, recovery_code_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      user.id,
      user.username,
      user.usernameLower,
      user.passwordHash,
      user.role,
      user.approved,
      user.photo ?? null,
      user.photoMime ?? null,
      user.photoData ?? null,
      user.recoveryCodeHash ?? null,
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
            photo = $7,
            photo_mime = $8,
            photo_data = $9,
            recovery_code_hash = $10
      WHERE id = $1`,
    [
      id,
      user.username,
      user.usernameLower,
      user.passwordHash,
      user.role,
      user.approved,
      user.photo ?? null,
      user.photoMime ?? null,
      user.photoData ?? null,
      user.recoveryCodeHash ?? null,
    ]
  );
};

const filterAdmins = entry => (entry.role || '').toLowerCase() === 'admin';

const run = async () => {
  await connectToDatabase();
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
        'Não foi possível conectar ao banco. Verifique se as variáveis de conexão apontam para um host acessível. '
          + 'Quando executar fora da infraestrutura do Render, utilize a External Database URL em `DATABASE_URL_EXTERNAL`.'
      );
    }
    console.error('Falha ao sincronizar administradores:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (pool) {
      pool.end().catch(() => {});
    }
  });

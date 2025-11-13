import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { newDb } from 'pg-mem';

import { seedUsersFromFile as importUsersFromSeed } from '../lib/user-seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const usersFile = path.join(projectRoot, 'data', 'users.json');

const createTestDatabase = async () => {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  const query = (text, params = []) => pool.query(text, params);

  await query(`
    CREATE TABLE users (
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
    )
  `);

  await query('CREATE UNIQUE INDEX idx_users_username_lower ON users(username_lower)');

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

  const updateUser = async (id, user) => {
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

  return {
    pool,
    query,
    getUserByUsernameLower,
    insertUser,
    updateUser,
    filterAdmins,
  };
};

test('imports admin users from seed file', async () => {
  const db = await createTestDatabase();
  const result = await importUsersFromSeed({
    usersFile,
    getUserByUsernameLower: db.getUserByUsernameLower,
    insertUser: db.insertUser,
    updateUser: db.updateUser,
    filter: db.filterAdmins,
    logger: null,
  });

  assert.equal(result.inserted, 2);
  assert.equal(result.updated, 0);

  const { rows } = await db.query('SELECT username, role, approved FROM users ORDER BY username_lower ASC');
  assert.deepEqual(
    rows.map(row => ({ username: row.username, role: row.role, approved: row.approved })),
    [
      { username: 'ithallo', role: 'admin', approved: true },
      { username: 'vini', role: 'admin', approved: true },
    ]
  );

  await db.pool.end();
});

test('running the import again does not duplicate admins', async () => {
  const db = await createTestDatabase();
  await importUsersFromSeed({
    usersFile,
    getUserByUsernameLower: db.getUserByUsernameLower,
    insertUser: db.insertUser,
    updateUser: db.updateUser,
    filter: db.filterAdmins,
    logger: null,
  });

  const result = await importUsersFromSeed({
    usersFile,
    getUserByUsernameLower: db.getUserByUsernameLower,
    insertUser: db.insertUser,
    updateUser: db.updateUser,
    filter: db.filterAdmins,
    logger: null,
  });

  assert.equal(result.inserted, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.skipped, 2);

  const { rows } = await db.query('SELECT COUNT(*)::INT AS total FROM users');
  assert.equal(rows[0].total, 2);

  await db.pool.end();
});

test('updates approval status of existing admins', async () => {
  const db = await createTestDatabase();
  await importUsersFromSeed({
    usersFile,
    getUserByUsernameLower: db.getUserByUsernameLower,
    insertUser: db.insertUser,
    updateUser: db.updateUser,
    filter: db.filterAdmins,
    logger: null,
  });

  await db.query('UPDATE users SET approved = FALSE WHERE role = $1', ['admin']);

  const result = await importUsersFromSeed({
    usersFile,
    getUserByUsernameLower: db.getUserByUsernameLower,
    insertUser: db.insertUser,
    updateUser: db.updateUser,
    filter: db.filterAdmins,
    logger: null,
  });

  assert.equal(result.inserted, 0);
  assert.ok(result.updated >= 1);

  const { rows } = await db.query('SELECT COUNT(*) FILTER (WHERE approved) AS aprovados FROM users');
  assert.equal(Number(rows[0].aprovados), 2);

  await db.pool.end();
});

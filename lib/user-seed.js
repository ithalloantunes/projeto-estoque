import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

import { sanitizeText, normalizeUsername, BCRYPT_SALT_ROUNDS } from './utils.js';

const DEFAULT_PASSWORD_FALLBACK = '12345678';
const DEFAULT_RECOVERY_CODE_FALLBACK = 'ACAI1234';

const logInfo = (logger, message) => {
  if (!logger) return;
  if (typeof logger.info === 'function') {
    logger.info(message);
  } else if (typeof logger.log === 'function') {
    logger.log(message);
  }
};

const logWarn = (logger, message) => {
  if (!logger) return;
  if (typeof logger.warn === 'function') {
    logger.warn(message);
  } else if (typeof logger.log === 'function') {
    logger.log(message);
  }
};

const parseSeedFile = usersFile => {
  const rawContent = fs.readFileSync(usersFile, 'utf8');
  const parsed = JSON.parse(rawContent);
  if (!Array.isArray(parsed)) {
    throw new Error(`O arquivo ${usersFile} deve conter um array de usuários.`);
  }
  return parsed;
};

export const seedUsersFromFile = async ({
  usersFile,
  getUserByUsernameLower,
  insertUser,
  updateUser,
  filter,
  logger = console,
} = {}) => {
  if (!usersFile) {
    throw new Error('O caminho do arquivo de usuários é obrigatório.');
  }
  if (typeof getUserByUsernameLower !== 'function' || typeof insertUser !== 'function' || typeof updateUser !== 'function') {
    throw new Error('Funções de acesso ao banco de dados são obrigatórias para importar usuários.');
  }

  if (!fs.existsSync(usersFile)) {
    logWarn(logger, `Arquivo ${usersFile} não encontrado. Nenhum usuário foi importado.`);
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  let seedEntries;
  try {
    seedEntries = parseSeedFile(usersFile);
  } catch (error) {
    logWarn(logger, `Não foi possível ler o arquivo ${usersFile}: ${error.message}`);
    throw error;
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of seedEntries) {
    const username = sanitizeText(entry.username);
    if (!username) {
      skipped += 1;
      continue;
    }

    const normalizedUsername = normalizeUsername(username);
    const normalizedRole = (sanitizeText(entry.role) || 'user').toLowerCase();
    const shouldInclude = typeof filter === 'function' ? filter({ ...entry, role: normalizedRole }) : true;
    if (!shouldInclude) {
      skipped += 1;
      continue;
    }

    const existing = await getUserByUsernameLower(normalizedUsername);
    const passwordHashSource = sanitizeText(entry.passwordHash);
    const passwordPlainSource = sanitizeText(entry.password);
    const passwordSource = passwordHashSource || passwordPlainSource || DEFAULT_PASSWORD_FALLBACK;
    const passwordHash = passwordSource.startsWith('$2')
      ? passwordSource
      : (existing?.passwordHash && bcrypt.compareSync(passwordSource, existing.passwordHash))
        ? existing.passwordHash
        : bcrypt.hashSync(passwordSource, BCRYPT_SALT_ROUNDS);
    const recoveryCodeHashSource = sanitizeText(entry.recoveryCodeHash);
    const recoveryCodePlainSource = sanitizeText(entry.recoveryCode);
    let recoveryCodeHash = null;
    if (recoveryCodeHashSource && recoveryCodeHashSource.startsWith('$2')) {
      recoveryCodeHash = recoveryCodeHashSource;
    } else if (recoveryCodePlainSource) {
      recoveryCodeHash = bcrypt.hashSync(recoveryCodePlainSource, BCRYPT_SALT_ROUNDS);
    } else if (existing?.recoveryCodeHash) {
      recoveryCodeHash = existing.recoveryCodeHash;
    } else {
      recoveryCodeHash = bcrypt.hashSync(DEFAULT_RECOVERY_CODE_FALLBACK, BCRYPT_SALT_ROUNDS);
    }

    const approved = entry.approved !== undefined ? Boolean(entry.approved) : normalizedRole === 'admin';
    const providedPhoto = entry.photo ? sanitizeText(entry.photo) : null;

    if (!existing) {
      const idFromEntry = sanitizeText(entry.id);
      const id = validateUuid(idFromEntry) ? idFromEntry : uuidv4();
      await insertUser({
        id,
        username,
        usernameLower: normalizedUsername,
        passwordHash,
        role: normalizedRole,
        approved,
        photo: providedPhoto,
        recoveryCodeHash,
      });
      inserted += 1;
      continue;
    }

    const needsUpdate =
      existing.username !== username ||
      existing.usernameLower !== normalizedUsername ||
      existing.role !== normalizedRole ||
      existing.approved !== approved ||
      existing.passwordHash !== passwordHash ||
      (existing.recoveryCodeHash ?? null) !== (recoveryCodeHash ?? null);

    if (needsUpdate) {
      await updateUser(existing.id, {
        username,
        usernameLower: normalizedUsername,
        passwordHash,
        role: normalizedRole,
        approved,
        recoveryCodeHash,
      });
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  logInfo(logger, `Importação de usuários finalizada: ${inserted} inseridos, ${updated} atualizados, ${skipped} ignorados.`);

  return { inserted, updated, skipped };
};

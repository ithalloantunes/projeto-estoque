const DEFAULT_BCRYPT_ROUNDS = 12;

export const sanitizeText = value => (typeof value === 'string' ? value.trim() : '');

export const normalizeUsername = value => sanitizeText(value).toLowerCase();

export const sanitizeCost = value => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
};

const parseBcryptRounds = raw => {
  const sanitized = sanitizeText(raw);
  if (!sanitized) return DEFAULT_BCRYPT_ROUNDS;
  const parsed = Number.parseInt(sanitized, 10);
  if (!Number.isFinite(parsed) || parsed < 4 || parsed > 15) return DEFAULT_BCRYPT_ROUNDS;
  return parsed;
};

export const BCRYPT_SALT_ROUNDS = parseBcryptRounds(process.env.BCRYPT_SALT_ROUNDS);

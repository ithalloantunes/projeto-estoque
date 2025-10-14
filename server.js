import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

import { sanitizeText, normalizeUsername, sanitizeCost, BCRYPT_SALT_ROUNDS, parsePositiveInt } from './lib/utils.js';
import { seedUsersFromFile as importUsersFromSeed } from './lib/user-seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

const normalizeOrigin = origin => sanitizeText(origin).replace(/\/+$/, '');

const sanitizeHostHeader = header => {
  const sanitized = sanitizeText(header);
  if (!sanitized) return null;
  return sanitized.replace(/[^a-zA-Z0-9\-\.:]/g, '');
};

const parseAdditionalOrigins = raw => {
  const sanitized = sanitizeText(raw);
  if (!sanitized) return [];
  return sanitized
    .split(',')
    .map(entry => normalizeOrigin(entry))
    .filter(Boolean);
};

const allowedOrigins = new Set([
  normalizeOrigin('https://projeto-estoque-o1x5.onrender.com')
]);

if (!isProduction) {
  allowedOrigins.add(normalizeOrigin('http://localhost:3000'));
  allowedOrigins.add(normalizeOrigin('http://127.0.0.1:3000'));
}

for (const origin of parseAdditionalOrigins(process.env.CORS_ALLOWED_ORIGINS)) {
  allowedOrigins.add(origin);
}

const RATE_LIMIT_WINDOW_MS = parsePositiveInt(
  process.env.RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000,
  { min: 1000, max: 60 * 60 * 1000 }
);

const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(
  process.env.RATE_LIMIT_MAX_REQUESTS,
  300,
  { min: 25, max: 10000 }
);

const AUTH_RATE_LIMIT_WINDOW_MS = parsePositiveInt(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000,
  { min: 1000, max: 60 * 60 * 1000 }
);

const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = parsePositiveInt(
  process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  10,
  { min: 3, max: 100 }
);

const REGISTER_RATE_LIMIT_MAX_ATTEMPTS = parsePositiveInt(
  process.env.REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
  5,
  { min: 1, max: 50 }
);

const createRateLimiter = ({ windowMs, max, message }) => rateLimit({
  windowMs,
  max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: req => req.method === 'OPTIONS',
  handler: (req, res) => {
    res.status(429).json({ error: message });
  }
});

const apiRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: 'Muitas solicitações. Tente novamente mais tarde.'
});

const loginRateLimiter = createRateLimiter({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  message: 'Muitas tentativas de login. Aguarde alguns instantes.'
});

const registerRateLimiter = createRateLimiter({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
  message: 'Muitas tentativas de cadastro. Aguarde alguns instantes.'
});

const shouldEnforceHttps = isProduction && sanitizeText(process.env.ENFORCE_HTTPS) !== 'disable';

const STATIC_CACHE_CONTROL = 'public, max-age=300, must-revalidate';
const HTML_CACHE_CONTROL = 'no-store';

function setNoSniffHeader(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function createStaticMiddleware(relativePath, { cacheControl = STATIC_CACHE_CONTROL } = {}) {
  return express.static(
    path.join(__dirname, relativePath),
    {
      fallthrough: false,
      setHeaders: res => {
        setNoSniffHeader(res);
        if (cacheControl) {
          res.setHeader('Cache-Control', cacheControl);
        }
      }
    }
  );
}

function sendFileWithHeaders(res, absolutePath, cacheControl = STATIC_CACHE_CONTROL) {
  if (cacheControl) {
    res.setHeader('Cache-Control', cacheControl);
  }
  setNoSniffHeader(res);
  res.sendFile(absolutePath);
}

const SESSION_COOKIE_NAME = 'session';
const JWT_EXPIRATION = '12h';

const connectionString = sanitizeText(process.env.DATABASE_URL) || sanitizeText(process.env.POSTGRES_URL);

if (!connectionString) {
  console.error('A variável de ambiente DATABASE_URL é obrigatória para iniciar o servidor.');
  process.exit(1);
}

const usesSSL = sanitizeText(process.env.DATABASE_SSL) !== 'disable' && isProduction;

const pool = new Pool({
  connectionString,
  max: Number.parseInt(process.env.PGPOOL_MAX || '10', 10),
  ssl: usesSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', error => {
  console.error('Erro inesperado na conexão com o banco de dados:', error);
});

const query = (text, params = []) => pool.query(text, params);
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isOriginAllowed = origin => {
  if (!origin) return true;
  return allowedOrigins.has(normalizeOrigin(origin));
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      const error = new Error('Origem não autorizada pela configuração de CORS.');
      error.statusCode = 403;
      callback(error);
    }
  },
  credentials: true
};

const app = express();
app.disable('x-powered-by');

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: isProduction ? undefined : false,
}));

if (shouldEnforceHttps) {
  app.use((req, res, next) => {
    const forwardedProtoHeader = sanitizeText(req.headers['x-forwarded-proto']).toLowerCase();
    const forwardedProto = forwardedProtoHeader.split(',')[0];
    if (req.secure || forwardedProto === 'https') {
      return next();
    }
    const sanitizedHost = sanitizeHostHeader(req.headers.host);
    if (!sanitizedHost) {
      return res.status(400).json({ error: 'Host inválido' });
    }
    return res.redirect(301, `https://${sanitizedHost}${req.originalUrl}`);
  });
}

app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  if (req.path.startsWith('/data')) {
    return res.status(404).json({ error: 'Recurso não encontrado' });
  }
  return next();
});

app.use('/api', apiRateLimiter);

app.use('/uploads', createStaticMiddleware('uploads', { cacheControl: 'private, max-age=300, must-revalidate' }));
app.use('/img', createStaticMiddleware('img'));
app.use('/vendor', createStaticMiddleware('vendor'));

app.get('/javascript.js', (req, res) => {
  sendFileWithHeaders(res, path.join(__dirname, 'javascript.js'));
});

app.get('/estilos.css', (req, res) => {
  sendFileWithHeaders(res, path.join(__dirname, 'estilos.css'));
});

app.get('/', (req, res) => {
  sendFileWithHeaders(res, path.join(__dirname, 'index.html'), HTML_CACHE_CONTROL);
});

app.get('/index.html', (req, res) => {
  sendFileWithHeaders(res, path.join(__dirname, 'index.html'), HTML_CACHE_CONTROL);
});

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin));
    },
    credentials: true
  }
});

io.on('connection', socket => {
  socket.on('disconnect', () => {
    // Listener intencionalmente vazio.
  });
});

const dataDir     = path.join(__dirname, 'data');
const usersFile   = path.join(dataDir, 'users.json');
const estoqueFile = path.join(dataDir, 'estoque.json');
const uploadsDir        = path.join(__dirname, 'uploads');
const productImagesDir  = path.join(uploadsDir, 'products');
const userImagesDir     = path.join(uploadsDir, 'users');

const ensureDir = dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

ensureDir(dataDir);
ensureDir(uploadsDir);
ensureDir(productImagesDir);
ensureDir(userImagesDir);

const jwtSecretFile = path.join(dataDir, '.jwt-secret');
let JWT_SECRET = sanitizeText(process.env.JWT_SECRET);
if (!JWT_SECRET) {
  if (fs.existsSync(jwtSecretFile)) {
    JWT_SECRET = sanitizeText(fs.readFileSync(jwtSecretFile, 'utf8'));
  }
  if (!JWT_SECRET) {
    JWT_SECRET = `${uuidv4()}${uuidv4()}`.replace(/-/g, '');
    fs.writeFileSync(jwtSecretFile, JWT_SECRET, { encoding: 'utf8' });
  }
}

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: isProduction,
  maxAge: 12 * 60 * 60 * 1000,
  path: '/',
});

const setSessionCookie = (res, token) => {
  res.cookie(SESSION_COOKIE_NAME, token, getCookieOptions());
};

const clearSessionCookie = res => {
  const options = getCookieOptions();
  delete options.maxAge;
  res.clearCookie(SESSION_COOKIE_NAME, options);
};

const DEFAULT_MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

const bytesToMegabytes = bytes => Math.round((bytes / (1024 * 1024)) * 100) / 100;

const parseUploadLimit = () => {
  const bytesRaw = sanitizeText(process.env.UPLOAD_MAX_FILE_SIZE_BYTES);
  if (bytesRaw) {
    const parsedBytes = Number.parseInt(bytesRaw, 10);
    if (Number.isFinite(parsedBytes) && parsedBytes > 0) {
      return parsedBytes;
    }
  }
  const mbRaw = sanitizeText(process.env.UPLOAD_MAX_FILE_SIZE_MB).replace(',', '.');
  if (mbRaw) {
    const parsedMb = Number.parseFloat(mbRaw);
    if (Number.isFinite(parsedMb) && parsedMb > 0) {
      return Math.round(parsedMb * 1024 * 1024);
    }
  }
  return DEFAULT_MAX_UPLOAD_SIZE;
};

const MAX_UPLOAD_SIZE = parseUploadLimit();
const MAX_UPLOAD_SIZE_MB = bytesToMegabytes(MAX_UPLOAD_SIZE);

const formatMegabytesLabel = value => {
  if (!Number.isFinite(value)) return '0';
  const decimals = value >= 1 ? 2 : 1;
  const normalized = Number.parseFloat(value.toFixed(decimals));
  return normalized.toString().replace('.', ',');
};

const MAX_UPLOAD_SIZE_MB_LABEL = formatMegabytesLabel(MAX_UPLOAD_SIZE_MB);

const imageFileFilter = (req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    cb(new Error('Arquivo de imagem inválido.'));
  } else {
    cb(null, true);
  }
};

const createStorage = destination => multer.diskStorage({
  destination,
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const extension = path.extname(file.originalname || '') || '.png';
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

const createUpload = storage => multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 }
});

const productUpload = createUpload(createStorage(productImagesDir));

const userUpload = createUpload(createStorage(userImagesDir));

const toPublicPath = relativePath => {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const getStoredFilePath = file => {
  if (!file) return null;
  return path.relative(__dirname, file.path).replace(/\\/g, '/');
};

const removeStoredFile = relativePath => {
  if (!relativePath) return;
  const trimmed = relativePath.replace(/^\/+/, '');
  const absolutePath = path.resolve(__dirname, trimmed);
  if (!absolutePath.startsWith(uploadsDir)) return;
  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
    } catch (error) {
      console.warn(`Não foi possível remover o arquivo ${absolutePath}:`, error.message);
    }
  }
};

const readUploadedFileBuffer = async file => {
  if (!file?.path) return null;
  try {
    return await fs.promises.readFile(file.path);
  } catch (error) {
    console.error(`Falha ao ler o arquivo de upload ${file.path}:`, error);
    throw new Error('Falha ao processar a imagem enviada');
  }
};

const mapUserRow = row => ({
  id: row.id,
  username: row.username,
  usernameLower: row.username_lower,
  passwordHash: row.password_hash,
  role: row.role,
  approved: row.approved,
  photo: row.photo,
});

const sanitizeUserForResponse = user => ({
  id: user.id,
  username: user.username,
  role: user.role,
  approved: Boolean(user.approved),
  photo: toPublicPath(user.photo) || null,
});

const mapInventoryRow = (row, { includeImageData = false } = {}) => {
  const mapped = {
    id: row.id,
    produto: row.produto,
    tipo: row.tipo,
    lote: row.lote,
    quantidade: Number(row.quantidade) || 0,
    validade: row.validade ? (row.validade instanceof Date ? row.validade.toISOString().slice(0, 10) : row.validade) : null,
    custo: row.custo === null || row.custo === undefined ? null : Number(row.custo),
    image: row.image,
  };
  if (includeImageData) {
    mapped.imageData = row.image_data ?? null;
  }
  return mapped;
};

const mapMovimentacaoRow = row => ({
  id: row.id,
  produtoId: row.produto_id,
  produto: row.produto,
  tipo: row.tipo,
  quantidade: Number(row.quantidade) || 0,
  quantidadeAnterior: row.quantidade_anterior === null || row.quantidade_anterior === undefined ? null : Number(row.quantidade_anterior),
  quantidadeAtual: row.quantidade_atual === null || row.quantidade_atual === undefined ? null : Number(row.quantidade_atual),
  motivo: row.motivo,
  data: row.data instanceof Date ? row.data.toISOString() : row.data,
  usuario: row.usuario,
});

const getUserById = async id => {
  const { rows } = await query(
    'SELECT id, username, username_lower, password_hash, role, approved, photo FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
};

const getUserByUsernameLower = async usernameLower => {
  const { rows } = await query(
    'SELECT id, username, username_lower, password_hash, role, approved, photo FROM users WHERE username_lower = $1 LIMIT 1',
    [usernameLower]
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
};

const listUsers = async ({ approved } = {}) => {
  const clauses = [];
  const params = [];
  if (approved !== undefined) {
    clauses.push(`approved = $${params.length + 1}`);
    params.push(approved);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id, username, username_lower, password_hash, role, approved, photo FROM users ${where} ORDER BY username_lower`,
    params
  );
  return rows.map(mapUserRow);
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
  const { rows } = await query(
    `UPDATE users
        SET username = $2,
            username_lower = $3,
            password_hash = $4,
            role = $5,
            approved = $6,
            photo = $7
      WHERE id = $1
  RETURNING id, username, username_lower, password_hash, role, approved, photo`,
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
  return rows[0] ? mapUserRow(rows[0]) : null;
};

const updateUserApproval = async (id, approved) => {
  const { rows } = await query(
    `UPDATE users SET approved = $2 WHERE id = $1 RETURNING id, username, username_lower, password_hash, role, approved, photo`,
    [id, approved]
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
};

const updateUserPhoto = async (id, photoPath) => {
  const { rows } = await query(
    `UPDATE users SET photo = $2 WHERE id = $1 RETURNING id, username, username_lower, password_hash, role, approved, photo`,
    [id, photoPath]
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
};

const deleteUserById = async id => {
  const { rows } = await query(
    'DELETE FROM users WHERE id = $1 RETURNING photo',
    [id]
  );
  return rows[0] ?? null;
};

const listInventory = async () => {
  const { rows } = await query(
    'SELECT id, produto, tipo, lote, quantidade, validade, custo, image FROM inventory ORDER BY produto ASC'
  );
  return rows.map(mapInventoryRow);
};

const getInventoryItemById = async id => {
  const { rows } = await query(
    'SELECT id, produto, tipo, lote, quantidade, validade, custo, image, image_data FROM inventory WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] ? mapInventoryRow(rows[0], { includeImageData: true }) : null;
};

const insertInventoryItem = async item => {
  await query(
    `INSERT INTO inventory (id, produto, tipo, lote, quantidade, validade, custo, image, image_data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [
      item.id,
      item.produto,
      item.tipo,
      item.lote,
      item.quantidade,
      item.validade,
      item.custo,
      item.image,
      item.imageData ?? null,
      new Date(),
    ]
  );
};

const updateInventoryItem = async item => {
  await query(
    `UPDATE inventory
        SET produto = $2,
            tipo = $3,
            lote = $4,
            quantidade = $5,
            validade = $6,
            custo = $7,
            image = $8,
            image_data = $9,
            updated_at = NOW()
      WHERE id = $1`,
    [
      item.id,
      item.produto,
      item.tipo,
      item.lote,
      item.quantidade,
      item.validade,
      item.custo,
      item.image,
      item.imageData ?? null,
    ]
  );
};

const deleteInventoryItemById = async id => {
  const { rows } = await query(
    'DELETE FROM inventory WHERE id = $1 RETURNING id, produto, tipo, lote, quantidade, validade, custo, image',
    [id]
  );
  return rows[0] ? mapInventoryRow(rows[0]) : null;
};

const insertMovimentacao = async mov => {
  await query(
    `INSERT INTO movimentacoes (id, produto_id, produto, tipo, quantidade, quantidade_anterior, quantidade_atual, motivo, data, usuario)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      mov.id,
      mov.produtoId,
      mov.produto,
      mov.tipo,
      mov.quantidade,
      mov.quantidadeAnterior,
      mov.quantidadeAtual,
      mov.motivo,
      mov.data,
      mov.usuario,
    ]
  );
};

const listMovimentacoes = async ({ start, end } = {}) => {
  const clauses = [];
  const params = [];
  if (start) {
    const startDate = new Date(start);
    if (!Number.isNaN(startDate.getTime())) {
      clauses.push(`data >= $${params.length + 1}`);
      params.push(startDate);
    }
  }
  if (end) {
    const endDate = new Date(end);
    if (!Number.isNaN(endDate.getTime())) {
      clauses.push(`data <= $${params.length + 1}`);
      params.push(endDate);
    }
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id, produto_id, produto, tipo, quantidade, quantidade_anterior, quantidade_atual, motivo, data, usuario
       FROM movimentacoes
       ${where}
      ORDER BY data DESC, id DESC`,
    params
  );
  return rows.map(mapMovimentacaoRow);
};

const initializeDatabase = async () => {
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

  await query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id UUID PRIMARY KEY,
      produto TEXT NOT NULL,
      tipo TEXT,
      lote TEXT,
      quantidade INTEGER NOT NULL,
      validade DATE,
      custo NUMERIC(12,2) NOT NULL,
      image TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id UUID PRIMARY KEY,
      produto_id UUID,
      produto TEXT,
      tipo TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      quantidade_anterior INTEGER,
      quantidade_atual INTEGER,
      motivo TEXT,
      data TIMESTAMPTZ NOT NULL,
      usuario TEXT
    )
  `);

  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(username_lower)');
  await query('CREATE INDEX IF NOT EXISTS idx_inventory_produto ON inventory(produto)');
  await query('CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data)');

  await seedUsersFromFile();
  await seedInventoryFromFile();
};

const seedUsersFromFile = async () => {
  try {
    await importUsersFromSeed({
      usersFile,
      getUserByUsernameLower,
      insertUser,
      updateUser: updateUserFromSeed,
      logger: console,
    });
  } catch (error) {
    console.error('Falha ao importar usuários iniciais:', error);
  }
};

const seedInventoryFromFile = async () => {
  if (!fs.existsSync(estoqueFile)) return;
  const { rows } = await query('SELECT COUNT(*)::INT AS count FROM inventory');
  const currentCount = Number.parseInt(rows[0]?.count ?? '0', 10) || 0;
  if (currentCount > 0) return;
  try {
    const raw = JSON.parse(fs.readFileSync(estoqueFile, 'utf8'));
    for (const entry of raw) {
      const quantidade = Number.parseInt(entry.quantidade, 10) || 0;
      const custo = sanitizeCost(entry.custo);
      if (custo === null) continue;
      await insertInventoryItem({
        id: uuidv4(),
        produto: sanitizeText(entry.produto) || 'Produto sem nome',
        tipo: sanitizeText(entry.tipo) || null,
        lote: sanitizeText(entry.lote) || null,
        quantidade,
        validade: entry.validade ? entry.validade : null,
        custo,
        image: entry.image ? sanitizeText(entry.image) : null,
        imageData: null,
      });
    }
  } catch (error) {
    console.error('Falha ao importar estoque inicial:', error);
  }
};

const broadcastDataUpdated = () => {
  io.emit('dataUpdated');
};

const broadcastUsersUpdated = () => {
  io.emit('usersUpdated');
};

const broadcastUserPhotoUpdated = payload => {
  io.emit('userPhotoUpdated', payload);
};

const createSessionToken = user => jwt.sign({
  userId: user.id,
  role: user.role,
  username: user.username,
}, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

const authMiddleware = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.userId);
    if (!user || !user.approved) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
    }
    req.user = {
      id: user.id,
      role: user.role,
      username: user.username,
    };
    return next();
  } catch (error) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
});

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito' });
  }
  return next();
};

app.post('/api/register', registerRateLimiter, asyncHandler(async (req, res) => {
  const username = sanitizeText(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'O usuário deve ter pelo menos 3 caracteres.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
  }

  const normalized = normalizeUsername(username);
  const existing = await getUserByUsernameLower(normalized);
  if (existing) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
  await insertUser({
    id: uuidv4(),
    username,
    usernameLower: normalized,
    passwordHash,
    role: 'user',
    approved: false,
    photo: null,
  });

  broadcastUsersUpdated();
  res.json({ message: 'Cadastro enviado para aprovação' });
}));

app.post('/api/login', loginRateLimiter, asyncHandler(async (req, res) => {
  const username = sanitizeText(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  const normalized = normalizeUsername(username);
  const user = await getUserByUsernameLower(normalized);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const passwordMatches = user.passwordHash
    ? bcrypt.compareSync(password, user.passwordHash)
    : false;

  if (!passwordMatches) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  if (!user.approved) {
    return res.status(403).json({ error: 'Usuário pendente de aprovação' });
  }

  const token = createSessionToken(user);
  setSessionCookie(res, token);

  res.json({
    message: 'Login bem-sucedido',
    userId: user.id,
    username: user.username,
    role: user.role,
    photo: toPublicPath(user.photo),
  });
}));

app.get('/api/session', authMiddleware, asyncHandler(async (req, res) => {
  const user = await getUserById(req.user.id);
  if (!user || !user.approved) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
  }
  res.json({
    userId: user.id,
    username: user.username,
    role: user.role,
    photo: toPublicPath(user.photo),
  });
}));

app.post('/api/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ message: 'Logout realizado' });
});

app.get('/api/users/pending', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const users = await listUsers({ approved: false });
  res.json(users.map(sanitizeUserForResponse));
}));

app.get('/api/users', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const users = await listUsers();
  res.json(users.map(sanitizeUserForResponse));
}));

app.post('/api/users/:id/approve', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const updated = await updateUserApproval(req.params.id, true);
  if (!updated) return res.status(404).json({ error: 'Usuário não encontrado' });
  broadcastUsersUpdated();
  res.json({ message: 'Usuário aprovado' });
}));

app.delete('/api/users/:id', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const deleted = await deleteUserById(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (deleted.photo) removeStoredFile(deleted.photo);
  broadcastUsersUpdated();
  res.json({ message: 'Usuário excluído' });
}));

app.put('/api/users/:id/photo', authMiddleware, userUpload.single('photo'), asyncHandler(async (req, res) => {
  const { remove } = req.body;
  const userId = req.params.id;
  const target = await getUserById(userId);
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito' });
  }

  if (remove === 'true') {
    if (target.photo) removeStoredFile(target.photo);
    await updateUserPhoto(userId, null);
    broadcastUsersUpdated();
    broadcastUserPhotoUpdated({ id: userId, photo: null });
    return res.json({ message: 'Foto removida', photo: null });
  }

  const newPhotoPath = getStoredFilePath(req.file);
  if (!newPhotoPath) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  }

  if (target.photo) removeStoredFile(target.photo);
  await updateUserPhoto(userId, newPhotoPath);
  broadcastUsersUpdated();
  const publicPath = toPublicPath(newPhotoPath);
  broadcastUserPhotoUpdated({ id: userId, photo: publicPath });
  res.json({ message: 'Foto atualizada', photo: publicPath });
}));

app.get('/api/users/:id/photo', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito' });
  }
  const user = await getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ photo: toPublicPath(user.photo) });
}));

app.get('/api/estoque', authMiddleware, asyncHandler(async (req, res) => {
  const estoque = await listInventory();
  const response = estoque.map(item => ({
    ...item,
    image: item?.image ? toPublicPath(item.image) : null,
  }));
  res.json(response);
}));

app.get('/api/movimentacoes', authMiddleware, asyncHandler(async (req, res) => {
  const logs = await listMovimentacoes({ start: req.query.start, end: req.query.end });
  res.json(logs);
}));

app.post('/api/estoque', authMiddleware, productUpload.single('image'), asyncHandler(async (req, res) => {
  const uploadedImagePath = getStoredFilePath(req.file);
  const produto = (req.body.produto || '').trim();
  const tipo = (req.body.tipo || '').trim();
  const lote = (req.body.lote || '').trim();
  const quantidadeBruta = req.body.quantidade;
  const validade = req.body.validade || null;
  const usuario = req.user?.username;
  const custoBruto = req.body.custo;

  if (!produto || quantidadeBruta === undefined) {
    if (uploadedImagePath) removeStoredFile(uploadedImagePath);
    return res.status(400).json({ error: 'Produto e quantidade são obrigatórios' });
  }
  if (custoBruto === undefined || custoBruto === null || custoBruto === '') {
    if (uploadedImagePath) removeStoredFile(uploadedImagePath);
    return res.status(400).json({ error: 'Custo é obrigatório' });
  }

  const custoSanitizado = sanitizeCost(custoBruto);
  if (custoSanitizado === null) {
    if (uploadedImagePath) removeStoredFile(uploadedImagePath);
    return res.status(400).json({ error: 'Custo inválido' });
  }

  const quantidadeNumerica = Number.parseInt(quantidadeBruta, 10);
  const quantidadeFinal = Number.isNaN(quantidadeNumerica) ? 0 : quantidadeNumerica;
  const id = uuidv4();
  const imagePath = uploadedImagePath;
  let imageBuffer = null;

  if (req.file) {
    try {
      imageBuffer = await readUploadedFileBuffer(req.file);
    } catch (error) {
      if (uploadedImagePath) removeStoredFile(uploadedImagePath);
      return res.status(500).json({ error: 'Falha ao processar a imagem enviada' });
    }
  }

  await insertInventoryItem({
    id,
    produto,
    tipo: tipo || null,
    lote: lote || null,
    quantidade: quantidadeFinal,
    validade: validade || null,
    custo: custoSanitizado,
    image: imagePath,
    imageData: imageBuffer,
  });

  await insertMovimentacao({
    id: uuidv4(),
    produtoId: id,
    produto,
    tipo: 'adicao',
    quantidade: quantidadeFinal,
    quantidadeAnterior: 0,
    quantidadeAtual: quantidadeFinal,
    motivo: null,
    data: new Date(),
    usuario: usuario || 'desconhecido'
  });

  broadcastDataUpdated();
  res.json({
    message: 'Produto adicionado com sucesso',
    id,
    image: toPublicPath(imagePath)
  });
}));

app.put('/api/estoque/:id', authMiddleware, productUpload.single('image'), asyncHandler(async (req, res) => {
  const itemId = req.params.id;
  const usuario = req.user?.username;
  const uploadedImagePath = getStoredFilePath(req.file);
  const atual = await getInventoryItemById(itemId);
  if (!atual) {
    if (uploadedImagePath) removeStoredFile(uploadedImagePath);
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  const quantidadeBruta = req.body.quantidade;
  let novaQtd = atual.quantidade;
  if (quantidadeBruta !== undefined) {
    const parsedQtd = Number.parseInt(quantidadeBruta, 10);
    if (!Number.isNaN(parsedQtd)) {
      novaQtd = parsedQtd;
    }
  }
  const hasCusto = Object.prototype.hasOwnProperty.call(req.body, 'custo');
  let custoAtualizado = atual.custo;
  if (hasCusto) {
    const custoSanitizado = sanitizeCost(req.body.custo);
    if (custoSanitizado === null) {
      if (uploadedImagePath) removeStoredFile(uploadedImagePath);
      return res.status(400).json({ error: 'Custo inválido' });
    }
    custoAtualizado = custoSanitizado;
  }

  let imagemAtualizada = atual.image;
  let imagemDadosAtualizados = atual.imageData ?? null;
  if (req.body.removeImage === 'true') {
    if (uploadedImagePath) removeStoredFile(uploadedImagePath);
    if (atual.image) removeStoredFile(atual.image);
    imagemAtualizada = null;
    imagemDadosAtualizados = null;
  } else if (uploadedImagePath) {
    let novoBuffer;
    try {
      novoBuffer = await readUploadedFileBuffer(req.file);
    } catch (error) {
      removeStoredFile(uploadedImagePath);
      return res.status(500).json({ error: 'Falha ao processar a imagem enviada' });
    }
    if (atual.image) removeStoredFile(atual.image);
    imagemAtualizada = uploadedImagePath;
    imagemDadosAtualizados = novoBuffer;
  }

  const produtoAtualizado = req.body.produto ? req.body.produto.trim() : atual.produto;
  const tipoAtualizado = req.body.tipo ? req.body.tipo.trim() : atual.tipo;
  const loteAtualizado = req.body.lote ? req.body.lote.trim() : atual.lote;
  const validadeAtualizada = req.body.validade !== undefined ? (req.body.validade || null) : atual.validade;

  await updateInventoryItem({
    id: itemId,
    produto: produtoAtualizado,
    tipo: tipoAtualizado || null,
    lote: loteAtualizado || null,
    quantidade: novaQtd,
    validade: validadeAtualizada,
    custo: hasCusto ? custoAtualizado : atual.custo,
    image: imagemAtualizada,
    imageData: imagemDadosAtualizados,
  });

  const diff = novaQtd - atual.quantidade;
  await insertMovimentacao({
    id: uuidv4(),
    produtoId: itemId,
    produto: produtoAtualizado,
    tipo: diff === 0 ? 'edicao' : diff > 0 ? 'entrada' : 'saida',
    quantidade: diff,
    quantidadeAnterior: atual.quantidade,
    quantidadeAtual: novaQtd,
    motivo: null,
    data: new Date(),
    usuario: usuario || 'desconhecido'
  });

  broadcastDataUpdated();
  res.json({
    message: 'Produto atualizado com sucesso',
    image: toPublicPath(imagemAtualizada)
  });
}));

app.delete('/api/estoque/:id', authMiddleware, asyncHandler(async (req, res) => {
  const itemId = req.params.id;
  const { motivo } = req.body;
  if (!motivo) {
    return res.status(400).json({ error: 'Motivo é obrigatório' });
  }

  const removed = await deleteInventoryItemById(itemId);
  if (!removed) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  if (removed?.image) {
    removeStoredFile(removed.image);
  }

  await insertMovimentacao({
    id: uuidv4(),
    produtoId: removed.id,
    produto: removed.produto,
    tipo: 'exclusao',
    quantidade: removed.quantidade,
    quantidadeAnterior: removed.quantidade,
    quantidadeAtual: 0,
    motivo,
    data: new Date(),
    usuario: req.user?.username || 'desconhecido'
  });

  broadcastDataUpdated();
  res.json({ message: 'Produto excluído com sucesso!' });
}));

app.get('/api/report/summary', authMiddleware, asyncHandler(async (req, res) => {
  const logs = await listMovimentacoes();
  const sumProd = {};
  const sumDay = {};
  for (const m of logs) {
    const prod = m.produto || 'desconhecido';
    if (!sumProd[prod]) sumProd[prod] = { entradas: 0, saidas: 0 };
    const q = Math.abs(Number.parseInt(m.quantidade, 10) || 0);
    if (m.tipo === 'adicao' || m.tipo === 'entrada') sumProd[prod].entradas += q;
    else if (m.tipo === 'saida' || m.tipo === 'exclusao') sumProd[prod].saidas += q;
    if (m.data) {
      const d = m.data.slice(0, 10);
      sumDay[d] = (sumDay[d] || 0) + q;
    }
  }
  res.json({ porProduto: sumProd, porDia: sumDay });
}));

app.get('/api/report/estoque', authMiddleware, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT produto, SUM(quantidade)::INT AS total FROM inventory GROUP BY produto');
  const resumo = {};
  for (const row of rows) {
    const prod = row.produto || 'desconhecido';
    resumo[prod] = Number(row.total) || 0;
  }
  res.json(resumo);
}));

app.get('/api/movimentacoes/csv', authMiddleware, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, produto_id, produto, tipo, quantidade, quantidade_anterior, quantidade_atual, motivo, data, usuario
       FROM movimentacoes
      ORDER BY data ASC, id ASC`
  );
  const header = [
    'id',
    'produtoId',
    'produto',
    'tipo',
    'quantidade',
    'quantidadeAnterior',
    'quantidadeAtual',
    'motivo',
    'data',
    'usuario'
  ];
  const rowsCsv = rows.map(row => [
    row.id,
    row.produto_id,
    row.produto,
    row.tipo,
    row.quantidade,
    row.quantidade_anterior ?? '',
    row.quantidade_atual ?? '',
    row.motivo ?? '',
    (row.data instanceof Date ? row.data.toISOString() : row.data),
    row.usuario
  ].join(','));
  const csv = `${header.join(',')}` + '\n' + rowsCsv.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="movimentacoes.csv"');
  res.send(csv);
}));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `Arquivo de imagem excede o limite de ${MAX_UPLOAD_SIZE_MB_LABEL} MB.` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: `Arquivo de imagem excede o limite de ${MAX_UPLOAD_SIZE_MB_LABEL} MB.` });
  }
  if (err?.statusCode) {
    return res.status(err.statusCode).json({ error: err.message || 'Operação não permitida.' });
  }
  if (typeof err.message === 'string' && err.message.toLowerCase().includes('imagem')) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
});

app.get('*', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Recurso não encontrado' });
  }
  return sendFileWithHeaders(res, path.join(__dirname, 'index.html'), HTML_CACHE_CONTROL);
});

const PORT = process.env.PORT || 3000;

let shuttingDown = false;

const closeHttpServer = () => new Promise(resolve => {
  if (!server.listening) {
    resolve();
    return;
  }
  server.close(err => {
    if (err) {
      console.error('Erro ao encerrar o servidor HTTP:', err);
    }
    resolve();
  });
});

const shutdown = async signal => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Sinal ${signal} recebido. Iniciando desligamento gracioso...`);
  const timeout = setTimeout(() => {
    console.warn('Tempo limite ao encerrar. Forçando finalização.');
    process.exit(1);
  }, 10000);
  timeout.unref();

  try {
    await Promise.allSettled([
      closeHttpServer(),
      pool.end().catch(error => {
        console.error('Erro ao encerrar o pool de conexões:', error);
      })
    ]);
  } finally {
    clearTimeout(timeout);
    process.exit(0);
  }
};

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    shutdown(signal).catch(error => {
      console.error('Falha ao encerrar aplicação:', error);
      process.exit(1);
    });
  });
}

const startServer = async () => {
  await initializeDatabase();
  server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
};

startServer().catch(error => {
  console.error('Não foi possível iniciar o servidor:', error);
  process.exit(1);
});

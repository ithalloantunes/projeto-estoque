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
import { sanitizeClosurePayload, buildClosureResponse, diffClosures } from './lib/cashier-closures.js';
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
  normalizeOrigin('https://acai-da-barra.onrender.com')
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

const normalizeConnectionString = value => sanitizeText(value) || '';

const primaryConnectionCandidates = [];
const fallbackConnectionCandidates = [];
const registeredConnectionStrings = new Set();

const DEFAULT_DATABASE_URL = 'postgresql://acai:ETShntq0lGuqd1z35WNdCBVRQEfEPF9P@dpg-d3mkd5juibrs738v4fbg-a/acai';
const DEFAULT_DATABASE_URL_EXTERNAL = 'postgresql://acai:ETShntq0lGuqd1z35WNdCBVRQEfEPF9P@dpg-d3mkd5juibrs738v4fbg-a.oregon-postgres.render.com/acai';

const shouldUseInMemoryDbFallback = () => {
  if (isProduction) {
    return false;
  }
  const preference = sanitizeText(process.env.USE_IN_MEMORY_DB ?? process.env.ENABLE_IN_MEMORY_DB);
  return preference !== 'disable';
};

const registerConnectionCandidate = (label, value, type) => {
  const normalized = normalizeConnectionString(value);
  if (!normalized || registeredConnectionStrings.has(normalized)) {
    return;
  }
  registeredConnectionStrings.add(normalized);
  const candidate = { label, value: normalized, type };
  if (type === 'fallback') {
    fallbackConnectionCandidates.push(candidate);
  } else {
    primaryConnectionCandidates.push(candidate);
  }
};

registerConnectionCandidate('DATABASE_URL', process.env.DATABASE_URL, 'primary');
registerConnectionCandidate('POSTGRES_URL', process.env.POSTGRES_URL, 'primary');
registerConnectionCandidate('DEFAULT_DATABASE_URL', DEFAULT_DATABASE_URL, 'primary');
registerConnectionCandidate('DATABASE_URL_EXTERNAL', process.env.DATABASE_URL_EXTERNAL, 'fallback');
registerConnectionCandidate('RENDER_EXTERNAL_DATABASE_URL', process.env.RENDER_EXTERNAL_DATABASE_URL, 'fallback');
registerConnectionCandidate('DEFAULT_DATABASE_URL_EXTERNAL', DEFAULT_DATABASE_URL_EXTERNAL, 'fallback');

let pool = null;
let inMemoryPool = null;

const getSslConfigForCandidate = candidate => {
  const sslPreferenceRaw = sanitizeText(process.env.DATABASE_SSL);
  const sslPreference = sslPreferenceRaw ? sslPreferenceRaw.toLowerCase() : '';
  const host = tryParseHost(candidate.value);
  const isRenderHost = host?.endsWith('.render.com');
  const label = formatConnectionLabel(candidate);

  if (sslPreference === 'disable') {
    if (isRenderHost) {
      console.warn(
        `DATABASE_SSL=disable foi definido enquanto ${label} aponta para um host do Render (${host}). ` +
        'Essa configuração costuma falhar, pois o Render exige TLS.'
      );
    }
    return false;
  }

  if (sslPreference === 'require') {
    return { rejectUnauthorized: false };
  }

  if (isRenderHost) {
    if (!sslPreference) {
      console.info(
        `Host do Render detectado em ${label}. SSL habilitado automaticamente (rejectUnauthorized: false).`
      );
    }
    return { rejectUnauthorized: false };
  }

  return isProduction ? { rejectUnauthorized: false } : false;
};

const createPoolInstance = (connectionString, sslConfig) => {
  const instance = new Pool({
    connectionString,
    max: Number.parseInt(process.env.PGPOOL_MAX || '10', 10),
    ssl: sslConfig,
  });
  instance.on('error', error => {
    console.error('Erro inesperado na conexão com o banco de dados:', error);
  });
  return instance;
};

const loadSchemaForInMemoryDb = async dbInstance => {
  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
  const rawSchema = await fs.promises.readFile(schemaPath, 'utf8');
  const sanitizedSchema = rawSchema.replace(/\s+TABLESPACE\s+\w+/gi, '');
  dbInstance.public.none(sanitizedSchema);
};

const createInMemoryPool = async () => {
  if (inMemoryPool) {
    return inMemoryPool;
  }

  let newDbFactory;
  try {
    ({ newDb: newDbFactory } = await import('pg-mem'));
  } catch (error) {
    const message = 'pg-mem não está disponível. Instale-o (npm install --save-dev pg-mem) ou defina USE_IN_MEMORY_DB=disable.';
    console.error(message, error);
    throw new Error(message, { cause: error });
  }

  const dbInstance = newDbFactory({ autoCreateForeignKeyIndices: true });

  try {
    await loadSchemaForInMemoryDb(dbInstance);
  } catch (error) {
    console.error('Falha ao carregar o schema SQL para o banco em memória:', error);
    throw error;
  }

  const { Pool: MemoryPool } = dbInstance.adapters.createPg();
  const memoryPoolInstance = new MemoryPool();
  memoryPoolInstance.on('error', error => {
    console.error('Erro inesperado na conexão com o banco de dados em memória:', error);
  });

  inMemoryPool = memoryPoolInstance;
  console.warn('Banco de dados em memória inicializado. Os dados serão perdidos ao encerrar o processo.');
  return inMemoryPool;
};

const closePool = async () => {
  if (!pool) return;
  const current = pool;
  pool = null;
  try {
    await current.end();
  } catch (error) {
    console.error('Erro ao encerrar o pool de conexões:', error);
  }
  if (current === inMemoryPool) {
    inMemoryPool = null;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Pool de conexões não inicializado.');
  }
  return pool;
};

const query = (text, params = []) => getPool().query(text, params);

const tryParseHost = connectionString => {
  try {
    return new URL(connectionString).hostname;
  } catch (error) {
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
  if (!normalized.includes('.')) {
    return true;
  }
  return false;
};

const formatConnectionLabel = candidate => {
  if (!candidate) return 'DATABASE_URL';
  return candidate.label || 'DATABASE_URL';
};

const ensureDatabaseConnection = async () => {
  if (pool) return pool;

  const connectionCandidates = [
    ...primaryConnectionCandidates,
    ...fallbackConnectionCandidates
  ];

  if (!connectionCandidates.length) {
    console.error('A variável de ambiente DATABASE_URL é obrigatória para iniciar o servidor.');
    process.exit(1);
  }

  let lastError = null;

  for (const candidate of connectionCandidates) {
    const instance = createPoolInstance(candidate.value, getSslConfigForCandidate(candidate));
    const host = tryParseHost(candidate.value);

    if (candidate.type === 'fallback') {
      console.warn(`Tentando conexão alternativa definida em ${formatConnectionLabel(candidate)}...`);
    }

    try {
      await instance.query('SELECT 1');
      pool = instance;
      const activeConnectionLabel = formatConnectionLabel(candidate);

      if (!isProduction && host && isPrivateHost(host)) {
        console.warn(
          `Aviso: a URL de conexão (${activeConnectionLabel}) usa o host privado "${host}". ` +
          'Se estiver executando fora do Render, utilize uma URL externa (`DATABASE_URL_EXTERNAL` ou `RENDER_EXTERNAL_DATABASE_URL`) ou um banco acessível localmente.'
        );
      }

      if (candidate.type === 'fallback') {
        console.warn(`Conexão principal indisponível. Utilizando ${activeConnectionLabel}.`);
      }

      return pool;
    } catch (error) {
      await instance.end().catch(() => {});

      if (candidate.type === 'primary' && fallbackConnectionCandidates.length) {
        if (host && isPrivateHost(host)) {
          console.warn(
            `Falha ao conectar ao host interno "${host}" definido em ${formatConnectionLabel(candidate)}. ` +
            'Tentando utilizar as variáveis de fallback...'
          );
        } else {
          console.warn(`Falha ao conectar usando ${formatConnectionLabel(candidate)}: ${error.message}`);
        }
      } else {
        console.warn(`Falha ao conectar usando ${formatConnectionLabel(candidate)}: ${error.message}`);
      }

      lastError = { candidate, error };
    }
  }

  if (shouldUseInMemoryDbFallback()) {
    try {
      console.warn('Não foi possível conectar ao PostgreSQL. Iniciando banco de dados em memória (pg-mem)...');
      pool = await createInMemoryPool();
      return pool;
    } catch (fallbackError) {
      console.error('Falha ao inicializar o banco de dados em memória:', fallbackError);
      if (lastError?.error) {
        fallbackError.cause = lastError.error;
      }
      throw fallbackError;
    }
  }

  if (lastError) {
    const { candidate, error } = lastError;
    const host = tryParseHost(candidate?.value);
    const isPrimaryPrivateHost = host && isPrivateHost(host) && !isProduction && candidate?.type === 'primary';
    if (isPrimaryPrivateHost && (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND')) {
      const baseMessage =
        error?.code === 'ENOTFOUND'
          ? `Não foi possível resolver o host interno "${host}" definido em ${formatConnectionLabel(candidate)}.`
          : `Não foi possível conectar ao host interno "${host}" definido em ${formatConnectionLabel(candidate)}.`;
      const message =
        `${baseMessage} Esse endereço costuma estar disponível apenas dentro da infraestrutura do Render. ` +
        'Defina `DATABASE_URL_EXTERNAL` (ou `RENDER_EXTERNAL_DATABASE_URL`) com a URL externa do banco ou utilize uma instância local do PostgreSQL.';
      throw new Error(message, { cause: error });
    }

    throw error;
  }

  throw new Error('Não foi possível estabelecer conexão com o banco de dados.');
};
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

const CASHIER_SETTINGS_ID = 'default';

const DEFAULT_CASHIER_SETTINGS = Object.freeze({
  logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTFeOaW0WW5vagcJW_zcy81BcChyOYwE3Twq5ThnJNoIqH82WF0bMzrvEhi0V9dWdG16xG9Fi9ns1lm3KVqONo-f98aG3k8IyZMKHVEZSMBif3fJDbvDAjhWhCCi9jo74-0mopopZTFqwdyiLKyogWYUevuHfIQT5y43nKqM4g5sLL-UE-bmgk6yVxEmLAhAHqT7yf_uCn7OJt7HNqfIG-Wzyx1ug39W0rU8R6Z9j8z6Lh9lsnOPiMEX_XIYLvzBXW7hauQ0Gn8lw',
  cashLimit: '',
  categories: [
    { id: 'category-1', name: 'Vendas', type: 'Receita', status: 'Ativo' },
    { id: 'category-2', name: 'Despesas Operacionais', type: 'Despesa', status: 'Ativo' },
    { id: 'category-3', name: 'Reforços', type: 'Receita', status: 'Ativo' },
  ],
  paymentMethods: [
    { id: 'payment-1', name: 'Dinheiro', status: 'Ativo' },
    { id: 'payment-2', name: 'Cartão de Crédito', status: 'Ativo' },
    { id: 'payment-3', name: 'Pagamento Móvel', status: 'Inativo' },
  ],
});

const cloneDefaultCashierSettings = () => ({
  logo: DEFAULT_CASHIER_SETTINGS.logo,
  cashLimit: DEFAULT_CASHIER_SETTINGS.cashLimit,
  categories: DEFAULT_CASHIER_SETTINGS.categories.map(category => ({ ...category })),
  paymentMethods: DEFAULT_CASHIER_SETTINGS.paymentMethods.map(method => ({ ...method })),
});

const normalizeCashierCategory = category => {
  if (!category || typeof category !== 'object') return null;
  const name = sanitizeText(category.name);
  if (!name) return null;
  const id = sanitizeText(category.id) || `category-${uuidv4()}`;
  const type = sanitizeText(category.type) === 'Despesa' ? 'Despesa' : 'Receita';
  const status = sanitizeText(category.status) === 'Inativo' ? 'Inativo' : 'Ativo';
  return { id, name, type, status };
};

const normalizeCashierPaymentMethod = method => {
  if (!method || typeof method !== 'object') return null;
  const name = sanitizeText(method.name);
  if (!name) return null;
  const id = sanitizeText(method.id) || `payment-${uuidv4()}`;
  const status = sanitizeText(method.status) === 'Inativo' ? 'Inativo' : 'Ativo';
  return { id, name, status };
};

const mergeCashierSettings = settings => {
  const base = cloneDefaultCashierSettings();
  if (settings.logo) {
    base.logo = sanitizeText(settings.logo) || base.logo;
  }
  if (settings.cashLimit !== undefined && settings.cashLimit !== null) {
    base.cashLimit = sanitizeText(settings.cashLimit);
  }
  if (Array.isArray(settings.categories)) {
    const normalizedCategories = settings.categories
      .map(normalizeCashierCategory)
      .filter(Boolean);
    if (normalizedCategories.length) {
      base.categories = normalizedCategories;
    }
  }
  if (Array.isArray(settings.paymentMethods)) {
    const normalizedMethods = settings.paymentMethods
      .map(normalizeCashierPaymentMethod)
      .filter(Boolean);
    if (normalizedMethods.length) {
      base.paymentMethods = normalizedMethods;
    }
  }
  return base;
};

const mapCashierSettingsRow = row => mergeCashierSettings({
  logo: row.logo,
  cashLimit: row.cash_limit,
  categories: row.categories,
  paymentMethods: row.payment_methods,
});

const mapCashierMovementRow = row => ({
  id: row.id,
  userId: row.user_id,
  data: row.data instanceof Date ? row.data.toISOString() : row.data,
  tipo: row.tipo,
  categoria: row.categoria,
  valor: row.valor === null || row.valor === undefined ? 0 : Number(row.valor),
  funcionario: row.funcionario,
  observacoes: row.observacoes,
  formaPagamento: row.forma_pagamento,
  criadoEm: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
});

const formatDateOnly = input => {
  if (!input) return null;
  if (input instanceof Date) {
    const year = input.getFullYear();
    const month = `${input.getMonth() + 1}`.padStart(2, '0');
    const day = `${input.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = sanitizeText(input);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toNumberFromDb = value => {
  if (value === null || value === undefined) return 0;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
};

const toIntegerFromDb = value => {
  if (value === null || value === undefined) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const CASHIER_CLOSURE_COLUMNS = `
  id,
  data_operacao,
  funcionario_id,
  funcionario_nome,
  dinheiro_sistema,
  credito_sistema,
  debito_sistema,
  credito_maquina,
  debito_maquina,
  pag_online,
  pix,
  total_sistema,
  total_caixa_dinheiro,
  abertura,
  reforco,
  gastos,
  valor_para_deposito,
  variavel_caixa,
  entrega_cartao,
  picoles_sist,
  informacoes,
  criado_por,
  atualizado_por,
  created_at,
  updated_at
`;

const toClosureDomain = row => ({
  id: row.id,
  dataOperacao: formatDateOnly(row.data_operacao),
  funcionarioId: row.funcionario_id,
  funcionarioNome: row.funcionario_nome,
  dinheiroSistema: toNumberFromDb(row.dinheiro_sistema),
  creditoSistema: toNumberFromDb(row.credito_sistema),
  debitoSistema: toNumberFromDb(row.debito_sistema),
  creditoMaquina: toNumberFromDb(row.credito_maquina),
  debitoMaquina: toNumberFromDb(row.debito_maquina),
  pagOnline: toNumberFromDb(row.pag_online),
  pix: toNumberFromDb(row.pix),
  totalSistema: toNumberFromDb(row.total_sistema),
  totalCaixaDinheiro: toNumberFromDb(row.total_caixa_dinheiro),
  abertura: toNumberFromDb(row.abertura),
  reforco: toNumberFromDb(row.reforco),
  gastos: toNumberFromDb(row.gastos),
  valorParaDeposito: toNumberFromDb(row.valor_para_deposito),
  variavelCaixa: toNumberFromDb(row.variavel_caixa),
  entregaCartao: toIntegerFromDb(row.entrega_cartao),
  picolesSist: toIntegerFromDb(row.picoles_sist),
  informacoes: row.informacoes,
});

const mapCashierClosureRow = row => {
  const domain = toClosureDomain(row);
  const base = buildClosureResponse(domain);
  return {
    ...base,
    funcionarioId: row.funcionario_id,
    criadoPor: row.criado_por,
    atualizadoPor: row.atualizado_por,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
};

const serializeClosureForLog = (closure, dataOperacao) => ({
  dataOperacao: dataOperacao ?? formatDateOnly(closure?.dataOperacao),
  funcionarioNome: closure?.funcionarioNome ?? null,
  dinheiroSistema: closure?.dinheiroSistema ?? 0,
  creditoSistema: closure?.creditoSistema ?? 0,
  debitoSistema: closure?.debitoSistema ?? 0,
  creditoMaquina: closure?.creditoMaquina ?? 0,
  debitoMaquina: closure?.debitoMaquina ?? 0,
  pagOnline: closure?.pagOnline ?? 0,
  pix: closure?.pix ?? 0,
  totalSistema: closure?.totalSistema ?? 0,
  totalCaixaDinheiro: closure?.totalCaixaDinheiro ?? 0,
  abertura: closure?.abertura ?? 0,
  reforco: closure?.reforco ?? 0,
  gastos: closure?.gastos ?? 0,
  valorParaDeposito: closure?.valorParaDeposito ?? 0,
  variavelCaixa: closure?.variavelCaixa ?? 0,
  entregaCartao: closure?.entregaCartao ?? 0,
  picolesSist: closure?.picolesSist ?? 0,
  informacoes: closure?.informacoes ?? null,
});

const getCashierClosureRowById = async id => {
  const { rows } = await query(
    `SELECT ${CASHIER_CLOSURE_COLUMNS}
       FROM cashier_closures
      WHERE id = $1
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

const getCashierClosureRowByDate = async dataOperacao => {
  const { rows } = await query(
    `SELECT ${CASHIER_CLOSURE_COLUMNS}
       FROM cashier_closures
      WHERE data_operacao = $1
      LIMIT 1`,
    [dataOperacao]
  );
  return rows[0] || null;
};

const listCashierClosures = async ({ start, end } = {}) => {
  const clauses = [];
  const params = [];
  if (start) {
    const formatted = formatDateOnly(start);
    if (formatted) {
      clauses.push(`data_operacao >= $${params.length + 1}`);
      params.push(formatted);
    }
  }
  if (end) {
    const formatted = formatDateOnly(end);
    if (formatted) {
      clauses.push(`data_operacao <= $${params.length + 1}`);
      params.push(formatted);
    }
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT ${CASHIER_CLOSURE_COLUMNS}
       FROM cashier_closures
       ${where}
   ORDER BY data_operacao DESC, created_at DESC`,
    params
  );
  return rows.map(mapCashierClosureRow);
};

const insertCashierClosureLog = async ({ closureId, userId, acao, detalhes }) => {
  await query(
    `INSERT INTO cashier_closure_logs (id, closure_id, user_id, acao, detalhes, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
    [uuidv4(), closureId, userId ?? null, acao, JSON.stringify(detalhes ?? {})]
  );
};

const listCashierClosureLogs = async closureId => {
  const { rows } = await query(
    `SELECT id, closure_id, user_id, acao, detalhes, created_at
       FROM cashier_closure_logs
      WHERE closure_id = $1
   ORDER BY created_at DESC, id DESC`,
    [closureId]
  );
  return rows.map(row => ({
    id: row.id,
    closureId: row.closure_id,
    userId: row.user_id,
    acao: row.acao,
    detalhes: row.detalhes,
    criadoEm: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }));
};

const createCashierClosure = async (payload, user) => {
  const sanitized = sanitizeClosurePayload(payload, { defaultFuncionarioNome: sanitizeText(user?.username) });
  const dataOperacao = formatDateOnly(sanitized.dataOperacao);
  if (!dataOperacao) {
    const error = new Error('Data da operação inválida.');
    error.statusCode = 400;
    throw error;
  }
  const existing = await getCashierClosureRowByDate(dataOperacao);
  if (existing) {
    const error = new Error('Já existe um fechamento registrado para esta data.');
    error.statusCode = 409;
    throw error;
  }
  const id = uuidv4();
  const userId = user?.id ?? null;
  const params = [
    id,
    dataOperacao,
    userId,
    sanitized.funcionarioNome,
    sanitized.dinheiroSistema,
    sanitized.creditoSistema,
    sanitized.debitoSistema,
    sanitized.creditoMaquina,
    sanitized.debitoMaquina,
    sanitized.pagOnline,
    sanitized.pix,
    sanitized.totalSistema,
    sanitized.totalCaixaDinheiro,
    sanitized.abertura,
    sanitized.reforco,
    sanitized.gastos,
    sanitized.valorParaDeposito,
    sanitized.variavelCaixa,
    sanitized.entregaCartao,
    sanitized.picolesSist,
    sanitized.informacoes,
    userId,
    userId,
  ];
  const { rows } = await query(
    `INSERT INTO cashier_closures (
       id,
       data_operacao,
       funcionario_id,
       funcionario_nome,
       dinheiro_sistema,
       credito_sistema,
       debito_sistema,
       credito_maquina,
       debito_maquina,
       pag_online,
       pix,
       total_sistema,
       total_caixa_dinheiro,
       abertura,
       reforco,
       gastos,
       valor_para_deposito,
       variavel_caixa,
       entrega_cartao,
       picoles_sist,
     informacoes,
     criado_por,
     atualizado_por,
      created_at,
      updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW()
    )
     RETURNING ${CASHIER_CLOSURE_COLUMNS}`,
    params
  );
  const inserted = rows[0];
  const mapped = mapCashierClosureRow(inserted);
  await insertCashierClosureLog({
    closureId: id,
    userId,
    acao: 'criado',
    detalhes: { novosValores: serializeClosureForLog(sanitized, dataOperacao) },
  });
  return mapped;
};

const updateCashierClosureRecord = async (id, payload, user) => {
  const currentRow = await getCashierClosureRowById(id);
  if (!currentRow) return null;
  const currentDomain = toClosureDomain(currentRow);
  const sanitized = sanitizeClosurePayload(payload, {
    defaultFuncionarioNome: currentDomain.funcionarioNome || sanitizeText(user?.username),
  });
  const dataOperacao = formatDateOnly(sanitized.dataOperacao);
  if (!dataOperacao) {
    const error = new Error('Data da operação inválida.');
    error.statusCode = 400;
    throw error;
  }
  const currentDate = formatDateOnly(currentRow.data_operacao);
  if (dataOperacao !== currentDate) {
    const existing = await getCashierClosureRowByDate(dataOperacao);
    if (existing && existing.id !== id) {
      const error = new Error('Já existe um fechamento registrado para esta data.');
      error.statusCode = 409;
      throw error;
    }
  }
  const userId = user?.id ?? null;
  const params = [
    id,
    dataOperacao,
    sanitized.funcionarioNome,
    sanitized.dinheiroSistema,
    sanitized.creditoSistema,
    sanitized.debitoSistema,
    sanitized.creditoMaquina,
    sanitized.debitoMaquina,
    sanitized.pagOnline,
    sanitized.pix,
    sanitized.totalSistema,
    sanitized.totalCaixaDinheiro,
    sanitized.abertura,
    sanitized.reforco,
    sanitized.gastos,
    sanitized.valorParaDeposito,
    sanitized.variavelCaixa,
    sanitized.entregaCartao,
    sanitized.picolesSist,
    sanitized.informacoes,
    userId,
  ];
  const { rows } = await query(
    `UPDATE cashier_closures
        SET data_operacao = $2,
            funcionario_nome = $3,
            dinheiro_sistema = $4,
            credito_sistema = $5,
            debito_sistema = $6,
            credito_maquina = $7,
            debito_maquina = $8,
            pag_online = $9,
            pix = $10,
            total_sistema = $11,
            total_caixa_dinheiro = $12,
            abertura = $13,
            reforco = $14,
            gastos = $15,
            valor_para_deposito = $16,
            variavel_caixa = $17,
            entrega_cartao = $18,
            picoles_sist = $19,
            informacoes = $20,
            atualizado_por = $21,
            updated_at = NOW()
      WHERE id = $1
      RETURNING ${CASHIER_CLOSURE_COLUMNS}`,
    params
  );
  const updatedRow = rows[0];
  const mapped = mapCashierClosureRow(updatedRow);
  const diff = diffClosures(currentDomain, toClosureDomain(updatedRow));
  if (Object.keys(diff).length) {
    await insertCashierClosureLog({
      closureId: id,
      userId,
      acao: 'atualizado',
      detalhes: diff,
    });
  }
  return mapped;
};

const ensureDefaultCashierSettingsRow = async () => {
  await query(
    `INSERT INTO cashier_settings (id, logo, cash_limit, categories, payment_methods, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      CASHIER_SETTINGS_ID,
      DEFAULT_CASHIER_SETTINGS.logo,
      DEFAULT_CASHIER_SETTINGS.cashLimit,
      JSON.stringify(DEFAULT_CASHIER_SETTINGS.categories),
      JSON.stringify(DEFAULT_CASHIER_SETTINGS.paymentMethods),
    ]
  );
};

const getCashierSettings = async () => {
  await ensureDefaultCashierSettingsRow();
  const { rows } = await query(
    'SELECT id, logo, cash_limit, categories, payment_methods FROM cashier_settings WHERE id = $1 LIMIT 1',
    [CASHIER_SETTINGS_ID]
  );
  if (!rows[0]) {
    return cloneDefaultCashierSettings();
  }
  return mapCashierSettingsRow(rows[0]);
};

const updateCashierSettings = async settings => {
  await ensureDefaultCashierSettingsRow();
  const merged = mergeCashierSettings(settings);
  await query(
    `UPDATE cashier_settings
        SET logo = $2,
            cash_limit = $3,
            categories = $4::jsonb,
            payment_methods = $5::jsonb,
            updated_at = NOW()
      WHERE id = $1`,
    [
      CASHIER_SETTINGS_ID,
      merged.logo,
      merged.cashLimit,
      JSON.stringify(merged.categories),
      JSON.stringify(merged.paymentMethods),
    ]
  );
  return merged;
};

const listCashierMovements = async () => {
  const { rows } = await query(
    `SELECT id, user_id, data, tipo, categoria, valor, funcionario, observacoes, forma_pagamento, created_at
       FROM cashier_movements
   ORDER BY data DESC, created_at DESC`
  );
  return rows.map(mapCashierMovementRow);
};

const insertCashierMovement = async movement => {
  const id = uuidv4();
  const timestamp = movement.data ? new Date(movement.data) : new Date();
  await query(
    `INSERT INTO cashier_movements (id, user_id, data, tipo, categoria, valor, funcionario, observacoes, forma_pagamento, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      id,
      movement.userId ?? null,
      timestamp,
      movement.tipo,
      movement.categoria,
      movement.valor,
      movement.funcionario,
      movement.observacoes,
      movement.formaPagamento,
    ]
  );
  const { rows } = await query(
    `SELECT id, user_id, data, tipo, categoria, valor, funcionario, observacoes, forma_pagamento, created_at
       FROM cashier_movements
      WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ? mapCashierMovementRow(rows[0]) : null;
};

const sanitizeCashierMovementPayload = (payload, user) => {
  const tipo = sanitizeText(payload?.tipo) || 'Entrada';
  const categoria = sanitizeText(payload?.categoria);
  if (!categoria) {
    const error = new Error('Categoria inválida');
    error.statusCode = 400;
    throw error;
  }
  const rawValue = Number.parseFloat(payload?.valor);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    const error = new Error('Valor inválido');
    error.statusCode = 400;
    throw error;
  }
  const valor = Math.round(Math.abs(rawValue) * 100) / 100;
  const funcionario = sanitizeText(payload?.funcionario) || sanitizeText(user?.username) || 'Equipe';
  const observacoes = sanitizeText(payload?.observacoes);
  const formaPagamento = sanitizeText(payload?.formaPagamento) || 'Dinheiro';
  const dataRaw = sanitizeText(payload?.data);
  const parsedDate = dataRaw ? new Date(dataRaw) : new Date();
  const data = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  return {
    userId: user?.id ?? null,
    tipo,
    categoria,
    valor,
    funcionario,
    observacoes: observacoes || null,
    formaPagamento,
    data: data.toISOString(),
  };
};

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
      photo TEXT,
      CONSTRAINT users_username_unique UNIQUE (username),
      CONSTRAINT users_role_check CHECK (role IN ('admin', 'user')),
      CONSTRAINT users_username_format CHECK (char_length(username) >= 3),
      CONSTRAINT users_username_lower_format CHECK (username_lower = lower(username))
    ) TABLESPACE pg_default
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id UUID PRIMARY KEY,
      produto TEXT NOT NULL,
      tipo TEXT,
      lote TEXT,
      quantidade INTEGER NOT NULL CHECK (quantidade >= 0),
      validade DATE,
      custo NUMERIC(12,2) NOT NULL CHECK (custo >= 0),
      image TEXT,
      image_data BYTEA,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    ) TABLESPACE pg_default
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id UUID PRIMARY KEY,
      produto_id UUID,
      produto TEXT NOT NULL,
      tipo TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      quantidade_anterior INTEGER NOT NULL CHECK (quantidade_anterior >= 0),
      quantidade_atual INTEGER NOT NULL CHECK (quantidade_atual >= 0),
      motivo TEXT,
      data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      usuario TEXT NOT NULL DEFAULT 'desconhecido',
      CONSTRAINT movimentacoes_produto_fk FOREIGN KEY (produto_id) REFERENCES inventory(id) ON DELETE SET NULL,
      CONSTRAINT movimentacoes_tipo_check CHECK (tipo IN ('adicao', 'entrada', 'saida', 'edicao', 'exclusao')),
      CONSTRAINT movimentacoes_quantidade_check CHECK (
        (tipo = 'entrada' AND quantidade > 0) OR
        (tipo = 'saida' AND quantidade < 0) OR
        (tipo = 'edicao' AND quantidade = 0) OR
        (tipo IN ('adicao', 'exclusao') AND quantidade >= 0)
      ),
      CONSTRAINT movimentacoes_produto_nome CHECK (char_length(produto) > 0)
    ) TABLESPACE pg_default
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cashier_settings (
      id TEXT PRIMARY KEY,
      logo TEXT,
      cash_limit TEXT,
      categories JSONB NOT NULL DEFAULT '[]'::jsonb,
      payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    ) TABLESPACE pg_default
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cashier_movements (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      tipo TEXT NOT NULL,
      categoria TEXT NOT NULL,
      valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
      funcionario TEXT NOT NULL,
      observacoes TEXT,
      forma_pagamento TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    ) TABLESPACE pg_default
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cashier_closures (
      id UUID PRIMARY KEY,
      data_operacao DATE NOT NULL UNIQUE,
      funcionario_id UUID REFERENCES users(id) ON DELETE SET NULL,
      funcionario_nome TEXT,
      dinheiro_sistema NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (dinheiro_sistema >= 0),
      credito_sistema NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credito_sistema >= 0),
      debito_sistema NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debito_sistema >= 0),
      credito_maquina NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credito_maquina >= 0),
      debito_maquina NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debito_maquina >= 0),
      pag_online NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pag_online >= 0),
      pix NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pix >= 0),
      total_sistema NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_sistema >= 0),
      total_caixa_dinheiro NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_caixa_dinheiro >= 0),
      abertura NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (abertura >= 0),
      reforco NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reforco >= 0),
      gastos NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gastos >= 0),
      valor_para_deposito NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_para_deposito >= 0),
      variavel_caixa NUMERIC(12,2) NOT NULL,
      entrega_cartao INTEGER NOT NULL DEFAULT 0 CHECK (entrega_cartao >= 0),
      picoles_sist INTEGER NOT NULL DEFAULT 0 CHECK (picoles_sist >= 0),
      informacoes TEXT,
      criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
      atualizado_por UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    ) TABLESPACE pg_default
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cashier_closure_logs (
      id UUID PRIMARY KEY,
      closure_id UUID NOT NULL REFERENCES cashier_closures(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      acao TEXT NOT NULL,
      detalhes JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    ) TABLESPACE pg_default
  `);

  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(username_lower) TABLESPACE pg_default');
  await query('CREATE INDEX IF NOT EXISTS idx_inventory_produto ON inventory(produto) TABLESPACE pg_default');
  await query('CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data) TABLESPACE pg_default');
  await query('CREATE INDEX IF NOT EXISTS idx_cashier_movements_date ON cashier_movements(data DESC, created_at DESC) TABLESPACE pg_default');
  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_cashier_closures_date ON cashier_closures(data_operacao) TABLESPACE pg_default');
  await query('CREATE INDEX IF NOT EXISTS idx_cashier_closures_funcionario ON cashier_closures(funcionario_id) TABLESPACE pg_default');
  await query('CREATE INDEX IF NOT EXISTS idx_cashier_closure_logs_closure ON cashier_closure_logs(closure_id, created_at DESC) TABLESPACE pg_default');

  await seedUsersFromFile();
  await seedInventoryFromFile();
  await ensureDefaultCashierSettingsRow();
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

app.get('/api/cashier/movements', authMiddleware, asyncHandler(async (req, res) => {
  const movements = await listCashierMovements();
  res.json(movements);
}));

app.post('/api/cashier/movements', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const sanitized = sanitizeCashierMovementPayload(req.body ?? {}, req.user);
    const inserted = await insertCashierMovement(sanitized);
    if (!inserted) {
      return res.status(500).json({ error: 'Não foi possível registrar a movimentação.' });
    }
    res.status(201).json(inserted);
  } catch (error) {
    const statusCode = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 400;
    res.status(statusCode).json({ error: error.message || 'Dados inválidos' });
  }
}));

const registerCashierClosureRoutes = basePath => {
  app.get(basePath, authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
    const closures = await listCashierClosures({ start: req.query.de, end: req.query.ate });
    res.json(closures);
  }));

  app.get(`${basePath}/:id`, authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
    const row = await getCashierClosureRowById(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Fechamento não encontrado' });
    }
    res.json(mapCashierClosureRow(row));
  }));

  app.get(`${basePath}/:id/logs`, authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
    const row = await getCashierClosureRowById(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Fechamento não encontrado' });
    }
    const logs = await listCashierClosureLogs(req.params.id);
    res.json(logs);
  }));

  app.post(basePath, authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
    try {
      const closure = await createCashierClosure(req.body ?? {}, req.user);
      res.status(201).json(closure);
    } catch (error) {
      const statusCode = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 400;
      res.status(statusCode).json({ error: error.message || 'Dados inválidos' });
    }
  }));

  app.put(`${basePath}/:id`, authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
    try {
      const updated = await updateCashierClosureRecord(req.params.id, req.body ?? {}, req.user);
      if (!updated) {
        return res.status(404).json({ error: 'Fechamento não encontrado' });
      }
      res.json(updated);
    } catch (error) {
      const statusCode = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 400;
      res.status(statusCode).json({ error: error.message || 'Dados inválidos' });
    }
  }));
};

registerCashierClosureRoutes('/api/cashier/closures');
registerCashierClosureRoutes('/api/fechamentos');

app.get('/api/cashier/settings', authMiddleware, asyncHandler(async (req, res) => {
  const settings = await getCashierSettings();
  res.json(settings);
}));

app.put('/api/cashier/settings', authMiddleware, asyncHandler(async (req, res) => {
  const updated = await updateCashierSettings(req.body ?? {});
  res.json(updated);
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
    produtoId: null,
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
      closePool()
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
  await ensureDatabaseConnection();
  await initializeDatabase();
  server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
};

startServer().catch(error => {
  console.error('Não foi possível iniciar o servidor:', error);
  process.exit(1);
});

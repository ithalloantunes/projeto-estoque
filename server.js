import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import multer from 'multer';
import { Server as SocketIOServer } from 'socket.io';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const allowedOrigins = new Set([
  'https://projeto-estoque-o1x5.onrender.com'
]);

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add('http://localhost:3000');
  allowedOrigins.add('http://127.0.0.1:3000');
}

const SESSION_COOKIE_NAME = 'session';
const JWT_EXPIRATION = '12h';
const BCRYPT_SALT_ROUNDS = 12;

const sanitizeText = value => typeof value === 'string' ? value.trim() : '';
const normalizeUsername = value => sanitizeText(value).toLowerCase();
const sanitizeCost = value => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
};

const connectionString = sanitizeText(process.env.DATABASE_URL) || sanitizeText(process.env.POSTGRES_URL);

if (!connectionString) {
  console.error('A variável de ambiente DATABASE_URL é obrigatória para iniciar o servidor.');
  process.exit(1);
}

const usesSSL = sanitizeText(process.env.DATABASE_SSL) !== 'disable' && process.env.NODE_ENV === 'production';

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

const isOriginAllowed = origin => !origin || allowedOrigins.has(origin);

const app = express();
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  if (req.path.startsWith('/data')) {
    return res.status(404).json({ error: 'Recurso não encontrado' });
  }
  return next();
});
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
  secure: process.env.NODE_ENV === 'production',
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

const productUpload = multer({
  storage: createStorage(productImagesDir),
  fileFilter: imageFileFilter
});

const userUpload = multer({
  storage: createStorage(userImagesDir),
  fileFilter: imageFileFilter
});

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

const mapInventoryRow = row => ({
  id: row.id,
  produto: row.produto,
  tipo: row.tipo,
  lote: row.lote,
  quantidade: Number(row.quantidade) || 0,
  validade: row.validade ? (row.validade instanceof Date ? row.validade.toISOString().slice(0, 10) : row.validade) : null,
  custo: row.custo === null || row.custo === undefined ? null : Number(row.custo),
  image: row.image,
});

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
    'SELECT id, produto, tipo, lote, quantidade, validade, custo, image FROM inventory WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] ? mapInventoryRow(rows[0]) : null;
};

const insertInventoryItem = async item => {
  await query(
    `INSERT INTO inventory (id, produto, tipo, lote, quantidade, validade, custo, image, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [
      item.id,
      item.produto,
      item.tipo,
      item.lote,
      item.quantidade,
      item.validade,
      item.custo,
      item.image,
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
  if (!fs.existsSync(usersFile)) return;
  const { rows } = await query('SELECT COUNT(*)::INT AS count FROM users');
  const currentCount = Number.parseInt(rows[0]?.count ?? '0', 10) || 0;
  if (currentCount > 0) return;
  try {
    const raw = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    for (const entry of raw) {
      const username = sanitizeText(entry.username);
      if (!username) continue;
      const id = entry.id ? sanitizeText(entry.id) : uuidv4();
      const passwordSource = entry.passwordHash || entry.password;
      const passwordHash = passwordSource && passwordSource.startsWith('$2a$')
        ? passwordSource
        : bcrypt.hashSync(passwordSource || '12345678', BCRYPT_SALT_ROUNDS);
      await insertUser({
        id,
        username,
        usernameLower: normalizeUsername(username),
        passwordHash,
        role: entry.role || 'user',
        approved: Boolean(entry.approved),
        photo: entry.photo ? sanitizeText(entry.photo) : null,
      });
    }
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

app.post('/api/register', asyncHandler(async (req, res) => {
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

app.post('/api/login', asyncHandler(async (req, res) => {
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

  await insertInventoryItem({
    id,
    produto,
    tipo: tipo || null,
    lote: lote || null,
    quantidade: quantidadeFinal,
    validade: validade || null,
    custo: custoSanitizado,
    image: imagePath,
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
  if (req.body.removeImage === 'true') {
    if (atual.image) removeStoredFile(atual.image);
    imagemAtualizada = null;
  } else if (uploadedImagePath) {
    if (atual.image) removeStoredFile(atual.image);
    imagemAtualizada = uploadedImagePath;
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
    return res.status(400).json({ error: err.message });
  }
  if (typeof err.message === 'string' && err.message.toLowerCase().includes('imagem')) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;

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

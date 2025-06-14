import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(cors({
  origin: ['https://projeto-estoque-o1x5.onrender.com'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(__dirname));

const dataDir     = path.join(__dirname, 'data');
const usersFile   = path.join(dataDir, 'users.json');
const estoqueFile = path.join(dataDir, 'estoque.json');
const movFile     = path.join(dataDir, 'movimentacoes.json');

if (!fs.existsSync(dataDir))       fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(usersFile))     fs.writeFileSync(usersFile, '[]', 'utf8');
if (!fs.existsSync(estoqueFile))   fs.writeFileSync(estoqueFile, '[]', 'utf8');
if (!fs.existsSync(movFile))       fs.writeFileSync(movFile, '[]', 'utf8');

const readJSON = file => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
};
const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
};

const logMovimentacao = mov => {
  const logs = readJSON(movFile);
  logs.push(mov);
  writeJSON(movFile, logs);
};

// ROTA DE REGISTRO (usuário fica pendente até aprovação)
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }
  const users = readJSON(usersFile);
  if (users.some(u => u.username === username)) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }
  users.push({
    id: uuidv4(),
    username,
    password,
    role: 'user',
    approved: false
  });
  writeJSON(usersFile, users);
  res.json({ message: 'Cadastro enviado para aprovação' });
});

// ROTA DE LOGIN (agora retorna role)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }
  const users = readJSON(usersFile);
  const user  = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  if (!user.approved) {
    return res.status(403).json({ error: 'Usuário pendente de aprovação' });
  }
  res.json({ message: 'Login bem-sucedido', userId: user.id, role: user.role });
});

// --- Gestão de usuários ---
app.get('/api/users/pending', (req, res) => {
  if (req.query.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito' });
  }
  const users = readJSON(usersFile).filter(u => !u.approved);
  res.json(users);
});

app.get('/api/users', (req, res) => {
  if (req.query.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito' });
  }
  res.json(readJSON(usersFile));
});

app.post('/api/users/:id/approve', (req, res) => {
  if (req.body.roleAtuante !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito' });
  }
  const users = readJSON(usersFile);
  const idx   = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });
  users[idx].approved = true;
  writeJSON(usersFile, users);
  res.json({ message: 'Usuário aprovado' });
});

app.delete('/api/users/:id', (req, res) => {
  if (req.body.roleAtuante !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito' });
  }
  const users = readJSON(usersFile);
  const idx   = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });
  users.splice(idx, 1);
  writeJSON(usersFile, users);
  res.json({ message: 'Usuário excluído' });
});

// Rotas de estoque (mantidas iguais ao seu último estado)
app.get('/api/estoque', (req, res) => {
  let estoque = readJSON(estoqueFile);
  if (!Array.isArray(estoque)) {
    estoque = Object.entries(estoque).map(([id, item]) => ({ id, ...item }));
    writeJSON(estoqueFile, estoque);
  }
  res.json(estoque);
});

app.post('/api/estoque', (req, res) => {
  const { produto, tipo, lote, quantidade, validade, usuario } = req.body;
  if (!produto || quantidade === undefined) {
    return res.status(400).json({ error: 'Produto e quantidade são obrigatórios' });
  }
const estoque = readJSON(estoqueFile);
const id      = uuidv4();
estoque.push({
  id,
  produto: produto.trim(),
  tipo:    tipo ? tipo.trim() : '',
  lote:    lote ? lote.trim() : '',
  quantidade: parseInt(quantidade, 10) || 0,
  validade:   validade || null,
  dataCadastro: new Date().toISOString()
});
logMovimentacao({
  id: uuidv4(),
  produtoId: id,
  produto: produto.trim(),
  tipo: 'adicao',
  quantidade: parseInt(quantidade, 10) || 0,
  quantidadeAnterior: 0,
  data: new Date().toISOString(),
  usuario: usuario || 'desconhecido'
});
writeJSON(estoqueFile, estoque);
});

app.put('/api/estoque/:id', (req, res) => {
  const rawId  = req.params.id;
  const usuario = req.body.usuario;
  const estoque = readJSON(estoqueFile) || [];

  // Converte para número se for dígitos, senão usa string (UUID)
  const itemId = /^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId;

  console.log('Atualizando produto', itemId);  // debug

  const idx = estoque.findIndex(item => item.id === itemId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  const atual = estoque[idx];
  const novaQtd = Number.isInteger(+req.body.quantidade)
                    ? parseInt(req.body.quantidade, 10)
                    : atual.quantidade;
  estoque[idx] = {
    ...atual,
    produto:    req.body.produto?.trim()    || atual.produto,
    tipo:       req.body.tipo?.trim()       || atual.tipo,
    lote:       req.body.lote?.trim()       || atual.lote,
    quantidade: novaQtd,
    validade:   req.body.validade ?? atual.validade,
    validade:   req.body.validade ?? atual.validade,
  dataAtualizacao: new Date().toISOString()
};
const diff = novaQtd - atual.quantidade;
if (diff !== 0) {
  logMovimentacao({
    id: uuidv4(),
    produtoId: itemId,
    produto: estoque[idx].produto,
    tipo: diff > 0 ? 'entrada' : 'saida',
    quantidade: diff,
    quantidadeAnterior: atual.quantidade,
    data: new Date().toISOString(),
    usuario: usuario || 'desconhecido'
  });
  writeJSON(estoqueFile, estoque);
  res.json({ message: 'Produto atualizado com sucesso' });
});

app.delete('/api/estoque/:id', (req, res) => {
  const rawId   = req.params.id;
  const { motivo, usuario } = req.body;
  if (!motivo) {
    return res.status(400).json({ error: 'Motivo é obrigatório' });
  }
  const estoque = readJSON(estoqueFile) || [];

  // Converte para número se for dígitos, senão utiliza string (UUID)
  const itemId = /^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId;

  const idx = estoque.findIndex(item => item.id === itemId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  const removed = estoque.splice(idx, 1)[0];
  writeJSON(estoqueFile, estoque);
  const removed = estoque.splice(idx, 1)[0];
writeJSON(estoqueFile, estoque);
logMovimentacao({
  id: uuidv4(),
  produtoId: itemId,
  produto: removed.produto,
  tipo: 'exclusao',
  quantidade: removed.quantidade,
  quantidadeAnterior: removed.quantidade,
  motivo,
  data: new Date().toISOString(),
  usuario: usuario || 'desconhecido'
});
app.get('/api/movimentacoes', (req, res) => {
  res.json(readJSON(movFile));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
http.createServer(app).listen(PORT, () =>
  console.log(`Servidor rodando na porta ${PORT}`)
);

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

if (!fs.existsSync(dataDir))       fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(usersFile))     fs.writeFileSync(usersFile, '[]', 'utf8');
if (!fs.existsSync(estoqueFile))   fs.writeFileSync(estoqueFile, '[]', 'utf8');

const readJSON = file => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
};
const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
};

// ROTA DE REGISTRO (apenas admin pode criar)
app.post('/api/register', (req, res) => {
  const { username, password, roleAtuante } = req.body;
  if (roleAtuante !== 'admin') {
    return res.status(403).json({ error: 'Somente administradores podem criar usuários' });
  }
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
    role: 'user'
  });
  writeJSON(usersFile, users);
  res.json({ message: 'Cadastro realizado com sucesso' });
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
  res.json({ message: 'Login bem-sucedido', userId: user.id, role: user.role });
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
  const { produto, tipo, lote, quantidade, validade } = req.body;
  if (!produto || quantidade === undefined) {
    return res.status(400).json({ error: 'Produto e quantidade são obrigatórios' });
  }
  const estoque = readJSON(estoqueFile);
  const id      = uuidv4();
  estoque.push({
    id,
    produto: produto.trim(),
    tipo:    tipo?.trim() || '',
    lote:    lote?.trim() || '',
    quantidade: parseInt(quantidade, 10) || 0,
    validade:   validade || null,
    dataCadastro: new Date().toISOString()
  });
  writeJSON(estoqueFile, estoque);
  res.json({ message: 'Produto adicionado com sucesso', id });
});

app.put('/api/estoque/:id', (req, res) => {
  const idParam = parseInt(req.params.id, 10);
  const estoque = readJSON(estoqueFile) || [];
  const idx     = estoque.findIndex(item => item.id === idParam);
  if (idx === -1) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }
  const atual = estoque[idx];
  estoque[idx] = {
    ...atual,
    produto:    req.body.produto?.trim()    || atual.produto,
    tipo:       req.body.tipo?.trim()       || atual.tipo,
    lote:       req.body.lote?.trim()       || atual.lote,
    quantidade: Number.isInteger(+req.body.quantidade)
                  ? parseInt(req.body.quantidade, 10)
                  : atual.quantidade,
    validade:   req.body.validade ?? atual.validade,
    dataAtualizacao: new Date().toISOString()
  };
  writeJSON(estoqueFile, estoque);
  res.json({ message: 'Produto atualizado com sucesso' });
});

app.delete('/api/estoque/:id', (req, res) => {
  const idParam = parseInt(req.params.id, 10);
  const estoque = readJSON(estoqueFile) || [];
  const idx     = estoque.findIndex(item => item.id === idParam);
  if (idx === -1) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }
  estoque.splice(idx, 1);
  writeJSON(estoqueFile, estoque);
  res.json({ message: 'Produto excluído com sucesso!' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
http.createServer(app).listen(PORT, () =>
  console.log(`Servidor rodando na porta ${PORT}`)
);

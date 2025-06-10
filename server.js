import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
  origin: ['https://projeto-estoque-o1x5.onrender.com'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(__dirname));

// Configuração dos arquivos de dados
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const estoqueFile = path.join(dataDir, 'estoque.json');

// Garante existência de pasta e arquivos
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, '[]', 'utf8');
}
if (!fs.existsSync(estoqueFile)) {
  // Como vocês manipulam o estoque como objeto, inicialize como "{}"
  fs.writeFileSync(estoqueFile, '{}', 'utf8');
}

// Helpers de leitura/escrita
const readJSON = file => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`Erro ao ler ${file}:`, e.message);
    return file.includes('users') ? [] : {};
  }
};
const writeJSON = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Erro ao gravar ${file}:`, e.message);
    throw e;
  }
};

// --- Rotas de Autenticação (inalteradas) ---

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }
  const users = readJSON(usersFile);
  if (users.some(u => u.username === username)) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }
  users.push({ id: uuidv4(), username, password });
  writeJSON(usersFile, users);
  res.json({ message: 'Cadastro realizado com sucesso' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }
  const users = readJSON(usersFile);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  res.json({ message: 'Login bem-sucedido', userId: user.id });
});

// --- Rotas de Estoque ---

// Listar todo o estoque (objeto)
app.get('/api/estoque', (req, res) => {
  const estoque = readJSON(estoqueFile);
  res.json(estoque);
});

// Adicionar novo produto (gera UUID como chave)
app.post('/api/estoque', (req, res) => {
  const { produto, tipo, lote, quantidade, validade } = req.body;
  if (!produto || quantidade === undefined) {
    return res.status(400).json({ error: 'Produto e quantidade são obrigatórios' });
  }
  const estoque = readJSON(estoqueFile);
  const id = uuidv4();
  estoque[id] = {
    produto: produto.trim(),
    tipo: tipo?.trim() || '',
    lote: lote?.trim() || '',
    quantidade: parseInt(quantidade, 10) || 0,
    validade: validade || null,
    dataCadastro: new Date().toISOString()
  };
  writeJSON(estoqueFile, estoque);
  res.json({ message: 'Produto adicionado com sucesso', id });
});

// Atualizar dados de um produto existente
app.put('/api/estoque/:id', (req, res) => {
  const id = req.params.id;
  const { produto, tipo, lote, quantidade, validade } = req.body;
  const estoque = readJSON(estoqueFile);
  if (!estoque[id]) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }
  estoque[id] = {
    ...estoque[id],
    produto: produto?.trim() || estoque[id].produto,
    tipo: tipo?.trim() || estoque[id].tipo,
    lote: lote?.trim() || estoque[id].lote,
    quantidade: parseInt(quantidade, 10) || estoque[id].quantidade,
    validade: validade || estoque[id].validade || null,
    dataAtualizacao: new Date().toISOString()
  };
  writeJSON(estoqueFile, estoque);
  res.json({ message: 'Produto atualizado com sucesso' });
});

// **Rota DELETE única e correta**
app.delete('/api/estoque/:id', (req, res) => {
  const id = req.params.id;
  const estoque = readJSON(estoqueFile);
  if (!estoque[id]) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }
  delete estoque[id];
  writeJSON(estoqueFile, estoque);
  return res.json({ message: 'Produto excluído com sucesso!' });
});

// Front-end fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicia servidor
const PORT = process.env.PORT || 3000;
http.createServer(app).listen(PORT, () =>
  console.log(`Servidor rodando na porta ${PORT}`)
);

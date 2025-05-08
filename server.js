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
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.static(__dirname));

// Configuração do banco de dados
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const estoqueFile = path.join(dataDir, 'estoque.json');

// Garantir que os arquivos existam
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]');
if (!fs.existsSync(estoqueFile)) fs.writeFileSync(estoqueFile, '{}');

// Funções de leitura/escrita
const readJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`Erro ao ler ${file}:`, e);
    return file.includes('users') ? [] : {};
  }
};

const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// Rotas de Autenticação
app.post('/api/register', (req, res) => {
  try {
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
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const users = readJSON(usersFile);
    const user = users.find(u => u.username === username && u.password === password);
    
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    res.json({ message: 'Login bem-sucedido', userId: user.id });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Rotas de Estoque
app.get('/api/estoque', (req, res) => {
  try {
    const estoque = readJSON(estoqueFile);
    console.log('Estoque carregado:', estoque); // Debug
    res.json(estoque);
  } catch (error) {
    console.error('Erro ao carregar estoque:', error);
    res.status(500).json({ error: 'Erro ao carregar estoque' });
  }
});

app.post('/api/estoque', (req, res) => {
  try {
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
      quantidade: parseInt(quantidade) || 0,
      validade: validade || null,
      dataCadastro: new Date().toISOString()
    };

    writeJSON(estoqueFile, estoque);
    res.json({ message: 'Produto adicionado com sucesso', id });
  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
    res.status(500).json({ error: 'Erro ao adicionar produto' });
  }
});

app.put('/api/estoque/:id', (req, res) => {
  try {
    const estoque = readJSON(estoqueFile);
    const id = req.params.id;
    
    if (!estoque[id]) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    estoque[id] = {
      ...estoque[id],
      produto: req.body.produto?.trim() || estoque[id].produto,
      tipo: req.body.tipo?.trim() || estoque[id].tipo,
      lote: req.body.lote?.trim() || estoque[id].lote,
      quantidade: parseInt(req.body.quantidade) || estoque[id].quantidade,
      validade: req.body.validade || estoque[id].validade || null,
      dataAtualizacao: new Date().toISOString()
    };

    writeJSON(estoqueFile, estoque);
    res.json({ message: 'Produto atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

app.delete('/api/estoque/:id', (req, res) => {
  try {
    const estoque = readJSON(estoqueFile);
    const id = req.params.id;
    
    if (!estoque[id]) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    delete estoque[id];
    writeJSON(estoqueFile, estoque);
    res.json({ message: 'Produto removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover produto:', error);
    res.status(500).json({ error: 'Erro ao remover produto' });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

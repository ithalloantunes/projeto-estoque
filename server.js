import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
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

// Rotas para frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Funções auxiliares
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Rotas de autenticação
app.post('/api/register', (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readJSON(usersFile);
    
    if (users.some(u => u.username === username)) {
      return res.status(400).json({ error: 'Usuário já existe' });
    }
    
    users.push({ id: uuidv4(), username, password });
    writeJSON(usersFile, users);
    res.json({ message: 'Cadastro realizado' });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readJSON(usersFile);
    const user = users.find(u => u.username === username && u.password === password);
    
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    res.json({ message: 'Login bem-sucedido', userId: user.id });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Rotas de estoque
app.get('/api/estoque', (req, res) => {
  try {
    res.json(readJSON(estoqueFile));
  } catch (error) {
    console.error('Erro ao listar estoque:', error);
    res.status(500).json({ error: 'Erro ao carregar estoque' });
  }
});

app.post('/api/estoque', (req, res) => {
  try {
    const estoque = readJSON(estoqueFile);
    const id = uuidv4();
    
    if (!req.body.produto || req.body.quantidade === undefined) {
      return res.status(400).json({ error: 'Produto e quantidade são obrigatórios' });
    }

    estoque[id] = {
      produto: req.body.produto.trim(),
      tipo: req.body.tipo?.trim() || '',
      lote: req.body.lote?.trim() || '',
      quantidade: parseInt(req.body.quantidade) || 0
    };

    writeJSON(estoqueFile, estoque);
    res.json({ message: 'Produto adicionado', id });
  } catch (error) {
    console.error('Erro ao adicionar:', error);
    res.status(500).json({ error: 'Falha ao adicionar produto' });
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
      ...req.body,
      quantidade: req.body.quantidade !== undefined ? parseInt(req.body.quantidade) : estoque[id].quantidade
    };

    writeJSON(estoqueFile, estoque);
    res.json({ message: 'Produto atualizado' });
  } catch (error) {
    console.error('Erro ao atualizar:', error);
    res.status(500).json({ error: 'Falha ao atualizar produto' });
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
    res.json({ message: 'Produto removido' });
  } catch (error) {
    console.error('Erro ao remover:', error);
    res.status(500).json({ error: 'Falha ao remover produto' });
  }
});

app.get('/api/estoque/buscar/:nome', (req, res) => {
  try {
    const estoque = readJSON(estoqueFile);
    const termo = req.params.nome.toLowerCase();
    
    const resultados = Object.entries(estoque)
      .filter(([_, item]) => item.produto.toLowerCase().includes(termo))
      .reduce((acc, [id, item]) => ({ ...acc, [id]: item }), {});

    res.json(resultados);
  } catch (error) {
    console.error('Erro na busca:', error);
    res.status(500).json({ error: 'Falha na busca' });
  }
});

app.get('/api/estoque/relatorio', (req, res) => {
  try {
    const estoque = Object.values(readJSON(estoqueFile));
    estoque.sort((a, b) => a.quantidade - b.quantidade);
    res.json(estoque);
  } catch (error) {
    console.error('Erro no relatório:', error);
    res.status(500).json({ error: 'Falha ao gerar relatório' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

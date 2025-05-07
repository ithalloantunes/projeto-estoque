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

// Garantir permissões
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Pasta data criada');
  }
  [usersFile, estoqueFile].forEach(file => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, file.includes('users') ? '[]' : '{}');
  });
} catch (error) {
  console.error('Erro na inicialização:', error);
}

// Rotas do Frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Rotas da API
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Autenticação
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

// Estoque
app.get('/api/estoque', (req, res) => res.json(readJSON(estoqueFile)));

app.post('/api/estoque', (req, res) => {
  try {
    const estoque = readJSON(estoqueFile);
    const id = uuidv4();
    
    if (!req.body.produto || typeof req.body.quantidade !== 'number') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    estoque[id] = {
      produto: req.body.produto.trim(),
      tipo: req.body.tipo?.trim() || 'Não especificado',
      lote: req.body.lote?.trim() || `LOTE-${Date.now()}`,
      quantidade: Math.max(0, req.body.quantidade)
    };

    writeJSON(estoqueFile, estoque);
    res.json({ message: 'Produto adicionado', id });
  } catch (error) {
    console.error('Erro ao adicionar:', error);
    res.status(500).json({ error: 'Falha no servidor' });
  }
});

// ... (Manter outras rotas do estoque aqui)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`)));

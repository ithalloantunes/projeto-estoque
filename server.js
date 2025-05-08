import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuração robusta de CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(express.json());
app.use(express.static(__dirname));

// Configuração do banco de dados
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const estoqueFile = path.join(dataDir, 'estoque.json');

// Garante que a pasta e arquivos existam
const initializeDataFiles = () => {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('Pasta data criada');
    }

    if (!fs.existsSync(usersFile)) {
      fs.writeFileSync(usersFile, '[]');
      console.log('Arquivo users.json criado');
    }

    if (!fs.existsSync(estoqueFile)) {
      fs.writeFileSync(estoqueFile, '{}');
      console.log('Arquivo estoque.json criado');
    }
  } catch (error) {
    console.error('Erro na inicialização:', error);
  }
};

initializeDataFiles();

// Funções de leitura/escrita com tratamento de erro
const readJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Erro ao ler ${file}:`, error);
    return file.includes('users') ? [] : {};
  }
};

const writeJSON = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Erro ao escrever ${file}:`, error);
  }
};

// Rotas de inicialização (para debug)
app.get('/api/init', (req, res) => {
  initializeDataFiles();
  res.json({ 
    status: 'OK',
    files: {
      users: fs.existsSync(usersFile),
      estoque: fs.existsSync(estoqueFile)
    }
  });
});

// Rotas de autenticação
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
    res.json({ message: 'Cadastro realizado' });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readJSON(usersFile);
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    res.json({ 
      message: 'Login bem-sucedido', 
      userId: user.id 
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Rotas de estoque (com logs detalhados)
app.get('/api/estoque', (req, res) => {
  try {
    console.log('[GET] /estoque - Iniciando leitura do estoque');
    const estoque = readJSON(estoqueFile);
    console.log('[GET] /estoque - Dados lidos:', Object.keys(estoque).length, 'itens');
    res.json(estoque);
  } catch (error) {
    console.error('[GET] /estoque - Erro:', error);
    res.status(500).json({ error: 'Falha ao carregar estoque' });
  }
});

app.post('/api/estoque', (req, res) => {
  try {
    console.log('[POST] /estoque - Recebendo dados:', req.body);
    
    if (!req.body.produto || req.body.quantidade === undefined) {
      return res.status(400).json({ error: 'Produto e quantidade são obrigatórios' });
    }

    const estoque = readJSON(estoqueFile);
    const id = uuidv4();

    estoque[id] = {
      produto: req.body.produto.toString().trim(),
      tipo: req.body.tipo?.toString().trim() || '',
      lote: req.body.lote?.toString().trim() || '',
      quantidade: parseInt(req.body.quantidade) || 0,
      createdAt: new Date().toISOString()
    };

    writeJSON(estoqueFile, estoque);
    console.log('[POST] /estoque - Produto adicionado. ID:', id);
    res.json({ message: 'Produto adicionado', id });
  } catch (error) {
    console.error('[POST] /estoque - Erro:', error);
    res.status(500).json({ error: 'Falha ao adicionar produto' });
  }
});

// ... (Rotas PUT, DELETE e outras mantidas conforme necessário)

// Rota padrão para o frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Servidor rodando na porta ${PORT}`);
  console.log(`🔗 Acesse: http://localhost:${PORT}`);
});

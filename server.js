import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuração do CORS
app.use(cors({
  origin: [
    'https://projeto-estoque-gcl4.onrender.com',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

// Configuração do banco de dados
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const estoqueFile = path.join(dataDir, 'estoque.json');

// Garantir que os arquivos existam
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, '[]');
}
if (!fs.existsSync(estoqueFile)) {
  fs.writeFileSync(estoqueFile, '{}');
}

// Funções de leitura/escrita
const readJSON = (file) => {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return file.includes('users') ? [] : {};
  }
};

const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// Middleware de autenticação
const authenticate = (req, res, next) => {
  const authToken = req.cookies.authToken;
  if (!authToken) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  const users = readJSON(usersFile);
  const user = users.find(u => u.id === authToken);
  
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  req.user = user;
  next();
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

    const newUser = {
      id: uuidv4(),
      username,
      password
    };
    users.push(newUser);
    writeJSON(usersFile, users);
    res.json({ message: 'Usuário registrado com sucesso' });
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
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Configuração aprimorada de cookies
    res.cookie('authToken', user.id, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dias
    });
    
    res.json({ 
      message: 'Login bem-sucedido',
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Rotas de Estoque (protegidas)
app.get('/api/estoque', authenticate, (req, res) => {
  try {
    const estoque = readJSON(estoqueFile);
    res.json(estoque);
  } catch (error) {
    console.error('Erro ao carregar estoque:', error);
    res.status(500).json({ error: 'Erro ao carregar estoque' });
  }
});

app.post('/api/estoque', authenticate, (req, res) => {
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

app.put('/api/estoque/:id', authenticate, (req, res) => {
  try {
    const { produto, tipo, lote, quantidade, validade } = req.body;
    const estoque = readJSON(estoqueFile);
    const id = req.params.id;
    
    if (!estoque[id]) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    estoque[id] = {
      ...estoque[id],
      produto: produto?.trim() || estoque[id].produto,
      tipo: tipo?.trim() || estoque[id].tipo,
      lote: lote?.trim() || estoque[id].lote,
      quantidade: parseInt(quantidade) || estoque[id].quantidade,
      validade: validade || estoque[id].validade || null,
      dataAtualizacao: new Date().toISOString()
    };

    writeJSON(estoqueFile, estoque);
    res.json({ message: 'Produto atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

app.delete('/api/estoque/:id', authenticate, (req, res) => {
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

// Rota para favicon (evita logs desnecessários)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Rota para o frontend (mantida conforme sua estrutura atual)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Modo: ${process.env.NODE_ENV || 'desenvolvimento'}`);
  console.log(`Origins permitidos: ${[
    'https://projeto-estoque-gcl4.onrender.com',
    'http://localhost:3000'
  ].join(', ')}`);
});

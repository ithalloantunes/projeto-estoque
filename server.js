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
  origin: ['http://localhost:3000', 'https://projeto-estoque.onrender.com'], // Atualize com seu domínio do Render
  credentials: true
}));
app.use(express.json());
app.use(express.static(__dirname));

// Configuração do banco de dados
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const estoqueFile = path.join(dataDir, 'estoque.json');

// Garantir que os arquivos existam
console.log('Verificando diretório e arquivos de dados...');
if (!fs.existsSync(dataDir)) {
  console.log('Criando diretório data...');
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(usersFile)) {
  console.log('Criando users.json...');
  fs.writeFileSync(usersFile, '[]');
}
if (!fs.existsSync(estoqueFile)) {
  console.log('Criando estoque.json...');
  fs.writeFileSync(estoqueFile, '{}');
}

// Funções de leitura/escrita
const readJSON = (file) => {
  try {
    const data = fs.readFileSync(file, 'utf8');
    console.log(`Lendo ${file}:`, data);
    return JSON.parse(data);
  } catch (e) {
    console.error(`Erro ao ler ${file}:`, e.message);
    return file.includes('users') ? [] : {};
  }
};

const writeJSON = (file, data) => {
  try {
    console.log(`Escrevendo em ${file}:`, JSON.stringify(data, null, 2));
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Erro ao escrever em ${file}:`, e.message);
    throw new Error(`Falha ao escrever no arquivo ${file}`);
  }
};

// Rotas de Autenticação
app.post('/api/register', (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Requisição de registro:', { username, password });
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
    console.error('Erro no registro:', error.message);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Requisição de login:', { username, password });
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const users = readJSON(usersFile);
    const user = users.find(u => u.username === username && u.password === password);
    
    if (!user) {
      console.log('Credenciais inválidas para:', { username });
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    console.log('Login bem-sucedido:', { userId: user.id });
    res.json({ message: 'Login bem-sucedido', userId: user.id });
  } catch (error) {
    console.error('Erro no login:', error.message);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Rotas de Estoque
app.get('/api/estoque', (req, res) => {
  try {
    const estoque = readJSON(estoqueFile);
    console.log('Estoque carregado:', estoque);
    res.json(estoque);
  } catch (error) {
    console.error('Erro ao carregar estoque:', error.message);
    res.status(500).json({ error: 'Erro ao carregar estoque' });
  }
});

app.post('/api/estoque', (req, res) => {
  try {
    const { produto, tipo, lote, quantidade, validade } = req.body;
    console.log('Requisição de adição de produto:', { produto, tipo, lote, quantidade, validade });
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
    console.error('Erro ao adicionar produto:', error.message);
    res.status(500).json({ error: 'Erro ao adicionar produto' });
  }
});

app.put('/api/estoque/:id', (req, res) => {
  try {
    const { produto, tipo, lote, quantidade, validade } = req.body;
    console.log('Requisição de atualização de produto:', { id: req.params.id, produto, tipo, lote, quantidade, validade });
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
    console.error('Erro ao atualizar produto:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

app.delete('/api/estoque/:id', (req, res) => {
  try {
    console.log('Requisição de exclusão de produto:', { id: req.params.id });
    const estoque = readJSON(estoqueFile);
    const id = req.params.id;
    
    if (!estoque[id]) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    delete estoque[id];
    writeJSON(estoqueFile, estoque);
    res.json({ message: 'Produto removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover produto:', error.message);
    res.status(500).json({ error: 'Erro ao remover produto' });
  }
});

app.get('*', (req, res) => {
  console.log('Servindo index.html para:', req.url);
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

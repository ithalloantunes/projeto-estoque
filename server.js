import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: 'https://projeto-estoque-gcl4.onrender.com',
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const ESTOQUE_FILE = path.join(__dirname, 'data', 'estoque.json');

async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    console.log('users.json lido com sucesso:', data); // Log para depuração
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler users.json:', error);
    return [];
  }
}

async function writeUsers(users) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('users.json atualizado com sucesso');
  } catch (error) {
    console.error('Erro ao escrever users.json:', error);
  }
}

async function readEstoque() {
  try {
    const data = await fs.readFile(ESTOQUE_FILE, 'utf8');
    console.log('estoque.json lido com sucesso:', data);
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler estoque.json:', error);
    return {};
  }
}

async function writeEstoque(estoque) {
  try {
    await fs.writeFile(ESTOQUE_FILE, JSON.stringify(estoque, null, 2));
    console.log('estoque.json atualizado com sucesso');
  } catch (error) {
    console.error('Erro ao escrever estoque.json:', error);
  }
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  console.log('Requisição de registro:', { username, password });
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  const users = await readUsers();
  if (users.find(user => user.username === username)) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }

  const newUser = { id: uuidv4(), username, password };
  users.push(newUser);
  await writeUsers(users);

  res.status(201).json({ message: 'Usuário registrado com sucesso' });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Tentativa de login:', { username, password });
  const users = await readUsers();
  console.log('Usuários lidos:', users);
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    console.log('Login falhou: usuário ou senha incorretos');
    return res.status(401).json({ error: 'Usuário ou senha incorretos' });
  }

  console.log('Login bem-sucedido:', username);
  res.json({ message: 'Login bem-sucedido' });
});

app.get('/api/estoque', async (req, res) => {
  const estoque = await readEstoque();
  res.json(estoque);
});

app.post('/api/estoque', async (req, res) => {
  const { produto, tipo, lote, validade, quantidade } = req.body;
  console.log('Adicionando produto:', { produto, tipo, lote, validade, quantidade });
  if (!produto || !tipo || !lote || !quantidade) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios, exceto validade' });
  }

  const estoque = await readEstoque();
  const id = uuidv4();
  estoque[id] = { produto, tipo, lote, validade: validade || null, quantidade: parseInt(quantidade) };
  await writeEstoque(estoque);

  res.status(201).json({ message: 'Produto adicionado com sucesso' });
});

app.put('/api/estoque/:id', async (req, res) => {
  const { id } = req.params;
  const { produto, tipo, lote, validade, quantidade } = req.body;
  console.log('Atualizando produto:', { id, produto, tipo, lote, validade, quantidade });

  const estoque = await readEstoque();
  if (!estoque[id]) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  estoque[id] = { produto, tipo, lote, validade: validade || null, quantidade: parseInt(quantidade) };
  await writeEstoque(estoque);

  res.json({ message: 'Produto atualizado com sucesso' });
});

app.delete('/api/estoque/:id', async (req, res) => {
  const { id } = req.params;
  console.log('Excluindo produto:', { id });

  const estoque = await readEstoque();
  if (!estoque[id]) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  delete estoque[id];
  await writeEstoque(estoque);

  res.json({ message: 'Produto excluído com sucesso' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

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

// Funções de leitura/escrita
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Rotas de Autenticação
app.post('/api/register', (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readJSON(usersFile);
    
    if (users.some(u => u.username === username)) {
      return res.status(400).json({ error: 'Usuário já existe' });
    }

    users.push({ id: uuidv4(), username, password });
    writeJSON(usersFile, users);
    res.json({ message: 'Cadastro realizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro no servidor' });
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
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Rotas de Estoque
app.get('/api/estoque', (req, res) => {
  try {
    res.json(readJSON(estoqueFile));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar estoque' });
  }
});

app.post('/api/estoque', (req, res) => {
  try {
    const estoque = readJSON(estoqueFile);
    const id = uuidv4();
    
    if (!req.body.produto || req.body.quantidade === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    estoque[id] = {
      ...req.body,
      quantidade: Number(req.body.quantidade),
      dataCadastro: new Date().toISOString()
    };

    writeJSON(estoqueFile, estoque);
    res.json({ message: 'Produto adicionado com sucesso', id });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao adicionar produto' });
  }
});

// ... (Manter outras rotas PUT/DELETE)

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

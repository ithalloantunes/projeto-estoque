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
app.use(express.static(__dirname)); // Servir arquivos estáticos

// Rotas para frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Configuração do banco de dados
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const estoqueFile = path.join(dataDir, 'estoque.json');

// Garantir que os arquivos existam
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]');
if (!fs.existsSync(estoqueFile)) fs.writeFileSync(estoqueFile, '{}');

// Funções de leitura/escrita
function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Rotas da API
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(usersFile);
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }
  users.push({ id: uuidv4(), username, password });
  writeJSON(usersFile, users);
  res.json({ message: 'Cadastro realizado' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(usersFile);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
  res.json({ message: 'Login bem‑sucedido', userId: user.id });
});

// ... [Restante das rotas da API permanece igual] ...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
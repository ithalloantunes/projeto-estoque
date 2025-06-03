import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve index.html, javascript.js, estilos.css

// Mock database (replace with actual database)
const estoque = {};

// Login route (example)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    res.json({ message: 'Login bem-sucedido' });
  } else {
    res.status(400).json({ error: 'Usuário ou senha inválidos' });
  }
});

// Register route (example)
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    res.json({ message: 'Cadastro realizado com sucesso' });
  } else {
    res.status(400).json({ error: 'Usuário ou senha inválidos' });
  }
});

// Stock routes
app.get('/api/estoque', (req, res) => {
  res.json(estoque);
});

app.post('/api/estoque', (req, res) => {
  const { produto, tipo, lote, validade, quantidade } = req.body;
  const id = uuidv4(); // Gera ID único
  estoque[id] = { produto, tipo, lote, validade, quantidade };
  res.json({ message: 'Produto adicionado', id });
});

app.put('/api/estoque/:id', (req, res) => {
  const { id } = req.params;
  const { produto, tipo, lote, validade, quantidade } = req.body;
  if (estoque[id]) {
    estoque[id] = { produto, tipo, lote, validade, quantidade };
    res.json({ message: 'Produto atualizado' });
  } else {
    res.status(404).json({ error: 'Produto não encontrado' });
  }
});

app.delete('/api/estoque/:id', (req, res) => {
  const { id } = req.params;
  if (estoque[id]) {
    delete estoque[id];
    res.json({ message: 'Produto excluído' });
  } else {
    res.status(404).json({ error: 'Produto não encontrado' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

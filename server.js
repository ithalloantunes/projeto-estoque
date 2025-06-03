import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path'; // Import path module
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Configuração do CORS
app.use(cors({
    origin: '*', // Permite todas as origens; substitua por domínio do frontend para maior segurança
    credentials: true
}));
app.use(express.json());

// Serve static files (CSS, JS, images) from the current directory
app.use(express.static(path.join(__dirname, '.'))); // Serve files from the project root

// Simulação de banco de dados
const users = {};
const estoque = {};

// Rota de registro
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    if (users[username]) {
        return res.status(400).json({ error: 'Usuário já existe' });
    }
    users[username] = { password };
    res.status(201).json({ message: 'Usuário registrado com sucesso' });
});

// Rota de login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!users[username] || users[username].password !== password) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    res.status(200).json({ message: 'Login bem-sucedido' });
});

// Rotas para gerenciar estoque
app.get('/api/estoque', (req, res) => {
    res.status(200).json(estoque);
});

app.post('/api/estoque', (req, res) => {
    const { produto, tipo, lote, validade, quantidade } = req.body;
    if (!produto || !tipo || !lote || !quantidade) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    const id = uuidv4();
    estoque[id] = { produto, tipo, lote, validade, quantidade };
    res.status(201).json({ message: 'Produto adicionado com sucesso' });
});

app.put('/api/estoque/:id', (req, res) => {
    const { id } = req.params;
    if (!estoque[id]) {
        return res.status(404).json({ error: 'Produto não encontrado' });
    }
    estoque[id] = { ...estoque[id], ...req.body };
    res.status(200).json({ message: 'Produto atualizado com sucesso' });
});

app.delete('/api/estoque/:id', (req, res) => {
    const { id } = req.params;
    if (!estoque[id]) {
        return res.status(404).json({ error: 'Produto não encontrado' });
    }
    delete estoque[id];
    res.status(200).json({ message: 'Produto excluído com sucesso' });
});

// Route to serve index.html for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});

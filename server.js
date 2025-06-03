import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const usersFile = path.join(__dirname, 'users.json');
const estoqueFile = path.join(__dirname, 'estoque.json');

// Configuração de middlewares
app.use(cors({
    origin: 'https://projeto-estoque-gcl4.onrender.com',
    credentials: true
}));
app.use(express.json());

// Servir arquivos estáticos diretamente da raiz do projeto
app.use(express.static(__dirname));

// Servir o index.html na rota raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Funções para manipular users.json e estoque.json
async function loadUsers() {
    try {
        const data = await fs.readFile(usersFile, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao carregar users.json:', error);
        return [];
    }
}

async function saveUsers(users) {
    try {
        await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Erro ao salvar users.json:', error);
        throw error;
    }
}

async function loadEstoque() {
    try {
        const data = await fs.readFile(estoqueFile, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao carregar estoque.json:', error);
        return {};
    }
}

async function saveEstoque(estoque) {
    try {
        await fs.writeFile(estoqueFile, JSON.stringify(estoque, null, 2));
    } catch (error) {
        console.error('Erro ao salvar estoque.json:', error);
        throw error;
    }
}

// Inicializar arquivos se não existirem
async function initializeFiles() {
    try {
        await fs.access(usersFile);
    } catch (error) {
        await fs.writeFile(usersFile, JSON.stringify([{ id: uuidv4(), username: "i", password: "123" }], null, 2));
        console.log('users.json criado com usuário de teste');
    }
    try {
        await fs.access(estoqueFile);
    } catch (error) {
        await fs.writeFile(estoqueFile, JSON.stringify({}, null, 2));
        console.log('estoque.json criado');
    }
}

// Rota de registro
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    try {
        const users = await loadUsers();
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'Usuário já existe' });
        }
        users.push({ id: uuidv4(), username, password });
        await saveUsers(users);
        res.status(201).json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
        console.error('Erro ao registrar:', error); // Log do erro pra debug
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota de login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    try {
        const users = await loadUsers();
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        res.status(200).json({ message: 'Login bem-sucedido' });
    } catch (error) {
        console.error('Erro ao logar:', error); // Log do erro pra debug
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rotas para gerenciar estoque
app.get('/api/estoque', async (req, res) => {
    try {
        const estoque = await loadEstoque();
        res.status(200).json(estoque);
    } catch (error) {
        console.error('Erro ao carregar estoque:', error); // Log do erro pra debug
        res.status(500).json({ error: 'Erro ao carregar estoque' });
    }
});

app.post('/api/estoque', async (req, res) => {
    const { produto, tipo, lote, validade, quantidade } = req.body;
    if (!produto || !tipo || !lote || !quantidade) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    try {
        const estoque = await loadEstoque();
        const id = uuidv4();
        estoque[id] = { produto, tipo, lote, validade, quantidade: parseInt(quantidade) };
        await saveEstoque(estoque);
        res.status(201).json({ message: 'Produto adicionado com sucesso' });
    } catch (error) {
        console.error('Erro ao adicionar produto:', error); // Log do erro pra debug
        res.status(500).json({ error: 'Erro ao adicionar produto' });
    }
});

app.put('/api/estoque/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const estoque = await loadEstoque();
        if (!estoque[id]) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        estoque[id] = { ...estoque[id], ...req.body, quantidade: parseInt(req.body.quantidade) };
        await saveEstoque(estoque);
        res.status(200).json({ message: 'Produto atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error); // Log do erro pra debug
        res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
});

app.delete('/api/estoque/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const estoque = await loadEstoque();
        if (!estoque[id]) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        delete estoque[id];
        await saveEstoque(estoque);
        res.status(200).json({ message: 'Produto excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir produto:', error); // Log do erro pra debug
        res.status(500).json({ error: 'Erro ao excluir produto' });
    }
});

// Inicializar arquivos e iniciar o servidor
initializeFiles().then(() => {
    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
}).catch(err => {
    console.error('Erro ao inicializar arquivos:', err);
    process.exit(1);
});

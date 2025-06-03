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
    origin: 'https://projeto-estoque-gcl4.onrender.com', // URL exata do frontend
    credentials: true
}));
app.use(express.json());

// Servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public'))); // Assumindo que index.html, estilos.css, javascript.js estão em 'public'

// Função para carregar users.json
async function loadUsers() {
    try {
        const data = await fs.readFile(usersFile, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao carregar users.json:', error);
        return [];
    }
}

// Função para salvar users.json
async function saveUsers(users) {
    try {
        await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Erro ao salvar users.json:', error);
        throw error;
    }
}

// Função para carregar estoque.json
async function loadEstoque() {
    try {
        const data = await fs.readFile(estoqueFile, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao carregar estoque.json:', error);
        return {};
    }
}

// Função para salvar estoque.json
async function saveEstoque(estoque) {
    try {
        await fs.writeFile(estoqueFile, JSON.stringify(estoque, null, 2));
    } catch (error) {
        console.error('Erro ao salvar estoque.json:', error);
        throw error;
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

        const newUser = { id: uuidv4(), username, password };
        users.push(newUser);
        await saveUsers(users);
        res.status(201).json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
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
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rotas para gerenciar estoque
app.get('/api/estoque', async (req, res) => {
    try {
        const estoque = await loadEstoque();
        res.status(200).json(estoque);
    } catch (error) {
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
        res.status(500).json({ error: 'Erro ao excluir produto' });
    }
});

// Servir o index.html para a rota raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});

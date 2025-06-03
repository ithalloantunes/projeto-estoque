import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises'; // Import fs/promises for async file operations

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const ESTOQUE_FILE = path.join(__dirname, 'data', 'estoque.json'); // Define path for estoque file as well

// Configuração do CORS
app.use(cors({
    origin: '*', // Permite todas as origens; substitua por domínio do frontend para maior segurança
    credentials: true
}));
app.use(express.json());

// Serve static files (CSS, JS, images) from the current directory
app.use(express.static(path.join(__dirname, '.'))); // Serve files from the project root

// --- Data Persistence Functions ---

// Load data from a JSON file
async function loadData(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is invalid JSON, return an empty object
        if (error.code === 'ENOENT') {
            console.log(`Arquivo não encontrado: ${filePath}. Iniciando com dados vazios.`);
            return {};
        } else {
            console.error(`Erro ao ler o arquivo ${filePath}:`, error);
            return {}; // Return empty object on other errors too, to avoid crashing
        }
    }
}

// Save data to a JSON file
async function saveData(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Erro ao salvar o arquivo ${filePath}:`, error);
    }
}

// In-memory data stores (will be populated from files)
let users = {};
let estoque = {};

// --- API Routes ---

// Rota de registro
app.post('/api/register', async (req, res) => { // Make route async
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    if (users[username]) {
        return res.status(400).json({ error: 'Usuário já existe' });
    }
    users[username] = { password };
    await saveData(USERS_FILE, users); // Save updated users to file
    res.status(201).json({ message: 'Usuário registrado com sucesso' });
});

// Rota de login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Ensure users object is up-to-date (though it should be loaded at start)
    if (!users[username] || users[username].password !== password) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    res.status(200).json({ message: 'Login bem-sucedido' });
});

// Rotas para gerenciar estoque (Updated for persistence)
app.get('/api/estoque', (req, res) => {
    res.status(200).json(estoque);
});

app.post('/api/estoque', async (req, res) => { // Make route async
    const { produto, tipo, lote, validade, quantidade } = req.body;
    if (!produto || !tipo || !lote || !quantidade) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    const id = uuidv4();
    estoque[id] = { produto, tipo, lote, validade, quantidade };
    await saveData(ESTOQUE_FILE, estoque); // Save updated estoque to file
    res.status(201).json({ message: 'Produto adicionado com sucesso', id: id }); // Return the new ID
});

app.put('/api/estoque/:id', async (req, res) => { // Make route async
    const { id } = req.params;
    if (!estoque[id]) {
        return res.status(404).json({ error: 'Produto não encontrado' });
    }
    // Update only provided fields
    estoque[id] = { ...estoque[id], ...req.body };
    await saveData(ESTOQUE_FILE, estoque); // Save updated estoque to file
    res.status(200).json({ message: 'Produto atualizado com sucesso' });
});

app.delete('/api/estoque/:id', async (req, res) => { // Make route async
    const { id } = req.params;
    if (!estoque[id]) {
        return res.status(404).json({ error: 'Produto não encontrado' });
    }
    delete estoque[id];
    await saveData(ESTOQUE_FILE, estoque); // Save updated estoque to file
    res.status(200).json({ message: 'Produto excluído com sucesso' });
});

// Route to serve index.html for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Server Initialization ---

async function startServer() {
    // Load initial data from files
    users = await loadData(USERS_FILE);
    estoque = await loadData(ESTOQUE_FILE);

    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
        console.log(`Usuários carregados: ${Object.keys(users).length}`);
        console.log(`Itens de estoque carregados: ${Object.keys(estoque).length}`);
    });
}

startServer().catch(err => {
    console.error("Erro ao iniciar o servidor:", err);
    process.exit(1);
});

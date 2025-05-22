const monster = document.getElementById('monster');
const inputUsuario = document.getElementById('input-usuario');
const inputClave = document.getElementById('input-clave');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById(' REGISTER_FORM_ID');
const loginContainer = document.getElementById('login-container');
const stockContainer = document.getElementById('stock-container');
const stockForm = document.getElementById('stock-form');
const stockTableBody = document.getElementById('stock-table-body');
const body = document.querySelector('body');
const anchoMitad = window.innerWidth / 2;
const altoMitad = window.innerHeight / 2;
let seguirPunteroMouse = true;

// Base URL (mude para o domínio do Render em produção)
const BASE_URL = 'https://projeto-estoque-gcl4.onrender.com'; // Atualize com seu domínio do Render

// Monster animation logic
body.addEventListener('mousemove', (m) => {
    if (seguirPunteroMouse) {
        if (m.clientX < anchoMitad && m.clientY < altoMitad) {
            monster.src = "img/idle/2.png";
        } else if (m.clientX < anchoMitad && m.clientY > altoMitad) {
            monster.src = "img/idle/3.png";
        } else if (m.clientX > anchoMitad && m.clientY < altoMitad) {
            monster.src = "img/idle/5.png";
        } else {
            monster.src = "img/idle/4.png";
        }
    }
});

inputUsuario.addEventListener('focus', () => {
    seguirPunteroMouse = false;
});

inputUsuario.addEventListener('blur', () => {
    seguirPunteroMouse = true;
});

inputUsuario.addEventListener('keyup', () => {
    let usuario = inputUsuario.value.length;
    if (usuario >= 0 && usuario <= 5) {
        monster.src = 'img/read/1.png';
    } else if (usuario >= 6 && usuario <= 14) {
        monster.src = 'img/read/2.png';
    } else if (usuario >= 15 && usuario <= 20) {
        monster.src = 'img/read/3.png';
    } else {
        monster.src = 'img/read/4.png';
    }
});

inputClave.addEventListener('focus', () => {
    seguirPunteroMouse = false;
    let cont = 1;
    const cubrirOjo = setInterval(() => {
        monster.src = 'img/cover/' + cont + '.png';
        if (cont < 8) {
            cont++;
        } else {
            clearInterval(cubrirOjo);
        }
    }, 60);
});

inputClave.addEventListener('blur', () => {
    seguirPunteroMouse = true;
    let cont = 7;
    const descubrirOjo = setInterval(() => {
        monster.src = 'img/cover/' + cont + '.png';
        if (cont > 1) {
            cont--;
        } else {
            clearInterval(descubrirOjo);
        }
    }, 60);
});

// Authentication and stock management logic
function showRegisterForm() {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
}

function showLoginForm() {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
}

async function handleLogin() {
    const username = document.getElementById('input-usuario').value;
    const password = document.getElementById('input-clave').value;

    console.log('Enviando login:', { username, password });

    try {
        const response = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        console.log('Resposta do login:', { status: response.status, data });

        if (response.ok) {
            loginContainer.style.display = 'none';
            stockContainer.style.display = 'block';
            loadStock();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Erro no login:', error.message);
        alert('Erro no servidor: ' + error.message);
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    console.log('Enviando registro:', { username, password });

    try {
        const response = await fetch(`${BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        console.log('Resposta do registro:', { status: response.status, data });

        if (response.ok) {
            alert(data.message);
            showLoginForm();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Erro no registro:', error.message);
        alert('Erro no servidor: ' + error.message);
    }
}

function logout() {
    loginContainer.style.display = 'flex';
    stockContainer.style.display = 'none';
    document.getElementById('input-usuario').value = '';
    document.getElementById('input-clave').value = '';
    monster.src = 'img/idle/1.png';
}

async function loadStock() {
    try {
        const response = await fetch(`${BASE_URL}/api/estoque`);
        const estoque = await response.json();

        console.log('Estoque carregado:', { status: response.status, estoque });

        stockTableBody.innerHTML = '';

        for (const [id, item] of Object.entries(estoque)) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${id}</td>
                <td>${item.produto}</td>
                <td>${item.tipo}</td>
                <td>${item.lote}</td>
                <td>${item.validade || 'N/A'}</td>
                <td>${item.quantidade}</td>
                <td>
                    <button onclick="editProduct('${id}')">Editar</button>
                    <button onclick="deleteProduct('${id}')">Excluir</button>
                </td>
            `;
            stockTableBody.appendChild(row);
        }
    } catch (error) {
        console.error('Erro ao carregar estoque:', error.message);
        alert('Erro ao carregar estoque: ' + error.message);
    }
}

async function addProduct(event) {
    event.preventDefault();
    const produto = document.getElementById('produto').value;
    const tipo = document.getElementById('tipo').value;
    const lote = document.getElementById('lote').value;
    const validade = document.getElementById('validade').value;
    const quantidade = document.getElementById('quantidade').value;

    console.log('Enviando produto:', { produto, tipo, lote, validade, quantidade });

    try {
        const response = await fetch(`${BASE_URL}/api/estoque`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ produto, tipo, lote, validade, quantidade })
        });
        const data = await response.json();

        console.log('Resposta de adição de produto:', { status: response.status, data });

        if (response.ok) {
            stockForm.reset();
            loadStock();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Erro ao adicionar produto:', error.message);
        alert('Erro ao adicionar produto: ' + error.message);
    }
}

async function editProduct(id) {
    const produto = prompt('Novo produto:', '');
    const tipo = prompt('Novo tipo:', '');
    const lote = prompt('Novo lote:', '');
    const validade = prompt('Nova validade (YYYY-MM-DD):', '');
    const quantidade = prompt('Nova quantidade:', '');

    console.log('Enviando atualização de produto:', { id, produto, tipo, lote, validade, quantidade });

    try {
        const response = await fetch(`${BASE_URL}/api/estoque/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ produto, tipo, lote, validade, quantidade })
        });
        const data = await response.json();

        console.log('Resposta de atualização de produto:', { status: response.status, data });

        if (response.ok) {
            loadStock();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Erro ao atualizar produto:', error.message);
        alert('Erro ao atualizar produto: ' + error.message);
    }
}

async function deleteProduct(id) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        console.log('Enviando exclusão de produto:', { id });

        try {
            const response = await fetch(`${BASE_URL}/api/estoque/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            console.log('Resposta de exclusão de produto:', { status: response.status, data });

            if (response.ok) {
                loadStock();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Erro ao remover produto:', error.message);
            alert('Erro ao remover produto: ' + error.message);
        }
    }
}

stockForm.addEventListener('submit', addProduct);

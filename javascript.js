const BASE_URL = 'https://projeto-estoque-gcl4.onrender.com';

// Aguarda o carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, inicializando interface');

    // Seleção de elementos
    const monster = document.getElementById('monster');
    const inputUsuario = document.getElementById('input-usuario');
    const inputClave = document.getElementById('input-clave');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginContainer = document.getElementById('login-container');
    const stockContainer = document.getElementById('stock-container');
    const stockForm = document.getElementById('stock-form');
    const stockTableBody = document.getElementById('stock-table-body');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    const body = document.querySelector('body');

    // Verifica se os elementos existem
    if (!loginForm || !registerForm || !loginContainer || !stockContainer) {
        console.error('Erro: Elementos do DOM não encontrados');
        return;
    }

    // Inicializar estado da interface
    console.log('Exibindo login, ocultando estoque');
    body.classList.add('login-active');
    loginContainer.style.display = 'flex';
    stockContainer.style.display = 'none';
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';

    const anchoMitad = window.innerWidth / 2;
    const altoMitad = window.innerHeight / 2;
    let seguirPunteroMouse = true;

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
        } else if (usuario >= 6 && usuario <= 14 cron) {
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
        console.log('Exibindo formulário de cadastro');
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }

    function showLoginForm() {
        console.log('Exibindo formulário de login');
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    }

    async function handleLogin(event) {
        event.preventDefault();
        console.log('Formulário de login submetido');
        const username = document.getElementById('input-usuario').value;
        const password = document.getElementById('input-clave').value;

        if (!username || !password) {
            console.log('Usuário ou senha vazios');
            alert('Por favor, preencha usuário e senha');
            return;
        }

        console.log('Enviando login:', { username, password });

        try {
            console.log('Iniciando requisição para:', `${BASE_URL}/api/login`);
            const response = await fetch(`${BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });

            console.log('Resposta recebida:', { status: response.status, ok: response.ok });

            const data = await response.json();
            console.log('Dados da resposta:', data);

            if (response.ok) {
                console.log('Login bem-sucedido, exibindo estoque');
                body.classList.remove('login-active');
                body.classList.add('stock-active');
                loginContainer.style.display = 'none';
                stockContainer.style.display = 'block';
                console.log('stock-container visível:', stockContainer.style.display);
                loadStock();
            } else {
                console.log('Erro no login:', data.error);
                alert(data.error || 'Erro ao fazer login');
            }
        } catch (error) {
            console.error('Erro na requisição de login:', error.message);
            alert('Erro no servidor: ' + error.message);
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        console.log('Formulário de cadastro submetido');
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;

        if (!username || !password) {
            console.log('Usuário ou senha vazios');
            alert('Por favor, preencha usuário e senha');
            return;
        }

        console.log('Enviando registro:', { username, password });

        try {
            console.log('Iniciando requisição para:', `${BASE_URL}/api/register`);
            const response = await fetch(`${BASE_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            console.log('Resposta recebida:', { status: response.status, ok: response.ok });

            const data = await response.json();
            console.log('Dados da resposta:', data);

            if (response.ok) {
                alert(data.message);
                showLoginForm();
            } else {
                console.log('Erro no registro:', data.error);
                alert(data.error || 'Erro ao cadastrar');
            }
        } catch (error) {
            console.error('Erro na requisição de registro:', error.message);
            alert('Erro no servidor: ' + error.message);
        }
    }

    function logout() {
        console.log('Logout: retornando à tela de login');
        body.classList.remove('stock-active');
        body.classList.add('login-active');
        loginContainer.style.display = 'flex';
        stockContainer.style.display = 'none';
        document.getElementById('input-usuario').value = '';
        document.getElementById('input-clave').value = '';
        monster.src = 'img/idle/1.png';
    }

    async function loadStock() {
        try {
            console.log('Carregando estoque...');
            const response = await fetch(`${BASE_URL}/api/estoque`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
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

            console.log('Tabela de estoque atualizada');
        } catch (error) {
            console.error('Erro ao carregar estoque:', error.message);
            alert('Erro ao carregar estoque: ' + error.message);
        }
    }

    async function addProduct(event) {
        event.preventDefault();
        console.log('Formulário de adição de produto submetido');
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
                console.log('Erro ao adicionar produto:', data.error);
                alert(data.error || 'Erro ao adicionar produto');
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
                console.log('Erro ao atualizar produto:', data.error);
                alert(data.error || 'Erro ao atualizar produto');
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
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();

                console.log('Resposta de exclusão de produto:', { status: response.status, data });

                if (response.ok) {
                    loadStock();
                } else {
                    console.log('Erro ao excluir produto:', data.error);
                    alert(data.error || 'Erro ao excluir produto');
                }
            } catch (error) {
                console.error('Erro ao remover produto:', error.message);
                alert('Erro ao remover produto: ' + error.message);
            }
        }
    }

    // Event Listeners
    console.log('Adicionando listeners para formulários');
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    showRegisterBtn.addEventListener('click', showRegisterForm);
    showLoginBtn.addEventListener('click', showLoginForm);
    logoutBtn.addEventListener('click', logout);
    stockForm.addEventListener('submit', addProduct);

    // Fallback para o botão Entrar
    const loginButton = loginForm.querySelector('button[type="submit"]');
    loginButton.addEventListener('click', (event) => {
        console.log('Botão Entrar clicado');
        handleLogin(event);
    });
});

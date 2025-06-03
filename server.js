const BASE_URL = 'https://projeto-estoque-gcl4.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, inicializando interface');

    // Seleção de elementos
    const monster = document.getElementById('monster');
    const inputUsuario = document.getElementById('input-usuario');
    const inputClave = document.getElementById('input-clave');
    const togglePasswordLogin = document.getElementById('toggle-password-login');
    const togglePasswordRegister = document.getElementById('toggle-password-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginContainer = document.getElementById('login-container');
    const stockContainer = document.getElementById('stock-container');
    const stockForm = document.getElementById('stock-form');
    const stockTableBody = document.getElementById('stock-table-body');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    const userNameDisplay = document.getElementById('user-name');
    const userMenu = document.querySelector('.user-menu');
    const showAddProduct = document.getElementById('show-add-product');
    const showViewStock = document.getElementById('show-view-stock');
    const addProductSection = document.getElementById('add-product-section');
    const viewStockSection = document.getElementById('view-stock-section');
    const filterInput = document.getElementById('filter-input');
    const filterType = document.getElementById('filter-type');
    const body = document.querySelector('body');

    // Verifica se os elementos existem
    if (!loginForm || !registerForm || !loginContainer || !stockContainer) {
        console.error('Erro: Elementos do DOM não encontrados');
        return;
    }

    // Inicializar estado da interface
    console.log('Exibindo login, ocultando estoque');
    loginContainer.style.display = 'flex';
    stockContainer.style.display = 'none';
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    addProductSection.style.display = 'none';
    viewStockSection.style.display = 'none';

    const anchoMitad = window.innerWidth / 2;
    const altoMitad = window.innerHeight / 2;
    let seguirPunteroMouse = true;
    let currentUser = null; // Armazena o nome do usuário logado
    let estoqueData = []; // Armazena os dados do estoque

    // Lógica de animação do monstro
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

    // Função para alternar visibilidade da senha
    function togglePassword(inputId, button) {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            monster.src = 'img/idle/1.png';
            seguirPunteroMouse = false;
        } else {
            input.type = 'password';
            seguirPunteroMouse = true;
        }
    }

    if (togglePasswordLogin) {
        togglePasswordLogin.addEventListener('click', () => {
            togglePassword('input-clave', togglePasswordLogin);
        });
    }
    if (togglePasswordRegister) {
        togglePasswordRegister.addEventListener('click', () => {
            togglePassword('register-password', togglePasswordRegister);
        });
    }

    // Exibir/esconder menu do usuário
    userNameDisplay.addEventListener('click', () => {
        userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';
    });

    // Navegação da barra lateral
    showAddProduct.addEventListener('click', (e) => {
        e.preventDefault();
        addProductSection.style.display = 'block';
        viewStockSection.style.display = 'none';
    });

    showViewStock.addEventListener('click', (e) => {
        e.preventDefault();
        addProductSection.style.display = 'none';
        viewStockSection.style.display = 'block';
        loadStock();
    });

    // Função de autenticação
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
                console.log('Login bem-sucedido, exibindo container de estoque sem seções ativas');
                currentUser = username; // Armazena o usuário logado
                userNameDisplay.textContent = username; // Atualiza o display do usuário
                loginContainer.style.display = 'none';
                stockContainer.style.display = 'block';
                stockContainer.classList.add('active');
                addProductSection.style.display = 'none'; // Garante que a seção de adicionar produto esteja oculta
                viewStockSection.style.display = 'none'; // Garante que a seção de estoque esteja oculta
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
        loginContainer.style.display = 'flex';
        stockContainer.style.display = 'none';
        stockContainer.classList.remove('active');
        document.getElementById('input-usuario').value = '';
        document.getElementById('input-clave').value = '';
        monster.src = 'img/idle/1.png';
        currentUser = null;
        userNameDisplay.textContent = 'Usuário';
        userMenu.style.display = 'none';
    }

    // Função para carregar e paginar estoque usando pagination.js
    async function loadStock() {
        try {
            console.log('Carregando estoque...');
            const response = await fetch(`${BASE_URL}/api/estoque`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            estoqueData = await response.json();

            console.log('Estoque carregado:', { status: response.status, estoque: estoqueData });

            // Inicializar paginação
            $('#pagination').pagination({
                dataSource: Object.entries(filterStock(estoqueData)),
                pageSize: 5,
                callback: function(data, pagination) {
                    renderStock(data);
                }
            });
        } catch (error) {
            console.error('Erro ao carregar estoque:', error.message);
            alert('Erro ao carregar estoque: ' + error.message);
        }
    }

    function filterStock(data) {
        const query = filterInput.value.toLowerCase();
        const type = filterType.value;

        if (!query) return data;

        return Object.fromEntries(
            Object.entries(data).filter(([id, item]) => {
                if (type === 'produto') {
                    return item.produto.toLowerCase().includes(query);
                } else if (type === 'tipo') {
                    return item.tipo.toLowerCase().includes(query);
                } else {
                    return (
                        item.produto.toLowerCase().includes(query) ||
                        item.tipo.toLowerCase().includes(query)
                    );
                }
            })
        );
    }

    function renderStock(data) {
        stockTableBody.innerHTML = '';
        for (const [id, item] of data) {
            const row = document.createElement('tr');
            row.setAttribute('data-id', id);
            row.innerHTML = `
                <td>${id}</td>
                <td>${item.produto}</td>
                <td>${item.tipo}</td>
                <td>${item.lote}</td>
                <td>${item.validade || 'N/A'}</td>
                <td>${item.quantidade}</td>
                <td>
                    <button class="edit-btn" data-id="${id}">Editar</button>
                    <button class="delete-btn" data-id="${id}">Excluir</button>
                </td>
            `;
            stockTableBody.appendChild(row);
        }

        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', () => editProduct(button.getAttribute('data-id')));
        });
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', () => showDeleteModal(button.getAttribute('data-id')));
        });
    }

    filterInput.addEventListener('input', () => {
        $('#pagination').pagination('destroy').pagination({
            dataSource: Object.entries(filterStock(estoqueData)),
            pageSize: 5,
            callback: function(data, pagination) {
                renderStock(data);
            }
        });
    });

    filterType.addEventListener('change', () => {
        $('#pagination').pagination('destroy').pagination({
            dataSource: Object.entries(filterStock(estoqueData)),
            pageSize: 5,
            callback: function(data, pagination) {
                renderStock(data);
            }
        });
    });

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
                body: JSON.stringify({ produto, tipo, lote, validade, quantidade }),
                credentials: 'include'
            });
            const data = await response.json();

            console.log('Resposta de adição de produto:', { status: response.status, data });

            if (response.ok) {
                stockForm.reset();
                alert('Produto adicionado com sucesso!');
                addProductSection.style.display = 'none'; // Oculta a seção após adicionar
            } else {
                console.log('Erro ao adicionar produto:', data.error);
                alert(data.error || 'Erro ao adicionar produto');
            }
        } catch (error) {
            console.error('Erro ao adicionar produto:', error.message);
            alert('Erro ao adicionar produto: ' + error.message);
        }
    }

    function editProduct(id) {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        const cells = row.querySelectorAll('td');
        const produto = cells[1].textContent;
        const tipo = cells[2].textContent;
        const lote = cells[3].textContent;
        const validade = cells[4].textContent === 'N/A' ? '' : cells[4].textContent;
        const quantidade = cells[5].textContent;

        row.innerHTML = `
            <td>${id}</td>
            <td><input type="text" class="edit-input" value="${produto}" data-field="produto"></td>
            <td><input type="text" class="edit-input" value="${tipo}" data-field="tipo"></td>
            <td><input type="text" class="edit-input" value="${lote}" data-field="lote"></td>
            <td><input type="date" class="edit-input" value="${validade}" data-field="validade"></td>
            <td><input type="number" class="edit-input" value="${quantidade}" data-field="quantidade"></td>
            <td>
                <button class="save-btn" data-id="${id}">Salvar</button>
                <button class="cancel-btn" data-id="${id}">Cancelar</button>
            </td>
        `;

        row.querySelector('.save-btn').addEventListener('click', () => saveProduct(id));
        row.querySelector('.cancel-btn').addEventListener('click', () => loadStock());
    }

    async function saveProduct(id) {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        const inputs = row.querySelectorAll('.edit-input');
        const updatedProduct = {
            produto: inputs[0].value,
            tipo: inputs[1].value,
            lote: inputs[2].value,
            validade: inputs[3].value || null,
            quantidade: parseInt(inputs[4].value) || 0
        };

        console.log('Enviando atualização de produto:', { id, ...updatedProduct });

        try {
            const response = await fetch(`${BASE_URL}/api/estoque/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProduct),
                credentials: 'include'
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

    function showDeleteModal(id) {
        const modal = document.createElement('div');
        modal.className = 'delete-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Confirmar Exclusão</h2>
                <p>Tem certeza que deseja excluir este produto?</p>
                <button class="confirm-delete-btn" data-id="${id}">Confirmar</button>
                <button class="cancel-delete-btn">Cancelar</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.confirm-delete-btn').addEventListener('click', async () => {
            await performDelete(id);
            modal.remove();
        });
        modal.querySelector('.cancel-delete-btn').addEventListener('click', () => {
            modal.remove();
        });
    }

    async function performDelete(id) {
        console.log('Enviando exclusão de produto:', { id });

        try {
            const response = await fetch(`${BASE_URL}/api/estoque/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
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

    // Event Listeners
    console.log('Adicionando listeners para formulários');
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    showRegisterBtn.addEventListener('click', showRegisterForm);
    showLoginBtn.addEventListener('click', showLoginForm);
    logoutBtn.addEventListener('click', logout);
    stockForm.addEventListener('submit', addProduct);

    const loginButton = loginForm.querySelector('button[type="submit"]');
    loginButton.addEventListener('click', (event) => {
        console.log('Botão Entrar clicado');
        handleLogin(event);
    });
});

const BASE_URL = 'https://projeto-estoque-o1x5.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, inicializando interface');

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
    const addProductSection = document.getElementById('add-product-section');
    const viewStockSection = document.getElementById('view-stock-section');
    const homeSection = document.getElementById('home-section');
    const filterInput = document.getElementById('filter-input');
    const filterType = document.getElementById('filter-type');
    const body = document.querySelector('body');
    const estoqueMenu = document.getElementById('estoque-menu');
    const homeMenu = document.getElementById('home-menu');
    const submenu = document.querySelector('.submenu');

    // Elementos do modal de foto de perfil
    const userProfilePic = document.getElementById('user-profile-pic');
    const profileModal = document.getElementById('profile-modal');
    const profileModalPic = document.getElementById('profile-modal-pic');
    const closeProfileModal = document.getElementById('close-profile-modal');
    const changePhotoBtn = document.getElementById('change-photo-btn');
    const photoUpload = document.getElementById('photo-upload');

    if (!loginForm || !registerForm || !loginContainer || !stockContainer) {
        console.error('Erro: Elementos do DOM não encontrados');
        return;
    }

    console.log('Exibindo login, ocultando estoque');
    loginContainer.style.display = 'flex';
    stockContainer.style.display = 'none';
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    submenu.classList.remove('active');

    const anchoMitad = window.innerWidth / 2;
    const altoMitad = window.innerHeight / 2;
    let seguirPunteroMouse = true;
    let currentUser = null;

    // Funcionalidade do modal de foto de perfil
    function initProfilePhoto() {
        // Carregar foto salva do localStorage (se existir)
        const savedPhoto = localStorage.getItem(`profilePhoto_${currentUser}`);
        if (savedPhoto) {
            userProfilePic.src = savedPhoto;
            profileModalPic.src = savedPhoto;
        }

        // Abrir modal ao clicar na foto de perfil
        userProfilePic.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que o clique abra o menu do usuário
            profileModal.style.display = 'flex';
            profileModalPic.src = userProfilePic.src; // Sincronizar a imagem do modal
        });

        // Fechar modal
        closeProfileModal.addEventListener('click', () => {
            profileModal.style.display = 'none';
        });

        // Fechar modal clicando fora do conteúdo
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                profileModal.style.display = 'none';
            }
        });

        // Fechar modal com a tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && profileModal.style.display === 'flex') {
                profileModal.style.display = 'none';
            }
        });

        // Botão alterar foto
        changePhotoBtn.addEventListener('click', () => {
            photoUpload.click();
        });

        // Upload de foto
        photoUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Verificar se é uma imagem
                if (!file.type.startsWith('image/')) {
                    alert('Por favor, selecione apenas arquivos de imagem.');
                    return;
                }

                // Verificar tamanho do arquivo (máximo 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('O arquivo é muito grande. Por favor, selecione uma imagem menor que 5MB.');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageDataUrl = e.target.result;
                    
                    // Atualizar as imagens
                    userProfilePic.src = imageDataUrl;
                    profileModalPic.src = imageDataUrl;
                    
                    // Salvar no localStorage
                    localStorage.setItem(`profilePhoto_${currentUser}`, imageDataUrl);
                    
                    // Fechar o modal
                    profileModal.style.display = 'none';
                    
                    alert('Foto de perfil atualizada com sucesso!');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Função para resetar foto de perfil
    function resetProfilePhoto() {
        const defaultPhoto = 'https://via.placeholder.com/40x40/6a2f77/ffffff?text=👤';
        userProfilePic.src = defaultPhoto;
        profileModalPic.src = 'https://via.placeholder.com/200x200/6a2f77/ffffff?text=👤';
        
        // Remover foto salva do localStorage
        if (currentUser) {
            localStorage.removeItem(`profilePhoto_${currentUser}`);
        }
    }

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

    function togglePassword(inputId, button) {
        const input = document.getElementById(inputId);
        const showIcon = button.querySelector('.eye-icon.show');
        const hideIcon = button.querySelector('.eye-icon.hide');
        if (input.type === 'password') {
            input.type = 'text';
            if (showIcon) showIcon.style.display = 'none';
            if (hideIcon) hideIcon.style.display = 'block';
            monster.src = 'img/idle/1.png';
            seguirPunteroMouse = false;
        } else {
            input.type = 'password';
            if (showIcon) showIcon.style.display = 'block';
            if (hideIcon) hideIcon.style.display = 'none';
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

    userNameDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';
    });

    // Fechar menu do usuário ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-profile')) {
            userMenu.style.display = 'none';
        }
    });

    // Evento para o menu "Início" - volta para a tela inicial (apenas home)
    homeMenu.addEventListener('click', () => {
        addProductSection.style.display = 'none';
        viewStockSection.style.display = 'none'; // Mudança aqui: ocultar o estoque
        homeSection.style.display = 'block';
        submenu.classList.remove('active');
        console.log('Voltando para a tela inicial - apenas home');
    });

    // Evento para o menu "Estoque" - carrega e exibe o estoque
    estoqueMenu.addEventListener('click', () => {
        submenu.classList.toggle('active');
        // Exibir a seção de visualização do estoque e carregar os dados
        addProductSection.style.display = 'none';
        viewStockSection.style.display = 'block';
        homeSection.style.display = 'none';
        loadStock();
    });

    showAddProduct.addEventListener('click', (e) => {
        e.preventDefault();
        addProductSection.style.display = 'block';
        viewStockSection.style.display = 'none';
        homeSection.style.display = 'none';
    });

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
                console.log('Login bem-sucedido, exibindo painel principal');
                currentUser = username;
                userNameDisplay.textContent = username;
                loginContainer.style.display = 'none';
                stockContainer.style.display = 'block';
                stockContainer.classList.add('active');
                // Exibir apenas a seção home inicial
                addProductSection.style.display = 'none';
                viewStockSection.style.display = 'none';
                homeSection.style.display = 'block';
                
                // Inicializar funcionalidade de foto de perfil
                initProfilePhoto();
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
        profileModal.style.display = 'none'; // Fechar modal se estiver aberto
        resetProfilePhoto(); // Resetar foto de perfil
        // Resetar as seções
        addProductSection.style.display = 'none';
        viewStockSection.style.display = 'none';
        homeSection.style.display = 'none';
        submenu.classList.remove('active');
    }

    let estoqueData = [];
    const itemsPerPage = 5;

    async function loadStock(page = 1) {
        try {
            console.log('Carregando estoque...');
            const response = await fetch(`${BASE_URL}/api/estoque`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            estoqueData = await response.json();

            console.log('Estoque carregado:', { status: response.status, estoque: estoqueData });

            renderStock(filterStock(estoqueData), page);
            setupPagination(Object.keys(filterStock(estoqueData)).length, page);
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

    function renderStock(data, page) {
        stockTableBody.innerHTML = '';
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const items = Object.entries(data).slice(start, end);

        for (const [id, item] of items) {
            const row = document.createElement('tr');
            row.setAttribute('data-id', id);
            row.innerHTML = `
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

    function setupPagination(totalItems, currentPage) {
        const pageCount = Math.ceil(totalItems / itemsPerPage);
        const pagination = document.getElementById('pagination');
        pagination.innerHTML = '';

        for (let i = 1; i <= pageCount; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            button.className = i === currentPage ? 'active' : '';
            button.addEventListener('click', () => loadStock(i));
            pagination.appendChild(button);
        }
    }

    filterInput.addEventListener('input', () => loadStock(1));
    filterType.addEventListener('change', () => loadStock(1));

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
                alert('Produto adicionado com sucesso!');
                stockForm.reset();
                // Só recarregar o estoque se a seção estiver visível
                if (viewStockSection.style.display !== 'none') {
                    loadStock();
                }
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
        const produto = cells[0].textContent;
        const tipo = cells[1].textContent;
        const lote = cells[2].textContent;
        const validade = cells[3].textContent === 'N/A' ? '' : cells[3].textContent;
        const quantidade = cells[4].textContent;

        row.innerHTML = `
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
                alert('Produto atualizado com sucesso!');
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
                alert('Produto excluído com sucesso!');
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

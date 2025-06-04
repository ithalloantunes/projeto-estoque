const BASE_URL = 'https://projeto-estoque-gcl4.onrender.com';

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

    // Função para verificar condições especiais dos produtos
    function checkProductConditions(item) {
        const conditions = {
            lowStock: false,
            expireSoon: false
        };

        // Verificar estoque baixo (menos de 10 unidades)
        if (parseInt(item.quantidade) < 10) {
            conditions.lowStock = true;
        }

        // Verificar vencimento próximo (próximos 30 dias)
        if (item.validade && item.validade !== 'N/A') {
            const validadeDate = new Date(item.validade);
            const hoje = new Date();
            const diasParaVencer = Math.ceil((validadeDate - hoje) / (1000 * 60 * 60 * 24));
            
            if (diasParaVencer <= 30 && diasParaVencer >= 0) {
                conditions.expireSoon = true;
            }
        }

        return conditions;
    }

    function renderStock(data, page) {
        stockTableBody.innerHTML = '';
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const items = Object.entries(data).slice(start, end);

        for (const [id, item] of items) {
            const row = document.createElement('tr');
            row.setAttribute('data-id', id);
            
            // Verificar condições especiais do produto
            const conditions = checkProductConditions(item);
            
            // Aplicar classes condicionais
            if (conditions.lowStock) {
                row.setAttribute('data-low-stock', 'true');
            }
            if (conditions.expireSoon) {
                row.setAttribute('data-expire-soon', 'true');
            }
            
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
            
            // Adicionar animação de entrada
            row.style.animation = 'slideIn 0.3s ease-out';
            
            stockTableBody.appendChild(row);
        }

        // Adicionar event listeners para os botões
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

        // Botão "Anterior"
        if (currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '‹';
            prevButton.title = 'Página Anterior';
            prevButton.addEventListener('click', () => loadStock(currentPage - 1));
            pagination.appendChild(prevButton);
        }

        // Botões de página
        for (let i = 1; i <= pageCount; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            button.className = i === currentPage ? 'active' : '';
            button.addEventListener('click', () => loadStock(i));
            pagination.appendChild(button);
        }

        // Botão "Próximo"
        if (currentPage < pageCount) {
            const nextButton = document.createElement('button');
            nextButton.textContent = '›';
            nextButton.title = 'Próxima Página';
            nextButton.addEventListener('click', () => loadStock(currentPage + 1));
            pagination.appendChild(nextButton);
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

        // Adicionar classe de edição
        row.classList.add('editing');

        row.innerHTML = `
            <td><input type="text" class="edit-input" value="${produto}" data-field="produto"></td>
            <td><input type="text" class="edit-input" value="${tipo}" data-field="tipo"></td>
            <td><input type="text" class="edit-input" value="${lote}" data-field="lote"></td>
            <td><input type="date" class="edit-input" value="${validade}" data-field="validade"></td>
            <td><input type="number" class="edit-input" value="${quantidade}" data-field="quantidade" min="0"></td>
            <td>
                <button class="save-btn" data-id="${id}">Salvar</button>
                <button class="cancel-btn" data-id="${id}">Cancelar</button>
            </td>
        `;

        // Focar no primeiro input
        const firstInput = row.querySelector('.edit-input');
        if (firstInput) {
            firstInput.focus();
        }

        row.querySelector('.save-btn').addEventListener('click', () => saveProduct(id));
        row.querySelector('.cancel-btn').addEventListener('click', () => {
            row.classList.remove('editing');
            loadStock();
        });

        // Permitir salvar com Enter
        row.querySelectorAll('.edit-input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    saveProduct(id);
                }
            });
        });
    }

    async function saveProduct(id) {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        const inputs = row.querySelectorAll('.edit-input');
        
        // Validação básica
        if (!inputs[0].value.trim()) {
            alert('O nome do produto é obrigatório!');
            inputs[0].focus();
            return;
        }

        if (parseInt(inputs[4].value) < 0) {
            alert('A quantidade não pode ser negativa!');
            inputs[4].focus();
            return;
        }

        const updatedProduct = {
            produto: inputs[0].value.trim(),
            tipo: inputs[1].value.trim(),
            lote: inputs[2].value.trim(),
            validade: inputs[3].value || null,
            quantidade: parseInt(inputs[4].value) || 0
        };

        console.log('Enviando atualização de produto:', { id, ...updatedProduct });

        // Adicionar classe de loading
        row.classList.add('loading-row');

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
                row.classList.remove('editing', 'loading-row');
                loadStock();
            } else {
                console.log('Erro ao atualizar produto:', data.error);
                alert(data.error || 'Erro ao atualizar produto');
                row.classList.remove('loading-row');
            }
        } catch (error) {
            console.error('Erro ao atualizar produto:', error.message);
            alert('Erro ao atualizar produto: ' + error.message);
            row.classList.remove('loading-row');
        }
    }

    function showDeleteModal(id) {
        // Buscar o produto para mostrar informações na confirmação
        const row = document.querySelector(`tr[data-id="${id}"]`);
        const produtoNome = row.querySelector('td').textContent;

        const modal = document.createElement('div');
        modal.className = 'delete-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        `;
        
        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                text-align: center;
                max-width: 400px;
                animation: slideIn 0.3s ease;
            ">
                <h2 style="color: #e74c3c; margin-bottom: 15px;">⚠️ Confirmar Exclusão</h2>
                <p style="margin-bottom: 20px; color: #333;">
                    Tem certeza que deseja excluir o produto:<br>
                    <strong>"${produtoNome}"</strong>?
                </p>
                <p style="font-size: 0.9em; color: #666; margin-bottom: 25px;">
                    Esta ação não pode ser desfeita.
                </p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="confirm-delete-btn" data-id="${id}" style="
                        background: linear-gradient(135deg, #e74c3c, #c0392b);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.3s ease;
                    ">Confirmar Exclusão</button>
                    <button class="cancel-delete-btn" style="
                        background: linear-gradient(135deg, #95a5a6, #7f8c8d);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.3s ease;
                    ">Cancelar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Adicionar estilos de animação
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Event listeners para os botões
        modal.querySelector('.confirm-delete-btn').addEventListener('click', async () => {
            await performDelete(id);
            document.body.removeChild(modal);
            document.head.removeChild(style);
        });
        
        

        modal.querySelector('.cancel-delete-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            document.head.removeChild(style);
        });

        // Fechar modal clicando fora do conteúdo
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                document.head.removeChild(style);
            }
        });

        // Fechar modal com a tecla ESC
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.head.removeChild(style);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    async function performDelete(id) {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        
        console.log('Enviando exclusão de produto:', { id });

        // Adicionar animação de saída
        row.classList.add('removing');

        try {
            const response = await fetch(`${BASE_URL}/api/estoque/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();

            console.log('Resposta de exclusão de produto:', { status: response.status, data });

            if (response.ok) {
                // Aguardar a animação de saída antes de recarregar
                setTimeout(() => {
                    alert('Produto excluído com sucesso!');
                    loadStock();
                }, 300);
            } else {
                console.log('Erro ao excluir produto:', data.error);
                alert(data.error || 'Erro ao excluir produto');
                row.classList.remove('removing');
            }
        } catch (error) {
            console.error('Erro ao excluir produto:', error.message);
            alert('Erro ao excluir produto: ' + error.message);
            row.classList.remove('removing');
        }
    }

    function showLoginForm() {
        console.log('Exibindo formulário de login');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        document.getElementById('register-username').value = '';
        document.getElementById('register-password').value = '';
    }

    function showRegisterForm() {
        console.log('Exibindo formulário de cadastro');
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        document.getElementById('input-usuario').value = '';
        document.getElementById('input-clave').value = '';
    }

    // Event Listeners para os formulários
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    stockForm.addEventListener('submit', addProduct);
    
    showRegisterBtn.addEventListener('click', showRegisterForm);
    showLoginBtn.addEventListener('click', showLoginForm);
    logoutBtn.addEventListener('click', logout);

    // Funcionalidades adicionais para melhorar a experiência do usuário

    // Adicionar tooltips aos botões
    function addTooltips() {
        const style = document.createElement('style');
        style.textContent = `
            .tooltip {
                position: relative;
                display: inline-block;
            }
            
            .tooltip::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: 125%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 0.8rem;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
                z-index: 1000;
            }
            
            .tooltip::before {
                content: '';
                position: absolute;
                bottom: 115%;
                left: 50%;
                transform: translateX(-50%);
                border: 5px solid transparent;
                border-top-color: rgba(0, 0, 0, 0.8);
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .tooltip:hover::after,
            .tooltip:hover::before {
                opacity: 1;
                visibility: visible;
            }
        `;
        document.head.appendChild(style);
    }

    // Adicionar funcionalidade de busca em tempo real
    function setupRealTimeSearch() {
        let searchTimeout;
        
        filterInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                console.log('Realizando busca:', filterInput.value);
                loadStock(1);
            }, 300); // Debounce de 300ms
        });
    }

    // Adicionar funcionalidade de ordenação
    function setupTableSorting() {
        const headers = document.querySelectorAll('#stock-table th');
        let sortOrder = {};

        headers.forEach((header, index) => {
            if (index < 5) { // Excluir a coluna de ações
                header.style.cursor = 'pointer';
                header.style.userSelect = 'none';
                header.addEventListener('click', () => sortTable(index));
                
                // Adicionar indicador visual de ordenação
                const sortIcon = document.createElement('span');
                sortIcon.className = 'sort-icon';
                sortIcon.innerHTML = ' ↕️';
                sortIcon.style.opacity = '0.5';
                header.appendChild(sortIcon);
            }
        });

        function sortTable(columnIndex) {
            const currentOrder = sortOrder[columnIndex] || 'asc';
            const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
            sortOrder = { [columnIndex]: newOrder };

            // Atualizar ícones
            document.querySelectorAll('.sort-icon').forEach(icon => {
                icon.innerHTML = ' ↕️';
                icon.style.opacity = '0.5';
            });

            const currentIcon = headers[columnIndex].querySelector('.sort-icon');
            currentIcon.innerHTML = newOrder === 'asc' ? ' ↑' : ' ↓';
            currentIcon.style.opacity = '1';

            // Ordenar dados
            const sortedData = Object.entries(estoqueData).sort(([, a], [, b]) => {
                const fields = ['produto', 'tipo', 'lote', 'validade', 'quantidade'];
                const field = fields[columnIndex];
                
                let aValue = a[field] || '';
                let bValue = b[field] || '';

                // Tratamento especial para números
                if (field === 'quantidade') {
                    aValue = parseInt(aValue) || 0;
                    bValue = parseInt(bValue) || 0;
                }
                
                // Tratamento especial para datas
                if (field === 'validade') {
                    aValue = aValue && aValue !== 'N/A' ? new Date(aValue) : new Date(0);
                    bValue = bValue && bValue !== 'N/A' ? new Date(bValue) : new Date(0);
                }

                if (aValue < bValue) return newOrder === 'asc' ? -1 : 1;
                if (aValue > bValue) return newOrder === 'asc' ? 1 : -1;
                return 0;
            });

            // Reconverter para objeto
            const sortedObject = Object.fromEntries(sortedData);
            renderStock(sortedObject, 1);
            setupPagination(Object.keys(sortedObject).length, 1);
        }
    }

    // Adicionar funcionalidade de exportação
    function setupExportFeatures() {
        const exportBtn = document.createElement('button');
        exportBtn.innerHTML = '📊 Exportar CSV';
        exportBtn.className = 'export-btn';
        exportBtn.style.cssText = `
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            margin-bottom: 15px;
            transition: all 0.3s ease;
        `;
        
        exportBtn.addEventListener('mouseenter', () => {
            exportBtn.style.background = 'linear-gradient(135deg, #2980b9, #1f618d)';
            exportBtn.style.transform = 'translateY(-2px)';
            exportBtn.style.boxShadow = '0 4px 15px rgba(52, 152, 219, 0.3)';
        });
        
        exportBtn.addEventListener('mouseleave', () => {
            exportBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
            exportBtn.style.transform = 'translateY(0)';
            exportBtn.style.boxShadow = 'none';
        });

        exportBtn.addEventListener('click', exportToCSV);
        
        // Inserir antes da tabela
        const stockTable = document.getElementById('stock-table');
        stockTable.parentNode.insertBefore(exportBtn, stockTable);
    }

    function exportToCSV() {
        const headers = ['Produto', 'Tipo', 'Lote', 'Validade', 'Quantidade'];
        const csvContent = [
            headers.join(','),
            ...Object.values(estoqueData).map(item => [
                `"${item.produto}"`,
                `"${item.tipo}"`,
                `"${item.lote}"`,
                `"${item.validade || 'N/A'}"`,
                item.quantidade
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `estoque_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Adicionar funcionalidade de estatísticas
    function setupStatistics() {
        const statsContainer = document.createElement('div');
        statsContainer.className = 'stats-container';
        statsContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
            padding: 0;
        `;

        const homeSection = document.getElementById('home-section');
        const welcomeCard = homeSection.querySelector('.welcome-card');
        welcomeCard.parentNode.insertBefore(statsContainer, welcomeCard.nextSibling);

        updateStatistics();
    }

    function updateStatistics() {
        const statsContainer = document.querySelector('.stats-container');
        if (!statsContainer) return;

        const stats = calculateStats();
        
        statsContainer.innerHTML = `
            <div class="stat-card" style="
                background: linear-gradient(135deg, #3498db, #2980b9);
                color: white;
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
                transition: transform 0.3s ease;
            ">
                <h3 style="margin: 0 0 10px 0; font-size: 2rem;">📦</h3>
                <p style="margin: 0; font-size: 1.2rem; font-weight: bold;">${stats.totalProducts}</p>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Total de Produtos</p>
            </div>
            
            <div class="stat-card" style="
                background: linear-gradient(135deg, #e74c3c, #c0392b);
                color: white;
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
                transition: transform 0.3s ease;
            ">
                <h3 style="margin: 0 0 10px 0; font-size: 2rem;">⚠️</h3>
                <p style="margin: 0; font-size: 1.2rem; font-weight: bold;">${stats.lowStock}</p>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Estoque Baixo</p>
            </div>
            
            <div class="stat-card" style="
                background: linear-gradient(135deg, #f39c12, #d68910);
                color: white;
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 4px 15px rgba(243, 156, 18, 0.3);
                transition: transform 0.3s ease;
            ">
                <h3 style="margin: 0 0 10px 0; font-size: 2rem;">⏰</h3>
                <p style="margin: 0; font-size: 1.2rem; font-weight: bold;">${stats.expiringSoon}</p>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Vencem em 30 dias</p>
            </div>
            
            <div class="stat-card" style="
                background: linear-gradient(135deg, #27ae60, #229954);
                color: white;
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
                transition: transform 0.3s ease;
            ">
                <h3 style="margin: 0 0 10px 0; font-size: 2rem;">📊</h3>
                <p style="margin: 0; font-size: 1.2rem; font-weight: bold;">${stats.totalQuantity}</p>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Itens em Estoque</p>
            </div>
        `;

        // Adicionar efeito hover aos cards
        document.querySelectorAll('.stat-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-5px) scale(1.02)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0) scale(1)';
            });
        });
    }

    function calculateStats() {
        const products = Object.values(estoqueData);
        const stats = {
            totalProducts: products.length,
            lowStock: 0,
            expiringSoon: 0,
            totalQuantity: 0
        };

        products.forEach(product => {
            const quantity = parseInt(product.quantidade) || 0;
            stats.totalQuantity += quantity;

            // Estoque baixo
            if (quantity < 10) {
                stats.lowStock++;
            }

            // Vencimento próximo
            if (product.validade && product.validade !== 'N/A') {
                const validadeDate = new Date(product.validade);
                const hoje = new Date();
                const diasParaVencer = Math.ceil((validadeDate - hoje) / (1000 * 60 * 60 * 24));
                
                if (diasParaVencer <= 30 && diasParaVencer >= 0) {
                    stats.expiringSoon++;
                }
            }
        });

        return stats;
    }

    // Inicializar todas as funcionalidades quando a página carregar
    function initializeEnhancements() {
        addTooltips();
        setupRealTimeSearch();
        setupStatistics();
        
        // Aguardar um pouco para garantir que a tabela foi criada
        setTimeout(() => {
            setupTableSorting();
            setupExportFeatures();
        }, 1000);
    }

    // Modificar a função loadStock para atualizar estatísticas
    const originalLoadStock = loadStock;
    loadStock = async function(page = 1) {
        await originalLoadStock(page);
        updateStatistics();
    };

    // Inicializar melhorias
    initializeEnhancements();

    console.log('Sistema de controle de estoque inicializado com todas as melhorias!');
});

const BASE_URL = 'https://projeto-estoque-o1x5.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, inicializando interface');

    const monster           = document.getElementById('monster');
    const inputUsuario      = document.getElementById('input-usuario');
    const inputClave        = document.getElementById('input-clave');
    const togglePasswordLogin    = document.getElementById('toggle-password-login');
    const togglePasswordRegister = document.getElementById('toggle-password-register');
    const loginForm         = document.getElementById('login-form');
    const registerForm      = document.getElementById('register-form');
    const loginContainer    = document.getElementById('login-container');
    const stockContainer    = document.getElementById('stock-container');
    const stockForm         = document.getElementById('stock-form');
    const stockTableBody    = document.getElementById('stock-table-body');
    const showRegisterBtn   = document.getElementById('show-register');
    const showLoginBtn      = document.getElementById('show-login');
    const logoutBtn         = document.getElementById('logout-btn');
    const userNameDisplay   = document.getElementById('user-name');
    const userMenu          = document.querySelector('.user-menu');
    const showAddProduct    = document.getElementById('show-add-product');
    const addProductSection = document.getElementById('add-product-section');
    const viewStockSection  = document.getElementById('view-stock-section');
    const homeSection       = document.getElementById('home-section');
    const filterInput       = document.getElementById('filter-input');
    const filterType        = document.getElementById('filter-type');
    const body              = document.querySelector('body');
    const estoqueMenu       = document.getElementById('estoque-menu');
    const homeMenu          = document.getElementById('home-menu');
    const submenu           = document.querySelector('.submenu');

    // Elementos do modal de foto de perfil
    const userProfilePic   = document.getElementById('user-profile-pic');
    const profileModal     = document.getElementById('profile-modal');
    const profileModalPic  = document.getElementById('profile-modal-pic');
    const closeProfileModal= document.getElementById('close-profile-modal');
    const changePhotoBtn   = document.getElementById('change-photo-btn');
    const photoUpload      = document.getElementById('photo-upload');

    if (!loginForm || !registerForm || !loginContainer || !stockContainer) {
        console.error('Erro: Elementos do DOM não encontrados');
        return;
    }

    // Estado inicial de telas
    loginContainer.style.display   = 'flex';
    stockContainer.style.display   = 'none';
    loginForm.style.display        = 'block';
    registerForm.style.display     = 'none';
    submenu.classList.remove('active');

    const anchoMitad = window.innerWidth  / 2;
    const altoMitad  = window.innerHeight / 2;
    let seguirPunteroMouse = true;
    let currentUser        = null;

    // --- Funções de foto de perfil (inalteradas) ---
    function initProfilePhoto() {
        const savedPhoto = localStorage.getItem(`profilePhoto_${currentUser}`);
        if (savedPhoto) {
            userProfilePic.src = savedPhoto;
            profileModalPic.src = savedPhoto;
        }
        userProfilePic.addEventListener('click', e => {
            e.stopPropagation();
            profileModal.style.display = 'flex';
            profileModalPic.src = userProfilePic.src;
        });
        closeProfileModal.addEventListener('click', () => profileModal.style.display = 'none');
        profileModal.addEventListener('click', e => {
            if (e.target === profileModal) profileModal.style.display = 'none';
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && profileModal.style.display === 'flex') {
                profileModal.style.display = 'none';
            }
        });
        changePhotoBtn.addEventListener('click', () => photoUpload.click());
        photoUpload.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file || !file.type.startsWith('image/')) {
                return alert('Por favor, selecione apenas arquivos de imagem.');
            }
            if (file.size > 5 * 1024 * 1024) {
                return alert('O arquivo é muito grande. Por favor, selecione uma imagem menor que 5MB.');
            }
            const reader = new FileReader();
            reader.onload = e2 => {
                const imageDataUrl = e2.target.result;
                userProfilePic.src   = imageDataUrl;
                profileModalPic.src  = imageDataUrl;
                localStorage.setItem(`profilePhoto_${currentUser}`, imageDataUrl);
                profileModal.style.display = 'none';
                alert('Foto de perfil atualizada com sucesso!');
            };
            reader.readAsDataURL(file);
        });
    }

    function resetProfilePhoto() {
        const defaultPhoto = 'https://via.placeholder.com/40x40/6a2f77/ffffff?text=👤';
        userProfilePic.src   = defaultPhoto;
        profileModalPic.src  = 'https://via.placeholder.com/200x200/6a2f77/ffffff?text=👤';
        if (currentUser) {
            localStorage.removeItem(`profilePhoto_${currentUser}`);
        }
    }

    // Movimentação do monstro, toggle de senha etc. (inalterados)…
    body.addEventListener('mousemove', m => {
        if (!seguirPunteroMouse) return;
        if (m.clientX < anchoMitad && m.clientY < altoMitad)      monster.src = "img/idle/2.png";
        else if (m.clientX < anchoMitad && m.clientY > altoMitad) monster.src = "img/idle/3.png";
        else if (m.clientX > anchoMitad && m.clientY < altoMitad) monster.src = "img/idle/5.png";
        else                                                      monster.src = "img/idle/4.png";
    });
    inputUsuario.addEventListener('focus', () => seguirPunteroMouse = false);
    inputUsuario.addEventListener('blur',  () => seguirPunteroMouse = true);
    inputUsuario.addEventListener('keyup', () => {
        const len = inputUsuario.value.length;
        if (len <= 5)      monster.src = 'img/read/1.png';
        else if (len <= 14) monster.src = 'img/read/2.png';
        else if (len <= 20) monster.src = 'img/read/3.png';
        else                monster.src = 'img/read/4.png';
    });
    inputClave.addEventListener('focus', () => {
        seguirPunteroMouse = false;
        let cont = 1;
        const cubrir = setInterval(() => {
            monster.src = 'img/cover/' + cont + '.png';
            if (cont < 8) cont++; else clearInterval(cubrir);
        }, 60);
    });
    inputClave.addEventListener('blur', () => {
        seguirPunteroMouse = true;
        let cont = 7;
        const descobrir = setInterval(() => {
            monster.src = 'img/cover/' + cont + '.png';
            if (cont > 1) cont--; else clearInterval(descobrir);
        }, 60);
    });
    if (togglePasswordLogin) {
        togglePasswordLogin.addEventListener('click', () => {
            const input = document.getElementById('input-clave');
            if (input.type === 'password') {
                input.type = 'text';
                monster.src = 'img/idle/1.png';
                seguirPunteroMouse = false;
            } else {
                input.type = 'password';
                seguirPunteroMouse = true;
            }
        });
    }
    if (togglePasswordRegister) {
        togglePasswordRegister.addEventListener('click', () => {
            const input = document.getElementById('register-password');
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    }

    userNameDisplay.addEventListener('click', e => {
        e.stopPropagation();
        userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.user-profile')) {
            userMenu.style.display = 'none';
        }
    });

    homeMenu.addEventListener('click', () => {
        addProductSection.style.display  = 'none';
        viewStockSection.style.display   = 'none';
        homeSection.style.display        = 'block';
        submenu.classList.remove('active');
    });

    estoqueMenu.addEventListener('click', () => {
        submenu.classList.toggle('active');
        addProductSection.style.display  = 'none';
        viewStockSection.style.display   = 'block';
        homeSection.style.display        = 'none';
        loadStock();
    });

    showAddProduct.addEventListener('click', e => {
        e.preventDefault();
        addProductSection.style.display  = 'block';
        viewStockSection.style.display   = 'none';
        homeSection.style.display        = 'none';
    });

    // --- Autenticação (inalterada) ---
    async function handleLogin(event) {
        event.preventDefault();
        const username = inputUsuario.value;
        const password = inputClave.value;
        if (!username || !password) {
            return alert('Por favor, preencha usuário e senha');
        }
        try {
            const response = await fetch(`${BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                currentUser = username;
                userNameDisplay.textContent = username;
                loginContainer.style.display = 'none';
                stockContainer.style.display = 'block';
                addProductSection.style.display = 'none';
                viewStockSection.style.display = 'none';
                homeSection.style.display = 'block';
                initProfilePhoto();
            } else {
                alert(data.error || 'Erro ao fazer login');
            }
        } catch (err) {
            alert('Erro no servidor: ' + err.message);
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        if (!username || !password) {
            return alert('Por favor, preencha usuário e senha');
        }
        try {
            const response = await fetch(`${BASE_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                loginForm.style.display    = 'block';
                registerForm.style.display = 'none';
            } else {
                alert(data.error || 'Erro ao cadastrar');
            }
        } catch (err) {
            alert('Erro no servidor: ' + err.message);
        }
    }

    function logout() {
        loginContainer.style.display = 'flex';
        stockContainer.style.display = 'none';
        inputUsuario.value = '';
        inputClave.value   = '';
        monster.src        = 'img/idle/1.png';
        currentUser        = null;
        userNameDisplay.textContent = 'Usuário';
        userMenu.style.display      = 'none';
        profileModal.style.display  = 'none';
        resetProfilePhoto();
        addProductSection.style.display = 'none';
        viewStockSection.style.display  = 'none';
        homeSection.style.display       = 'none';
        submenu.classList.remove('active');
    }

    // --- Fluxo de Estoque (ATUALIZADO) ---
    let estoqueData = [];
    const itemsPerPage = 5;

    async function loadStock(page = 1) {
        try {
            const response = await fetch(`${BASE_URL}/api/estoque`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            console.log('Estoque carregado:', { status: response.status, estoque: data });

            // Trata sempre como array
            estoqueData = Array.isArray(data)
                ? data
                : Object.entries(data).map(([id, item]) => ({ id, ...item }));

            const filtered = filterStock(estoqueData);
            renderStock(filtered, page);
            setupPagination(filtered.length, page);
        } catch (error) {
            console.error('Erro ao carregar estoque:', error.message);
            alert('Erro ao carregar estoque: ' + error.message);
        }
    }

    function filterStock(data) {
        const q = filterInput.value.toLowerCase();
        const t = filterType.value;
        if (!q) return data;
        return data.filter(item => {
            if (t === 'produto') return item.produto.toLowerCase().includes(q);
            if (t === 'tipo')    return item.tipo.toLowerCase().includes(q);
            return (
                item.produto.toLowerCase().includes(q) ||
                item.tipo.toLowerCase().includes(q)
            );
        });
    }

    function renderStock(data, page) {
        stockTableBody.innerHTML = '';
        const start = (page - 1) * itemsPerPage;
        const end   = start + itemsPerPage;
        const pageItems = data.slice(start, end);

        for (const item of pageItems) {
            const row = document.createElement('tr');
            row.setAttribute('data-id', item.id);
            row.innerHTML = `
                <td>${item.produto}</td>
                <td>${item.tipo}</td>
                <td>${item.lote}</td>
                <td>${item.validade || 'N/A'}</td>
                <td>${item.quantidade}</td>
                <td>
                    <button class="edit-btn"   data-id="${item.id}">Editar</button>
                    <button class="delete-btn" data-id="${item.id}">Excluir</button>
                </td>
            `;
            stockTableBody.appendChild(row);
        }

        document.querySelectorAll('.edit-btn').forEach(btn =>
            btn.addEventListener('click', () => editProduct(btn.dataset.id))
        );
        document.querySelectorAll('.delete-btn').forEach(btn =>
            btn.addEventListener('click', () => showDeleteModal(btn.dataset.id))
        );
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
        const produto   = document.getElementById('produto').value;
        const tipo      = document.getElementById('tipo').value;
        const lote      = document.getElementById('lote').value;
        const validade  = document.getElementById('validade').value;
        const quantidade= document.getElementById('quantidade').value;

        try {
            const response = await fetch(`${BASE_URL}/api/estoque`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ produto, tipo, lote, validade, quantidade }),
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                alert('Produto adicionado com sucesso!');
                stockForm.reset();
                if (viewStockSection.style.display !== 'none') {
                    loadStock();
                }
            } else {
                alert(data.error || 'Erro ao adicionar produto');
            }
        } catch (err) {
            alert('Erro ao adicionar produto: ' + err.message);
        }
    }

    function editProduct(id) {
        const row   = document.querySelector(`tr[data-id="${id}"]`);
        const cells = row.querySelectorAll('td');
        const produto   = cells[0].textContent;
        const tipo      = cells[1].textContent;
        const lote      = cells[2].textContent;
        const validade  = cells[3].textContent === 'N/A' ? '' : cells[3].textContent;
        const quantidade= cells[4].textContent;

        row.innerHTML = `
            <td><input type="text" class="edit-input" value="${produto}"    data-field="produto"></td>
            <td><input type="text" class="edit-input" value="${tipo}"       data-field="tipo"></td>
            <td><input type="text" class="edit-input" value="${lote}"       data-field="lote"></td>
            <td><input type="date" class="edit-input" value="${validade}"   data-field="validade"></td>
            <td><input type="number" class="edit-input" value="${quantidade}" data-field="quantidade"></td>
            <td>
                <button class="save-btn"   data-id="${id}">Salvar</button>
                <button class="cancel-btn" data-id="${id}">Cancelar</button>
            </td>
        `;
        row.querySelector('.save-btn').addEventListener('click', () => saveProduct(id));
        row.querySelector('.cancel-btn').addEventListener('click', () => loadStock());
    }

    async function saveProduct(id) {
        const row    = document.querySelector(`tr[data-id="${id}"]`);
        const inputs = row.querySelectorAll('.edit-input');
        const updatedProduct = {
            produto:   inputs[0].value,
            tipo:      inputs[1].value,
            lote:      inputs[2].value,
            validade:  inputs[3].value || null,
            quantidade: parseInt(inputs[4].value, 10) || 0
        };
        try {
            const response = await fetch(`${BASE_URL}/api/estoque/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProduct),
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                alert('Produto atualizado com sucesso!');
                loadStock();
            } else {
                alert(data.error || 'Erro ao atualizar produto');
            }
        } catch (err) {
            alert('Erro ao atualizar produto: ' + err.message);
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
        modal.querySelector('.confirm-delete-btn')
             .addEventListener('click', async () => {
                 await performDelete(id);
                 modal.remove();
             });
        modal.querySelector('.cancel-delete-btn')
             .addEventListener('click', () => modal.remove());
    }

    async function performDelete(id) {
        try {
            const response = await fetch(`${BASE_URL}/api/estoque/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                alert('Produto excluído com sucesso!');
                loadStock();
            } else {
                alert(data.error || 'Erro ao excluir produto');
            }
        } catch (err) {
            alert('Erro ao remover produto: ' + err.message);
        }
    }

    function showRegisterForm() {
        loginForm.style.display    = 'none';
        registerForm.style.display = 'block';
    }

    function showLoginForm() {
        registerForm.style.display = 'none';
        loginForm.style.display    = 'block';
    }

    // --- Inicialização de listeners ---
    console.log('Adicionando listeners para formulários');
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    showRegisterBtn.addEventListener('click', showRegisterForm);
    showLoginBtn.addEventListener('click', showLoginForm);
    logoutBtn.addEventListener('click', logout);
    stockForm.addEventListener('submit', addProduct);
    const loginButton = loginForm.querySelector('button[type="submit"]');
    loginButton.addEventListener('click', event => {
        event.preventDefault();
        handleLogin(event);
    });
});

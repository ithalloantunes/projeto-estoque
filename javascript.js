// javascript.js

const BASE_URL = 'https://projeto-estoque-o1x5.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM carregado, inicializando interface');

  // Elementos gerais
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
  const movimentacoesTableBody = document.getElementById('movimentacoes-table-body');
  const showRegisterBtn   = document.getElementById('show-register');
  const showLoginBtn      = document.getElementById('show-login');
  const logoutBtn         = document.getElementById('logout-btn');
  const userNameDisplay   = document.getElementById('user-name');
  const userMenu          = document.querySelector('.user-menu');
  const approveUsersBtn   = document.getElementById('approve-users-btn');
  const deleteUsersBtn    = document.getElementById('delete-users-btn');
  const adminSection      = document.getElementById('admin-section');
  const pendingUsersList  = document.getElementById('pending-users-list');
  const usersList         = document.getElementById('users-list');
  const closeAdminBtn     = document.getElementById('close-admin');
  const showAddProduct    = document.getElementById('show-add-product');
  const addProductSection = document.getElementById('add-product-section');
  const viewStockSection  = document.getElementById('view-stock-section');
  const movimentacoesSection = document.getElementById('movimentacoes-section');
  const homeSection       = document.getElementById('home-section');
  const filterInput       = document.getElementById('filter-input');
  const filterType        = document.getElementById('filter-type');
  const body              = document.querySelector('body');
  const estoqueMenu       = document.getElementById('estoque-menu');
  const movimentacoesMenu = document.getElementById('movimentacoes-menu');
  const homeMenu          = document.getElementById('home-menu');
  const submenu           = document.querySelector('.submenu');

  // Elementos do modal de foto de perfil
  const userProfilePic    = document.getElementById('user-profile-pic');
  const profileModal      = document.getElementById('profile-modal');
  const profileModalPic   = document.getElementById('profile-modal-pic');
  const closeProfileModal = document.getElementById('close-profile-modal');
  const changePhotoBtn    = document.getElementById('change-photo-btn');
  const photoUpload       = document.getElementById('photo-upload');

  if (!loginForm || !registerForm || !loginContainer || !stockContainer) {
    console.error('Erro: Elementos do DOM não encontrados');
    return;
  }

  // Estado inicial
  loginContainer.style.display   = 'flex';
  stockContainer.style.display   = 'none';
  loginForm.style.display        = 'block';
  registerForm.style.display     = 'none';
  submenu.classList.remove('active');

  let seguirPunteroMouse = true;
  let currentUser        = null;
  let userRole          = null;
  const anchoMitad = window.innerWidth / 2;
  const altoMitad  = window.innerHeight / 2;

  // --- Foto de perfil ---
  function initProfilePhoto() {
    const saved = localStorage.getItem(`profilePhoto_${currentUser}`);
    if (saved) {
      userProfilePic.src = saved;
      profileModalPic.src = saved;
    }
    userProfilePic.addEventListener('click', e => {
      e.stopPropagation();
      profileModal.style.display = 'flex';
      profileModalPic.src = userProfilePic.src;
    });
    closeProfileModal.addEventListener('click', () => {
      profileModal.style.display = 'none';
    });
    changePhotoBtn.addEventListener('click', () => photoUpload.click());
    photoUpload.addEventListener('change', () => {
      const file = photoUpload.files[0];
      if (!file || !file.type.startsWith('image/')) {
        alert('Selecione um arquivo de imagem.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Imagem deve ser menor que 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        userProfilePic.src = reader.result;
        profileModalPic.src = reader.result;
        localStorage.setItem(`profilePhoto_${currentUser}`, reader.result);
        profileModal.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });
  }

  function resetProfilePhoto() {
    const defaultPic = 'https://i.ibb.co/bg3wvFK0/585e4beacb11b227491c3399.png';
    userProfilePic.src = defaultPic;
    profileModalPic.src = defaultPic.replace('40x40','200x200');
    if (currentUser) {
      localStorage.removeItem(`profilePhoto_${currentUser}`);
    }
  }

  // --- Monstro segue cursor (inalterado) ---
  body.addEventListener('mousemove', m => {
    if (!seguirPunteroMouse) return;
    if (m.clientX < anchoMitad && m.clientY < altoMitad)      monster.src = "img/idle/2.png";
    else if (m.clientX < anchoMitad && m.clientY > altoMitad) monster.src = "img/idle/3.png";
    else if (m.clientX > anchoMitad && m.clientY < altoMitad) monster.src = "img/idle/5.png";
    else                                                      monster.src = "img/idle/4.png";
  });
  inputUsuario.addEventListener('focus', () => seguirPunteroMouse = false);
  inputUsuario.addEventListener('blur',  () => seguirPunteroMouse = true);
  inputClave.addEventListener('focus', () => {
    seguirPunteroMouse = false;
    let cont = 1;
    const covering = setInterval(() => {
      monster.src = `img/cover/${cont}.png`;
      if (cont++ === 8) clearInterval(covering);
    }, 60);
  });
  inputClave.addEventListener('blur', () => {
    seguirPunteroMouse = true;
    let cont = 8;
    const uncovering = setInterval(() => {
      monster.src = `img/cover/${--cont}.png`;
      if (cont === 1) clearInterval(uncovering);
    }, 60);
  });
  if (togglePasswordLogin) {
    togglePasswordLogin.addEventListener('click', () => {
      const pwd = document.getElementById('input-clave');
      if (pwd.type === 'password') {
        pwd.type = 'text';
        monster.src = 'img/idle/1.png';
        seguirPunteroMouse = false;
      } else {
        pwd.type = 'password';
        seguirPunteroMouse = true;
      }
    });
  }
  if (togglePasswordRegister) {
    togglePasswordRegister.addEventListener('click', () => {
      const pwd = document.getElementById('register-password');
      pwd.type = pwd.type === 'password' ? 'text' : 'password';
    });
  }

  userNameDisplay.addEventListener('click', e => {
    e.stopPropagation();
    userMenu.style.display = userMenu.style.display === 'block' ? 'none' : 'block';
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.user-profile')) {
      userMenu.style.display = 'none';
    }
  });

  homeMenu.addEventListener('click', () => {
    addProductSection.style.display  = 'none';
    viewStockSection.style.display   = 'none';
    movimentacoesSection.style.display = 'none';
    homeSection.style.display        = 'block';
    submenu.classList.remove('active');
  });

  estoqueMenu.addEventListener('click', () => {
    submenu.classList.toggle('active');
    addProductSection.style.display  = 'none';
    viewStockSection.style.display   = 'block';
    movimentacoesSection.style.display = 'none';
    homeSection.style.display        = 'none';
    loadStock();
  });

movimentacoesMenu.addEventListener('click', () => {
    addProductSection.style.display  = 'none';
    viewStockSection.style.display   = 'none';
    submenu.classList.remove('active');
    homeSection.style.display        = 'none';
    movimentacoesSection.style.display = 'block';
    loadMovimentacoes();
  });
  
  showAddProduct.addEventListener('click', e => {
    e.preventDefault();
    addProductSection.style.display  = 'block';
    viewStockSection.style.display   = 'none';
    movimentacoesSection.style.display = 'none';
    homeSection.style.display        = 'none';
  });

  // --- Autenticação ---
  async function handleLogin(e) {
    e.preventDefault();
    const username = inputUsuario.value;
    const password = inputClave.value;
    if (!username || !password) return alert('Preencha usuário e senha');
    try {
      const res  = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        currentUser            = username;
        userRole              = data.role;
        userNameDisplay.textContent = username;
        loginContainer.style.display = 'none';
        stockContainer.style.display = 'block';
        homeSection.style.display     = 'block';
        if (userRole === 'admin') {
          approveUsersBtn.style.display = 'block';
          deleteUsersBtn.style.display  = 'block';
        }
        initProfilePhoto();
      } else {
        alert(data.error || 'Erro no login');
      }
    } catch (err) {
      alert('Erro no servidor: ' + err.message);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    if (!username || !password) return alert('Preencha usuário e senha');
    try {
      const res  = await fetch(`${BASE_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        showLoginForm();
      } else {
        alert(data.error || 'Erro no cadastro');
      }
    } catch (err) {
      alert('Erro no servidor: ' + err.message);
    }
  }

  function logout() {
    loginContainer.style.display    = 'flex';
    stockContainer.style.display    = 'none';
    inputUsuario.value              = '';
    inputClave.value                = '';
    monster.src                     = 'img/idle/1.png';
    currentUser                     = null;
    userNameDisplay.textContent     = 'Usuário';
    userMenu.style.display          = 'none';
    approveUsersBtn.style.display   = 'none';
    deleteUsersBtn.style.display    = 'none';
    adminSection.style.display      = 'none';
    profileModal.style.display      = 'none';
    resetProfilePhoto();
    addProductSection.style.display = 'none';
    viewStockSection.style.display  = 'none';
    homeSection.style.display       = 'none';
    submenu.classList.remove('active');
    userRole = null;
  }

  // --- Fluxo de Estoque com filtragem de nulls ---
  let estoqueData    = [];
  const itemsPerPage = 5;

  async function loadStock(page = 1) {
    try {
      const res  = await fetch(`${BASE_URL}/api/estoque`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      console.log('Estoque carregado:', data);

      // converte em array e remove null/undefined
      const raw = Array.isArray(data)
        ? data
        : Object.entries(data).map(([id, item]) => Object.assign({ id }, item));
      estoqueData = raw.filter(item => item != null);

      const filtered = filterStock(estoqueData);
      renderStock(filtered, page);
      setupPagination(filtered.length, page);
    } catch (err) {
      console.error('Erro ao carregar estoque:', err.message);
      alert('Erro ao carregar estoque: ' + err.message);
    }
  }

async function loadMovimentacoes() {
    try {
      const res = await fetch(`${BASE_URL}/api/movimentacoes`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
       });
    const data = await res.json();
    renderMovimentacoes(data);
  } catch (err) {
    alert('Erro ao carregar movimentações: ' + err.message);
  }
}

function renderMovimentacoes(data) {
  movimentacoesTableBody.innerHTML = '';
  data.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
  <td>${new Date(m.data).toLocaleString()}</td>
  <td>${m.usuario}</td>
  <td>${m.produto}</td>
  <td>${m.tipo}</td>
  <td>${m.quantidadeAnterior !== undefined ? m.quantidadeAnterior : ''}</td>
  <td>${m.quantidade}</td>
  <td>${m.quantidadeAtual !== undefined ? m.quantidadeAtual : ''}</td>
  <td>${m.motivo || ''}</td>`;
  });
  }
  
  function filterStock(data) {
  const clean = data.filter(item => item != null);
  const q     = filterInput.value.toLowerCase();
  const t     = filterType.value;
  if (!q) return clean;
  return clean.filter(item => {
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

  const clean     = data.filter(item => item != null);
  const start     = (page - 1) * itemsPerPage;
  const end       = start + itemsPerPage;
  const pageItems = clean.slice(start, end);

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
        <button class="delete-btn">Excluir</button>
      </td>
    `;
    stockTableBody.appendChild(row);
  }

    document.querySelectorAll('.edit-btn').forEach(btn => {
    const id = btn.closest('tr').dataset.id;
    btn.addEventListener('click', () => editProduct(id));
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    const id = btn.closest('tr').dataset.id;
    btn.addEventListener('click', () => showDeleteModal(id));
  });
}  // <--- fecha renderStock

function setupPagination(totalItems, currentPage) {
  const pageCount = Math.ceil(totalItems / itemsPerPage);
  const pagination = document.getElementById('pagination');
  pagination.innerHTML = '';
  for (let i = 1; i <= pageCount; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className   = i === currentPage ? 'active' : '';
    btn.addEventListener('click', () => loadStock(i));
    pagination.appendChild(btn);
  }
  }

  // fecha renderMovimentacoes
  
  async function addProduct(e) {
    e.preventDefault();
    const produto    = document.getElementById('produto').value;
    const tipo       = document.getElementById('tipo').value;
    const lote       = document.getElementById('lote').value;
    const validade   = document.getElementById('validade').value;
    const quantidade = document.getElementById('quantidade').value;
    try {
      const res  = await fetch(`${BASE_URL}/api/estoque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto, tipo, lote, validade, quantidade, usuario: currentUser }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        alert('Produto adicionado com sucesso!');
        stockForm.reset();
        if (viewStockSection.style.display !== 'none') loadStock();
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
    const produto    = cells[0].textContent;
    const tipo       = cells[1].textContent;
    const lote       = cells[2].textContent;
    const validade   = cells[3].textContent === 'N/A' ? '' : cells[3].textContent;
    const quantidade = cells[4].textContent;

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
      produto:    inputs[0].value,
      tipo:       inputs[1].value,
      lote:       inputs[2].value,
      validade:   inputs[3].value || null,
      quantidade: parseInt(inputs[4].value, 10) || 0
    };
    try {
      const res  = await fetch(`${BASE_URL}/api/estoque/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ usuario: currentUser }, updatedProduct)),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
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
        <p>Deseja realmente excluir o produto de ID <strong>${id}</strong>?</p>
        <input type="text" id="delete-reason" placeholder="Motivo da exclusão">
        <button class="confirm-delete-btn">Confirmar</button>
        <button class="cancel-delete-btn">Cancelar</button>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.confirm-delete-btn')
      .addEventListener('click', async () => {
        const reason = modal.querySelector('#delete-reason').value.trim();
        if (!reason) return alert('Informe o motivo da exclusão.');
        await performDelete(id, reason);
        modal.remove();
      });
    modal.querySelector('.cancel-delete-btn')
      .addEventListener('click', () => modal.remove());
  }

  async function performDelete(id, motivo) {
    try {
      const res  = await fetch(`${BASE_URL}/api/estoque/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo, usuario: currentUser }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        alert('Produto excluído com sucesso!');
        loadStock();
      } else {
        alert(data.error || 'Erro ao excluir produto');
      }
    } catch (err) {
      alert('Erro ao remover produto: ' + err.message);
    }
  }

// ----- Gestão de usuários (admin) -----
  async function loadPendingUsers() {
    const res  = await fetch(`${BASE_URL}/api/users/pending?role=admin`);
    const data = await res.json();
    pendingUsersList.innerHTML = '';
    data.forEach(u => {
      const li = document.createElement('li');
      li.textContent = u.username;
      const btn = document.createElement('button');
      btn.textContent = 'Aprovar';
      btn.addEventListener('click', () => approveUser(u.id));
      li.appendChild(btn);
      pendingUsersList.appendChild(li);
    });
  }

  async function loadUsers() {
    const res  = await fetch(`${BASE_URL}/api/users?role=admin`);
    const data = await res.json();
    usersList.innerHTML = '';
    data.forEach(u => {
      const li = document.createElement('li');
      li.textContent = `${u.username} (${u.role})`;
      const btn = document.createElement('button');
      btn.textContent = 'Excluir';
      btn.addEventListener('click', () => deleteUser(u.id));
      li.appendChild(btn);
      usersList.appendChild(li);
    });
  }

  async function approveUser(id) {
    const res = await fetch(`${BASE_URL}/api/users/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleAtuante: 'admin' })
    });
    if (res.ok) loadPendingUsers();
  }

  async function deleteUser(id) {
    const res = await fetch(`${BASE_URL}/api/users/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleAtuante: 'admin' })
    });
    if (res.ok) loadUsers();
  }

  function showRegisterForm() {
    loginForm.style.display    = 'none';
    registerForm.style.display = 'block';
  }

  function showLoginForm() {
    registerForm.style.display = 'none';
    loginForm.style.display    = 'block';
  }

// Listeners finais
loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
showRegisterBtn.addEventListener('click', showRegisterForm);
showLoginBtn.addEventListener('click', showLoginForm);
logoutBtn.addEventListener('click', logout);
stockForm.addEventListener('submit', addProduct);
if (approveUsersBtn) {
  approveUsersBtn.addEventListener('click', () => {
    adminSection.style.display = 'block';
    loadPendingUsers();
  });
}
if (deleteUsersBtn) {
  deleteUsersBtn.addEventListener('click', () => {
    adminSection.style.display = 'block';
    loadUsers();
  });
}
if (closeAdminBtn) {
  closeAdminBtn.addEventListener('click', () => {
    adminSection.style.display = 'none';
  });
}
  document.querySelector('#login-form button[type="submit"]')
          .addEventListener('click', e => handleLogin(e));
});

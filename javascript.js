const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const isLocalEnvironment = /127\.0\.0\.1|localhost/.test(currentOrigin);
const BASE_URL = isLocalEnvironment ? '' : 'https://projeto-estoque-o1x5.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
  // Estado global
  let currentUser = null;
  let currentUserId = null;
  let userRole = null;
  let estoqueData = [];
  let filteredProducts = [];
  let movementsData = [];
  let currentPage = 1;
  const itemsPerPage = 8;
  let currentView = 'grid';
  let activeFilter = 'all';
  let stockByProductChart = null;
  let stockByTypeChart = null;
  const productImages = new Map();
  const loader = document.getElementById('loader');
  const FALLBACK_PRODUCT_IMAGE = 'img/placeholders/product-placeholder.svg';
  const FALLBACK_AVATAR_IMAGE = 'img/placeholders/avatar-placeholder.svg';

  // Elementos de login
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegisterBtn = document.getElementById('show-register');
  const showLoginBtn = document.getElementById('show-login');
  const inputUsuario = document.getElementById('input-usuario');
  const inputClave = document.getElementById('input-clave');
  const togglePasswordLogin = document.getElementById('toggle-password-login');
  const togglePasswordRegister = document.getElementById('toggle-password-register');
  const monster = document.getElementById('monster');

  // Elementos gerais da aplicação
  const mainMenu = document.getElementById('main-menu');
  const pageContents = document.querySelectorAll('.page-content');
  const addProductLink = document.getElementById('add-product-link');
  const quickAddBtn = document.getElementById('quick-add-product');
  const quickExportBtn = document.getElementById('quick-export-report');
  const searchInput = document.getElementById('search-input');
  const filterButtonsContainer = document.getElementById('filter-buttons');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  const gridViewBtn = document.getElementById('grid-view-btn');
  const listViewBtn = document.getElementById('list-view-btn');
  const productGrid = document.getElementById('product-grid');
  const paginationContainer = document.getElementById('pagination-controls');
  const addForm = document.getElementById('add-form');
  const editForm = document.getElementById('edit-form');
  const deleteModal = document.getElementById('delete-modal');
  const deleteProductName = document.getElementById('delete-product-name');
  const deleteReasonInput = document.getElementById('delete-reason');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const profileImageUpload = document.getElementById('profile-image-upload');
  const profileModalImage = document.getElementById('profile-modal-image');
  const profileModal = document.getElementById('profile-modal');
  const profileLinks = document.querySelectorAll('.profile-link');
  const logoutLinks = document.querySelectorAll('.logout-link');
  const approveLinks = document.querySelectorAll('.approve-link');
  const homeGreeting = document.getElementById('home-greeting');
  const homeUserName = document.getElementById('home-user-name');
  const recentActivityList = document.getElementById('recent-activity-list');

  const movInicio = document.getElementById('mov-inicio');
  const movFim = document.getElementById('mov-fim');
  const filtrarMovBtn = document.getElementById('filtrar-mov-btn');
  const movimentacoesTableBody = document.getElementById('movimentacoes-table-body');

  const pendingUsersList = document.getElementById('pending-users-list');
  const activeUsersList = document.getElementById('active-users-list');

  // Referências dos KPIs
  const homeKpiTotalStock = document.getElementById('home-kpi-total-stock');
  const homeKpiLowStock = document.getElementById('home-kpi-low-stock');
  const homeKpiMoves = document.getElementById('home-kpi-moves');
  const homeKpiStockValue = document.getElementById('home-kpi-stock-value');
  const reportsKpiInputs = document.getElementById('kpi-inputs');
  const reportsKpiOutputs = document.getElementById('kpi-outputs');
  const reportsKpiTotalStock = document.getElementById('kpi-total-stock');
  const reportsKpiExpiring = document.getElementById('kpi-expiring');

  const stockByProductCanvas = document.getElementById('stock-by-product-chart');
  const stockByTypeCanvas = document.getElementById('stock-by-type-chart');

  // Avatar do usuário (existem várias instâncias na interface)
  const userAvatarImgs = document.querySelectorAll('.user-avatar-img');

  let currentProductId = null;

  // Utilitários -----------------------------------------------------------------
  const showLoader = () => loader?.classList.remove('hidden');
  const hideLoader = () => loader?.classList.add('hidden');

  const openModal = modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
    }
  };

  const closeModal = modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
    }
  };

  const formatDate = value => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('pt-BR');
  };

  const getStoredProductImage = id => {
    if (!id) return null;
    if (productImages.has(id)) {
      return productImages.get(id);
    }
    const stored = localStorage.getItem(`productImage_${id}`);
    if (stored) {
      productImages.set(id, stored);
      return stored;
    }
    return null;
  };

  const storeProductImage = (id, dataUrl) => {
    if (!id || !dataUrl) return;
    productImages.set(id, dataUrl);
    try {
      localStorage.setItem(`productImage_${id}`, dataUrl);
    } catch (err) {
      console.warn('Não foi possível armazenar imagem localmente:', err);
    }
  };

  const generatePlaceholderImage = (name = 'Produto') => ({
    primary: `https://placehold.co/400x300/E2E8F0/4A5568?text=${encodeURIComponent(name.substring(0, 20))}`,
    fallback: FALLBACK_PRODUCT_IMAGE
  });

  const waitForChartLibrary = () => new Promise(resolve => {
    if (typeof window !== 'undefined' && typeof window.Chart !== 'undefined') {
      resolve(true);
      return;
    }
    let attempts = 0;
    const maxAttempts = 30;
    const intervalId = setInterval(() => {
      attempts += 1;
      if (typeof window !== 'undefined' && typeof window.Chart !== 'undefined') {
        clearInterval(intervalId);
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        resolve(false);
      }
    }, 100);
  });

  const registerImageFallbacks = root => {
    if (!root) return;
    const candidates = root.tagName === 'IMG'
      ? [root]
      : Array.from(root.querySelectorAll('img[data-fallback-src]'));
    candidates.forEach(img => {
      if (!img || !img.dataset?.fallbackSrc || img.dataset.fallbackHandlerApplied === 'true') return;
      img.dataset.fallbackHandlerApplied = 'true';
      if (!img.hasAttribute('loading')) img.loading = 'lazy';
      if (!img.hasAttribute('decoding')) img.decoding = 'async';
      img.addEventListener('error', () => {
        if (img.dataset.fallbackApplied === 'true') return;
        img.dataset.fallbackApplied = 'true';
        img.src = img.dataset.fallbackSrc;
      });
    });
  };

  const updateAllUserNames = name => {
    document.querySelectorAll('#home-user-name, header .user-menu-button span.font-medium').forEach(el => {
      if (el) el.textContent = name;
    });
  };

  const updateAllAvatars = src => {
    userAvatarImgs.forEach(img => {
      if (!img.dataset.fallbackSrc) img.dataset.fallbackSrc = FALLBACK_AVATAR_IMAGE;
      img.src = src;
      registerImageFallbacks(img);
    });
  };

  // Login -----------------------------------------------------------------------
  const anchoMitad = window.innerWidth / 2;
  const altoMitad = window.innerHeight / 2;
  let seguirPunteroMouse = true;

  const resetProfilePhoto = () => {
    const defaultPic = FALLBACK_AVATAR_IMAGE;
    updateAllAvatars(defaultPic);
    profileModalImage.src = defaultPic;
    registerImageFallbacks(profileModalImage);
    if (currentUser) {
      localStorage.removeItem(`profilePhoto_${currentUser}`);
    }
  };

  const initProfilePhoto = async () => {
    const defaultPic = FALLBACK_AVATAR_IMAGE;
    if (!currentUserId) {
      updateAllAvatars(defaultPic);
      profileModalImage.src = defaultPic;
      registerImageFallbacks(profileModalImage);
      return;
    }
    const saved = currentUser ? localStorage.getItem(`profilePhoto_${currentUser}`) : null;
    if (saved) {
      updateAllAvatars(saved);
      profileModalImage.src = saved;
      registerImageFallbacks(profileModalImage);
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/api/users/${currentUserId}/photo`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.photo) {
          updateAllAvatars(data.photo);
          profileModalImage.src = data.photo;
          if (currentUser) {
            localStorage.setItem(`profilePhoto_${currentUser}`, data.photo);
          }
          registerImageFallbacks(profileModalImage);
          return;
        }
      }
    } catch (err) {
      console.error('Erro ao buscar foto de perfil:', err);
    }
    updateAllAvatars(defaultPic);
    profileModalImage.src = defaultPic;
    registerImageFallbacks(profileModalImage);
  };

  const updateProfilePhotoOnServer = async photo => {
    if (!currentUserId) return;
    try {
      await fetch(`${BASE_URL}/api/users/${currentUserId}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo }),
        credentials: 'include'
      });
    } catch (err) {
      console.error('Erro ao atualizar foto no servidor:', err);
    }
  };

  const showLoginForm = () => {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  };

  const showRegisterForm = () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  };

  const handleLogin = async event => {
    event.preventDefault();
    const username = inputUsuario.value.trim();
    const password = inputClave.value.trim();
    if (!username || !password) {
      alert('Preencha usuário e senha.');
      return;
    }
    try {
      showLoader();
      const res = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro no login.');
        return;
      }
      currentUser = username;
      currentUserId = data.userId;
      userRole = data.role;
      homeGreeting.textContent = `Bem-vindo de volta, ${username}!`;
      updateAllUserNames(username);
      loginContainer.classList.add('hidden');
      loginContainer.style.display = 'none';
      appContainer.classList.remove('hidden');
      document.getElementById('home-menu-item')?.click();
      if (data.photo) {
        localStorage.setItem(`profilePhoto_${currentUser}`, data.photo);
      }
      await initProfilePhoto();
      toggleAdminFeatures(userRole === 'admin');
      await refreshAllData();
    } catch (err) {
      alert('Erro no servidor: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const handleRegister = async event => {
    event.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    if (!username || !password) {
      alert('Preencha usuário e senha.');
      return;
    }
    try {
      showLoader();
      const res = await fetch(`${BASE_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Cadastro realizado com sucesso!');
        showLoginForm();
      } else {
        alert(data.error || 'Erro no cadastro.');
      }
    } catch (err) {
      alert('Erro no servidor: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const logout = () => {
    currentUser = null;
    currentUserId = null;
    userRole = null;
    estoqueData = [];
    filteredProducts = [];
    movementsData = [];
    currentPage = 1;
    loginContainer.style.display = 'flex';
    loginContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    inputUsuario.value = '';
    inputClave.value = '';
    profileModal.classList.add('hidden');
    resetProfilePhoto();
    toggleAdminFeatures(false);
  };

  const toggleAdminFeatures = isAdmin => {
    approveLinks.forEach(link => {
      if (isAdmin) {
        link.classList.remove('hidden');
      } else {
        link.classList.add('hidden');
      }
    });
  };

  // Dados -----------------------------------------------------------------------
  const refreshAllData = async () => {
    await Promise.all([loadStock(), loadMovimentacoes(), loadReports()]);
    updateHomePage();
  };

  const loadStock = async () => {
    try {
      showLoader();
      const res = await fetch(`${BASE_URL}/api/estoque`, { credentials: 'include' });
      const data = await res.json();
      const raw = Array.isArray(data)
        ? data
        : Object.entries(data || {}).map(([id, item]) => ({ id, ...item }));
      estoqueData = raw.filter(item => item);
      filteredProducts = [...estoqueData];
      currentPage = 1;
      renderStock();
    } catch (err) {
      console.error('Erro ao carregar estoque:', err);
      alert('Erro ao carregar estoque: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const loadMovimentacoes = async (start, end) => {
    try {
      const params = new URLSearchParams();
      if (start) params.append('start', start);
      if (end) params.append('end', end);
      showLoader();
      const res = await fetch(`${BASE_URL}/api/movimentacoes?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      movementsData = Array.isArray(data) ? data : [];
      renderMovimentacoes();
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
      alert('Erro ao carregar movimentações: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const loadReports = async (start, end) => {
    try {
      const params = new URLSearchParams();
      if (start) params.append('start', start);
      if (end) params.append('end', end);
      showLoader();
      const [resSummary, resStock] = await Promise.all([
        fetch(`${BASE_URL}/api/report/summary?${params.toString()}`, { credentials: 'include' }),
        fetch(`${BASE_URL}/api/report/estoque`, { credentials: 'include' })
      ]);
      const summaryData = await resSummary.json();
      const stockData = await resStock.json();
      await renderReports(summaryData, stockData);
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
      alert('Erro ao carregar relatórios: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  // Renderizações ---------------------------------------------------------------
  const applyFilters = () => {
    const searchTerm = (searchInput?.value || '').trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    filteredProducts = estoqueData.filter(product => {
      const matchesSearch =
        product.produto?.toLowerCase().includes(searchTerm) ||
        product.tipo?.toLowerCase().includes(searchTerm);
      if (!matchesSearch) return false;
      if (activeFilter === 'low_stock') {
        return Number(product.quantidade) < 25;
      }
      if (activeFilter === 'expiring_soon') {
        if (!product.validade) return false;
        const expiry = new Date(product.validade);
        if (Number.isNaN(expiry.getTime())) return false;
        expiry.setHours(0, 0, 0, 0);
        const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        return diff <= 30 && diff >= 0;
      }
      return true;
    });
    currentPage = 1;
    renderStock();
  };

  const renderStock = () => {
    if (!productGrid) return;
    const totalPages = Math.max(Math.ceil(filteredProducts.length / itemsPerPage), 1);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    productGrid.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredProducts.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
      productGrid.innerHTML = '<p class="col-span-full text-center text-subtle-light dark:text-subtle-dark">Nenhum produto encontrado.</p>';
      renderPaginationControls(totalPages);
      return;
    }
    pageItems.forEach(product => {
      const quantity = Number(product.quantidade) || 0;
      const placeholder = generatePlaceholderImage(product.produto);
      const storedImage = getStoredProductImage(product.id);
      const imageSrc = storedImage || placeholder.primary;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let expiryBadge = '';
      if (product.validade) {
        const expiry = new Date(product.validade);
        expiry.setHours(0, 0, 0, 0);
        const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (!Number.isNaN(diff) && diff <= 30 && diff >= 0) {
          expiryBadge = `<div class="absolute top-2 right-2 bg-yellow-400 text-yellow-900 rounded-full p-1.5 z-10" title="Vencendo em breve"><span class="material-icons">warning</span></div>`;
        }
      }
      const stockPercentage = Math.min(Math.round((quantity / 150) * 100), 100);
      let stockColor = 'bg-green-500';
      if (stockPercentage < 50) stockColor = 'bg-yellow-500';
      if (stockPercentage < 25) stockColor = 'bg-danger';

      const commonContent = `
        <div class="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full z-10">${product.tipo || '-'}</div>
        ${expiryBadge}
        <img alt="${product.produto}" class="w-full ${currentView === 'grid' ? 'h-40' : 'h-full'} object-cover" src="${imageSrc}" loading="lazy" decoding="async" data-fallback-src="${placeholder.fallback}" onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='true';this.src=this.dataset.fallbackSrc;}" />
        <div class="p-4 ${currentView === 'grid' ? 'flex-grow flex flex-col' : 'flex-1 ml-4 grid grid-cols-5 items-center gap-4'}">
          ${currentView === 'grid'
            ? `
              <h3 class="font-bold">${product.produto}</h3>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-3xl font-bold text-primary">${quantity}</span>
                <div class="flex items-center text-sm text-subtle-light dark:text-subtle-dark">
                  <span class="material-icons text-base mr-1">calendar_today</span>
                  <span>${formatDate(product.validade)}</span>
                </div>
              </div>
              <div class="mt-auto pt-4">
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div class="${stockColor} h-2 rounded-full" style="width: ${stockPercentage}%"></div>
                </div>
              </div>
            `
            : `
              <div>
                <p class="font-bold">${product.produto}</p>
                <p class="text-sm text-subtle-light dark:text-subtle-dark">Lote: ${product.lote || '-'}</p>
              </div>
              <div class="text-center">
                <span class="text-2xl font-bold text-primary">${quantity}</span>
                <p class="text-xs text-subtle-light dark:text-subtle-dark">Unidades</p>
              </div>
              <div class="text-center">
                <div class="flex items-center justify-center text-sm text-subtle-light dark:text-subtle-dark">
                  <span class="material-icons text-base mr-1">calendar_today</span>
                  <span>${formatDate(product.validade)}</span>
                </div>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div class="${stockColor} h-2 rounded-full" style="width: ${stockPercentage}%"></div>
              </div>
              <div class="flex justify-end items-center gap-2">
                <button class="edit-btn bg-blue-500 text-white p-2 rounded-lg" data-id="${product.id}"><span class="material-icons">edit</span></button>
                <button class="delete-btn bg-danger text-white p-2 rounded-lg" data-id="${product.id}" data-name="${product.produto}"><span class="material-icons">delete</span></button>
              </div>
            `}
        </div>`;

      if (currentView === 'grid') {
        const card = document.createElement('div');
        card.className = 'group relative bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm overflow-hidden transition-transform duration-300 hover:-translate-y-1 flex flex-col';
        card.innerHTML = `${commonContent}
          <div class="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center space-x-2 card-actions p-2">
            <button class="edit-btn bg-blue-500 text-white p-2 rounded-lg flex-1" data-id="${product.id}"><span class="material-icons">edit</span></button>
            <button class="delete-btn bg-danger text-white p-2 rounded-lg flex-1" data-id="${product.id}" data-name="${product.produto}"><span class="material-icons">delete</span></button>
          </div>`;
        productGrid.appendChild(card);
        registerImageFallbacks(card);
      } else {
        const row = document.createElement('div');
        row.className = 'group relative bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm flex items-center p-4 transition-shadow hover:shadow-md';
        row.innerHTML = `
          <img alt="${product.produto}" class="w-20 h-20 object-cover rounded-lg flex-shrink-0" src="${imageSrc}" loading="lazy" decoding="async" data-fallback-src="${placeholder.fallback}" onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='true';this.src=this.dataset.fallbackSrc;}" />
        ${commonContent}`;
        productGrid.appendChild(row);
        registerImageFallbacks(row);
      }
    });

    productGrid.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
    productGrid.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.name));
    });

    renderPaginationControls(totalPages);
  };

  const renderPaginationControls = totalPagesParam => {
    if (!paginationContainer) return;
    const totalPages = totalPagesParam ?? Math.max(Math.ceil(filteredProducts.length / itemsPerPage), 1);
    paginationContainer.innerHTML = '';
    if (totalPages <= 1) {
      paginationContainer.classList.add('hidden');
      return;
    }
    paginationContainer.classList.remove('hidden');
    for (let page = 1; page <= totalPages; page++) {
      const button = document.createElement('button');
      button.textContent = page;
      button.className = `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${page === currentPage ? 'bg-primary text-white' : 'bg-surface-light dark:bg-surface-dark hover:bg-gray-200 dark:hover:bg-gray-700'}`;
      if (page === currentPage) {
        button.disabled = true;
      }
      button.addEventListener('click', () => {
        currentPage = page;
        renderStock();
      });
      paginationContainer.appendChild(button);
    }
  };

  const setActiveFilterButton = filter => {
    if (!filterButtonsContainer) return;
    filterButtonsContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('bg-primary', 'text-white'));
    const target = filterButtonsContainer.querySelector(`[data-filter="${filter}"]`);
    target?.classList.add('bg-primary', 'text-white');
  };

  const renderMovimentacoes = () => {
    if (!movimentacoesTableBody) return;
    movimentacoesTableBody.innerHTML = '';
    movementsData.forEach(move => {
      const tr = document.createElement('tr');
      tr.className = 'bg-white dark:bg-surface-dark';
      tr.innerHTML = `
        <td class="px-4 py-2">${move.data ? new Date(move.data).toLocaleString('pt-BR') : '-'}</td>
        <td class="px-4 py-2">${move.usuario || '-'}</td>
        <td class="px-4 py-2">${move.produto || '-'}</td>
        <td class="px-4 py-2">${move.tipo || '-'}</td>
        <td class="px-4 py-2">${move.quantidadeAnterior ?? ''}</td>
        <td class="px-4 py-2">${move.quantidade ?? ''}</td>
        <td class="px-4 py-2">${move.quantidadeAtual ?? ''}</td>
        <td class="px-4 py-2">${move.motivo || ''}</td>`;
      movimentacoesTableBody.appendChild(tr);
    });
  };

  const renderReports = async (summaryData, estoqueResumo) => {
    const porProduto = summaryData?.porProduto || {};
    const labels = Object.keys(porProduto);
    const entradas = labels.map(label => Number(porProduto[label]?.entradas) || 0);
    const saidas = labels.map(label => Number(porProduto[label]?.saidas) || 0);
    const totalEntradas = entradas.reduce((sum, value) => sum + value, 0);
    const totalSaidas = saidas.reduce((sum, value) => sum + value, 0);

    reportsKpiInputs.textContent = totalEntradas.toLocaleString('pt-BR');
    reportsKpiOutputs.textContent = totalSaidas.toLocaleString('pt-BR');
    const estoqueAtual = estoqueData.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
    reportsKpiTotalStock.textContent = `${estoqueAtual.toLocaleString('pt-BR')} un.`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiring = estoqueData.filter(item => {
      if (!item.validade) return false;
      const expiry = new Date(item.validade);
      expiry.setHours(0, 0, 0, 0);
      const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      return diff <= 30 && diff >= 0;
    }).length;
    reportsKpiExpiring.textContent = expiring;

    const chartReady = await waitForChartLibrary();
    if (!chartReady) {
      console.warn('Biblioteca de gráficos indisponível. Os relatórios serão exibidos sem gráficos.');
      return;
    }

    if (!stockByProductCanvas || !stockByTypeCanvas) return;

    if (stockByProductChart) stockByProductChart.destroy();
    stockByProductChart = new Chart(stockByProductCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Quantidade',
          data: labels.map(label => Number(estoqueResumo?.[label]) || 0),
          backgroundColor: ['#6D28D9', '#7C3AED', '#8B5CF6', '#C4B5FD', '#DDD6FE'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6B7280' }, grid: { display: false } },
          y: { ticks: { color: '#6B7280' }, grid: { color: 'rgba(107,114,128,0.2)' } }
        }
      }
    });

    const typeCounts = {};
    estoqueData.forEach(item => {
      const key = item.tipo || 'Outros';
      typeCounts[key] = (typeCounts[key] || 0) + (Number(item.quantidade) || 0);
    });

    if (stockByTypeChart) stockByTypeChart.destroy();
    stockByTypeChart = new Chart(stockByTypeCanvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(typeCounts),
        datasets: [{
          data: Object.values(typeCounts),
          backgroundColor: ['#6D28D9', '#9333EA', '#C084FC', '#E9D5FF', '#A855F7'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  };

  const updateHomePage = () => {
    const totalStock = estoqueData.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
    const lowStockCount = estoqueData.filter(item => Number(item.quantidade) < 25).length;
    const today = new Date();
    const movesToday = movementsData.filter(move => {
      if (!move.data) return false;
      const moveDate = new Date(move.data);
      return moveDate.toDateString() === today.toDateString();
    }).length;

    let stockValue = estoqueData.reduce((sum, item) => {
      const valor = Number(item.valor_total || item.valorTotal || item.valor || 0);
      if (!Number.isNaN(valor) && valor > 0) return sum + valor;
      const preco = Number(item.preco || item.custo || 0);
      if (!Number.isNaN(preco) && preco > 0) return sum + preco * (Number(item.quantidade) || 0);
      return sum;
    }, 0);

    homeKpiTotalStock.textContent = totalStock.toLocaleString('pt-BR');
    homeKpiLowStock.textContent = lowStockCount.toString();
    homeKpiMoves.textContent = movesToday.toString();
    homeKpiStockValue.textContent = stockValue > 0
      ? `R$ ${stockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'R$ 0,00';

    if (recentActivityList) {
      recentActivityList.innerHTML = '';
      const recentMoves = [...movementsData]
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 5);
      if (recentMoves.length === 0) {
        recentActivityList.innerHTML = '<p class="text-sm text-subtle-light dark:text-subtle-dark">Nenhuma atividade recente.</p>';
        return;
      }
      recentMoves.forEach(move => {
        const icon = move.tipo === 'entrada' ? 'arrow_downward' : move.tipo === 'saída' ? 'arrow_upward' : 'swap_horiz';
        const color = move.tipo === 'entrada' ? 'green' : move.tipo === 'saída' ? 'red' : 'blue';
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between';
        item.innerHTML = `
          <div class="flex items-center gap-4">
            <div class="p-2 rounded-full bg-${color}-100 dark:bg-${color}-900/40">
              <span class="material-icons text-${color}-600 dark:text-${color}-300">${icon}</span>
            </div>
            <div>
              <p class="font-medium">${move.tipo ? move.tipo.toUpperCase() : 'Movimento'}: ${move.quantidade || 0}x ${move.produto || ''}</p>
              <p class="text-sm text-subtle-light dark:text-subtle-dark">${move.usuario || ''}</p>
            </div>
          </div>
          <p class="text-sm text-subtle-light dark:text-subtle-dark">${move.data ? new Date(move.data).toLocaleString('pt-BR') : ''}</p>`;
        recentActivityList.appendChild(item);
      });
    }
  };

  const renderApprovalPage = async () => {
    if (!userRole || userRole !== 'admin') return;
    try {
      showLoader();
      const [pendingRes, activeRes] = await Promise.all([
        fetch(`${BASE_URL}/api/users/pending?role=admin`, { credentials: 'include' }),
        fetch(`${BASE_URL}/api/users?role=admin`, { credentials: 'include' })
      ]);
      const pendingData = await pendingRes.json();
      const activeData = await activeRes.json();

      pendingUsersList.innerHTML = '';
      if (!pendingData.length) {
        pendingUsersList.innerHTML = '<p class="text-subtle-light dark:text-subtle-dark text-center py-4">Nenhum usuário aguardando aprovação.</p>';
      } else {
        pendingData.forEach(user => {
          const item = document.createElement('div');
          item.className = 'flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50';
          item.innerHTML = `
            <div class="flex items-center gap-4">
              <img src="https://placehold.co/40x40/6D28D9/FFFFFF?text=${(user.username || 'U').charAt(0).toUpperCase()}" alt="${user.username}" class="w-10 h-10 rounded-full object-cover" loading="lazy" decoding="async" data-fallback-src="${FALLBACK_AVATAR_IMAGE}" onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='true';this.src=this.dataset.fallbackSrc;}">
              <div>
                <p class="font-semibold">${user.username}</p>
                <p class="text-sm text-subtle-light dark:text-subtle-dark">ID: ${user.id}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button data-user-id="${user.id}" class="approve-user-btn p-2 rounded-full text-green-500 hover:bg-green-100 dark:hover:bg-green-900/50"><span class="material-icons">check_circle</span></button>
              <button data-user-id="${user.id}" class="decline-user-btn p-2 rounded-full text-danger hover:bg-red-100 dark:hover:bg-red-900/50"><span class="material-icons">cancel</span></button>
            </div>`;
          pendingUsersList.appendChild(item);
          registerImageFallbacks(item);
        });
      }

      activeUsersList.innerHTML = '';
      if (!activeData.length) {
        activeUsersList.innerHTML = '<p class="text-subtle-light dark:text-subtle-dark text-center py-4">Nenhum usuário ativo.</p>';
      } else {
        activeData.forEach(user => {
          const item = document.createElement('div');
          item.className = 'flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50';
          item.innerHTML = `
            <div class="flex items-center gap-4">
              <img src="https://placehold.co/40x40/6D28D9/FFFFFF?text=${(user.username || 'U').charAt(0).toUpperCase()}" alt="${user.username}" class="w-10 h-10 rounded-full object-cover" loading="lazy" decoding="async" data-fallback-src="${FALLBACK_AVATAR_IMAGE}" onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='true';this.src=this.dataset.fallbackSrc;}">
              <div>
                <p class="font-semibold">${user.username}</p>
                <p class="text-sm text-subtle-light dark:text-subtle-dark">${user.role || ''}</p>
              </div>
            </div>
            <button data-user-id="${user.id}" class="delete-user-btn p-2 rounded-full text-danger hover:bg-red-100 dark:hover:bg-red-900/50"><span class="material-icons">delete</span></button>`;
          activeUsersList.appendChild(item);
          registerImageFallbacks(item);
        });
      }

      document.querySelectorAll('.approve-user-btn').forEach(btn => {
        btn.addEventListener('click', () => approveUser(btn.dataset.userId));
      });
      document.querySelectorAll('.decline-user-btn').forEach(btn => {
        btn.addEventListener('click', () => declineUser(btn.dataset.userId));
      });
      document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteUser(btn.dataset.userId));
      });
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      alert('Erro ao carregar usuários: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  // CRUD -----------------------------------------------------------------------
  const handleAddSubmit = async event => {
    event.preventDefault();
    const produto = document.getElementById('add-name').value.trim();
    const tipo = document.getElementById('add-type').value.trim();
    const lote = document.getElementById('add-lot').value.trim();
    const quantidade = Number(document.getElementById('add-quantity').value) || 0;
    const validade = document.getElementById('add-expiryDate').value || null;
    const custoInput = document.getElementById('add-cost').value;
    const custo = custoInput === '' ? null : Number.parseFloat(custoInput);
    if (!produto) {
      alert('Informe o nome do produto.');
      return;
    }
    if (custo === null || Number.isNaN(custo) || custo < 0) {
      alert('Informe um custo válido.');
      return;
    }
    const custoFormatado = Math.round(custo * 100) / 100;
    try {
      showLoader();
      const res = await fetch(`${BASE_URL}/api/estoque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto, tipo, lote, validade, quantidade, custo: custoFormatado, usuario: currentUser }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao adicionar produto.');
        return;
      }
      closeModal('add-modal');
      addForm.reset();
      document.getElementById('add-image-preview').classList.add('hidden');
      await loadStock();
      await loadMovimentacoes();
      updateHomePage();
      alert('Produto adicionado com sucesso!');
    } catch (err) {
      alert('Erro ao adicionar produto: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const openEditModal = productId => {
    const product = estoqueData.find(item => String(item.id) === String(productId));
    if (!product) return;
    currentProductId = product.id;
    editForm.elements.id.value = product.id;
    editForm.elements.type.value = product.tipo || 'Açaí';
    editForm.elements.name.value = product.produto || '';
    editForm.elements.lot.value = product.lote || '';
    editForm.elements.quantity.value = product.quantidade || 0;
    editForm.elements.expiryDate.value = product.validade ? product.validade.substring(0, 10) : '';
    if (editForm.elements.cost) {
      const custoValor = product.custo !== undefined && product.custo !== null
        ? Number(product.custo)
        : '';
      editForm.elements.cost.value = custoValor === '' || Number.isNaN(custoValor)
        ? ''
        : (Math.round(custoValor * 100) / 100).toFixed(2);
    }
    const preview = document.getElementById('edit-image-preview');
    const placeholder = generatePlaceholderImage(product.produto);
    const storedImage = getStoredProductImage(product.id);
    preview.src = storedImage || placeholder.primary;
    if (!preview.dataset.fallbackSrc) preview.dataset.fallbackSrc = placeholder.fallback;
    preview.classList.remove('hidden');
    registerImageFallbacks(preview);
    openModal('edit-modal');
  };

  const handleEditSubmit = async event => {
    event.preventDefault();
    const id = editForm.elements.id.value;
    const produto = editForm.elements.name.value.trim();
    const tipo = editForm.elements.type.value.trim();
    const lote = editForm.elements.lot.value.trim();
    const quantidade = Number(editForm.elements.quantity.value) || 0;
    const validade = editForm.elements.expiryDate.value || null;
    const custoInput = editForm.elements.cost?.value ?? '';
    const custo = custoInput === '' ? null : Number.parseFloat(custoInput);
    if (custo === null || Number.isNaN(custo) || custo < 0) {
      alert('Informe um custo válido.');
      return;
    }
    const custoFormatado = Math.round(custo * 100) / 100;
    if (!produto) {
      alert('Informe o nome do produto.');
      return;
    }
    try {
      showLoader();
      const res = await fetch(`${BASE_URL}/api/estoque/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto, tipo, lote, validade, quantidade, custo: custoFormatado, usuario: currentUser }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao atualizar produto.');
        return;
      }
      const preview = document.getElementById('edit-image-preview');
      if (!preview.classList.contains('hidden')) {
        storeProductImage(id, preview.src);
      }
      closeModal('edit-modal');
      await loadStock();
      await loadMovimentacoes();
      updateHomePage();
      alert('Produto atualizado com sucesso!');
    } catch (err) {
      alert('Erro ao atualizar produto: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const openDeleteModal = (id, name) => {
    currentProductId = id;
    deleteProductName.textContent = name || '';
    deleteReasonInput.value = '';
    openModal('delete-modal');
  };

  const handleDeleteConfirm = async () => {
    if (!currentProductId) return;
    const motivo = deleteReasonInput.value.trim();
    if (!motivo) {
      alert('Informe o motivo da exclusão.');
      return;
    }
    try {
      showLoader();
      const res = await fetch(`${BASE_URL}/api/estoque/${currentProductId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo, usuario: currentUser }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao excluir produto.');
        return;
      }
      closeModal('delete-modal');
      await loadStock();
      await loadMovimentacoes();
      updateHomePage();
      alert('Produto excluído com sucesso!');
    } catch (err) {
      alert('Erro ao remover produto: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  // Gestão de usuários ---------------------------------------------------------
  const approveUser = async userId => {
    try {
      showLoader();
      const res = await fetch(`${BASE_URL}/api/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleAtuante: 'admin' })
      });
      if (res.ok) {
        await renderApprovalPage();
      }
    } catch (err) {
      alert('Erro ao aprovar usuário: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const declineUser = async userId => {
    try {
      showLoader();
      const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleAtuante: 'admin' })
      });
      if (res.ok) {
        await renderApprovalPage();
      }
    } catch (err) {
      alert('Erro ao recusar usuário: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const deleteUser = async userId => {
    await declineUser(userId);
  };

  // Navegação ------------------------------------------------------------------
  const switchPage = pageId => {
    pageContents.forEach(page => page.classList.add('hidden'));
    const target = document.getElementById(pageId);
    target?.classList.remove('hidden');
    if (pageId === 'stock-page') {
      if (!estoqueData.length) loadStock();
    } else if (pageId === 'reports-page') {
      loadReports();
    } else if (pageId === 'approve-page') {
      renderApprovalPage();
    }
  };

  const highlightMenu = link => {
    mainMenu.querySelectorAll('a').forEach(item => {
      item.classList.remove('bg-white/20', 'text-white');
      item.classList.add('text-white/70', 'hover:bg-white/10');
    });
    if (link) {
      link.classList.add('bg-white/20', 'text-white');
      link.classList.remove('text-white/70');
    }
  };

  const setupMenuNavigation = () => {
    mainMenu.addEventListener('click', event => {
      const link = event.target.closest('a[data-page]');
      if (!link) return;
      event.preventDefault();
      highlightMenu(link);
      switchPage(link.dataset.page);
    });
  };

  const setupUserMenus = () => {
    document.querySelectorAll('.user-menu-button').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const menu = button.nextElementSibling;
        document.querySelectorAll('.user-dropdown-menu').forEach(otherMenu => {
          if (otherMenu !== menu) otherMenu.classList.add('hidden');
        });
        menu?.classList.toggle('hidden');
      });
    });
    window.addEventListener('click', event => {
      if (!event.target.closest('.user-menu-button')) {
        document.querySelectorAll('.user-dropdown-menu').forEach(menu => menu.classList.add('hidden'));
      }
    });
  };

  // Perfil ---------------------------------------------------------------------
  const openProfileModal = () => {
    const fallbackSrc = userAvatarImgs[0]?.src || FALLBACK_AVATAR_IMAGE;
    profileModalImage.src = fallbackSrc;
    registerImageFallbacks(profileModalImage);
    openModal('profile-modal');
  };

  const handleProfileSave = async () => {
    const newSrc = profileModalImage.src;
    updateAllAvatars(newSrc);
    if (currentUser) {
      localStorage.setItem(`profilePhoto_${currentUser}`, newSrc);
    }
    await updateProfilePhotoOnServer(newSrc);
    closeModal('profile-modal');
  };

  const setupImagePreview = (inputId, previewId) => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    if (!preview.dataset.fallbackSrc) preview.dataset.fallbackSrc = FALLBACK_PRODUCT_IMAGE;
    registerImageFallbacks(preview);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Selecione um arquivo de imagem.');
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        preview.src = e.target.result;
        preview.classList.remove('hidden');
        registerImageFallbacks(preview);
      };
      reader.readAsDataURL(file);
    });
  };

  // Eventos --------------------------------------------------------------------
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  showRegisterBtn.addEventListener('click', showRegisterForm);
  showLoginBtn.addEventListener('click', showLoginForm);
  logoutLinks.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    logout();
  }));
  profileLinks.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    openProfileModal();
  }));
  if (addProductLink) addProductLink.addEventListener('click', event => { event.preventDefault(); openModal('add-modal'); });
  if (quickAddBtn) quickAddBtn.addEventListener('click', () => openModal('add-modal'));
  if (quickExportBtn) quickExportBtn.addEventListener('click', () => window.open(`${BASE_URL}/api/movimentacoes/csv`, '_blank'));
  if (searchInput) searchInput.addEventListener('input', () => applyFilters());
  if (filterButtonsContainer) {
    filterButtonsContainer.addEventListener('click', event => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      activeFilter = button.dataset.filter;
      if (activeFilter === 'all' && searchInput) {
        searchInput.value = '';
      }
      setActiveFilterButton(activeFilter);
      applyFilters();
    });
    setActiveFilterButton('all');
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      activeFilter = 'all';
      currentPage = 1;
      setActiveFilterButton('all');
      applyFilters();
    });
  }
  if (gridViewBtn) gridViewBtn.addEventListener('click', () => {
    currentView = 'grid';
    gridViewBtn.classList.add('bg-primary', 'text-white');
    listViewBtn?.classList.remove('bg-primary', 'text-white');
    renderStock();
  });
  if (listViewBtn) listViewBtn.addEventListener('click', () => {
    currentView = 'list';
    listViewBtn.classList.add('bg-primary', 'text-white');
    gridViewBtn?.classList.remove('bg-primary', 'text-white');
    renderStock();
  });
  if (addForm) addForm.addEventListener('submit', handleAddSubmit);
  if (editForm) editForm.addEventListener('submit', handleEditSubmit);
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);
  if (filtrarMovBtn) filtrarMovBtn.addEventListener('click', () => loadMovimentacoes(movInicio.value, movFim.value));
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', handleProfileSave);
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  if (profileImageUpload) {
    profileImageUpload.addEventListener('change', () => {
      const file = profileImageUpload.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Selecione um arquivo de imagem.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Imagem deve ter no máximo 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        profileModalImage.src = e.target.result;
        registerImageFallbacks(profileModalImage);
      };
      reader.readAsDataURL(file);
    });
  }

  setupImagePreview('add-image', 'add-image-preview');
  setupImagePreview('edit-image', 'edit-image-preview');
  setupMenuNavigation();
  setupUserMenus();
  registerImageFallbacks(document);

  // Login animation ------------------------------------------------------------
  document.body.addEventListener('mousemove', event => {
    if (!seguirPunteroMouse || !monster) return;
    const { clientX, clientY } = event;
    if (clientX < anchoMitad && clientY < altoMitad)      monster.src = 'img/idle/2.png';
    else if (clientX < anchoMitad && clientY > altoMitad) monster.src = 'img/idle/3.png';
    else if (clientX > anchoMitad && clientY < altoMitad) monster.src = 'img/idle/5.png';
    else                                                  monster.src = 'img/idle/4.png';
  });
  if (inputUsuario) {
    inputUsuario.addEventListener('focus', () => seguirPunteroMouse = false);
    inputUsuario.addEventListener('blur', () => seguirPunteroMouse = true);
  }
  if (inputClave) {
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
  }
  if (togglePasswordLogin) {
    togglePasswordLogin.addEventListener('click', () => {
      if (inputClave.type === 'password') {
        inputClave.type = 'text';
        monster.src = 'img/idle/1.png';
        seguirPunteroMouse = false;
      } else {
        inputClave.type = 'password';
        seguirPunteroMouse = true;
      }
    });
  }
  if (togglePasswordRegister) {
    togglePasswordRegister.addEventListener('click', () => {
      const registerPassword = document.getElementById('register-password');
      registerPassword.type = registerPassword.type === 'password' ? 'text' : 'password';
    });
  }

  resetProfilePhoto();
  showLoginForm();
});


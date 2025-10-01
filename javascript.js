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
  const loader = document.getElementById('loader');
  const FALLBACK_PRODUCT_IMAGE = 'img/placeholders/product-placeholder.svg';
  const FALLBACK_AVATAR_IMAGE = 'img/placeholders/avatar-placeholder.svg';
  let profileImageFile = null;
  let isRefreshingAllData = false;
  const ACTIVE_PAGE_STORAGE_KEY = 'acaiStock_active_page';
  const SESSION_STORAGE_KEY = 'acaiStock_session';
  const AUTO_REFRESH_INTERVAL_MS = 60_000;
  let autoRefreshIntervalId = null;
  let activePageId = null;
  let socket = null;
  let usersDataDirty = true;
  let isRestoringSession = false;
  let pendingRealtimeRefresh = false;
  let pendingRealtimeOptions = {};

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
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const mobileMenuToggles = document.querySelectorAll('.mobile-menu-toggle');
  const mobileMenuCloseButtons = document.querySelectorAll('.mobile-menu-close');
  const stockMenuItem = document.getElementById('stock-menu-item');
  const pageContents = document.querySelectorAll('.page-content');
  const addProductLink = document.getElementById('add-product-link');
  const quickAddBtn = document.getElementById('quick-add-product');
  const quickExportBtn = document.getElementById('quick-export-report');
  const stockAddProductBtn = document.getElementById('stock-add-product-btn');
  const suggestProductBtn = document.getElementById('suggest-product-btn');
  const searchInput = document.getElementById('search-input');
  const filterButtonsContainer = document.getElementById('filter-buttons');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  const gridViewBtn = document.getElementById('grid-view-btn');
  const listViewBtn = document.getElementById('list-view-btn');
  const productGrid = document.getElementById('product-grid');
  const paginationContainer = document.getElementById('pagination-controls');
  const addForm = document.getElementById('add-form');
  const editForm = document.getElementById('edit-form');
  const suggestionsModal = document.getElementById('suggestions-modal');
  const suggestionsContent = document.getElementById('suggestions-content');
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
  const homeKpiCardTotal = document.getElementById('home-card-total-stock');
  const homeKpiCardLow = document.getElementById('home-card-low-stock');
  const homeKpiCardExpiring = document.getElementById('home-card-expiring');

  const movInicio = document.getElementById('mov-inicio');
  const movFim = document.getElementById('mov-fim');
  const filtrarMovBtn = document.getElementById('filtrar-mov-btn');
  const movimentacoesTableBody = document.getElementById('movimentacoes-table-body');

  const pendingUsersList = document.getElementById('pending-users-list');
  const activeUsersList = document.getElementById('active-users-list');

  // Referências dos KPIs
  const homeKpiTotalStock = document.getElementById('home-kpi-total-stock');
  const homeKpiLowStock = document.getElementById('home-kpi-low-stock');
  const homeKpiExpiring = document.getElementById('home-kpi-expiring');
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
  let isMobileSidebarOpen = false;

  const isDesktopViewport = () => window.matchMedia('(min-width: 640px)').matches;

  const setSidebarState = isOpen => {
    if (!sidebar) return;
    if (isOpen) {
      sidebar.setAttribute('data-open', 'true');
      sidebarBackdrop?.setAttribute('data-visible', 'true');
      document.body.classList.add('sidebar-locked');
    } else {
      sidebar.removeAttribute('data-open');
      sidebarBackdrop?.removeAttribute('data-visible');
      document.body.classList.remove('sidebar-locked');
    }
    const shouldHideForAccessibility = !isOpen && !isDesktopViewport();
    sidebar.setAttribute('aria-hidden', shouldHideForAccessibility ? 'true' : 'false');
    mobileMenuToggles.forEach(button => button.setAttribute('aria-expanded', isOpen ? 'true' : 'false'));
    isMobileSidebarOpen = isOpen;
  };

  const openMobileSidebar = () => {
    if (isDesktopViewport()) return;
    setSidebarState(true);
  };

  const closeMobileSidebar = force => {
    if (!isMobileSidebarOpen && !force) return;
    setSidebarState(false);
  };

  mobileMenuToggles.forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      if (isMobileSidebarOpen) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    });
  });

  mobileMenuCloseButtons.forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      closeMobileSidebar(true);
    });
  });

  sidebarBackdrop?.addEventListener('click', () => closeMobileSidebar(true));

  window.addEventListener('keyup', event => {
    if (event.key === 'Escape') {
      closeMobileSidebar(true);
    }
  });

  window.addEventListener('resize', () => {
    if (isDesktopViewport()) {
      closeMobileSidebar(true);
    }
  });

  mainMenu?.addEventListener('click', event => {
    if (!(event.target instanceof HTMLElement)) return;
    if (isDesktopViewport()) return;
    if (event.target.closest('a')) {
      closeMobileSidebar(true);
    }
  });

  closeMobileSidebar(true);

  const persistSession = session => {
    if (!session) return;
    const { username, userId, role } = session;
    if (!username || !userId || !role) return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ username, userId, role }));
    } catch (error) {
      console.warn('Não foi possível salvar a sessão:', error);
    }
  };

  const getStoredSession = () => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const { username, userId, role } = parsed;
      if (!username || !userId || !role) return null;
      return { username, userId, role };
    } catch (error) {
      console.warn('Não foi possível recuperar a sessão:', error);
      return null;
    }
  };

  const clearStoredSession = () => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('Não foi possível limpar a sessão:', error);
    }
  };

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

  const isPageVisible = pageId => {
    const page = document.getElementById(pageId);
    return !!page && !page.classList.contains('hidden');
  };

  const formatDate = value => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('pt-BR');
  };

  const buildSuggestionSection = (title, icon, items, emptyMessage) => {
    if (!items || items.length === 0) {
      return `
        <section class="bg-background-light dark:bg-background-dark rounded-xl border border-gray-200/70 dark:border-gray-700/70 p-5">
          <header class="flex items-center gap-2 mb-3">
            <span class="material-icons text-secondary">${icon}</span>
            <h3 class="text-lg font-semibold">${title}</h3>
          </header>
          <p class="text-sm text-subtle-light dark:text-subtle-dark">${emptyMessage}</p>
        </section>`;
    }

    const listItems = items
      .map(item => {
        const quantity = Number(item.quantidade) || 0;
        const validade = item.validade ? formatDate(item.validade) : 'Sem validade';
        const subtitleParts = [];
        if (item.lote) subtitleParts.push(`Lote ${item.lote}`);
        subtitleParts.push(`${quantity} un.`);
        subtitleParts.push(`Validade: ${validade}`);
        return `
          <li class="flex items-start justify-between gap-4 py-2">
            <div>
              <p class="font-medium">${item.produto || 'Produto'}</p>
              <p class="text-xs text-subtle-light dark:text-subtle-dark">${subtitleParts.join(' • ')}</p>
            </div>
            <span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
              ${item.tipo || 'Categoria'}
            </span>
          </li>`;
      })
      .join('');

    return `
      <section class="bg-background-light dark:bg-background-dark rounded-xl border border-gray-200/70 dark:border-gray-700/70 p-5">
        <header class="flex items-center gap-2 mb-3">
          <span class="material-icons text-secondary">${icon}</span>
          <h3 class="text-lg font-semibold">${title}</h3>
        </header>
        <ul class="divide-y divide-gray-200/70 dark:divide-gray-700/60">${listItems}</ul>
      </section>`;
  };

  const generateSmartSuggestions = () => {
    if (!Array.isArray(estoqueData) || estoqueData.length === 0) {
      return '<p class="text-center text-subtle-light dark:text-subtle-dark">Carregando dados do estoque...</p>';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lowStock = estoqueData
      .filter(item => Number(item.quantidade) < 25)
      .sort((a, b) => Number(a.quantidade) - Number(b.quantidade))
      .slice(0, 4);

    const expiringSoon = estoqueData
      .filter(item => {
        if (!item.validade) return false;
        const expiry = new Date(item.validade);
        if (Number.isNaN(expiry.getTime())) return false;
        expiry.setHours(0, 0, 0, 0);
        const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        return diff <= 45 && diff >= 0;
      })
      .sort((a, b) => new Date(a.validade) - new Date(b.validade))
      .slice(0, 4);

    const bestSellers = estoqueData
      .slice()
      .sort((a, b) => Number(b.saidas || 0) - Number(a.saidas || 0))
      .slice(0, 4);

    return `
      <div class="space-y-5">
        ${buildSuggestionSection('Repor com urgência', 'inventory_2', lowStock, 'Nenhum item com estoque crítico no momento.')}
        ${buildSuggestionSection('Atentos à validade', 'event_available', expiringSoon, 'Sem produtos próximos do vencimento nos próximos 45 dias.')}
        ${buildSuggestionSection('Itens mais procurados', 'trending_up', bestSellers, 'Ainda não há histórico suficiente para recomendações.')}
      </div>`;
  };

  const getFullImageUrl = value => {
    if (!value) return null;
    if (value.startsWith('data:')) return value;
    if (/^https?:\/\//i.test(value)) return value;
    const normalized = value.startsWith('/') ? value : `/${value}`;
    if (!BASE_URL) return normalized;
    return `${BASE_URL}${normalized}`;
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

  const updateActiveUserCardPhoto = newSrc => {
    if (!activeUsersList || !currentUserId) return;
    const card = activeUsersList.querySelector(`[data-user-id="${currentUserId}"]`);
    if (!card) return;
    const avatar = card.querySelector('img[data-role="active-user-photo"]');
    if (!avatar) return;
    if (!avatar.dataset.fallbackSrc) avatar.dataset.fallbackSrc = FALLBACK_AVATAR_IMAGE;
    if (avatar.dataset.fallbackApplied) delete avatar.dataset.fallbackApplied;
    avatar.src = newSrc || getFullImageUrl(FALLBACK_AVATAR_IMAGE);
  };

  const updateAllAvatars = src => {
    const resolvedSrc = getFullImageUrl(src) || getFullImageUrl(FALLBACK_AVATAR_IMAGE);
    userAvatarImgs.forEach(img => {
      if (!img.dataset.fallbackSrc) img.dataset.fallbackSrc = FALLBACK_AVATAR_IMAGE;
      img.src = resolvedSrc;
      registerImageFallbacks(img);
    });
    updateActiveUserCardPhoto(resolvedSrc);
  };

  // Login -----------------------------------------------------------------------
  const anchoMitad = window.innerWidth / 2;
  const altoMitad = window.innerHeight / 2;
  let seguirPunteroMouse = true;

  const resetProfilePhoto = () => {
    const defaultPic = getFullImageUrl(FALLBACK_AVATAR_IMAGE);
    updateAllAvatars(defaultPic);
    profileModalImage.src = defaultPic;
    registerImageFallbacks(profileModalImage);
    if (currentUser) {
      localStorage.removeItem(`profilePhoto_${currentUser}`);
    }
    profileImageFile = null;
    if (profileImageUpload) profileImageUpload.value = '';
  };

  const initProfilePhoto = async () => {
    const defaultPic = getFullImageUrl(FALLBACK_AVATAR_IMAGE);
    if (!currentUserId) {
      updateAllAvatars(defaultPic);
      profileModalImage.src = defaultPic;
      registerImageFallbacks(profileModalImage);
      return;
    }
    const saved = currentUser ? localStorage.getItem(`profilePhoto_${currentUser}`) : null;
    if (saved) {
      const resolved = getFullImageUrl(saved);
      updateAllAvatars(resolved);
      profileModalImage.src = resolved;
      registerImageFallbacks(profileModalImage);
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/api/users/${currentUserId}/photo`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.photo) {
          const resolved = getFullImageUrl(data.photo);
          updateAllAvatars(resolved);
          profileModalImage.src = resolved;
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
    if (currentUser) {
      localStorage.removeItem(`profilePhoto_${currentUser}`);
    }
    updateAllAvatars(defaultPic);
    profileModalImage.src = defaultPic;
    registerImageFallbacks(profileModalImage);
  };

  const uploadProfilePhotoToServer = async file => {
    if (!currentUserId || !file) return null;
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch(`${BASE_URL}/api/users/${currentUserId}/photo`, {
      method: 'PUT',
      body: formData,
      credentials: 'include'
    });
    let data = {};
    try {
      data = await res.json();
    } catch (err) {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível atualizar a foto.');
    }
    return data.photo || null;
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };

  const connectSocket = () => {
    if (typeof io === 'undefined' || socket || !currentUserId) return;
    socket = io(BASE_URL || undefined, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    socket.on('connect_error', error => {
      console.error('Erro ao conectar ao servidor em tempo real:', error);
    });
    socket.on('dataUpdated', async () => {
      if (!currentUser) return;
      try {
        await refreshAllData({ force: true, silent: true });
      } catch (error) {
        console.error('Erro ao atualizar dados em tempo real:', error);
      }
    });
    socket.on('usersUpdated', async () => {
      if (userRole !== 'admin') return;
      usersDataDirty = true;
      if (isPageVisible('approve-page')) {
        try {
          await renderApprovalPage({ silent: true });
        } catch (error) {
          console.error('Erro ao atualizar usuários em tempo real:', error);
        }
      }
    });
    socket.on('userPhotoUpdated', async payload => {
      if (!payload) return;
      const { id, photo } = payload;
      if (id && String(id) === String(currentUserId)) {
        try {
          if (currentUser && typeof window !== 'undefined' && window.localStorage) {
            if (photo) {
              window.localStorage.setItem(`profilePhoto_${currentUser}`, photo);
            } else {
              window.localStorage.removeItem(`profilePhoto_${currentUser}`);
            }
          }
        } catch (error) {
          console.warn('Não foi possível atualizar a foto armazenada localmente:', error);
        }
        try {
          await initProfilePhoto();
        } catch (error) {
          console.error('Erro ao sincronizar foto de perfil:', error);
        }
      }
      if (userRole === 'admin') {
        usersDataDirty = true;
        if (isPageVisible('approve-page')) {
          try {
            await renderApprovalPage({ silent: true });
          } catch (error) {
            console.error('Erro ao atualizar usuários em tempo real:', error);
          }
        }
      }
    });
  };

  const enterApplication = async ({ username, userId, role, photo } = {}) => {
    if (!username || !userId || !role) return;
    currentUser = username;
    currentUserId = userId;
    userRole = role;
    persistSession({ username, userId, role });
    usersDataDirty = true;
    homeGreeting.textContent = `Bem-vindo de volta, ${username}!`;
    updateAllUserNames(username);
    loginContainer.classList.add('hidden');
    loginContainer.style.display = 'none';
    appContainer.classList.remove('hidden');
    if (photo) {
      try {
        localStorage.setItem(`profilePhoto_${currentUser}`, photo);
      } catch (error) {
        console.warn('Não foi possível armazenar a foto de perfil:', error);
      }
    }
    await initProfilePhoto();
    toggleAdminFeatures(userRole === 'admin');
    restoreStoredPage();
    stopAutoRefresh();
    await refreshAllData({ force: true });
    if (userRole === 'admin' && isPageVisible('approve-page') && usersDataDirty) {
      await renderApprovalPage();
    }
    startAutoRefresh();
    connectSocket();
  };

  const showLoginForm = () => {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  };

  const showRegisterForm = () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  };

  const showLoginScreen = () => {
    showLoginForm();
    loginContainer.style.display = 'flex';
    loginContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
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
      await enterApplication({
        username,
        userId: data.userId,
        role: data.role,
        photo: data.photo ?? null
      });
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
    clearStoredSession();
    disconnectSocket();
    currentUser = null;
    currentUserId = null;
    userRole = null;
    estoqueData = [];
    filteredProducts = [];
    movementsData = [];
    currentPage = 1;
    activePageId = null;
    usersDataDirty = true;
    isRestoringSession = false;
    stopAutoRefresh();
    pendingRealtimeRefresh = false;
    pendingRealtimeOptions = {};
    closeMobileSidebar(true);
    showLoginScreen();
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
  const refreshAllData = async (options = {}) => {
    const { force = false } = options;
    if (isRefreshingAllData) {
      if (force) {
        pendingRealtimeRefresh = true;
        pendingRealtimeOptions = { ...pendingRealtimeOptions, ...options, force: false };
      }
      return;
    }
    isRefreshingAllData = true;
    const filterStart = movInicio?.value || undefined;
    const filterEnd = movFim?.value || undefined;
    try {
      await Promise.all([
        loadStock(options),
        loadMovimentacoes(filterStart, filterEnd, options),
        loadReports(filterStart, filterEnd, options)
      ]);
      updateHomePage();
    } finally {
      isRefreshingAllData = false;
      if (pendingRealtimeRefresh) {
        const queuedOptions = { ...pendingRealtimeOptions };
        pendingRealtimeRefresh = false;
        pendingRealtimeOptions = {};
        refreshAllData(queuedOptions).catch(err => console.error('Erro ao atualizar dados pendentes:', err));
      }
    }
  };

  const loadStock = async (options = {}) => {
    const { silent = false, onLoaded } = options;
    try {
      if (!silent) showLoader();
      const res = await fetch(`${BASE_URL}/api/estoque`, { credentials: 'include' });
      const data = await res.json();
      const raw = Array.isArray(data)
        ? data
        : Object.entries(data || {}).map(([id, item]) => ({ id, ...item }));
      estoqueData = raw.filter(item => item);
      filteredProducts = [...estoqueData];
      currentPage = 1;
      renderStock();
      if (typeof onLoaded === 'function') {
        onLoaded();
      }
    } catch (err) {
      console.error('Erro ao carregar estoque:', err);
      alert('Erro ao carregar estoque: ' + err.message);
    } finally {
      if (!silent) hideLoader();
    }
  };

  const loadMovimentacoes = async (start, end, options = {}) => {
    const { silent = false } = options;
    try {
      const params = new URLSearchParams();
      if (start) params.append('start', start);
      if (end) params.append('end', end);
      if (!silent) showLoader();
      const res = await fetch(`${BASE_URL}/api/movimentacoes?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      movementsData = Array.isArray(data) ? data : [];
      renderMovimentacoes();
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
      alert('Erro ao carregar movimentações: ' + err.message);
    } finally {
      if (!silent) hideLoader();
    }
  };

  const loadReports = async (start, end, options = {}) => {
    const { silent = false } = options;
    try {
      const params = new URLSearchParams();
      if (start) params.append('start', start);
      if (end) params.append('end', end);
      if (!silent) showLoader();
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
      if (!silent) hideLoader();
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
      const imageSrc = getFullImageUrl(product.image) || placeholder.primary;
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

  const goToStockPageWithFilter = filter => {
    activeFilter = filter;
    currentPage = 1;
    if (filter === 'all' && searchInput) {
      searchInput.value = '';
    }
    setActiveFilterButton(filter);
    const applySelectedFilter = () => {
      setActiveFilterButton(filter);
      applyFilters();
    };
    const options = { onLoaded: applySelectedFilter };
    if (stockMenuItem) {
      activateMenuItem(stockMenuItem, options);
    } else {
      switchPage('stock-page', options);
    }
    if (estoqueData.length) {
      applySelectedFilter();
    }
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
    today.setHours(0, 0, 0, 0);
    const expiringSoon = estoqueData.filter(item => {
      if (!item.validade) return false;
      const expiry = new Date(item.validade);
      if (Number.isNaN(expiry.getTime())) return false;
      expiry.setHours(0, 0, 0, 0);
      const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      return diff <= 30 && diff >= 0;
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
    homeKpiExpiring.textContent = expiringSoon.toString();
    homeKpiStockValue.textContent = stockValue > 0
      ? `R$ ${stockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'R$ 0,00';

    if (recentActivityList) {
      recentActivityList.innerHTML = '';

      const ACTIVITY_STYLES = {
        entrada: {
          icon: 'add',
          badgeClasses: 'bg-green-100 dark:bg-green-900/50',
          iconClasses: 'text-green-600 dark:text-green-300',
          titlePrefix: 'Entrada'
        },
        adicao: {
          icon: 'add',
          badgeClasses: 'bg-green-100 dark:bg-green-900/50',
          iconClasses: 'text-green-600 dark:text-green-300',
          titlePrefix: 'Entrada'
        },
        reposicao: {
          icon: 'add',
          badgeClasses: 'bg-green-100 dark:bg-green-900/50',
          iconClasses: 'text-green-600 dark:text-green-300',
          titlePrefix: 'Entrada'
        },
        saida: {
          icon: 'remove',
          badgeClasses: 'bg-red-100 dark:bg-red-900/50',
          iconClasses: 'text-red-600 dark:text-red-300',
          titlePrefix: 'Saída'
        },
        exclusao: {
          icon: 'remove',
          badgeClasses: 'bg-red-100 dark:bg-red-900/50',
          iconClasses: 'text-red-600 dark:text-red-300',
          titlePrefix: 'Saída'
        },
        baixa: {
          icon: 'remove',
          badgeClasses: 'bg-red-100 dark:bg-red-900/50',
          iconClasses: 'text-red-600 dark:text-red-300',
          titlePrefix: 'Saída'
        },
        ajuste: {
          icon: 'edit',
          badgeClasses: 'bg-yellow-100 dark:bg-yellow-900/50',
          iconClasses: 'text-yellow-600 dark:text-yellow-300',
          titlePrefix: 'Ajuste'
        },
        edicao: {
          icon: 'edit',
          badgeClasses: 'bg-yellow-100 dark:bg-yellow-900/50',
          iconClasses: 'text-yellow-600 dark:text-yellow-300',
          titlePrefix: 'Ajuste'
        },
        atualizacao: {
          icon: 'edit',
          badgeClasses: 'bg-yellow-100 dark:bg-yellow-900/50',
          iconClasses: 'text-yellow-600 dark:text-yellow-300',
          titlePrefix: 'Ajuste'
        },
        usuario_aprovado: {
          icon: 'person_add',
          badgeClasses: 'bg-blue-100 dark:bg-blue-900/50',
          iconClasses: 'text-blue-600 dark:text-blue-300',
          titlePrefix: 'Usuário'
        },
        aprovacao_usuario: {
          icon: 'person_add',
          badgeClasses: 'bg-blue-100 dark:bg-blue-900/50',
          iconClasses: 'text-blue-600 dark:text-blue-300',
          titlePrefix: 'Usuário'
        },
        aprovacao: {
          icon: 'person_add',
          badgeClasses: 'bg-blue-100 dark:bg-blue-900/50',
          iconClasses: 'text-blue-600 dark:text-blue-300',
          titlePrefix: 'Usuário'
        },
        default: {
          icon: 'history',
          badgeClasses: 'bg-slate-100 dark:bg-slate-800/60',
          iconClasses: 'text-slate-600 dark:text-slate-300',
          titlePrefix: 'Movimentação'
        }
      };

      const normalizeType = value => {
        if (!value) return '';
        return value
          .toString()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
      };

      const recentMoves = [...movementsData]
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 3);

      if (recentMoves.length === 0) {
        recentActivityList.innerHTML = '<p class="text-sm text-subtle-light dark:text-subtle-dark text-center py-4">Nenhuma atividade recente.</p>';
        return;
      }

      recentMoves.forEach(move => {
        const moveType = normalizeType(move.tipo);
        const activityStyle = ACTIVITY_STYLES[moveType] || ACTIVITY_STYLES.default;

        const quantity = Number(move.quantidade) || 0;
        const quantitySymbol = (() => {
          if (['entrada', 'adicao', 'reposicao'].includes(moveType)) return '+';
          if (['saida', 'exclusao', 'baixa'].includes(moveType)) return '-';
          return '';
        })();
        const productName = move.produto || move.nomeProduto || '';
        const userLabel = move.usuario ? `Usuário: ${move.usuario}` : '';
        const destinationLabel = move.destino ? `Destino: ${move.destino}` : '';
        const details = [userLabel, destinationLabel].filter(Boolean).join(' · ');

        const timeLabel = (() => {
          if (!move.data) return 'Data não informada';
          const parsedDate = new Date(move.data);
          if (Number.isNaN(parsedDate.getTime())) return 'Data não informada';
          return parsedDate.toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
          });
        })();

        const item = document.createElement('div');
        item.className = 'flex items-center justify-between gap-4 py-1';
        item.innerHTML = `
          <div class="flex items-center gap-4">
            <div class="p-2 rounded-full ${activityStyle.badgeClasses}">
              <span class="material-icons ${activityStyle.iconClasses}">${activityStyle.icon}</span>
            </div>
            <div>
              <p class="font-medium text-text-light dark:text-text-dark">${activityStyle.titlePrefix}: ${quantitySymbol ? quantitySymbol + ' ' : ''}${quantity.toLocaleString('pt-BR')}x ${productName}</p>
              <p class="text-sm text-subtle-light dark:text-subtle-dark">${details || 'Movimentação registrada no sistema.'}</p>
            </div>
          </div>
          <p class="text-sm text-subtle-light dark:text-subtle-dark whitespace-nowrap text-right">${timeLabel}</p>`;
        recentActivityList.appendChild(item);
      });
    }
  };

  const renderApprovalPage = async (options = {}) => {
    const { silent = false } = options;
    if (!userRole || userRole !== 'admin') return;
    try {
      if (!silent) showLoader();
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
              <img src="https://placehold.co/40x40/f472b6/ffffff?text=${(user.username || 'U').charAt(0).toUpperCase()}" alt="${user.username}" class="w-10 h-10 rounded-full object-cover" loading="lazy" decoding="async" data-fallback-src="${FALLBACK_AVATAR_IMAGE}" onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='true';this.src=this.dataset.fallbackSrc;}">
              <div>
                <p class="font-semibold text-text-light dark:text-text-dark">${user.username}</p>
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
          const resolvedPhoto = getFullImageUrl(user.photo) || getFullImageUrl(FALLBACK_AVATAR_IMAGE);
          item.className = 'flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50';
          item.dataset.userId = user.id;
          item.innerHTML = `
            <div class="flex items-center gap-4">
              <img src="${resolvedPhoto}" alt="${user.username}" class="w-10 h-10 rounded-full object-cover" loading="lazy" decoding="async" data-role="active-user-photo" data-fallback-src="${FALLBACK_AVATAR_IMAGE}" onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='true';this.src=this.dataset.fallbackSrc;}">
              <div>
                <p class="font-semibold text-text-light dark:text-text-dark">${user.username}</p>
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
      usersDataDirty = false;
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      alert('Erro ao carregar usuários: ' + err.message);
    } finally {
      if (!silent) hideLoader();
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
    const addImageInput = document.getElementById('add-image');
    const imageFile = addImageInput?.files?.[0] ?? null;
    try {
      showLoader();
      const formData = new FormData();
      formData.append('produto', produto);
      formData.append('tipo', tipo);
      formData.append('lote', lote);
      formData.append('quantidade', String(quantidade));
      formData.append('validade', validade ?? '');
      formData.append('custo', String(custoFormatado));
      if (currentUser) formData.append('usuario', currentUser);
      if (imageFile) formData.append('image', imageFile);
      const res = await fetch(`${BASE_URL}/api/estoque`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao adicionar produto.');
        return;
      }
      closeModal('add-modal');
      addForm.reset();
      if (addImageInput) addImageInput.value = '';
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
    const existingImage = getFullImageUrl(product.image);
    preview.src = existingImage || placeholder.primary;
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
    const editImageInput = document.getElementById('edit-image');
    const newImageFile = editImageInput?.files?.[0] ?? null;
    try {
      showLoader();
      const formData = new FormData();
      formData.append('produto', produto);
      formData.append('tipo', tipo);
      formData.append('lote', lote);
      formData.append('quantidade', String(quantidade));
      formData.append('validade', validade ?? '');
      formData.append('custo', String(custoFormatado));
      if (currentUser) formData.append('usuario', currentUser);
      if (newImageFile) formData.append('image', newImageFile);
      const res = await fetch(`${BASE_URL}/api/estoque/${id}`, {
        method: 'PUT',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao atualizar produto.');
        return;
      }
      if (editImageInput) editImageInput.value = '';
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
  const storeActivePage = pageId => {
    activePageId = pageId;
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, pageId);
    } catch (error) {
      console.warn('Não foi possível salvar a aba ativa:', error);
    }
  };

  const getStoredActivePage = () => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      return window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
    } catch (error) {
      console.warn('Não foi possível recuperar a aba ativa:', error);
      return null;
    }
  };

  const switchPage = (pageId, options = {}) => {
    storeActivePage(pageId);
    pageContents.forEach(page => page.classList.add('hidden'));
    const target = document.getElementById(pageId);
    target?.classList.remove('hidden');
    if (pageId === 'stock-page') {
      if (!estoqueData.length) loadStock(options);
    } else if (pageId === 'reports-page') {
      loadReports(undefined, undefined, options);
    } else if (pageId === 'approve-page') {
      if (userRole === 'admin' && usersDataDirty) {
        renderApprovalPage(options);
      }
    }
  };

  const activateMenuItem = (link, options = {}) => {
    if (!link) return;
    highlightMenu(link);
    switchPage(link.dataset.page, options);
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
      activateMenuItem(link);
    });
  };

  const restoreStoredPage = () => {
    const storedPage = getStoredActivePage();
    if (storedPage) {
      if (storedPage === 'approve-page') {
        highlightMenu(null);
        switchPage('approve-page');
        return;
      }
      const storedLink = mainMenu?.querySelector(`a[data-page="${storedPage}"]`);
      if (storedLink) {
        activateMenuItem(storedLink);
        return;
      }
    }
    const homeLink = document.getElementById('home-menu-item');
    if (homeLink) activateMenuItem(homeLink);
  };

  const stopAutoRefresh = () => {
    if (autoRefreshIntervalId) {
      clearInterval(autoRefreshIntervalId);
      autoRefreshIntervalId = null;
    }
  };

  const startAutoRefresh = () => {
    if (typeof window === 'undefined') return;
    stopAutoRefresh();
    autoRefreshIntervalId = window.setInterval(() => {
      if (document.hidden || !currentUser) return;
      refreshAllData({ silent: true }).catch(err => console.error('Erro ao atualizar automaticamente:', err));
    }, AUTO_REFRESH_INTERVAL_MS);
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
    const fallbackSrc = userAvatarImgs[0]?.src || getFullImageUrl(FALLBACK_AVATAR_IMAGE);
    profileModalImage.src = fallbackSrc;
    registerImageFallbacks(profileModalImage);
    profileImageFile = null;
    if (profileImageUpload) profileImageUpload.value = '';
    openModal('profile-modal');
  };

  const handleProfileSave = async () => {
    if (profileImageFile) {
      try {
        showLoader();
        const uploadedPath = await uploadProfilePhotoToServer(profileImageFile);
        const resolved = getFullImageUrl(uploadedPath) || getFullImageUrl(FALLBACK_AVATAR_IMAGE);
        updateAllAvatars(resolved);
        profileModalImage.src = resolved;
        if (currentUser) {
          if (uploadedPath) {
            localStorage.setItem(`profilePhoto_${currentUser}`, uploadedPath);
          } else {
            localStorage.removeItem(`profilePhoto_${currentUser}`);
          }
        }
        registerImageFallbacks(profileModalImage);
      } catch (err) {
        alert('Erro ao salvar foto: ' + err.message);
        return;
      } finally {
        hideLoader();
      }
    }
    profileImageFile = null;
    if (profileImageUpload) profileImageUpload.value = '';
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

  const initializeFromStoredSession = async () => {
    if (isRestoringSession) return;
    const storedSession = getStoredSession();
    if (!storedSession) {
      showLoginScreen();
      return;
    }
    isRestoringSession = true;
    try {
      showLoader();
      await enterApplication(storedSession);
    } catch (error) {
      console.error('Erro ao restaurar sessão:', error);
      clearStoredSession();
      showLoginScreen();
    } finally {
      hideLoader();
      isRestoringSession = false;
    }
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
  approveLinks.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    document.querySelectorAll('.user-dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    highlightMenu(null);
    switchPage('approve-page');
  }));
  if (addProductLink) addProductLink.addEventListener('click', event => { event.preventDefault(); openModal('add-modal'); });
  if (quickAddBtn) quickAddBtn.addEventListener('click', () => openModal('add-modal'));
  if (stockAddProductBtn) stockAddProductBtn.addEventListener('click', () => openModal('add-modal'));
  if (suggestProductBtn) {
    suggestProductBtn.addEventListener('click', () => {
      if (suggestionsContent) {
        suggestionsContent.innerHTML = generateSmartSuggestions();
      }
      openModal('suggestions-modal');
    });
  }
  if (quickExportBtn) quickExportBtn.addEventListener('click', () => window.open(`${BASE_URL}/api/movimentacoes/csv`, '_blank'));
  if (homeKpiCardTotal) homeKpiCardTotal.addEventListener('click', () => goToStockPageWithFilter('all'));
  if (homeKpiCardLow) homeKpiCardLow.addEventListener('click', () => goToStockPageWithFilter('low_stock'));
  if (homeKpiCardExpiring) homeKpiCardExpiring.addEventListener('click', () => goToStockPageWithFilter('expiring_soon'));
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
  if (gridViewBtn && !gridViewBtn.classList.contains('bg-primary')) {
    gridViewBtn.classList.add('bg-primary', 'text-white');
  }
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
      profileImageFile = null;
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Selecione um arquivo de imagem.');
        profileImageFile = null;
        profileImageUpload.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Imagem deve ter no máximo 5MB.');
        profileImageFile = null;
        profileImageUpload.value = '';
        return;
      }
      profileImageFile = file;
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

  window.addEventListener('storage', event => {
    if (event.key !== SESSION_STORAGE_KEY) return;
    if (!event.newValue && currentUser) {
      logout();
    } else if (event.newValue && !currentUser) {
      initializeFromStoredSession();
    }
  });

  resetProfilePhoto();
  initializeFromStoredSession();
});


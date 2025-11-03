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
  let cashierMovementsData = [];
  let cashierActiveMovementFilter = 'all';
  let currentPage = 1;
  const itemsPerPage = 8;
  let currentView = 'grid';
  let activeFilter = 'all';
  let stockByProductChart = null;
  let stockByTypeChart = null;
  const loader = document.getElementById('loader');
  const FALLBACK_PRODUCT_IMAGE = 'img/placeholders/product-placeholder.svg';
  const FALLBACK_AVATAR_IMAGE = 'img/placeholders/avatar-placeholder.svg';
  const FALLBACK_PRIMARY_COLOR = '#6D28D9';
  const FALLBACK_PRIMARY_RGB = { r: 109, g: 40, b: 217 };
  let profileImageFile = null;
  let isRefreshingAllData = false;
  const AUTO_REFRESH_INTERVAL_MS = 60_000;
  let autoRefreshIntervalId = null;
  let activePageId = null;
  let socket = null;
  let usersDataDirty = true;
  let isRestoringSession = false;
  let pendingRealtimeRefresh = false;
  let pendingRealtimeOptions = {};
  let isSessionExpiryHandled = false;
  let isProcessingLogout = false;
  let activeModule = 'stock';
  const bodyElement = document.body;
  const darkModeMediaQuery = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

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
  const togglePasswordLoginIcon = document.getElementById('toggle-password-login-icon');
  const togglePasswordRegisterIcon = document.getElementById('toggle-password-register-icon');
  const monster = document.getElementById('monster');

  // Elementos gerais da aplicação
  const mainMenu = document.getElementById('main-menu');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const mobileMenuToggles = document.querySelectorAll('.mobile-menu-toggle');
  const mobileMenuCloseButtons = document.querySelectorAll('.mobile-menu-close');
  const darkModeToggles = document.querySelectorAll('.dark-mode-toggle');
  const stockSidebarContent = document.getElementById('stock-sidebar-content');
  const cashierSidebarContent = document.getElementById('cashier-sidebar-content');
  const moduleStockBtn = document.getElementById('module-stock-btn');
  const moduleCashierBtn = document.getElementById('module-cashier-btn');
  const stockModuleContainer = document.getElementById('stock-module');
  const cashierModuleContainer = document.getElementById('cashier-module');
  const cashierMenu = document.getElementById('cashier-menu');
  const cashierPages = document.querySelectorAll('#cashier-module .cashier-page');
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
  const GRID_VIEW_CLASSES = [
    'grid',
    'grid-cols-1',
    'sm:grid-cols-2',
    'lg:grid-cols-3',
    'xl:grid-cols-4',
    '2xl:grid-cols-5',
    'gap-6',
    'content-start',
  ];
  const LIST_VIEW_CLASSES = ['flex', 'flex-col', 'gap-4'];
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
  const cashierMovementsTableBody = document.getElementById('cashier-movements-table-body');
  const cashierFilterButtons = document.getElementById('cashier-filter-buttons');
  const cashierRegisterMovementBtn = document.getElementById('register-movement-btn');
  const cashierMovementModal = document.getElementById('cashier-movement-modal');
  const cashierMovementForm = document.getElementById('cashier-movement-form');
  const movementTypeSelect = document.getElementById('movement-type');
  const movementCategorySelect = document.getElementById('movement-category');
  const movementCategoryCustomInput = document.getElementById('movement-category-custom');
  const movementPaymentMethodSelect = document.getElementById('movement-payment-method');
  const cashierCancelMovementBtn = document.getElementById('cancel-movement-btn');

  const pendingUsersList = document.getElementById('pending-users-list');
  const activeUsersList = document.getElementById('active-users-list');

  const cashierKpiElements = {
    total: {
      valueEl: document.getElementById('cashier-kpi-total'),
      changeWrapper: document.querySelector('[data-kpi-change="total"]'),
      changeTextEl: document.querySelector('[data-kpi-change-text="total"]'),
      iconEl: document.querySelector('[data-kpi-trend-icon="total"]'),
    },
    revenue: {
      valueEl: document.getElementById('cashier-kpi-revenue'),
      changeWrapper: document.querySelector('[data-kpi-change="revenue"]'),
      changeTextEl: document.querySelector('[data-kpi-change-text="revenue"]'),
      iconEl: document.querySelector('[data-kpi-trend-icon="revenue"]'),
    },
    expenses: {
      valueEl: document.getElementById('cashier-kpi-expenses'),
      changeWrapper: document.querySelector('[data-kpi-change="expenses"]'),
      changeTextEl: document.querySelector('[data-kpi-change-text="expenses"]'),
      iconEl: document.querySelector('[data-kpi-trend-icon="expenses"]'),
    },
    profit: {
      valueEl: document.getElementById('cashier-kpi-profit'),
      changeWrapper: document.querySelector('[data-kpi-change="profit"]'),
      changeTextEl: document.querySelector('[data-kpi-change-text="profit"]'),
      iconEl: document.querySelector('[data-kpi-trend-icon="profit"]'),
    },
  };

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
  const cashierPaymentMethodsCanvas = document.getElementById('cashier-payment-methods-chart');
  const cashierCashFlowCanvas = document.getElementById('cashier-cash-flow-chart');
  const cashierPaymentMethodsList = document.getElementById('cashier-payment-methods-list');
  const cashierAnalysisList = document.getElementById('cashier-analysis-list');
  const cashierCashFlowRadios = document.querySelectorAll('input[name="cashier-cashflow"]');
  const cashierAnalysisRadios = document.querySelectorAll('input[name="cashier-analysis"]');
  const cashierSettingsLogoPreview = document.getElementById('cashier-settings-logo-preview');
  const cashierSettingsLogoUpload = document.getElementById('cashier-settings-logo-upload');
  const cashierSettingsChangeLogoBtn = document.getElementById('cashier-settings-change-logo-btn');
  const cashierSettingsCategoriesBody = document.getElementById('cashier-settings-categories-body');
  const cashierSettingsAddCategoryBtn = document.getElementById('cashier-settings-add-category-btn');
  const cashierSettingsCashLimitInput = document.getElementById('cashier-settings-cash-limit');
  const cashierSettingsSaveCashLimitBtn = document.getElementById('cashier-settings-save-cash-limit-btn');
  const cashierSettingsPaymentMethodsBody = document.getElementById('cashier-settings-payment-methods-body');
  const cashierSettingsBackupBtn = document.getElementById('cashier-settings-backup-btn');
  const cashierCategoryModal = document.getElementById('cashier-category-modal');
  const cashierCategoryForm = document.getElementById('cashier-category-form');
  const cashierCategoryTitle = document.getElementById('cashier-category-modal-title');
  const cashierCategoryIdInput = document.getElementById('cashier-category-id');
  const cashierCategoryNameInput = document.getElementById('cashier-category-name');
  const cashierCategoryTypeInput = document.getElementById('cashier-category-type');
  const cashierCategoryCancelBtn = document.getElementById('cashier-category-cancel-btn');
  const cashierSettingsToast = document.getElementById('cashier-settings-toast');

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

  const setModuleButtonState = moduleName => {
    const isStock = moduleName === 'stock';
    moduleStockBtn?.classList.toggle('is-active', isStock);
    moduleCashierBtn?.classList.toggle('is-active', !isStock);
  };

  const applyModuleVisibility = moduleName => {
    const showCashier = moduleName === 'cashier';
    stockModuleContainer?.classList.toggle('hidden', showCashier);
    cashierModuleContainer?.classList.toggle('hidden', !showCashier);
    stockSidebarContent?.classList.toggle('hidden', showCashier);
    cashierSidebarContent?.classList.toggle('hidden', !showCashier);
    bodyElement.classList.toggle('theme-stock', !showCashier);
    bodyElement.classList.toggle('theme-cashier', showCashier);
    activeModule = moduleName;
  };

  const storeActiveModule = moduleName => {
    activeModule = moduleName;
  };

  const getStoredActiveModule = () => null;

  const switchToStockModule = ({ skipStore } = {}) => {
    applyModuleVisibility('stock');
    setModuleButtonState('stock');
    if (!skipStore) {
      storeActiveModule('stock');
    }
  };

  const CASHIER_ACTIVE_CLASS = 'cashier-menu-active';

  const highlightCashierMenuItem = link => {
    if (!cashierMenu) return;
    cashierMenu.querySelectorAll('a[data-page]').forEach(item => {
      item.classList.remove(CASHIER_ACTIVE_CLASS);
    });
    if (link) {
      link.classList.add(CASHIER_ACTIVE_CLASS);
    }
  };

  const switchCashierPage = pageId => {
    if (!pageId) return;
    cashierPages.forEach(page => {
      if (!page) return;
      page.classList.toggle('hidden', page.id !== pageId);
    });
  };

  const activateCashierMenuItem = link => {
    if (!link) return;
    highlightCashierMenuItem(link);
    switchCashierPage(link.dataset.page);
  };

  const openCashierSettingsPage = () => {
    switchToCashierModule();
    loadCashierSettings({ silent: true }).catch(error => {
      console.error('Erro ao atualizar configurações do caixa:', error);
    });
    const settingsMenuLink = cashierMenu?.querySelector('a[data-page="cashier-settings-page"]');
    if (settingsMenuLink) {
      activateCashierMenuItem(settingsMenuLink);
    } else {
      switchCashierPage('cashier-settings-page');
    }
  };

  const clearMainMenuHighlight = () => {
    if (!mainMenu) return;
    mainMenu.querySelectorAll('a').forEach(item => {
      item.classList.remove('bg-white/20', 'text-white');
      item.classList.add('text-white/70', 'hover:bg-white/10');
    });
  };

  const switchToCashierModule = ({ skipStore } = {}) => {
    applyModuleVisibility('cashier');
    setModuleButtonState('cashier');
    clearMainMenuHighlight();
    const currentActive = cashierMenu?.querySelector(`a[data-page].${CASHIER_ACTIVE_CLASS}`)
      || cashierMenu?.querySelector('a[data-page]');
    if (currentActive) {
      switchCashierPage(currentActive.dataset.page);
    } else {
      const defaultLink = cashierMenu?.querySelector('a[data-page="cashier-dashboard-page"]');
      if (defaultLink) activateCashierMenuItem(defaultLink);
    }
    if (!skipStore) {
      storeActiveModule('cashier');
    }
  };

  const restoreStoredModule = () => {
    const storedModule = getStoredActiveModule();
    if (storedModule === 'cashier') {
      switchToCashierModule({ skipStore: true });
      return 'cashier';
    }
    switchToStockModule({ skipStore: true });
    return 'stock';
  };

  mainMenu?.addEventListener('click', event => {
    if (!(event.target instanceof HTMLElement)) return;
    if (isDesktopViewport()) return;
    if (event.target.closest('a')) {
      closeMobileSidebar(true);
    }
  });

  closeMobileSidebar(true);

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

  const formatCurrencyBRL = value => {
    const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    return numericValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const DEFAULT_CASHIER_METRICS = {
    total: { value: 0, change: 0, trend: 'up' },
    revenue: { value: 0, change: 0, trend: 'up' },
    expenses: { value: 0, change: 0, trend: 'down' },
    profit: { value: 0, change: 0, trend: 'up' },
  };

  let cashierDashboardMetrics = Object.keys(DEFAULT_CASHIER_METRICS).reduce((acc, key) => {
    acc[key] = { ...DEFAULT_CASHIER_METRICS[key] };
    return acc;
  }, {});

  const updateCashierDashboard = (metrics = cashierDashboardMetrics) => {
    Object.entries(cashierKpiElements).forEach(([key, elements]) => {
      if (!elements) return;
      const { valueEl, changeWrapper, changeTextEl, iconEl } = elements;
      const metric = metrics?.[key];
      if (valueEl) {
        valueEl.textContent = formatCurrencyBRL(metric?.value ?? 0);
      }
      if (!changeWrapper || !changeTextEl || !iconEl) return;
      const changeValue = Number.isFinite(Number(metric?.change)) ? Number(metric.change) : 0;
      const trend = metric?.trend === 'down' ? 'down' : changeValue < 0 ? 'down' : 'up';
      iconEl.textContent = trend === 'down' ? 'arrow_downward' : 'arrow_upward';
      const sign = changeValue > 0 ? '+' : '';
      changeTextEl.textContent = `${sign}${changeValue}% vs mês passado`;
      changeWrapper.classList.remove('text-success', 'text-danger');
      changeWrapper.classList.add(trend === 'down' ? 'text-danger' : 'text-success');
    });
  };

  const setCashierDashboardMetrics = updates => {
    if (!updates || typeof updates !== 'object') {
      updateCashierDashboard();
      return;
    }
    const nextMetrics = { ...cashierDashboardMetrics };
    Object.entries(updates).forEach(([key, data]) => {
      if (!nextMetrics[key]) {
        nextMetrics[key] = {};
      }
      nextMetrics[key] = {
        ...nextMetrics[key],
        ...(typeof data === 'object' ? data : {}),
      };
    });
    cashierDashboardMetrics = nextMetrics;
    updateCashierDashboard();
  };

  const CASHIER_ENTRY_TYPES = new Set(['entrada', 'adicao', 'reposicao', 'venda', 'reforco', 'aporte', 'deposito', 'recebimento']);
  const CASHIER_EXPENSE_TYPES = new Set(['saida', 'exclusao', 'baixa', 'despesa', 'retirada', 'pagamento', 'pagamentodespesa', 'pagamento_despesa', 'custo', 'fechamento']);
  const CASHIER_REINFORCEMENT_TYPES = new Set(['reforco', 'aporte', 'suprimento', 'reabertura']);

  const DEFAULT_CASHIER_REPORTS_DATA = {
    paymentMethods: [],
    cashFlow: {
      daily: {
        labels: [],
        values: [],
      },
      weekly: {
        labels: [],
        values: [],
      },
      monthly: {
        labels: [],
        values: [],
      },
    },
    comparative: {
      expenses: [],
      reinforcements: [],
      categories: [],
    },
  };

  let cashierPaymentMethodsChart = null;
  let cashierCashFlowChart = null;
  let cachedCashierReportsData = null;
  let cashierReportsInitialized = false;
  let cashierSelectedAnalysis = 'expenses';
  let cashierSelectedCashFlowPeriod = 'monthly';
  let cashierSettingsState = null;
  let cashierSettingsToastTimeoutId = null;

  const resolveColorValue = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    return color => {
      if (!ctx) return color;
      ctx.fillStyle = FALLBACK_PRIMARY_COLOR;
      ctx.fillStyle = color;
      return ctx.fillStyle;
    };
  })();

  const hexToRgb = hex => {
    if (!hex) return { ...FALLBACK_PRIMARY_RGB };
    let normalized = hex.replace('#', '');
    if (normalized.length === 3) {
      normalized = normalized.split('').map(char => char + char).join('');
    }
    const intValue = Number.parseInt(normalized, 16);
    if (Number.isNaN(intValue)) return { ...FALLBACK_PRIMARY_RGB };
    return {
      r: (intValue >> 16) & 255,
      g: (intValue >> 8) & 255,
      b: intValue & 255,
    };
  };

  const parseColorToRgb = color => {
    if (!color) return { ...FALLBACK_PRIMARY_RGB };
    const resolved = resolveColorValue(color);
    if (resolved.startsWith('#')) {
      return hexToRgb(resolved);
    }
    const match = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (match) {
      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
      };
    }
    return { ...FALLBACK_PRIMARY_RGB };
  };

  const mixColorWithWhite = (rgb, weight = 1) => {
    const clampedWeight = Math.max(0.45, Math.min(1, weight));
    const whitePortion = 1 - clampedWeight;
    const mix = component => Math.round(component * clampedWeight + 255 * whitePortion);
    return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
  };

  const rgbaFromRgb = (rgb, alpha) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha))})`;

  const getAccessibleChartPalette = (count = 6) => {
    const rootStyles = getComputedStyle(document.documentElement);
    const candidateVars = [
      '--color-primary',
      '--color-secondary',
      '--color-success',
      '--color-danger',
      '--color-info',
      '--color-warning',
    ];
    const palette = [];

    candidateVars.forEach(varName => {
      const value = rootStyles.getPropertyValue(varName)?.trim();
      if (!value) return;
      const resolved = resolveColorValue(value);
      if (resolved && !palette.includes(resolved)) {
        palette.push(resolved);
      }
    });

    const fallbackColors = [
      FALLBACK_PRIMARY_COLOR,
      '#9333EA',
      '#16A34A',
      '#DC2626',
      '#0EA5E9',
      '#F59E0B',
      '#1D4ED8',
      '#F97316',
      '#4B5563',
    ];

    fallbackColors.forEach(color => {
      if (palette.length >= count) return;
      const resolved = resolveColorValue(color);
      if (resolved && !palette.includes(resolved)) {
        palette.push(resolved);
      }
    });

    return palette.slice(0, count);
  };

  const normalizeText = value => {
    if (!value) return '';
    return value
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const CASHIER_REINFORCEMENT_KEYWORDS = Object.freeze(['reforc', 'aporte', 'supriment', 'reabert']);
  const CASHIER_REINFORCEMENT_LEADING_WORDS = Object.freeze([
    'reforco',
    'reforcos',
    'suprimento',
    'suprimentos',
    'aporte',
    'aportes',
    'reabertura',
    'reaberturas',
  ]);

  const includesReinforcementKeyword = value => {
    if (typeof value !== 'string') return false;
    const normalized = normalizeText(value);
    if (!normalized) return false;
    return CASHIER_REINFORCEMENT_KEYWORDS.some(keyword => normalized.includes(keyword));
  };

  const startsWithReinforcementWord = value => {
    if (typeof value !== 'string') return false;
    const normalized = normalizeText(value);
    if (!normalized) return false;
    return CASHIER_REINFORCEMENT_LEADING_WORDS.some(word => normalized === word || normalized.startsWith(`${word} `));
  };

  const isTruthyReinforcementFlag = value => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const normalized = normalizeText(value);
      if (!normalized) return false;
      if (['1', 'true', 'sim', 'yes'].includes(normalized)) return true;
      if (startsWithReinforcementWord(normalized) || includesReinforcementKeyword(normalized)) return true;
    }
    return false;
  };

  const parseLocaleNumber = rawValue => {
    if (typeof rawValue === 'number') {
      return Number.isFinite(rawValue) ? rawValue : Number.NaN;
    }
    if (typeof rawValue !== 'string') return Number.NaN;
    const trimmed = rawValue.trim();
    if (!trimmed) return Number.NaN;

    const sanitized = trimmed.replace(/\s+/g, '').replace(/[^0-9.,-]/g, '');
    if (!sanitized) return Number.NaN;

    let hasLeadingMinus = sanitized.startsWith('-');
    let unsigned = hasLeadingMinus ? sanitized.slice(1) : sanitized;
    if (!hasLeadingMinus && sanitized.endsWith('-')) {
      hasLeadingMinus = true;
      unsigned = sanitized.slice(0, -1);
    }
    if (!unsigned) return Number.NaN;

    const commaIndex = unsigned.lastIndexOf(',');
    const dotIndex = unsigned.lastIndexOf('.');
    let normalized = unsigned;

    if (commaIndex !== -1 && dotIndex !== -1) {
      if (commaIndex > dotIndex) {
        normalized = unsigned.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = unsigned.replace(/,/g, '');
      }
    } else if (commaIndex !== -1) {
      normalized = unsigned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = unsigned.replace(/,/g, '');
    }

    const numeric = Number.parseFloat(normalized);
    if (!Number.isFinite(numeric)) return Number.NaN;
    return hasLeadingMinus ? -numeric : numeric;
  };

  const parseMovementAmount = movement => {
    const candidates = [
      movement?.valor,
      movement?.valorTotal,
      movement?.total,
      movement?.montante,
      movement?.amount,
      movement?.quantidade,
      movement?.qtd,
      movement?.value,
    ];
    for (const candidate of candidates) {
      const numeric = parseLocaleNumber(candidate);
      if (Number.isFinite(numeric) && Math.abs(numeric) > 0) {
        return Math.abs(numeric);
      }
    }
    return 0;
  };

  const parseMovementDate = movement => {
    if (!movement?.data) return null;
    const parsed = new Date(movement.data);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getWeekInfo = date => {
    if (!(date instanceof Date)) {
      return { key: 'sem-data', label: 'Sem data' };
    }
    const clone = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = clone.getUTCDay() || 7; // 1 (Mon) - 7 (Sun)
    clone.setUTCDate(clone.getUTCDate() - day + 1);
    const weekStart = new Date(clone);
    const weekEnd = new Date(clone);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const weekNumber = (() => {
      const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
      return Math.ceil(((tempDate - yearStart) / 86400000 + 1) / 7);
    })();
    const startLabel = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const endLabel = weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return {
      key: `${weekStart.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`,
      label: `Sem ${weekNumber}`,
      rangeLabel: `${startLabel} - ${endLabel}`,
    };
  };

  const ensureCashFlowBucket = (collection, key, label, fallback = 'Sem dados') => {
    if (!collection[key]) {
      collection[key] = { label: label || fallback, entries: 0, expenses: 0 };
    } else if (label) {
      collection[key].label = label;
    }
    return collection[key];
  };

  const buildSortedFlow = (collection, { limit } = {}) => {
    const entries = Object.entries(collection)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, data]) => ({ ...data }));
    const trimmed = typeof limit === 'number' ? entries.slice(-limit) : entries;
    return {
      labels: trimmed.map(item => item.label),
      values: trimmed.map(item => Number((item.entries - item.expenses).toFixed(2))),
    };
  };

  const mergeDatasetWithDefault = (computed, defaults) => {
    const base = defaults || DEFAULT_CASHIER_REPORTS_DATA;
    const cloneArray = value => (Array.isArray(value)
      ? value.map(item => (typeof item === 'object' && item !== null ? { ...item } : item))
      : []);
    const cloneSegment = segment => ({
      labels: Array.isArray(segment?.labels) ? [...segment.labels] : [],
      values: Array.isArray(segment?.values) ? [...segment.values] : [],
    });

    const source = computed && typeof computed === 'object' ? computed : {};

    return {
      paymentMethods: cloneArray(source.paymentMethods ?? base.paymentMethods),
      cashFlow: {
        daily: cloneSegment(source.cashFlow?.daily ?? base.cashFlow?.daily),
        weekly: cloneSegment(source.cashFlow?.weekly ?? base.cashFlow?.weekly),
        monthly: cloneSegment(source.cashFlow?.monthly ?? base.cashFlow?.monthly),
      },
      comparative: {
        expenses: cloneArray(source.comparative?.expenses ?? base.comparative?.expenses),
        reinforcements: cloneArray(source.comparative?.reinforcements ?? base.comparative?.reinforcements),
        categories: cloneArray(source.comparative?.categories ?? base.comparative?.categories),
      },
    };
  };

  const sortCashierMovements = (movements = []) => {
    return [...movements]
      .filter(item => item)
      .sort((a, b) => {
        const dateA = a?.data ? new Date(a.data) : null;
        const dateB = b?.data ? new Date(b.data) : null;
        const timeA = dateA && !Number.isNaN(dateA.getTime()) ? dateA.getTime() : 0;
        const timeB = dateB && !Number.isNaN(dateB.getTime()) ? dateB.getTime() : 0;
        return timeB - timeA;
      });
  };

  const normalizeCashierMovement = movement => {
    if (!movement || typeof movement !== 'object') return null;
    const toTrimmedString = value => (typeof value === 'string' ? value.trim() : '');
    const generateId = () => `cashier-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    const id = toTrimmedString(movement.id) || generateId();
    const rawDate = movement.data || movement.date || movement.createdAt || movement.timestamp;
    const parsedDate = rawDate ? new Date(rawDate) : null;
    const isoDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();

    const type = toTrimmedString(movement.tipo) || toTrimmedString(movement.type) || 'Entrada';
    const category = toTrimmedString(movement.categoria) || toTrimmedString(movement.category) || 'Outros';
    const employee = toTrimmedString(movement.funcionario)
      || toTrimmedString(movement.employee)
      || toTrimmedString(movement.colaborador)
      || toTrimmedString(movement.responsavel)
      || 'Equipe';
    const observations = toTrimmedString(movement.observacoes)
      || toTrimmedString(movement.observacao)
      || toTrimmedString(movement.notes)
      || toTrimmedString(movement.descricao)
      || toTrimmedString(movement.description);

    const amountCandidates = [movement.valor, movement.value, movement.amount, movement.total, movement.montante];
    let numericValue = 0;
    for (const candidate of amountCandidates) {
      const parsed = parseLocaleNumber(candidate);
      if (Number.isFinite(parsed)) {
        numericValue = Math.abs(parsed);
        if (numericValue > 0) break;
      }
    }
    const sanitizedValue = Math.round(Math.abs(numericValue) * 100) / 100;

    const normalizedType = normalizeText(type) || 'entrada';
    const paymentMethod = toTrimmedString(movement.formaPagamento)
      || toTrimmedString(movement.metodoPagamento)
      || toTrimmedString(movement.metodo)
      || toTrimmedString(movement.paymentMethod)
      || (normalizedType === 'saida' ? 'Despesas' : 'Dinheiro');

    return {
      id,
      data: isoDate,
      tipo: type || 'Entrada',
      categoria: category || 'Outros',
      valor: Number.isFinite(sanitizedValue) ? sanitizedValue : 0,
      funcionario: employee || 'Equipe',
      observacoes: observations,
      formaPagamento: paymentMethod,
    };
  };

  const fetchCashierMovementsFromServer = async () => {
    const data = await authenticatedJsonFetch(`${BASE_URL}/api/cashier/movements`);
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map(normalizeCashierMovement).filter(Boolean);
  };

  const loadCashierMovements = async ({ silent = false } = {}) => {
    try {
      if (!silent) showLoader();
      const movements = await fetchCashierMovementsFromServer();
      cashierMovementsData = sortCashierMovements(movements);
      setActiveCashierMovementFilterButton(cashierActiveMovementFilter);
      renderCashierMovementsTable();
      recalculateCashierDashboardFromMovements();
      renderCashierReports(cashierMovementsData);
    } catch (error) {
      console.error('Erro ao carregar movimentações do caixa:', error);
      if (!silent) alert('Erro ao carregar movimentações do caixa: ' + error.message);
    } finally {
      if (!silent) hideLoader();
    }
  };

  const getFilteredCashierMovements = () => {
    const normalizedFilter = normalizeText(cashierActiveMovementFilter);
    const sorted = sortCashierMovements(cashierMovementsData);
    if (!normalizedFilter || normalizedFilter === 'all') {
      return sorted;
    }
    return sorted.filter(movement => normalizeText(movement?.tipo) === normalizedFilter);
  };

  const CASHIER_FILTER_ACTIVE_CLASSES = ['bg-primary', 'text-white', 'border', 'border-transparent', 'shadow-sm', 'transition-colors'];
  const CASHIER_FILTER_INACTIVE_CLASSES = [
    'bg-surface-light',
    'dark:bg-gray-800',
    'border',
    'border-gray-300',
    'dark:border-gray-600',
    'text-gray-700',
    'dark:text-gray-300',
    'hover:bg-gray-50',
    'dark:hover:bg-gray-700',
    'transition-colors',
  ];

  const setActiveCashierMovementFilterButton = (filter = 'all') => {
    if (!cashierFilterButtons) return;
    const target = filter || 'all';
    cashierFilterButtons.querySelectorAll('button[data-filter]').forEach(button => {
      const isActive = button.dataset.filter === target;
      button.classList.remove(...CASHIER_FILTER_ACTIVE_CLASSES, ...CASHIER_FILTER_INACTIVE_CLASSES);
      if (isActive) {
        button.classList.add(...CASHIER_FILTER_ACTIVE_CLASSES);
      } else {
        button.classList.add(...CASHIER_FILTER_INACTIVE_CLASSES);
      }
    });
  };

  const renderCashierMovementsTable = () => {
    if (!cashierMovementsTableBody) return;
    cashierMovementsTableBody.innerHTML = '';
    const movements = getFilteredCashierMovements();
    if (!movements.length) {
      const emptyRow = document.createElement('tr');
      emptyRow.className = 'bg-white dark:bg-surface-dark/40';
      const td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'px-6 py-6 text-center text-sm text-subtle-light dark:text-subtle-dark';
      td.textContent = 'Nenhuma movimentação encontrada.';
      emptyRow.appendChild(td);
      cashierMovementsTableBody.appendChild(emptyRow);
      return;
    }

    movements.forEach(movement => {
      const tr = document.createElement('tr');
      tr.className = 'bg-white dark:bg-surface-dark/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors';

      const formattedDate = (() => {
        if (!movement?.data) return '-';
        const parsed = new Date(movement.data);
        if (Number.isNaN(parsed.getTime())) return '-';
        return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '');
      })();

      const normalizedType = normalizeText(movement?.tipo);
      const typeClass = normalizedType === 'saida' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success';
      const valueClass = normalizedType === 'saida' ? 'text-danger' : 'text-success';

      const dateCell = document.createElement('td');
      dateCell.className = 'px-6 py-4 text-sm font-medium text-text-light dark:text-white whitespace-nowrap';
      dateCell.textContent = formattedDate;

      const typeCell = document.createElement('td');
      typeCell.className = 'px-6 py-4';
      const typeBadge = document.createElement('span');
      typeBadge.className = `px-2 py-1 text-xs font-semibold rounded-full ${typeClass}`;
      typeBadge.textContent = movement?.tipo || '-';
      typeCell.appendChild(typeBadge);

      const categoryCell = document.createElement('td');
      categoryCell.className = 'px-6 py-4 text-sm';
      categoryCell.textContent = movement?.categoria || '—';

      const valueCell = document.createElement('td');
      valueCell.className = `px-6 py-4 text-right text-sm font-semibold ${valueClass}`;
      valueCell.textContent = formatCurrencyBRL(movement?.valor || 0);

      const employeeCell = document.createElement('td');
      employeeCell.className = 'px-6 py-4 text-sm';
      employeeCell.textContent = movement?.funcionario || '—';

      const observationsCell = document.createElement('td');
      observationsCell.className = 'px-6 py-4 text-sm max-w-xs';
      observationsCell.textContent = movement?.observacoes?.trim() ? movement.observacoes : '—';

      tr.appendChild(dateCell);
      tr.appendChild(typeCell);
      tr.appendChild(categoryCell);
      tr.appendChild(valueCell);
      tr.appendChild(employeeCell);
      tr.appendChild(observationsCell);
      cashierMovementsTableBody.appendChild(tr);
    });
  };

  const recalculateCashierDashboardFromMovements = () => {
    if (!Array.isArray(cashierMovementsData)) {
      updateCashierDashboard();
      return;
    }

    const now = new Date();
    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousKey = `${previousDate.getFullYear()}-${previousDate.getMonth()}`;

    const totals = {
      current: { entries: 0, expenses: 0 },
      previous: { entries: 0, expenses: 0 },
    };

    cashierMovementsData.forEach(movement => {
      const amount = parseMovementAmount(movement);
      if (!(amount > 0)) return;
      const parsedDate = parseMovementDate(movement) || (movement?.data ? new Date(movement.data) : null);
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) return;
      const key = `${parsedDate.getFullYear()}-${parsedDate.getMonth()}`;
      const bucket = key === currentKey ? totals.current : key === previousKey ? totals.previous : null;
      if (!bucket) return;
      const type = normalizeText(movement?.tipo);
      if (CASHIER_ENTRY_TYPES.has(type) || type.includes('entrada')) {
        bucket.entries += amount;
      } else if (CASHIER_EXPENSE_TYPES.has(type) || type.includes('saida')) {
        bucket.expenses += amount;
      }
    });

    const calculateChange = (current, previous, { invertTrend = false } = {}) => {
      const currentValue = Number(current) || 0;
      const previousValue = Number(previous) || 0;
      let change = 0;
      if (previousValue > 0) {
        change = ((currentValue - previousValue) / previousValue) * 100;
      } else if (currentValue > 0) {
        change = 100;
      }
      if (!Number.isFinite(change)) change = 0;
      const rounded = Math.round(change);
      const isPositive = rounded >= 0;
      const trend = invertTrend
        ? (isPositive ? 'down' : 'up')
        : (isPositive ? 'up' : 'down');
      return { change: rounded, trend };
    };

    const revenue = totals.current.entries;
    const expenses = totals.current.expenses;
    const profit = revenue - expenses;

    const previousRevenue = totals.previous.entries;
    const previousExpenses = totals.previous.expenses;
    const previousProfit = previousRevenue - previousExpenses;

    setCashierDashboardMetrics({
      total: { value: profit, ...calculateChange(profit, previousProfit) },
      revenue: { value: revenue, ...calculateChange(revenue, previousRevenue) },
      expenses: { value: expenses, ...calculateChange(expenses, previousExpenses, { invertTrend: true }) },
      profit: { value: profit, ...calculateChange(profit, previousProfit) },
    });
  };

  const openCashierMovementModal = () => {
    populateCashierMovementFormOptions();
    openModal('cashier-movement-modal');
  };
  const closeCashierMovementModal = () => closeModal('cashier-movement-modal');

  const handleCashierMovementSubmit = async event => {
    event.preventDefault();
    if (!cashierMovementForm) return;

    const formData = new FormData(cashierMovementForm);
    const type = (formData.get('type') || 'Entrada').toString();
    const employee = (formData.get('employee') || '').toString().trim() || 'Equipe';
    const observations = (formData.get('observations') || '').toString().trim();
    const selectedCategory = (formData.get('category') || '').toString();
    const customCategory = (formData.get('category-custom') || '').toString().trim();

    let category = selectedCategory;
    if (!category || category === '__custom__' || category === '__placeholder__') {
      category = customCategory;
    }
    if (!category) {
      alert('Informe uma categoria para a movimentação.');
      return;
    }

    const rawValue = formData.get('value');
    const numericValue = parseLocaleNumber(rawValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      alert('Informe um valor válido para a movimentação.');
      return;
    }
    const sanitizedValue = Math.round(Math.abs(numericValue) * 100) / 100;

    const normalizedType = normalizeText(type);
    const paymentMethodRaw = (formData.get('payment-method') || '').toString().trim()
      || movementPaymentMethodSelect?.value
      || (normalizedType === 'saida' ? 'Cartão' : 'Dinheiro');
    const paymentMethod = paymentMethodRaw || 'Dinheiro';
    const normalizedPaymentMethod = normalizeText(paymentMethod);

    const cashLimit = parseCashierCashLimitValue();
    if (Number.isFinite(cashLimit) && normalizedType !== 'saida') {
      const cashMethodNames = new Set(
        getCashPaymentMethodNames().map(name => normalizeText(name)).filter(Boolean),
      );
      const isCashPayment = cashMethodNames.has(normalizedPaymentMethod) || isCashPaymentMethodName(paymentMethod);
      if (isCashPayment) {
        const currentCashOnHand = calculateCashOnHand();
        const projectedCash = currentCashOnHand + sanitizedValue;
        if (projectedCash > cashLimit) {
          const formattedLimit = formatCurrencyBRL(cashLimit);
          alert(`Esta operação ultrapassa o limite de caixa configurado (${formattedLimit}). Ajuste o valor ou selecione outra forma de pagamento.`);
          return;
        }
      }
    }

    const payload = {
      tipo: type,
      categoria: category,
      valor: sanitizedValue,
      funcionario: employee,
      observacoes: observations,
      formaPagamento: paymentMethod,
    };

    try {
      showLoader();
      const created = await authenticatedJsonFetch(`${BASE_URL}/api/cashier/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const normalized = normalizeCashierMovement(created);
      if (normalized) {
        cashierMovementsData = sortCashierMovements([normalized, ...cashierMovementsData]);
      }
      setActiveCashierMovementFilterButton(cashierActiveMovementFilter);
      renderCashierMovementsTable();
      recalculateCashierDashboardFromMovements();
      renderCashierReports(cashierMovementsData);
      cashierMovementForm.reset();
      closeCashierMovementModal();
    } catch (error) {
      console.error('Erro ao registrar movimentação do caixa:', error);
      alert('Erro ao registrar movimentação: ' + error.message);
    } finally {
      hideLoader();
    }
  };

  const initializeCashierMovementsModule = () => {
    if (!cashierMovementsTableBody && !cashierMovementForm && !cashierFilterButtons) return;

    cashierMovementsData = [];
    populateCashierMovementFormOptions();

    setActiveCashierMovementFilterButton(cashierActiveMovementFilter);
    renderCashierMovementsTable();
    recalculateCashierDashboardFromMovements();
    renderCashierReports(cashierMovementsData);

    if (movementTypeSelect) {
      movementTypeSelect.addEventListener('change', () => {
        populateCashierCategoryOptions(movementTypeSelect.value);
      });
    }

    if (movementCategorySelect) {
      movementCategorySelect.addEventListener('change', () => {
        const shouldShowCustom = movementCategorySelect.value === '__custom__';
        toggleCustomCategoryInputVisibility(shouldShowCustom);
      });
    }

    if (cashierFilterButtons) {
      cashierFilterButtons.addEventListener('click', event => {
        const button = event.target.closest('button[data-filter]');
        if (!button) return;
        cashierActiveMovementFilter = button.dataset.filter || 'all';
        setActiveCashierMovementFilterButton(cashierActiveMovementFilter);
        renderCashierMovementsTable();
      });
    }

    if (cashierRegisterMovementBtn) {
      cashierRegisterMovementBtn.addEventListener('click', () => {
        cashierMovementForm?.reset();
        populateCashierMovementFormOptions();
        openCashierMovementModal();
      });
    }

    if (cashierCancelMovementBtn) {
      cashierCancelMovementBtn.addEventListener('click', () => {
        cashierMovementForm?.reset();
        populateCashierMovementFormOptions();
        closeCashierMovementModal();
      });
    }

    if (cashierMovementModal) {
      cashierMovementModal.addEventListener('click', event => {
        if (event.target === cashierMovementModal) {
          closeCashierMovementModal();
        }
      });
    }

    if (cashierMovementForm) {
      cashierMovementForm.addEventListener('submit', handleCashierMovementSubmit);
    }
  };

  const computeCashierReportsFromMovements = (movements = []) => {
    if (!Array.isArray(movements) || !movements.length) return null;
    const paymentTotals = new Map();
    const expensesTotals = new Map();
    const reinforcementTotals = new Map();
    const categoriesTotals = new Map();
    const dailyBuckets = {};
    const weeklyBuckets = {};
    const monthlyBuckets = {};

    movements.forEach(movement => {
      const amount = parseMovementAmount(movement);
      if (!(amount > 0)) return;

      const rawType = normalizeText(movement?.tipoOperacao ?? movement?.tipoMovimentacao ?? movement?.tipo);
      let isEntry = CASHIER_ENTRY_TYPES.has(rawType);
      let isExpense = CASHIER_EXPENSE_TYPES.has(rawType);
      let isReinforcement = CASHIER_REINFORCEMENT_TYPES.has(rawType);

      if (!isEntry && !isExpense) {
        if (rawType.includes('entrada')) {
          isEntry = true;
        } else if (rawType.includes('saida')) {
          isExpense = true;
        }
      }

      if (!isEntry && !isExpense && typeof movement?.quantidadeAnterior === 'number' && typeof movement?.quantidadeAtual === 'number') {
        const diff = Number(movement.quantidadeAtual) - Number(movement.quantidadeAnterior);
        if (diff > 0) isEntry = true;
        if (diff < 0) isExpense = true;
      }

      const paymentMethod = (() => {
        const candidates = [movement?.formaPagamento, movement?.metodoPagamento, movement?.paymentMethod, movement?.metodo, movement?.pagamento];
        const found = candidates.find(value => typeof value === 'string' && value.trim().length > 0);
        if (found) {
          const text = found.toString().trim();
          return text.charAt(0).toUpperCase() + text.slice(1);
        }
        return isExpense ? 'Despesas' : 'Dinheiro';
      })();

      const category = (() => {
        const candidates = [movement?.categoria, movement?.category, movement?.motivo, movement?.descricao, movement?.tipoDespesa];
        const found = candidates.find(value => typeof value === 'string' && value.trim().length > 0);
        if (found) return found.trim();
        if (isExpense) return 'Operacionais';
        if (isEntry) return 'Vendas';
        return 'Outros';
      })();

      const reinforcementCategory = (() => {
        const candidates = [movement?.origem, movement?.fonte, movement?.categoriaReforco, movement?.origemRecurso];
        const found = candidates.find(value => typeof value === 'string' && value.trim().length > 0);
        if (found) return found.trim();
        return category;
      })();

      if (!isReinforcement && includesReinforcementKeyword(rawType)) {
        isReinforcement = true;
      }

      if (!isReinforcement) {
        const reinforcementFlags = [movement?.isReforco, movement?.reforco, movement?.isReinforcement, movement?.reinforcement];
        if (reinforcementFlags.some(isTruthyReinforcementFlag)) {
          isReinforcement = true;
        }
      }

      if (!isReinforcement) {
        const reinforcementSpecificCandidates = [
          movement?.categoriaReforco,
          movement?.origemReforco,
          movement?.origem,
          movement?.fonte,
          movement?.origemRecurso,
        ];
        const hasSpecificReinforcementLabel = reinforcementSpecificCandidates.some(candidate =>
          startsWithReinforcementWord(candidate) || includesReinforcementKeyword(candidate)
        );
        if (hasSpecificReinforcementLabel) {
          isReinforcement = true;
        }
      }

      if (!isReinforcement) {
        const reinforcementLabelCandidates = [
          movement?.categoria,
          movement?.category,
          movement?.tipo,
          category,
          reinforcementCategory,
        ];
        if (reinforcementLabelCandidates.some(startsWithReinforcementWord)) {
          isReinforcement = true;
        }
      }

      if (isReinforcement) {
        isEntry = true;
      }

      const date = parseMovementDate(movement);

      if (isEntry) {
        paymentTotals.set(paymentMethod, (paymentTotals.get(paymentMethod) || 0) + amount);
        categoriesTotals.set(category, (categoriesTotals.get(category) || 0) + amount);
      }

      if (isExpense) {
        expensesTotals.set(category, (expensesTotals.get(category) || 0) + amount);
      }

      if (isReinforcement) {
        reinforcementTotals.set(reinforcementCategory, (reinforcementTotals.get(reinforcementCategory) || 0) + amount);
      }

      if (date) {
        const dayKey = date.toISOString().slice(0, 10);
        const dayLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const dayBucket = ensureCashFlowBucket(dailyBuckets, dayKey, dayLabel);
        if (isEntry) dayBucket.entries += amount;
        if (isExpense) dayBucket.expenses += amount;

        const weekInfo = getWeekInfo(date);
        const weekBucket = ensureCashFlowBucket(weeklyBuckets, weekInfo.key, weekInfo.label);
        if (isEntry) weekBucket.entries += amount;
        if (isExpense) weekBucket.expenses += amount;
        if (weekInfo.rangeLabel) weekBucket.rangeLabel = weekInfo.rangeLabel;

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const monthBucket = ensureCashFlowBucket(monthlyBuckets, monthKey, monthLabel);
        if (isEntry) monthBucket.entries += amount;
        if (isExpense) monthBucket.expenses += amount;
      }
    });

    if (!paymentTotals.size && !expensesTotals.size && !categoriesTotals.size && !reinforcementTotals.size) {
      return null;
    }

    const normalizeMap = map => Array.from(map.entries()).map(([label, value]) => ({ label, value: Number(value) || 0 }));

    return {
      paymentMethods: normalizeMap(paymentTotals),
      cashFlow: {
        daily: buildSortedFlow(dailyBuckets, { limit: 7 }),
        weekly: buildSortedFlow(weeklyBuckets, { limit: 8 }),
        monthly: buildSortedFlow(monthlyBuckets, { limit: 6 }),
      },
      comparative: {
        expenses: normalizeMap(expensesTotals),
        reinforcements: normalizeMap(reinforcementTotals),
        categories: normalizeMap(categoriesTotals),
      },
    };
  };

  const renderCashierPaymentMethodsList = items => {
    if (!cashierPaymentMethodsList) return;
    cashierPaymentMethodsList.innerHTML = '';
    const values = Array.isArray(items) ? items : [];
    const total = values.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    if (!values.length || total <= 0) {
      cashierPaymentMethodsList.innerHTML = '<li class="text-sm text-subtle-light dark:text-subtle-dark">Nenhum dado disponível.</li>';
      return;
    }

    values.forEach((item, index) => {
      const amount = Number(item.value) || 0;
      const percentage = Math.round((amount / total) * 100);
      const lighten = Math.max(25, 80 - index * 15);
      const indicator = index === 0
        ? '<span class="size-2.5 rounded-full bg-primary"></span>'
        : `<span class="size-2.5 rounded-full" style="background-color: color-mix(in srgb, var(--color-primary) ${lighten}%, white)"></span>`;
      cashierPaymentMethodsList.insertAdjacentHTML('beforeend', `
        <li class="flex items-center justify-between gap-4">
          <span class="flex items-center gap-2">
            ${indicator}
            <span class="flex flex-col leading-tight">
              <span class="font-medium">${item.label}</span>
              <span class="text-xs text-subtle-light dark:text-subtle-dark">${formatCurrencyBRL(amount)}</span>
            </span>
          </span>
          <span class="font-semibold">${percentage}%</span>
        </li>
      `);
    });
  };

  const updateCashierAnalysisView = (view = cashierSelectedAnalysis) => {
    if (!cashierAnalysisList) return;
    cashierSelectedAnalysis = view;
    cashierAnalysisList.innerHTML = '';
    if (!cachedCashierReportsData) {
      cashierAnalysisList.innerHTML = '<p class="text-sm text-subtle-light dark:text-subtle-dark">Nenhum dado disponível.</p>';
      return;
    }
    const dataset = cachedCashierReportsData.comparative?.[view] || [];
    if (!dataset.length) {
      cashierAnalysisList.innerHTML = '<p class="text-sm text-subtle-light dark:text-subtle-dark">Nenhum dado disponível.</p>';
      return;
    }
    const sorted = [...dataset].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const maxValue = Math.max(...sorted.map(item => Number(item.value) || 0), 0);
    if (maxValue <= 0) {
      cashierAnalysisList.innerHTML = '<p class="text-sm text-subtle-light dark:text-subtle-dark">Nenhum dado disponível.</p>';
      return;
    }
    cashierAnalysisList.innerHTML = sorted.map(item => {
      const value = Number(item.value) || 0;
      const percent = Math.max(4, Math.round((value / maxValue) * 100));
      return `
        <div class="grid grid-cols-[minmax(0,180px)_1fr] items-center gap-4">
          <div class="flex flex-col">
            <span class="text-sm font-medium text-subtle-light dark:text-subtle-dark">${item.label}</span>
            <span class="text-xs text-subtle-light/80 dark:text-subtle-dark/80">${formatCurrencyBRL(value)}</span>
          </div>
          <div class="h-3 w-full rounded bg-primary/10 dark:bg-primary/25">
            <div class="h-full rounded bg-primary" style="width: ${percent}%"></div>
          </div>
        </div>
      `;
    }).join('');
  };

  const updateCashierReportsCharts = async (dataset, period = cashierSelectedCashFlowPeriod) => {
    if (!cashierPaymentMethodsCanvas || !cashierCashFlowCanvas) return;

    try {
      const chartReady = await waitForChartLibrary();
      if (!chartReady || typeof window === 'undefined' || typeof window.Chart !== 'function') {
        console.warn('Biblioteca de gráficos indisponível para atualizar os relatórios do caixa.');
        return;
      }

      const ChartConstructor = window.Chart;
      const resolvedPeriod = period || 'monthly';
      const rootStyles = getComputedStyle(document.documentElement);
      const primaryColor = rootStyles.getPropertyValue('--color-primary')?.trim() || FALLBACK_PRIMARY_COLOR;
      const textColor = document.documentElement.classList.contains('dark') ? '#ffffff' : '#111821';
      const subtleColor = document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.6)' : 'rgba(17, 24, 33, 0.6)';
      const gridColor = document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(17, 24, 33, 0.08)';
      const borderColor = document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.15)' : 'rgba(17, 24, 33, 0.12)';
      const primaryRgb = parseColorToRgb(primaryColor);

      const paymentData = Array.isArray(dataset?.paymentMethods) ? dataset.paymentMethods : [];
      const paymentLabels = paymentData.map(item => item.label);
      const paymentValues = paymentData.map(item => Number(item.value) || 0);
      const paymentColors = getAccessibleChartPalette(Math.max(paymentLabels.length, 1));

      if (cashierPaymentMethodsChart) {
        cashierPaymentMethodsChart.destroy();
      }
      cashierPaymentMethodsChart = new ChartConstructor(cashierPaymentMethodsCanvas, {
        type: 'doughnut',
        data: {
          labels: paymentLabels,
          datasets: [{
            data: paymentValues,
            backgroundColor: paymentColors,
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: context => {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  return `${label}: ${formatCurrencyBRL(value)}`;
                },
              },
            },
          },
        },
      });

      const cashFlowData = dataset?.cashFlow?.[resolvedPeriod] || dataset?.cashFlow?.monthly || { labels: [], values: [] };
      const flowLabels = Array.isArray(cashFlowData.labels) ? cashFlowData.labels : [];
      const flowValues = Array.isArray(cashFlowData.values)
        ? cashFlowData.values.map(value => Number(value) || 0)
        : [];
      const context = cashierCashFlowCanvas.getContext('2d');
      if (!context) {
        console.warn('Não foi possível obter o contexto 2D para renderizar o gráfico de fluxo de caixa.');
        return;
      }
      const gradient = context.createLinearGradient(0, 0, 0, cashierCashFlowCanvas.height || 300);
      gradient.addColorStop(0, rgbaFromRgb(primaryRgb, 0.55));
      gradient.addColorStop(1, rgbaFromRgb(primaryRgb, 0));

      const hasSinglePoint = flowValues.length === 1;
      const hasMultiplePoints = flowValues.length > 1;
      const datasetBackground = hasMultiplePoints ? gradient : rgbaFromRgb(primaryRgb, 0.35);
      const datasetBorderWidth = hasMultiplePoints ? 3 : 0;
      const datasetFill = hasMultiplePoints;
      const pointRadius = hasSinglePoint ? 6 : 0;
      const pointHoverRadius = hasSinglePoint ? 8 : 4;
      const pointBorderWidth = hasSinglePoint ? 2 : 0;
      const pointBorderColor = hasSinglePoint ? '#ffffff' : 'transparent';

      if (cashierCashFlowChart) {
        cashierCashFlowChart.destroy();
      }

      cashierCashFlowChart = new ChartConstructor(cashierCashFlowCanvas, {
        type: 'line',
        data: {
          labels: flowLabels,
          datasets: [{
            label: 'Fluxo de Caixa',
            data: flowValues,
            borderColor: mixColorWithWhite(primaryRgb, 1),
            backgroundColor: datasetBackground,
            borderWidth: datasetBorderWidth,
            fill: datasetFill,
            showLine: hasMultiplePoints,
            tension: 0.4,
            pointRadius,
            pointHoverRadius,
            pointBackgroundColor: mixColorWithWhite(primaryRgb, 1),
            pointBorderWidth,
            pointBorderColor,
            hitRadius: 12,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: context => formatCurrencyBRL(context.parsed.y),
              },
            },
          },
          scales: {
            x: {
              ticks: { color: subtleColor },
              grid: { display: false },
              border: { color: borderColor },
            },
            y: {
              ticks: {
                color: subtleColor,
                callback: value => formatCurrencyBRL(value),
              },
              grid: { color: gridColor },
              border: { color: borderColor },
            },
          },
        },
      });
    } catch (error) {
      console.error('Não foi possível atualizar os gráficos do caixa:', error);
    }
  };

  const refreshCashierReportsCharts = () => {
    if (!cachedCashierReportsData) return;
    updateCashierReportsCharts(cachedCashierReportsData, cashierSelectedCashFlowPeriod);
  };

  const renderCashierReports = (movements = cashierMovementsData) => {
    const computed = computeCashierReportsFromMovements(movements);
    const dataset = mergeDatasetWithDefault(computed, DEFAULT_CASHIER_REPORTS_DATA);
    dataset.paymentMethods = [...(dataset.paymentMethods || [])].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    dataset.comparative.expenses = [...(dataset.comparative.expenses || [])].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    dataset.comparative.reinforcements = [...(dataset.comparative.reinforcements || [])].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    dataset.comparative.categories = [...(dataset.comparative.categories || [])].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

    cachedCashierReportsData = dataset;

    const activeCashFlowRadio = Array.from(cashierCashFlowRadios).find(radio => radio.checked);
    if (activeCashFlowRadio) {
      cashierSelectedCashFlowPeriod = activeCashFlowRadio.value;
    }
    const activeAnalysisRadio = Array.from(cashierAnalysisRadios).find(radio => radio.checked);
    if (activeAnalysisRadio) {
      cashierSelectedAnalysis = activeAnalysisRadio.value;
    }

    renderCashierPaymentMethodsList(dataset.paymentMethods);
    updateCashierReportsCharts(dataset, cashierSelectedCashFlowPeriod);
    updateCashierAnalysisView(cashierSelectedAnalysis);

    if (!cashierReportsInitialized) {
      cashierReportsInitialized = true;
      cashierCashFlowRadios.forEach(radio => {
        radio.addEventListener('change', event => {
          if (!event.target.checked) return;
          cashierSelectedCashFlowPeriod = event.target.value;
          refreshCashierReportsCharts();
        });
      });
      cashierAnalysisRadios.forEach(radio => {
        radio.addEventListener('change', event => {
          if (!event.target.checked) return;
          cashierSelectedAnalysis = event.target.value;
          updateCashierAnalysisView(cashierSelectedAnalysis);
        });
      });
    }
  };

  // Configurações do Caixa ------------------------------------------------------
  const DEFAULT_CASHIER_SETTINGS = Object.freeze({
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTFeOaW0WW5vagcJW_zcy81BcChyOYwE3Twq5ThnJNoIqH82WF0bMzrvEhi0V9dWdG16xG9Fi9ns1lm3KVqONo-f98aG3k8IyZMKHVEZSMBif3fJDbvDAjhWhCCi9jo74-0mopopZTFqwdyiLKyogWYUevuHfIQT5y43nKqM4g5sLL-UE-bmgk6yVxEmLAhAHqT7yf_uCn7OJt7HNqfIG-Wzyx1ug39W0rU8R6Z9j8z6Lh9lsnOPiMEX_XIYLvzBXW7hauQ0Gn8lw',
    cashLimit: '',
    categories: [
      { id: 'category-1', name: 'Vendas', type: 'Receita', status: 'Ativo' },
      { id: 'category-2', name: 'Despesas Operacionais', type: 'Despesa', status: 'Ativo' },
      { id: 'category-3', name: 'Reforços', type: 'Receita', status: 'Ativo' },
    ],
    paymentMethods: [
      { id: 'payment-1', name: 'Dinheiro', status: 'Ativo' },
      { id: 'payment-2', name: 'Cartão de Crédito', status: 'Ativo' },
      { id: 'payment-3', name: 'Pagamento Móvel', status: 'Inativo' },
    ],
  });

  const cloneDefaultCashierSettings = () => ({
    logo: DEFAULT_CASHIER_SETTINGS.logo,
    cashLimit: DEFAULT_CASHIER_SETTINGS.cashLimit,
    categories: DEFAULT_CASHIER_SETTINGS.categories.map(category => ({ ...category })),
    paymentMethods: DEFAULT_CASHIER_SETTINGS.paymentMethods.map(method => ({ ...method })),
  });

  const resolveCashierCategoryTypeFromMovement = movementTypeValue => {
    const normalized = normalizeText(movementTypeValue);
    return normalized === 'saida' ? 'Despesa' : 'Receita';
  };

  const getActiveCashierCategories = movementTypeValue => {
    const state = ensureCashierSettingsState();
    const expectedType = resolveCashierCategoryTypeFromMovement(movementTypeValue);
    return Array.isArray(state?.categories)
      ? state.categories.filter(category => (
        category
        && category.status !== 'Inativo'
        && category.type === expectedType
        && typeof category.name === 'string'
      ))
      : [];
  };

  const getActiveCashierPaymentMethods = () => {
    const state = ensureCashierSettingsState();
    return Array.isArray(state?.paymentMethods)
      ? state.paymentMethods.filter(method => (
        method
        && method.status !== 'Inativo'
        && typeof method.name === 'string'
      ))
      : [];
  };

  const isCashPaymentMethodName = methodName => {
    const normalized = normalizeText(methodName);
    if (!normalized) return false;
    return normalized.includes('dinheir') || normalized.includes('cash') || normalized.includes('espécie') || normalized.includes('especie');
  };

  const getCashPaymentMethodNames = () => {
    const activeMethods = getActiveCashierPaymentMethods();
    const names = activeMethods.map(method => method.name);
    if (!names.some(name => isCashPaymentMethodName(name))) {
      names.push('Dinheiro');
    }
    return names;
  };

  const parseCashierCashLimitValue = () => {
    const state = ensureCashierSettingsState();
    const raw = state?.cashLimit;
    const numeric = parseLocaleNumber(raw);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : Number.NaN;
  };

  const toggleCustomCategoryInputVisibility = shouldShow => {
    if (!movementCategoryCustomInput) return;
    movementCategoryCustomInput.classList.toggle('hidden', !shouldShow);
    movementCategoryCustomInput.required = shouldShow;
    if (!shouldShow) {
      movementCategoryCustomInput.value = '';
    } else {
      movementCategoryCustomInput.focus();
    }
  };

  const populateCashierCategoryOptions = movementTypeValue => {
    if (!movementCategorySelect) return;
    const categories = getActiveCashierCategories(movementTypeValue);
    movementCategorySelect.innerHTML = '';

    if (categories.length) {
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        movementCategorySelect.appendChild(option);
      });
      const customOption = document.createElement('option');
      customOption.value = '__custom__';
      customOption.textContent = 'Outra (digitar manualmente)';
      movementCategorySelect.appendChild(customOption);
      movementCategorySelect.disabled = false;
      movementCategorySelect.value = categories[0].name;
      toggleCustomCategoryInputVisibility(false);
      return;
    }

    const fallbackOption = document.createElement('option');
    fallbackOption.value = '__custom__';
    fallbackOption.textContent = 'Nenhuma categoria configurada';
    movementCategorySelect.appendChild(fallbackOption);
    movementCategorySelect.value = '__custom__';
    movementCategorySelect.disabled = true;
    toggleCustomCategoryInputVisibility(true);
  };

  const populateCashierPaymentMethodOptions = () => {
    if (!movementPaymentMethodSelect) return;
    const methods = getActiveCashierPaymentMethods();
    movementPaymentMethodSelect.innerHTML = '';

    if (methods.length) {
      methods.forEach(method => {
        const option = document.createElement('option');
        option.value = method.name;
        option.textContent = method.name;
        movementPaymentMethodSelect.appendChild(option);
      });
      movementPaymentMethodSelect.disabled = false;
      movementPaymentMethodSelect.value = methods[0].name;
      return;
    }

    const fallbackOption = document.createElement('option');
    fallbackOption.value = 'Dinheiro';
    fallbackOption.textContent = 'Dinheiro';
    movementPaymentMethodSelect.appendChild(fallbackOption);
    movementPaymentMethodSelect.disabled = true;
    movementPaymentMethodSelect.value = 'Dinheiro';
  };

  const populateCashierMovementFormOptions = () => {
    if (!cashierMovementForm) return;
    const currentType = movementTypeSelect?.value || 'Entrada';
    populateCashierCategoryOptions(currentType);
    populateCashierPaymentMethodOptions();
  };

  const calculateCashOnHand = () => {
    if (!Array.isArray(cashierMovementsData) || !cashierMovementsData.length) return 0;
    const cashNames = getCashPaymentMethodNames()
      .map(name => normalizeText(name))
      .filter(Boolean);
    const cashNamesSet = new Set(cashNames);
    return cashierMovementsData.reduce((total, movement) => {
      const method = normalizeText(movement?.formaPagamento);
      if (!method) return total;
      const isCashMovement = cashNamesSet.has(method) || isCashPaymentMethodName(method);
      if (!isCashMovement) return total;
      const amount = parseMovementAmount(movement);
      if (!(amount > 0)) return total;
      const type = normalizeText(movement?.tipo);
      const sign = type === 'saida' ? -1 : 1;
      return total + amount * sign;
    }, 0);
  };

  const normalizeCashierCategory = category => {
    if (!category || typeof category !== 'object') return null;
    const name = typeof category.name === 'string' ? category.name.trim() : '';
    if (!name) return null;
    const type = category.type === 'Despesa' ? 'Despesa' : 'Receita';
    const status = category.status === 'Inativo' ? 'Inativo' : 'Ativo';
    const id = typeof category.id === 'string' && category.id.trim()
      ? category.id
      : `category-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    return { id, name, type, status };
  };

  const normalizeCashierPaymentMethod = method => {
    if (!method || typeof method !== 'object') return null;
    const name = typeof method.name === 'string' ? method.name.trim() : '';
    if (!name) return null;
    const status = method.status === 'Inativo' ? 'Inativo' : 'Ativo';
    const id = typeof method.id === 'string' && method.id.trim()
      ? method.id
      : `payment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    return { id, name, status };
  };

  const normalizeCashierSettings = raw => {
    const next = cloneDefaultCashierSettings();
    if (!raw || typeof raw !== 'object') {
      return next;
    }
    if (typeof raw.logo === 'string' && raw.logo.trim()) {
      next.logo = raw.logo;
    }
    if (typeof raw.cashLimit === 'string') {
      next.cashLimit = raw.cashLimit;
    }
    if (Array.isArray(raw.categories)) {
      const normalizedCategories = raw.categories.map(normalizeCashierCategory).filter(Boolean);
      if (normalizedCategories.length) {
        next.categories = normalizedCategories;
      }
    }
    if (Array.isArray(raw.paymentMethods)) {
      const normalizedMethods = raw.paymentMethods.map(normalizeCashierPaymentMethod).filter(Boolean);
      if (normalizedMethods.length) {
        next.paymentMethods = normalizedMethods;
      }
    }
    return next;
  };

  const ensureCashierSettingsState = () => {
    if (!cashierSettingsState) {
      cashierSettingsState = cloneDefaultCashierSettings();
    }
    return cashierSettingsState;
  };

  const setCashierSettingsState = nextState => {
    cashierSettingsState = normalizeCashierSettings(nextState);
    return cashierSettingsState;
  };

  const saveCashierSettingsToServer = async settings => {
    const normalized = normalizeCashierSettings(settings);
    const response = await authenticatedJsonFetch(`${BASE_URL}/api/cashier/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });
    return setCashierSettingsState(response);
  };

  const fetchCashierSettingsFromServer = async () => {
    const data = await authenticatedJsonFetch(`${BASE_URL}/api/cashier/settings`);
    return normalizeCashierSettings(data);
  };

  const loadCashierSettings = async ({ silent = false } = {}) => {
    try {
      if (!silent) showLoader();
      const data = await fetchCashierSettingsFromServer();
      setCashierSettingsState(data);
      updateCashierSettingsUI();
    } catch (error) {
      console.error('Erro ao carregar configurações do caixa:', error);
      if (!silent) alert('Erro ao carregar configurações do caixa: ' + error.message);
    } finally {
      if (!silent) hideLoader();
    }
  };

  const showCashierSettingsToast = message => {
    if (!cashierSettingsToast) return;
    cashierSettingsToast.textContent = message;
    cashierSettingsToast.style.transform = 'translateX(0)';
    cashierSettingsToast.style.opacity = '1';
    if (typeof window !== 'undefined') {
      if (cashierSettingsToastTimeoutId) {
        window.clearTimeout(cashierSettingsToastTimeoutId);
      }
      cashierSettingsToastTimeoutId = window.setTimeout(() => {
        cashierSettingsToast.style.transform = '';
        cashierSettingsToast.style.opacity = '';
      }, 3000);
    }
  };

  const setCashierSettingsLogo = logo => {
    if (!cashierSettingsLogoPreview) return;
    if (logo) {
      cashierSettingsLogoPreview.style.backgroundImage = `url('${logo}')`;
    } else {
      cashierSettingsLogoPreview.style.backgroundImage = '';
    }
  };

  const renderCashierSettingsCategories = () => {
    if (!cashierSettingsCategoriesBody) return;
    cashierSettingsCategoriesBody.innerHTML = '';
    const categories = Array.isArray(cashierSettingsState?.categories) ? cashierSettingsState.categories : [];
    if (!categories.length) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 4;
      emptyCell.className = 'text-sm text-subtle-light dark:text-subtle-dark text-center';
      emptyCell.textContent = 'Nenhuma categoria cadastrada.';
      emptyRow.appendChild(emptyCell);
      cashierSettingsCategoriesBody.appendChild(emptyRow);
      return;
    }
    categories.forEach(category => {
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.className = 'whitespace-nowrap font-medium text-text-light dark:text-text-dark';
      nameCell.textContent = category.name;
      const typeCell = document.createElement('td');
      typeCell.className = 'whitespace-nowrap text-subtle-light dark:text-subtle-dark';
      typeCell.textContent = category.type;
      const statusCell = document.createElement('td');
      statusCell.className = 'whitespace-nowrap';
      const statusBadge = document.createElement('span');
      statusBadge.className = `status-pill ${category.status === 'Ativo'
        ? 'status-pill--active'
        : 'status-pill--inactive'}`;
      statusBadge.textContent = category.status;
      statusCell.appendChild(statusBadge);
      const actionsCell = document.createElement('td');
      actionsCell.className = 'whitespace-nowrap text-right text-sm font-medium';
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'text-primary hover:text-primary/80';
      editButton.textContent = 'Editar';
      editButton.addEventListener('click', () => openCashierCategoryModal(category));
      actionsCell.appendChild(editButton);
      row.append(nameCell, typeCell, statusCell, actionsCell);
      cashierSettingsCategoriesBody.appendChild(row);
    });

    populateCashierMovementFormOptions();
  };

  const renderCashierSettingsPaymentMethods = () => {
    if (!cashierSettingsPaymentMethodsBody) return;
    cashierSettingsPaymentMethodsBody.innerHTML = '';
    const methods = Array.isArray(cashierSettingsState?.paymentMethods) ? cashierSettingsState.paymentMethods : [];
    if (!methods.length) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 3;
      emptyCell.className = 'text-sm text-subtle-light dark:text-subtle-dark text-center';
      emptyCell.textContent = 'Nenhum método de pagamento cadastrado.';
      emptyRow.appendChild(emptyCell);
      cashierSettingsPaymentMethodsBody.appendChild(emptyRow);
      return;
    }
    methods.forEach(method => {
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.className = 'whitespace-nowrap font-medium text-text-light dark:text-text-dark';
      nameCell.textContent = method.name;
      const statusCell = document.createElement('td');
      statusCell.className = 'whitespace-nowrap';
      const badge = document.createElement('span');
      badge.className = `status-pill ${method.status === 'Ativo'
        ? 'status-pill--active'
        : 'status-pill--inactive'}`;
      badge.textContent = method.status;
      statusCell.appendChild(badge);
      const actionsCell = document.createElement('td');
      actionsCell.className = 'whitespace-nowrap text-right text-sm font-medium';
      const toggleButton = document.createElement('button');
      toggleButton.type = 'button';
      const isActive = method.status === 'Ativo';
      toggleButton.className = isActive ? 'text-danger hover:text-danger/80' : 'text-success hover:text-success/80';
      toggleButton.textContent = isActive ? 'Desativar' : 'Ativar';
      toggleButton.addEventListener('click', async () => {
        const state = ensureCashierSettingsState();
        const nextMethods = state.paymentMethods.map(item => (
          item.id === method.id
            ? { ...item, status: item.status === 'Ativo' ? 'Inativo' : 'Ativo' }
            : item
        ));
        cashierSettingsState = { ...state, paymentMethods: nextMethods };
        try {
          cashierSettingsState = await saveCashierSettingsToServer(cashierSettingsState);
          updateCashierSettingsUI();
          showCashierSettingsToast('Status do método atualizado.');
        } catch (error) {
          console.error('Erro ao atualizar método de pagamento:', error);
          showCashierSettingsToast('Não foi possível atualizar o método agora.');
        }
      });
      actionsCell.appendChild(toggleButton);
      row.append(nameCell, statusCell, actionsCell);
      cashierSettingsPaymentMethodsBody.appendChild(row);
    });

    populateCashierMovementFormOptions();
  };

  const updateCashierSettingsCashLimitInput = () => {
    if (!cashierSettingsCashLimitInput) return;
    cashierSettingsCashLimitInput.value = cashierSettingsState?.cashLimit || '';
  };

  const updateCashierSettingsUI = () => {
    if (!cashierSettingsState) return;
    setCashierSettingsLogo(cashierSettingsState.logo);
    updateCashierSettingsCashLimitInput();
    renderCashierSettingsCategories();
    renderCashierSettingsPaymentMethods();
    populateCashierMovementFormOptions();
  };

  const openCashierCategoryModal = (category = null) => {
    if (!cashierCategoryForm) return;
    cashierCategoryForm.reset();
    if (cashierCategoryIdInput) cashierCategoryIdInput.value = category?.id || '';
    if (cashierCategoryNameInput) cashierCategoryNameInput.value = category?.name || '';
    if (cashierCategoryTypeInput) cashierCategoryTypeInput.value = category?.type || 'Receita';
    if (cashierCategoryTitle) {
      cashierCategoryTitle.textContent = category ? 'Editar Categoria' : 'Adicionar Categoria';
    }
    openModal('cashier-category-modal');
  };

  const closeCashierCategoryModal = () => closeModal('cashier-category-modal');

  const handleCashierCategorySubmit = async event => {
    event.preventDefault();
    if (!cashierCategoryForm) return;
    const formData = new FormData(cashierCategoryForm);
    const id = (formData.get('id') || '').toString().trim();
    const name = (formData.get('name') || '').toString().trim();
    const type = formData.get('type') === 'Despesa' ? 'Despesa' : 'Receita';
    if (!name) {
      showCashierSettingsToast('Informe um nome válido para a categoria.');
      return;
    }
    const state = ensureCashierSettingsState();
    const categories = Array.isArray(state.categories)
      ? [...state.categories]
      : [];
    if (id) {
      const index = categories.findIndex(category => category.id === id);
      if (index !== -1) {
        categories[index] = { ...categories[index], name, type };
      } else {
        categories.push({ id, name, type, status: 'Ativo' });
      }
    } else {
      categories.push({
        id: `category-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name,
        type,
        status: 'Ativo',
      });
    }
    cashierSettingsState = { ...state, categories };
    try {
      cashierSettingsState = await saveCashierSettingsToServer(cashierSettingsState);
      updateCashierSettingsUI();
      closeCashierCategoryModal();
      showCashierSettingsToast(id ? 'Categoria atualizada com sucesso!' : 'Categoria adicionada com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      showCashierSettingsToast('Não foi possível salvar a categoria.');
    }
  };

  const handleCashierSettingsCashLimitSave = async () => {
    if (!cashierSettingsCashLimitInput) return;
    const state = ensureCashierSettingsState();
    cashierSettingsState = {
      ...state,
      cashLimit: cashierSettingsCashLimitInput.value.trim(),
    };
    try {
      cashierSettingsState = await saveCashierSettingsToServer(cashierSettingsState);
      updateCashierSettingsUI();
      showCashierSettingsToast('Limite de caixa salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar limite de caixa:', error);
      showCashierSettingsToast('Não foi possível salvar o limite agora.');
    }
  };

  const handleCashierSettingsBackup = () => {
    const state = ensureCashierSettingsState();
    try {
      const data = JSON.stringify(state, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'backup_configuracoes.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showCashierSettingsToast('Backup dos dados iniciado.');
    } catch (error) {
      console.warn('Não foi possível gerar o backup das configurações:', error);
      showCashierSettingsToast('Não foi possível gerar o backup agora.');
    }
  };

  const handleCashierSettingsLogoChange = event => {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showCashierSettingsToast('Selecione um arquivo de imagem válido.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async e => {
      const result = typeof e.target?.result === 'string' ? e.target.result : null;
      if (!result) return;
      const state = ensureCashierSettingsState();
      cashierSettingsState = { ...state, logo: result };
      setCashierSettingsLogo(result);
      try {
        cashierSettingsState = await saveCashierSettingsToServer(cashierSettingsState);
        updateCashierSettingsUI();
        showCashierSettingsToast('Logotipo alterado com sucesso!');
      } catch (error) {
        console.error('Erro ao salvar logotipo do caixa:', error);
        showCashierSettingsToast('Não foi possível atualizar o logotipo.');
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const initializeCashierSettings = () => {
    if (
      !cashierSettingsLogoPreview
      && !cashierSettingsCategoriesBody
      && !cashierSettingsPaymentMethodsBody
      && !cashierSettingsCashLimitInput
    ) {
      return;
    }
    cashierSettingsState = ensureCashierSettingsState();
    updateCashierSettingsUI();
    if (cashierSettingsChangeLogoBtn && cashierSettingsLogoUpload) {
      cashierSettingsChangeLogoBtn.addEventListener('click', () => cashierSettingsLogoUpload.click());
      cashierSettingsLogoUpload.addEventListener('change', handleCashierSettingsLogoChange);
    }
    if (cashierSettingsAddCategoryBtn) {
      cashierSettingsAddCategoryBtn.addEventListener('click', () => openCashierCategoryModal());
    }
    if (cashierCategoryCancelBtn) {
      cashierCategoryCancelBtn.addEventListener('click', () => {
        closeCashierCategoryModal();
      });
    }
    if (cashierCategoryModal) {
      cashierCategoryModal.addEventListener('click', event => {
        if (event.target === cashierCategoryModal) {
          closeCashierCategoryModal();
        }
      });
    }
    if (cashierCategoryForm) {
      cashierCategoryForm.addEventListener('submit', handleCashierCategorySubmit);
    }
    if (cashierSettingsSaveCashLimitBtn) {
      cashierSettingsSaveCashLimitBtn.addEventListener('click', handleCashierSettingsCashLimitSave);
    }
    if (cashierSettingsBackupBtn) {
      cashierSettingsBackupBtn.addEventListener('click', handleCashierSettingsBackup);
    }
  };

  const updateDarkModeToggleState = isDark => {
    darkModeToggles.forEach(button => {
      button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      const icon = button.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    });
  };

  const applyDarkModePreference = isDark => {
    const shouldEnable = Boolean(isDark);
    document.documentElement.classList.toggle('dark', shouldEnable);
    updateDarkModeToggleState(shouldEnable);
  };

  const setupDarkMode = () => {
    const prefersDark = darkModeMediaQuery?.matches ?? false;
    applyDarkModePreference(prefersDark);
    refreshCashierReportsCharts();

    if (darkModeToggles.length) {
      darkModeToggles.forEach(button => {
        button.addEventListener('click', () => {
          const isDark = document.documentElement.classList.contains('dark');
          applyDarkModePreference(!isDark);
          refreshCashierReportsCharts();
        });
      });
    }

    if (darkModeMediaQuery) {
      darkModeMediaQuery.addEventListener('change', event => {
        applyDarkModePreference(event.matches);
        refreshCashierReportsCharts();
      });
    }
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
    profileImageFile = null;
    if (profileImageUpload) profileImageUpload.value = '';
  };

  const initProfilePhoto = async (initialPhoto = null) => {
    const defaultPic = getFullImageUrl(FALLBACK_AVATAR_IMAGE);
    if (!currentUserId) {
      updateAllAvatars(defaultPic);
      profileModalImage.src = defaultPic;
      registerImageFallbacks(profileModalImage);
      return;
    }
    if (initialPhoto) {
      const resolvedInitial = getFullImageUrl(initialPhoto);
      updateAllAvatars(resolvedInitial);
      profileModalImage.src = resolvedInitial;
      registerImageFallbacks(profileModalImage);
      return;
    }
    try {
      const data = await authenticatedJsonFetch(`${BASE_URL}/api/users/${currentUserId}/photo`);
      if (data.photo) {
        const resolved = getFullImageUrl(data.photo);
        updateAllAvatars(resolved);
        profileModalImage.src = resolved;
        registerImageFallbacks(profileModalImage);
        return;
      }
    } catch (err) {
      console.error('Erro ao buscar foto de perfil:', err);
    }
    updateAllAvatars(defaultPic);
    profileModalImage.src = defaultPic;
    registerImageFallbacks(profileModalImage);
  };

  const uploadProfilePhotoToServer = async file => {
    if (!currentUserId || !file) return null;
    const formData = new FormData();
    formData.append('photo', file);
    const data = await authenticatedJsonFetch(`${BASE_URL}/api/users/${currentUserId}/photo`, {
      method: 'PUT',
      body: formData
    });
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
          await initProfilePhoto(photo ?? null);
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
    usersDataDirty = true;
    homeGreeting.textContent = `Bem-vindo de volta, ${username}!`;
    updateAllUserNames(username);
    loginContainer.classList.add('hidden');
    loginContainer.style.display = 'none';
    appContainer.classList.remove('hidden');
    const restoredModule = restoreStoredModule();
    await initProfilePhoto(photo ?? null);
    toggleAdminFeatures(userRole === 'admin');
    if (restoredModule === 'stock') {
      restoreStoredPage();
    }
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
    switchToStockModule({ skipStore: true });
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
        username: data.username || username,
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

  const logout = async (options = {}) => {
    const { skipRequest = false } = options;
    if (isProcessingLogout) return;
    isProcessingLogout = true;
    try {
      if (!skipRequest) {
        try {
          await fetch(`${BASE_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include'
          });
        } catch (error) {
          console.error('Não foi possível encerrar a sessão no servidor:', error);
        }
      }
    } finally {
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
      hideLoader();
      showLoginScreen();
      inputUsuario.value = '';
      inputClave.value = '';
      profileModal.classList.add('hidden');
      resetProfilePhoto();
      toggleAdminFeatures(false);
      isSessionExpiryHandled = false;
      isProcessingLogout = false;
    }
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

  const handleSessionExpiry = async () => {
    if (isSessionExpiryHandled) return;
    isSessionExpiryHandled = true;
    alert('Sua sessão expirou. Faça login novamente.');
    await logout({ skipRequest: true });
  };

  const authenticatedFetch = async (input, init = {}) => {
    const options = {
      credentials: 'include',
      ...init,
    };
    const response = await fetch(input, options);
    if (response.status === 401) {
      await handleSessionExpiry();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    return response;
  };

  const authenticatedJsonFetch = async (input, init = {}) => {
    const response = await authenticatedFetch(input, init);
    const data = await response.json();
    if (!response.ok) {
      const message = (data && data.error) || 'Erro na requisição.';
      throw new Error(message);
    }
    return data;
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
        loadReports(filterStart, filterEnd, options),
        loadCashierMovements({ ...options, silent: true }),
        loadCashierSettings({ ...options, silent: true })
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
      const data = await authenticatedJsonFetch(`${BASE_URL}/api/estoque`);
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
      const data = await authenticatedJsonFetch(`${BASE_URL}/api/movimentacoes?${params.toString()}`);
      movementsData = Array.isArray(data) ? data : [];
      renderMovimentacoes();
      renderCashierReports(cashierMovementsData);
      recalculateCashierDashboardFromMovements();
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
      const [summaryData, stockData] = await Promise.all([
        authenticatedJsonFetch(`${BASE_URL}/api/report/summary?${params.toString()}`),
        authenticatedJsonFetch(`${BASE_URL}/api/report/estoque`)
      ]);
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

  const updateProductGridLayout = () => {
    if (!productGrid) return;
    productGrid.classList.remove(...GRID_VIEW_CLASSES, ...LIST_VIEW_CLASSES);
    productGrid.classList.add('flex-1');
    if (currentView === 'grid') {
      productGrid.classList.add(...GRID_VIEW_CLASSES);
    } else {
      productGrid.classList.add(...LIST_VIEW_CLASSES);
    }
  };

  const updateViewToggleState = () => {
    const isGridView = currentView === 'grid';
    if (gridViewBtn) {
      gridViewBtn.classList.toggle('bg-primary', isGridView);
      gridViewBtn.classList.toggle('text-white', isGridView);
      gridViewBtn.setAttribute('aria-pressed', isGridView ? 'true' : 'false');
    }
    if (listViewBtn) {
      listViewBtn.classList.toggle('bg-primary', !isGridView);
      listViewBtn.classList.toggle('text-white', !isGridView);
      listViewBtn.setAttribute('aria-pressed', !isGridView ? 'true' : 'false');
    }
  };

  const renderStock = () => {
    if (!productGrid) return;
    updateProductGridLayout();
    const totalPages = Math.max(Math.ceil(filteredProducts.length / itemsPerPage), 1);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    productGrid.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredProducts.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
      const emptyStateClasses = currentView === 'grid'
        ? 'col-span-full text-center text-subtle-light dark:text-subtle-dark'
        : 'w-full text-center text-subtle-light dark:text-subtle-dark';
      productGrid.innerHTML = `<p class="${emptyStateClasses}">Nenhum produto encontrado.</p>`;
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

      if (currentView === 'grid') {
        const card = document.createElement('div');
        card.className = 'group relative bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm overflow-hidden transition-transform duration-300 hover:-translate-y-1 flex flex-col';
        card.innerHTML = `
          <div class="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full z-10">${product.tipo || '-'}</div>
          ${expiryBadge}
          <img alt="${product.produto}" class="w-full h-40 object-cover" src="${imageSrc}" loading="lazy" decoding="async" data-fallback-src="${placeholder.fallback}" onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='true';this.src=this.dataset.fallbackSrc;}" />
          <div class="p-4 flex-grow flex flex-col">
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
          </div>
          <div class="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center space-x-2 card-actions p-2">
            <button class="edit-btn bg-blue-500 text-white p-2 rounded-lg flex-1" data-id="${product.id}"><span class="material-icons">edit</span></button>
            <button class="delete-btn bg-danger text-white p-2 rounded-lg flex-1" data-id="${product.id}" data-name="${product.produto}"><span class="material-icons">delete</span></button>
          </div>`;
        productGrid.appendChild(card);
        registerImageFallbacks(card);
      } else {
        const row = document.createElement('div');
        row.className = 'group relative bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm flex flex-col md:flex-row md:items-center p-4 gap-4 transition-shadow hover:shadow-md w-full';
        row.innerHTML = `
          <div class="relative w-full md:w-24 md:h-24 md:flex-shrink-0">
            <div class="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full z-10">${product.tipo || '-'}</div>
            ${expiryBadge}
            <img alt="${product.produto}" class="w-full h-48 md:h-24 object-cover rounded-lg" src="${imageSrc}" loading="lazy" decoding="async" data-fallback-src="${placeholder.fallback}" onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='true';this.src=this.dataset.fallbackSrc;}" />
          </div>
          <div class="flex-1 w-full md:ml-4 grid grid-cols-1 md:grid-cols-5 items-start md:items-center gap-4">
            <div>
              <p class="font-bold">${product.produto}</p>
              <p class="text-sm text-subtle-light dark:text-subtle-dark">Lote: ${product.lote || '-'}</p>
            </div>
            <div class="text-left md:text-center">
              <span class="text-2xl font-bold text-primary">${quantity}</span>
              <p class="text-xs text-subtle-light dark:text-subtle-dark">Unidades</p>
            </div>
            <div class="text-left md:text-center">
              <div class="flex items-center md:justify-center text-sm text-subtle-light dark:text-subtle-dark">
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
          </div>`;
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
      const cells = [
        move.data ? new Date(move.data).toLocaleString('pt-BR') : '-',
        move.usuario || '-',
        move.produto || '-',
        move.tipo || '-',
        move.quantidadeAnterior ?? '',
        move.quantidade ?? '',
        move.quantidadeAtual ?? '',
        move.motivo || '',
      ];
      cells.forEach(value => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
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

    const rootStyles = getComputedStyle(document.documentElement);
    const isDarkTheme = document.documentElement.classList.contains('dark');
    const axisColor = (isDarkTheme
      ? rootStyles.getPropertyValue('--color-subtle-dark')
      : rootStyles.getPropertyValue('--color-subtle-light'))?.trim() || (isDarkTheme ? '#CBD5E1' : '#475569');
    const gridColor = isDarkTheme ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)';
    const doughnutBorderColor = isDarkTheme ? 'rgba(15, 23, 42, 0.65)' : '#FFFFFF';

    const chartReady = await waitForChartLibrary();
    if (!chartReady) {
      console.warn('Biblioteca de gráficos indisponível. Os relatórios serão exibidos sem gráficos.');
      return;
    }

    if (!stockByProductCanvas || !stockByTypeCanvas) return;

    if (stockByProductChart) stockByProductChart.destroy();
    const productPalette = getAccessibleChartPalette(Math.max(labels.length, 1));
    stockByProductChart = new Chart(stockByProductCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Quantidade',
          data: labels.map(label => Number(estoqueResumo?.[label]) || 0),
          backgroundColor: productPalette,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: axisColor }, grid: { display: false } },
          y: { ticks: { color: axisColor }, grid: { color: gridColor } },
        },
      },
    });

    const typeCounts = {};
    estoqueData.forEach(item => {
      const key = item.tipo || 'Outros';
      typeCounts[key] = (typeCounts[key] || 0) + (Number(item.quantidade) || 0);
    });

    const typeLabels = Object.keys(typeCounts);
    const typeValues = typeLabels.map(label => typeCounts[label]);
    const typePalette = getAccessibleChartPalette(Math.max(typeLabels.length, 1));

    if (stockByTypeChart) stockByTypeChart.destroy();
    stockByTypeChart = new Chart(stockByTypeCanvas, {
      type: 'doughnut',
      data: {
        labels: typeLabels,
        datasets: [{
          data: typeValues,
          backgroundColor: typePalette,
          borderColor: doughnutBorderColor,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { color: axisColor } },
        },
      },
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
        authenticatedJsonFetch(`${BASE_URL}/api/users/pending`),
        authenticatedJsonFetch(`${BASE_URL}/api/users`)
      ]);
      const pendingData = pendingRes;
      const activeData = activeRes;

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
      if (imageFile) formData.append('image', imageFile);
      await authenticatedJsonFetch(`${BASE_URL}/api/estoque`, {
        method: 'POST',
        body: formData
      });
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
      if (newImageFile) formData.append('image', newImageFile);
      if (editForm.elements.removeImage?.checked) {
        formData.append('removeImage', 'true');
      }
      await authenticatedJsonFetch(`${BASE_URL}/api/estoque/${id}`, {
        method: 'PUT',
        body: formData
      });
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
      await authenticatedJsonFetch(`${BASE_URL}/api/estoque/${currentProductId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo })
      });
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
      await authenticatedJsonFetch(`${BASE_URL}/api/users/${userId}/approve`, {
        method: 'POST'
      });
      await renderApprovalPage();
    } catch (err) {
      alert('Erro ao aprovar usuário: ' + err.message);
    } finally {
      hideLoader();
    }
  };

  const declineUser = async userId => {
    try {
      showLoader();
      await authenticatedJsonFetch(`${BASE_URL}/api/users/${userId}`, {
        method: 'DELETE'
      });
      await renderApprovalPage();
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
  };

  const getStoredActivePage = () => null;

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

  const setupCashierMenuNavigation = () => {
    if (!cashierMenu) return;
    cashierMenu.addEventListener('click', event => {
      const link = event.target.closest('a[data-page]');
      if (!link) return;
      event.preventDefault();
      activateCashierMenuItem(link);
      if (!isDesktopViewport()) {
        closeMobileSidebar(true);
      }
    });
    const defaultLink = cashierMenu.querySelector('a[data-page="cashier-dashboard-page"]');
    if (defaultLink) {
      highlightCashierMenuItem(defaultLink);
      switchCashierPage(defaultLink.dataset.page);
    }
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

  moduleStockBtn?.addEventListener('click', () => {
    if (activeModule === 'stock') {
      restoreStoredPage();
      return;
    }
    switchToStockModule();
    restoreStoredPage();
  });

  moduleCashierBtn?.addEventListener('click', () => {
    if (activeModule === 'cashier') return;
    switchToCashierModule();
  });

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

  const setupSettingsLinks = () => {
    document.querySelectorAll('.settings-link').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        openCashierSettingsPage();
        document.querySelectorAll('.user-dropdown-menu').forEach(menu => menu.classList.add('hidden'));
      });
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
        await initProfilePhoto(uploadedPath ?? null);
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
    isRestoringSession = true;
    try {
      showLoader();
      const res = await fetch(`${BASE_URL}/api/session`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Sessão não encontrada');
      }
      const data = await res.json();
      await enterApplication({
        username: data.username,
        userId: data.userId,
        role: data.role,
        photo: data.photo ?? null
      });
    } catch (error) {
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
  logoutLinks.forEach(link => link.addEventListener('click', async event => {
    event.preventDefault();
    await logout();
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
  if (gridViewBtn) {
    gridViewBtn.addEventListener('click', () => {
      if (currentView === 'grid') return;
      currentView = 'grid';
      updateViewToggleState();
      renderStock();
    });
  }
  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
      if (currentView === 'list') return;
      currentView = 'list';
      updateViewToggleState();
      renderStock();
    });
  }
  updateViewToggleState();
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
  setupCashierMenuNavigation();
  setupUserMenus();
  setupSettingsLinks();
  initializeCashierSettings();
  initializeCashierMovementsModule();
  setupDarkMode();
  updateCashierDashboard();
  registerImageFallbacks(document);

  if (typeof window !== 'undefined') {
    window.setCashierDashboardMetrics = setCashierDashboardMetrics;
  }

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
    togglePasswordLogin.addEventListener('click', event => {
      event.preventDefault();
      const shouldReveal = inputClave.type === 'password';
      if (shouldReveal) {
        inputClave.type = 'text';
        if (monster) monster.src = 'img/idle/1.png';
        seguirPunteroMouse = false;
      } else {
        inputClave.type = 'password';
        seguirPunteroMouse = true;
      }
      if (togglePasswordLoginIcon) {
        togglePasswordLoginIcon.textContent = shouldReveal ? 'visibility' : 'visibility_off';
      }
    });
  }
  if (togglePasswordRegister) {
    togglePasswordRegister.addEventListener('click', event => {
      event.preventDefault();
      const registerPassword = document.getElementById('register-password');
      if (!registerPassword) return;
      const shouldReveal = registerPassword.type === 'password';
      registerPassword.type = shouldReveal ? 'text' : 'password';
      if (togglePasswordRegisterIcon) {
        togglePasswordRegisterIcon.textContent = shouldReveal ? 'visibility' : 'visibility_off';
      }
    });
  }

  resetProfilePhoto();
  initializeFromStoredSession();
});

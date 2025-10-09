import {
  getApp,
  getApps,
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const CASHIER_COLLECTIONS = Object.freeze({
  MOVEMENTS: 'cashier_movements',
  CATEGORIES: 'movement_categories',
  PAYMENT_METHODS: 'payment_methods',
  COMPANY_PROFILE: 'company_profile',
  PRODUCTS: 'products'
});

const state = {
  firebase: null,
  userId: null,
  movements: [],
  categories: [],
  paymentMethods: [],
  currentFilter: 'all',
  unsubscribes: {
    movements: null,
    categories: null,
    paymentMethods: null,
    companyProfile: null
  },
  isInitialized: false
};

const toArray = snapshot => snapshot.docs.map(docSnapshot => ({
  id: docSnapshot.id,
  ...docSnapshot.data()
}));

const formatCurrency = value => {
  const numeric = Number(value) || 0;
  return `R$ ${numeric.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const formatDateTime = timestamp => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
};

const getToastElement = () => document.getElementById('toast-notification');

const showToast = message => {
  const toast = getToastElement();
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('translate-x-[150%]');
  window.setTimeout(() => {
    toast.classList.add('translate-x-[150%]');
  }, 3200);
};

const getLoader = () => document.getElementById('loader');

const showLoader = () => getLoader()?.classList.remove('hidden');
const hideLoader = () => getLoader()?.classList.add('hidden');

const getFirebaseConfig = () => {
  if (typeof window !== 'undefined') {
    if (window.firebaseApp) {
      return { app: window.firebaseApp };
    }
    if (window.__FIREBASE_CONFIG__) {
      return { config: window.__FIREBASE_CONFIG__ };
    }
  }
  return null;
};

const ensureFirebase = async () => {
  if (state.firebase) return state.firebase;
  const available = getFirebaseConfig();
  if (!available) {
    throw new Error('Configuração do Firebase não encontrada. Certifique-se de inicializar o Firebase antes de carregar o módulo do caixa.');
  }

  let app = available.app;
  if (!app) {
    if (!getApps().length) {
      app = initializeApp(available.config);
    } else {
      app = getApp();
    }
  }

  const auth = window.firebaseAuth ?? getAuth(app);
  const db = window.firebaseDb ?? getFirestore(app);
  const storage = window.firebaseStorage ?? getStorage(app);

  state.firebase = { app, auth, db, storage };
  window.firebaseApp = app;
  window.firebaseAuth = auth;
  window.firebaseDb = db;
  window.firebaseStorage = storage;
  return state.firebase;
};

const userBasePath = (...segments) => {
  if (!state.userId) throw new Error('Usuário não autenticado.');
  return ['artifacts', '__app_id', 'users', state.userId, ...segments];
};

const getCollectionReference = (collectionName) => {
  const { db } = state.firebase;
  return collection(db, ...userBasePath(collectionName));
};

const getDocumentReference = (collectionName, documentId) => {
  const { db } = state.firebase;
  return doc(db, ...userBasePath(collectionName, documentId));
};

const unsubscribeAll = () => {
  Object.keys(state.unsubscribes).forEach(key => {
    const unsub = state.unsubscribes[key];
    if (typeof unsub === 'function') unsub();
    state.unsubscribes[key] = null;
  });
};


const renderCashierMovementsFiltered = () => {
  const filteredMovements = state.currentFilter === 'all'
    ? state.movements
    : state.movements.filter(movement => movement.type === state.currentFilter);
  const tbody = document.getElementById('cashier-movements-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  filteredMovements.forEach(movement => {
    const type = movement.type || '';
    const typeClass = type === 'Entrada' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger';
    const valueClass = type === 'Entrada' ? 'text-success' : 'text-danger';
    const createdAt = formatDateTime(movement.createdAt);
    const row = document.createElement('tr');
    row.className = 'bg-white dark:bg-surface-dark/50 border-b dark:border-border-color hover:bg-gray-50 dark:hover:bg-gray-600/20';
    row.innerHTML = `
      <td class="px-6 py-4 font-medium text-text-light dark:text-white whitespace-nowrap">${createdAt}</td>
      <td class="px-6 py-4"><span class="px-2 py-1 text-xs font-medium rounded-full ${typeClass}">${type}</span></td>
      <td class="px-6 py-4">${movement.category ?? ''}</td>
      <td class="px-6 py-4 text-right font-medium ${valueClass}">${formatCurrency(movement.value)}</td>
      <td class="px-6 py-4">${movement.employee ?? ''}</td>
      <td class="px-6 py-4">${movement.observations ?? ''}</td>
    `;
    tbody.appendChild(row);
  });
};

const syncMovementCategoriesOptions = () => {
  const select = document.getElementById('movement-category');
  if (!select) return;
  select.innerHTML = '';
  const activeCategories = state.categories.filter(category => (category.status ?? 'Ativo') === 'Ativo');
  if (!activeCategories.length) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Cadastre uma categoria primeiro';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
    return;
  }
  activeCategories.forEach(category => {
    const option = document.createElement('option');
    option.value = category.name;
    option.textContent = category.name;
    select.appendChild(option);
  });
};

const renderMovementCategories = () => {
  const tbody = document.getElementById('movement-categories-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  state.categories.forEach(category => {
    const statusClass = category.status === 'Ativo'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-text-light dark:text-text-dark">${category.name ?? ''}</td>
      <td class="whitespace-nowrap px-6 py-4 text-sm text-subtle-light dark:text-subtle-dark">${category.type ?? ''}</td>
      <td class="whitespace-nowrap px-6 py-4 text-sm">
        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}">${category.status ?? 'Ativo'}</span>
      </td>
      <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
        <a class="cashier-edit-category-btn text-primary hover:text-primary/80" href="#" data-id="${category.id}">Editar</a>
      </td>
    `;
    tbody.appendChild(row);
  });
};

const renderPaymentMethods = () => {
  const tbody = document.getElementById('payment-methods-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  state.paymentMethods.forEach(method => {
    const statusClass = method.status === 'Ativo'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    const actionText = method.status === 'Ativo' ? 'Desativar' : 'Ativar';
    const actionClass = method.status === 'Ativo' ? 'text-danger hover:text-danger/80' : 'text-success hover:text-success/80';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-text-light dark:text-text-dark">${method.name ?? ''}</td>
      <td class="whitespace-nowrap px-6 py-4 text-sm">
        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}">${method.status ?? 'Ativo'}</span>
      </td>
      <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
        <a class="cashier-toggle-payment-status-btn ${actionClass}" href="#" data-id="${method.id}" data-status="${method.status ?? 'Ativo'}">${actionText}</a>
      </td>
    `;
    tbody.appendChild(row);
  });
};

const renderCompanyProfile = profile => {
  const logoPreview = document.getElementById('logo-preview');
  if (!logoPreview) return;
  if (profile?.logoUrl) {
    logoPreview.style.backgroundImage = `url('${profile.logoUrl}')`;
  }
};

const handleMovementFormSubmit = async event => {
  event.preventDefault();
  if (!state.firebase || !state.userId) {
    showToast('Sessão inválida. Faça login novamente.');
    return;
  }
  const formData = new FormData(event.currentTarget);
  const value = Number(formData.get('value'));
  if (Number.isNaN(value)) {
    showToast('Informe um valor válido.');
    return;
  }
  try {
    showLoader();
    const movementsRef = getCollectionReference(CASHIER_COLLECTIONS.MOVEMENTS);
    await addDoc(movementsRef, {
      type: formData.get('type') || 'Entrada',
      category: formData.get('category') || null,
      value,
      employee: formData.get('employee') || null,
      observations: formData.get('observations') || null,
      createdAt: serverTimestamp(),
      createdBy: state.userId
    });
    event.currentTarget.reset();
    closeModal('cashier-movement-modal');
    showToast('Movimentação registrada com sucesso.');
  } catch (error) {
    console.error('Erro ao registrar movimentação:', error);
    showToast('Não foi possível registrar a movimentação.');
  } finally {
    hideLoader();
  }
};

const handleCategoryFormSubmit = async event => {
  event.preventDefault();
  if (!state.firebase || !state.userId) {
    showToast('Sessão inválida. Faça login novamente.');
    return;
  }
  const formData = new FormData(event.currentTarget);
  const id = formData.get('id');
  const payload = {
    name: formData.get('name') || '',
    type: formData.get('type') || 'Receita',
    status: 'Ativo',
    updatedAt: serverTimestamp()
  };
  try {
    showLoader();
    if (id) {
      await updateDoc(getDocumentReference(CASHIER_COLLECTIONS.CATEGORIES, id), payload);
      showToast('Categoria atualizada com sucesso.');
    } else {
      const categoriesRef = getCollectionReference(CASHIER_COLLECTIONS.CATEGORIES);
      await addDoc(categoriesRef, {
        ...payload,
        createdAt: serverTimestamp()
      });
      showToast('Categoria criada com sucesso.');
    }
    closeModal('category-modal');
    event.currentTarget.reset();
  } catch (error) {
    console.error('Erro ao salvar categoria:', error);
    showToast('Não foi possível salvar a categoria.');
  } finally {
    hideLoader();
  }
};

const togglePaymentMethodStatus = async (methodId, currentStatus) => {
  if (!methodId) return;
  try {
    showLoader();
    const newStatus = currentStatus === 'Ativo' ? 'Inativo' : 'Ativo';
    await updateDoc(getDocumentReference(CASHIER_COLLECTIONS.PAYMENT_METHODS, methodId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    showToast('Status do método de pagamento atualizado.');
  } catch (error) {
    console.error('Erro ao atualizar método de pagamento:', error);
    showToast('Não foi possível atualizar o método de pagamento.');
  } finally {
    hideLoader();
  }
};

const handleLogoUpload = async file => {
  if (!file || !state.firebase || !state.userId) return;
  try {
    showLoader();
    const { storage } = state.firebase;
    const extension = file.name?.split('.').pop() ?? 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const storageRef = ref(storage, userBasePath(CASHIER_COLLECTIONS.COMPANY_PROFILE, 'logo', fileName).join('/'));
    await uploadBytes(storageRef, file, { contentType: file.type });
    const downloadURL = await getDownloadURL(storageRef);
    await setDoc(doc(state.firebase.db, ...userBasePath(CASHIER_COLLECTIONS.COMPANY_PROFILE, 'profile')), {
      logoUrl: downloadURL,
      updatedAt: serverTimestamp()
    }, { merge: true });
    renderCompanyProfile({ logoUrl: downloadURL });
    showToast('Logotipo atualizado com sucesso.');
  } catch (error) {
    console.error('Erro ao enviar logotipo:', error);
    showToast('Não foi possível atualizar o logotipo.');
  } finally {
    hideLoader();
  }
};

const handleBackup = async () => {
  if (!state.firebase || !state.userId) {
    showToast('Sessão inválida. Faça login novamente.');
    return;
  }
  try {
    showLoader();
    const collections = [
      CASHIER_COLLECTIONS.MOVEMENTS,
      CASHIER_COLLECTIONS.CATEGORIES,
      CASHIER_COLLECTIONS.PAYMENT_METHODS,
      CASHIER_COLLECTIONS.PRODUCTS
    ];
    const data = {};
    for (const collectionName of collections) {
      const snapshot = await getDocs(getCollectionReference(collectionName));
      data[collectionName] = toArray(snapshot);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Backup gerado com sucesso.');
  } catch (error) {
    console.error('Erro ao gerar backup:', error);
    showToast('Não foi possível gerar o backup.');
  } finally {
    hideLoader();
  }
};

const openModal = modalId => {
  const modal = document.getElementById(modalId);
  modal?.classList.remove('hidden');
};

const closeModal = modalId => {
  const modal = document.getElementById(modalId);
  modal?.classList.add('hidden');
};

const switchCashierPage = pageId => {
  document.querySelectorAll('.cashier-page-content').forEach(page => {
    if (page.id === pageId) {
      page.classList.remove('hidden');
    } else {
      page.classList.add('hidden');
    }
  });
};

const activateCashierMenuItem = (menu, pageId) => {
  menu.querySelectorAll('a[data-page]').forEach(link => {
    const isActive = link.dataset.page === pageId;
    link.classList.toggle('bg-primary', isActive);
    link.classList.toggle('text-white', isActive);
    if (!isActive) {
      link.classList.add('hover:bg-primary/20', 'dark:hover:bg-primary/30');
    } else {
      link.classList.remove('hover:bg-primary/20', 'dark:hover:bg-primary/30');
    }
  });
  switchCashierPage(pageId);
  if (pageId === 'cashier-settings-page') {
    syncMovementCategoriesOptions();
  }
};

const handleCategoryEditClick = event => {
  const button = event.target.closest('.cashier-edit-category-btn');
  if (!button) return;
  event.preventDefault();
  const category = state.categories.find(cat => cat.id === button.dataset.id);
  const form = document.getElementById('category-form');
  if (!form) return;
  if (category) {
    const modalTitle = document.getElementById('category-modal-title');
    if (modalTitle) modalTitle.textContent = 'Editar Categoria';
    form.querySelector('#category-id').value = category.id || '';
    form.querySelector('#category-name').value = category.name || '';
    form.querySelector('#category-type').value = category.type || 'Receita';
  }
  openModal('category-modal');
};

const handlePaymentToggleClick = event => {
  const button = event.target.closest('.cashier-toggle-payment-status-btn');
  if (!button) return;
  event.preventDefault();
  togglePaymentMethodStatus(button.dataset.id, button.dataset.status);
};

const setupFilterButtons = () => {
  const container = document.getElementById('cashier-filter-buttons');
  if (!container) return;
  container.addEventListener('click', event => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    container.querySelectorAll('button[data-filter]').forEach(btn => {
      const isActive = btn === button;
      if (isActive) {
        btn.classList.add('bg-primary', 'text-white');
        btn.classList.remove('bg-surface-light', 'dark:bg-gray-800', 'border', 'border-gray-300', 'dark:border-gray-600', 'text-gray-700', 'dark:text-gray-300');
      } else {
        btn.classList.remove('bg-primary', 'text-white');
        btn.classList.add('bg-surface-light', 'dark:bg-gray-800', 'border', 'border-gray-300', 'dark:border-gray-600', 'text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-50', 'dark:hover:bg-gray-700');
      }
    });
    state.currentFilter = button.dataset.filter;
    renderCashierMovementsFiltered();
  });
};

const setupModals = () => {
  const registerMovementBtn = document.getElementById('register-movement-btn');
  const cancelMovementBtn = document.getElementById('cancel-movement-btn');
  const categoryModalClose = document.querySelector('[data-close-modal="category-modal"]');

  if (registerMovementBtn) {
    registerMovementBtn.addEventListener('click', () => openModal('cashier-movement-modal'));
  }
  if (cancelMovementBtn) {
    cancelMovementBtn.addEventListener('click', () => closeModal('cashier-movement-modal'));
  }
  const movementModal = document.getElementById('cashier-movement-modal');
  if (movementModal) {
    movementModal.addEventListener('click', event => {
      if (event.target === movementModal) closeModal('cashier-movement-modal');
    });
  }
  if (categoryModalClose) {
    categoryModalClose.addEventListener('click', () => closeModal('category-modal'));
  }
  const categoryModal = document.getElementById('category-modal');
  if (categoryModal) {
    categoryModal.addEventListener('click', event => {
      if (event.target === categoryModal) closeModal('category-modal');
    });
  }
};

const setupLogoUploader = () => {
  const changeLogoBtn = document.getElementById('change-logo-btn');
  const logoUploadInput = document.getElementById('logo-upload-input');
  if (!changeLogoBtn || !logoUploadInput) return;
  changeLogoBtn.addEventListener('click', () => logoUploadInput.click());
  logoUploadInput.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Selecione um arquivo de imagem.');
      return;
    }
    handleLogoUpload(file);
  });
};

const setupCashierMenu = () => {
  const menu = document.getElementById('cashier-main-menu');
  if (!menu) return;
  menu.addEventListener('click', event => {
    const link = event.target.closest('a[data-page]');
    if (!link) return;
    event.preventDefault();
    activateCashierMenuItem(menu, link.dataset.page);
  });
};

const setupDarkModeToggles = () => {
  document.querySelectorAll('.cashier-dark-mode-toggle').forEach(button => {
    button.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
    });
  });
};

const setupCashLimitButton = () => {
  const button = document.getElementById('save-cash-limit-btn');
  if (!button) return;
  button.addEventListener('click', () => showToast('Limite de caixa salvo com sucesso!'));
};

const setupBackupButton = () => {
  const button = document.getElementById('backup-data-btn');
  if (!button) return;
  button.addEventListener('click', event => {
    event.preventDefault();
    handleBackup();
  });
};

const setupForms = () => {
  const movementForm = document.getElementById('cashier-movement-form');
  const categoryForm = document.getElementById('category-form');
  if (movementForm) movementForm.addEventListener('submit', handleMovementFormSubmit);
  if (categoryForm) categoryForm.addEventListener('submit', handleCategoryFormSubmit);
};

const setupTables = () => {
  const categoriesTable = document.getElementById('movement-categories-table-body');
  const paymentTable = document.getElementById('payment-methods-table-body');
  categoriesTable?.addEventListener('click', handleCategoryEditClick);
  paymentTable?.addEventListener('click', handlePaymentToggleClick);
};

const initializeListeners = () => {
  if (state.isInitialized) return;
  setupCashierMenu();
  setupFilterButtons();
  setupModals();
  setupForms();
  setupTables();
  setupLogoUploader();
  setupDarkModeToggles();
  setupCashLimitButton();
  setupBackupButton();
  const addCategoryBtn = document.getElementById('add-category-btn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      const form = document.getElementById('category-form');
      if (!form) return;
      form.reset();
      const modalTitle = document.getElementById('category-modal-title');
      if (modalTitle) modalTitle.textContent = 'Adicionar Categoria';
      form.querySelector('#category-id').value = '';
      openModal('category-modal');
    });
  }
  state.isInitialized = true;
};

const subscribeToMovements = () => {
  const movementsRef = getCollectionReference(CASHIER_COLLECTIONS.MOVEMENTS);
  const q = query(movementsRef, orderBy('createdAt', 'desc'));
  state.unsubscribes.movements = onSnapshot(q, snapshot => {
    state.movements = toArray(snapshot);
    renderCashierMovementsFiltered();
    updateCashierDashboard();
  }, error => {
    console.error('Erro ao sincronizar movimentações:', error);
  });
};

const subscribeToCategories = () => {
  const categoriesRef = getCollectionReference(CASHIER_COLLECTIONS.CATEGORIES);
  state.unsubscribes.categories = onSnapshot(categoriesRef, snapshot => {
    state.categories = toArray(snapshot);
    renderMovementCategories();
    syncMovementCategoriesOptions();
  }, error => {
    console.error('Erro ao sincronizar categorias:', error);
  });
};

const subscribeToPaymentMethods = () => {
  const paymentRef = getCollectionReference(CASHIER_COLLECTIONS.PAYMENT_METHODS);
  state.unsubscribes.paymentMethods = onSnapshot(paymentRef, snapshot => {
    state.paymentMethods = toArray(snapshot);
    renderPaymentMethods();
  }, error => {
    console.error('Erro ao sincronizar métodos de pagamento:', error);
  });
};

const subscribeToCompanyProfile = () => {
  const { db } = state.firebase;
  const profileRef = doc(db, ...userBasePath(CASHIER_COLLECTIONS.COMPANY_PROFILE, 'profile'));
  state.unsubscribes.companyProfile = onSnapshot(profileRef, snapshot => {
    if (!snapshot.exists()) return;
    renderCompanyProfile(snapshot.data());
  }, error => {
    console.error('Erro ao sincronizar perfil da empresa:', error);
  });
};

const initializeSubscriptions = () => {
  unsubscribeAll();
  subscribeToMovements();
  subscribeToCategories();
  subscribeToPaymentMethods();
  subscribeToCompanyProfile();
};

const resetModuleState = () => {
  unsubscribeAll();
  state.movements = [];
  state.categories = [];
  state.paymentMethods = [];
  state.currentFilter = 'all';
  renderCashierMovementsFiltered();
  renderMovementCategories();
  renderPaymentMethods();
  updateCashierDashboard();
  const menu = document.getElementById('cashier-main-menu');
  if (menu) activateCashierMenuItem(menu, 'cashier-dashboard-page');
};

const setCurrentUser = async userId => {
  if (state.userId === userId) return;
  state.userId = userId;
  if (!userId) {
    resetModuleState();
    return;
  }
  try {
    await ensureFirebase();
    initializeSubscriptions();
  } catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
    showToast(error.message);
  }
};

const startAuthWatcher = async () => {
  try {
    const { auth } = await ensureFirebase();
    onAuthStateChanged(auth, user => {
      if (user) {
        setCurrentUser(user.uid);
      } else if (!state.userId) {
        resetModuleState();
      }
    });
  } catch (error) {
    console.error('Não foi possível iniciar o listener de autenticação do Firebase:', error);
  }
};

const bootstrap = () => {
  initializeListeners();
  startAuthWatcher();
  const menu = document.getElementById('cashier-main-menu');
  if (menu) activateCashierMenuItem(menu, 'cashier-dashboard-page');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

window.addEventListener('cashier:session', event => {
  const userId = event.detail?.userId ?? null;
  setCurrentUser(userId);
});

export {}; // Garantir que o arquivo seja tratado como módulo ES.

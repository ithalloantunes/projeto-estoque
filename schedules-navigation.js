// Reuse the application shell before javascript.js binds mobile and user controls.
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('schedules-module');
  const panel = document.getElementById('workforce-panel');
  const definitions = [
    ['week', 'Escala semanal', 'calendar_month', false],
    ['employees', 'Funcionários', 'groups', true],
    ['templates', 'Modelos de turno', 'schedule', true],
    ['units', 'Unidades e equipes', 'store', true],
    ['availability', 'Disponibilidade', 'event_available', false],
    ['swaps', 'Trocas de turno', 'swap_horiz', false],
    ['generate', 'Geração automática', 'auto_awesome', true],
    ['attendance', 'Ponto eletrônico', 'fingerprint', false],
    ['payroll', 'Banco de horas e folha', 'payments', false],
    ['rules', 'Configurações de jornada', 'settings', true],
    ['history', 'Histórico', 'history', true],
  ];
  const sidebar = document.getElementById('stock-sidebar-content').cloneNode(true);
  sidebar.id = 'schedules-sidebar-content';
  sidebar.classList.add('hidden');
  sidebar.querySelector('h1').textContent = 'Escalas de funcionários';
  const logo = sidebar.querySelector('img');
  logo.src = 'img/acai-escalas.png';
  logo.alt = 'AÇAI ESCALAS';
  const nav = sidebar.querySelector('nav');
  nav.id = 'schedules-menu';
  nav.setAttribute('aria-label', 'Escalas de funcionários');
  nav.replaceChildren();
  const links = new Map();
  for (const [id, title, icon, restricted] of definitions) {
    const link = document.createElement('a');
    link.href = '#';
    link.dataset.schedulePage = id;
    link.className = 'flex items-center gap-4 px-4 py-3 rounded-lg text-white/70 hover:bg-white/10 transition-colors';
    link.innerHTML = `<span class="material-icons" aria-hidden="true">${icon}</span><span class="font-medium">${title}</span>`;
    link.hidden = restricted;
    nav.append(link);
    links.set(id, link);
  }
  document.getElementById('cashier-sidebar-content').after(sidebar);
  const pager = document.createElement('div');
  pager.className = 'schedules-menu-pager';
  pager.setAttribute('aria-label', 'Páginas do menu de Escalas');
  pager.innerHTML = '<button type="button" aria-label="Página anterior do menu"><span class="material-icons" aria-hidden="true">chevron_left</span></button><span role="status" aria-live="polite"></span><button type="button" aria-label="Próxima página do menu"><span class="material-icons" aria-hidden="true">chevron_right</span></button>';
  sidebar.append(pager);
  const previousMenuPage = pager.querySelector('button:first-child');
  const nextMenuPage = pager.querySelector('button:last-child');
  const menuPageLabel = pager.querySelector('[role="status"]');
  let menuPage = 0;
  let menuGroups = [];

  const header = document.querySelector('#home-page > header').cloneNode(true);
  for (const el of header.querySelectorAll('[id]')) el.removeAttribute('id');
  header.querySelector('.approve-link')?.remove();
  const title = header.querySelector('h2');
  title.id = 'schedules-page-title';
  const subtitle = header.querySelector('p');
  subtitle.textContent = 'Escalas de funcionários';
  const oldHeader = root.querySelector('header');
  // Keep the original subtitle node because schedules.js updates its text.
  const originalSubtitle = document.getElementById('schedule-subtitle');
  subtitle.replaceWith(originalSubtitle);
  oldHeader.hidden = true;
  const content = document.createElement('div');
  content.className = 'schedules-content';
  const message = document.getElementById('schedule-message');
  const policy = document.getElementById('schedule-policy');
  const admin = document.getElementById('schedule-admin');
  const pages = new Map();
  const makePage = (id, parent) => {
    const page = document.createElement('section');
    page.className = 'schedule-page';
    page.dataset.schedulePage = id;
    page.setAttribute('aria-labelledby', title.id);
    page.hidden = true;
    parent.append(page);
    pages.set(id, page);
    return page;
  };
  const week = makePage('week', content);
  for (const node of [...root.children]) {
    if (![oldHeader, message, policy, admin, panel].includes(node)) week.append(node);
  }
  content.prepend(message, policy);
  content.append(admin, panel);
  const wrapDetails = (details, id, parent) => {
    const page = makePage(id, parent);
    details.open = true;
    details.classList.add('schedule-page-card');
    page.append(details);
  };
  [...admin.children].forEach((details, i) => wrapDetails(details, ['employees', 'templates', 'history'][i], admin));
  [...panel.querySelectorAll(':scope > details')].forEach((details, i) => {
    wrapDetails(details, ['units', 'rules', 'availability', 'swaps', 'generate', 'attendance', 'payroll'][i], panel);
  });
  panel.querySelector(':scope > h2').hidden = true;
  const period = panel.querySelector('#wf-period');
  const workforceMessage = panel.querySelector('#workforce-message');
  root.prepend(header);
  root.append(content);
  let current = 'week';
  let isAdmin = false;
  let authenticated = false;
  function renderMenu(revealCurrent = false) {
    const allowed = definitions.filter(item => !item[3] || isAdmin).map(item => links.get(item[0]));
    for (const [id, , , restricted] of definitions) links.get(id).hidden = restricted && !isAdmin;
    if (!nav.clientHeight) return;
    // Measure original-sized rows, then show only a group that fits the available space.
    const available = nav.clientHeight;
    menuGroups = [];
    let group = [], used = 0;
    for (const link of allowed) {
      const height = link.getBoundingClientRect().height;
      const needed = height + (group.length ? 8 : 0);
      if (group.length && used + needed > available) {
        menuGroups.push(group);
        group = [];
        used = 0;
      }
      used += height + (group.length ? 8 : 0);
      group.push(link);
    }
    if (group.length) menuGroups.push(group);
    if (revealCurrent) {
      const activeGroup = menuGroups.findIndex(items => items.includes(links.get(current)));
      if (activeGroup >= 0) menuPage = activeGroup;
    }
    menuPage = Math.max(0, Math.min(menuPage, menuGroups.length - 1));
    for (const link of allowed) link.hidden = !menuGroups[menuPage]?.includes(link);
    previousMenuPage.disabled = menuPage === 0;
    nextMenuPage.disabled = menuPage >= menuGroups.length - 1;
    menuPageLabel.textContent = `Página ${menuPage + 1} de ${menuGroups.length}`;
  }
  previousMenuPage.addEventListener('click', () => { menuPage--; renderMenu(); });
  nextMenuPage.addEventListener('click', () => { menuPage++; renderMenu(); });
  new ResizeObserver(() => renderMenu()).observe(nav);
  function select(id, notify = false) {
    const definition = definitions.find(item => item[0] === id);
    if (!definition || (definition[3] && !isAdmin)) id = 'week';
    current = id;
    title.textContent = definitions.find(item => item[0] === id)[1];
    for (const [key, page] of pages) page.hidden = key !== id;
    for (const [key, link] of links) {
      const active = key === id;
      link.classList.toggle('bg-white/20', active);
      link.classList.toggle('text-white', active);
      link.classList.toggle('text-white/70', !active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    const workforcePage = ['units', 'rules', 'availability', 'swaps', 'generate', 'attendance', 'payroll'].includes(id);
    panel.classList.toggle('schedule-navigation-hidden', !workforcePage);
    if (id === 'attendance' || id === 'payroll') {
      pages.get(id).prepend(period);
    }
    workforceMessage.hidden = !workforcePage;
    renderMenu(true);
    if (notify) {
      content.scrollTop = 0;
      window.dispatchEvent(new Event('schedules-page-selected'));
    }
  }
  nav.addEventListener('click', event => {
    const link = event.target.closest('a[data-schedule-page]');
    if (!link) return;
    event.preventDefault();
    if (link.hidden || !authenticated) return;
    select(link.dataset.schedulePage, true);
  });
  window.addEventListener('schedules-context', event => {
    authenticated = true;
    isAdmin = event.detail.session.role === 'admin';
    for (const [id, , , restricted] of definitions) links.get(id).hidden = restricted && !isAdmin;
    select(current);
  });
  window.addEventListener('schedules-reset', () => {
    authenticated = isAdmin = false;
    for (const [id, , , restricted] of definitions) links.get(id).hidden = restricted;
    select('week');
  });
  select('week');
});

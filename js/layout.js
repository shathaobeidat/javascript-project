/* Gradify — layout.js
   Injects the shared Sidebar + Header into every inner page.
   Pages only need:  <aside id="app-sidebar"></aside>  and  <div id="app-header"></div>
   and  <script type="module" src="../js/layout.js"></script>                          */

const LOGO = new URL('../assets/logo.jpeg', import.meta.url).href;
const SESSION_KEY = 'gradify:user';
const THEME_KEY = 'gradify:theme';

const ICONS = {
  dashboard: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  students: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  tasks: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
  course: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M12 7v6M9 10h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const NAV = [
  { href: 'dashboard.html', label: 'Dashboard', icon: 'dashboard' },
  { href: 'students.html', label: 'Students', icon: 'students' },
  { href: 'tasks.html', label: 'Assignments', icon: 'tasks' },
  { href: 'addcourse.html', label: 'Add course', icon: 'course' },
];

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- session helpers (also used by login.js) ---------- */
export function getSessionUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
export function setSessionUser(user) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch { /* storage unavailable */ }
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
}

/* ---------- theme ---------- */
const root = document.documentElement;
export function applyTheme(theme) {
  root.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('gradify:theme', { detail: { theme } }));
}

/* ---------- toast ---------- */
let toastEl, toastTimer;
export function showToast(message) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 2500);
}

/* ---------- render ---------- */
function renderSidebar(host) {
  const here = location.pathname.split('/').pop() || 'dashboard.html';
  host.innerHTML = `
    <div class="sidebar">
      <a class="brand" href="dashboard.html" aria-label="Gradify home">
        <span class="brand-logo"><img src="${LOGO}" alt=""></span>
        <span><span class="brand-name">Gradify</span><span class="brand-tag">Instructor portal</span></span>
      </a>
      <nav class="nav" aria-label="Main">
        ${NAV.map((n) => `
          <a href="${n.href}" class="nav-item${n.href === here ? ' active' : ''}"${n.href === here ? ' aria-current="page"' : ''}>
            ${icon(n.icon)}<span>${n.label}</span>
          </a>`).join('')}
      </nav>
      <p class="sidebar-foot">© ${new Date().getFullYear()} Gradify</p>
    </div>`;
}

function renderHeader(host) {
  const user = getSessionUser();
  const name = user?.name || 'Instructor';
  const initials = name.replace(/^(dr\.?|prof\.?)\s*/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'G';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  host.innerHTML = `
    <header class="topbar">
      <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Open menu">${icon('menu')}</button>
      <div class="greeting">
        <span class="greeting-title">${esc(greeting)}, ${esc(name)}</span>
        <span class="greeting-date">${esc(today)}</span>
      </div>
      <button class="icon-btn" id="theme-btn" title="Toggle theme" aria-label="Switch theme">${icon('moon', 'icon-moon')}${icon('sun', 'icon-sun')}</button>
      <div class="profile-wrap">
        <button class="profile" id="profile-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="profile-menu">
          <span class="avatar">${esc(initials)}</span>
          <span class="profile-name">${esc(name)}</span>
          ${icon('chevron', 'chevron')}
        </button>
        <div class="menu" id="profile-menu" role="menu" hidden>
          <button role="menuitem" id="support-btn">${icon('help')} Support</button>
          <button role="menuitem" id="logout-btn" class="danger">${icon('logout')} Sign out</button>
        </div>
      </div>
    </header>`;
}

function wire() {
  /* theme */
  const themeBtn = document.getElementById('theme-btn');
  const syncThemeLabel = () => themeBtn.setAttribute('aria-label', root.dataset.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  syncThemeLabel();
  themeBtn.addEventListener('click', () => { applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'); syncThemeLabel(); });

  /* mobile drawer */
  const body = document.body;
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.querySelector('.app-shell')?.appendChild(backdrop);
  const setDrawer = (open) => body.classList.toggle('sidebar-open', open);
  document.getElementById('menu-toggle').addEventListener('click', () => setDrawer(!body.classList.contains('sidebar-open')));
  backdrop.addEventListener('click', () => setDrawer(false));

  /* Escape closes the profile menu and the mobile drawer */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { setMenu(false); setDrawer(false); }
  });

  /* profile menu */
  const profileBtn = document.getElementById('profile-btn');
  const menu = document.getElementById('profile-menu');
  function setMenu(open) { menu.hidden = !open; profileBtn.setAttribute('aria-expanded', String(open)); }
  profileBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
  document.getElementById('support-btn').addEventListener('click', () => {
    setMenu(false);
    location.href = 'mailto:support@gradify.app?subject=Support%20request';
  });
  document.getElementById('logout-btn').addEventListener('click', () => {
    setMenu(false);
    if (confirm('Are you sure you want to sign out?')) {
      clearSession();
      location.href = 'login.html';
    }
  });
}

const sidebarHost = document.getElementById('app-sidebar');
const headerHost = document.getElementById('app-header');
if (sidebarHost) renderSidebar(sidebarHost);
if (headerHost) { renderHeader(headerHost); wire(); }
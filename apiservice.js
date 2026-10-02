import { getStudents, getCourses, STATUS } from './api.js';
import { getSession, clearSession } from './session.js';

/* ---------- Theme toggle (light / dark) ---------- */
function initTheme() {
  const root = document.documentElement;
  const btn = $('theme-btn');
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch {}
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;

  const apply = (theme, persist) => {
    root.dataset.theme = theme;
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    if (persist) { try { localStorage.setItem('theme', theme); } catch {} }   // only the user's click saves
  };
  apply(saved || (prefersDark ? 'dark' : 'light'), false);                    // restore saved choice on load
  btn.addEventListener('click', () => apply(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
}


/* =====================  Settings (edit here)  ===================== */
const REQUIRE_LOGIN = false;                // true = send users to the login page when not logged in
const LOGIN_PAGE = 'login.html';
const SUPPORT_EMAIL = 'support@university.edu';
const DEFAULT_PAGE = 'dashboard';           // page opened when the URL has no #hash
/* ================================================================= */

const $ = (id) => document.getElementById(id);
const user = getSession();                  // { id, name, email, role } saved by the login page

/* ---------- Toast ---------- */
let toastTimer;
function showToast(msg) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 3000);
}

/* ---------- Sidebar navigation ----------
   Clicking an item updates the title + URL hash and fires a "page-change" event.
   Teammates listen to it to draw their page inside #page-content:

     window.addEventListener('page-change', (e) => {
       const { page, params } = e.detail;   // page = 'students', params = { courseId: 2 }
     });
   or call:  import { navigate } from './layout.js';  navigate('students', { id: 5 });
*/
const navItems = [...document.querySelectorAll('.nav-item')];
const pageOf = (a) => a.getAttribute('href').replace('#', '');
const pageFromHash = () => {
  const p = location.hash.slice(1);
  return navItems.some((a) => pageOf(a) === p) ? p : null;
};

/** @param {'push'|'replace'|'none'} mode how to touch the browser history */
function navigate(page, params = {}, mode = 'push') {
  const target = navItems.find((a) => pageOf(a) === page);
  if (!target) return;

  navItems.forEach((a) => {
    const on = a === target;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  $('page-title').textContent = target.querySelector('span').textContent;

  if (mode !== 'none') history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', `#${page}`);
  window.dispatchEvent(new CustomEvent('page-change', { detail: { page, params } }));
}

function initNav() {
  navItems.forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(pageOf(a));
    })
  );
  window.addEventListener('popstate', () => navigate(pageFromHash() || DEFAULT_PAGE, {}, 'none')); // back / forward
  navigate(pageFromHash() || DEFAULT_PAGE, {}, 'replace');                                       // first load
}

/* ---------- Logged-in user (avatar + menu header) ---------- */
function initials(name = '') {
  // "Dr. shatha" -> "S" , "Lina Haddad" -> "LH"
  const parts = name.replace(/^dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

function initUser() {
  const name = user?.name || 'Guest';
  document.querySelector('.avatar').textContent = initials(name);

  const btn = $('profile-btn');
  btn.title = name;
  btn.setAttribute('aria-label', `Account menu for ${name}`);

  const head = document.createElement('div');
  head.className = 'menu-head';
  const strong = document.createElement('strong');
  strong.textContent = name;
  const small = document.createElement('small');
  small.textContent = user?.role || '';
  head.append(strong, small);
  $('profile-menu').prepend(head);
}

/* ---------- Notifications badge = number of "At risk" students ---------- */
async function refreshBadge() {
  const badge = $('badge');
  try {
    const atRisk = await getStudents({ status: STATUS.AT_RISK });
    badge.textContent = atRisk.length;
    badge.hidden = atRisk.length === 0;
    $('notif-btn').setAttribute('aria-label', `Alerts, ${atRisk.length} students at risk`);
  } catch (err) {
    badge.hidden = true;
    showToast(err.message);                 // "Cannot reach the API ... Is json-server running?"
  }
}

function initNotifications() {
  $('badge').hidden = true;                 // hidden until the real number arrives
  $('notif-btn').addEventListener('click', () => navigate('alerts'));
  refreshBadge();
}

/* ---------- Search (students + courses from the API) ---------- */
function initSearch() {
  const input = $('search');

  // build the results box under the search bar (no HTML change needed)
  const label = input.closest('.search');
  const wrap = document.createElement('div');
  wrap.className = 'search-wrap';
  const box = document.createElement('div');
  box.className = 'results';
  box.hidden = true;
  label.replaceWith(wrap);
  wrap.append(label, box);

  let courses = [];
  getCourses().then((c) => (courses = c)).catch(() => {});

  const close = () => { box.hidden = true; box.replaceChildren(); };

  const row = (title, sub, page, params) => {
    const a = document.createElement('a');
    a.className = 'result';
    a.href = `#${page}`;
    const t = document.createElement('strong'); t.textContent = title;
    const s = document.createElement('small');  s.textContent = sub;
    a.append(t, s);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      close();
      input.value = '';
      navigate(page, params);
    });
    return a;
  };
  const heading = (text) => {
    const h = document.createElement('div');
    h.className = 'result-head';
    h.textContent = text;
    return h;
  };

  let timer;
  let latest = 0;

  async function run(q) {
    const id = ++latest;
    let students = [];
    try { students = await getStudents({ q }); } catch (err) { showToast(err.message); return; }
    if (id !== latest) return;              // a newer search already started

    const term = q.toLowerCase();
    const courseHits = courses.filter((c) =>
      c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term));
    const codeById = Object.fromEntries(courses.map((c) => [c.id, c.code]));

    box.replaceChildren();
    if (!students.length && !courseHits.length) {
      const empty = document.createElement('div');
      empty.className = 'result-empty';
      empty.textContent = 'No results';
      box.append(empty);
    }
    if (students.length) {
      box.append(heading('Students'));
      students.slice(0, 5).forEach((s) =>
        box.append(row(s.name, `${codeById[s.courseId] ?? ''} · ${s.status}`, 'students', { id: s.id })));
    }
    if (courseHits.length) {
      box.append(heading('Courses'));
      courseHits.slice(0, 4).forEach((c) =>
        box.append(row(c.name, c.code, 'students', { courseId: c.id })));
    }
    box.hidden = false;
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { latest++; close(); return; }
    timer = setTimeout(() => run(q), 250);  // debounce
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target) && e.target !== input) close(); });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); input.focus(); }
    if (e.key === 'Escape') close();
  });
}

/* ---------- Avatar menu (Support + Logout) ---------- */
function initMenu() {
  const btn = $('profile-btn');
  const menu = $('profile-menu');
  const set = (open) => {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(menu.hidden); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); }
  });

  $('support-btn').addEventListener('click', () => {
    set(false);
    location.href = `mailto:${SUPPORT_EMAIL}?subject=Support%20request`;
  });
  $('logout-btn').addEventListener('click', () => {
    set(false);
    if (!confirm('Are you sure you want to log out?')) return;
    clearSession();
    showToast('Logged out');
    setTimeout(() => (location.href = LOGIN_PAGE), 800);
  });
}

/* ---------- Start ---------- */
if (REQUIRE_LOGIN && !user) {
  location.replace(LOGIN_PAGE);             // not logged in
} else {
  initTheme();
  initUser();
  initMenu();
  initSearch();
  initNotifications();
  initNav();
}
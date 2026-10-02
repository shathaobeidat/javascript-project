/* ---------- Sidebar navigation ---------- */
const items = document.querySelectorAll('.nav-item');
const title = document.getElementById('page-title');

items.forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    items.forEach(i => {
      i.classList.remove('active');
      i.removeAttribute('aria-current');
    });
    item.classList.add('active');
    item.setAttribute('aria-current', 'page');
    title.textContent = item.querySelector('span').textContent;
  });
});
fetch('db.json') 
  .then(response => {
    if (!response.ok) {
      throw new Error("HTTP error! Status: " + response.status);
    }
    return response.json();
  })
  .then(data => {
    console.log("JSON sucsessful:", data);
  })
  .catch(error => {
    console.error("ERROR", error);
  });
/* ---------- Toast helper ---------- */
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 2500);
}

/* ---------- Theme toggle (light / dark) ---------- */
const root = document.documentElement;
const themeBtn = document.getElementById('theme-btn');

function applyTheme(theme) {
  root.dataset.theme = theme;
  themeBtn.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  );
  try { localStorage.setItem('theme', theme); } catch {}
}
applyTheme(root.dataset.theme); // sync button label with the theme set in <head>

themeBtn.addEventListener('click', () => {
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* ---------- Search ---------- */
const search = document.getElementById('search');
search.addEventListener('input', e => {
  console.log('Search:', e.target.value); // replace with your own filtering
});
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (e.key === '/' && !typing) {
    e.preventDefault();
    search.focus();
  }
});

/* ---------- Notifications ---------- */
const badge = document.getElementById('badge');
document.getElementById('notif-btn').addEventListener('click', () => {
  badge.hidden = true;
});

/* ---------- Avatar menu (Support + Logout) ---------- */
const profileBtn = document.getElementById('profile-btn');
const menu = document.getElementById('profile-menu');

function setMenu(open) {
  menu.hidden = !open;
  profileBtn.setAttribute('aria-expanded', String(open));
}
profileBtn.addEventListener('click', e => {
  e.stopPropagation();
  setMenu(menu.hidden);
});
document.addEventListener('click', e => {
  if (!menu.hidden && !menu.contains(e.target)) setMenu(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !menu.hidden) {
    setMenu(false);
    profileBtn.focus();
  }
});

document.getElementById('support-btn').addEventListener('click', () => {
  setMenu(false);
  window.location.href = 'mailto:support@example.com?subject=Support%20request'; // change email
});

document.getElementById('logout-btn').addEventListener('click', () => {
  setMenu(false);
  if (confirm('Are you sure you want to log out?')) {
    // TODO: clear your session, then redirect, e.g. location.href = 'login.html'
    showToast('Logged out');
  }
});
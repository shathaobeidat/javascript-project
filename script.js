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

// Notifications: clear the badge when opened
const badge = document.getElementById('badge');
document.getElementById('notif-btn').addEventListener('click', () => {
  badge.hidden = true;
});

// Profile button toggles aria-expanded (hook your menu here)
const profileBtn = document.getElementById('profile-btn');
profileBtn.addEventListener('click', () => {
  const open = profileBtn.getAttribute('aria-expanded') === 'true';
  profileBtn.setAttribute('aria-expanded', String(!open));
});

// Search: log the query (replace with your own filtering)
document.getElementById('search').addEventListener('input', e => {
  console.log('Search:', e.target.value);
});
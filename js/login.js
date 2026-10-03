
import { loginUser } from './apiservice.js';
import { setSessionUser } from './layout.js';

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('Log-in-btn');
const loginMessage = document.getElementById('login-message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';
  if (!form.checkValidity()) { form.reportValidity(); return; }

  loginBtn.disabled = true;
  try {
    const user = await loginUser(emailInput.value.trim(), passwordInput.value);
    if (user) {
      setSessionUser(user);
      window.location.href = 'dashboard.html';
    } else {
      loginMessage.textContent = 'Email or password is incorrect.';
    }
  } catch (err) {
    loginMessage.textContent = err.message;
  } finally {
    loginBtn.disabled = false;
  }
});

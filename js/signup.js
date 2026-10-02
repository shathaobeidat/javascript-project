// signup.js — validate the form, register the user, go to the sign-in page.
import { registerUser } from './apiservice.js';

const userName = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPassword = document.getElementById('confarm');
const signupForm = document.getElementById('signup-form');
const signupMessage = document.getElementById('signup-message');
const submitBtn = document.getElementById('Sign-up');

const hints = {
  length: document.getElementById('leangh-number'),
  upper: document.getElementById('uppercas'),
  lower: document.getElementById('lawercase'),
  number: document.getElementById('one-number'),
};

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  signupMessage.textContent = '';
  if (!signupForm.checkValidity()) { signupForm.reportValidity(); return; }
  if (passwordInput.value !== confirmPassword.value) {
    signupMessage.textContent = 'Passwords do not match.';
    return;
  }

  submitBtn.disabled = true;
  try {
    await registerUser({ name: userName.value.trim(), email: emailInput.value.trim(), password: passwordInput.value });
    window.location.href = 'login.html';
  } catch (err) {
    signupMessage.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

// Live password requirements
passwordInput.addEventListener('input', () => {
  const p = passwordInput.value;
  const mark = (ok, text) => `${ok ? '✅' : '❌'} ${text}`;
  hints.length.textContent = mark(p.length >= 8, 'At least 8 characters');
  hints.upper.textContent = mark(/[A-Z]/.test(p), 'One uppercase letter');
  hints.lower.textContent = mark(/[a-z]/.test(p), 'One lowercase letter');
  hints.number.textContent = mark(/[0-9]/.test(p), 'One number');
});

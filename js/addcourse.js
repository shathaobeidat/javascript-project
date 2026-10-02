// add-course.js — Add a new course page (Shatha). Data only through apiService.js.
import { getCourses, addCourse } from './apiService.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setMessage(id, text) {
  const el = $(id);
  el.textContent = text;
  el.hidden = !text;
}

async function renderCourses(newCode = '') {
  try {
    const courses = await getCourses();
    $('crs-count').textContent = courses.length;
    $('crs-empty').hidden = courses.length > 0;
    $('crs-list').innerHTML = courses.map((c) => `
      <li class="crs-item${c.code === newCode ? ' crs-item--new' : ''}">
        <span class="crs-code">${esc(c.code)}</span><span class="crs-name">${esc(c.name)}</span>
      </li>`).join('');
  } catch (err) {
    setMessage('crs-error', err.message);
  }
}

async function onSubmit(event) {
  event.preventDefault();
  setMessage('crs-error', '');
  setMessage('crs-success', '');

  const form = $('crs-form');
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const code = $('crs-code').value.trim().toUpperCase();
  const name = $('crs-name').value.trim();
  $('crs-submit').disabled = true;
  try {
    await addCourse({ code, name });           // throws if the code already exists
    form.reset();
    setMessage('crs-success', `Course ${code} was added. You can now assign students and tasks to it.`);
    await renderCourses(code);
  } catch (err) {
    setMessage('crs-error', err.message);
  } finally {
    $('crs-submit').disabled = false;
  }
}

$('crs-form').addEventListener('submit', onSubmit);
$('crs-reset').addEventListener('click', () => { setMessage('crs-error', ''); setMessage('crs-success', ''); });

renderCourses();
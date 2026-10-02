// students.js — Students page. Data only through apiservice.js.
import { getStudents, getCourses, getAttendance, addStudent, updateStudent, deleteStudent, recordAttendance, ATTENDANCE } from './apiservice.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sameId = (a, b) => String(a) === String(b);
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

let students = [];
let courses = [];
let attendance = [];
const filters = { courseId: '', status: '', date: '', attendance: '', query: '' };

/* ---------- loading ---------- */
async function init() {
  try {
    [courses, students, attendance] = await Promise.all([getCourses(), getStudents(), getAttendance()]);
    fillCourseSelects();
    const q = new URLSearchParams(location.search).get('q');
    if (q) { filters.query = q; $('stu-search').value = q; }
    render();
  } catch (err) {
    showAlert($('stu-alert'), err.message);
  }
}

async function reload() {
  [students, attendance] = await Promise.all([getStudents(), getAttendance()]);
  render();
}

function showAlert(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

/* ---------- attendance helpers ---------- */
const recordOn = (studentId, date) => attendance.find((r) => sameId(r.studentId, studentId) && r.date === date);
const latestRecord = (studentId) =>
  attendance.filter((r) => sameId(r.studentId, studentId)).sort((a, b) => b.date.localeCompare(a.date))[0];

function attendanceBadge(record) {
  if (!record) return '<span class="badge badge--none">No record</span>';
  return `<span class="badge badge--${record.status.toLowerCase()}">${esc(record.status)}</span><span class="stu-att-date">${esc(record.date)}</span>`;
}

/* ---------- rendering ---------- */
function fillCourseSelects() {
  const options = courses.map((c) => `<option value="${esc(c.id)}">${esc(c.code)} - ${esc(c.name)}</option>`).join('');
  $('stu-filter-course').innerHTML = `<option value="">All courses</option>${options}`;
  $('stu-course').innerHTML = options;
}

/** Students matching the course / status / search filters (before the date filter). */
function baseStudents() {
  const q = filters.query.trim().toLowerCase();
  return students.filter((s) =>
    (!filters.courseId || sameId(s.courseId, filters.courseId)) &&
    (!filters.status || s.status === filters.status) &&
    (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)));
}

function render() {
  const base = baseStudents();
  let rows = base.map((s) => ({ s, record: filters.date ? recordOn(s.id, filters.date) : latestRecord(s.id) }));

  if (filters.date) rows = rows.filter((r) => r.record);                       // only students recorded on that date
  if (filters.attendance) rows = rows.filter((r) => r.record?.status === filters.attendance);

  $('stu-clear-date').hidden = !filters.date;
  renderSummary(base, rows);

  const codeOf = (id) => courses.find((c) => sameId(c.id, id))?.code ?? '—';
  $('stu-empty').hidden = rows.length > 0;
  $('stu-empty').textContent = filters.date ? `No attendance records found for ${filters.date}.` : 'No students found. Use “Add student” to create one.';
  $('stu-tbody').innerHTML = rows.map(({ s, record }) => `
    <tr>
      <td><div class="stu-person"><span class="stu-avatar">${esc(s.name.charAt(0))}</span>
        <div><div class="stu-name">${esc(s.name)}</div><div class="stu-email">${esc(s.email)}</div></div></div></td>
      <td class="stu-code">${esc(codeOf(s.courseId))}</td>
      <td class="stu-num">${esc(s.grade)}%</td>
      <td>${attendanceBadge(record)}</td>
      <td class="stu-num">${esc(s.attendanceRate)}%</td>
      <td><span class="badge badge--${esc(s.status.toLowerCase().replace(' ', '-'))}">${esc(s.status)}</span></td>
      <td class="right">
        <button class="link-btn" data-action="edit" data-id="${esc(s.id)}">Edit</button>
        <button class="link-btn link-btn--danger" data-action="delete" data-id="${esc(s.id)}">Delete</button>
      </td>
    </tr>`).join('');
}

function renderSummary(base, rows) {
  const box = $('stu-summary');
  if (!filters.date) { box.hidden = true; return; }
  const dayRecords = base.map((s) => recordOn(s.id, filters.date)).filter(Boolean);
  const present = dayRecords.filter((r) => r.status === ATTENDANCE.PRESENT).length;
  const absent = dayRecords.length - present;
  box.innerHTML = `<strong>${esc(filters.date)}</strong> — ${present} present, ${absent} absent, ${base.length - dayRecords.length} not recorded · showing ${rows.length}`;
  box.hidden = false;
}

/* ---------- dialog ---------- */
function openDialog(student) {
  $('stu-form').reset();
  showAlert($('stu-form-error'), '');
  $('stu-dialog-title').textContent = student ? 'Edit student' : 'Add student';
  $('stu-id').value = student?.id ?? '';
  $('stu-date').value = filters.date || today();
  if (student) {
    $('stu-name').value = student.name;
    $('stu-email').value = student.email;
    $('stu-course').value = student.courseId;
    $('stu-grade').value = student.grade;
    $('stu-status').value = student.status;
    syncAttendanceFromDate();
  } else if (filters.courseId) {
    $('stu-course').value = filters.courseId;
  }
  $('stu-dialog').showModal();
}
const closeDialog = () => $('stu-dialog').close();

/** When editing, picking a date pre-selects whatever was already recorded for that day. */
function syncAttendanceFromDate() {
  const id = $('stu-id').value;
  if (!id) return;
  const record = recordOn(id, $('stu-date').value);
  $('stu-attendance').value = record ? record.status : ATTENDANCE.PRESENT;
}

async function onSubmit(event) {
  event.preventDefault();
  const form = $('stu-form');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const data = {
    name: $('stu-name').value.trim(),
    email: $('stu-email').value.trim(),
    courseId: $('stu-course').value,
    grade: $('stu-grade').value,
    status: $('stu-status').value,
  };
  try {
    let id = $('stu-id').value;
    if (id) await updateStudent(id, data);
    else id = (await addStudent({ ...data, attendanceRate: 0 })).id;
    await recordAttendance({ studentId: id, date: $('stu-date').value, status: $('stu-attendance').value });
    closeDialog();
    await reload();
  } catch (err) {
    showAlert($('stu-form-error'), err.message);
  }
}

async function onTableClick(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const student = students.find((s) => sameId(s.id, btn.dataset.id));
  if (!student) return;
  if (btn.dataset.action === 'edit') return openDialog(student);
  if (confirm(`Delete ${student.name}?`)) {
    try { await deleteStudent(student.id); await reload(); } catch (err) { showAlert($('stu-alert'), err.message); }
  }
}

/* ---------- events ---------- */
$('stu-add-btn').addEventListener('click', () => openDialog());
$('stu-close').addEventListener('click', closeDialog);
$('stu-cancel').addEventListener('click', closeDialog);
$('stu-form').addEventListener('submit', onSubmit);
$('stu-date').addEventListener('change', syncAttendanceFromDate);
$('stu-tbody').addEventListener('click', onTableClick);
$('stu-filter-course').addEventListener('change', (e) => { filters.courseId = e.target.value; render(); });
$('stu-filter-status').addEventListener('change', (e) => { filters.status = e.target.value; render(); });
$('stu-filter-date').addEventListener('change', (e) => { filters.date = e.target.value; render(); });
$('stu-filter-attendance').addEventListener('change', (e) => { filters.attendance = e.target.value; render(); });
$('stu-clear-date').addEventListener('click', () => { filters.date = ''; $('stu-filter-date').value = ''; render(); });
$('stu-search').addEventListener('input', (e) => { filters.query = e.target.value; render(); });
// The shared header search (layout.js) broadcasts this event.
window.addEventListener('gradify:search', (e) => {
  filters.query = e.detail?.query ?? '';
  $('stu-search').value = filters.query;
  render();
});

init();

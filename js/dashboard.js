// dashboard.js — Dashboard page. All data comes from apiservice.js (getDashboardData).
import { getDashboardData, STATUS } from './apiservice.js';
import { getSessionUser, showToast } from './layout.js';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const courseFilter = $('course-filter');
const studentTabs = document.querySelectorAll('.student-tab');

const GRADE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#f97316', '#ef4444']; // A B C D F
const TAB_STATUS = { all: null, active: STATUS.ACTIVE, risk: STATUS.AT_RISK, archived: STATUS.ARCHIVED };

let data = null;          // last response of getDashboardData()
let chart = null;         // Chart.js instance (destroyed before every redraw)
let activeTab = 'all';

/* ---------- heading ---------- */
function renderHeading() {
  const name = getSessionUser()?.name || 'Instructor';
  $('page-welcome').textContent = `Welcome back, ${name}`;
  $('dashboard-term').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/* ---------- stat cards ---------- */
function renderStats(stats) {
  $('average-attendance-value').textContent = `${stats.avgAttendance}%`;
  $('pending-tasks-value').textContent = stats.pendingTasks;
  $('total-enrolled-value').textContent = stats.totalStudents;
}

/* ---------- grade chart ---------- */
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function renderChart(distribution) {
  const canvas = $('grade-distribution-chart');
  if (typeof Chart === 'undefined') {            // the Chart.js CDN script did not load (offline?)
    canvas.insertAdjacentHTML('afterend', '<p class="section-description">The chart could not be loaded. Check your internet connection.</p>');
    canvas.hidden = true;
    return;
  }
  if (chart) chart.destroy();
  const text = cssVar('--muted', '#6b7488');
  const grid = cssVar('--border', '#dfe3ec');
  chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: distribution.labels,
      datasets: [{
        label: 'Students',
        data: distribution.counts,
        backgroundColor: GRADE_COLORS,
        borderRadius: { topLeft: 20, topRight: 20 },
        maxBarThickness: 65,
      }],
    },
    options: {
      animations: { y: { from: 0, duration: 1200, easing: 'easeOutQuart' } },
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: text }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, color: text }, grid: { color: grid } },
      },
    },
  });
}

/* ---------- active tasks ---------- */
function renderTasks(tasks) {
  const list = $('active-tasks-list');
  if (!tasks.length) {
    list.innerHTML = '<p class="section-description">No active tasks for this selection.</p>';
    return;
  }
  list.innerHTML = tasks.map((task) => {
    const progress = Math.max(0, Math.min(100, Number(task.progress) || 0));
    const course = task.courseCode ? `${task.courseCode} - ${task.courseName}` : '-';
    return `
      <article class="task-card">
        <div class="task-top">
          <span class="task-course">${esc(course)}</span>
          <span class="task-due">${esc(task.dueDate)}</span>
        </div>
        <h3 class="task-title">${esc(task.title)}</h3>
        <div class="task-progress-text">
          <span>Submission Progress</span>
          <strong>${progress}%</strong>
        </div>
        <div class="progress"><div class="progress-fill" style="width: ${progress}%"></div></div>
        <p class="task-pending">${esc(task.pendingGrading ?? 0)} awaiting for grading</p>
      </article>`;
  }).join('');
}

/* ---------- students table + tabs ---------- */
function renderStudents() {
  const status = TAB_STATUS[activeTab];
  const students = status ? data.students.filter((s) => s.status === status) : data.students;
  const codeOf = new Map(data.courses.map((c) => [String(c.id), c.code]));     // ids are strings, courseId is a number

  const body = $('students-table-body');
  if (!students.length) {
    body.innerHTML = '<tr><td colspan="5">No students in this view.</td></tr>';
    return;
  }
  body.innerHTML = students.map((s) => {
    const cls = s.status === STATUS.ACTIVE ? 'status-active' : s.status === STATUS.AT_RISK ? 'status-risk' : 'status-archived';
    return `
      <tr>
        <td>${esc(s.name)}</td>
        <td>${esc(codeOf.get(String(s.courseId)) ?? '-')}</td>
        <td>${esc(s.grade)}%</td>
        <td>${esc(s.attendanceRate)}%</td>
        <td><span class="status ${cls}">${esc(s.status)}</span></td>
      </tr>`;
  }).join('');
}

function renderTabCounts() {
  $('all-students-count').textContent = data.students.length;
  $('active-students-count').textContent = data.statusCounts[STATUS.ACTIVE];
  $('risk-students-count').textContent = data.statusCounts[STATUS.AT_RISK];
  $('archived-students-count').textContent = data.statusCounts[STATUS.ARCHIVED];
}

function fillCourseFilter(courses) {
  const selected = courseFilter.value;
  courseFilter.innerHTML = '<option value="">All Courses</option>' +
    courses.map((c) => `<option value="${esc(c.id)}">${esc(c.code)} - ${esc(c.name)}</option>`).join('');
  courseFilter.value = selected;
}

/* ---------- load + events ---------- */
async function load() {
  try {
    data = await getDashboardData({ courseId: courseFilter.value });   // the course filter now affects everything
    fillCourseFilter(data.courses);
    renderStats(data.stats);
    renderChart(data.gradeDistribution);
    renderTasks(data.activeTasks);
    renderTabCounts();
    renderStudents();
  } catch (err) {
    showToast(err.message);
  }
}

courseFilter.addEventListener('change', load);

studentTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    studentTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.status;
    if (data) renderStudents();
  });
});

// redraw the chart with the right text colors after a light/dark switch
window.addEventListener('gradify:theme', () => { if (data) renderChart(data.gradeDistribution); });

renderHeading();
load();
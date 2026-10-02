// tasks.js — Assignments page. All data comes from apiservice.js.
import { getCourses, addTask, deleteTask, getTasks } from './apiservice.js';
import { showToast } from './layout.js';

const $ = (id) => document.getElementById(id);
const title = $('title');
const description = $('description');
const dueDate = $('dueDate');
const courseId = $('courseId');
const fileInput = $('file');
const pubBtn = $('publish-btn');
const tasksCards = $('task-cards');

let courses = [];

async function loadCourses() {
  try {
    courses = await getCourses();
    courseId.innerHTML = '';
    courses.forEach((course) => {
      const option = document.createElement('option');
      option.value = course.id;
      option.textContent = `${course.code} - ${course.name}`;
      courseId.appendChild(option);
    });
  } catch (err) {
    showToast(err.message);
  }
}

const courseLabel = (id) => {
  const course = courses.find((c) => String(c.id) === String(id));
  return course ? course.code : '-';
};

pubBtn.addEventListener('click', async (event) => {
  event.preventDefault();
  const task = {
    title: title.value.trim(),
    description: description.value.trim(),
    dueDate: dueDate.value,
    courseId: courseId.value,
  };
  if (!task.title || !task.description || !task.dueDate || !task.courseId) {
    showToast('Fill all fields');
    return;
  }
  // json-server cannot store files, so only the file name is saved with the assignment
  if (fileInput.files.length) task.fileName = fileInput.files[0].name;

  pubBtn.disabled = true;
  try {
    await addTask(task);
    title.value = '';
    description.value = '';
    dueDate.value = '';
    fileInput.value = '';
    showToast('Assignment published');
    await renderTasks();
  } catch (err) {
    showToast(err.message);
  } finally {
    pubBtn.disabled = false;
  }
});

async function renderTasks() {
  let allTasks = [];
  try {
    allTasks = await getTasks();
  } catch (err) {
    showToast(err.message);
    return;
  }
  tasksCards.innerHTML = '';
  if (!allTasks.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No assignments yet. Publish the first one using the form.';
    tasksCards.appendChild(empty);
    return;
  }
  for (const task of allTasks) {
    const card = document.createElement('div');
    const container = document.createElement('div');
    const heading = document.createElement('p');
    const details = document.createElement('p');
    const meta = document.createElement('p');
    const btn = document.createElement('button');

    heading.textContent = `${task.title} - ${task.dueDate}`;
    details.textContent = task.description;
    meta.textContent = `Course: ${courseLabel(task.courseId)}` + (task.fileName ? `, file: ${task.fileName}` : '');
    btn.textContent = 'delete';
    btn.type = 'button';

    card.classList.add('task-item');
    container.classList.add('task-card-container');
    btn.classList.add('delete');

    btn.addEventListener('click', async () => {
      if (!confirm(`Delete "${task.title}"?`)) return;
      try {
        await deleteTask(task.id);
        await renderTasks();
      } catch (err) {
        showToast(err.message);
      }
    });

    container.append(heading, details, meta);
    card.append(container, btn);
    tasksCards.appendChild(card);
  }
}

await loadCourses();     // courses first so the course code shows in the list
renderTasks();
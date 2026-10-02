import{getCourses, addTask, deleteTask, getTasks, requireInstructor} from '../js/apiservice.js';

// Redirects to login.html when nobody is logged in.
// getCourses/getTasks/addTask/deleteTask only work on the current instructor's data.
requireInstructor();
const title = document.getElementById("title");
const description = document.getElementById("description");
const dueDate = document.getElementById("dueDate");
const courseId = document.getElementById("courseId");
const pubBtn = document.getElementById("publish-btn");
const tasksCards = document.getElementById("task-cards");

requireInstructor();

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

pubBtn.addEventListener("click", async function(event){
    event.preventDefault();
    const titleV= title.value.trim();
    const descriptionV= description.value.trim();
    const dueDateV =dueDate.value;
    const courseIdV= courseId.value;
    if(titleV === "" || descriptionV ==="" || dueDateV === "" || courseIdV === ""){
        alert("Fill all fields");
        return;
    }
    try {
        await addTask({ title: titleV, description: descriptionV, dueDate: dueDateV, courseId: courseIdV });
    } catch (error) {
        alert(error.message);
        return;
    }

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

    const allTasks= await getTasks();
    const courses= await getCourses();
    tasksCards.innerHTML="";
    for(const task of allTasks){
        const card= document.createElement("div");
        const container = document.createElement("div");
        const title = document.createElement("p");
        const btn= document.createElement("button");
        const p = document.createElement("p");
        const span =document.createElement("span");
        title.appendChild(span);
        title.textContent = `${task.title} - ${task.dueDate}`;
        p.textContent = task.description;
        btn.textContent = "delete";
        card.classList.add("task-item");
        container.classList.add("task-card-container");
        btn.classList.add("delete");
        btn.addEventListener("click", async function () {
            try {
                await deleteTask(task.id);
            } catch (error) {
                alert(error.message);
            }
            renderTasks();
        })
        card.appendChild(container);
        card.appendChild(btn);
        container.appendChild(title);
        container.appendChild(p);
        tasksCards.appendChild(card);
    }
}
renderTasks();
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

async function loadCourses() {
    const course= await getCourses();    
    return course;
}
async function courseList() {
    courseId.innerHTML="";
    const courses= await loadCourses();
    for(const course of courses){
        const option=document.createElement("option");
        option.value=course.id;
        option.textContent=`${course.code} - ${course.name}`;
        courseId.appendChild(option);
    }
}
courseList();

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

    title.value="";
    description.value="";
    dueDate.value="";
    renderTasks();
})

async function renderTasks() {

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


import{getCourses, addTask} from './apiservice.js';
const title = document.getElementById("title");
const description = document.getElementById("description");
const dueDate = document.getElementById("dueDate");
const courseId = document.getElementById("courseId");
const pubBtn = document.getElementById("publish-btn");
const tasksList = document.getElementById("task-list");

async function loadCourses() {
    const course= await getCourses();    
    return course;
}
async function courseList() {
    courseId.innerHTML="";
    const cources= await loadCourses();
    for(const course of cources){
        const option=document.createElement("option");
        option.value=course.id;
        option.textContent=`${course.code} - ${course.name}`;
        courseId.appendChild(option);
    }
}
courseList();

pubBtn.addEventListener("click", async function(event){
    event.preventDefault();
    // if (title.value.trim() ===""){return;}
    // const tasks = await addTask(title, description, dueDate, courseId);
    // for(const task of tasks){
    //     const div= document.createElement("div");
    //     const h2= document.createElement("h2");
    //     const p= document.createElement("p");
    //     const button= document.createElement("button");
    //     const container = document.createElement("div");
    //     task.title=title.value.trim();
    //     task.description=description.value.trim();
    //     task.dueDate=dueDate.value;
    //     task.courseId=courseId.value;
    //     h2.textContent = task.title +" "+ task.dueDate;
    //     p.textContent = task.description;
    //     button.textContent = "delete";
    //     h2.classList.add(".taskV");
    //     div.classList.add(".taskC");
    //     p.classList.add(".taskP");
    //     button.classList.add(".delete")
    //     container.appendChild(h2);
    //     container.appendChild(p);
    //     div.appendChild(container);
    //     div.appendChild(button);
    // }
    const titleV= title.value.trim();
    const descriptionV= description.value.trim();
    const dueDateV =dueDate.value;
    const courseIdV= courseId.value;
    if(titleV === "" || descriptionV ==="" || dueDateV === "" || courseIdV === ""){
        alert("Fill all fields");
        return;
    }
    await addTask(titleV, descriptionV, dueDateV, courseIdV);
    courseId.value="";
    dueDate.value="";
    titleV.value="";
    descriptionV.value="";
})


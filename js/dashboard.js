import { getDashboardData, STATUS } from './apiservice.js'

const pageWelcome = document.getElementById("page-welcome");

const dashboardTerm = document.getElementById("dashboard-term");

const courseFilter = document.getElementById("course-filter");

const averageAttendanceValue =
    document.getElementById("average-attendance-value");

const pendingTasksValue =
    document.getElementById("pending-tasks-value");

const totalEnrolledValue =
    document.getElementById("total-enrolled-value");

const gradeDistributionChart =
    document.getElementById("grade-distribution-chart");

const activeTasksList =
    document.getElementById("active-tasks-list");

const studentsTableBody =
    document.getElementById("students-table-body");

const studentTabs = document.querySelectorAll(".student-tab");

const allStudentsCount = document.getElementById("all-students-count");
const activeStudentsCount = document.getElementById("active-students-count");
const riskStudentsCount = document.getElementById("risk-students-count");
const archivedStudentsCount = document.getElementById("archived-students-count");

let allStudents = [];
let allCourses = [];
let allTasks = [];



async function loadDashboard() {

    const data = await getDashboardData();
    
    
    console.log("renderStudents called");
    console.log("DATA:", data);
    console.log("STUDENTS:", data.students);
    console.log("STUDENTS LENGTH:", data.students?.length);
    console.log("TABLE:", studentsTableBody);


    new Chart(gradeDistributionChart, {
        type: "bar",

        data: {
            labels: data.gradeDistribution.labels,

            datasets: [{
                label: "student",
                data: data.gradeDistribution.counts,
                backgroundColor:
                    ["#22c55e", // A
                    "#3b82f6", // B
                    "#f59e0b", // C
                    "#f97316", // D
                    "#ef4444"]
                    ,
                borderRadius: {
                    topLeft: 20,
                    topRight: 20,
                },
                barThickness: 65,
            }]

        }, 

        options: {
    animations: {
        y: {
            from: 0,
            duration: 1200,
            easing: "easeOutQuart"
        }
    },

    responsive: true,
    maintainAspectRatio: false
}
        
    })

    averageAttendanceValue.textContent = `${data.stats.avgAttendance}%`;
    pendingTasksValue.textContent = data.stats.pendingTasks;
    totalEnrolledValue.textContent = data.stats.totalStudents;    
    
//     data.activeTasks.forEach(task => {

//     activeTasksList.innerHTML += `
//         <article class="task-card">

//             <div class="task-top">
//                 <span class="task-course">${task.courseCode}</span>
//                 <span class="task-due">${task.dueDate}</span>
//             </div>

//             <h3 class="task-title">
//                 ${task.title}
//             </h3>

//             <div class="task-progress-text">
//                 <span>Submission Progress</span>
//                 <strong>${task.progress}%</strong>
//             </div>

//             <div class="progress">
//                 <div
//                     class="progress-fill"
//                     style="width: ${task.progress}%"
//                 ></div>
//             </div>

//             <p class="task-pending">
//                 ${task.pendingGrading} awaiting for grading
//             </p>

//         </article>
//     `;

    
// });

allStudents = data.students;
allCourses = data.courses;
allTasks = data.tasks;

renderCourseFilter(data.courses);
renderTasks(data.tasks);

renderStudents(data.students, data.courses);

allStudentsCount.textContent = allStudents.length;

activeStudentsCount.textContent = allStudents.filter(student => student.status === STATUS.ACTIVE).length;

riskStudentsCount.textContent = allStudents.filter(student => student.status === STATUS.AT_RISK).length;

archivedStudentsCount.textContent = allStudents.filter(student => student.status === STATUS.ARCHIVED).length;

}



function renderStudents(students, courses) {

    studentsTableBody.innerHTML = "";

    students.forEach(student => {

        const course = courses.find(
            course => course.id === student.courseId
        );

        studentsTableBody.innerHTML += `
            <tr>
                <td>${student.name}</td>
                <td>${course ? course.code : "-"}</td>
                <td>${student.grade}%</td>
                <td>${student.attendanceRate}%</td>
                <td>
                 <span class="status ${
                    student.status === "Active"
                        ? "status-active"
                        : student.status === "At risk"
                        ? "status-risk"
                        : "status-archived"
                        }">
                    ${student.status}
                </span>
                </td>
            </tr>
        `;
    });
}

function renderTasks(tasks) {

    activeTasksList.innerHTML = "";

    tasks.forEach(task => {

        const course = allCourses.find(
            course => Number(course.id) === Number(task.courseId)
        );
         console.log("TASK:", task);
        console.log("COURSE:", course);

        activeTasksList.innerHTML += `
            <article class="task-card">

                <div class="task-top">
                    <span class="task-course">
                    ${course ? `${course.code} - ${course.name}` : "-"}
                </span>

                    <span class="task-due">
                        ${task.dueDate}
                    </span>
                </div>

                <h3 class="task-title">
                    ${task.title}
                </h3>

                <div class="task-progress-text">
                    <span>Submission Progress</span>

                    <strong>
                        ${task.progress}%
                    </strong>
                </div>

                <div class="progress">
                    <div
                        class="progress-fill"
                        style="width: ${task.progress}%"
                    ></div>
                </div>

                <p class="task-pending">
                    ${task.pendingGrading} awaiting for grading
                </p>

            </article>
        `;
    });
}

function renderCourseFilter(courses) {

    courseFilter.innerHTML = `
        <option value="">All Courses</option>
    `;

    courses.forEach(course => {

        courseFilter.innerHTML += `
            <option value="${course.id}">
                ${course.code} - ${course.name}
            </option>
        `;

    });
}

courseFilter.addEventListener("change", () => {

    const selectedCourseId = courseFilter.value;

    let filteredTasks;

    if (selectedCourseId === "") {

        filteredTasks = allTasks;

    } else {

        filteredTasks = allTasks.filter(
            task => task.courseId === Number(selectedCourseId)
        );

    }

    renderTasks(filteredTasks);
});

studentTabs.forEach(tab => {

    tab.addEventListener("click", () => {

        studentTabs.forEach(item => {
            item.classList.remove("active");
        });

        tab.classList.add("active");

        const status = tab.dataset.status;

        let filteredStudents;

        if (status === "all") {

            filteredStudents = allStudents;

        } else if (status === "active") {

            filteredStudents = allStudents.filter(
                student => student.status === STATUS.ACTIVE
            );

        } else if (status === "risk") {

            filteredStudents = allStudents.filter(
                student => student.status === STATUS.AT_RISK
            );

        } else if (status === "archived") {

            filteredStudents = allStudents.filter(
                student => student.status === STATUS.ARCHIVED
            );
        }

        renderStudents(filteredStudents, allCourses);
    });

});




loadDashboard();

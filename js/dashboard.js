import { getDashboardData, STATUS } from '../apiservice.js'

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
    
    data.activeTasks.forEach(task => {

    activeTasksList.innerHTML += `
        <article class="task-card">

            <div class="task-top">
                <span class="task-course">${task.courseCode}</span>
                <span class="task-due">${task.dueDate}</span>
            </div>

            <h3 class="task-title">
                ${task.title}
            </h3>

            <div class="task-progress-text">
                <span>Submission Progress</span>
                <strong>${task.progress}%</strong>
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

renderStudents(data.students, data.courses);

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
                    <span class="status-tag">
                        ${student.status}
                    </span>
                </td>
            </tr>
        `;
    });
}

loadDashboard();

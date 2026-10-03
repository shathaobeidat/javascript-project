import { getDashboardData, requireInstructor, STATUS } from './apiservice.js';


const signedIn = (() => {
    try {
        requireInstructor();
        return true;
    } catch {
        return false;
    }
})();

// A task is pending until its submission progress reaches 100%.
const isPending = (task) => Number(task.progress || 0) < 100;

// Ids can be numbers (old data) or strings (new data): compare as strings.
const sameId = (a, b) => String(a) === String(b);

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
let gradeChart = null;


const escapeHtml = (text) =>
    String(text ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));


/* =========================
   LOAD
========================= */

async function loadDashboard() {

    try {

        const data = await getDashboardData();

        renderCourseFilter(data.courses);
        updateDashboard(data);

    } catch (error) {

        console.error("Failed to load the dashboard:", error);

    }
}


/* Fills every part of the page from one getDashboardData() result. */
function updateDashboard(data) {

    averageAttendanceValue.textContent = `${data.stats.avgAttendance}%`;
    // "Pending" = tasks that are not finished yet (progress below 100%).
    pendingTasksValue.textContent = data.tasks.filter(isPending).length;
    totalEnrolledValue.textContent = data.stats.totalStudents;

    allStudents = data.students;
    allCourses = data.courses;
    allTasks = data.tasks;

    renderTasks(data.tasks);
    renderStudents(studentsForActiveTab(), allCourses);

    allStudentsCount.textContent = allStudents.length;

    activeStudentsCount.textContent =
        allStudents.filter(student => student.status === STATUS.ACTIVE).length;

    riskStudentsCount.textContent =
        allStudents.filter(student => student.status === STATUS.AT_RISK).length;

    archivedStudentsCount.textContent =
        allStudents.filter(student => student.status === STATUS.ARCHIVED).length;

    renderChart(data.gradeDistribution);
}


function renderChart(gradeDistribution) {

    // A canvas can only hold one chart: destroy the old one first.
    if (gradeChart) {
        gradeChart.destroy();
    }

    gradeChart = new Chart(gradeDistributionChart, {
        type: "bar",

        data: {
            labels: gradeDistribution.labels,

            datasets: [{
                label: "student",
                data: gradeDistribution.counts,
                backgroundColor: [
                    "#22c55e", // A
                    "#3b82f6", // B
                    "#f59e0b", // C
                    "#f97316", // D
                    "#ef4444"  // F
                ],
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
    });
}


/* =========================
   STUDENTS
========================= */

function studentsForActiveTab() {

    const activeTab = document.querySelector(".student-tab.active");
    const status = activeTab ? activeTab.dataset.status : "all";

    if (status === "active") {
        return allStudents.filter(student => student.status === STATUS.ACTIVE);
    }

    if (status === "risk") {
        return allStudents.filter(student => student.status === STATUS.AT_RISK);
    }

    if (status === "archived") {
        return allStudents.filter(student => student.status === STATUS.ARCHIVED);
    }

    return allStudents;
}


function renderStudents(students, courses) {

    studentsTableBody.innerHTML = students.map(student => {

        const course = courses.find(
            course => sameId(course.id, student.courseId)
        );

        const statusClass =
            student.status === STATUS.ACTIVE
                ? "status-active"
                : student.status === STATUS.AT_RISK
                    ? "status-risk"
                    : "status-archived";

        return `
            <tr>
                <td>${escapeHtml(student.name)}</td>
                <td>${course ? escapeHtml(`${course.code} - ${course.name}`) : "-"}</td>
                <td>${student.grade}%</td>
                <td>${student.attendanceRate}%</td>
                <td>
                    <span class="status ${statusClass}">
                        ${escapeHtml(student.status)}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}


/* =========================
   TASKS
========================= */

function renderTasks(tasks) {

    activeTasksList.innerHTML = tasks.map(task => {

        const course = allCourses.find(
            course => sameId(course.id, task.courseId)
        );

        return `
            <article class="task-card">

                <div class="task-top">
                    <span class="task-course">
                        ${course ? escapeHtml(`${course.code} - ${course.name}`) : "-"}
                    </span>

                    <span class="task-due">
                        ${escapeHtml(task.dueDate)}
                    </span>
                </div>

                <h3 class="task-title">
                    ${escapeHtml(task.title)}
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

            </article>
        `;
    }).join("");
}


/* =========================
   COURSE FILTER
========================= */

function renderCourseFilter(courses) {

    courseFilter.innerHTML =
        `<option value="">All Courses</option>` +
        courses.map(course => `
            <option value="${escapeHtml(course.id)}">
                ${escapeHtml(course.code)} - ${escapeHtml(course.name)}
            </option>
        `).join("");
}


courseFilter.addEventListener("change", async () => {

    try {

        const data = await getDashboardData({
            courseId: courseFilter.value || undefined
        });

        updateDashboard(data);

    } catch (error) {

        console.error("Failed to change course:", error);

    }
});


studentTabs.forEach(tab => {

    tab.addEventListener("click", () => {

        studentTabs.forEach(item => item.classList.remove("active"));

        tab.classList.add("active");

        renderStudents(studentsForActiveTab(), allCourses);
    });

});


if (signedIn) {
    loadDashboard();
}
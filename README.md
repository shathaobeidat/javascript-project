# Gradify

Gradify is an instructor portal for following courses, students, attendance and assignments in one place. It is built with plain **HTML, CSS and JavaScript** (ES modules) and uses **json-server** as a mock REST API.

> Educational project. Authentication and data protection are handled in the browser, so it is not meant for production use (see [Limitations](#limitations)).

---

## Features

- **Sign up and log in** for instructors, with a live password checklist (8+ characters, one uppercase letter, one lowercase letter, one number).
- **Dashboard** with summary stats, a grade distribution chart (Chart.js), course summaries, active assignments, and a course filter.
- **Students**: add, edit and delete students; filter by course, status and attendance; record attendance (Present / Absent) per date. The attendance rate is recalculated automatically.
- **Assignments**: publish assignments to a course with a title, description and deadline.
- **Courses**: add and delete courses (course codes must be unique).
- **Private data per instructor**: every record stores the `instructorId` of its owner, and each instructor sees only their own courses, students, tasks and attendance.
- **Light / dark theme** that remembers the user's choice.
- **Responsive layout**: full sidebar on desktop, slide-in drawer on small screens.

---

## Tech stack

| Part | Technology |
|---|---|
| Front end | HTML5, CSS3, JavaScript (ES modules) |
| Charts | [Chart.js](https://www.chartjs.org/) (loaded from a CDN) |
| Mock API | [json-server](https://github.com/typicode/json-server) `1.0.0-beta.15` |
| Data | `json-package/db.json` |
| Session | `localStorage` |

---

## Project structure

```
javascript-project/
├── html/
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html
│   ├── students.html
│   ├── tasks.html          # Assignments
│   ├── addcourse.html
│   └── layout.html         # Layout template (sidebar + header)
├── css/
│   ├── theme.css           # Colors and design tokens (light + dark)
│   ├── layout.css          # Sidebar, header, responsive rules
│   └── <page>.css          # One stylesheet per page
├── js/
│   ├── apiservice.js       # Every request to json-server + ownership checks
│   ├── layout.js           # Sidebar, header, theme, session helpers, toast
│   ├── login.js
│   ├── signup.js
│   ├── dashboard.js
│   ├── students.js
│   ├── tasks.js
│   └── addcourse.js
├── assets/
│   └── logo.jpeg
└── json-package/
    ├── db.json             # Mock database
    └── package.json        # json-server dependency
```

---

## Getting started

### Requirements

- [Node.js](https://nodejs.org) (LTS)
- VS Code with the **Live Server** extension. The app uses ES modules, so it must be served over HTTP; opening the files by double-clicking will not work.

### 1. Start the API

```bash
cd json-package
npm install
npx json-server db.json --port 3000
```

Keep this terminal open. The front end expects the API at `http://localhost:3000` (set by `BASE_URL` at the top of `js/apiservice.js`).

> **Windows PowerShell error** (`running scripts is disabled`)? Use Command Prompt, or run `npx.cmd json-server db.json --port 3000`.

### 2. Start the front end

Right-click `html/login.html` in VS Code and choose **Open with Live Server**.

### 3. Create an account

Open **Sign up**, create an instructor account, then log in. You will land on the dashboard.

---

## Data model (`db.json`)

| Collection | Fields |
|---|---|
| `users` | `id, name, email, password, role` |
| `courses` | `id, name, code, instructorId` |
| `students` | `id, name, email, courseId, status, grade, attendanceRate, instructorId` |
| `tasks` | `id, title, description, dueDate, courseId, progress, pendingGrading, instructorId` |
| `attendance` | `id, studentId, date, status, instructorId` |

- Student status is one of `Active`, `At risk`, `Archived`.
- Attendance status is `Present` or `Absent`.
- Relations: `students.courseId` and `tasks.courseId` point to `courses.id`; `attendance.studentId` points to `students.id`.
- **All IDs are strings.** json-server 1.x generates random string IDs (for example `MAM59QlX_2U`) and ignores any `id` sent by the client. Always compare IDs as strings.

---

## API service (`js/apiservice.js`)

Pages never call `fetch` directly; they import from `apiservice.js`.

```js
import { getStudents, getCourses, STATUS } from './apiservice.js';
```

| Area | Functions |
|---|---|
| Auth | `loginUser(email, password)`, `registerUser(data)` |
| Courses | `getCourses()`, `addCourse(data)`, `updateCourse(id, data)`, `deleteCourse(id)` |
| Students | `getStudents(filters)`, `addStudent(data)`, `updateStudent(id, data)`, `deleteStudent(id)` |
| Attendance | `getAttendance(filters)`, `recordAttendance({ studentId, date, status })`, `updateAttendanceRecord(...)`, `deleteAttendanceRecord(id)`, `calculateAttendanceRate(records, studentId)` |
| Tasks | `getTasks()`, `getTasksByCourse(courseId)`, `addTask(data)`, `updateTask(id, data)`, `deleteTask(id)` |
| Dashboard | `getDashboardData({ courseId })` |
| Constants | `STATUS`, `ATTENDANCE`, `BASE_URL` |

How ownership works:

- `requireInstructor()` reads the logged-in user from the session. If nobody is logged in, it redirects to `login.html`.
- Reads are filtered by `instructorId`, and writes to existing records check that the record belongs to the current user. Otherwise an `Access denied` error is thrown.
- Queries use json-server's `_where` filter instead of `?instructorId=...`, because a plain query string is converted to a number and would not match string IDs.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot reach the API ... Is json-server running?` | Start json-server (step 1) and make sure it runs on port `3000`. |
| Blank page or `Failed to load module script` | Open the page through Live Server, not by double-clicking the file. |
| Redirected to the login page on every page | You are not logged in, or the session was cleared. Log in again. |
| Old account still appears logged in | Sign out from the avatar menu, or run `localStorage.clear()` in the browser console. |
| Live Server keeps reloading after every action | Add `{ "liveServer.settings.ignoreFiles": ["**/db.json"] }` to `.vscode/settings.json`. |
| Chart does not appear | The page loads Chart.js from a CDN, so check your internet connection. |

---

## Limitations

- The access checks run in the browser. Anyone who calls the API directly (for example with `curl`) can read or change any data.
- Passwords are stored as plain text in `db.json`.
- The session lives in `localStorage` and is not signed or expiring.

For a real deployment, replace json-server with a backend (for example Express with a database), hash passwords, use JWT or server sessions, and filter data by user on the server.

---

## Team

shatha : students,add course 
abdullah : dashboard
omar :assignments
tala :layout
yousef :auth(login,signup)

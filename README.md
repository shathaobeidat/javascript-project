# javascript-project
# EduTrack

EduTrack is a web dashboard for instructors to follow their students, courses and tasks in one place. It is built with plain **HTML, CSS and JavaScript** (ES modules) and uses **json-server** as a mock REST API.

> Status: the shared layout (sidebar + header) is finished. Individual pages (Dashboard, Students, Analytics, Reports, Alerts) plug into it.

---

## Features

- **Sidebar navigation** with Dashboard, Students, Analytics, Reports and Alerts.
- **Live search** for students and courses (debounced, results grouped by type).
- **Notification badge** showing the number of students with the status *At risk*.
- **Avatar menu** with the logged-in user's name and role, plus *Support* and *Logout*.
- **Light / dark theme** toggle that remembers the user's choice.
- **Responsive layout**: full sidebar on desktop, icon-only sidebar on tablets and iPads, slide-in drawer on phones (CSS only).
- **Shared design system** (navy and gold, taken from the club logo) based on CSS variables.

---

## Tech stack

| Part | Technology |
|---|---|
| Front end | HTML5, CSS3, JavaScript (ES modules) |
| Icons | Font Awesome 6 (sidebar, search) and inline SVG |
| Mock API | [json-server](https://github.com/typicode/json-server) `0.17.4` |
| Data | `db.json` |

---

## Project structure

```
EduTrack/
├── index.html        # Page shell: sidebar + header + empty #page-content
├── theme.css         # ALL colors and design tokens (light + dark). Linked first
├── layout.css        # Sidebar, header, search, menus, responsive rules
├── theme.js          # Dark / light toggle (plain script, no imports)
├── layout.js         # Navigation, search, badge, avatar menu, logout (ES module)
├── session.js        # getSession / setSession / clearSession (localStorage)
├── api.js            # API service: every request to json-server
├── db.json           # Mock database
└── assest.jpeg       # Logo
```

---

## Getting started

### Requirements
- [Node.js](https://nodejs.org) (LTS)
- VS Code with the **Live Server** extension (the app uses ES modules, so it must be served over HTTP, not opened with a double click)

### 1. Start the API
In a terminal opened in the project folder:

```bash
npx json-server@0.17.4 --watch db.json --port 3000
```

Check it works by opening <http://localhost:3000/students>. You should see 16 students. Keep this terminal open.

> **Why version 0.17.4?** `api.js` uses the `?q=` full-text search, which json-server 1.x does not support.

> **Windows PowerShell error** (`running scripts is disabled`)? Use Command Prompt, or run `npx.cmd json-server@0.17.4 --watch db.json --port 3000`.

### 2. Start the front end
Right-click `index.html` in VS Code and choose **Open with Live Server**.

### 3. Log in (or fake a session while developing)
The app reads the logged-in user from `localStorage`. Until the login page exists, run this once in the browser console:

```js
localStorage.setItem('session', JSON.stringify({ id: 1, name: 'Dr. shatha', role: 'instructor' }))
```

To force a redirect to `login.html` when nobody is logged in, set `REQUIRE_LOGIN = true` at the top of `layout.js`.

---

## Demo accounts

These accounts come from `db.json` and are for local testing only.

| Name | Email | Password | Role |
|---|---|---|---|
| Dr. shatha | rana@university.edu | password123 | instructor |
| Dr. Ahmad | ahmad@university.edu | password123 | instructor |
| Dr. tala | admin@university.edu | admin123 | admin |

---

## Data model (`db.json`)

| Collection | Records | Fields |
|---|---|---|
| `users` | 3 | `id, name, email, password, role` |
| `courses` | 4 | `id, name, code` |
| `students` | 16 | `id, name, email, courseId, status, grade, attendanceRate` |
| `tasks` | 8 | `id, title, description, dueDate, courseId, progress, pendingGrading` |

Relations: `students.courseId` and `tasks.courseId` point to `courses.id`.
Student status is one of `Active`, `At risk`, `Archived`.

---

## API service (`api.js`)

Always import from `api.js` instead of calling `fetch` yourself.

```js
import { getStudents, getCourses, STATUS } from './api.js';
```

| Function | Description |
|---|---|
| `loginUser(email, password)` | Returns the user (without password) or `null` |
| `registerUser(data)` | Creates a user, fails if the email already exists |
| `getCourses()` | All courses |
| `addCourse(data)` | Adds a course, fails if the code already exists |
| `getStudents(filters)` | Students. Filters: `courseId`, `status`, `q`, `id` |
| `addStudent(data)` / `updateStudent(id, data)` / `deleteStudent(id)` | Student CRUD |
| `getTasks()` / `getTasksByCourse(courseId)` | Tasks |
| `addTask(data)` / `deleteTask(id)` | Task create and delete |
| `getDashboardData({ courseId })` | Stats, grade distribution, course summaries and active tasks in one call |
| `STATUS` | `{ ACTIVE, AT_RISK, ARCHIVED }`, use these instead of typing strings |

---

## Building a page (for teammates)

1. Make sure `index.html` is served and the layout is loaded. The sidebar and header are built for you.
2. Listen for page changes and draw your page inside `#page-content`:

```js
import { getStudents } from './api.js';

window.addEventListener('page-change', async (e) => {
  const { page, params } = e.detail;          // e.g. page = 'students', params = { courseId: 2 }
  if (page !== 'students') return;

  const box = document.getElementById('page-content');
  const students = await getStudents({ courseId: params.courseId });
  box.textContent = `${students.length} students`;
});
```

3. Helpers you can use: `navigate(page, params)`, `refreshBadge()` (call it after you change a student's status) and `showToast(message)`.

### Styling rules
- Link `theme.css` first, then `layout.css`, then your own CSS.
- **Never write colors by hand** (`#fff`, `#333`). Use the variables (`var(--surface)`, `var(--text)`, `var(--border)`, `var(--status-risk)` ...) so your page works in dark mode automatically.
- Wrap wide tables in `<div class="table-scroll">` so they scroll on phones.
- Use class names specific to your page to avoid clashing with `.badge`, `.menu`, `.result`, `.avatar`, `.page`.

---

## Responsive breakpoints

| Screen | Width | Behaviour |
|---|---|---|
| Desktop | 1025px and up | Full sidebar |
| Tablet / iPad | 721px to 1024px | Icon-only sidebar |
| Phone | up to 720px | Slide-in drawer opened with the ☰ button; search moves to its own row below 560px |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot reach the API ... Is json-server running?` | Start json-server (step 1) and check the port is `3000` |
| Blank page or `Failed to load module script` | Open the page through Live Server, not by double-clicking the file |
| Styles missing | Check the CSS order: `theme.css` before `layout.css` |
| Logo not showing | Make sure the image file name matches the `src` in `index.html` |
| Avatar shows `G` / name is *Guest* | No session yet, see "Log in" above |
| Live Server keeps reloading after edits | Add `{ "liveServer.settings.ignoreFiles": ["**/db.json"] }` to `.vscode/settings.json` |
| Font Awesome "Tracking Prevention" messages | Harmless browser notices. Download Font Awesome locally to remove them |

---

## Team

- Layout and header: _your name_
- Dashboard: _name_
- Students: _name_
- Analytics and Reports: _name_
- Alerts: _name_
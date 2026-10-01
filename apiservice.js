

export const BASE_URL = 'http://localhost:3000';
// console.log("test");

/** Shared constants — use these instead of typing the strings by hand. */
export const STATUS = Object.freeze({
  ACTIVE: 'Active',
  AT_RISK: 'At risk',
  ARCHIVED: 'Archived',
});


async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error(`Cannot reach the API at ${BASE_URL}. Is json-server running?`);
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status})`);
  }
  return response.json();
}

const send = (method, path, body) =>
  request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Build "?a=1&b=2", skipping empty values. */
function toQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') q.append(key, value);
  });
  const str = q.toString();
  return str ? `?${str}` : '';
}


const NUMERIC_FIELDS = ['courseId', 'grade', 'attendanceRate', 'progress', 'pendingGrading'];
function normalize(data) {
  const out = { ...data };
  NUMERIC_FIELDS.forEach((field) => {
    if (out[field] !== undefined && out[field] !== '') out[field] = Number(out[field]);
  });
  return out;
}

const withoutPassword = ({ password, ...user }) => user;

const average = (list, key) =>
  list.length ? Math.round((list.reduce((sum, item) => sum + Number(item[key]), 0) / list.length) * 10) / 10 : 0;

/**
 * @returns {Promise<object|null>} the user (without password) or null if credentials are wrong
 */
export async function loginUser(email, password) {
  const users = await request(`/users${toQuery({ email: String(email).trim().toLowerCase() })}`);
  const user = users.find((u) => u.password === password);
  return user ? withoutPassword(user) : null;
}

/**
 * @param {{name:string,email:string,password:string,role?:string}} userData
 * @throws if the email is already registered
 * @returns {Promise<object>} the created user (without password)
 */
export async function registerUser(userData) {
  const email = String(userData.email).trim().toLowerCase();
  const existing = await request(`/users${toQuery({ email })}`);
  if (existing.length) throw new Error('This email is already registered.');
  const created = await send('POST', '/users', { role: 'instructor', ...userData, email });
  return withoutPassword(created);
}


export const getCourses = () => request('/courses');

/** @throws if the course code already exists */
export async function addCourse(courseData) {
  const code = String(courseData.code).trim().toUpperCase();
  const existing = await request(`/courses${toQuery({ code })}`);
  if (existing.length) throw new Error(`Course ${code} already exists.`);
  return send('POST', '/courses', { ...courseData, code, name: String(courseData.name).trim() });
}

/** @param {{courseId?:number|string,status?:string,q?:string}} [filters] optional */
export const getStudents = (filters = {}) => request(`/students${toQuery(filters)}`);

export const addStudent = (studentData) =>
  send('POST', '/students', { status: STATUS.ACTIVE, ...normalize(studentData) });

/** Partial update (PATCH): send only the fields that changed. */
export const updateStudent = (id, studentData) => send('PATCH', `/students/${id}`, normalize(studentData));

export const deleteStudent = (id) => send('DELETE', `/students/${id}`);


export const getTasks = () => request('/tasks');

export const getTasksByCourse = (courseId) => request(`/tasks${toQuery({ courseId })}`);

/** New tasks start with 0 progress and nothing waiting for grading. */
export const addTask = (taskData) =>
  send('POST', '/tasks', { progress: 0, pendingGrading: 0, ...normalize(taskData) });    //OMAR

export const deleteTask = (id) => send('DELETE', `/tasks/${id}`);      //OMAR


const GRADE_LABELS = ['A', 'B', 'C', 'D', 'F'];
const gradeBucket = (grade) => (grade >= 90 ? 0 : grade >= 80 ? 1 : grade >= 70 ? 2 : grade >= 60 ? 3 : 4);

/**
 * One call for the whole dashboard.
 * @param {{courseId?:number|string}} [options] limit everything to one course
 * @returns {Promise<{
 *   stats:{totalStudents:number,avgAttendance:number,avgGrade:number,pendingTasks:number,activeTasks:number},
 *   statusCounts:Record<string,number>,
 *   gradeDistribution:{labels:string[],counts:number[],percentages:number[]},
 *   courseSummaries:object[], activeTasks:object[],
 *   students:object[], courses:object[], tasks:object[]
 * }>}
 */
export async function getDashboardData({ courseId } = {}) {
  const [allStudents, courses, allTasks] = await Promise.all([getStudents(), getCourses(), getTasks()]);

  const cid = courseId ? Number(courseId) : null;
  const students = cid ? allStudents.filter((s) => s.courseId === cid) : allStudents;
  const tasks = cid ? allTasks.filter((t) => t.courseId === cid) : allTasks;
  const courseById = Object.fromEntries(courses.map((c) => [c.id, c]));

  const statusCounts = {
    [STATUS.ACTIVE]: 0,
    [STATUS.AT_RISK]: 0,
    [STATUS.ARCHIVED]: 0,
  };
  const counts = [0, 0, 0, 0, 0];
  students.forEach((s) => {
    if (s.status in statusCounts) statusCounts[s.status] += 1;
    counts[gradeBucket(Number(s.grade))] += 1;
  });

  const activeTasks = tasks
    .map((t) => ({ ...t, courseCode: courseById[t.courseId]?.code ?? '', courseName: courseById[t.courseId]?.name ?? '' }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    stats: {
      totalStudents: students.length,
      avgAttendance: average(students, 'attendanceRate'),
      avgGrade: average(students, 'grade'),
      pendingTasks: tasks.reduce((sum, t) => sum + Number(t.pendingGrading || 0), 0),
      activeTasks: tasks.length,
    },
    statusCounts,
    gradeDistribution: {
      labels: GRADE_LABELS,
      counts,
      percentages: counts.map((n) => (students.length ? Math.round((n / students.length) * 100) : 0)),
    },
    courseSummaries: courses
      .filter((c) => !cid || c.id === cid)
      .map((c) => {
        const group = students.filter((s) => s.courseId === c.id);
        return {
          courseId: c.id, code: c.code, name: c.name,
          studentCount: group.length, avgGrade: average(group, 'grade'), avgAttendance: average(group, 'attendanceRate'),
        };
      }),
    activeTasks,
    students,
    courses,
    tasks,
  };
}
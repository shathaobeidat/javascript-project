

import { getSessionUser } from './layout.js';

export const BASE_URL = 'http://localhost:3000';

/** Shared constants */
export const STATUS = Object.freeze({
  ACTIVE: 'Active',
  AT_RISK: 'At risk',
  ARCHIVED: 'Archived',
});

export const ATTENDANCE = Object.freeze({
  PRESENT: 'Present',
  ABSENT: 'Absent',
});

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error(
      `Cannot reach the API at ${BASE_URL}. Is json-server running?`
    );
  }

  if (!response.ok) {
    const error = new Error(
      `${options.method || 'GET'} ${path} failed (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

const send = (method, path, body) =>
  request(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

function toQuery(params = {}) {
  const q = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      q.append(key, value);
    }
  });

  const str = q.toString();
  return str ? `?${str}` : '';
}


const NUMERIC_FIELDS = ['grade', 'attendanceRate', 'progress', 'pendingGrading'];

function normalize(data) {
  const out = { ...data };

  NUMERIC_FIELDS.forEach((field) => {
    if (out[field] !== undefined && out[field] !== '') {
      out[field] = Number(out[field]);
    }
  });

  if (out.courseId !== undefined && out.courseId !== null) {
    out.courseId = String(out.courseId);
  }

  return out;
}


const ownerQuery = (instructorId) =>
  toQuery({
    _where: JSON.stringify({ instructorId: { eq: String(instructorId) } }),
  });

const withoutPassword = ({ password, ...user }) => user;

const average = (list, key) =>
  list.length
    ? Math.round(
        (list.reduce((sum, item) => sum + Number(item[key]), 0) /
          list.length) *
          10
      ) / 10
    : 0;

/** Compare ids safely: 1 and "1" are the same id; null/undefined match nothing. */
const same = (a, b) =>
  a !== undefined && a !== null && b !== undefined && b !== null &&
  String(a) === String(b);

/** Fields a caller is never allowed to set/overwrite on an existing record. */
const withoutOwnerFields = ({ id, instructorId, ...rest }) => rest;


/* =========================
   SESSION / AUTHORISATION
========================= */


export function requireInstructor() {
  const user = getSessionUser();

  if (!user || user.id === undefined || user.id === null || user.id === '') {
    if (typeof window !== 'undefined') {
      window.location.replace('login.html');
    }
    throw new Error('You must be signed in.');
  }

  return String(user.id);
}

const denied = (what) =>
  new Error(`Access denied: this ${what} does not belong to you.`);

/** GET /<collection>/<id>; a missing record is reported the same way as a foreign one. */
async function fetchRecord(collection, id, what) {
  if (id === undefined || id === null || id === '') {
    throw new Error(`A ${what} id is required.`);
  }

  try {
    return await request(`/${collection}/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error.status === 404) {
      throw denied(what);
    }
    throw error;
  }
}

async function getOwnedCourse(courseId) {
  const me = requireInstructor();
  const course = await fetchRecord('courses', courseId, 'course');

  if (!same(course.instructorId, me)) {
    throw denied('course');
  }

  return course;
}

async function getOwnedStudent(studentId) {
  const me = requireInstructor();
  const student = await fetchRecord('students', studentId, 'student');

  if (!same(student.instructorId, me)) {
    throw denied('student');
  }

  return student;
}

/** A task is owned when the course it points to is owned. */
async function getOwnedTask(taskId) {
  const task = await fetchRecord('tasks', taskId, 'task');

  // Throws "Access denied" when the course is missing or belongs to someone else.
  await getOwnedCourse(task.courseId);

  return task;
}

/** An attendance record is owned when its student is owned. */
async function getOwnedAttendanceRecord(recordId) {
  const record = await fetchRecord('attendance', recordId, 'attendance record');

  await getOwnedStudent(record.studentId);

  return record;
}


/* =========================
   AUTH
========================= */

/*
 * E-mail rules:
 *   - Every e-mail must end with the university domain below (EMAIL_DOMAIN),
 *     written exactly like that, in lowercase - like "gmail.com", never "Gmail.com".
 *     Sign-up AND login show a notice if another domain is used.
 *   - Before the "@": CASE-SENSITIVE. "shatha@bau.edu.jo" and "Shatha@bau.edu.jo"
 *     are two different e-mails (two different accounts).
 *   - Login compares the whole e-mail exactly as it was registered.
 */

const EMAIL_DOMAIN = 'bau.edu.jo';

const cleanEmail = (email) => String(email ?? '').trim();

/** @throws if the e-mail is not "<name>@bau.edu.jo" with the domain in lowercase */
function assertValidEmail(email) {
  const at = email.indexOf('@');
  const validShape =
    at > 0 && at === email.lastIndexOf('@') && !/\s/.test(email);

  if (!validShape || email.slice(at + 1) !== EMAIL_DOMAIN) {
    throw new Error(
      `Please use your university email: name@${EMAIL_DOMAIN} (the domain must be exactly ${EMAIL_DOMAIN}).`
    );
  }
}

/**
 * @throws if the e-mail does not follow name@bau.edu.jo
 * @returns {Promise<object|null>} the user (without password) or null if credentials are wrong
 */
export async function loginUser(email, password) {
  const typed = cleanEmail(email);

  assertValidEmail(typed);

  const users = await request('/users');

  const user = users.find(
    (u) => cleanEmail(u.email) === typed && u.password === password
  );

  return user ? withoutPassword(user) : null;
}

/**
 * @throws if the e-mail does not follow name@bau.edu.jo, or is already registered
 * @returns {Promise<object>} the created user (without password)
 */
export async function registerUser(userData) {
  const email = cleanEmail(userData.email);

  assertValidEmail(email);

  const users = await request('/users');

  // Exactly the same e-mail (including the case of the name) = taken.
  if (users.some((u) => cleanEmail(u.email) === email)) {
    throw new Error('This email is already registered.');
  }

  const created = await send('POST', '/users', {
    role: 'instructor',
    ...userData,
    email,
  });

  return withoutPassword(created);
}


/* =========================
   COURSES
========================= */

/** Only the logged-in instructor's courses. */
export async function getCourses() {
  const me = requireInstructor();

  const courses = await request(`/courses${ownerQuery(me)}`);

  // Defence in depth: never trust the server-side filter alone.
  return courses.filter((c) => same(c.instructorId, me));
}

const nameKey = (name) =>
  String(name).trim().replace(/\s+/g, ' ').toLowerCase();

export async function addCourse(courseData) {
  const me = requireInstructor();

  const code = String(courseData.code).trim().toUpperCase();
  const name = String(courseData.name).trim();

  if (!code || !name) {
    throw new Error('Course code and course name are required.');
  }

  // Duplicates are checked among THIS instructor's courses only.
  const mine = await getCourses();

  if (mine.some((c) => String(c.code).trim().toUpperCase() === code)) {
    throw new Error(`Course ${code} already exists.`);
  }

  if (mine.some((c) => nameKey(c.name) === nameKey(name))) {
    throw new Error(`A course named "${name}" already exists.`);
  }

  return send('POST', '/courses', {
    code,
    name,
    instructorId: me,
  });
}

/*
 * Update one of YOUR courses. Rejected when the course belongs to someone else
 * (or to nobody). instructorId can never be changed here.
 */
export async function updateCourse(id, courseData) {
  const course = await getOwnedCourse(id);

  const data = withoutOwnerFields(courseData);

  if (data.code !== undefined) {
    data.code = String(data.code).trim().toUpperCase();
  }

  if (data.name !== undefined) {
    data.name = String(data.name).trim();
  }

  if (data.code === '' || data.name === '') {
    throw new Error('Course code and course name are required.');
  }

  // Duplicates are checked among THIS instructor's other courses only.
  const others = (await getCourses()).filter((c) => !same(c.id, course.id));

  if (
    data.code !== undefined &&
    others.some((c) => String(c.code).trim().toUpperCase() === data.code)
  ) {
    throw new Error(`Course ${data.code} already exists.`);
  }

  if (
    data.name !== undefined &&
    others.some((c) => nameKey(c.name) === nameKey(data.name))
  ) {
    throw new Error(`A course named "${data.name}" already exists.`);
  }

  return send('PATCH', `/courses/${encodeURIComponent(course.id)}`, data);
}

export async function deleteCourse(id) {
  const course = await getOwnedCourse(id);

  const [students, tasks] = await Promise.all([
    getStudents({ courseId: course.id }),
    getTasksByCourse(course.id),
  ]);

  if (students.length || tasks.length) {
    throw new Error(
      `This course still has ${students.length} student(s) and ${tasks.length} task(s). Remove them first.`
    );
  }

  return send('DELETE', `/courses/${encodeURIComponent(course.id)}`);
}


/* =========================
   STUDENTS
========================= */

/**
 * Only the logged-in instructor's students.
 * Extra filters (e.g. { courseId }) are allowed, but instructorId always comes
 * from the session — a caller-supplied instructorId is overwritten.
 */
export async function getStudents(filters = {}) {
  const me = requireInstructor();

  // Only instructorId goes to the server; other filters are applied below so
  // that 1 vs "1" id-type differences in old records can't hide data.
  const students = await request(`/students${ownerQuery(me)}`);

  return students.filter(
    (s) =>
      same(s.instructorId, me) &&
      (filters.courseId === undefined ||
        filters.courseId === '' ||
        same(s.courseId, filters.courseId))
  );
}


/* =========================
   CHECK UNIQUE STUDENT EMAIL
========================= */

async function validateStudentEmail(email, studentId = null) {
  const normalizedEmail = String(email).trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('Student email is required.');
  }

  // Only this instructor's students are compared.
  const students = await getStudents();

  const emailExists = students.some((student) => {
    const sameEmail =
      String(student.email || '').trim().toLowerCase() === normalizedEmail;

    // When editing, a student's own email is not a duplicate.
    const differentStudent =
      studentId === null || !same(student.id, studentId);

    return sameEmail && differentStudent;
  });

  if (emailExists) {
    throw new Error('This email is already used by another student.');
  }

  return normalizedEmail;
}


/* =========================
   ADD STUDENT
========================= */

export async function addStudent(studentData) {
  const me = requireInstructor();

  // The selected course must belong to this instructor.
  const course = await getOwnedCourse(studentData.courseId);

  const email = await validateStudentEmail(studentData.email);

  return send('POST', '/students', {
    status: STATUS.ACTIVE,

    ...normalize({
      ...withoutOwnerFields(studentData),
      email,
      courseId: course.id,
    }),

    instructorId: me, // always from the session, never from the form
  });
}


/* =========================
   UPDATE STUDENT
========================= */

export async function updateStudent(id, studentData) {
  // Rejects when the student is not yours.
  const student = await getOwnedStudent(id);

  const data = withoutOwnerFields(studentData); // instructorId can't be changed

  if (data.email !== undefined) {
    data.email = await validateStudentEmail(data.email, student.id);
  }

  // Moving a student is only allowed into one of your own courses.
  if (data.courseId !== undefined) {
    const course = await getOwnedCourse(data.courseId);
    data.courseId = course.id;
  }

  return send(
    'PATCH',
    `/students/${encodeURIComponent(student.id)}`,
    normalize(data)
  );
}


/* =========================
   ATTENDANCE
========================= */

/**
 * Only attendance of the logged-in instructor's students.
 * A { studentId } filter is verified against student ownership first.
 */
export async function getAttendance(filters = {}) {
  const me = requireInstructor();

  if (filters.studentId !== undefined && filters.studentId !== '') {
    await getOwnedStudent(filters.studentId);
  }

  const [records, myStudents] = await Promise.all([
    request(`/attendance${ownerQuery(me)}`),
    getStudents(),
  ]);

  const myIds = new Set(myStudents.map((s) => String(s.id)));

  // Authority is the student's owner; the record's own instructorId is only
  // an optimisation for the query above.
  return records.filter(
    (r) =>
      r.studentId !== undefined &&
      r.studentId !== null &&
      myIds.has(String(r.studentId)) &&
      (filters.studentId === undefined ||
        filters.studentId === '' ||
        same(r.studentId, filters.studentId)) &&
      (!filters.date || r.date === filters.date)
  );
}


/*
 * Attendance rate for one student:
 *   Present / (Present + Absent) * 100
 * calculated from the real attendance records.
 */
export const calculateAttendanceRate = (records, studentId) => {
  const studentRecords = records.filter((record) => {
    if (!record) return false;

    if (record.studentId === null || record.studentId === undefined) {
      return false;
    }

    const validStatus =
      record.status === ATTENDANCE.PRESENT ||
      record.status === ATTENDANCE.ABSENT;

    return same(record.studentId, studentId) && validStatus;
  });

  if (!studentRecords.length) {
    return 0;
  }

  const presentCount = studentRecords.filter(
    (record) => record.status === ATTENDANCE.PRESENT
  ).length;

  return Math.round((presentCount / studentRecords.length) * 100);
};


/* Recalculate and save the attendanceRate of one (owned) student. */
async function refreshAttendanceRate(studentId) {
  const student = await getOwnedStudent(studentId);

  const records = await getAttendance({ studentId: student.id });

  const rate = calculateAttendanceRate(records, student.id);

  await send('PATCH', `/students/${encodeURIComponent(student.id)}`, {
    attendanceRate: rate,
  });

  return rate;
}


/*
 * Add or update attendance for one of your students.
 * studentId is stored as a string (never Number(): ids can be like "aScZwmPGwVI").
 */
export async function recordAttendance({ studentId, date, status }) {
  const me = requireInstructor();

  const student = await getOwnedStudent(studentId);

  const existing = await getAttendance({ studentId: student.id, date });

  const data = {
    studentId: String(student.id),
    date,
    status,
    instructorId: me,
  };

  let saved;

  if (existing.length) {
    saved = await send(
      'PATCH',
      `/attendance/${encodeURIComponent(existing[0].id)}`,
      data
    );
  } else {
    saved = await send('POST', '/attendance', data);
  }

  await refreshAttendanceRate(student.id);

  return saved;
}


/*
 * Update an existing attendance record (e.g. when the date is changed while
 * editing a student). Both the record's current student and the target student
 * must be yours.
 */
export async function updateAttendanceRecord(
  recordId,
  { studentId, date, status }
) {
  const me = requireInstructor();

  const record = await getOwnedAttendanceRecord(recordId);
  const student = await getOwnedStudent(studentId);

  const allRecords = await getAttendance({ studentId: student.id });

  // Another record for the same student/date would make a duplicate.
  const duplicate = allRecords.find(
    (r) => !same(r.id, record.id) && r.date === date
  );

  const data = {
    studentId: String(student.id),
    date,
    status,
    instructorId: me,
  };

  let saved;

  if (duplicate) {
    saved = await send(
      'PATCH',
      `/attendance/${encodeURIComponent(duplicate.id)}`,
      data
    );

    await send('DELETE', `/attendance/${encodeURIComponent(record.id)}`);
  } else {
    saved = await send(
      'PATCH',
      `/attendance/${encodeURIComponent(record.id)}`,
      data
    );
  }

  await refreshAttendanceRate(student.id);

  // If the record was moved to a different student, refresh the old one too.
  if (!same(record.studentId, student.id)) {
    await refreshAttendanceRate(record.studentId);
  }

  return saved;
}


/* Delete one attendance record (its student must be yours). */
export async function deleteAttendanceRecord(recordId) {
  const record = await getOwnedAttendanceRecord(recordId);

  const result = await send(
    'DELETE',
    `/attendance/${encodeURIComponent(record.id)}`
  );

  await refreshAttendanceRate(record.studentId);

  return result;
}


/* =========================
   DELETE STUDENT
========================= */

export async function deleteStudent(id) {
  // Ownership is verified BEFORE anything is deleted.
  const student = await getOwnedStudent(id);

  // Remove the student's attendance first so there are no orphan records.
  const records = await getAttendance({ studentId: student.id });

  await Promise.all(
    records.map((record) =>
      send('DELETE', `/attendance/${encodeURIComponent(record.id)}`)
    )
  );

  return send('DELETE', `/students/${encodeURIComponent(student.id)}`);
}


/* =========================
   TASKS
========================= */

/** Only tasks that belong to the logged-in instructor's courses. */
export async function getTasks() {
  const me = requireInstructor();

  const [tasks, myCourses] = await Promise.all([
    request(`/tasks${ownerQuery(me)}`),
    getCourses(),
  ]);

  const myCourseIds = new Set(myCourses.map((c) => String(c.id)));

  // Authority: task.courseId -> course.instructorId
  return tasks.filter((t) => myCourseIds.has(String(t.courseId)));
}

export async function getTasksByCourse(courseId) {
  const course = await getOwnedCourse(courseId);

  const tasks = await getTasks();

  return tasks.filter((t) => same(t.courseId, course.id));
}

export async function addTask(taskData) {
  const me = requireInstructor();

  // The course must belong to this instructor.
  const course = await getOwnedCourse(taskData.courseId);

  return send('POST', '/tasks', {
    progress: 0,
    pendingGrading: 0,
    ...normalize(withoutOwnerFields(taskData)),
    courseId: String(course.id),
    instructorId: me,
  });
}

export async function updateTask(id, taskData) {
  const task = await getOwnedTask(id);

  const data = withoutOwnerFields(taskData);

  // A task can only be moved to one of your own courses.
  if (data.courseId !== undefined) {
    const course = await getOwnedCourse(data.courseId);
    data.courseId = course.id;
  }

  return send(
    'PATCH',
    `/tasks/${encodeURIComponent(task.id)}`,
    normalize(data)
  );
}

export async function deleteTask(id) {
  const task = await getOwnedTask(id);

  return send('DELETE', `/tasks/${encodeURIComponent(task.id)}`);
}


/* =========================
   DASHBOARD
========================= */

const GRADE_LABELS = ['A', 'B', 'C', 'D', 'F'];

const gradeBucket = (grade) =>
  grade >= 90 ? 0 : grade >= 80 ? 1 : grade >= 70 ? 2 : grade >= 60 ? 3 : 4;

/* Everything below is built ONLY from the instructor-scoped getters above. */
export async function getDashboardData({ courseId } = {}) {
  const [allStudents, courses, allTasks] = await Promise.all([
    getStudents(),
    getCourses(),
    getTasks(),
  ]);

  const cid = courseId ? String(courseId) : null;

  // A courseId that is not one of your courses is rejected.
  if (cid && !courses.some((c) => same(c.id, cid))) {
    throw denied('course');
  }

  const students = cid
    ? allStudents.filter((s) => same(s.courseId, cid))
    : allStudents;

  const tasks = cid
    ? allTasks.filter((t) => same(t.courseId, cid))
    : allTasks;

  const courseById = Object.fromEntries(courses.map((c) => [String(c.id), c]));

  const statusCounts = {
    [STATUS.ACTIVE]: 0,
    [STATUS.AT_RISK]: 0,
    [STATUS.ARCHIVED]: 0,
  };

  const counts = [0, 0, 0, 0, 0];

  students.forEach((student) => {
    if (student.status in statusCounts) {
      statusCounts[student.status]++;
    }

    counts[gradeBucket(Number(student.grade))]++;
  });

  const activeTasks = tasks
    .map((task) => ({
      ...task,
      courseCode: courseById[String(task.courseId)]?.code ?? '',
      courseName: courseById[String(task.courseId)]?.name ?? '',
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    stats: {
      totalStudents: students.length,

      avgAttendance: average(students, 'attendanceRate'),

      avgGrade: average(students, 'grade'),

      pendingTasks: tasks.reduce(
        (sum, task) => sum + Number(task.pendingGrading || 0),
        0
      ),

      activeTasks: tasks.length,
    },

    statusCounts,

    gradeDistribution: {
      labels: GRADE_LABELS,
      counts,

      percentages: counts.map((count) =>
        students.length ? Math.round((count / students.length) * 100) : 0
      ),
    },

    courseSummaries: courses
      .filter((c) => !cid || same(c.id, cid))
      .map((course) => {
        const group = students.filter((student) =>
          same(student.courseId, course.id)
        );

        return {
          courseId: course.id,
          code: course.code,
          name: course.name,
          studentCount: group.length,
          avgGrade: average(group, 'grade'),
          avgAttendance: average(group, 'attendanceRate'),
        };
      }),

    activeTasks,
    students,
    courses,
    tasks,
  };
}
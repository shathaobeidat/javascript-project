// apiservice.js — all communication with JSON Server.
//
// DATA OWNERSHIP MODEL
//   user.id  ->  course.instructorId  ->  student.instructorId  ->  attendance (via studentId)
//                course.id            ->  task.courseId (task owner = owner of its course)
//
// Records that have no instructorId (the data that existed before isolation was
// added) are NEVER assigned to anybody: they do not match any instructor, so
// they are invisible and cannot be changed through this service. Every instructor
// therefore starts with zero data and owns only what they create.
//
// Every function below takes the instructor from the existing session
// (getSessionUser from layout.js). Callers can NOT choose the instructor:
// any instructorId passed in by a page is ignored/overwritten.
//
// NOTE: JSON Server has no authentication. These checks run in the browser, so
// they stop the app (and normal use of it) from touching another instructor's
// data, but they cannot stop someone who calls the API directly (curl, DevTools).
// See the notes delivered with this project.

import { getSessionUser } from './layout.js';

export const BASE_URL = 'http://localhost:3000';

/** Shared constants — use these instead of typing the strings by hand. */
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
    throw new Error(`Cannot reach the API at ${BASE_URL}. Is json-server running?`);
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

/** Build "?a=1&b=2", skipping empty values. */
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

/*
 * courseId is intentionally NOT numeric any more: courses created through the
 * app get string ids such as "HZZn8Lp3HxI", and Number() of those is NaN.
 * All ids are compared as strings with same().
 */
const NUMERIC_FIELDS = ['grade', 'attendanceRate', 'progress', 'pendingGrading'];

const NUMERIC_FIELDS = ['courseId', 'grade', 'attendanceRate', 'progress', 'pendingGrading'];
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

/*
 * Server-side filter by owner.
 *
 * json-server 1.0.0-beta turns query values like "1" into the NUMBER 1, so a
 * plain ?instructorId=1 would never match an instructorId stored as the string
 * "1". Its JSON filter (_where) with the "eq" operator compares exactly, so ids
 * stay strings:
 *   /students?_where={"instructorId":{"eq":"1"}}
 * (Every getter below also re-checks ownership on the returned rows.)
 */
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

/**
 * @returns {Promise<object|null>} the user (without password) or null if credentials are wrong
 */
export async function loginUser(email, password) {
  const users = await request(
    `/users${toQuery({
      email: String(email).trim().toLowerCase(),
    })}`
  );

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

  if (existing.length) {
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

/** @throws if the course code already exists */
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

/** Partial update (PATCH): send only the fields that changed. */
export const updateStudent = (id, studentData) => send('PATCH', `/students/${id}`, normalize(studentData));

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


const GRADE_LABELS = ['A', 'B', 'C', 'D', 'F'];
const gradeBucket = (grade) => (grade >= 90 ? 0 : grade >= 80 ? 1 : grade >= 70 ? 2 : grade >= 60 ? 3 : 4);

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
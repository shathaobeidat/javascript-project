

export const BASE_URL = 'http://localhost:3000';

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
    throw new Error(
      `Cannot reach the API at ${BASE_URL}. Is json-server running?`
    );
  }

  if (!response.ok) {
    throw new Error(
      `${options.method || 'GET'} ${path} failed (${response.status})`
    );
  }

  return response.json();
}

const send = (method, path, body) =>
  request(path, {
    method,
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
  });

function toQuery(params = {}) {
  const q = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      q.append(key, value);
    }
  });

  const str = q.toString();
  return str ? `?${str}` : '';
}

const NUMERIC_FIELDS = [
  'courseId',
  'grade',
  'attendanceRate',
  'progress',
  'pendingGrading',
];

function normalize(data) {
  const out = { ...data };

  NUMERIC_FIELDS.forEach((field) => {
    if (
      out[field] !== undefined &&
      out[field] !== ''
    ) {
      out[field] = Number(out[field]);
    }
  });

  return out;
}

const withoutPassword = ({ password, ...user }) => user;

const average = (list, key) =>
  list.length
    ? Math.round(
        (
          list.reduce(
            (sum, item) => sum + Number(item[key]),
            0
          ) / list.length
        ) * 10
      ) / 10
    : 0;


/* =========================
   AUTH
========================= */

export async function loginUser(email, password) {
  const users = await request(
    `/users${toQuery({
      email: String(email).trim().toLowerCase(),
    })}`
  );

  const user = users.find(
    (u) => u.password === password
  );

  return user ? withoutPassword(user) : null;
}

export async function registerUser(userData) {
  const email = String(userData.email)
    .trim()
    .toLowerCase();

  const existing = await request(
    `/users${toQuery({ email })}`
  );

  if (existing.length) {
    throw new Error(
      'This email is already registered.'
    );
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

export const getCourses = () =>
  request('/courses');

const nameKey = (name) =>
  String(name)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export async function addCourse(courseData) {
  const code = String(courseData.code)
    .trim()
    .toUpperCase();

  const name = String(courseData.name).trim();

  if (!code || !name) {
    throw new Error(
      'Course code and course name are required.'
    );
  }

  const all = await request('/courses');

  if (
    all.some(
      (c) =>
        String(c.code).trim().toUpperCase() === code
    )
  ) {
    throw new Error(
      `Course ${code} already exists.`
    );
  }

  if (
    all.some(
      (c) => nameKey(c.name) === nameKey(name)
    )
  ) {
    throw new Error(
      `A course named "${name}" already exists.`
    );
  }

  return send('POST', '/courses', {
    code,
    name,
  });
}

export async function deleteCourse(id) {
  const [students, tasks] = await Promise.all([
    request(
      `/students${toQuery({ courseId: id })}`
    ),
    request(
      `/tasks${toQuery({ courseId: id })}`
    ),
  ]);

  if (students.length || tasks.length) {
    throw new Error(
      `This course still has ${students.length} student(s) and ${tasks.length} task(s). Remove them first.`
    );
  }

  return send('DELETE', `/courses/${id}`);
}


/* =========================
   STUDENTS
========================= */

export const getStudents = (filters = {}) =>
  request(
    `/students${toQuery(filters)}`
  );


/* =========================
   CHECK UNIQUE STUDENT EMAIL
========================= */

async function validateStudentEmail(
  email,
  studentId = null
) {
  // Remove spaces and make email lowercase
  const normalizedEmail = String(email)
    .trim()
    .toLowerCase();

  // Check that email is not empty
  if (!normalizedEmail) {
    throw new Error(
      'Student email is required.'
    );
  }

  // Get all students
  const students = await getStudents();

  // Check if another student already uses this email
  const emailExists = students.some(
    (student) => {

      const existingEmail = String(
        student.email || ''
      )
        .trim()
        .toLowerCase();

      const sameEmail =
        existingEmail === normalizedEmail;

      /*
       * If we are editing a student,
       * don't consider that same student's
       * email a duplicate.
       */
      const differentStudent =
        studentId === null ||
        String(student.id) !==
          String(studentId);

      return (
        sameEmail &&
        differentStudent
      );
    }
  );

  if (emailExists) {
    throw new Error(
      'This email is already used by another student.'
    );
  }

  return normalizedEmail;
}


/* =========================
   ADD STUDENT
========================= */

export async function addStudent(
  studentData
) {
  // Check email before adding
  const email =
    await validateStudentEmail(
      studentData.email
    );

  return send(
    'POST',
    '/students',
    {
      status: STATUS.ACTIVE,

      ...normalize({
        ...studentData,
        email: email,
      }),
    }
  );
}


/* =========================
   UPDATE STUDENT
========================= */

export async function updateStudent(
  id,
  studentData
) {
  const data = {
    ...studentData,
  };

  /*
   * Check email only when an email
   * is included in the update.
   */
  if (data.email !== undefined) {

    data.email =
      await validateStudentEmail(
        data.email,
        id
      );
  }

  return send(
    'PATCH',
    `/students/${id}`,
    normalize(data)
  );
}
/* =========================
   ATTENDANCE
========================= */

export const ATTENDANCE = Object.freeze({
  PRESENT: 'Present',
  ABSENT: 'Absent',
});

export const getAttendance = (filters = {}) =>
  request(
    `/attendance${toQuery(filters)}`
  );


/*
 * Calculate attendance rate for one student.
 *
 * Formula:
 *
 * Present records / (Present + Absent records) * 100
 *
 * Example:
 * 8 Present + 2 Absent
 * = 8 / 10 * 100
 * = 80%
 *
 * The calculation uses the actual attendance records,
 * not the old attendanceRate value stored in students.
 */
export const calculateAttendanceRate = (
  records,
  studentId
) => {

  const studentRecords = records.filter(
    (record) => {

      if (!record) {
        return false;
      }

      if (
        record.studentId === null ||
        record.studentId === undefined
      ) {
        return false;
      }

      const sameStudent =
        String(record.studentId) ===
        String(studentId);

      const validStatus =
        record.status === ATTENDANCE.PRESENT ||
        record.status === ATTENDANCE.ABSENT;

      return sameStudent && validStatus;
    }
  );

  if (!studentRecords.length) {
    return 0;
  }

  const presentCount =
    studentRecords.filter(
      (record) =>
        record.status === ATTENDANCE.PRESENT
    ).length;

  return Math.round(
    (presentCount / studentRecords.length) * 100
  );
};


/*
 * Recalculate and save the attendanceRate
 * of one student.
 */
async function refreshAttendanceRate(studentId) {

  const records =
    await getAttendance();

  const rate =
    calculateAttendanceRate(
      records,
      studentId
    );

  await send(
    'PATCH',
    `/students/${studentId}`,
    {
      attendanceRate: rate
    }
  );

  return rate;
}


/*
 * Add or update attendance.
 *
 * IMPORTANT:
 * Do NOT use Number(studentId).
 *
 * JSON Server may generate string IDs such as:
 *
 * "aScZwmPGwVI"
 *
 * Number("aScZwmPGwVI") === NaN
 *
 * which can end up stored as null.
 */
export async function recordAttendance({
  studentId,
  date,
  status,
}) {

  const existing =
    await getAttendance({
      studentId,
      date,
    });

  const data = {
    studentId: String(studentId),
    date: date,
    status: status,
  };

  let saved;

  /*
   * If a record already exists for this student
   * on this date, update it.
   */
  if (existing.length) {

    saved = await send(
      'PATCH',
      `/attendance/${existing[0].id}`,
      data
    );

  }

  /*
   * Otherwise create a new attendance record.
   */
  else {

    saved = await send(
      'POST',
      '/attendance',
      data
    );
  }

  /*
   * Recalculate the student's attendance percentage
   * after the attendance record changes.
   */
  await refreshAttendanceRate(
    studentId
  );

  return saved;
}


/*
 * Update an existing attendance record.
 *
 * This is especially important when the user changes
 * the attendance DATE while editing a student.
 */
export async function updateAttendanceRecord(
  recordId,
  {
    studentId,
    date,
    status
  }
) {

  const allRecords =
    await getAttendance();

  /*
   * Check whether another attendance record already
   * exists for the same student and new date.
   */
  const duplicate =
    allRecords.find(
      (record) =>
        String(record.id) !==
          String(recordId) &&

        String(record.studentId) ===
          String(studentId) &&

        record.date === date
    );


  let saved;


  /*
   * If another record already exists for the
   * same student/date, update that record and
   * delete the old record.
   *
   * This prevents duplicate attendance records.
   */
  if (duplicate) {

    saved = await send(
      'PATCH',
      `/attendance/${duplicate.id}`,
      {
        studentId: String(studentId),
        date: date,
        status: status
      }
    );

    await send(
      'DELETE',
      `/attendance/${recordId}`
    );

  }

  /*
   * Otherwise simply update the existing record.
   */
  else {

    saved = await send(
      'PATCH',
      `/attendance/${recordId}`,
      {
        studentId: String(studentId),
        date: date,
        status: status
      }
    );
  }


  /*
   * Recalculate attendance percentage
   * after changing the record.
   */
  await refreshAttendanceRate(
    studentId
  );

  return saved;
}


/* =========================
   DELETE STUDENT
========================= */

export async function deleteStudent(id) {
  /*
   * Delete attendance records belonging to the
   * student first so there are no orphan records.
   */
  const records = await getAttendance({
    studentId: id,
  });

  await Promise.all(
    records.map((record) =>
      send(
        'DELETE',
        `/attendance/${record.id}`
      )
    )
  );

  return send(
    'DELETE',
    `/students/${id}`
  );
}


/* =========================
   TASKS
========================= */

export const getTasks = () =>
  request('/tasks');

export const getTasksByCourse = (courseId) =>
  request(
    `/tasks${toQuery({ courseId })}`
  );

export const addTask = (taskData) =>
  send('POST', '/tasks', {
    progress: 0,
    pendingGrading: 0,
    ...normalize(taskData),
  });

export const deleteTask = (id) =>
  send('DELETE', `/tasks/${id}`);


/* =========================
   DASHBOARD
========================= */

const GRADE_LABELS = [
  'A',
  'B',
  'C',
  'D',
  'F',
];

const gradeBucket = (grade) =>
  grade >= 90
    ? 0
    : grade >= 80
    ? 1
    : grade >= 70
    ? 2
    : grade >= 60
    ? 3
    : 4;

export async function getDashboardData({
  courseId,
} = {}) {
  const [
    allStudents,
    courses,
    allTasks,
  ] = await Promise.all([
    getStudents(),
    getCourses(),
    getTasks(),
  ]);

  const cid = courseId
    ? Number(courseId)
    : null;

  const students = cid
    ? allStudents.filter(
        (s) => s.courseId === cid
      )
    : allStudents;

  const tasks = cid
    ? allTasks.filter(
        (t) => t.courseId === cid
      )
    : allTasks;

  const courseById = Object.fromEntries(
    courses.map((c) => [c.id, c])
  );

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
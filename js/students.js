// students.js — Students page

import {
  getStudents,
  getCourses,
  getAttendance,
  addStudent,
  updateStudent,
  deleteStudent,
  recordAttendance,
  updateAttendanceRecord,
  calculateAttendanceRate,
  requireInstructor,
  ATTENDANCE
} from './apiservice.js';


/*
 * Instructor-specific page: if nobody is logged in this redirects to
 * login.html and stops the script. getStudents/getCourses/getAttendance and
 * every add/update/delete in apiservice.js are scoped to this instructor.
 */
requireInstructor();


/* =========================
   HELPERS
========================= */

const $ = (id) =>
  document.getElementById(id);


const esc = (t) =>
  String(t).replace(
    /[&<>"']/g,
    (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );


/*
 * Compare IDs safely whether they are
 * numbers or strings.
 */
const sameId = (a, b) =>
  String(a) === String(b);


/*
 * Get today's date in YYYY-MM-DD format.
 */
const today = () => {

  const d = new Date();

  return new Date(
    d.getTime() -
    d.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
};


/* =========================
   DATA
========================= */

let students = [];

let courses = [];

let attendance = [];


/*
 * When editing a student, this stores
 * the attendance record currently being edited.
 */
let editingAttendanceId = null;


/* =========================
   FILTERS
========================= */

const filters = {

  courseId: '',

  status: '',

  date: '',

  attendance: ''

};


/* =========================
   LOADING
========================= */

async function init() {

  try {

    [
      courses,
      students,
      attendance
    ] = await Promise.all([

      getCourses(),

      getStudents(),

      getAttendance()

    ]);


    /*
     * Always calculate attendance rate
     * from the real attendance records.
     */
    syncAllAttendanceRates();


    fillCourseSelects();


    render();

  }

  catch (err) {

    showAlert(
      $('stu-alert'),
      err.message
    );

  }

}


async function reload() {

  [
    students,
    attendance
  ] = await Promise.all([

    getStudents(),

    getAttendance()

  ]);


  /*
   * Recalculate all student attendance rates
   * after every add/edit/delete operation.
   */
  syncAllAttendanceRates();


  render();

}


function showAlert(
  el,
  message
) {

  el.textContent = message;

  el.hidden = !message;

}


/* =========================
   ATTENDANCE
========================= */


/*
 * Recalculate the attendance percentage
 * for every student.
 */
function syncAllAttendanceRates() {

  students = students.map(
    (student) => ({

      ...student,

      attendanceRate:
        calculateAttendanceRate(
          attendance,
          student.id
        )

    })
  );

}


/*
 * Find attendance record for a student
 * on a specific date.
 */
const recordOn = (
  studentId,
  date
) =>

  attendance.find(
    (record) =>
      sameId(
        record.studentId,
        studentId
      ) &&
      record.date === date
  );


/*
 * Get the latest attendance record
 * for a student.
 */
const latestRecord = (
  studentId
) =>

  attendance

    .filter(
      (record) =>
        sameId(
          record.studentId,
          studentId
        )
    )

    .sort(
      (a, b) =>
        b.date.localeCompare(
          a.date
        )
    )[0];


/*
 * Display attendance badge.
 */
function attendanceBadge(
  record
) {

  if (!record) {

    return `
      <span class="badge badge--none">
        No record
      </span>
    `;

  }


  return `

    <span class="badge badge--${record.status.toLowerCase()}">

      ${esc(record.status)}

    </span>

    <span class="stu-att-date">

      ${esc(record.date)}

    </span>

  `;

}


/* =========================
   COURSE SELECTS
========================= */

function fillCourseSelects() {

  const options = courses

    .map(
      (course) => `

        <option value="${esc(course.id)}">

          ${esc(course.code)}
          -
          ${esc(course.name)}

        </option>

      `
    )

    .join('');


  $('stu-filter-course').innerHTML =

    `<option value="">
      All courses
    </option>

    ${options}`;


  $('stu-course').innerHTML =
    options;

}


/* =========================
   FILTER STUDENTS
========================= */

function baseStudents() {

  return students.filter(
    (student) =>

      (
        !filters.courseId ||

        sameId(
          student.courseId,
          filters.courseId
        )
      )


      &&


      (
        !filters.status ||

        student.status ===
          filters.status
      )


  );

}


/* =========================
   RENDER TABLE
========================= */

function render() {

  const base =
    baseStudents();


  let rows =
    base.map(
      (student) => ({

        s: student,

        record:
          filters.date

            ? recordOn(
                student.id,
                filters.date
              )

            : latestRecord(
                student.id
              )

      })
    );


  /*
   * If a date filter is selected,
   * show only students who have
   * attendance for that date.
   */
  if (filters.date) {

    rows =
      rows.filter(
        (row) => row.record
      );

  }


  /*
   * Attendance filter.
   */
  if (filters.attendance) {

    rows =
      rows.filter(
        (row) =>
          row.record?.status ===
          filters.attendance
      );

  }


  $('stu-clear-date').hidden =
    !filters.date;


  renderSummary(
    base,
    rows
  );


  const codeOf = (id) =>

    courses.find(
      (course) =>
        sameId(
          course.id,
          id
        )
    )?.code ?? '—';


  $('stu-empty').hidden =
    rows.length > 0;


  $('stu-empty').textContent =
    filters.date

      ? `No attendance records found for ${filters.date}.`

      : 'No students found. Use "Add student" to create one.';


  $('stu-tbody').innerHTML =

    rows

      .map(
        ({
          s,
          record
        }) => `

          <tr>

            <!-- STUDENT -->

            <td>

              <div class="stu-person">

                <span class="stu-avatar">

                  ${esc(
                    s.name.charAt(0)
                  )}

                </span>


                <div>

                  <div class="stu-name">

                    ${esc(s.name)}

                  </div>


                  <div class="stu-email">

                    ${esc(s.email)}

                  </div>

                </div>

              </div>

            </td>


            <!-- COURSE -->

            <td class="stu-code">

              ${esc(
                codeOf(
                  s.courseId
                )
              )}

            </td>


            <!-- GRADE -->

            <td class="stu-num">

              ${esc(s.grade)}%

            </td>


            <!-- ATTENDANCE RECORD -->

            <td>

              ${attendanceBadge(
                record
              )}

            </td>


            <!-- AVERAGE ATTENDANCE -->

            <td class="stu-num">

              ${esc(
                s.attendanceRate
              )}%

            </td>


            <!-- STATUS -->

            <td>

              <span
                class="badge badge--${esc(
                  s.status
                    .toLowerCase()
                    .replace(
                      ' ',
                      '-'
                    )
                )}"
              >

                ${esc(s.status)}

              </span>

            </td>


            <!-- ACTIONS -->

            <td class="right">

              <button
                class="link-btn"
                data-action="edit"
                data-id="${esc(s.id)}"
              >

                Edit

              </button>


              <button
                class="link-btn link-btn--danger"
                data-action="delete"
                data-id="${esc(s.id)}"
              >

                Delete

              </button>

            </td>

          </tr>

        `
      )

      .join('');

}


/* =========================
   SUMMARY
========================= */

function renderSummary(
  base,
  rows
) {

  const box =
    $('stu-summary');


  if (!filters.date) {

    box.hidden = true;

    return;

  }


  const dayRecords =

    base

      .map(
        (student) =>
          recordOn(
            student.id,
            filters.date
          )
      )

      .filter(Boolean);


  const present =

    dayRecords.filter(
      (record) =>
        record.status ===
        ATTENDANCE.PRESENT
    ).length;


  const absent =

    dayRecords.filter(
      (record) =>
        record.status ===
        ATTENDANCE.ABSENT
    ).length;


  box.innerHTML = `

    <strong>
      ${esc(filters.date)}
    </strong>

    —

    ${present} present,

    ${absent} absent,

    ${base.length -
      dayRecords.length}
    not recorded

    · showing
    ${rows.length}

  `;


  box.hidden = false;

}


/* =========================
   DIALOG
========================= */

function openDialog(
  student
) {

  $('stu-form').reset();


  showAlert(
    $('stu-form-error'),
    ''
  );


  $('stu-dialog-title').textContent =

    student

      ? 'Edit student'

      : 'Add student';


  $('stu-id').value =
    student?.id ?? '';


  /*
   * Reset attendance edit ID every time
   * the dialog opens.
   */
  editingAttendanceId =
    null;


  /* =========================
     EDIT STUDENT
  ========================= */

  if (student) {

    $('stu-name').value =
      student.name;


    $('stu-email').value =
      student.email;


    $('stu-course').value =
      student.courseId;


    $('stu-grade').value =
      student.grade;


    $('stu-status').value =
      student.status;


    /*
     * Find the attendance record
     * that will actually be edited.
     *
     * If a date filter is selected,
     * use that date's record.
     *
     * Otherwise use the latest record.
     */
    const selectedRecord =

      filters.date

        ? (
            recordOn(
              student.id,
              filters.date
            )

            ||

            latestRecord(
              student.id
            )
          )

        : latestRecord(
            student.id
          );


    if (selectedRecord) {

      editingAttendanceId =
        selectedRecord.id;


      $('stu-date').value =
        selectedRecord.date;


      $('stu-attendance').value =
        selectedRecord.status;

    }

    else {

      $('stu-date').value =
        filters.date ||
        today();


      $('stu-attendance').value =
        ATTENDANCE.PRESENT;

    }

  }


  /* =========================
     ADD STUDENT
  ========================= */

  else {

    $('stu-date').value =
      filters.date ||
      today();


    $('stu-attendance').value =
      ATTENDANCE.PRESENT;


    if (filters.courseId) {

      $('stu-course').value =
        filters.courseId;

    }

  }


  $('stu-dialog').showModal();

}


function closeDialog() {

  $('stu-dialog').close();

}


/* =========================
   DATE CHANGE
========================= */

function syncAttendanceFromDate() {

  const id =
    $('stu-id').value;


  /*
   * If adding a new student,
   * there is no old record to search.
   */
  if (!id) {
    return;
  }


  const record =
    recordOn(
      id,
      $('stu-date').value
    );


  if (record) {

    /*
     * If the new date already has a record,
     * show its status.
     */
    $('stu-attendance').value =
      record.status;

  }

  else {

    /*
     * Keep editing the original attendance
     * record.
     *
     * When the form is submitted,
     * its date will be changed.
     */
    $('stu-attendance').value =
      ATTENDANCE.PRESENT;

  }

}


/* =========================
   ADD / EDIT STUDENT
========================= */

async function onSubmit(
  event
) {

  event.preventDefault();


  const form =
    $('stu-form');


  if (!form.checkValidity()) {

    form.reportValidity();

    return;

  }


  const data = {

    name:
      $('stu-name')
        .value
        .trim(),

    email:
      $('stu-email')
        .value
        .trim(),

    courseId:
      $('stu-course')
        .value,

    grade:
      $('stu-grade')
        .value,

    status:
      $('stu-status')
        .value

  };


  try {

    let id =
      $('stu-id').value;


    /* =========================
       ADD NEW STUDENT
    ========================= */

    if (!id) {

      /*
       * First create the student.
       */
      const newStudent =
        await addStudent({

          ...data,

          attendanceRate: 0

        });


      id =
        newStudent.id;


      /*
       * Immediately create the attendance
       * record for the selected date.
       *
       * This fixes the "No record" problem
       * for newly added students.
       */
      await recordAttendance({

        studentId: id,

        date:
          $('stu-date').value,

        status:
          $('stu-attendance').value

      });

    }


    /* =========================
       EDIT EXISTING STUDENT
    ========================= */

    else {

      /*
       * Update student information.
       */
      await updateStudent(
        id,
        data
      );


      /*
       * If the student already has
       * an attendance record, update it.
       */
      if (editingAttendanceId) {

        await updateAttendanceRecord(

          editingAttendanceId,

          {

            studentId: id,

            /*
             * IMPORTANT:
             * This is the new date.
             */
            date:
              $('stu-date').value,

            status:
              $('stu-attendance').value

          }

        );

      }


      /*
       * If there was no previous attendance
       * record, create a new one.
       */
      else {

        await recordAttendance({

          studentId: id,

          date:
            $('stu-date').value,

          status:
            $('stu-attendance').value

        });

      }

    }


    /*
     * Close dialog and reload
     * fresh data from JSON Server.
     */
    closeDialog();


    await reload();

  }

  catch (err) {

    showAlert(

      $('stu-form-error'),

      err.message

    );

  }

}


/* =========================
   TABLE BUTTONS
========================= */

async function onTableClick(
  event
) {

  const btn =
    event.target.closest(
      'button[data-action]'
    );


  if (!btn) {
    return;
  }


  const student =
    students.find(
      (s) =>
        sameId(
          s.id,
          btn.dataset.id
        )
    );


  if (!student) {
    return;
  }


  /* =========================
     EDIT
  ========================= */

  if (
    btn.dataset.action ===
    'edit'
  ) {

    openDialog(
      student
    );

    return;

  }


  /* =========================
     DELETE
  ========================= */

  if (

    btn.dataset.action ===
      'delete'

    &&

    confirm(
      `Delete ${student.name}?`
    )

  ) {

    try {

      await deleteStudent(
        student.id
      );


      await reload();

    }

    catch (err) {

      showAlert(
        $('stu-alert'),
        err.message
      );

    }

  }

}


/* =========================
   EVENTS
========================= */


/*
 * Add student
 */
$('stu-add-btn')
  .addEventListener(
    'click',
    () =>
      openDialog()
  );


/*
 * Close
 */
$('stu-close')
  .addEventListener(
    'click',
    closeDialog
  );


/*
 * Cancel
 */
$('stu-cancel')
  .addEventListener(
    'click',
    closeDialog
  );


/*
 * Submit form
 */
$('stu-form')
  .addEventListener(
    'submit',
    onSubmit
  );


/*
 * Change attendance date
 */
$('stu-date')
  .addEventListener(
    'change',
    syncAttendanceFromDate
  );


/*
 * Table buttons
 */
$('stu-tbody')
  .addEventListener(
    'click',
    onTableClick
  );


/*
 * Course filter
 */
$('stu-filter-course')
  .addEventListener(
    'change',
    (event) => {

      filters.courseId =
        event.target.value;

      render();

    }
  );


/*
 * Status filter
 */
$('stu-filter-status')
  .addEventListener(
    'change',
    (event) => {

      filters.status =
        event.target.value;

      render();

    }
  );


/*
 * Date filter
 */
$('stu-filter-date')
  .addEventListener(
    'change',
    (event) => {

      filters.date =
        event.target.value;

      render();

    }
  );


/*
 * Attendance filter
 */
$('stu-filter-attendance')
  .addEventListener(
    'change',
    (event) => {

      filters.attendance =
        event.target.value;

      render();

    }
  );


/*
 * Clear date
 */
$('stu-clear-date')
  .addEventListener(
    'click',
    () => {

      filters.date = '';

      $('stu-filter-date')
        .value = '';

      render();

    }
  );


/* =========================
   START
========================= */

init();
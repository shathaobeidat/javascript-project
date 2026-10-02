// =========================================================
// Gradify - Add Course page
// =========================================================

import {
  getCourses,
  addCourse,
  deleteCourse,
  requireInstructor
} from './apiservice.js';


/*
 * Instructor-specific page: redirects to login.html when nobody is logged in.
 * getCourses/addCourse/deleteCourse only work on the current instructor's courses.
 */
requireInstructor();


/* =========================
   HELPERS
========================= */

const $ = (id) =>
  document.getElementById(id);


const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char])
  );


/* =========================
   MESSAGES
========================= */

function setMessage(
  id,
  text
) {

  const element =
    $(id);

  if (!element) {
    return;
  }

  element.textContent =
    text || '';

  element.hidden =
    !text;

}


/* =========================
   LOADING STATE
========================= */

function setSubmitLoading(
  loading
) {

  const button =
    $('crs-submit');

  const normalText =
    $('crs-submit-text');

  const loadingText =
    $('crs-submit-loading');


  if (!button) {
    return;
  }


  button.disabled =
    loading;


  if (normalText) {

    normalText.hidden =
      loading;

  }


  if (loadingText) {

    loadingText.hidden =
      !loading;

  }

}


/* =========================
   RENDER COURSES
========================= */

async function renderCourses(
  newCode = ''
) {

  const list =
    $('crs-list');

  const empty =
    $('crs-empty');

  const count =
    $('crs-count');

  const loading =
    $('crs-loading-list');


  if (!list) {
    return;
  }


  try {

    if (loading) {
      loading.hidden = false;
    }

    list.innerHTML = '';

    if (empty) {
      empty.hidden = true;
    }


    /*
     * Get courses directly from
     * JSON Server.
     */
    const courses =
      await getCourses();


    /* =========================
       COUNT
    ========================== */

    if (count) {

      count.textContent =
        courses.length;

    }


    /* =========================
       EMPTY STATE
    ========================== */

    if (!courses.length) {

      if (empty) {
        empty.hidden = false;
      }

      return;

    }


    /* =========================
       COURSE LIST
    ========================== */

    list.innerHTML =

      courses
        .map(
          (course) => {

            const code =
              esc(course.code);

            const name =
              esc(course.name);

            const id =
              esc(course.id);


            const isNew =
              String(course.code)
                .toUpperCase() ===
              String(newCode)
                .toUpperCase();


            return `

              <li
                class="crs-item${
                  isNew
                    ? ' crs-item--new'
                    : ''
                }"
              >

                <span
                  class="crs-code"
                >
                  ${code}
                </span>


                <span
                  class="crs-name"
                  title="${name}"
                >
                  ${name}
                </span>


                <button
                  type="button"
                  class="crs-del"
                  data-id="${id}"
                  data-code="${code}"
                  aria-label="Delete course ${code}"
                  title="Delete course"
                >

                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >

                    <path
                      d="M3 6h18"
                    />

                    <path
                      d="M8 6V4h8v2"
                    />

                    <path
                      d="M6 6l1 14h10l1-14"
                    />

                    <path
                      d="M10 11v6"
                    />

                    <path
                      d="M14 11v6"
                    />

                  </svg>

                </button>

              </li>

            `;

          }
        )
        .join('');

  }

  catch (error) {

    setMessage(
      'crs-error',
      error?.message ||
        'Unable to load courses.'
    );

  }

  finally {

    if (loading) {

      loading.hidden =
        true;

    }

  }

}


/* =========================
   ADD COURSE
========================= */

async function onSubmit(
  event
) {

  event.preventDefault();


  setMessage(
    'crs-error',
    ''
  );

  setMessage(
    'crs-success',
    ''
  );


  const form =
    $('crs-form');


  if (!form) {
    return;
  }


  /*
   * Browser validation.
   */
  if (!form.checkValidity()) {

    form.reportValidity();

    return;

  }


  /*
   * Read values.
   */
  const code =
    $('crs-code')
      .value
      .trim()
      .toUpperCase();


  const name =
    $('crs-name')
      .value
      .trim();


  /*
   * Extra validation after trim.
   */
  if (!code || !name) {

    setMessage(
      'crs-error',
      'Course code and course name cannot be empty.'
    );

    return;

  }


  setSubmitLoading(true);


  try {

    /*
     * addCourse() checks:
     *
     * - duplicate course code
     * - duplicate course name
     *
     * and then sends POST /courses.
     */
    await addCourse({
      code,
      name
    });


    /*
     * Clear form.
     */
    form.reset();


    /*
     * Show success message.
     */
    setMessage(
      'crs-success',
      `Course ${code} was added successfully.`
    );


    /*
     * Reload the courses list.
     */
    await renderCourses(
      code
    );

  }

  catch (error) {

    setMessage(
      'crs-error',
      error?.message ||
        'Unable to add the course.'
    );

  }

  finally {

    setSubmitLoading(false);

  }

}


/* =========================
   DELETE COURSE
========================= */

async function onDelete(
  event
) {

  const button =
    event.target.closest(
      '.crs-del'
    );


  if (!button) {
    return;
  }


  setMessage(
    'crs-error',
    ''
  );

  setMessage(
    'crs-success',
    ''
  );


  const id =
    button.dataset.id;


  const code =
    button.dataset.code;


  if (!id) {

    setMessage(
      'crs-error',
      'Course ID is missing.'
    );

    return;

  }


  /*
   * Confirmation.
   */
  const confirmed =
    window.confirm(
      `Delete course ${code}? This cannot be undone.`
    );


  if (!confirmed) {
    return;
  }


  button.disabled =
    true;


  try {

    /*
     * deleteCourse() also checks whether
     * students or tasks are still assigned
     * to this course.
     */
    await deleteCourse(
      id
    );


    setMessage(
      'crs-success',
      `Course ${code} was deleted successfully.`
    );


    await renderCourses();

  }

  catch (error) {

    setMessage(
      'crs-error',
      error?.message ||
        'Unable to delete the course.'
    );


    /*
     * Re-enable the button if deletion failed.
     */
    button.disabled =
      false;

  }

}


/* =========================
   RESET FORM
========================= */

function onReset() {

  setMessage(
    'crs-error',
    ''
  );

  setMessage(
    'crs-success',
    ''
  );

}


/* =========================
   INITIALIZE PAGE
========================= */

function init() {

  const form =
    $('crs-form');


  const list =
    $('crs-list');


  const reset =
    $('crs-reset');


  /*
   * Safety check.
   */
  if (!form || !list) {

    console.error(
      'Add Course page: required elements are missing.'
    );

    return;

  }


  /*
   * Form submit.
   */
  form.addEventListener(
    'submit',
    onSubmit
  );


  /*
   * Course deletion.
   */
  list.addEventListener(
    'click',
    onDelete
  );


  /*
   * Reset.
   */
  if (reset) {

    reset.addEventListener(
      'click',
      onReset
    );

  }


  /*
   * Load courses.
   */
  renderCourses();

}


/* =========================
   START
========================= */

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    init,
    {
      once: true
    }
  );

}

else {

  init();

}
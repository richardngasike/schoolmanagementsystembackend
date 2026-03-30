const { query, withTransaction } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

// ═══════════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════════════
const getDepartments = asyncHandler(async (req, res) => {
  const r = await query(`
    SELECT d.*, u.first_name||' '||u.last_name AS head_name,
           COUNT(c.id) AS course_count
    FROM departments d
    LEFT JOIN users u ON u.id = d.head_id
    LEFT JOIN courses c ON c.department_id = d.id AND c.is_active = TRUE
    WHERE d.is_active = TRUE
    GROUP BY d.id, u.first_name, u.last_name
    ORDER BY d.name
  `);
  res.json({ success: true, data: r.rows });
});

const createDepartment = asyncHandler(async (req, res) => {
  const { code, name, description, head_id } = req.body;
  const r = await query(
    `INSERT INTO departments (code, name, description, head_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [code.toUpperCase(), name, description||null, head_id||null]
  );
  res.status(201).json({ success: true, message: 'Department created.', data: r.rows[0] });
});

const updateDepartment = asyncHandler(async (req, res) => {
  const { name, description, head_id } = req.body;
  const r = await query(
    `UPDATE departments SET name=COALESCE($1,name), description=COALESCE($2,description),
     head_id=COALESCE($3,head_id), updated_at=NOW() WHERE id=$4 RETURNING *`,
    [name, description, head_id, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Department not found.' });
  res.json({ success: true, data: r.rows[0] });
});

// ═══════════════════════════════════════════════════════════════════════
// COURSES
// ═══════════════════════════════════════════════════════════════════════
const getCourses = asyncHandler(async (req, res) => {
  const { department_id, level, active = 'true' } = req.query;
  const conditions = ['c.is_active = $1'];
  const params = [active === 'true'];
  let p = 2;
  if (department_id) { conditions.push(`c.department_id=$${p++}`); params.push(department_id); }
  if (level)         { conditions.push(`c.level=$${p++}`);          params.push(level); }

  const r = await query(`
    SELECT c.*, d.name AS department_name,
           COUNT(DISTINCT e.student_id) AS enrolled_count,
           COUNT(DISTINCT u.id) AS unit_count
    FROM courses c
    LEFT JOIN departments d ON d.id = c.department_id
    LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
    LEFT JOIN units u ON u.course_id = c.id AND u.is_active = TRUE
    WHERE ${conditions.join(' AND ')}
    GROUP BY c.id, d.name
    ORDER BY c.name
  `, params);
  res.json({ success: true, data: r.rows });
});

const getCourse = asyncHandler(async (req, res) => {
  const r = await query(`
    SELECT c.*, d.name AS department_name
    FROM courses c LEFT JOIN departments d ON d.id=c.department_id
    WHERE c.id=$1
  `, [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Course not found.' });

  const units = await query(`
    SELECT u.*, ul.first_name||' '||ul.last_name AS lecturer_name
    FROM units u LEFT JOIN users ul ON ul.id=u.lecturer_id
    WHERE u.course_id=$1 AND u.is_active=TRUE ORDER BY u.semester_num, u.name
  `, [req.params.id]);

  res.json({ success: true, data: { ...r.rows[0], units: units.rows } });
});

const createCourse = asyncHandler(async (req, res) => {
  const { code, name, department_id, level, duration_months, credit_hours,
          description, requirements, annual_fee, max_students } = req.body;
  const r = await query(`
    INSERT INTO courses (code, name, department_id, level, duration_months,
      credit_hours, description, requirements, annual_fee, max_students)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
  `, [code, name, department_id, level, duration_months||12, credit_hours||0,
      description, requirements, annual_fee||0, max_students||60]);
  res.status(201).json({ success: true, data: r.rows[0] });
});

const updateCourse = asyncHandler(async (req, res) => {
  const fields = ['name','description','requirements','annual_fee','max_students','duration_months','is_active'];
  const updates = []; const params = []; let p = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f}=$${p++}`); params.push(req.body[f]); }
  }
  params.push(req.params.id);
  const r = await query(`UPDATE courses SET ${updates.join(',')},updated_at=NOW() WHERE id=$${p} RETURNING *`, params);
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Course not found.' });
  res.json({ success: true, data: r.rows[0] });
});

// ═══════════════════════════════════════════════════════════════════════
// UNITS
// ═══════════════════════════════════════════════════════════════════════
const getUnits = asyncHandler(async (req, res) => {
  const { course_id, lecturer_id } = req.query;
  const conditions = ['u.is_active=TRUE'];
  const params = []; let p = 1;
  if (course_id)   { conditions.push(`u.course_id=$${p++}`);   params.push(course_id); }
  if (lecturer_id) { conditions.push(`u.lecturer_id=$${p++}`); params.push(lecturer_id); }

  const r = await query(`
    SELECT u.*, c.name AS course_name, c.code AS course_code,
           ul.first_name||' '||ul.last_name AS lecturer_name
    FROM units u
    LEFT JOIN courses c ON c.id=u.course_id
    LEFT JOIN users ul ON ul.id=u.lecturer_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY u.semester_num, u.name
  `, params);
  res.json({ success: true, data: r.rows });
});

const createUnit = asyncHandler(async (req, res) => {
  const { code, name, course_id, lecturer_id, credit_hours, semester_num } = req.body;
  const r = await query(`
    INSERT INTO units (code, name, course_id, lecturer_id, credit_hours, semester_num)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [code, name, course_id, lecturer_id||null, credit_hours||3, semester_num||1]);
  res.status(201).json({ success: true, data: r.rows[0] });
});

const assignLecturer = asyncHandler(async (req, res) => {
  const { lecturer_id } = req.body;
  const r = await query(
    `UPDATE units SET lecturer_id=$1 WHERE id=$2 RETURNING *`,
    [lecturer_id, req.params.id]
  );
  res.json({ success: true, data: r.rows[0] });
});

// ═══════════════════════════════════════════════════════════════════════
// ENROLLMENTS
// ═══════════════════════════════════════════════════════════════════════
const getEnrollments = asyncHandler(async (req, res) => {
  const { course_id, student_id, academic_year_id } = req.query;
  const conditions = []; const params = []; let p = 1;
  if (course_id)       { conditions.push(`e.course_id=$${p++}`);       params.push(course_id); }
  if (student_id)      { conditions.push(`e.student_id=$${p++}`);      params.push(student_id); }
  if (academic_year_id){ conditions.push(`e.academic_year_id=$${p++}`);params.push(academic_year_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const r = await query(`
    SELECT e.*, u.first_name, u.last_name, u.student_id AS reg_no,
           c.name AS course_name, c.code AS course_code,
           ay.name AS academic_year
    FROM enrollments e
    JOIN users u ON u.id=e.student_id
    JOIN courses c ON c.id=e.course_id
    JOIN academic_years ay ON ay.id=e.academic_year_id
    ${where}
    ORDER BY e.enrolled_date DESC
  `, params);
  res.json({ success: true, data: r.rows });
});

const enroll = asyncHandler(async (req, res) => {
  const { student_id, course_id, academic_year_id, semester_id, year_of_study } = req.body;

  // Verify student exists
  const stRes = await query(`SELECT id, role FROM users WHERE id=$1 AND role='student'`, [student_id]);
  if (!stRes.rows.length) return res.status(404).json({ success: false, message: 'Student not found.' });

  const r = await query(`
    INSERT INTO enrollments (student_id, course_id, academic_year_id, semester_id, year_of_study, created_by)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [student_id, course_id, academic_year_id, semester_id||null, year_of_study||1, req.user.id]);

  res.status(201).json({ success: true, message: 'Student enrolled.', data: r.rows[0] });
});

// ═══════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════
const getResults = asyncHandler(async (req, res) => {
  const { student_id, unit_id, semester_id, published } = req.query;
  const conditions = []; const params = []; let p = 1;

  // Students can only see their own published results
  if (req.user.role === 'student') {
    conditions.push(`r.student_id=$${p++}`); params.push(req.user.id);
    conditions.push(`r.is_published=TRUE`);
  } else {
    if (student_id) { conditions.push(`r.student_id=$${p++}`); params.push(student_id); }
    if (published !== undefined) { conditions.push(`r.is_published=$${p++}`); params.push(published==='true'); }
  }
  if (unit_id)    { conditions.push(`r.unit_id=$${p++}`);    params.push(unit_id); }
  if (semester_id){ conditions.push(`r.semester_id=$${p++}`);params.push(semester_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const r = await query(`
    SELECT r.*,
           u.first_name||' '||u.last_name AS student_name,
           u.student_id AS reg_no,
           un.name AS unit_name, un.code AS unit_code,
           s.name AS semester_name,
           ay.name AS academic_year,
           eb.first_name||' '||eb.last_name AS entered_by_name
    FROM results r
    JOIN users u ON u.id=r.student_id
    JOIN units un ON un.id=r.unit_id
    JOIN semesters s ON s.id=r.semester_id
    JOIN academic_years ay ON ay.id=r.academic_year_id
    LEFT JOIN users eb ON eb.id=r.entered_by
    ${where}
    ORDER BY r.created_at DESC
  `, params);
  res.json({ success: true, data: r.rows });
});

const getStudentTranscript = asyncHandler(async (req, res) => {
  const studentId = req.params.id === 'me' ? req.user.id : req.params.id;

  const studentRes = await query(
    `SELECT id, first_name, last_name, student_id, email, gender FROM users WHERE id=$1`,
    [studentId]
  );
  if (!studentRes.rows.length) return res.status(404).json({ success: false, message: 'Student not found.' });

  const results = await query(`
    SELECT r.*, un.name AS unit_name, un.code AS unit_code, un.credit_hours,
           s.name AS semester_name, ay.name AS academic_year,
           c.name AS course_name
    FROM results r
    JOIN units un ON un.id=r.unit_id
    JOIN courses c ON c.id=un.course_id
    JOIN semesters s ON s.id=r.semester_id
    JOIN academic_years ay ON ay.id=r.academic_year_id
    WHERE r.student_id=$1 AND r.is_published=TRUE
    ORDER BY ay.name, s.name, un.name
  `, [studentId]);

  // Calculate GPA
  const totalPoints = results.rows.reduce((sum, r) => sum + (parseFloat(r.grade_points)||0) * (r.credit_hours||3), 0);
  const totalCredits = results.rows.reduce((sum, r) => sum + (r.credit_hours||3), 0);
  const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 0;

  res.json({
    success: true,
    student: studentRes.rows[0],
    results: results.rows,
    gpa,
    total_units: results.rows.length,
    passed: results.rows.filter(r => (r.total_score||0) >= 40).length,
  });
});

const enterResults = asyncHandler(async (req, res) => {
  const { student_id, unit_id, semester_id, academic_year_id,
          cat1_score, cat2_score, assignment_score, exam_score } = req.body;

  const r = await query(`
    INSERT INTO results (student_id, unit_id, semester_id, academic_year_id,
      cat1_score, cat2_score, assignment_score, exam_score, entered_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (student_id, unit_id, semester_id)
    DO UPDATE SET cat1_score=$5, cat2_score=$6, assignment_score=$7, exam_score=$8,
      entered_by=$9, updated_at=NOW()
    RETURNING *
  `, [student_id, unit_id, semester_id, academic_year_id,
      cat1_score||0, cat2_score||0, assignment_score||0, exam_score||0, req.user.id]);

  // Update grade
  await query(`
    UPDATE results SET
      grade = compute_grade(total_score),
      grade_points = compute_grade_points(total_score),
      remarks = CASE WHEN total_score >= 40 THEN 'Pass' ELSE 'Fail' END
    WHERE id=$1
  `, [r.rows[0].id]);

  res.json({ success: true, message: 'Result saved.', data: r.rows[0] });
});

const bulkEnterResults = asyncHandler(async (req, res) => {
  const { unit_id, semester_id, academic_year_id, results } = req.body;
  // results = [{student_id, cat1_score, cat2_score, assignment_score, exam_score}]

  let saved = 0;
  for (const row of results) {
    await query(`
      INSERT INTO results (student_id, unit_id, semester_id, academic_year_id,
        cat1_score, cat2_score, assignment_score, exam_score, entered_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (student_id, unit_id, semester_id)
      DO UPDATE SET cat1_score=$5, cat2_score=$6, assignment_score=$7, exam_score=$8,
        entered_by=$9, updated_at=NOW()
    `, [row.student_id, unit_id, semester_id, academic_year_id,
        row.cat1_score||0, row.cat2_score||0, row.assignment_score||0, row.exam_score||0, req.user.id]);
    saved++;
  }

  // Compute all grades
  await query(`
    UPDATE results SET
      grade = compute_grade(total_score),
      grade_points = compute_grade_points(total_score),
      remarks = CASE WHEN total_score >= 40 THEN 'Pass' ELSE 'Fail' END
    WHERE unit_id=$1 AND semester_id=$2
  `, [unit_id, semester_id]);

  res.json({ success: true, message: `${saved} results saved.` });
});

const publishResults = asyncHandler(async (req, res) => {
  const { unit_id, semester_id } = req.body;
  const r = await query(
    `UPDATE results SET is_published=TRUE, approved_by=$1 WHERE unit_id=$2 AND semester_id=$3 RETURNING id`,
    [req.user.id, unit_id, semester_id]
  );

  // Notify students
  const studRes = await query(
    `SELECT DISTINCT r.student_id, un.name AS unit_name
     FROM results r JOIN units un ON un.id=r.unit_id
     WHERE r.unit_id=$1 AND r.semester_id=$2`,
    [unit_id, semester_id]
  );
  for (const s of studRes.rows) {
    await query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES ($1,'Results Published',$2,'result','/dashboard/results')`,
      [s.student_id, `Your results for ${s.unit_name} have been published.`]
    );
  }

  res.json({ success: true, message: `${r.rowCount} results published.` });
});

// ═══════════════════════════════════════════════════════════════════════
// FEES
// ═══════════════════════════════════════════════════════════════════════
const getFeeStructures = asyncHandler(async (req, res) => {
  const { course_id, academic_year_id } = req.query;
  const conditions = []; const params = []; let p = 1;
  if (course_id)       { conditions.push(`f.course_id=$${p++}`);       params.push(course_id); }
  if (academic_year_id){ conditions.push(`f.academic_year_id=$${p++}`);params.push(academic_year_id); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const r = await query(`
    SELECT f.*, c.name AS course_name, ay.name AS academic_year, s.name AS semester_name
    FROM fee_structures f
    JOIN courses c ON c.id=f.course_id
    JOIN academic_years ay ON ay.id=f.academic_year_id
    LEFT JOIN semesters s ON s.id=f.semester_id
    ${where}
    ORDER BY f.course_id, f.fee_type
  `, params);
  res.json({ success: true, data: r.rows });
});

const createFeeStructure = asyncHandler(async (req, res) => {
  const { course_id, academic_year_id, semester_id, fee_type, amount, due_date, description } = req.body;
  const r = await query(`
    INSERT INTO fee_structures (course_id, academic_year_id, semester_id, fee_type, amount, due_date, description, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (course_id, academic_year_id, fee_type)
    DO UPDATE SET amount=$5, due_date=$6, description=$7
    RETURNING *
  `, [course_id, academic_year_id, semester_id||null, fee_type, amount, due_date||null, description||null, req.user.id]);
  res.status(201).json({ success: true, data: r.rows[0] });
});

const getStudentInvoices = asyncHandler(async (req, res) => {
  const studentId = req.user.role === 'student' ? req.user.id : (req.params.student_id || req.query.student_id);
  const r = await query(`
    SELECT fi.*, c.name AS course_name, ay.name AS academic_year,
           s.name AS semester_name,
           ib.first_name||' '||ib.last_name AS issued_by_name
    FROM fee_invoices fi
    JOIN courses c ON c.id=fi.course_id
    JOIN academic_years ay ON ay.id=fi.academic_year_id
    LEFT JOIN semesters s ON s.id=fi.semester_id
    LEFT JOIN users ib ON ib.id=fi.issued_by
    WHERE fi.student_id=$1
    ORDER BY fi.issued_at DESC
  `, [studentId]);
  res.json({ success: true, data: r.rows });
});

const issueInvoice = asyncHandler(async (req, res) => {
  const { student_id, course_id, academic_year_id, semester_id, total_amount, due_date, notes } = req.body;

  // Generate invoice number
  const countR = await query(`SELECT COUNT(*) FROM fee_invoices`);
  const invNo = `INV-${new Date().getFullYear()}-${String(parseInt(countR.rows[0].count)+1).padStart(4,'0')}`;

  const r = await query(`
    INSERT INTO fee_invoices (invoice_number, student_id, course_id, academic_year_id,
      semester_id, total_amount, due_date, notes, issued_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [invNo, student_id, course_id, academic_year_id, semester_id||null,
      total_amount, due_date||null, notes||null, req.user.id]);

  // Notify student
  await query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     VALUES ($1,'Fee Invoice Issued',$2,'fee','/dashboard/fees')`,
    [student_id, `A fee invoice of KES ${Number(total_amount).toLocaleString()} has been issued. Invoice: ${invNo}`]
  );

  res.status(201).json({ success: true, data: r.rows[0] });
});

const recordPayment = asyncHandler(async (req, res) => {
  const { invoice_id, amount, payment_method, reference_no, notes } = req.body;

  const invRes = await query(`SELECT * FROM fee_invoices WHERE id=$1`, [invoice_id]);
  if (!invRes.rows.length) return res.status(404).json({ success: false, message: 'Invoice not found.' });
  const inv = invRes.rows[0];

  await withTransaction(async (client) => {
    await client.query(`
      INSERT INTO fee_payments (invoice_id, student_id, amount, payment_method, reference_no, received_by)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [invoice_id, inv.student_id, amount, payment_method||'cash', reference_no||null, req.user.id]);

    const newPaid = parseFloat(inv.amount_paid) + parseFloat(amount);
    const newStatus = newPaid >= parseFloat(inv.total_amount) ? 'paid'
                    : newPaid > 0 ? 'partial' : 'unpaid';

    await client.query(
      `UPDATE fee_invoices SET amount_paid=$1, status=$2, updated_at=NOW() WHERE id=$3`,
      [newPaid, newStatus, invoice_id]
    );
  });

  await query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     VALUES ($1,'Payment Received',$2,'fee','/dashboard/fees')`,
    [inv.student_id, `Payment of KES ${Number(amount).toLocaleString()} received. Reference: ${reference_no||'—'}`]
  );

  res.json({ success: true, message: `Payment of KES ${amount} recorded.` });
});

const getPaymentHistory = asyncHandler(async (req, res) => {
  const { invoice_id, student_id } = req.query;
  const conditions = []; const params = []; let p = 1;
  if (invoice_id) { conditions.push(`fp.invoice_id=$${p++}`); params.push(invoice_id); }
  if (student_id) { conditions.push(`fp.student_id=$${p++}`); params.push(student_id); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const r = await query(`
    SELECT fp.*, fi.invoice_number, u.first_name||' '||u.last_name AS received_by_name
    FROM fee_payments fp
    JOIN fee_invoices fi ON fi.id=fp.invoice_id
    LEFT JOIN users u ON u.id=fp.received_by
    ${where}
    ORDER BY fp.payment_date DESC
  `, params);
  res.json({ success: true, data: r.rows });
});

// ═══════════════════════════════════════════════════════════════════════
// APPLICATIONS
// ═══════════════════════════════════════════════════════════════════════
const getApplications = asyncHandler(async (req, res) => {
  const { status, course_id, search, page=1, limit=20 } = req.query;
  const conditions = []; const params = []; let p = 1;
  if (status)    { conditions.push(`a.status=$${p++}`);    params.push(status); }
  if (course_id) { conditions.push(`a.course_id=$${p++}`); params.push(course_id); }
  if (search)    {
    conditions.push(`(a.first_name ILIKE $${p} OR a.last_name ILIKE $${p} OR a.email ILIKE $${p} OR a.reference_number ILIKE $${p})`);
    params.push(`%${search}%`); p++;
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);

  const count = await query(`SELECT COUNT(*) FROM applications a ${where}`, params);
  const r = await query(`
    SELECT a.*, c.name AS course_name, c.code AS course_code,
           rb.first_name||' '||rb.last_name AS reviewed_by_name
    FROM applications a
    LEFT JOIN courses c ON c.id=a.course_id
    LEFT JOIN users rb ON rb.id=a.reviewed_by
    ${where}
    ORDER BY a.created_at DESC
    LIMIT $${p} OFFSET $${p+1}
  `, [...params, parseInt(limit), offset]);

  res.json({
    success: true, data: r.rows,
    pagination: {
      total: parseInt(count.rows[0].count),
      page: parseInt(page), limit: parseInt(limit),
      pages: Math.ceil(parseInt(count.rows[0].count)/parseInt(limit)),
    },
    stats: await getAppStats(),
  });
});

async function getAppStats() {
  const r = await query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status='pending') AS pending,
      COUNT(*) FILTER (WHERE status='under_review') AS under_review,
      COUNT(*) FILTER (WHERE status='approved') AS approved,
      COUNT(*) FILTER (WHERE status='rejected') AS rejected
    FROM applications
  `);
  return r.rows[0];
}

const submitApplication = asyncHandler(async (req, res) => {
  const {
    first_name, last_name, email, phone, date_of_birth, gender, national_id, county,
    school_name, kcse_grade, kcse_year, other_qualification,
    course_id, intake, study_mode, declaration_accepted,
  } = req.body;

  const count = await query(`SELECT COUNT(*) FROM applications`);
  const ref = `SJC-APP-${String(parseInt(count.rows[0].count)+1).padStart(4,'0')}`;

  const r = await query(`
    INSERT INTO applications (reference_number, applicant_user_id, first_name, last_name,
      email, phone, date_of_birth, gender, national_id, county, school_name, kcse_grade,
      kcse_year, other_qualification, course_id, intake, study_mode, declaration_accepted)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    RETURNING id, reference_number, first_name, last_name, email, course_id, status, created_at
  `, [
    ref, req.user?.id||null, first_name, last_name, email, phone||null,
    date_of_birth||null, gender||null, national_id||null, county||null,
    school_name||null, kcse_grade||null, kcse_year||null, other_qualification||null,
    course_id||null, intake||null, study_mode||null, declaration_accepted||false,
  ]);

  res.status(201).json({ success: true, message: 'Application submitted.', data: r.rows[0] });
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, review_notes } = req.body;
  const r = await query(`
    UPDATE applications SET status=$1, review_notes=$2, reviewed_by=$3,
      reviewed_at=NOW(), updated_at=NOW()
    WHERE id=$4 RETURNING *
  `, [status, review_notes||null, req.user.id, req.params.id]);

  if (!r.rows.length) return res.status(404).json({ success: false, message: 'Application not found.' });

  const app = r.rows[0];
  if (app.applicant_user_id) {
    await query(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,'application','/dashboard/applications')`,
      [app.applicant_user_id, 'Application Update', `Your application ${app.reference_number} is now: ${status.replace('_',' ')}.`]
    );
  }

  res.json({ success: true, message: 'Status updated.', data: r.rows[0] });
});

// ═══════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════════════
const getAnnouncements = asyncHandler(async (req, res) => {
  const userRole = req.user.role;
  const r = await query(`
    SELECT a.*, u.first_name||' '||u.last_name AS author_name
    FROM announcements a
    LEFT JOIN users u ON u.id=a.author_id
    WHERE a.is_published=TRUE
      AND (a.target_roles='all' OR a.target_roles LIKE $1 OR a.target_roles LIKE $2 OR a.target_roles LIKE $3)
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
    ORDER BY
      CASE a.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
      a.created_at DESC
    LIMIT 30
  `, [`%${userRole}%`, `${userRole},%`, `%,${userRole}`]);
  res.json({ success: true, data: r.rows });
});

const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, content, target_roles, priority, expires_at } = req.body;
  const r = await query(`
    INSERT INTO announcements (title, content, target_roles, priority, expires_at, author_id)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [title, content, target_roles||'all', priority||'normal', expires_at||null, req.user.id]);
  res.status(201).json({ success: true, data: r.rows[0] });
});

const deleteAnnouncement = asyncHandler(async (req, res) => {
  await query(`UPDATE announcements SET is_published=FALSE WHERE id=$1`, [req.params.id]);
  res.json({ success: true, message: 'Announcement removed.' });
});

// ═══════════════════════════════════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════════════════════════════════
const recordAttendance = asyncHandler(async (req, res) => {
  const { unit_id, date, records } = req.body;
  // records = [{student_id, status, remarks}]
  for (const rec of records) {
    await query(`
      INSERT INTO attendance (student_id, unit_id, date, status, remarks, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (student_id, unit_id, date) DO UPDATE SET status=$4, remarks=$5
    `, [rec.student_id, unit_id, date||new Date().toISOString().split('T')[0], rec.status||'present', rec.remarks||null, req.user.id]);
  }
  res.json({ success: true, message: `${records.length} attendance records saved.` });
});

const getAttendance = asyncHandler(async (req, res) => {
  const { student_id, unit_id, date_from, date_to } = req.query;
  const sid = req.user.role === 'student' ? req.user.id : student_id;

  const conditions = []; const params = []; let p = 1;
  if (sid)       { conditions.push(`a.student_id=$${p++}`); params.push(sid); }
  if (unit_id)   { conditions.push(`a.unit_id=$${p++}`);   params.push(unit_id); }
  if (date_from) { conditions.push(`a.date>=$${p++}`);     params.push(date_from); }
  if (date_to)   { conditions.push(`a.date<=$${p++}`);     params.push(date_to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const r = await query(`
    SELECT a.*, u.first_name||' '||u.last_name AS student_name,
           un.name AS unit_name, un.code AS unit_code
    FROM attendance a
    JOIN users u ON u.id=a.student_id
    JOIN units un ON un.id=a.unit_id
    ${where}
    ORDER BY a.date DESC, u.last_name
  `, params);
  res.json({ success: true, data: r.rows });
});

// ═══════════════════════════════════════════════════════════════════════
// SECURITY LOG
// ═══════════════════════════════════════════════════════════════════════
const getSecurityLog = asyncHandler(async (req, res) => {
  const { date, person_type, page=1, limit=50 } = req.query;
  const conditions = []; const params = []; let p = 1;
  if (date)        { conditions.push(`DATE(s.logged_at)=$${p++}`); params.push(date); }
  if (person_type) { conditions.push(`s.person_type=$${p++}`);    params.push(person_type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);

  const r = await query(`
    SELECT s.*, lb.first_name||' '||lb.last_name AS logged_by_name
    FROM security_log s
    LEFT JOIN users lb ON lb.id=s.logged_by
    ${where}
    ORDER BY s.logged_at DESC
    LIMIT $${p} OFFSET $${p+1}
  `, [...params, parseInt(limit), offset]);
  res.json({ success: true, data: r.rows });
});

const logEntry = asyncHandler(async (req, res) => {
  const { person_name, person_type, user_id, action, purpose, badge_number, vehicle_reg } = req.body;
  const r = await query(`
    INSERT INTO security_log (logged_by, person_name, person_type, user_id, action, purpose, badge_number, vehicle_reg)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [req.user.id, person_name, person_type||'visitor', user_id||null, action, purpose||null, badge_number||null, vehicle_reg||null]);
  res.status(201).json({ success: true, data: r.rows[0] });
});

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════
const getDashboardStats = asyncHandler(async (req, res) => {
  const role = req.user.role;

  if (role === 'student') {
    const [invoices, results, attendance] = await Promise.all([
      query(`SELECT * FROM fee_invoices WHERE student_id=$1 ORDER BY issued_at DESC LIMIT 5`, [req.user.id]),
      query(`SELECT r.*, un.name AS unit_name, un.code FROM results r JOIN units un ON un.id=r.unit_id WHERE r.student_id=$1 AND r.is_published=TRUE ORDER BY r.updated_at DESC`, [req.user.id]),
      query(`SELECT status, COUNT(*) FROM attendance WHERE student_id=$1 GROUP BY status`, [req.user.id]),
    ]);
    return res.json({ success: true, data: { invoices: invoices.rows, results: results.rows, attendance: attendance.rows } });
  }

  // Admin/staff stats
  const [users, enrollments, applications, revenue] = await Promise.all([
    query(`SELECT role, COUNT(*) FROM users WHERE is_active=TRUE GROUP BY role`),
    query(`SELECT status, COUNT(*) FROM enrollments GROUP BY status`),
    query(`SELECT status, COUNT(*) FROM applications GROUP BY status`),
    query(`SELECT COALESCE(SUM(amount_paid),0) AS collected, COALESCE(SUM(total_amount),0) AS expected FROM fee_invoices`),
  ]);

  res.json({
    success: true,
    data: {
      users: users.rows,
      enrollments: enrollments.rows,
      applications: applications.rows,
      revenue: revenue.rows[0],
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ACADEMIC YEARS & SEMESTERS
// ═══════════════════════════════════════════════════════════════════════
const getAcademicYears = asyncHandler(async (req, res) => {
  const r = await query(`SELECT * FROM academic_years ORDER BY start_date DESC`);
  res.json({ success: true, data: r.rows });
});

const getSemesters = asyncHandler(async (req, res) => {
  const r = await query(`
    SELECT s.*, ay.name AS academic_year_name
    FROM semesters s JOIN academic_years ay ON ay.id=s.academic_year_id
    ORDER BY s.start_date DESC
  `);
  res.json({ success: true, data: r.rows });
});

const createAcademicYear = asyncHandler(async (req, res) => {
  const { name, start_date, end_date, is_current } = req.body;
  if (is_current) await query(`UPDATE academic_years SET is_current=FALSE`);
  const r = await query(
    `INSERT INTO academic_years (name, start_date, end_date, is_current) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, start_date, end_date, is_current||false]
  );
  res.status(201).json({ success: true, data: r.rows[0] });
});

const createSemester = asyncHandler(async (req, res) => {
  const { academic_year_id, name, start_date, end_date, is_current } = req.body;
  if (is_current) await query(`UPDATE semesters SET is_current=FALSE WHERE academic_year_id=$1`, [academic_year_id]);
  const r = await query(
    `INSERT INTO semesters (academic_year_id, name, start_date, end_date, is_current) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [academic_year_id, name, start_date, end_date, is_current||false]
  );
  res.status(201).json({ success: true, data: r.rows[0] });
});

module.exports = {
  getDepartments, createDepartment, updateDepartment,
  getCourses, getCourse, createCourse, updateCourse,
  getUnits, createUnit, assignLecturer,
  getEnrollments, enroll,
  getResults, getStudentTranscript, enterResults, bulkEnterResults, publishResults,
  getFeeStructures, createFeeStructure, getStudentInvoices, issueInvoice, recordPayment, getPaymentHistory,
  getApplications, submitApplication, updateApplicationStatus,
  getAnnouncements, createAnnouncement, deleteAnnouncement,
  recordAttendance, getAttendance,
  getSecurityLog, logEntry,
  getDashboardStats,
  getAcademicYears, getSemesters, createAcademicYear, createSemester,
};

-- =====================================================================
-- St Johns Training College — School Management System
-- Full Database Schema
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ROLES ENUM ────────────────────────────────────────────────────────
-- super_admin, principal, director, secretary, ict, lecturer,
-- student, security, staff

-- ── USERS (central auth table) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  uuid            UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  employee_id     VARCHAR(30) UNIQUE,           -- e.g. SJC-STF-001
  student_id      VARCHAR(30) UNIQUE,           -- e.g. SJC-STU-001
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  phone           VARCHAR(30),
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(30) NOT NULL DEFAULT 'student'
                    CHECK (role IN (
                      'super_admin','principal','director','secretary',
                      'ict','lecturer','student','security','staff'
                    )),
  gender          VARCHAR(10),
  date_of_birth   DATE,
  national_id     VARCHAR(50),
  address         TEXT,
  profile_photo   VARCHAR(500),
  is_active       BOOLEAN DEFAULT TRUE,
  must_change_pwd BOOLEAN DEFAULT TRUE,
  last_login      TIMESTAMP WITH TIME ZONE,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active   ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_sid      ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_eid      ON users(employee_id);

-- ── DEPARTMENTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) UNIQUE NOT NULL,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  head_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── COURSES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) UNIQUE NOT NULL,
  name            VARCHAR(300) NOT NULL,
  department_id   INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  level           VARCHAR(30) NOT NULL CHECK (level IN ('Certificate','Diploma','Short Course')),
  duration_months INTEGER NOT NULL DEFAULT 12,
  credit_hours    INTEGER DEFAULT 0,
  description     TEXT,
  requirements    TEXT,
  annual_fee      DECIMAL(12,2) DEFAULT 0,
  max_students    INTEGER DEFAULT 60,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_dept ON courses(department_id);

-- ── ACADEMIC YEARS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_years (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,   -- e.g. "2024/2025"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_current  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── SEMESTERS / TERMS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semesters (
  id               SERIAL PRIMARY KEY,
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name             VARCHAR(50) NOT NULL,    -- "Semester 1", "Term 2" etc
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  is_current       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── UNITS / SUBJECTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(300) NOT NULL,
  course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lecturer_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  credit_hours  INTEGER DEFAULT 3,
  semester_num  INTEGER DEFAULT 1,          -- which semester in the course
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_units_course    ON units(course_id);
CREATE INDEX IF NOT EXISTS idx_units_lecturer  ON units(lecturer_id);

-- ── ENROLLMENTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments (
  id               SERIAL PRIMARY KEY,
  student_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id        INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id),
  semester_id      INTEGER REFERENCES semesters(id),
  enrolled_date    DATE DEFAULT CURRENT_DATE,
  status           VARCHAR(20) DEFAULT 'active'
                     CHECK (status IN ('active','completed','deferred','withdrawn','expelled')),
  year_of_study    INTEGER DEFAULT 1,
  created_by       INTEGER REFERENCES users(id),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, course_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course  ON enrollments(course_id);

-- ── COURSE APPLICATIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id                   SERIAL PRIMARY KEY,
  reference_number     VARCHAR(30) UNIQUE NOT NULL,
  applicant_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- Personal info (for non-registered applicants)
  first_name           VARCHAR(100) NOT NULL,
  last_name            VARCHAR(100) NOT NULL,
  email                VARCHAR(255) NOT NULL,
  phone                VARCHAR(30),
  date_of_birth        DATE,
  gender               VARCHAR(10),
  national_id          VARCHAR(50),
  county               VARCHAR(80),
  -- Academic
  school_name          VARCHAR(200),
  kcse_grade           VARCHAR(5),
  kcse_year            SMALLINT,
  other_qualification  TEXT,
  -- Course selection
  course_id            INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  intake               VARCHAR(60),
  study_mode           VARCHAR(60),
  -- Status
  status               VARCHAR(20) DEFAULT 'pending'
                         CHECK (status IN ('pending','under_review','approved','rejected','enrolled','withdrawn')),
  reviewed_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_notes         TEXT,
  reviewed_at          TIMESTAMP WITH TIME ZONE,
  -- Documents
  doc_kcse             VARCHAR(500),
  doc_id               VARCHAR(500),
  doc_photo            VARCHAR(500),
  declaration_accepted BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_email  ON applications(email);

-- ── RESULTS / GRADES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
  id               SERIAL PRIMARY KEY,
  student_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id          INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  semester_id      INTEGER NOT NULL REFERENCES semesters(id),
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id),
  -- Score components
  cat1_score       DECIMAL(5,2) DEFAULT 0,   -- Continuous Assessment 1
  cat2_score       DECIMAL(5,2) DEFAULT 0,   -- Continuous Assessment 2
  assignment_score DECIMAL(5,2) DEFAULT 0,
  exam_score       DECIMAL(5,2) DEFAULT 0,
  total_score      DECIMAL(5,2) GENERATED ALWAYS AS (
                     COALESCE(cat1_score,0) * 0.1 +
                     COALESCE(cat2_score,0) * 0.1 +
                     COALESCE(assignment_score,0) * 0.1 +
                     COALESCE(exam_score,0) * 0.7
                   ) STORED,
  grade            VARCHAR(5),               -- A, B+, B, C+, C, D+, D, E
  grade_points     DECIMAL(3,2),             -- 4.0 scale
  remarks          VARCHAR(50),              -- Pass / Fail / Distinction
  is_published     BOOLEAN DEFAULT FALSE,
  entered_by       INTEGER REFERENCES users(id),
  approved_by      INTEGER REFERENCES users(id),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, unit_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_results_student   ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_unit      ON results(unit_id);
CREATE INDEX IF NOT EXISTS idx_results_semester  ON results(semester_id);
CREATE INDEX IF NOT EXISTS idx_results_published ON results(is_published);

-- ── FEES STRUCTURE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_structures (
  id               SERIAL PRIMARY KEY,
  course_id        INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id),
  semester_id      INTEGER REFERENCES semesters(id),
  fee_type         VARCHAR(100) NOT NULL,   -- Tuition, Activity, Caution, etc.
  amount           DECIMAL(12,2) NOT NULL,
  due_date         DATE,
  description      TEXT,
  created_by       INTEGER REFERENCES users(id),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, academic_year_id, fee_type)
);

-- ── STUDENT FEE INVOICES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_invoices (
  id               SERIAL PRIMARY KEY,
  invoice_number   VARCHAR(30) UNIQUE NOT NULL,
  student_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id        INTEGER NOT NULL REFERENCES courses(id),
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id),
  semester_id      INTEGER REFERENCES semesters(id),
  total_amount     DECIMAL(12,2) NOT NULL,
  amount_paid      DECIMAL(12,2) DEFAULT 0,
  balance          DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  status           VARCHAR(20) DEFAULT 'unpaid'
                     CHECK (status IN ('unpaid','partial','paid','waived','overdue')),
  due_date         DATE,
  issued_by        INTEGER REFERENCES users(id),
  issued_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes            TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_student ON fee_invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status  ON fee_invoices(status);

-- ── FEE PAYMENTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_payments (
  id              SERIAL PRIMARY KEY,
  invoice_id      INTEGER NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount          DECIMAL(12,2) NOT NULL,
  payment_method  VARCHAR(50) DEFAULT 'cash'
                    CHECK (payment_method IN ('cash','mpesa','bank','cheque','waiver')),
  reference_no    VARCHAR(100),             -- M-Pesa code, bank ref etc
  received_by     INTEGER REFERENCES users(id),
  payment_date    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON fee_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON fee_payments(student_id);

-- ── TIMETABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable (
  id            SERIAL PRIMARY KEY,
  unit_id       INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  semester_id   INTEGER NOT NULL REFERENCES semesters(id),
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  venue         VARCHAR(100),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── ANNOUNCEMENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(500) NOT NULL,
  content       TEXT NOT NULL,
  target_roles  VARCHAR(200) DEFAULT 'all',  -- comma-separated roles or 'all'
  priority      VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  is_published  BOOLEAN DEFAULT TRUE,
  author_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at    TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── ATTENDANCE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id     INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  status      VARCHAR(10) NOT NULL DEFAULT 'present'
                CHECK (status IN ('present','absent','late','excused')),
  remarks     TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, unit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_unit    ON attendance(unit_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON attendance(date);

-- ── SECURITY LOG ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_log (
  id            SERIAL PRIMARY KEY,
  logged_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  person_name   VARCHAR(200),
  person_type   VARCHAR(30) DEFAULT 'visitor'
                  CHECK (person_type IN ('student','staff','visitor','contractor')),
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(20) NOT NULL CHECK (action IN ('entry','exit')),
  purpose       TEXT,
  badge_number  VARCHAR(50),
  vehicle_reg   VARCHAR(30),
  logged_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── LEAVE / ABSENCE REQUESTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id            SERIAL PRIMARY KEY,
  requester_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type    VARCHAR(50) NOT NULL,       -- sick, annual, compassionate etc
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT NOT NULL,
  status        VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  reviewed_by   INTEGER REFERENCES users(id),
  review_notes  TEXT,
  reviewed_at   TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── NOTIFICATIONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(300) NOT NULL,
  message     TEXT NOT NULL,
  type        VARCHAR(20) DEFAULT 'info'
                CHECK (type IN ('info','success','warning','error','result','fee','application')),
  is_read     BOOLEAN DEFAULT FALSE,
  link        VARCHAR(500),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- ── AUDIT LOG ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(100),
  entity_id   INTEGER,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  VARCHAR(60),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);

-- ── AUTO updated_at trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','departments','courses','units','enrollments',
    'applications','results','fee_invoices','announcements'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at_%I ON %I;
      CREATE TRIGGER trg_updated_at_%I
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ── Helper: compute letter grade ─────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_grade(score DECIMAL)
RETURNS VARCHAR AS $$
BEGIN
  IF score >= 70 THEN RETURN 'A';
  ELSIF score >= 60 THEN RETURN 'B+';
  ELSIF score >= 55 THEN RETURN 'B';
  ELSIF score >= 50 THEN RETURN 'C+';
  ELSIF score >= 45 THEN RETURN 'C';
  ELSIF score >= 40 THEN RETURN 'D+';
  ELSIF score >= 35 THEN RETURN 'D';
  ELSE RETURN 'E';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION compute_grade_points(score DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  IF score >= 70 THEN RETURN 4.0;
  ELSIF score >= 60 THEN RETURN 3.5;
  ELSIF score >= 55 THEN RETURN 3.0;
  ELSIF score >= 50 THEN RETURN 2.5;
  ELSIF score >= 45 THEN RETURN 2.0;
  ELSIF score >= 40 THEN RETURN 1.5;
  ELSIF score >= 35 THEN RETURN 1.0;
  ELSE RETURN 0.0;
  END IF;
END;
$$ LANGUAGE plpgsql;

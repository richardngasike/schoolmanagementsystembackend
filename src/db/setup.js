require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_PASSWORD = 'Ride@1635';

async function setup() {
  console.log('\n🏫 St Johns SMS — Database Setup & Seed\n');
  console.log(`  Default password for all users: ${DEFAULT_PASSWORD}\n`);

  const dbName = process.env.DB_NAME || 'stjohns_sms';

  // Create DB if needed
  if (!process.env.DATABASE_URL) {
    const adminPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    });
    try {
      const exists = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname=$1`, [dbName]);
      if (exists.rowCount === 0) {
        await adminPool.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✅ Created database: ${dbName}`);
      } else {
        console.log(`ℹ  Database exists: ${dbName}`);
      }
    } finally { await adminPool.end(); }
  }

  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: dbName,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
      });

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('✅ Schema applied');

    const hash = (pwd) => bcrypt.hashSync(pwd, 12);
    const H = hash(DEFAULT_PASSWORD);

    // ── Academic Year
    await pool.query(`
      INSERT INTO academic_years (name, start_date, end_date, is_current)
      VALUES ('2024/2025','2024-09-01','2025-08-31',TRUE)
      ON CONFLICT (name) DO NOTHING
    `);
    const ay = (await pool.query(`SELECT id FROM academic_years WHERE is_current=TRUE LIMIT 1`)).rows[0];
    const ayId = ay.id;

    // ── Semesters
    await pool.query(`
      INSERT INTO semesters (academic_year_id, name, start_date, end_date, is_current) VALUES
      ($1,'Semester 1','2024-09-01','2025-01-31',TRUE),
      ($1,'Semester 2','2025-02-01','2025-08-31',FALSE)
      ON CONFLICT DO NOTHING
    `, [ayId]);
    const semId = (await pool.query(`SELECT id FROM semesters WHERE is_current=TRUE LIMIT 1`)).rows[0].id;

    // ── Users
    const users = [
      { eid:'SJC-SA-001',  fn:'System',    ln:'Administrator', email:'superadmin@stjohns.ac.ke',      role:'super_admin', must:false },
      { eid:'SJC-PRI-001', fn:'James',     ln:'Mwangi',        email:'principal@stjohns.ac.ke',        role:'principal',   phone:'+254720000001', gender:'Male' },
      { eid:'SJC-DIR-001', fn:'Grace',     ln:'Njoroge',       email:'director@stjohns.ac.ke',         role:'director',    phone:'+254720000002', gender:'Female' },
      { eid:'SJC-SEC-001', fn:'Mary',      ln:'Wanjiku',       email:'secretary@stjohns.ac.ke',        role:'secretary',   phone:'+254720000003', gender:'Female' },
      { eid:'SJC-ICT-001', fn:'Kevin',     ln:'Omondi',        email:'ict@stjohns.ac.ke',              role:'ict',         phone:'+254720000004', gender:'Male' },
      { eid:'SJC-MGR-001', fn:'Peter',     ln:'Kamau',         email:'manager@stjohns.ac.ke',          role:'director',    phone:'+254720000010', gender:'Male' },
      { eid:'SJC-HOD-ICT', fn:'Alice',     ln:'Mutua',         email:'hod.ict@stjohns.ac.ke',          role:'lecturer',    phone:'+254720000005', gender:'Female', dept_key:'ICT' },
      { eid:'SJC-HOD-BUS', fn:'Daniel',    ln:'Otieno',        email:'hod.business@stjohns.ac.ke',     role:'lecturer',    phone:'+254720000006', gender:'Male',   dept_key:'BUS' },
      { eid:'SJC-HOD-HEA', fn:'Fatuma',    ln:'Hassan',        email:'hod.health@stjohns.ac.ke',       role:'lecturer',    phone:'+254720000007', gender:'Female', dept_key:'HEA' },
      { eid:'SJC-HOD-ENG', fn:'John',      ln:'Kariuki',       email:'hod.engineering@stjohns.ac.ke',  role:'lecturer',    phone:'+254720000008', gender:'Male',   dept_key:'ENG' },
      { eid:'SJC-HOD-EDU', fn:'Sarah',     ln:'Achieng',       email:'hod.education@stjohns.ac.ke',    role:'lecturer',    phone:'+254720000009', gender:'Female', dept_key:'EDU' },
      { eid:'SJC-LEC-001', fn:'David',     ln:'Kimani',        email:'lecturer1@stjohns.ac.ke',        role:'lecturer',    phone:'+254720000011', gender:'Male' },
      { eid:'SJC-LEC-002', fn:'Rose',      ln:'Muthoni',       email:'lecturer2@stjohns.ac.ke',        role:'lecturer',    phone:'+254720000012', gender:'Female' },
      { eid:'SJC-SGD-001', fn:'Paul',      ln:'Njenga',        email:'security@stjohns.ac.ke',         role:'security',    phone:'+254720000013', gender:'Male' },
      { eid:'SJC-SGD-002', fn:'Joseph',    ln:'Lolkijai',      email:'security2@stjohns.ac.ke',        role:'security',    phone:'+254720000014', gender:'Male' },
      { eid:'SJC-STF-001', fn:'Christine', ln:'Waweru',        email:'staff@stjohns.ac.ke',            role:'staff',       phone:'+254720000015', gender:'Female' },
      // Students
      { sid:'SJC-STU-0001', fn:'Alice',    ln:'Wanjiru',       email:'alice@student.stjohns.ac.ke',    role:'student', phone:'+254720100001', gender:'Female' },
      { sid:'SJC-STU-0002', fn:'Brian',    ln:'Otieno',        email:'brian@student.stjohns.ac.ke',    role:'student', phone:'+254720100002', gender:'Male' },
      { sid:'SJC-STU-0003', fn:'Christine',ln:'Muthoni',       email:'christine@student.stjohns.ac.ke',role:'student', phone:'+254720100003', gender:'Female' },
      { sid:'SJC-STU-0004', fn:'Dennis',   ln:'Ochieng',       email:'dennis@student.stjohns.ac.ke',   role:'student', phone:'+254720100004', gender:'Male' },
      { sid:'SJC-STU-0005', fn:'Esther',   ln:'Njeri',         email:'esther@student.stjohns.ac.ke',   role:'student', phone:'+254720100005', gender:'Female' },
      { sid:'SJC-STU-0006', fn:'Felix',    ln:'Mutua',         email:'felix@student.stjohns.ac.ke',    role:'student', phone:'+254720100006', gender:'Male' },
      { sid:'SJC-STU-0007', fn:'Grace',    ln:'Auma',          email:'grace@student.stjohns.ac.ke',    role:'student', phone:'+254720100007', gender:'Female' },
      { sid:'SJC-STU-0008', fn:'Hassan',   ln:'Mohamed',       email:'hassan@student.stjohns.ac.ke',   role:'student', phone:'+254720100008', gender:'Male' },
    ];

    const userMap = {};
    for (const u of users) {
      const idf = u.sid ? 'student_id' : 'employee_id';
      const idv = u.sid || u.eid;
      const res = await pool.query(`
        INSERT INTO users (uuid,${idf},first_name,last_name,email,phone,password_hash,role,gender,must_change_pwd,is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)
        ON CONFLICT (email) DO UPDATE SET
          password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,updated_at=NOW()
        RETURNING id,role,email
      `, [uuidv4(),idv,u.fn,u.ln,u.email.toLowerCase(),u.phone||null,H,u.role,u.gender||null,u.must!==false]);
      const row = res.rows[0];
      userMap[u.email.toLowerCase()] = row.id;
      if (u.dept_key) userMap[`hod_${u.dept_key}`] = row.id;
      if (u.role === 'student') {
        if (!userMap.students) userMap.students = [];
        userMap.students.push(row.id);
      }
      if (u.role === 'lecturer') {
        if (!userMap.lecturers) userMap.lecturers = [];
        userMap.lecturers.push(row.id);
      }
    }
    userMap.principal  = userMap['principal@stjohns.ac.ke'];
    userMap.secretary  = userMap['secretary@stjohns.ac.ke'];
    userMap.ict        = userMap['ict@stjohns.ac.ke'];
    userMap.security   = userMap['security@stjohns.ac.ke'];
    console.log(`✅ ${users.length} users seeded`);

    // ── Departments
    const depts = [
      { code:'ICT',  name:'Information & Communication Technology', hod:'hod_ICT' },
      { code:'BUS',  name:'Business & Entrepreneurship',            hod:'hod_BUS' },
      { code:'HEA',  name:'Health Sciences',                        hod:'hod_HEA' },
      { code:'ENG',  name:'Engineering & Technology',               hod:'hod_ENG' },
      { code:'EDU',  name:'Education & Social Sciences',            hod:'hod_EDU' },
      { code:'HUM',  name:'Humanities & Languages',                 hod:null },
      { code:'AGR',  name:'Agriculture & Food Technology',          hod:null },
    ];
    const deptMap = {};
    for (const d of depts) {
      const res = await pool.query(`
        INSERT INTO departments (code,name,head_id)
        VALUES ($1,$2,$3)
        ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,head_id=EXCLUDED.head_id
        RETURNING id,code
      `, [d.code, d.name, d.hod ? userMap[d.hod] : null]);
      deptMap[d.code] = res.rows[0].id;
    }
    console.log(`✅ ${depts.length} departments seeded`);

    // ── Courses
    const courses = [
      { code:'DIT',  name:'Diploma in Information Technology',        dept:'ICT', level:'Diploma',       months:24, fee:45000 },
      { code:'DBA',  name:'Diploma in Business Administration',       dept:'BUS', level:'Diploma',       months:24, fee:42000 },
      { code:'CCH',  name:'Certificate in Community Health',          dept:'HEA', level:'Certificate',   months:18, fee:38000 },
      { code:'DEE',  name:'Diploma in Electrical Engineering',        dept:'ENG', level:'Diploma',       months:24, fee:50000 },
      { code:'CAF',  name:'Certificate in Accounting & Finance',      dept:'BUS', level:'Certificate',   months:12, fee:35000 },
      { code:'CECE', name:'Certificate in Early Childhood Education', dept:'EDU', level:'Certificate',   months:12, fee:32000 },
      { code:'DBT',  name:'Diploma in Building Technology',           dept:'ENG', level:'Diploma',       months:24, fee:48000 },
      { code:'CAGR', name:'Certificate in Agriculture',               dept:'AGR', level:'Certificate',   months:12, fee:30000 },
      { code:'DPH',  name:'Diploma in Pharmacy Technology',           dept:'HEA', level:'Diploma',       months:24, fee:55000 },
      { code:'SDM',  name:'Short Course: Digital Marketing',          dept:'BUS', level:'Short Course',  months:3,  fee:15000 },
      { code:'SICT', name:'Short Course: Computer Packages',          dept:'ICT', level:'Short Course',  months:3,  fee:12000 },
      { code:'SENT', name:'Short Course: Entrepreneurship',           dept:'BUS', level:'Short Course',  months:2,  fee:10000 },
    ];
    const courseMap = {};
    for (const c of courses) {
      const res = await pool.query(`
        INSERT INTO courses (code,name,department_id,level,duration_months,annual_fee,max_students)
        VALUES ($1,$2,$3,$4,$5,$6,60)
        ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,annual_fee=EXCLUDED.annual_fee
        RETURNING id,code
      `, [c.code, c.name, deptMap[c.dept], c.level, c.months, c.fee]);
      courseMap[c.code] = res.rows[0].id;
    }
    console.log(`✅ ${courses.length} courses seeded`);

    // ── Units
    const lec1 = userMap.lecturers?.[0];
    const lec2 = userMap.lecturers?.[1];
    const lec3 = userMap['hod_ICT'];
    const units = [
      // DIT Sem 1
      { code:'DIT101', name:'Introduction to Computing',        course:'DIT', lec:lec3, sem:1 },
      { code:'DIT102', name:'Programming Fundamentals (Python)',course:'DIT', lec:lec1, sem:1 },
      { code:'DIT103', name:'Computer Networks I',              course:'DIT', lec:lec3, sem:1 },
      { code:'DIT104', name:'Database Management Systems',      course:'DIT', lec:lec2, sem:1 },
      { code:'DIT105', name:'Web Design & Development',         course:'DIT', lec:lec1, sem:1 },
      // DIT Sem 2
      { code:'DIT201', name:'Object Oriented Programming',      course:'DIT', lec:lec1, sem:2 },
      { code:'DIT202', name:'Systems Analysis & Design',        course:'DIT', lec:lec2, sem:2 },
      { code:'DIT203', name:'Computer Networks II',             course:'DIT', lec:lec3, sem:2 },
      { code:'DIT204', name:'Cybersecurity Fundamentals',       course:'DIT', lec:lec1, sem:2 },
      // DBA
      { code:'DBA101', name:'Principles of Management',         course:'DBA', lec:lec2, sem:1 },
      { code:'DBA102', name:'Business Mathematics & Statistics',course:'DBA', lec:lec1, sem:1 },
      { code:'DBA103', name:'Financial Accounting I',           course:'DBA', lec:lec2, sem:1 },
      { code:'DBA104', name:'Entrepreneurship Development',     course:'DBA', lec:lec1, sem:1 },
      // CAF
      { code:'CAF101', name:'Financial Accounting I',           course:'CAF', lec:lec2, sem:1 },
      { code:'CAF102', name:'Business Law',                     course:'CAF', lec:lec1, sem:1 },
      { code:'CAF103', name:'Economics',                        course:'CAF', lec:lec2, sem:1 },
      // CCH
      { code:'CCH101', name:'Anatomy & Physiology',             course:'CCH', lec:lec1, sem:1 },
      { code:'CCH102', name:'Community Health Nursing',         course:'CCH', lec:lec2, sem:1 },
      { code:'CCH103', name:'Public Health',                    course:'CCH', lec:lec1, sem:1 },
    ];
    const unitMap = {};
    for (const u of units) {
      const res = await pool.query(`
        INSERT INTO units (code,name,course_id,lecturer_id,semester_num)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,lecturer_id=EXCLUDED.lecturer_id
        RETURNING id,code
      `, [u.code, u.name, courseMap[u.course], u.lec||null, u.sem]);
      unitMap[u.code] = res.rows[0].id;
    }
    console.log(`✅ ${units.length} units seeded`);

    // ── Enroll all students in DIT
    const students = userMap.students || [];
    for (const sid of students) {
      await pool.query(`
        INSERT INTO enrollments (student_id,course_id,academic_year_id,semester_id,year_of_study,created_by)
        VALUES ($1,$2,$3,$4,1,$5)
        ON CONFLICT (student_id,course_id,academic_year_id) DO NOTHING
      `, [sid, courseMap['DIT'], ayId, semId, userMap.principal]);
    }
    // Enroll some in DBA too
    for (const sid of students.slice(0,3)) {
      await pool.query(`
        INSERT INTO enrollments (student_id,course_id,academic_year_id,semester_id,year_of_study,created_by)
        VALUES ($1,$2,$3,$4,1,$5)
        ON CONFLICT (student_id,course_id,academic_year_id) DO NOTHING
      `, [sid, courseMap['DBA'], ayId, semId, userMap.principal]);
    }
    console.log(`✅ Students enrolled`);

    // ── Fee Structures for DIT
    const feeItems = [
      { type:'Tuition Fee',     amount:22500 },
      { type:'Activity Fee',    amount:1500  },
      { type:'Caution Money',   amount:2000  },
      { type:'Library Fee',     amount:500   },
      { type:'ICT Fee',         amount:1000  },
      { type:'Examination Fee', amount:2000  },
      { type:'ID Card',         amount:200   },
    ];
    for (const fi of feeItems) {
      await pool.query(`
        INSERT INTO fee_structures (course_id,academic_year_id,semester_id,fee_type,amount,due_date,created_by)
        VALUES ($1,$2,$3,$4,$5,'2024-10-01',$6)
        ON CONFLICT (course_id,academic_year_id,fee_type) DO UPDATE SET amount=EXCLUDED.amount
      `, [courseMap['DIT'], ayId, semId, fi.type, fi.amount, userMap.secretary]);
    }
    const totalFee = feeItems.reduce((s,f)=>s+f.amount,0);

    // ── Fee Invoices
    let invSeq = 1;
    for (const sid of students) {
      const invNo = `INV-2024-${String(invSeq++).padStart(4,'0')}`;
      const res = await pool.query(`
        INSERT INTO fee_invoices (invoice_number,student_id,course_id,academic_year_id,semester_id,
          total_amount,due_date,issued_by)
        VALUES ($1,$2,$3,$4,$5,$6,'2024-10-01',$7)
        ON CONFLICT (invoice_number) DO NOTHING RETURNING id
      `, [invNo, sid, courseMap['DIT'], ayId, semId, totalFee, userMap.secretary]);

      if (res.rows[0]) {
        const invId = res.rows[0].id;
        // First 3 students: partial payment; next 2: full paid; rest: unpaid
        const idx = students.indexOf(sid);
        if (idx < 3) {
          const paid = 15000;
          await pool.query(`INSERT INTO fee_payments (invoice_id,student_id,amount,payment_method,reference_no,received_by) VALUES ($1,$2,$3,'mpesa',$4,$5)`,
            [invId, sid, paid, `MPE${Math.random().toString(36).substring(2,9).toUpperCase()}`, userMap.secretary]);
          await pool.query(`UPDATE fee_invoices SET amount_paid=$1,status='partial' WHERE id=$2`, [paid, invId]);
        } else if (idx < 5) {
          await pool.query(`INSERT INTO fee_payments (invoice_id,student_id,amount,payment_method,reference_no,received_by) VALUES ($1,$2,$3,'bank',$4,$5)`,
            [invId, sid, totalFee, `BNK${Math.random().toString(36).substring(2,9).toUpperCase()}`, userMap.secretary]);
          await pool.query(`UPDATE fee_invoices SET amount_paid=$1,status='paid' WHERE id=$2`, [totalFee, invId]);
        }
        // idx >= 5: remains unpaid
      }
    }
    console.log(`✅ Fee invoices & payments seeded`);

    // ── Results for Semester 1 DIT units
    const sem1Units = ['DIT101','DIT102','DIT103','DIT104','DIT105'];
    const rng = (min,max) => (Math.random()*(max-min)+min).toFixed(1);
    for (const sid of students) {
      for (const uc of sem1Units) {
        if (!unitMap[uc]) continue;
        const cat1 = parseFloat(rng(8,15));
        const cat2 = parseFloat(rng(8,15));
        const asgn = parseFloat(rng(7,15));
        const exam = parseFloat(rng(25,65));
        await pool.query(`
          INSERT INTO results (student_id,unit_id,semester_id,academic_year_id,
            cat1_score,cat2_score,assignment_score,exam_score,is_published,entered_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9)
          ON CONFLICT (student_id,unit_id,semester_id) DO NOTHING
        `, [sid, unitMap[uc], semId, ayId, cat1, cat2, asgn, exam, lec1]);
      }
    }
    await pool.query(`
      UPDATE results SET
        grade=compute_grade(total_score),
        grade_points=compute_grade_points(total_score),
        remarks=CASE WHEN total_score>=40 THEN 'Pass' ELSE 'Fail' END
      WHERE grade IS NULL
    `);
    console.log(`✅ Results seeded & grades computed`);

    // ── Timetable
    const timetableEntries = [
      { unit:'DIT101', day:1, start:'08:00', end:'10:00', venue:'Lab 1' },
      { unit:'DIT102', day:1, start:'10:00', end:'12:00', venue:'Lab 2' },
      { unit:'DIT103', day:2, start:'08:00', end:'10:00', venue:'Room 3' },
      { unit:'DIT104', day:2, start:'10:00', end:'12:00', venue:'Lab 1' },
      { unit:'DIT105', day:3, start:'08:00', end:'10:00', venue:'Lab 2' },
      { unit:'DIT101', day:4, start:'14:00', end:'16:00', venue:'Lab 1' },
      { unit:'DIT102', day:5, start:'08:00', end:'10:00', venue:'Lab 2' },
    ];
    for (const t of timetableEntries) {
      if (!unitMap[t.unit]) continue;
      await pool.query(`
        INSERT INTO timetable (unit_id,semester_id,day_of_week,start_time,end_time,venue)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING
      `, [unitMap[t.unit], semId, t.day, t.start, t.end, t.venue]);
    }
    console.log(`✅ Timetable seeded`);

    // ── Announcements
    const ann = [
      { title:'Welcome to Academic Year 2024/2025', priority:'high', roles:'all',
        content:'We welcome all students and staff to the new academic year. Classes commence September 2, 2024. All students must clear outstanding fees by October 1, 2024. Contact the secretary\'s office for any inquiries.' },
      { title:'Semester 1 Examination Timetable Released', priority:'urgent', roles:'student,lecturer',
        content:'The Semester 1 examination timetable is now available on the student portal. Examinations commence January 13, 2025. Students must have cleared at least 60% of their fees to sit exams.' },
      { title:'Monthly Staff Meeting — Friday 3:00 PM', priority:'normal', roles:'lecturer,secretary,ict,security,staff,director,principal',
        content:'All teaching and non-teaching staff are required to attend the monthly staff meeting this Friday at 3:00pm in the Main Conference Room. Agenda will be circulated by Thursday morning.' },
      { title:'ICT System Maintenance — Saturday Night', priority:'normal', roles:'all',
        content:'The college management system will undergo scheduled maintenance this Saturday from 10:00 PM to 2:00 AM Sunday. During this period, the portal will be inaccessible. Plan accordingly.' },
      { title:'New Computer Lab Equipment Installed', priority:'low', roles:'student,lecturer,ict',
        content:'The ICT Department is pleased to announce installation of 30 new computers in Lab 2. The lab is now equipped with the latest hardware and software. Students in DIT may use the lab after 4:00 PM on weekdays.' },
      { title:'Fee Payment Deadline Reminder', priority:'high', roles:'student,secretary',
        content:'This is a reminder that Semester 1 fee payment deadline is October 1, 2024. Students with outstanding balances will not be allowed to sit for CATs. M-Pesa Paybill: 400200, Account: Your Student ID.' },
    ];
    for (const a of ann) {
      await pool.query(`
        INSERT INTO announcements (title,content,target_roles,priority,author_id)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING
      `, [a.title, a.content, a.roles, a.priority, userMap.principal]);
    }
    console.log(`✅ ${ann.length} announcements seeded`);

    // ── Applications
    const apps = [
      { ref:'SJC-APP-0001', fn:'John',    ln:'Kariuki',   email:'john.kariuki@gmail.com',   phone:'+254720999001', gender:'Male',   school:'Maralal High School',    grade:'B+', yr:2023, course:'DIT',  intake:'September 2025', status:'pending' },
      { ref:'SJC-APP-0002', fn:'Amina',   ln:'Mwangi',    email:'amina.mwangi@gmail.com',   phone:'+254720999002', gender:'Female', school:'Samburu Girls High',     grade:'B',  yr:2023, course:'CAF',  intake:'September 2025', status:'under_review' },
      { ref:'SJC-APP-0003', fn:'Tobias',  ln:'Lenchura',  email:'tobias@gmail.com',         phone:'+254720999003', gender:'Male',   school:'Wamba Secondary',        grade:'C+', yr:2022, course:'DBA',  intake:'January 2025',   status:'approved' },
      { ref:'SJC-APP-0004', fn:'Naomi',   ln:'Akinyi',    email:'naomi.akinyi@gmail.com',   phone:'+254720999004', gender:'Female', school:'Kisumu Girls',           grade:'B-', yr:2023, course:'CCH',  intake:'September 2025', status:'pending' },
      { ref:'SJC-APP-0005', fn:'Samuel',  ln:'Njoroge',   email:'samuel.njoroge@gmail.com', phone:'+254720999005', gender:'Male',   school:'Alliance High School',   grade:'A-', yr:2023, course:'DIT',  intake:'September 2025', status:'pending' },
      { ref:'SJC-APP-0006', fn:'Diana',   ln:'Chebet',    email:'diana.chebet@gmail.com',   phone:'+254720999006', gender:'Female', school:'St Theresa Eldoret',     grade:'C',  yr:2022, course:'CECE', intake:'January 2025',   status:'rejected' },
    ];
    for (const a of apps) {
      await pool.query(`
        INSERT INTO applications (reference_number,first_name,last_name,email,phone,gender,
          school_name,kcse_grade,kcse_year,course_id,intake,study_mode,status,declaration_accepted)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Full-time',$12,TRUE)
        ON CONFLICT (reference_number) DO NOTHING
      `, [a.ref,a.fn,a.ln,a.email,a.phone,a.gender,a.school,a.grade,a.yr,courseMap[a.course],a.intake,a.status]);
    }
    console.log(`✅ ${apps.length} applications seeded`);

    // ── Attendance (last 5 days for first 3 students)
    const statuses = ['present','present','present','late','absent'];
    for (let d = 0; d < 5; d++) {
      const date = new Date(); date.setDate(date.getDate() - d);
      const ds = date.toISOString().split('T')[0];
      for (let si = 0; si < Math.min(3, students.length); si++) {
        if (unitMap['DIT101']) {
          await pool.query(`
            INSERT INTO attendance (student_id,unit_id,date,status,recorded_by)
            VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING
          `, [students[si], unitMap['DIT101'], ds, statuses[(si+d)%5], lec1]);
        }
      }
    }
    console.log(`✅ Attendance seeded`);

    // ── Security log
    const sgd = userMap.security;
    const secEntries = [
      { name:'James Otieno',     type:'visitor',    action:'entry',  purpose:'Meeting with Principal' },
      { name:'Kenya Post Courier',type:'contractor', action:'entry',  purpose:'Document delivery' },
      { name:'James Otieno',     type:'visitor',    action:'exit',   purpose:null },
      { name:'Moraa Gesare',     type:'visitor',    action:'entry',  purpose:'Fee payment inquiry' },
      { name:'Nairobi Water Co', type:'contractor', action:'entry',  purpose:'Water meter reading' },
    ];
    for (const e of secEntries) {
      await pool.query(`
        INSERT INTO security_log (logged_by,person_name,person_type,action,purpose)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING
      `, [sgd, e.name, e.type, e.action, e.purpose]);
    }
    console.log(`✅ Security log seeded`);

    // ── Notifications for students
    for (const sid of students.slice(0,3)) {
      await pool.query(`
        INSERT INTO notifications (user_id,title,message,type,link)
        VALUES ($1,'Results Published','Your Semester 1 results are now available on your portal.','result','/dashboard/student/results'),
               ($1,'Fee Invoice Issued','A fee invoice of KES 29,700 has been issued for Semester 1.','fee','/dashboard/student/fees'),
               ($1,'Welcome!','Welcome to St Johns Training College student portal. Your account is ready.','info','/dashboard/student')
        ON CONFLICT DO NOTHING
      `, [sid]);
    }
    console.log(`✅ Notifications seeded`);

    // ── Print credentials table
    console.log(`
════════════════════════════════════════════════════════════════════════
✅  SETUP COMPLETE!   Password for ALL users: ${DEFAULT_PASSWORD}
════════════════════════════════════════════════════════════════════════

ROLE              EMAIL                                    ID
────────────────  ───────────────────────────────────────  ────────────
Super Admin       superadmin@stjohns.ac.ke                 SJC-SA-001
Principal         principal@stjohns.ac.ke                  SJC-PRI-001
Director          director@stjohns.ac.ke                   SJC-DIR-001
Manager           manager@stjohns.ac.ke                    SJC-MGR-001
Secretary         secretary@stjohns.ac.ke                  SJC-SEC-001
ICT Admin         ict@stjohns.ac.ke                        SJC-ICT-001
HOD ICT Dept      hod.ict@stjohns.ac.ke                    SJC-HOD-ICT
HOD Business      hod.business@stjohns.ac.ke               SJC-HOD-BUS
HOD Health        hod.health@stjohns.ac.ke                 SJC-HOD-HEA
HOD Engineering   hod.engineering@stjohns.ac.ke            SJC-HOD-ENG
HOD Education     hod.education@stjohns.ac.ke              SJC-HOD-EDU
Lecturer 1        lecturer1@stjohns.ac.ke                  SJC-LEC-001
Lecturer 2        lecturer2@stjohns.ac.ke                  SJC-LEC-002
Security 1        security@stjohns.ac.ke                   SJC-SGD-001
Security 2        security2@stjohns.ac.ke                  SJC-SGD-002
Staff             staff@stjohns.ac.ke                      SJC-STF-001
Student 1         alice@student.stjohns.ac.ke              SJC-STU-0001
Student 2         brian@student.stjohns.ac.ke              SJC-STU-0002
Student 3         christine@student.stjohns.ac.ke          SJC-STU-0003
Student 4         dennis@student.stjohns.ac.ke             SJC-STU-0004
Student 5         esther@student.stjohns.ac.ke             SJC-STU-0005
Student 6         felix@student.stjohns.ac.ke              SJC-STU-0006
Student 7         grace@student.stjohns.ac.ke              SJC-STU-0007
Student 8         hassan@student.stjohns.ac.ke             SJC-STU-0008
════════════════════════════════════════════════════════════════════════
`);
  } catch(err) {
    console.error('❌ Error:', err.message);
    if (process.env.NODE_ENV !== 'production') console.error(err.stack);
    throw err;
  } finally {
    await pool.end();
  }
}

setup().catch(()=>process.exit(1));

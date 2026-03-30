const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function generateId(role, seq) {
  const roleMap = {
    student: 'STU', lecturer: 'LEC', secretary: 'SEC',
    ict: 'ICT', security: 'SGD', principal: 'PRI',
    director: 'DIR', staff: 'STF', super_admin: 'SA',
  };
  const prefix = roleMap[role] || 'STF';
  const num = String(seq).padStart(role === 'student' ? 4 : 3, '0');
  return `SJC-${prefix}-${num}`;
}

// ── Login ─────────────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const result = await query(
    `SELECT id, uuid, employee_id, student_id, first_name, last_name, email,
            phone, role, password_hash, is_active, must_change_pwd, profile_photo
     FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  if (!result.rows.length) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const user = result.rows[0];
  if (!user.is_active) {
    return res.status(401).json({ success: false, message: 'Your account is deactivated. Contact the administrator.' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  await query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

  const token = generateToken(user.id, user.role);
  const { password_hash, ...safeUser } = user;

  res.json({
    success: true,
    message: `Welcome, ${user.first_name}!`,
    token,
    user: safeUser,
  });
});

// ── Get current user ──────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT u.id, u.uuid, u.employee_id, u.student_id, u.first_name, u.last_name,
            u.email, u.phone, u.role, u.gender, u.date_of_birth, u.address,
            u.profile_photo, u.must_change_pwd, u.last_login, u.created_at,
            d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.head_id = u.id
     WHERE u.id = $1`,
    [req.user.id]
  );
  res.json({ success: true, user: r.rows[0] });
});

// ── Change password ───────────────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
  }

  const r = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (current_password) {
    const match = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!match) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }

  const hash = await bcrypt.hash(new_password, 12);
  await query('UPDATE users SET password_hash=$1, must_change_pwd=FALSE, updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
  res.json({ success: true, message: 'Password changed successfully.' });
});

// ── Create user (Super Admin / Admin) ────────────────────────────────
const createUser = asyncHandler(async (req, res) => {
  const {
    first_name, last_name, email, phone, role,
    gender, date_of_birth, national_id, address, password,
  } = req.body;

  // Only super_admin can create other super_admins or principals
  if (['super_admin', 'principal'].includes(role) && req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Only Super Admin can create this role.' });
  }

  const existingCheck = await query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
  if (existingCheck.rows.length) {
    return res.status(409).json({ success: false, message: 'Email already registered.' });
  }

  // Count existing users of same role to generate ID
  const countRes = await query('SELECT COUNT(*) FROM users WHERE role=$1', [role]);
  const seq = parseInt(countRes.rows[0].count) + 1;
  const idField = role === 'student' ? 'student_id' : 'employee_id';
  const generatedId = generateId(role, seq);

  const defaultPwd = password || (role === 'student' ? 'Student@2024' : 'Staff@2024');
  const hash = await bcrypt.hash(defaultPwd, 12);

  const r = await query(`
    INSERT INTO users (uuid, ${idField}, first_name, last_name, email, phone,
      password_hash, role, gender, date_of_birth, national_id, address,
      must_change_pwd, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,$13)
    RETURNING id, uuid, ${idField}, first_name, last_name, email, phone, role, gender, is_active, created_at
  `, [
    uuidv4(), generatedId, first_name.trim(), last_name.trim(),
    email.toLowerCase().trim(), phone || null, hash, role,
    gender || null, date_of_birth || null, national_id || null,
    address || null, req.user.id,
  ]);

  // Audit log
  await query(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, new_value)
     VALUES ($1,'CREATE_USER','users',$2,$3)`,
    [req.user.id, r.rows[0].id, JSON.stringify({ role, email })]
  );

  res.status(201).json({
    success: true,
    message: `${role} account created. Default password: ${defaultPwd}`,
    user: r.rows[0],
    default_password: defaultPwd,
  });
});

// ── List users ────────────────────────────────────────────────────────
const listUsers = asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 25, active } = req.query;
  const conditions = [];
  const params = [];
  let p = 1;

  if (role) { conditions.push(`u.role = $${p++}`); params.push(role); }
  if (active !== undefined) { conditions.push(`u.is_active = $${p++}`); params.push(active === 'true'); }
  if (search) {
    conditions.push(`(u.first_name ILIKE $${p} OR u.last_name ILIKE $${p} OR u.email ILIKE $${p} OR u.student_id ILIKE $${p} OR u.employee_id ILIKE $${p})`);
    params.push(`%${search}%`); p++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const countR = await query(`SELECT COUNT(*) FROM users u ${where}`, params);
  const dataR  = await query(`
    SELECT u.id, u.uuid, u.employee_id, u.student_id, u.first_name, u.last_name,
           u.email, u.phone, u.role, u.gender, u.is_active, u.must_change_pwd,
           u.last_login, u.created_at
    FROM users u ${where}
    ORDER BY u.created_at DESC
    LIMIT $${p} OFFSET $${p+1}
  `, [...params, parseInt(limit), offset]);

  res.json({
    success: true,
    data: dataR.rows,
    pagination: {
      total: parseInt(countR.rows[0].count),
      page: parseInt(page), limit: parseInt(limit),
      pages: Math.ceil(parseInt(countR.rows[0].count) / parseInt(limit)),
    },
  });
});

// ── Get single user ───────────────────────────────────────────────────
const getUser = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT u.id, u.uuid, u.employee_id, u.student_id, u.first_name, u.last_name,
            u.email, u.phone, u.role, u.gender, u.date_of_birth, u.national_id,
            u.address, u.profile_photo, u.is_active, u.must_change_pwd,
            u.last_login, u.created_at,
            cb.first_name || ' ' || cb.last_name AS created_by_name
     FROM users u
     LEFT JOIN users cb ON cb.id = u.created_by
     WHERE u.id = $1`,
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
  res.json({ success: true, data: r.rows[0] });
});

// ── Update user ───────────────────────────────────────────────────────
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const allowed = ['first_name','last_name','phone','gender','date_of_birth','national_id','address'];
  const updates = []; const params = []; let p = 1;

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates.push(`${field}=$${p++}`); params.push(req.body[field]);
    }
  }
  if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update.' });
  params.push(id);

  const r = await query(
    `UPDATE users SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${p} RETURNING id, first_name, last_name, email, role`,
    params
  );
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
  res.json({ success: true, message: 'User updated.', data: r.rows[0] });
});

// ── Toggle active ─────────────────────────────────────────────────────
const toggleActive = asyncHandler(async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'Cannot deactivate yourself.' });
  }
  const r = await query(
    `UPDATE users SET is_active=NOT is_active, updated_at=NOW()
     WHERE id=$1 AND role != 'super_admin'
     RETURNING id, first_name, last_name, is_active`,
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
  const u = r.rows[0];
  res.json({ success: true, message: `${u.first_name} ${u.last_name} ${u.is_active ? 'activated' : 'deactivated'}.`, data: u });
});

// ── Reset password (admin) ────────────────────────────────────────────
const resetPassword = asyncHandler(async (req, res) => {
  const { new_password } = req.body;
  const pwd = new_password || 'Reset@2024';
  const hash = await bcrypt.hash(pwd, 12);
  await query(
    `UPDATE users SET password_hash=$1, must_change_pwd=TRUE, updated_at=NOW() WHERE id=$2`,
    [hash, req.params.id]
  );
  res.json({ success: true, message: `Password reset. New password: ${pwd}`, new_password: pwd });
});

// ── Get notifications ─────────────────────────────────────────────────
const getNotifications = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`,
    [req.user.id]
  );
  const unread = r.rows.filter(n => !n.is_read).length;
  res.json({ success: true, data: r.rows, unread_count: unread });
});

const markNotifRead = asyncHandler(async (req, res) => {
  if (req.params.id === 'all') {
    await query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1', [req.user.id]);
  } else {
    await query('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  }
  res.json({ success: true, message: 'Marked as read.' });
});

module.exports = {
  login, getMe, changePassword, createUser, listUsers,
  getUser, updateUser, toggleActive, resetPassword,
  getNotifications, markNotifRead,
};

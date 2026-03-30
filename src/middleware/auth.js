const jwt = require('jsonwebtoken');
const { query } = require('../db');

const ROLE_HIERARCHY = {
  super_admin: 10, principal: 9, director: 8, secretary: 7,
  ict: 7, lecturer: 6, staff: 5, security: 4, student: 1,
};

// Verify JWT and attach user to req
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      `SELECT id, uuid, employee_id, student_id, first_name, last_name,
              email, role, is_active, must_change_pwd
       FROM users WHERE id = $1`,
      [decoded.userId]
    );
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account deactivated.' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// Allow specific roles only
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(' or ')}.`,
    });
  }
  next();
};

// Allow roles with hierarchy level >= minLevel
const authorizeLevel = (minLevel) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  const level = ROLE_HIERARCHY[req.user.role] || 0;
  if (level < minLevel) {
    return res.status(403).json({ success: false, message: 'Insufficient privileges.' });
  }
  next();
};

// Shorthand guards
const isSuperAdmin  = authorize('super_admin');
const isAdmin       = authorize('super_admin', 'principal', 'director');
const isSecretary   = authorize('super_admin', 'principal', 'director', 'secretary');
const isICT         = authorize('super_admin', 'ict');
const isLecturer    = authorize('super_admin', 'principal', 'director', 'ict', 'lecturer');
const isSecurity    = authorize('super_admin', 'security');
const isStudent     = authorize('student');
const isStaffOrAdmin = authorizeLevel(5);

module.exports = {
  authenticate, authorize, authorizeLevel,
  isSuperAdmin, isAdmin, isSecretary, isICT,
  isLecturer, isSecurity, isStudent, isStaffOrAdmin,
  ROLE_HIERARCHY,
};

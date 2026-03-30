const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const auth = require('../middleware/auth');
const {
  login, getMe, changePassword, createUser, listUsers,
  getUser, updateUser, toggleActive, resetPassword,
  getNotifications, markNotifRead,
} = require('../controllers/authController');

const {
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
} = require('../controllers/controllers');

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 100 });

// ── AUTH ─────────────────────────────────────────────────────────────
router.post('/auth/login',           authLimiter, login);
router.get( '/auth/me',              auth.authenticate, getMe);
router.put( '/auth/change-password', auth.authenticate, changePassword);

// ── USERS ────────────────────────────────────────────────────────────
router.get( '/users',                auth.authenticate, auth.isAdmin, listUsers);
router.post('/users',                auth.authenticate, auth.isAdmin, createUser);
router.get( '/users/:id',            auth.authenticate, auth.isAdmin, getUser);
router.put( '/users/:id',            auth.authenticate, auth.isAdmin, updateUser);
router.patch('/users/:id/toggle',    auth.authenticate, auth.isSuperAdmin, toggleActive);
router.post('/users/:id/reset-pwd',  auth.authenticate, auth.isAdmin, resetPassword);

// ── NOTIFICATIONS ─────────────────────────────────────────────────────
router.get(  '/notifications',            auth.authenticate, getNotifications);
router.patch('/notifications/:id/read',   auth.authenticate, markNotifRead);

// ── DASHBOARD ─────────────────────────────────────────────────────────
router.get('/dashboard/stats', auth.authenticate, getDashboardStats);

// ── ACADEMIC YEARS ─────────────────────────────────────────────────────
router.get( '/academic-years',     auth.authenticate, getAcademicYears);
router.post('/academic-years',     auth.authenticate, auth.isAdmin, createAcademicYear);
router.get( '/semesters',          auth.authenticate, getSemesters);
router.post('/semesters',          auth.authenticate, auth.isAdmin, createSemester);

// ── DEPARTMENTS ────────────────────────────────────────────────────────
router.get( '/departments',        auth.authenticate, getDepartments);
router.post('/departments',        auth.authenticate, auth.isAdmin, createDepartment);
router.put( '/departments/:id',    auth.authenticate, auth.isAdmin, updateDepartment);

// ── COURSES ────────────────────────────────────────────────────────────
router.get( '/courses',            auth.authenticate, getCourses);
router.get( '/courses/:id',        auth.authenticate, getCourse);
router.post('/courses',            auth.authenticate, auth.isAdmin, createCourse);
router.put( '/courses/:id',        auth.authenticate, auth.isAdmin, updateCourse);

// ── UNITS ──────────────────────────────────────────────────────────────
router.get( '/units',              auth.authenticate, getUnits);
router.post('/units',              auth.authenticate, auth.isAdmin, createUnit);
router.patch('/units/:id/assign',  auth.authenticate, auth.isICT, assignLecturer);

// ── ENROLLMENTS ────────────────────────────────────────────────────────
router.get( '/enrollments',        auth.authenticate, auth.isStaffOrAdmin, getEnrollments);
router.post('/enrollments',        auth.authenticate, auth.isSecretary, enroll);

// ── RESULTS ────────────────────────────────────────────────────────────
router.get( '/results',            auth.authenticate, getResults);
router.get( '/results/transcript/:id', auth.authenticate, getStudentTranscript);
router.post('/results',            auth.authenticate, auth.isLecturer, enterResults);
router.post('/results/bulk',       auth.authenticate, auth.isLecturer, bulkEnterResults);
router.post('/results/publish',    auth.authenticate, auth.isAdmin, publishResults);

// ── FEES ───────────────────────────────────────────────────────────────
router.get( '/fees/structures',    auth.authenticate, getFeeStructures);
router.post('/fees/structures',    auth.authenticate, auth.isSecretary, createFeeStructure);
router.get( '/fees/invoices',      auth.authenticate, getStudentInvoices);
router.get( '/fees/invoices/:student_id', auth.authenticate, auth.isSecretary, getStudentInvoices);
router.post('/fees/invoices',      auth.authenticate, auth.isSecretary, issueInvoice);
router.post('/fees/payments',      auth.authenticate, auth.isSecretary, recordPayment);
router.get( '/fees/payments',      auth.authenticate, auth.isSecretary, getPaymentHistory);

// ── APPLICATIONS ───────────────────────────────────────────────────────
router.get( '/applications',       auth.authenticate, auth.isSecretary, getApplications);
router.post('/applications',       auth.authenticate, submitApplication);
router.patch('/applications/:id/status', auth.authenticate, auth.isSecretary, updateApplicationStatus);

// ── ANNOUNCEMENTS ──────────────────────────────────────────────────────
router.get( '/announcements',      auth.authenticate, getAnnouncements);
router.post('/announcements',      auth.authenticate, auth.isAdmin, createAnnouncement);
router.delete('/announcements/:id', auth.authenticate, auth.isAdmin, deleteAnnouncement);

// ── ATTENDANCE ─────────────────────────────────────────────────────────
router.get( '/attendance',         auth.authenticate, getAttendance);
router.post('/attendance',         auth.authenticate, auth.isLecturer, recordAttendance);

// ── SECURITY ───────────────────────────────────────────────────────────
router.get( '/security/log',       auth.authenticate, auth.isSecurity, getSecurityLog);
router.post('/security/log',       auth.authenticate, auth.isSecurity, logEntry);

module.exports = router;

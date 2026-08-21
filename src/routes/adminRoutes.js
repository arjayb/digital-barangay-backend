const express = require('express');
const {
  getUsers,
  updateUser,
  getAllRequests,
  updateRequestStatus,
  createOfficial,
  updateOfficial,
  deleteOfficial,
  createNotice,
  updateNotice,
  deleteNotice,
  getAllConcerns,
  updateConcernStatus,
  getReportsSummary,
} = require('../controllers/adminController');
const { authenticate, authorize, requireActiveStaff } = require('../middleware/auth');

const router = express.Router();

// Every route below requires a logged-in, ACTIVE admin. requireActiveStaff
// enforces the account lifecycle (§6): a suspended or pending admin loses
// operational access here without their account or history being touched.
router.use(authenticate, authorize('admin'), requireActiveStaff);

// Users
router.get('/users', getUsers);
router.patch('/users/:id', updateUser);

// Document requests
router.get('/requests', getAllRequests);
router.patch('/requests/:id/status', updateRequestStatus);

// Officials
router.post('/officials', createOfficial);
router.put('/officials/:id', updateOfficial);
router.delete('/officials/:id', deleteOfficial);

// Notices
router.post('/notices', createNotice);
router.put('/notices/:id', updateNotice);
router.delete('/notices/:id', deleteNotice);

// Concerns
router.get('/concerns', getAllConcerns);
router.patch('/concerns/:id/status', updateConcernStatus);

// Reporting
router.get('/reports/summary', getReportsSummary);

module.exports = router;

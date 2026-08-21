const express = require('express');
const {
  listApplications,
  approveApplication,
  rejectApplication,
  listAdmins,
  suspendAdmin,
  reactivateAdmin,
  getCredentialHistory,
} = require('../controllers/webmasterController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Every route below requires a logged-in webmaster. Webmaster does not
// automatically inherit ordinary Admin request/concern processing
// authority (BUILD-SPEC-DBA-001 §3) — these are the only routes it can
// reach; adminRoutes.js still requires authorize('admin') specifically.
router.use(authenticate, authorize('webmaster'));

// Credential requests
router.get('/applications', listApplications);
router.patch('/applications/:id/approve', approveApplication);
router.patch('/applications/:id/reject', rejectApplication);

// Administrators
router.get('/admins', listAdmins);
router.patch('/admins/:id/suspend', suspendAdmin);
router.patch('/admins/:id/reactivate', reactivateAdmin);

// Credential history
router.get('/credential-history', getCredentialHistory);

module.exports = router;

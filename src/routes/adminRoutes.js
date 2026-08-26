const express = require('express');
const {
  getUsers, updateUser, getAllRequests, updateRequestStatus,
  createOfficial, updateOfficial, deleteOfficial,
  createNotice, updateNotice, deleteNotice,
  getAllConcerns, updateConcernStatus,
  getActivity, getRecordHistory, getReportsSummary,
} = require('../controllers/adminController');
const { authenticate, authorize, requireActiveStaff } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('admin'), requireActiveStaff);

router.get('/users', getUsers);
router.patch('/users/:id', updateUser);
router.get('/requests', getAllRequests);
router.patch('/requests/:id/status', updateRequestStatus);
router.post('/officials', createOfficial);
router.put('/officials/:id', updateOfficial);
router.delete('/officials/:id', deleteOfficial);
router.post('/notices', createNotice);
router.put('/notices/:id', updateNotice);
router.delete('/notices/:id', deleteNotice);
router.get('/concerns', getAllConcerns);
router.patch('/concerns/:id/status', updateConcernStatus);

// Shared append-only operational history, visible to every active Admin.
router.get('/activity', getActivity);
router.get('/history/:module/:recordId', getRecordHistory);
router.get('/reports/summary', getReportsSummary);

module.exports = router;

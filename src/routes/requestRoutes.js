const express = require('express');
const { body } = require('express-validator');
const { getMyRequests, createRequest, getRequestById, confirmClaimed } = require('../controllers/requestController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { DOCUMENT_TYPES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', getMyRequests);

router.post(
  '/',
  authorize('resident'),
  upload.array('attachments', 5), // up to 5 files, field name "attachments"
  [
    body('documentType').isIn(DOCUMENT_TYPES).withMessage('Invalid document type'),
    body('purpose').trim().notEmpty().withMessage('Purpose is required'),
  ],
  validate,
  createRequest
);

router.get('/:id', getRequestById);

// v1.1.0 — additive. Resident-only; ownership + status are re-verified
// inside the controller regardless of this role check.
router.patch('/:id/claim', authorize('resident'), confirmClaimed);

module.exports = router;

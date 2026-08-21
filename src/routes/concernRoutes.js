const express = require('express');
const { body } = require('express-validator');
const { createConcern, getMyConcerns, confirmResolved } = require('../controllers/concernController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  authorize('resident'),
  upload.array('attachments', 3), // up to 3 files, field name "attachments"
  [
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
  ],
  validate,
  createConcern
);

router.get('/', getMyConcerns);

// v1.1.0 — additive. Resident-only; ownership + status re-verified inside
// the controller regardless of this role check.
router.patch('/:id/confirm-resolved', authorize('resident'), confirmResolved);

module.exports = router;

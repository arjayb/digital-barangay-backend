const express = require('express');
const { body } = require('express-validator');
const { getMyRequests, createRequest, getRequestById } = require('../controllers/requestController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { DOCUMENT_TYPES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', getMyRequests);

router.post(
  '/',
  upload.array('attachments', 5), // up to 5 files, field name "attachments"
  [
    body('documentType').isIn(DOCUMENT_TYPES).withMessage('Invalid document type'),
    body('purpose').trim().notEmpty().withMessage('Purpose is required'),
  ],
  validate,
  createRequest
);

router.get('/:id', getRequestById);

module.exports = router;

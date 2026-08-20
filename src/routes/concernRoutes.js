const express = require('express');
const { body } = require('express-validator');
const { createConcern, getMyConcerns } = require('../controllers/concernController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  upload.array('attachments', 3), // up to 3 files, field name "attachments"
  [
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
  ],
  validate,
  createConcern
);

router.get('/', getMyConcerns);

module.exports = router;

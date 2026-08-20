const express = require('express');
const { getProfile, updateProfile } = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authenticate, getProfile);
router.put('/me', authenticate, updateProfile);

module.exports = router;

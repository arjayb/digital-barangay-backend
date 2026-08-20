const express = require('express');
const { getNotices } = require('../controllers/noticeController');

const router = express.Router();

router.get('/', getNotices);

module.exports = router;

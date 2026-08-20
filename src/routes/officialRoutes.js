const express = require('express');
const { getOfficials } = require('../controllers/officialController');

const router = express.Router();

router.get('/', getOfficials);

module.exports = router;

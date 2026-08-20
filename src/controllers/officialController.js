const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

// @route GET /api/officials  (public directory)
const getOfficials = asyncHandler(async (req, res) => {
  const officials = await prisma.official.findMany({ orderBy: { position: 'asc' } });
  res.json({ success: true, count: officials.length, officials });
});

module.exports = { getOfficials };

const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

// @route GET /api/notices
const getNotices = asyncHandler(async (req, res) => {
  const notices = await prisma.notice.findMany({ orderBy: { publishedAt: 'desc' } });
  res.json({ success: true, count: notices.length, notices });
});

module.exports = { getNotices };

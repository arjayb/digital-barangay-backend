const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

// @route POST /api/concerns
const createConcern = asyncHandler(async (req, res) => {
  const { category, description, location } = req.body;

  const attachments = (req.files || []).map((file) => ({
    fileName: file.originalname,
    fileUrl: file.path,
  }));

  const concern = await prisma.concern.create({
    data: { reporterId: req.user.id, category, description, location, attachments },
  });

  res.status(201).json({ success: true, concern });
});

// @route GET /api/concerns  (own reports)
const getMyConcerns = asyncHandler(async (req, res) => {
  const concerns = await prisma.concern.findMany({
    where: { reporterId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: concerns.length, concerns });
});

module.exports = { createConcern, getMyConcerns };

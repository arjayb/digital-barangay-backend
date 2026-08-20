const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

// @route GET /api/users/me
const getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @route PUT /api/users/me
const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, address, contactNumber } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { fullName, address, contactNumber },
    select: { id: true, fullName: true, email: true, role: true, address: true, contactNumber: true },
  });

  res.json({ success: true, user });
});

module.exports = { getProfile, updateProfile };

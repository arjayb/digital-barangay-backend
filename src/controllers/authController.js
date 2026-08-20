const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('../utils/asyncHandler');

// @route POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, address, contactNumber } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      address,
      contactNumber,
      role: 'resident', // residents can never self-assign admin
    },
  });

  const token = generateToken(user.id, user.role);

  res.status(201).json({
    success: true,
    token,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
  });
});

// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const token = generateToken(user.id, user.role);

  res.json({
    success: true,
    token,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
  });
});

// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = { register, login, getMe };

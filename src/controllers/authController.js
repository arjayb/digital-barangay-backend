const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('../utils/asyncHandler');

// @route POST /api/auth/register
// Unchanged behavior: always creates a resident. Never trusts a
// client-supplied role — the only way to become admin/webmaster is through
// the credentialing workflow (applyForAdmin -> Webmaster approval) or the
// controlled seed scripts, never public registration.
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
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, staffId: user.staffId },
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

  // v1.1.0: suspended/pending/rejected staff must not receive an
  // operational JWT. Resident accounts are unaffected by staff lifecycle.
  if (['admin', 'webmaster'].includes(user.role) && user.accountStatus !== 'active') {
    return res.status(403).json({ success: false, message: 'Staff access is unavailable for this account.' });
  }

  const token = generateToken(user.id, user.role);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      staffId: user.staffId,
      accountStatus: user.accountStatus,
    },
  });
});

// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @route POST /api/auth/apply-admin
// v1.1.0 — additive, public. Creates a PENDING AdminApplication only — never
// a User, and never grants access on its own. A Webmaster must explicitly
// approve it (see webmasterController.approveApplication) before this
// applicant can log in as anything. No frontend page submits to this route
// in this release (see BUILD handoff, "discovered scope gap"); it exists so
// the credentialing workflow required by BUILD-SPEC-DBA-001 §9 is actually
// reachable, even though a self-serve UI for it wasn't in the approved
// frontend scope (§23-25).
const applyForAdmin = asyncHandler(async (req, res) => {
  const { applicantName, email, password } = req.body;

  if (!applicantName || !email || !password) {
    return res.status(400).json({ success: false, message: 'applicantName, email, and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Use case-insensitive checks so differently-cased forms of the same email
  // cannot create parallel identities or duplicate pending applications.
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
  });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'That email already has an account' });
  }

  const existingPendingApplication = await prisma.adminApplication.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
      status: 'pending',
    },
  });
  if (existingPendingApplication) {
    return res.status(400).json({ success: false, message: 'An application for this email is already pending review.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const application = await prisma.adminApplication.create({
    data: { applicantName, email: normalizedEmail, passwordHash, status: 'pending' },
  });

  res.status(201).json({
    success: true,
    application: {
      id: application.id,
      applicantName: application.applicantName,
      email: application.email,
      status: application.status,
      createdAt: application.createdAt,
    },
  });
});

module.exports = { register, login, getMe, applyForAdmin };

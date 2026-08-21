const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  address: true,
  contactNumber: true,
  createdAt: true,
  // v1.1.0 — additive
  staffId: true,
  accountStatus: true,
};

// Verifies the JWT sent as "Authorization: Bearer <token>" and attaches
// the corresponding user (minus passwordHash) to req.user.
const authenticate = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await prisma.user.findUnique({ where: { id: decoded.id }, select: USER_SELECT });

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
  }
});

// Usage: authorize('admin') or authorize('admin', 'resident')
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to do this' });
  }
  next();
};

// v1.1.0 — additive. Staff (admin/webmaster) must be `active` before their
// role-specific operations are allowed; a suspended or pending account
// keeps its row and history but loses operational access without being
// deleted. Applied after authorize(), so req.user.role is already known
// to be a staff role at this point. Residents never hit this middleware.
const requireActiveStaff = (req, res, next) => {
  if (!req.user || req.user.accountStatus !== 'active') {
    return res.status(403).json({
      success: false,
      message: 'This staff account is not currently active.',
    });
  }
  next();
};

module.exports = { authenticate, authorize, requireActiveStaff };

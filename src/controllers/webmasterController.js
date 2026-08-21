const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { nextStaffId } = require('../utils/staffId');

const STAFF_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  staffId: true,
  accountStatus: true,
  createdAt: true,
};

// ---- Credential requests ----

// @route GET /api/webmaster/applications?status=pending
const listApplications = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;

  const applications = await prisma.adminApplication.findMany({
    where,
    include: { reviewedBy: { select: { fullName: true, staffId: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, count: applications.length, applications });
});

// @route PATCH /api/webmaster/applications/:id/approve
// Atomically: creates the new admin User (role=admin, accountStatus=active,
// staffId=next ADM-####, passwordHash carried over unchanged from the
// application — never re-hashed or altered) and marks the application
// approved, attributed to the authenticated webmaster. Either both happen
// or neither does.
const approveApplication = asyncHandler(async (req, res) => {
  const application = await prisma.adminApplication.findUnique({ where: { id: req.params.id } });
  if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
  if (application.status !== 'pending') {
    return res.status(400).json({ success: false, message: `This application is already ${application.status}.` });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: application.email } });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const staffId = await nextStaffId(tx, 'ADM');

    const user = await tx.user.create({
      data: {
        fullName: application.applicantName,
        email: application.email,
        passwordHash: application.passwordHash,
        role: 'admin',
        staffId,
        accountStatus: 'active',
      },
      select: STAFF_SELECT,
    });

    const updatedApplication = await tx.adminApplication.update({
      where: { id: application.id },
      data: {
        status: 'approved',
        reviewedById: req.user.id,
        reviewNote: req.body?.reviewNote || null,
        reviewedAt: new Date(),
      },
    });

    return { user, application: updatedApplication };
  });

  res.json({ success: true, ...result });
});

// @route PATCH /api/webmaster/applications/:id/reject
const rejectApplication = asyncHandler(async (req, res) => {
  const { reviewNote } = req.body;
  if (!String(reviewNote || '').trim()) {
    return res.status(400).json({ success: false, message: 'A reason is required when rejecting an application.' });
  }

  const application = await prisma.adminApplication.findUnique({ where: { id: req.params.id } });
  if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
  if (application.status !== 'pending') {
    return res.status(400).json({ success: false, message: `This application is already ${application.status}.` });
  }

  const updated = await prisma.adminApplication.update({
    where: { id: application.id },
    data: { status: 'rejected', reviewedById: req.user.id, reviewNote, reviewedAt: new Date() },
  });

  res.json({ success: true, application: updated });
});

// ---- Administrators ----

// @route GET /api/webmaster/admins
const listAdmins = asyncHandler(async (req, res) => {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: STAFF_SELECT,
    orderBy: { staffId: 'asc' },
  });
  res.json({ success: true, count: admins.length, admins });
});

// @route PATCH /api/webmaster/admins/:id/suspend
// Suspension revokes operational access (requireActiveStaff middleware on
// adminRoutes checks accountStatus) without deleting the account or any of
// its historical actions — those remain intact and still show the admin's
// original staffId.
const suspendAdmin = asyncHandler(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.role !== 'admin') {
    return res.status(404).json({ success: false, message: 'Admin not found' });
  }
  if (target.accountStatus === 'suspended') {
    return res.status(400).json({ success: false, message: 'This admin is already suspended.' });
  }

  const [user] = await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { accountStatus: 'suspended' }, select: STAFF_SELECT }),
    prisma.adminCredentialEvent.create({
      data: {
        userId: target.id,
        action: 'suspended',
        performedById: req.user.id,
        note: req.body?.note || null,
      },
    }),
  ]);

  res.json({ success: true, user });
});

// @route PATCH /api/webmaster/admins/:id/reactivate
const reactivateAdmin = asyncHandler(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.role !== 'admin') {
    return res.status(404).json({ success: false, message: 'Admin not found' });
  }
  if (target.accountStatus === 'active') {
    return res.status(400).json({ success: false, message: 'This admin is already active.' });
  }

  const [user] = await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { accountStatus: 'active' }, select: STAFF_SELECT }),
    prisma.adminCredentialEvent.create({
      data: {
        userId: target.id,
        action: 'reactivated',
        performedById: req.user.id,
        note: req.body?.note || null,
      },
    }),
  ]);

  res.json({ success: true, user });
});

// ---- Credential history ----

// @route GET /api/webmaster/credential-history
// Merges the two event sources — application review (approve/reject) and
// AdminCredentialEvent (suspend/reactivate) — into one chronological feed,
// since both are "credentialing actions" from the Webmaster Portal's point
// of view (BUILD-SPEC-DBA-001 §10).
const getCredentialHistory = asyncHandler(async (req, res) => {
  const [reviewedApplications, credentialEvents] = await Promise.all([
    prisma.adminApplication.findMany({
      where: { status: { in: ['approved', 'rejected'] } },
      include: { reviewedBy: { select: { fullName: true, staffId: true } } },
      orderBy: { reviewedAt: 'desc' },
    }),
    prisma.adminCredentialEvent.findMany({
      include: {
        user: { select: { fullName: true, staffId: true } },
        performedBy: { select: { fullName: true, staffId: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const events = [
    ...reviewedApplications.map((a) => ({
      type: a.status, // 'approved' | 'rejected'
      subject: a.applicantName,
      subjectEmail: a.email,
      performedBy: a.reviewedBy ? `${a.reviewedBy.fullName} (${a.reviewedBy.staffId || 'WEB'})` : 'Unknown',
      note: a.reviewNote,
      timestamp: a.reviewedAt,
    })),
    ...credentialEvents.map((e) => ({
      type: e.action, // 'suspended' | 'reactivated'
      subject: e.user.fullName,
      subjectStaffId: e.user.staffId,
      performedBy: `${e.performedBy.fullName} (${e.performedBy.staffId || 'WEB'})`,
      note: e.note,
      timestamp: e.createdAt,
    })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({ success: true, count: events.length, events });
});

module.exports = {
  listApplications,
  approveApplication,
  rejectApplication,
  listAdmins,
  suspendAdmin,
  reactivateAdmin,
  getCredentialHistory,
};

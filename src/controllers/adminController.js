const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { isValidRequestTransition, isValidConcernTransition } = require('../utils/stateMachine');

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

// ---- Users ----

// @route GET /api/admin/users?search=&page=&limit=
const getUsers = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;

  const where = search
    ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      skip: (page - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ success: true, total, page: Number(page), users });
});

// @route PATCH /api/admin/users/:id
// v1.1.0 security boundary: ordinary Admins may edit profile metadata only.
// Role, staff identity, and account lifecycle are credential-governance fields
// owned exclusively by the Webmaster workflow. Reject attempts explicitly so
// a legacy client cannot silently request a privilege change.
const updateUser = asyncHandler(async (req, res) => {
  const protectedFields = ['role', 'staffId', 'accountStatus'];
  const attemptedProtectedFields = protectedFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body || {}, field)
  );

  if (attemptedProtectedFields.length) {
    return res.status(403).json({
      success: false,
      message: 'Administrative credential fields can only be changed through the Webmaster workflow.',
    });
  }

  const { fullName, address, contactNumber } = req.body;
  const data = {};
  if (fullName !== undefined) data.fullName = fullName;
  if (address !== undefined) data.address = address;
  if (contactNumber !== undefined) data.contactNumber = contactNumber;

  const user = await prisma.user
    .update({
      where: { id: req.params.id },
      data,
      select: USER_SELECT,
    })
    .catch(() => null);

  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  res.json({ success: true, user });
});

// ---- Document requests ----

// @route GET /api/admin/requests?status=&documentType=
// v1.1.0 — now includes history so the Admin Portal can show request
// history / decision notes without a separate round trip.
const getAllRequests = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.documentType) where.documentType = req.query.documentType;

  const requests = await prisma.documentRequest.findMany({
    where,
    include: {
      requestor: { select: { fullName: true, email: true } },
      history: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, count: requests.length, requests });
});

// @route PATCH /api/admin/requests/:id/status
// v1.1.0 — now backend-authoritative: rejects any transition not on the
// approved state machine, requires a non-empty note for under_review ->
// rejected, and writes the status update + RequestStatusHistory row in one
// atomic transaction, attributed to the authenticated admin's own staffId
// (never a client-supplied actor id).
const updateRequestStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const existing = await prisma.documentRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });

  if (!isValidRequestTransition('admin', existing.status, status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot move a request from "${existing.status}" to "${status}".`,
    });
  }

  if (existing.status === 'under_review' && status === 'rejected' && !String(note || '').trim()) {
    return res.status(400).json({
      success: false,
      message: 'A reason is required when rejecting a request.',
    });
  }

  const [request] = await prisma.$transaction([
    prisma.documentRequest.update({ where: { id: existing.id }, data: { status } }),
    prisma.requestStatusHistory.create({
      data: {
        requestId: existing.id,
        fromStatus: existing.status,
        toStatus: status,
        actorUserId: req.user.id,
        actorType: 'admin',
        actorStaffId: req.user.staffId || null,
        note: note || null,
      },
    }),
  ]);

  res.json({ success: true, request });
});

// ---- Officials ----

const createOfficial = asyncHandler(async (req, res) => {
  const official = await prisma.official.create({ data: req.body });
  res.status(201).json({ success: true, official });
});

const updateOfficial = asyncHandler(async (req, res) => {
  const official = await prisma.official
    .update({ where: { id: req.params.id }, data: req.body })
    .catch(() => null);
  if (!official) return res.status(404).json({ success: false, message: 'Official not found' });
  res.json({ success: true, official });
});

const deleteOfficial = asyncHandler(async (req, res) => {
  const official = await prisma.official.delete({ where: { id: req.params.id } }).catch(() => null);
  if (!official) return res.status(404).json({ success: false, message: 'Official not found' });
  res.json({ success: true, message: 'Official removed' });
});

// ---- Notices ----

const createNotice = asyncHandler(async (req, res) => {
  const notice = await prisma.notice.create({ data: { ...req.body, postedById: req.user.id } });
  res.status(201).json({ success: true, notice });
});

const updateNotice = asyncHandler(async (req, res) => {
  const notice = await prisma.notice.update({ where: { id: req.params.id }, data: req.body }).catch(() => null);
  if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
  res.json({ success: true, notice });
});

const deleteNotice = asyncHandler(async (req, res) => {
  const notice = await prisma.notice.delete({ where: { id: req.params.id } }).catch(() => null);
  if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
  res.json({ success: true, message: 'Notice removed' });
});

// ---- Concerns ----

// v1.1.0 — now includes history, same rationale as getAllRequests.
const getAllConcerns = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;

  const concerns = await prisma.concern.findMany({
    where,
    include: {
      reporter: { select: { fullName: true, email: true } },
      history: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: concerns.length, concerns });
});

// v1.1.0 — same state-machine + atomic-history treatment as
// updateRequestStatus. Admin transitions stop at `resolved`; only the
// reporting resident can move a concern to `closed` (see
// concernController.confirmResolved).
const updateConcernStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const existing = await prisma.concern.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ success: false, message: 'Concern not found' });

  if (!isValidConcernTransition('admin', existing.status, status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot move a concern from "${existing.status}" to "${status}".`,
    });
  }

  const [concern] = await prisma.$transaction([
    prisma.concern.update({ where: { id: existing.id }, data: { status } }),
    prisma.concernStatusHistory.create({
      data: {
        concernId: existing.id,
        fromStatus: existing.status,
        toStatus: status,
        actorUserId: req.user.id,
        actorType: 'admin',
        actorStaffId: req.user.staffId || null,
        note: note || null,
      },
    }),
  ]);

  res.json({ success: true, concern });
});

// ---- Basic reporting ----

// @route GET /api/admin/reports/summary
const getReportsSummary = asyncHandler(async (req, res) => {
  const [requestsByStatus, requestsByType, concernsByStatus, totalUsers] = await Promise.all([
    prisma.documentRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.documentRequest.groupBy({ by: ['documentType'], _count: { _all: true } }),
    prisma.concern.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.count({ where: { role: 'resident' } }),
  ]);

  res.json({
    success: true,
    summary: {
      totalUsers,
      requestsByStatus: requestsByStatus.map((r) => ({ _id: r.status, count: r._count._all })),
      requestsByType: requestsByType.map((r) => ({ _id: r.documentType, count: r._count._all })),
      concernsByStatus: concernsByStatus.map((r) => ({ _id: r.status, count: r._count._all })),
    },
  });
});

module.exports = {
  getUsers,
  updateUser,
  getAllRequests,
  updateRequestStatus,
  createOfficial,
  updateOfficial,
  deleteOfficial,
  createNotice,
  updateNotice,
  deleteNotice,
  getAllConcerns,
  updateConcernStatus,
  getReportsSummary,
};
